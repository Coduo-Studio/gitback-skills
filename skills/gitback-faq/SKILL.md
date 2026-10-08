---
name: gitback-faq
description: Draft a Gitback FAQ for this repository from its own code, docs, issues and discussions — one answer per file in `.gitback/faq/`, grouped by tags, opened as a pull request the maintainer reviews. Use when a Gitback Board's FAQ is empty or thin, when the maintainer asks to "fill the FAQ", "set up the FAQ", "write FAQs for this repo" or "seed Gitback", or to refresh an existing `.gitback/faq/` after a release.
---

# gitback-faq

You are writing the FAQ that a [Gitback](https://gitback.us) Board shows for this repository. Gitback reads every `.gitback/faq/<slug>.md` file on the default branch and lists it on the Board's FAQ, one group per tag. Nothing else is needed: no account, no API call. The maintainer reviews your work as a pull request, so every answer lands under their name — write only what the repository can back up.

The readers are the product's End Users — people installing, configuring and using it — not contributors to the repository. Leave build-from-source and dev-environment setup out unless the product is itself a developer tool.

The file format is in [`references/faq-format.md`](references/faq-format.md). Read it before writing the first file.

## 1. Take stock

1. Confirm the working tree is clean. Run `gh repo view --json nameWithOwner,defaultBranchRef,visibility` for the canonical `owner/repo`, the default branch and whether the repo is private. Without `gh`, ask the maintainer.
2. Create a branch: `git switch -c gitback/faq`. If it exists, add a date: `gitback/faq-2026-10-08`.
3. Read every file already in `.gitback/faq/`. Those are the maintainer's: keep them, never rewrite or renumber them, and never write a second answer to a question they already answer.

**Done when** you are on the new branch and hold the list of questions already answered.

## 2. Collect questions, with evidence

A good FAQ answers what newcomers actually ask. Collect candidates in this order, strongest evidence first:

1. **Asked questions.** If `gh` is signed in, read Discussions (Q&A or Questions category first; the command is below) and Issues labelled `question`, `support` or `help wanted`, plus closed issues whose fix was a config change or a docs pointer. A question asked twice is a certain entry. Record its Discussion URL — it becomes `source`.
2. **Documented answers.** README, `docs/`, a docs or marketing site in the repo, any FAQ that already exists outside `.gitback/`, `CHANGELOG`/Releases (breaking changes and migrations are classic FAQs), example folders. Docs drift: check each answer against the code before you reuse it.
3. **Code that users touch.** Install and build steps, config files and their options, environment variables, CLI flags, public API entry points, supported platforms and versions, error messages users would search for, limits and defaults.

Discussions are GraphQL-only; this lists the latest 50 with their category and whether an answer was accepted:

```bash
gh api graphql -F owner=OWNER -F name=REPO -f query='query($owner:String!,$name:String!){repository(owner:$owner,name:$name){discussions(first:50,orderBy:{field:UPDATED_AT,direction:DESC}){nodes{number title url category{name} isAnswered comments{totalCount}}}}}'
```

For each candidate, write down the question in the asker's words and the file or URL that answers it. A candidate with no answer in the repository is an **open question**: keep it for the pull request body, do not write a file for it. Guessing an answer here would publish a guess under the maintainer's name.

Aim for the 8–20 questions a newcomer hits in their first week. A short FAQ with real answers beats a long one padded with questions nobody asks.

**Done when** every candidate has either a cited answer or a place on the open-questions list.

## 3. Group them

Pick 3–7 tags that a reader would scan for — `getting-started`, `configuration`, `troubleshooting`, `deployment`, `billing`. Lowercase kebab-case. Reuse tags the existing files already use. Give each entry one tag, two at most. Set `order` so the first questions a newcomer asks come first; leave gaps (10, 20, 30) so the maintainer can slot answers in later.

## 4. Write the files

One file per question, following [`references/faq-format.md`](references/faq-format.md). Answers:

- Lead with the answer in the first sentence; detail after.
- Copy commands, config keys and option names exactly from the repository.
- Link to the page that holds the full story with a full https URL. On a public repo that can be `https://github.com/<owner>/<repo>/blob/<default-branch>/<path>`. On a private repo, Board visitors cannot open GitHub links: link the product's public docs instead, or nothing.
- Make each answer stand alone. The Board shows answers in search results and under every tag they carry, so "see above" points nowhere.
- Write in the project's voice — read its README first.

Then run the checker and the index from the repository root:

```bash
node <this-skill>/scripts/gitback-faq.mjs index
```

It checks every FAQ file against the format Gitback parses and rewrites `.gitback/README.md` exactly as Gitback's own writer would. Fix every `error` line and run it again. A file it rejects is a file the Board will not show.

**Done when** the script prints `0 error(s)` and has written `.gitback/README.md`.

## 5. Hand it to the maintainer

1. Show the maintainer the list: each question, its tag, and its source. Then show the open questions.
2. Ask before you commit and push.
3. Commit everything under `.gitback/` in one commit: `docs(faq): add <n> answers for the Gitback FAQ`.
4. Push and open a pull request into the default branch with `gh pr create`. The body lists each question with the file or URL its answer came from, then the open questions as a checklist for the maintainer to answer by hand. If nobody had asked questions on GitHub yet, say the answers come from the docs and code.

5. Give the maintainer two links, built from the canonical `owner/repo` and the branch you pushed:
   - **Preview now:** `https://gitback.us/b/<owner>/<repo>/faq/preview/<branch>` shows the Board's FAQ as it will look, read from the branch, under a "Previewing branch" banner. Nothing is published.
   - **Live after merge:** `https://gitback.us/b/<owner>/<repo>/faq`.

   On a private repo the maintainer must be signed in to Gitback to open either link.

Once merged, the answers appear on the Board's FAQ. If they do not, the maintainer declined Gitback's repository files when they claimed the Board; the FAQ reads `.gitback/faq/` only while those are allowed.

**Done when** the maintainer has the pull request link and both Board links.
