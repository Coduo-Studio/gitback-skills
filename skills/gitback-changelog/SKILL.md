---
name: gitback-changelog
description: Get this repository publishing GitHub Releases so its Gitback Board's changelog has entries — grouped release notes for a repo that has never kept a changelog, or one publish step for a repo whose changelog lives in CHANGELOG.md, a docs site or a hosted tool. Opened as a pull request the Client reviews. Use when a Gitback Board's changelog is empty, or the Client asks to "set up the changelog", "start release notes" or "publish our CHANGELOG as Releases".
---

# gitback-changelog

A [Gitback](https://gitback.us) Board's changelog is the Source Repo's GitHub Releases, read live:

- **Published Releases only.** A draft never shows. A prerelease shows like any other Release.
- **Newest first, by publish date**, the most recent 30.
- **The whole body, as written.** Gitback asks for no format, so the notes keep whatever shape the Client gives them.
- **Up to an hour late.** The Board caches the list for an hour.

Gitback never writes a Release. The Client publishes every one, and this skill sets their repo up to do that. The readers of the Releases are the product's End Users.

You are working for the Client, a person with write access to the repo. Three rules hold on every path:

- **Forward only.** Releases start with the next version. Past versions stay in tags or changelog files; you never create a Release for one.
- **Their release config is theirs.** An existing `.github/release.yml` (or `.yaml`), `.github/release-drafter.yml` or any release-tool config stays byte-for-byte as it is.
- **Every change lands as a pull request**, and you ask before you commit and before you push.

## 1. Take stock

1. Confirm the working tree is clean. Run `gh repo view --json nameWithOwner,defaultBranchRef,visibility` for the canonical `owner/repo`, the default branch and whether the repo is private. Without `gh`, ask the Client.
2. Read `.gitback/config.yml` if it exists. `changelog: false` under `modules:` hides the changelog from Visitors; note it for the hand-off.

3. On a private repo, the Board reads Releases through the Gitback GitHub App. If the Board's changelog says it cannot read the repo, the App is not installed on it; say so in the hand-off.

**Done when** you hold `owner/repo`, the default branch and the changelog's on/off state.

## 2. Find the case, with evidence

Run every check and keep each result. It is the evidence you show the Client.

```bash
gh release list --limit 20 --json tagName,isDraft,isPrerelease,publishedAt
git fetch --tags --quiet && git tag --sort=-creatordate | head -20
git ls-files | grep -iE '(^|/)(changelog|history|news|releases?|release-notes)[^/]*$'
ls .github/workflows/ 2>/dev/null && grep -lE 'tags:|gh release|action-gh-release|create-release|release-please|semantic-release|goreleaser|changesets' .github/workflows/*
gh repo view --json homepageUrl
```

Then read:

- **Release config:** `.github/release.yml`, `.github/release.yaml`, `.github/release-drafter.yml`, `.changeset/`, `release-please-config.json`, `.goreleaser.y*ml`, `.releaserc*`, `release.config.*`, `cliff.toml`, `.versionrc*`.
- **Release scripts:** `release`, `version` and `publish` scripts in `package.json`; `release` targets in `Makefile`; `scripts/release*`; the workflows the grep listed.
- **A changelog elsewhere:** links in `README*`, the docs and the homepage to a changelog page, Headway, Beamer, Canny, LaunchNotes and the like.

Then pick the first case that fits:

| Case | Evidence | Go to |
|---|---|---|
| **Publishing** | At least one Release that is not a draft | Stop. Tell the Client the Board already shows their Releases, at `https://gitback.us/b/<owner>/<repo>/changelog`, and mention the changelog's on/off state if it is off. Then name the gaps, newer than the latest published Release: drafts (publishing one puts it on the Board) and tags with no Release (forward only: mention them, never fill them). Change nothing. |
| **Drafts only** | Releases exist, every one a draft | Stop. Tell the Client the Board shows a Release once it is published, and that their process stops at a draft. Leave their tooling alone. |
| **B: changelog elsewhere** | A changelog file, a changelog page in the repo's docs, or a link to a hosted changelog | Step 3B |
| **A: no changelog** | None of the above | Step 3A |

Tags with no Releases are normal; they are evidence of how the Client releases, not entries to fill.

**Done when** every check has a result and you have told the Client the case and the evidence that decided it.

## 3A. No changelog: grouped release notes

1. `git switch -c gitback/changelog`. If it exists, add a date: `gitback/changelog-2026-10-08`.
2. If `.github/release.yml` or `.github/release.yaml` exists, the grouping is already set up. Change nothing; the hand-off tells the Client how to publish with it.
3. Otherwise follow [`references/release-yml.md`](references/release-yml.md).

**Done when** that reference's last **Done when** holds, or a release config already existed.

## 3B. Changelog elsewhere: ask first

Ask the Client, naming where their changelog lives:

> Your changelog is in `<place>`. The Gitback Board's changelog reads GitHub Releases only. Should each new version also publish its changelog section as a GitHub Release? Your changelog stays where it is.

On a no, stop: nothing changes, and the Board's changelog stays empty until a Release is published.

On a yes, `git switch -c gitback/changelog` (dated if taken), then follow [`references/publish-step.md`](references/publish-step.md).

**Done when** the Client has said no, or that reference's last **Done when** holds.

## 4. Hand it to the Client

1. Show the Client the diff, the case and its evidence.
2. Ask before you commit, and again before you push.
3. If you changed no files, skip to item 5. Otherwise commit in one commit, for example `ci(release): publish GitHub Releases for the Gitback changelog`, or `docs(release): group generated release notes by label` for case A.
4. Push and open a pull request into the default branch with `gh pr create`. The body states the case with its evidence, what each changed file does, and the reference's **What to tell the Client** points.
5. Give the Client the Board link: `https://gitback.us/b/<owner>/<repo>/changelog`. It fills once the first Release is published, within the hour. If the Board is unpublished, the Client must be signed in to Gitback to open it.

**Done when** the Client has the pull request link and the Board link, or has declined the commit or the push.
