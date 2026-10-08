# Case A: grouped release notes from labels

The repo has never kept a changelog. GitHub's **Generate release notes** button, on the new-Release form, lists the pull requests merged since the previous tag. A `.github/release.yml` groups that list under headings by pull-request label. You write that file; the Client still writes, edits and publishes every Release.

## 1. Check the repo works through pull requests

```bash
gh pr list --state merged --limit 50 --json number,title,labels,mergedAt
```

Generated notes are built from merged pull requests only. If the repo merged none in the last 90 days (work is pushed straight to the default branch), the button produces little more than a compare link. Tell the Client that, and ask whether to add the file anyway: it pays off once work goes through pull requests. On a no, the Client writes each Release's notes by hand in the form, and you go straight to the hand-off with no file changed.

**Done when** you know whether the repo merges pull requests, and the Client has answered if it does not.

## 2. Map labels to categories

```bash
gh label list --limit 200 --json name,description
```

Count how often each label appears on the merged pull requests from step 1: a label nobody applies groups nothing. Match the repo's own labels to these categories, case-insensitively, including prefixed forms (`type: bug`, `kind/bug`, `t-bug`). Write the label names exactly as the repo spells them.

| Category title | Labels that usually mean it |
|---|---|
| Breaking changes | `breaking`, `breaking-change`, `semver-major`, `major` |
| New | `enhancement`, `feature`, `feat`, `new feature` |
| Improved | `improvement`, `performance`, `perf`, `ux`, `polish` |
| Fixed | `bug`, `fix`, `bugfix`, `regression` |
| Other changes | `"*"`: the catch-all, always last |

The readers are the product's End Users, so the titles say what changed for them. Keep the Client's own words if their labels or README already use some ("Added", "Fixes").

Put labels for work End Users never see under `changelog.exclude.labels`, only those that exist: `dependencies` (Dependabot applies it), `chore`, `ci`, `refactor`, `test`, `internal`, `skip-changelog`, `no-changelog`, `ignore-for-release`.

Every category except the catch-all needs at least one label. For a category with no existing label, propose one to the Client (name, colour, description) and create it only on a yes, since `gh label create` changes GitHub at once rather than through the pull request:

```bash
gh label create "breaking-change" --color B60205 --description "Changes something End Users rely on"
```

On a no, leave that category out; its pull requests fall into **Other changes**.

**Done when** every category in the file names at least one label that exists on the repo, and every label you created had the Client's yes.

## 3. Write the file

```yaml
# .github/release.yml
# Groups the notes that "Generate release notes" writes on a new GitHub Release.
changelog:
  exclude:
    labels:
      - dependencies
  categories:
    - title: Breaking changes
      labels:
        - breaking-change
    - title: New
      labels:
        - enhancement
    - title: Fixed
      labels:
        - bug
    - title: Other changes
      labels:
        - "*"
```

Parse it with whatever YAML parser the machine has, for example `ruby -ryaml -e 'YAML.load_file(".github/release.yml")'`, and fix any error.

**Done when** `.github/release.yml` parses and uses only labels from step 2.

## What to tell the Client

Put this in the pull request body, in your own words:

- How to publish the next Release: **Releases → Draft a new release**, choose or create the tag, set **Previous tag** to the last release point, click **Generate release notes**, edit the text for End Users, then **Publish release**. Or from a terminal: `gh release create <tag> --generate-notes`.
- The first Release has no earlier Release to count from, so without a **Previous tag** it lists every pull request ever merged. Pick the tag the notes should start after, or trim the list.
- Labels decide the groups, so label pull requests before merging them.
