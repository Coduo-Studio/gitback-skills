# How a Gitback Board reads the roadmap

Ported from Gitback's own roadmap code. `scripts/gitback-roadmap.mjs` implements every rule here; this file is for explaining them to the Client.

## What is on the roadmap

- **Open Issues only.** Closed Issues, pull requests and Discussions never appear, whatever their labels. Closing an Issue takes it off the Board; there is no "closed means Complete".
- **The labels are the lane.** No other state exists: not milestones, assignees, Projects columns or Issue types.

| Lane        | An open Issue is in it when it carries               |
| ----------- | ---------------------------------------------------- |
| Open        | none of the lane labels below                        |
| Planned     | `roadmap: planned`, or the Client's mapped label     |
| In progress | `roadmap: in progress`, or the Client's mapped label |
| Complete    | `roadmap: complete`, or the Client's mapped label    |

- **Two lane labels on one Issue:** the earlier lane in the table wins, so Planned beats In progress beats Complete. A move has to remove the old lane label, which the script does.
- **Support threads are hidden.** An Issue carrying the Support label (`support.label` in `.gitback/config.yml`, default `support`) is on no lane.

## The Client's own labels

`.gitback/config.yml` on the default branch can map a lane to a label the repository already uses. Keys are lane ids; values are label names:

```yaml
roadmapLabels:
  planned: enhancement
  in-progress: "status: doing"
  complete: shipped
```

A mapped label puts an Issue in that lane, and the canonical label keeps working beside it. When a lane is mapped, apply the Client's label for it, never `roadmap: …`, and never create a label for it: a mapped label that does not exist is the Client's to fix. Lanes left unmapped use the canonical label, created on first use.

## Who sees it

- **Public repo:** the Board shows every lane, Open included, to everyone. The Issues are public on GitHub already.
- **Private repo:** a lane label is how an Issue becomes visible to non-Clients. Once the Board is published, everyone who can see it sees a Planned, In progress or Complete Issue's title, body and votes (not its comments). The Open lane, the linked-Issue chips and every Issue in Open are Client-only, so leaving an internal Issue in Open keeps it from Visitors, published or not.
- `modules.roadmap: false` in `.gitback/config.yml` hides the whole Roadmap from Visitors; labels still apply and the Client still sees the lanes.

## When the Board shows it

Labels are live on GitHub the moment they are applied. The Board caches its roadmap read for a few minutes, so a reload may lag; it needs no action from Gitback.
