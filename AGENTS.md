---
description: Use Bun instead of Node.js, npm, pnpm, or vite.
globs: "*.ts, *.tsx, *.html, *.css, *.js, *.jsx, package.json"
alwaysApply: false
---

# AGENTS.md

See [`CLAUDE.md`](./CLAUDE.md) for all project guidance — commands, architecture,
provider notes, and verification steps. It is the single source of truth for this
repo; this file just points there so non-Claude agents land in the same place.

Key reminder (also in CLAUDE.md): use **Bun** for all dev tasks, but the published
artifact runs on plain **Node 18+** — avoid Bun-only runtime APIs in `index.ts` or
`src/**`.
