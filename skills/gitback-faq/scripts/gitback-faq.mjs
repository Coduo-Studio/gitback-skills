#!/usr/bin/env node
/**
 * Checks `.gitback/faq/*.md` against Gitback's FAQ contract and regenerates
 * `.gitback/README.md` the way Gitback's own writer does, so a commit made by
 * an agent looks exactly like a commit made from the Board.
 *
 *   node gitback-faq.mjs check [repo-root]   validate every FAQ file; exit 1 on any error
 *   node gitback-faq.mjs index [repo-root]   check, then rewrite .gitback/README.md
 *
 * No dependencies: Node 18+ only.
 *
 * Ported from Gitback's own FAQ frontmatter reader and README index writer. The README output must stay
 * byte-identical to the server's, or the next save from the Board rewrites it
 * and the history shows a drifted index. Change both together.
 */
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";

// ---------------------------------------------------------------- contract

const FAQ_DIR = ".gitback/faq";
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const KNOWN_KEYS = new Set(["question", "order", "tags", "updated", "source"]);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

class FrontmatterError extends Error {}

function scalar(raw) {
  const value = raw.trim();
  const quoted =
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")));
  return quoted ? value.slice(1, -1) : value;
}

function inlineList(raw, key) {
  const value = raw.trim();
  if (!value.startsWith("[") || !value.endsWith("]")) {
    throw new FrontmatterError(`${key} must be an inline list like [a, b], got: ${value}`);
  }
  const inner = value.slice(1, -1).trim();
  if (inner === "") return [];
  return inner.split(",").map((item) => {
    const s = scalar(item);
    if (s === "") throw new FrontmatterError(`${key} has an empty item: ${value}`);
    return s;
  });
}

/** Same subset and same refusals as the server's README-index reader. */
function parseFaqFrontmatter(text) {
  const lines = text.split(/\r?\n/);
  if (lines[0] !== "---") throw new FrontmatterError("file does not start with a --- frontmatter fence");
  const close = lines.indexOf("---", 1);
  if (close === -1) throw new FrontmatterError("frontmatter fence is never closed");

  const seen = new Map();
  for (const line of lines.slice(1, close)) {
    if (line.trim() === "") continue;
    const colon = line.indexOf(":");
    if (colon === -1 || line.startsWith(" ") || line.startsWith("\t")) {
      throw new FrontmatterError(`not a flat key: value line: ${line}`);
    }
    const key = line.slice(0, colon).trim();
    const value = line.slice(colon + 1);
    if (!KNOWN_KEYS.has(key)) throw new FrontmatterError(`unknown frontmatter key: ${key}`);
    if (seen.has(key)) throw new FrontmatterError(`duplicate frontmatter key: ${key}`);
    seen.set(key, value);
  }

  const question = seen.get("question");
  if (question === undefined || scalar(question) === "") throw new FrontmatterError("frontmatter has no question");
  const out = { question: scalar(question) };

  const order = seen.get("order");
  if (order !== undefined) {
    const s = scalar(order);
    if (!/^-?\d+$/.test(s)) throw new FrontmatterError(`order must be an integer, got: ${s}`);
    out.order = Number(s);
  }
  const tags = seen.get("tags");
  if (tags !== undefined) out.tags = inlineList(tags, "tags");
  const updated = seen.get("updated");
  if (updated !== undefined) out.updated = scalar(updated);
  const source = seen.get("source");
  if (source !== undefined) out.source = scalar(source);
  out.body = lines.slice(close + 1).join("\n").trim();
  return out;
}

// ------------------------------------------------------------------- check

function listFiles(dir, root) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...listFiles(full, root));
    else out.push(relative(root, full).split(sep).join("/"));
  }
  return out;
}

function check(root) {
  const errors = [];
  const warnings = [];
  const dir = join(root, FAQ_DIR);
  const files = listFiles(dir, dir).filter((p) => p.endsWith(".md"));
  const byQuestion = new Map();

  for (const path of files) {
    const where = `${FAQ_DIR}/${path}`;
    const slug = path.slice(0, -3);
    if (path.includes("/")) {
      errors.push(`${where}: FAQ files sit directly in ${FAQ_DIR}/, no subfolders`);
      continue;
    }
    if (!SLUG.test(slug)) {
      errors.push(`${where}: filename must be a lowercase kebab-case slug, e.g. enable-dark-mode.md`);
      continue;
    }
    let fm;
    try {
      fm = parseFaqFrontmatter(readFileSync(join(dir, path), "utf8"));
    } catch (error) {
      if (!(error instanceof FrontmatterError)) throw error;
      errors.push(`${where}: ${error.message}`);
      continue;
    }
    if (fm.updated !== undefined && !DATE.test(fm.updated)) errors.push(`${where}: updated must be YYYY-MM-DD`);
    if (fm.source !== undefined && !/^https:\/\//.test(fm.source)) {
      errors.push(`${where}: source must be the https URL of a GitHub Discussion`);
    }
    for (const tag of fm.tags ?? []) {
      if (!SLUG.test(tag)) warnings.push(`${where}: tag "${tag}" reads better as lowercase kebab-case`);
    }
    if (fm.body === "") errors.push(`${where}: no answer below the frontmatter`);
    const key = fm.question.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (byQuestion.has(key)) errors.push(`${where}: same question as ${byQuestion.get(key)}`);
    else byQuestion.set(key, where);
  }

  for (const w of warnings) console.log(`warn  ${w}`);
  for (const e of errors) console.log(`error ${e}`);
  console.log(`${files.length} FAQ file(s), ${errors.length} error(s), ${warnings.length} warning(s)`);
  return errors.length === 0;
}

