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

`scripts/build.ts` externalizes the native deps `sharp`, `@resvg/resvg-js`, `satori`, `@fal-ai/client`, and `replicate` — if you add a new native dependency, update the build script.

Runtime auth: `picture-it auth --fal <key>` and `picture-it auth --replicate <key>` (stored via `src/config.ts`). `FAL_KEY` / `REPLICATE_API_TOKEN` env vars also work.

Active provider: `--provider fal|replicate` global flag > `PICTURE_IT_PROVIDER` env var > `default_provider` config > `fal`.

Published package targets Node 18+; local development requires Bun.

## Architecture

Entry point `index.ts` is a single Commander program that wires every subcommand. Each command handler is thin — it parses options, calls into `src/` modules, and prints the output path to stdout (logs go to stderr via `log()` in `src/operations.ts`).

Core modules in `src/`:

- **`types.ts`** — all shared types: `ModelId`, `ProviderName`, overlay types (`ImageOverlay`, `SatoriTextOverlay`, etc.), `PipelineStep`, `BatchEntry`, `PictureItConfig`.
- **`providers/types.ts`** — `ImageProvider` interface (`generate`, `edit`, `removeBg`, `upscale`, `prepareImageInput`, capability checks).
- **`providers/fal.ts`**, **`providers/replicate.ts`** — provider implementations. **`providers/index.ts`** exports `getProvider()` and `configureProvider()`. FAL uploads images and passes URLs; Replicate pins model versions (`owner/name:versionHash`) and `prepareImageInput()` returns a base64 data URI. When touching inference code, read `docs/add-replicate-provider.md` and `docs/replicate-model-mapping.md`.
- **`model-router.ts`** — per-provider endpoint tables (`GENERATE_ENDPOINTS`, `EDIT_ENDPOINTS`, `BG_REMOVAL_ENDPOINTS`, `UPSCALE_ENDPOINTS`, `MODEL_COSTS` keyed by `(provider, logicalModel)`) and `selectGenerateModel`/`selectEditModel` helpers that pick the cheapest capable model. Model names stay logical/provider-agnostic (e.g. `--model seedream`); the router resolves `(provider, logicalModel) → endpoint`. If the active provider can't serve a requested model, fail with an error listing alternatives — never silently substitute.
- **`operations.ts`** — shared helpers: `parseSize` (resolves `--size` / `--platform` via `presets.ts`), `readInput`, `writeOutput`, `ensureProviderKey`, `log`.
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

## Providers

Only `fal` and `replicate` are valid provider names. Invalid values from CLI, env, config, pipeline steps, or batch entries must **fail fast** with a clear stderr message — never silently fall back.

Pipeline/batch provider behavior: the command-level provider sets the initial provider for inference steps; an individual pipeline step or batch entry may override it with `"provider": "fal"|"replicate"`. Once a pipeline step switches provider, later inference steps keep using it until another step overrides.

Provider implementation notes (mostly hard-won Replicate gotchas):

- **FAL** uploads images via `fal.storage.upload()` and passes storage URLs. **Replicate** passes data URIs (`data:image/png;base64,...`) and uses `replicate.run()` with `wait: { mode: "block" }`. `prepareImageInput(buffer, filename)` abstracts this split — pipeline steps call it instead of uploading directly.
- **Model gaps**: `pixelcut` (bg removal) and `imagineart` (generate) are FAL-only; Replicate `remove-bg` rejects `pixelcut` with an error suggesting `bria`/`rembg`.
- **Replicate edit inputs**: Kontext uses `input_image`; Seedream and Nano Banana use `image_input`. Don't use FAL-style `image_url`/`image_urls` or generic `image`/`images` unless the specific Replicate schema requires it.
- **Replicate upscale**: Recraft creative upscale accepts `image` only — the CLI may accept `--scale` for compatibility, but the provider must not forward `scale`.
- **Replicate Seedream generate**: use `size: "custom"` with `width`/`height` only when both are within the supported custom range; otherwise use provider presets (`1K`/`2K`/`4K`) plus `aspect_ratio`.
- **Costs**: `MODEL_COSTS[provider][model]` in `model-router.ts`. Replicate prices are approximate — some models bill by hardware-second, so actual cost is only known post-run.

## Verification

No automated test suite yet. When changing inference, auth, routing, or pipeline behavior:

- `bun run build` must succeed.
- Smoke invalid-provider handling: `--provider nope`, `PICTURE_IT_PROVIDER=nope`, bad pipeline-step provider, bad batch-entry provider.
- Smoke `generate`, `edit`, `remove-bg`, `upscale`, `pipeline` against both FAL and Replicate.
- Smoke a non-AI path: `template` or `text`.

## Bun conventions

Default to Bun over Node for dev tasks:

- `bun <file>` instead of `node`/`ts-node`; `bun test` instead of jest/vitest; `bunx` instead of `npx`.
- Prefer `Bun.file`, `Bun.$`, `Bun.serve`, `bun:sqlite`, `Bun.redis`, `Bun.sql`, built-in `WebSocket` over their node/npm equivalents.
- Bun auto-loads `.env` — don't add `dotenv`.
- The shipped binary runs on plain Node (the build step rewrites the shebang), so avoid Bun-only APIs in code paths that run at CLI runtime.
