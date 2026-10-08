# Case B: publish the newest changelog section as a Release

The repo keeps its changelog somewhere other than GitHub Releases, and the Client said yes to also publishing Releases from now on. You add one step to the release process they already run. Their changelog stays where it is and is written the way it is today; the Release body is a copy of its newest section.

## 1. Prove the extractor reads their changelog

`scripts/changelog-section.sh` in this skill prints one release's section of a markdown changelog, without its heading. Its header comment lists the heading shapes it recognises. Run it against the Client's file, once for the newest section and once for the version before it:

```bash
sh <this-skill>/scripts/changelog-section.sh CHANGELOG.md
sh <this-skill>/scripts/changelog-section.sh CHANGELOG.md <previous-version>
```

Compare each output with the file by eye. If either is wrong or the script exits 1, the format is outside what it reads; tell the Client and use the fallback below.

When the changelog lives outside the repo (a hosted tool, a docs site in another repo) there is no file to read: use the fallback.

**Fallback:** set the repo up as in [`release-yml.md`](release-yml.md), so each Release gets GitHub's generated notes beside the Client's own changelog.

**Done when** the Client has seen the script's output for the newest section and agreed it matches, or you have switched to the fallback.

## 2. Copy the script in

Copy `scripts/changelog-section.sh` to `.github/scripts/changelog-section.sh` in the Client's repo, unchanged. It needs only `sh` and `awk`, which every GitHub runner and every Mac has.

## 3. Add the step where they release today

Find the moment a version gets its tag, from the evidence you gathered: a workflow, a script, a Makefile target, or a person running `git tag`. Add the Release there, after the tag exists. `--verify-tag` makes `gh` stop rather than create a tag of its own. Pass the version as their changelog headings write it: for a tag such as `@acme/widget@2.1.0`, that is `${TAG##*@}`.

### A workflow that runs on a tag push

Add a separate job to that workflow, after their publishing job. A separate job leaves their job's `permissions` alone: adding a `permissions:` block to an existing job turns off every permission it does not list.

```yaml
  github-release:
    needs: [<their-publish-job>]
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
      - name: Publish the changelog section as a GitHub Release
        env:
          GH_TOKEN: ${{ github.token }}
          TAG: ${{ github.ref_name }}
        run: |
          sh .github/scripts/changelog-section.sh CHANGELOG.md "$TAG" > "$RUNNER_TEMP/notes.md"
          pre=""
          case "$TAG" in *-*) pre="--prerelease" ;; esac
          gh release create "$TAG" --verify-tag --title "$TAG" --notes-file "$RUNNER_TEMP/notes.md" $pre
```

Match `actions/checkout`'s version to the one their workflows already use.

### A release script or Makefile target run by hand

Append to the end of it, after the line that pushes the tag, with the variable that already holds the tag:

```sh
notes=$(mktemp) && sh .github/scripts/changelog-section.sh CHANGELOG.md "$TAG" > "$notes" && gh release create "$TAG" --verify-tag --title "$TAG" --notes-file "$notes"
```

In `package.json`, chain it onto their `release` script with `&&`; npm sets `$npm_package_version`, so the tag is usually `v$npm_package_version`. The person releasing needs `gh` signed in; say so in the pull request body.

### No release process on file

If tags are pushed by hand, add `.github/workflows/github-release.yml`, triggered by their tag pattern (read it off `git tag`, e.g. `v*`), holding the job above without `needs:`. If the repo has no tags at all, the same workflow gives the Client a release moment: `git tag v1.5.0 && git push origin v1.5.0`. Tell them that is now how a Release starts.

**Done when** the step sits after the tag is created, runs `changelog-section.sh` with the tag's version, and publishes with `--verify-tag`.

## What to tell the Client

- Releases start with the next version they tag. Earlier versions stay in their changelog only.
- A version whose changelog section is missing or empty fails the step instead of publishing an empty Release. Write the section before tagging.
- A tag with a hyphen (`v2.0.0-beta.1`) publishes as a prerelease, which the Board still lists.
