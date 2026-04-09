# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`picture-it` is a CLI tool ("Photoshop for AI agents") that exposes composable image operations. Each subcommand reads an image, performs one operation, and writes an image, so they can be chained via shell, the `pipeline` command (JSON spec), or the `batch` command.

## Commands

```bash
bun install
bun run download-fonts      # required for text/template/compose commands
bun run dev -- <args>       # run CLI from source (e.g. bun run dev -- generate --prompt "…")
bun run build               # scripts/build.ts — compiles TS → dist/, swaps shebang to node
node dist/index.js --version  # smoke-test the built artifact
bun test                    # no tests currently, but this is the runner
```

Runtime auth: `picture-it auth --fal <key>` (stored via `src/config.ts`). `FAL_KEY` env var also works.

Published package targets Node 18+; local development requires Bun.

## Architecture

Entry point `index.ts` is a single Commander program that wires every subcommand. Each command handler is thin — it parses options, calls into `src/` modules, and prints the output path to stdout (logs go to stderr via `log()` in `src/operations.ts`).

Core modules in `src/`:

- **`fal.ts`** — all FAL AI calls (`generate`, `edit`, `removeBg`, `upscale`, uploads). Model IDs and pricing live here.
- **`model-router.ts`** — picks the cheapest model that can handle a given op (see README "Model routing" table). Commands that accept `--model` fall back to this router.
- **`operations.ts`** — shared helpers: `parseSize` (resolves `--size` / `--platform` via `presets.ts`), `readInput`, `writeOutput`, `ensureFalKey`, `log`.
- **`pipeline.ts`** — executes `pipeline`/`batch` JSON specs. Each step's output buffer feeds the next step's input; the `op` field dispatches to the same underlying functions the CLI commands use.
- **`compositor.ts`** — Sharp-based overlay compositor used by `compose` and by `text` (advanced JSX mode). Consumes overlay JSON.
- **`satori-jsx.ts`** — converts overlay/JSX specs to PNG via Satori + resvg-js. Fonts are loaded from the directory managed by `fonts.ts` (populated by `download-fonts`).
- **`postprocess.ts`** — pure-Sharp filters: `applyColorGrade`, `applyGrain`, `applyVignette`.
- **`templates/`** — named, no-AI layouts (`text-hero`, `vs-comparison`, `social-card`, `feature-hero`) built on compositor + Satori.
- **`contrast.ts`**, **`zones.ts`** — text-placement helpers (auto-contrast, safe zones).
- **`config.ts`** — persistent key/value config for API keys and defaults.
- **`presets.ts`** — `PLATFORM_PRESETS` (og-image, youtube-thumbnail, etc.).

Output contract (important for agent use): **stdout is only the output file path** (or JSON for `batch`). All progress/logging must go to stderr. Exit 1 on failure.

`skill/picture-it/` contains the Claude agent skill that documents model choice, multi-pass workflows, and gotchas — update it alongside behavior changes that affect how agents should use the CLI.

## Bun conventions

Default to Bun over Node for dev tasks:

- `bun <file>` instead of `node`/`ts-node`; `bun test` instead of jest/vitest; `bunx` instead of `npx`.
- Prefer `Bun.file`, `Bun.$`, `Bun.serve`, `bun:sqlite`, `Bun.redis`, `Bun.sql`, built-in `WebSocket` over their node/npm equivalents.
- Bun auto-loads `.env` — don't add `dotenv`.
- The shipped binary runs on plain Node (the build step rewrites the shebang), so avoid Bun-only APIs in code paths that run at CLI runtime.
