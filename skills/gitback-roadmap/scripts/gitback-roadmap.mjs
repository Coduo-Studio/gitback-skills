#!/usr/bin/env node
/**
 * Reads a repository the way Gitback's Roadmap reads it, and applies an
 * approved lane plan as labels, under whoever `gh` is signed in as.
 *
 *   node gitback-roadmap.mjs open  <owner/repo>              the Open lane, with evidence per item
 *   node gitback-roadmap.mjs apply <plan.json> [--dry-run]   show the change and the undo; without --dry-run, make it
 *
 * Plan file:
 *   { "repo": "owner/repo", "items": [ { "number": 12, "lane": "planned", "reason": "..." } ] }
 * `lane` is one of planned | in-progress | complete | open ("open" strips every lane label).
 *
 * No dependencies: Node 18+ and the GitHub CLI only.
 *
 * The rules below are ported from Gitback's roadmap code.
 * The Board reads OPEN Issues only; a lane is decided by labels alone; Open is
 * an open Issue carrying no lane label (canonical or mapped) and not the
 * Support label. Change both together.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const CANONICAL = { planned: "roadmap: planned", "in-progress": "roadmap: in progress", complete: "roadmap: complete" };
const LANES = ["planned", "in-progress", "complete"];
const WRITE_PERMS = new Set(["ADMIN", "MAINTAIN", "WRITE"]);
const LABEL_DESCRIPTION = "Gitback roadmap lane";

// ---------------------------------------------------------------- gh

function gh(args, { allow404 = false } = {}) {
  try {
    return execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 << 20 });
  } catch (error) {
    const stderr = String(error.stderr ?? "");
    if (allow404 && /404|Not Found/i.test(stderr)) return null;
    throw new Error(`gh ${args.slice(0, 3).join(" ")} failed: ${stderr.trim() || error.message}`);
  }
}

const q = (s) => (/^[\w./:-]+$/.test(s) ? s : `'${s.replaceAll("'", `'\\''`)}'`);

// ---------------------------------------------------------------- config

/**
 * Just enough YAML for the two blocks the Roadmap reads from
 * `.gitback/config.yml`: `roadmapLabels` (status -> label) and `support.label`,
 * plus `modules.roadmap`. Block or inline-map form. Anything else in the file
 * is ignored, as Gitback ignores it.
 */
export function parseConfig(text) {
  const blocks = {};
  let current = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+#.*$/, "");
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const top = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (top) {
      current = top[1];
      blocks[current] = {};
      const inline = top[2].trim();
      if (inline.startsWith("{") && inline.endsWith("}")) {
        for (const pair of inline.slice(1, -1).split(",")) {
          const m = pair.match(/^\s*([^:]+?)\s*:\s*(.*?)\s*$/);
          if (m) blocks[current][unquote(m[1])] = unquote(m[2]);
        }
        current = null;
      }
      continue;
    }
    const nested = line.match(/^\s+(["']?[^:"']+["']?)\s*:\s*(.*?)\s*$/);
    if (nested && current) blocks[current][unquote(nested[1])] = unquote(nested[2]);
  }
  const mapping = {}; // label -> lane, as Gitback's laneMappingFromConfig builds it
  for (const [status, label] of Object.entries(blocks.roadmapLabels ?? {})) {
    if (LANES.includes(status) && label) mapping[label] = status;
  }
  return {
    mapping,
    supportLabel: blocks.support?.label || "support",
    roadmapHidden: blocks.modules?.roadmap === "false",
  };
}