// ------------------------------------------------------------ README index
// Everything below matches the server's renderReadmeIndex byte for byte.

const README_PATH = "README.md";
const CONFIG_PATH = "config.yml";
const FAQ_PATH = /^faq\/[^/]+\.md$/;
const HELP_PATH = /^help\/[^/]+\.md$/;
const HELP_COLLECTIONS_PATH = "help/collections.yml";
const SUPPORT_REPLY_PATH = /^support\/replies\/[^/]+\.md$/;

const isHelp = (path) => path === HELP_COLLECTIONS_PATH || HELP_PATH.test(path);

const PREAMBLE = `# .gitback

This directory is written by Gitback, the feedback board built for this repository,
and it belongs to you. Everything in it is plain markdown and YAML that a person can
read and edit without any tool of ours: if you stop using Gitback, delete nothing —
it all keeps working as documentation.

## What is here

- \`config.yml\` — which discussion category feeds which part of the board, how
  roadmap labels map to lanes, and the Support settings.
- \`faq/\` — one markdown file per question. The filename is the question's slug; the
  frontmatter at the top holds the question text, its order, tags, the date it was last
  updated and the discussion it was promoted from. The body is the answer.
- \`help/\` — one markdown file per help article, named by its slug, with its title and
  tags in the frontmatter. \`help/collections.yml\`, when present, lists the curated
  collections and the articles in each, in order.
- \`support/replies/\` — one markdown file per canned Support reply. A title line in
  the frontmatter names it; otherwise the filename does. The body is the reply.
- \`README.md\` — this file.

## Editing by hand

Edit or add any file directly and commit it. To add a question, create a new file in
\`faq/\` with a frontmatter block that has at least a question line; to remove one,
delete its file. The board reads the directory itself, so a change takes effect as
soon as it is on the default branch.

The index below is a convenience, never a source of truth. Gitback regenerates it in
the same commit as any change it makes, but a file you add by hand works before the
index catches up, and an index entry with no file behind it means nothing.

## Index
`;

const indexSafeReason = (message) => message.replace(/`/g, "").replace(/\s+/g, " ").trim();
const byPath = (a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
function byOrderThenPath(a, b) {
  const ao = a.frontmatter.order ?? Number.MAX_SAFE_INTEGER;
  const bo = b.frontmatter.order ?? Number.MAX_SAFE_INTEGER;
  if (ao !== bo) return ao - bo;
  return byPath(a, b);
}

function renderReadmeIndex(entries) {
  const faq = [];
  const skipped = [];
  for (const entry of entries.filter((e) => FAQ_PATH.test(e.path))) {
    try {
      faq.push({ path: entry.path, frontmatter: parseFaqFrontmatter(entry.content) });
    } catch (error) {
      if (!(error instanceof FrontmatterError)) throw error;
      skipped.push({ path: entry.path, reason: error.message });
    }
  }
  faq.sort(byOrderThenPath);
  skipped.sort(byPath);
  const other = entries
    .map((e) => e.path)
    .filter((p) => p !== README_PATH && !FAQ_PATH.test(p) && !isHelp(p) && !SUPPORT_REPLY_PATH.test(p))
    .sort();
  const help = entries.map((e) => e.path).filter((p) => HELP_PATH.test(p)).sort();
  const hasCollections = entries.some((e) => e.path === HELP_COLLECTIONS_PATH);
  const replies = entries.map((e) => e.path).filter((p) => SUPPORT_REPLY_PATH.test(p)).sort();

  const lines = [];
  for (const path of other) {
    lines.push(path === CONFIG_PATH ? `- [\`${path}\`](${path}) — board configuration` : `- [\`${path}\`](${path})`);
  }
  if (faq.length > 0 || skipped.length > 0) {
    lines.push("", "### FAQ", "");
    for (const row of faq) lines.push(`- [${row.frontmatter.question}](${row.path})`);
    for (const row of skipped) lines.push(`- \`${row.path}\` — not indexed: ${indexSafeReason(row.reason)}`);
  }
  if (help.length > 0 || hasCollections) {
    lines.push("", "### Help", "");
    if (hasCollections) lines.push(`- [\`${HELP_COLLECTIONS_PATH}\`](${HELP_COLLECTIONS_PATH}) — collections`);
    for (const path of help) lines.push(`- [\`${path}\`](${path})`);
  }
  if (replies.length > 0) {
    lines.push("", "### Support replies", "");
    for (const path of replies) lines.push(`- [\`${path}\`](${path})`);
  }
  return `${PREAMBLE}\n${lines.join("\n")}\n`;
}

function writeIndex(root) {
  const dir = join(root, ".gitback");
  const entries = listFiles(dir, dir).map((path) =>
    FAQ_PATH.test(path) ? { path, content: readFileSync(join(dir, path), "utf8") } : { path },
  );
  writeFileSync(join(dir, README_PATH), renderReadmeIndex(entries));
  console.log(`wrote .gitback/README.md (${entries.filter((e) => FAQ_PATH.test(e.path)).length} FAQ entries)`);
}

// --------------------------------------------------------------------- cli

const [command, root = process.cwd()] = process.argv.slice(2);
if (command === "check") {
  process.exit(check(root) ? 0 : 1);
} else if (command === "index") {
  if (!check(root)) process.exit(1);
  writeIndex(root);
} else {
  console.log("usage: gitback-faq.mjs check|index [repo-root]");
  process.exit(2);
}
