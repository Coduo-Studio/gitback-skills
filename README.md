# Gitback skills

Agent skills and an MCP server for maintainers who run a [Gitback](https://gitback.us) Board. Each skill fills one part of the Board from your own repository and hands you a pull request to review. Nothing lands on your default branch without you.

| Skill | What it does |
|---|---|
| `gitback-faq` | Drafts FAQ answers from your code, docs, Issues and Discussions into `.gitback/faq/`, opens a PR, and gives you a preview link of the FAQ before you merge. |
| `gitback-changelog` | Sets up GitHub Releases for a repo that has no changelog, or one whose changelog lives in `CHANGELOG.md` or a docs site. Forward only: it never backfills old versions. |
| `gitback-roadmap` | Interviews you briefly, reads your Issues for evidence, proposes Planned, In progress and Complete, and applies the labels only after you approve. Prints an undo command. |
| `ask-gitback` | Points you to the right skill or MCP tool for what you want on your Board. Run it by name. |

The plugin also connects your agent to Gitback's MCP server at `https://gitback.us/api/mcp`, for reading your Board (feedback, roadmap, changelog, FAQ) and for Client actions.

## Install

**Claude Code**

```bash
claude plugin marketplace add sahildave/gitback-skills
claude plugin install gitback@gitback
```

**Codex**

```bash
codex plugin marketplace add sahildave/gitback-skills
codex plugin add gitback@gitback
```

**Cursor, GitHub Copilot, and other agents** ([Agent Skills](https://agentskills.io))

```bash
npx skills add sahildave/gitback-skills
```

The repository is also an [Agent Plugins](https://agent-plugins.org) 1.0.0 package (`plugin.json`, `skills/`, `mcp.json`) for any client that supports the format.

## Start here

In your repository, ask your agent to run `ask-gitback`, or go straight to "fill the Gitback FAQ for this repo".

## What gets written

Only files Gitback reads, as plain markdown and YAML that keep working without Gitback: `.gitback/faq/*.md` and `.gitback/README.md` for the FAQ, `.github/release.yml` or a release step for the changelog, and `roadmap: …` labels for the roadmap.

## License

MIT
