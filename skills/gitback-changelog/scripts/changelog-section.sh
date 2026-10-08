#!/bin/sh
# Prints one release's section of a changelog file, without its heading, ready
# for `gh release create <tag> --notes-file -`.
#
#   sh changelog-section.sh CHANGELOG.md            the newest released section
#   sh changelog-section.sh CHANGELOG.md v1.4.0     the section for 1.4.0 (a leading v is ignored)
#
# A release heading is any markdown heading whose text starts with a version or
# a date, after an optional "[", "v", "Version " or "Release ":
#   ## [1.4.0] - 2026-10-01     ## 1.4.0     # v1.4.0     ## [1.4.0](https://...) (2026-10-01)
#   ### Version 1.4             ## 2026-10-01
# "## [Unreleased]" is not one, so it is skipped. The section ends at the next
# release heading at any depth, or at a heading shallower than its own (so a
# patch heading such as "### [1.0.1]" keeps its own "### Bug Fixes"). Headings inside
# fenced code blocks are ignored. Link definitions ("[1.4.0]: https://...")
# are dropped.
#
# Exit 1, with a message on stderr, when the file is missing, no section
# matches, or the section is empty. POSIX sh and awk only: runs on every GitHub
# runner and on macOS.

set -eu

file=${1:-}
want=${2:-}
if [ -z "$file" ] || [ ! -f "$file" ]; then
  echo "changelog-section: no changelog file at '${file}'" >&2
  exit 1
fi
want=${want#v}
want=${want#V}

awk -v want="$want" -v file="$file" '
function level(line,   n) { n = 0; while (substr(line, n + 1, 1) == "#") n++; return n }
function text(line) { sub(/^#+[ \t]+/, "", line); return line }
function is_release(t) {
  sub(/^\[/, "", t)
  sub(/^([vV]|[Vv]ersion[ \t]+|[Rr]elease[ \t]+)/, "", t)
  return t ~ /^[0-9]/
}
# true when the heading text holds `want` as a whole version token
function names(t,   i, before, after) {
  i = index(t, want)
  while (i > 0) {
    before = (i == 1) ? "" : substr(t, i - 1, 1)
    after = substr(t, i + length(want), 1)
    if (before !~ /[0-9.]/ && after !~ /[0-9.]/) return 1
    t = substr(t, i + 1); i = index(t, want)
  }
  return 0
}
BEGIN { inside = 0; fence = 0; found = 0; done = 0 }
done { next }
/^[ \t]*(```|~~~)/ { fence = !fence; if (inside) body[++n] = $0; next }
!fence && /^#+[ \t]/ {
  lv = level($0); t = text($0)
  if (inside && (lv < top || is_release(t))) { done = 1; next }
  if (!inside && lv <= 6 && is_release(t) && (want == "" || names(t))) {
    inside = 1; found = 1; top = lv; next
  }
}
inside && !fence && /^\[[^]]+\]:[ \t]+[^ \t]/ { next }
inside { body[++n] = $0 }
END {
  if (!found) {
    if (want == "") print "changelog-section: no release heading in " file > "/dev/stderr"
    else print "changelog-section: no heading for " want " in " file > "/dev/stderr"
    exit 1
  }
  first = 1; while (first <= n && body[first] ~ /^[ \t]*$/) first++
  last = n; while (last >= first && body[last] ~ /^[ \t]*$/) last--
  if (first > last) { print "changelog-section: the section is empty in " file > "/dev/stderr"; exit 1 }
  for (i = first; i <= last; i++) print body[i]
}
' "$file"
