---
name: ask-gitback
description: Ask how to get something onto your Gitback Board, or what to run next. A router over the Gitback skills and the Gitback MCP server.
disable-model-invocation: true
---

# Ask Gitback

The person asking is a **Client**: a GitHub account with write access to a repo that has a [Gitback](https://gitback.us) Board. The Board is built live from that repo, so every answer is a change in the repo or a call to Gitback's MCP server, never data typed into Gitback. Your job is to **route**: name the one skill or tool that fits, say why, and offer to run it.

Before you state what a skill does, or tell the Client a step can be skipped, read that skill's `SKILL.md` (paths below, relative to this skill's folder). The summaries here are for orientation only.

Words the Client will see on the Board: a **Module** is one of the Board's sections (Feedback, Roadmap, Changelog, FAQ, Issues); a **Vote** is a 👍 reaction by a real GitHub account; **Visitors** are everyone who is not a Client.

## Routes

| The Client wants | Route |
|---|---|
| Answers on the FAQ, or a refresh after a release | `/gitback-faq` (`../gitback-faq/SKILL.md`) |
| Entries on the changelog | `/gitback-changelog` (`../gitback-changelog/SKILL.md`) |
| Open Issues sorted into roadmap lanes | `/gitback-roadmap` (`../gitback-roadmap/SKILL.md`) |
| To read their Board, or move one item, from their agent | the MCP server (below) |

Each skill ends in a pull request or an approved batch the Client reviews. They work on any repo with `git` and `gh`; none of them needs the MCP server.

## How each Module fills

- **FAQ:** one Markdown file per answer in `.gitback/faq/<slug>.md` on the default branch. A branch shows at `https://gitback.us/b/<owner>/<repo>/faq/preview/<branch>` before merge, under a "Previewing branch" banner.
- **Changelog:** the repo's published GitHub Releases, newest first. A draft never shows; a prerelease does.
- **Roadmap:** open Issues, placed by label: `roadmap: planned`, `roadmap: in progress`, `roadmap: complete`, or the Client's own labels mapped to those lanes under `roadmapLabels:` in `.gitback/config.yml`. An open Issue with no lane label is in the Open lane. A closed Issue leaves the Board.
- **Feedback:** the Discussions in the category the Client mapped to Feedback on their Board's Dashboard (`https://gitback.us/b/<owner>/<repo>/dashboard`).
- Any Module can be hidden from Visitors with `modules: { <module>: false }` in `.gitback/config.yml`; the Client still sees it.

## The flows

A **flow** is a path through the routes.

- **First setup:** `/gitback-faq`, then `/gitback-changelog`, then `/gitback-roadmap`. The FAQ comes first because it fills from the repo with the fewest questions; the roadmap goes last because it asks the Client the most.
- **Weekly upkeep:** `/gitback-roadmap` to move Issues whose state changed. With the MCP server connected, `insights.demand` and `insights.stale` show which feedback to act on first.
- **After a release:** publish the GitHub Release (the changelog fills itself), then `/gitback-roadmap` to move what shipped to Complete, then `/gitback-faq` if the release changed install, config or upgrade steps. With the MCP server, `insights.loop` lists shipped work nobody has told the askers about, and `changelog.markShipped` drafts the comment that tells them.

## The MCP server

One hosted endpoint for every Board: `https://gitback.us/api/mcp` (Streamable HTTP). Every tool takes `repo` as `owner/repo`. The Client's Dashboard shows the endpoint in its "Connect an agent" card. It is served on gitback.us only, never on a Custom Domain. In Claude Code:

```bash
claude mcp add --transport http gitback https://gitback.us/api/mcp
```

Other hosts take the same URL as a remote MCP server. Reads need no sign-in; a tool that writes as the Client makes the host start Gitback's sign-in.

The server answers for Boards of public repos only, and only while the Board is published. A Board of a private repo answers `not-a-board`.

