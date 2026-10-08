---
name: gitback-roadmap
description: Sort a repository's open Issues into its Gitback roadmap lanes (Open, Planned, In progress, Complete) by proposing a lane per Issue from evidence, interviewing the maintainer, and applying the approved labels in one batch with an undo command. Use when a Gitback Board's roadmap is all Open or out of date, or when the maintainer asks to "set up", "fill", "triage" or "update" the roadmap.
---

# gitback-roadmap

You are sorting the roadmap that a [Gitback](https://gitback.us) Board shows for this repository. The Board reads the lane of each open Issue from its labels, so a label is the whole write: no account, no API call to Gitback. You **propose**; the maintainer (the Client) decides. Nothing leaves Open without the Client's approval, and an Issue you cannot place with evidence stays Open.

Labels go live on GitHub the moment they are applied and there is no preview. The approval in step 4 is the only safety check, so it shows exactly what will change and how to undo it.

How the Board decides a lane, and who sees what, is in [`references/board-rules.md`](references/board-rules.md). Read it before step 1.

The script is `<this-skill>/scripts/gitback-roadmap.mjs` (Node 18+ and `gh`, no install). It reads the repository the way the Board does, so use its output rather than re-deriving lanes yourself.

## 1. Take stock

1. Run `gh repo view --json nameWithOwner` for the canonical `owner/repo`. Without `gh`, or signed out, ask the Client to run `gh auth login` first.
2. Run `node <this-skill>/scripts/gitback-roadmap.mjs open <owner/repo>`. The header gives the visibility, the signed-in account's permission, the label each lane uses (canonical, or the Client's mapping from `.gitback/config.yml`) and the Support label. Below it: which signal ranks the table (thumbs-up, or last activity when every count is 0), whether any open PR is by a non-maintainer, and the count per hint. The table lists every Issue in Open, ranked, with its thumbs-up count, last real activity, assignees, milestone, same-repo PRs, recent commits naming it, and a `hint`.
3. If the permission is not `WRITE`, `MAINTAIN` or `ADMIN`, stop: tell the Client the labels must be applied by an account with write access, and offer to continue under it.
4. If a lane is mapped to a label marked `MISSING`, tell the Client and stop until they create it or fix `.gitback/config.yml`.

**Done when** you hold the repo, its visibility, the lane-to-label table, and the Open list.

## 2. Gather the evidence

Facts are your job; never ask the Client for one. The script has already read the PRs and commits in one batch, so take these from its table:

- **`prs`**: `#n merged closes` is a PR that closes the Issue, by GitHub's link or a closing keyword (`Closes #n`, `Fixes #n`, `Resolves #n`) in its title or body; `outside` marks a non-maintainer's PR. `open mention` and `+n mentions` are PRs that only name the Issue, usually because the Issue was filed from that PR's review: a mention is a lead to read, never evidence on its own.
- **`commits/14d`**: commits pushed in the last 14 days whose headline names `#n`. It is read from GitHub, so a shallow or missing clone changes nothing.
- **`active`**: the last comment, PR reference or commit. Label, milestone and assignee edits are triage, not activity, and an assignee alone is no evidence.

Then read what the table cannot show, newest first, for the Issues you draft: the maintainers' own comments ("we'll do this", "not planned", "fixed in 2.1", "kept open for verification"), the body of an `open mention` PR when the Issue names it as where the work happens, milestone due dates (`gh api repos/<owner>/<repo>/milestones`), and the latest release notes.

Turn the evidence into a draft lane:

| Draft lane  | Evidence                                                                                 |
| ----------- | ---------------------------------------------------------------------------------------- |
| Complete    | a merged PR closes it (`merged closes`), or a maintainer says the fix shipped, yet the Issue is still open |
| In progress | an open maintainer PR closes it, a commit named it in the last 14 days, or the Issue names an open PR as where its work happens |
| Planned     | in an upcoming milestone, or a maintainer committed to it in a comment                   |
| Open        | everything else, including high thumbs-up counts with no maintainer signal: that is a question |

On a repo with more than ~60 Issues in Open, draft only those with a hint other than `-`, a maintainer comment, or a place in the table's top 10 (the header names the ranking signal; say which one in step 4). The rest stay Open without discussion; report their count.

**Private repo only:** mark each drafted Issue that is internal work rather than product: secret or key rotation, legal or compliance sign-off, billing or vendor operations, launch checklists, agent and CI tooling, or a body that names where a credential lives. On a Board of a private repo the Open lane is Client-only and a lane label publishes the Issue's title and body ([`references/board-rules.md`](references/board-rules.md)), so an internal Issue stays Open whatever its evidence says. On a public repo every Issue is already public on GitHub; skip this.

