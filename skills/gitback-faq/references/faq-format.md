# The Gitback FAQ file

One question per file at `.gitback/faq/<slug>.md`, directly in that folder.

```markdown
---
question: How do I enable dark mode?
order: 10
tags: [appearance]
updated: 2026-10-08
source: https://github.com/owner/repo/discussions/123
---

Open **Settings → Appearance** and pick **Dark**. The choice is saved per browser.

See [the theming guide](https://github.com/owner/repo/blob/main/docs/theming.md) for custom themes.
```

## Filename

The filename is the slug, and the slug is the entry's identity: lowercase letters and digits joined by single hyphens, then `.md`. `enable-dark-mode.md`, `import-from-canny.md`. There is no `slug` field. Renaming a file is a new entry.

## Frontmatter

Flat `key: value` lines between two `---` fences, nothing nested. Exactly these keys and no others — an unknown key makes Gitback skip the file in the index:

| Key | Required | Value |
|---|---|---|
| `question` | yes | The question as an asker would type it, ending in `?` |
| `order` | no | An integer. Lower comes first; entries without one go last |
| `tags` | no | An inline list: `[configuration]` or `[configuration, deployment]`. The Board shows one group per tag |
| `updated` | no | `YYYY-MM-DD`, the day you wrote the answer |
| `draft` | no | `true` or `false`, nothing else. A draft is listed in `.gitback/README.md` with the suffix ` — draft`. Any other value makes Gitback skip the file in the index |
| `source` | no | The https URL of the GitHub Discussion the question came from. Set it only when there is one. It records where the question was asked; the Board does not show it yet. Cite Issues in the answer body instead |

Write values bare. Quote a value only when it contains a `:` followed by a space or starts with `[`, `{`, `"` or `'`.

## Body

Plain markdown after the closing fence, with a blank line between. No required structure. Use full https links: the Board shows the answer on its own site, where a relative link has nothing to resolve against. On a public repo, link files as `https://github.com/<owner>/<repo>/blob/<default-branch>/<path>`. On a private repo those links are a 404 for Board visitors, so link public docs instead.