| Tool | Does | Needs |
|---|---|---|
| `board.get` | Whether the repo is a Board, claimed or not, each Module's count and newest item, the Category Mapping, and whether the repo files consent is granted. Call it first. | nothing |
| `feedback.list`, `feedback.get` | Feedback items with Votes; one item with its comments | nothing |
| `roadmap.list` | Issues by lane, with Votes | nothing |
| `changelog.list` | Releases, each with the roadmap items it closed | nothing |
| `faq.search` | FAQ entries matching a query | nothing |
| `issues.get` | One open Issue | nothing |
| `insights.demand`, `insights.stale`, `insights.loop`, `insights.velocity` | Most-wanted feedback; feedback gone quiet; shipped work nobody was told about; weekly counts | a claimed Board |
| `feedback.draft`, `feedback.vote` | Return a link to the Board with the feedback item or Vote prefilled; the human posts it there | nothing |
| `roadmap.setStatus`, `changelog.markShipped` | Return a link that opens a lane move, or a drafted loop-closing comment, for the Client to confirm on the Board | a claimed Board |
| `roadmap.applyStatus`, `changelog.postLoopComment` | Move an Issue's lane; post the loop-closing comment, as the Client | sign-in, the Board's Client, the Board on Pro or above |
| `feedback.submit`, `feedback.castVote` | Post feedback; Vote, as the signed-in account | sign-in |
| `whoami` | The GitHub login the writing tools act as | nothing |

The four tools that write as the signed-in account are called from forms the host draws inline, in hosts that support MCP Apps. Elsewhere, route to the matching link tool: `feedback.draft` for `feedback.submit`, `feedback.vote` for `feedback.castVote`, `roadmap.setStatus` for `roadmap.applyStatus`, `changelog.markShipped` for `changelog.postLoopComment`. A plan error carries the Board's pricing URL; give it to the Client.

To sort many Issues at once, route to `/gitback-roadmap`, not the MCP server: it proposes every lane from evidence and applies one approved batch with an undo.

## My Module is empty on the Board

Call `board.get` first if the MCP server is connected: it shows which Modules Visitors see and the consent state. Then match the symptom.

| Symptom | Cause | Fix |
|---|---|---|
| FAQ empty | No `.gitback/faq/*.md` on the default branch | `/gitback-faq` |
| FAQ empty, files merged | The Client declined Gitback's repository files when claiming | Allow them from the Dashboard's consent prompt |
| FAQ entry missing | The file fails Gitback's format | Run the checker in `/gitback-faq` and fix each `error` |
| FAQ merged, Board unchanged | The Board caches the FAQ for up to an hour | Wait; check the preview link meanwhile |
| Changelog empty | No Releases, or only drafts | `/gitback-changelog`; publish the draft |
| Changelog misses a new Release | Cached for up to an hour | Wait |
| Roadmap all in Open | No Issue carries a lane label | `/gitback-roadmap` |
| Roadmap missing an Issue | It is closed, or carries the Support label | Reopen it, or remove the Support label |
| Roadmap ignores the Client's labels | `roadmapLabels:` names a label the repo lacks, or sits off the default branch | Fix `.gitback/config.yml` on the default branch; `/gitback-roadmap` reports `MISSING` labels |
| Feedback empty, Discussions full | Feedback is mapped to a different category | Pick the category on the Dashboard |
| Feedback lists open Issues | Discussions are off in the repo, or no category is mapped | Turn Discussions on in the repo settings, then map a category on the Dashboard |
| A Module missing for Visitors only | `modules: <module>: false` in `.gitback/config.yml`, or the Board is unpublished | Remove the line, or publish the Board from its Sections settings |
| MCP answers `not-a-board` | The repo is private, the Board is unpublished, or `repo` is misspelled | Use the Board in the browser; check `owner/repo` |
| Insights answer `unclaimed` | Nobody has claimed the Board | Claim it on the Board |