**Done when** every drafted Issue has a lane and a one-line reason naming its evidence, every internal Issue on a private repo is marked to stay Open, and every other Issue is counted as staying Open.

## 3. Interview the Client

Settle the decisions the evidence cannot make, the way [grilling](https://github.com/mattpocock/skills/blob/main/skills/productivity/grilling/SKILL.md) does: a decision tree worked in **rounds**. The **frontier** is every decision whose prerequisites are settled. Ask the whole frontier at once, as numbered questions, each with a recommended answer drawn from the evidence and worded so "yes" accepts it. A question that depends on another question still open belongs to the next round. The maintainer is busy: aim for two rounds of three to five questions.

A question earns its place only when the evidence raises it; each rule below names its trigger. Skip a rule whose trigger is absent, and say in one line which ones you skipped and why ("no outside PRs are open, so no contributor question").

1. **Rules first** (round 1):
   - What Planned means here, when any drafted Issue is `planned?`. Recommend whatever the milestones show (the next milestone, the next release, the one with the nearest due date).
   - Whether an outside contributor's open PR puts an Issue In progress, when the header's `outside PRs` names one. Recommend no unless a maintainer is reviewing it.
   - Whether a still-open Issue with a merged fix goes to Complete, when any draft is Complete. Recommend yes, and say closing it would take it off the Board.
   - Whether an Issue whose code shipped but which is kept open for verification or acceptance goes to Complete, when a maintainer comment says so. Recommend yes.
   - On a private repo with internal Issues marked in step 2: confirm they stay Open, listed by number, and that every labelled Issue may be shown to Visitors once the Board is published. Recommend yes to both.
2. **Contested Issues** (round 2, from the rules). The drafts the rules leave unclear, and the high thumbs-up Issues with no signal, as one list per proposed lane: "Q4. Put #374, #280 and #264 in Planned?" Ask which, if any, will never be done: those stay Open, and closing them is the Client's call, on GitHub.

Format each question:

```
**Q1. <title>**: <the question, with the evidence in one line>
Recommended: <answer>
```

Recompute the frontier after each answer. Each answer the Client gives is a decision; record it beside the Issue it moves.

**Done when** the frontier is empty and the Client confirms the rules and the contested Issues.

## 4. Propose, and get approval

1. Write the plan outside the repository, at `${TMPDIR:-/tmp}/gitback-roadmap-<owner>-<repo>.json`:

   ```json
   { "repo": "owner/repo", "items": [{ "number": 156, "lane": "complete", "reason": "PR #138 merged" }] }
   ```

   `lane` is `planned`, `in-progress` or `complete`; `open` strips every lane label from an Issue the Client moves back.

2. Run `node <this-skill>/scripts/gitback-roadmap.mjs apply <plan> --dry-run`. It prints each change, the Issues it skipped and why, the labels it would create, the exact `gh` commands, and the undo commands.
3. Show the Client:
   - a table of `#`, title, proposed lane, reason, one row per changed Issue
   - how many Issues stay Open, the internal ones by number, and the signal that ranked them (thumbs-up, or last activity)
   - the labels that will be created (only the canonical ones a mapping does not cover)
   - the private-repo or hidden-Roadmap note, if the dry run printed one
   - the undo commands, so they know before they approve that the batch can be reversed
4. Ask for one of: **all**, **some** (by number), or **edited** (a different lane for some). For some or edited, change the plan, run the dry run again and show the new table. Approval covers the table the Client saw, not an earlier one.

**Done when** the Client has approved the exact dry-run output that will be applied.

## 5. Apply, and hand over

1. Run `node <this-skill>/scripts/gitback-roadmap.mjs apply <plan>`. It creates the missing labels, then applies the whole plan in one `gh issue edit` per lane, under the signed-in account. If it stops part-way, it prints the undo for what it applied; give the Client that, and the error.
2. Give the Client:
   - what changed: the count per lane, and how many stayed Open
   - the undo commands the script printed, verbatim, in a code block
   - the Board link: `https://gitback.us/b/<owner>/<repo>/roadmap`. The Board caches its roadmap for a few minutes, so a change can take that long to show. On a Board of a private repo the Client must be signed in to Gitback, and Visitors see the lanes only once the Board is published.
   - the Issues the Client said will never be done, if any, as a reminder that closing them is theirs to do

**Done when** the script printed `APPLIED` and the Client has the undo commands and the Board link.
