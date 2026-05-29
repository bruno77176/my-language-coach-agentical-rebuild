# Architecture diagrams

Source-controlled architecture diagrams for My Language Coach. Each diagram has a
matching source file (`*.mmd`, `*.py`) and a rendered SVG. Source is the truth —
when something changes, update the source and re-render.

| # | View | Source | Rendered |
|---|------|--------|----------|
| 1 | C4 Context (app + actors + external systems) | [c4-context.mmd](c4-context.mmd) | [rendered/c4-context.svg](rendered/c4-context.svg) |
| 2 | C4 Container (runtime pieces + hosting regions) | [c4-container.mmd](c4-container.mmd) | [rendered/c4-container.svg](rendered/c4-container.svg) |
| 3 | Sequence — Google Sign-In on iOS | [sequence-auth.mmd](sequence-auth.mmd) | [rendered/sequence-auth.svg](rendered/sequence-auth.svg) |
| 4 | Sequence — voice conversation turn (with latencies) | [sequence-voice.mmd](sequence-voice.mmd) | [rendered/sequence-voice.svg](rendered/sequence-voice.svg) |
| 5 | Database ERD (Supabase Postgres) | [erd.mmd](erd.mmd) | [rendered/erd.svg](rendered/erd.svg) |
| 6 | Geographic deployment (with cloud icons) | [deployment.py](deployment.py) | [rendered/deployment.svg](rendered/deployment.svg) |

## Rendering

These diagrams are rendered locally by the
[`architecture-diagrams` skill](https://github.com/anthropics/...) that lives in
`~/.claude/skills/architecture-diagrams/`. Render commands:

```sh
# Single file
bash ~/.claude/skills/architecture-diagrams/scripts/render.sh docs/architecture/c4-context.mmd

# Everything in docs/architecture/
bash ~/.claude/skills/architecture-diagrams/scripts/render.sh --all docs/architecture
```

Output lands in `docs/architecture/rendered/*.svg`. Commit both source AND rendered
SVG so reviewers don't need any tooling installed.

### Required tools

| Format | Tool | Install |
|--------|------|---------|
| `.mmd` (Mermaid) | `mmdc` | `npm install -g @mermaid-js/mermaid-cli` |
| `.py` (Diagrams.py) | Python `diagrams` + Graphviz | `pip install diagrams` + `winget install Graphviz.Graphviz` (Win) / `brew install graphviz` (mac) |
| `.dsl` (Structurizr) | `structurizr-cli` | `brew install structurizr-cli` |
| `.puml` (PlantUML) | `plantuml` | `brew install plantuml` |
| `.dbml` (DBML) | `dbml-renderer` | `npm install -g @softwaretechnik/dbml-renderer` |

## Editing

1. Edit the source `.mmd` / `.py` file.
2. Re-run the render script.
3. Commit source AND rendered output in the same PR.
4. If you add a new diagram, add a row to the table above.

Mermaid sources can also be edited live at [mermaid.live](https://mermaid.live) — paste,
edit, copy back.

## Conventions (apply to every new diagram)

The `architecture-diagrams` skill enforces these. Common ones:

- **Title + last-updated date + one-line scope** at the top of every file.
- **Consistent vocabulary**: pick one name per component (e.g. always "Fly backend",
  never "API server" sometimes and "API" elsewhere).
- **External systems are visually distinct** (gray or dashed border).
- **Edge labels are verbs or protocols**: "calls (HTTPS/JSON)", "publishes to",
  not unlabeled arrows.
- **Crow's foot cardinality on ERDs** (`||--o{`, `||--|{`, `}o--o{`).
- **One level of abstraction per diagram**: a container diagram doesn't show
  individual functions; a context diagram doesn't show subnets.
- **Direction discipline**: pick `LR` or `TB` per diagram and stick with it;
  sequence diagrams always read top-to-bottom.

See `~/.claude/skills/architecture-diagrams/SKILL.md` for the full checklist.

## When to update

- A new external system is integrated (e.g. Stripe lands) → update Context + Container.
- An auth flow changes → update `sequence-auth.mmd`.
- A new table or relationship lands in the DB → update `erd.mmd`.
- A region migration (e.g. Fly arn → fra) → update `c4-container.mmd` and `deployment.py`.
- A new latency-sensitive call is added to the voice loop → update `sequence-voice.mmd`.

If you edit code that changes the architecture but forget to update the diagrams,
they go stale fast. Add a check to your PR template if this becomes a pattern.