function unquote(s) {
  const v = s.trim();
  return v.length >= 2 && /^(["']).*\1$/.test(v) ? v.slice(1, -1) : v;
}

// ---------------------------------------------------------------- repo

function readRepo(repo) {
  const info = JSON.parse(gh(["repo", "view", repo, "--json", "nameWithOwner,visibility,viewerPermission"]));
  const raw = gh(["api", `repos/${info.nameWithOwner}/contents/.gitback/config.yml`, "--jq", ".content"], { allow404: true });
  const config = raw ? parseConfig(Buffer.from(raw.trim(), "base64").toString("utf8")) : parseConfig("");
  const laneLabel = { ...CANONICAL };
  for (const [label, lane] of Object.entries(config.mapping)) laneLabel[lane] = label;
  const allLaneLabels = new Set([...Object.values(CANONICAL), ...Object.keys(config.mapping)]);
  const existing = new Set(JSON.parse(gh(["label", "list", "-R", info.nameWithOwner, "--limit", "1000", "--json", "name"])).map((l) => l.name));
  return { ...info, hasConfig: Boolean(raw), ...config, laneLabel, allLaneLabels, existing };
}

function header(r) {
  const out = [
    `repo        ${r.nameWithOwner} (${r.visibility.toLowerCase()})`,
    `you         ${r.viewerPermission}${WRITE_PERMS.has(r.viewerPermission) ? "" : "  <- no write access: apply will refuse"}`,
    `config      ${r.hasConfig ? ".gitback/config.yml found" : "no .gitback/config.yml (canonical labels)"}${r.roadmapHidden ? "; modules.roadmap is false, Visitors do not see the Roadmap" : ""}`,
  ];
  for (const lane of LANES) {
    const label = r.laneLabel[lane];
    const mapped = label !== CANONICAL[lane];
    out.push(`lane        ${lane.padEnd(12)} <- ${q(label)}${mapped ? " (Client mapping)" : ""}${r.existing.has(label) ? "" : mapped ? "  MISSING" : "  (not created yet)"}`);
  }
  out.push(`hidden      issues labelled ${q(r.supportLabel)} (Support threads)`);
  return out.join("\n");
}

// ---------------------------------------------------------------- open

// One batched read: every open Issue with the PRs and commits that reference
// it. Page size 25 because each cross-reference carries the PR's body, which
// the closing-keyword check reads.
const ISSUES_QUERY = `query($owner:String!,$name:String!,$endCursor:String){repository(owner:$owner,name:$name){issues(states:OPEN,first:25,after:$endCursor,orderBy:{field:UPDATED_AT,direction:DESC}){pageInfo{hasNextPage endCursor} nodes{number title updatedAt labels(first:30){nodes{name}} assignees(first:5){nodes{login}} milestone{title dueOn} reactions(content:THUMBS_UP){totalCount} comments(last:1){nodes{createdAt}} closedByPullRequestsReferences(first:10,includeClosedPrs:true){nodes{number state authorAssociation repository{nameWithOwner}}} timelineItems(itemTypes:[CROSS_REFERENCED_EVENT,REFERENCED_EVENT],last:50){nodes{... on CrossReferencedEvent{createdAt source{... on PullRequest{number state title body authorAssociation repository{nameWithOwner}}}} ... on ReferencedEvent{createdAt commitRepository{nameWithOwner} commit{messageHeadline}}}}}}}}`;

const COMMIT_DAYS = 14;
const MAINTAINER = new Set(["OWNER", "MEMBER", "COLLABORATOR"]);

/**
 * GitHub's closing keywords, one per reference, as GitHub parses them. A PR
 * merged into a non-default branch (a `staging` flow) never gets GitHub's
 * closing link, so the PR's own title and body are read instead.
 */
export function closesIssue(text, repo, number) {
  const ref = String.raw`(?:${repo.replace(/[.]/g, "\\.")})?#${number}|https://github\.com/${repo.replace(/[.]/g, "\\.")}/issues/${number}`;
  return new RegExp(String.raw`\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\b:?\s+(?:${ref})(?![\d/])`, "i").test(text ?? "");
}

/**
 * The evidence for one Issue, from the batched read. A PR counts when it
 * closes the Issue (GitHub's link, or a closing keyword); a PR that only
 * mentions it is listed as a mention and drafts nothing. A commit counts when
 * its headline names `#n` within COMMIT_DAYS. Label, milestone and assignee
 * edits are never activity.
 */
export function evidenceFor(issue, repo, now = Date.now()) {
  const prs = new Map(); // number -> { state, closes, outside }
  for (const pr of issue.closedByPullRequestsReferences.nodes) {
    if (pr.repository?.nameWithOwner === repo) prs.set(pr.number, { state: pr.state, closes: true, outside: !MAINTAINER.has(pr.authorAssociation) });
  }
  let active = issue.comments.nodes[0]?.createdAt ?? null;
  const bump = (at) => { if (at && (!active || at > active)) active = at; };
  let commits = 0;
  for (const event of issue.timelineItems.nodes) {
    const pr = event.source;
    if (pr?.number && pr.repository?.nameWithOwner === repo) {
      bump(event.createdAt);
      const closes = prs.get(pr.number)?.closes || closesIssue(`${pr.title}\n${pr.body}`, repo, issue.number);
      prs.set(pr.number, { state: pr.state, closes, outside: !MAINTAINER.has(pr.authorAssociation) });
    } else if (event.commit && event.commitRepository?.nameWithOwner === repo && new RegExp(`#${issue.number}(?!\\d)`).test(event.commit.messageHeadline)) {
      bump(event.createdAt);
      if ((now - Date.parse(event.createdAt)) / 864e5 <= COMMIT_DAYS) commits += 1;
    }
  }
  const closing = (state) => [...prs.values()].some((p) => p.closes && p.state === state);
  const due = issue.milestone?.dueOn?.slice(0, 10);
  const hint = closing("MERGED") ? "complete?"
    : closing("OPEN") || commits ? "in-progress?"
    : issue.milestone && (!due || Date.parse(due) >= now) ? "planned?"
    : "-";
  return { prs, commits, active, due, hint };
}

function cmdOpen(repoArg) {
  const r = readRepo(repoArg);
  const [owner, name] = r.nameWithOwner.split("/");
  const lines = gh(["api", "graphql", "--paginate", "-F", `owner=${owner}`, "-F", `name=${name}`, "-f", `query=${ISSUES_QUERY}`, "--jq", ".data.repository.issues.nodes[]"]);
  const issues = lines.split("\n").filter(Boolean).map((l) => JSON.parse(l));
  let laned = 0;
  let support = 0;
  const open = [];
  for (const issue of issues) {
    const labels = issue.labels.nodes.map((l) => l.name);
    if (labels.includes(r.supportLabel)) { support += 1; continue; }
    if (labels.some((l) => r.allLaneLabels.has(l))) { laned += 1; continue; }
    open.push({ issue, ...evidenceFor(issue, r.nameWithOwner) });
  }
  const byVotes = open.some((o) => o.issue.reactions.totalCount > 0);
  open.sort((a, b) => (byVotes ? b.issue.reactions.totalCount - a.issue.reactions.totalCount : 0) || (b.active ?? "").localeCompare(a.active ?? ""));
  const outside = open.flatMap((o) => [...o.prs].filter(([, p]) => p.outside && p.state === "OPEN").map(([n]) => `#${n}`));

  console.log(header(r));
  console.log(`\n${issues.length} open issues: ${open.length} in Open, ${laned} already in a lane, ${support} Support threads (not on the Roadmap)`);
  console.log(`ranked by   ${byVotes ? "thumbs-up, then last activity" : "last activity (every thumbs-up count is 0)"}; activity = a comment, a PR reference or a commit naming the Issue, never a label, milestone or assignee edit`);
  console.log(`outside PRs ${outside.length ? `${[...new Set(outside)].join(", ")} open by non-maintainers` : "none open"}`);
  const counts = new Map();
  for (const o of open) counts.set(o.hint, (counts.get(o.hint) ?? 0) + 1);
  const hints = [...counts].map(([h, n]) => `${h} ${n}`).join(", ");
  console.log(`hints       ${hints}`);
  console.log(`\n${["#", "thumbs", "active", "assignees", "milestone", "prs", `commits/${COMMIT_DAYS}d`, "hint", "title"].join("\t")}`);
  for (const { issue, prs, commits, active, due, hint } of open) {
    const closing = [...prs].filter(([, p]) => p.closes).map(([n, p]) => `#${n} ${p.state.toLowerCase()}${p.outside ? " outside" : ""}`);
    const mentions = [...prs].filter(([, p]) => !p.closes);
    const openMentions = mentions.filter(([, p]) => p.state === "OPEN").map(([n]) => `#${n} open mention`);
    const rest = mentions.length - openMentions.length;
    console.log([
      `#${issue.number}`,
      issue.reactions.totalCount,
      active?.slice(0, 10) ?? "-",
      issue.assignees.nodes.map((a) => a.login).join(",") || "-",
      issue.milestone ? `${issue.milestone.title}${due ? ` (due ${due})` : ""}` : "-",
      [...closing.map((c) => `${c} closes`), ...openMentions, ...(rest ? [`+${rest} mentions`] : [])].join(",") || "-",
      commits || "-",
      hint,
      issue.title,
    ].join("\t"));
  }
}

// ---------------------------------------------------------------- apply

function cmdApply(planPath, dryRun) {
  const plan = JSON.parse(readFileSync(planPath, "utf8"));
  if (!plan.repo || !Array.isArray(plan.items) || plan.items.length === 0) throw new Error("plan needs repo and a non-empty items list");
  const seen = new Set();
  for (const item of plan.items) {
    if (!Number.isInteger(item.number)) throw new Error(`bad issue number: ${JSON.stringify(item)}`);
    if (![...LANES, "open"].includes(item.lane)) throw new Error(`#${item.number}: lane must be planned | in-progress | complete | open, got ${item.lane}`);
    if (seen.has(item.number)) throw new Error(`#${item.number} is in the plan twice`);
    seen.add(item.number);
  }
  const r = readRepo(plan.repo);
  console.log(header(r));

  const changes = [];
  const skipped = [];
  for (const item of plan.items) {
    const issue = JSON.parse(gh(["api", `repos/${r.nameWithOwner}/issues/${item.number}`]));
    if (issue.pull_request) { skipped.push(`#${item.number} is a pull request; the Roadmap shows Issues only`); continue; }
    if (issue.state !== "open") { skipped.push(`#${item.number} is closed; the Roadmap shows open Issues only`); continue; }
    const labels = issue.labels.map((l) => l.name);
    if (labels.includes(r.supportLabel)) { skipped.push(`#${item.number} carries the Support label ${q(r.supportLabel)}; the Roadmap never shows it`); continue; }
    const target = item.lane === "open" ? null : r.laneLabel[item.lane];
    const remove = labels.filter((l) => r.allLaneLabels.has(l) && l !== target);
    const add = target && !labels.includes(target) ? [target] : [];
    if (!add.length && !remove.length) { skipped.push(`#${item.number} is already in ${item.lane}`); continue; }
    changes.push({ number: item.number, title: issue.title, lane: item.lane, add, remove });
  }

  const toCreate = [...new Set(changes.flatMap((c) => c.add))].filter((l) => !r.existing.has(l));
  const missingMapped = toCreate.filter((l) => !Object.values(CANONICAL).includes(l));
  if (missingMapped.length) throw new Error(`.gitback/config.yml maps a lane to ${missingMapped.map(q).join(", ")}, which the repo does not have. Ask the Client to create it or fix the mapping; this script creates only Gitback's own three labels.`);

  console.log(`\n${dryRun ? "WOULD CHANGE" : "CHANGING"} ${changes.length} issue(s):`);
  for (const c of changes) {
    const parts = [...c.add.map((l) => `+${q(l)}`), ...c.remove.map((l) => `-${q(l)}`)];
    console.log(`  #${c.number}  -> ${c.lane.padEnd(11)}  ${parts.join(" ")}  ${c.title}`);
  }
  if (skipped.length) console.log(`\nSKIPPED:\n${skipped.map((s) => `  ${s}`).join("\n")}`);
  console.log(`\nLABELS TO CREATE: ${toCreate.length ? toCreate.map(q).join(", ") : "none"}`);
  if (r.visibility === "PRIVATE" && changes.some((c) => c.lane !== "open")) {
    console.log("\nPRIVATE REPO: a lane label shows the Issue's title, body and votes to everyone who can see the Board once it is published.");
  }
  if (r.roadmapHidden) console.log("\nNOTE: modules.roadmap is false, so Visitors will not see these lanes until the Client turns the Roadmap on.");

  const run = (cs) => editCommands(r.nameWithOwner, cs, (c) => ({ add: c.add, remove: c.remove }));
  const undo = (cs, created) => [
    ...editCommands(r.nameWithOwner, cs, (c) => ({ add: c.remove, remove: c.add })),
    ...created.map((l) => `# optional, deletes a label this run created: gh label delete ${q(l)} -R ${r.nameWithOwner}`),
  ];

  if (!changes.length) { console.log("\nNothing to change."); return; }
  if (dryRun) {
    console.log(`\nCOMMANDS:\n${[...toCreate.map((l) => createCommand(r.nameWithOwner, l)), ...run(changes)].map((c) => `  ${c}`).join("\n")}`);
    console.log(`\nUNDO (after applying):\n${undo(changes, toCreate).map((c) => `  ${c}`).join("\n")}`);
    return;
  }
  if (!WRITE_PERMS.has(r.viewerPermission)) throw new Error(`the signed-in gh account has ${r.viewerPermission} on ${r.nameWithOwner}; labels need write access`);

  const created = [];
  for (const label of toCreate) {
    gh(["label", "create", label, "-R", r.nameWithOwner, "--description", LABEL_DESCRIPTION]);
    created.push(label);
  }
  const done = [];
  try {
    for (const group of groupBy(changes, (c) => ({ add: c.add, remove: c.remove }))) {
      const args = ["issue", "edit", ...group.items.map((c) => String(c.number)), "-R", r.nameWithOwner];
      for (const l of group.key.add) args.push("--add-label", l);
      for (const l of group.key.remove) args.push("--remove-label", l);
      gh(args);
      done.push(...group.items);
    }
  } catch (error) {
    console.error(`\nSTOPPED: ${error.message}`);
    console.error(`Applied ${done.length} of ${changes.length}. UNDO for what was applied:\n${undo(done, created).map((c) => `  ${c}`).join("\n")}`);
    process.exit(1);
  }
  console.log(`\nAPPLIED ${done.length} issue(s). UNDO:\n${undo(done, created).map((c) => `  ${c}`).join("\n")}`);
}

function createCommand(repo, label) {
  return `gh label create ${q(label)} -R ${repo} --description ${q(LABEL_DESCRIPTION)}`;
}

function groupBy(changes, keyOf) {
  const groups = new Map();
  for (const c of changes) {
    const key = keyOf(c);
    const id = JSON.stringify(key);
    if (!groups.has(id)) groups.set(id, { key, items: [] });
    groups.get(id).items.push(c);
  }
  return [...groups.values()];
}

function editCommands(repo, changes, keyOf) {
  return groupBy(changes, keyOf)
    .filter((g) => g.key.add.length || g.key.remove.length)
    .map((g) => [
      "gh issue edit", g.items.map((c) => c.number).join(" "), "-R", repo,
      ...g.key.add.map((l) => `--add-label ${q(l)}`),
      ...g.key.remove.map((l) => `--remove-label ${q(l)}`),
    ].join(" "));
}

// ---------------------------------------------------------------- main

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
const [command, target, ...flags] = isMain ? process.argv.slice(2) : [];
if (isMain) try {
  if (command === "open" && target) cmdOpen(target);
  else if (command === "apply" && target) cmdApply(target, flags.includes("--dry-run"));
  else {
    console.error("usage: gitback-roadmap.mjs open <owner/repo> | apply <plan.json> [--dry-run]");
    process.exit(2);
  }
} catch (error) {
  console.error(`error: ${error.message}`);
  process.exit(1);
}
