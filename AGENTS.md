---
description: Use Bun instead of Node.js, npm, pnpm, or vite.
globs: "*.ts, *.tsx, *.html, *.css, *.js, *.jsx, package.json"
alwaysApply: false
---

## Tooling

Use Bun for all dev tasks. The published npm package targets Node 18+ (the build step in `scripts/build.ts` rewrites the shebang from `bun` to `node`).

```bash
bun install              # install deps
bun run download-fonts   # required for text/compose/template commands
bun run dev -- <args>    # run CLI from source (e.g. bun run dev -- generate --prompt "…")
bun run build            # compile TS → dist/index.js with node shebang + native deps as externals
bun test                 # test runner (no tests exist yet)
```

Bun auto-loads `.env` — never add `dotenv`.

Avoid Bun-only runtime APIs in `index.ts` or `src/**` (the published artifact runs on plain Node). `node:fs`, `node:path`, etc. are fine.

## Output contract

- **stdout**: only the output file path (or JSON for `batch`).
- **stderr**: all progress, diagnostics, and warnings — use `log()` from `src/operations.ts`.
- **Exit 0** on success, **Exit 1** on failure.

Preserve subcommand names, flag names, and stdout shape unless the user asks for a breaking change.

## Auth & config

```bash
picture-it auth --fal <key>        # stored in ~/.picture-it/config.json (mode 0600)
picture-it auth --replicate <key>  # same file, separate key
picture-it auth --status           # show key status for both providers
picture-it config list             # dump config
```

`FAL_KEY` and `REPLICATE_API_TOKEN` env vars override the config file. Key source precedence: env var → `~/.picture-it/config.json`.

Fonts are downloaded to `fonts/` (managed by `src/fonts.ts` via `bun run download-fonts`). They are gitignored.

## Provider selection

```bash
picture-it --provider replicate generate --prompt "..."   # global flag before subcommand
picture-it config set default_provider replicate           # persist preference
```

Precedence: CLI `--provider` flag → `PICTURE_IT_PROVIDER` env → `default_provider` config → `fal`.

Only `fal` and `replicate` are valid provider names. Invalid values from CLI, env, config, pipeline steps, or batch entries must fail fast with a clear stderr message; never silently fall back to another provider.

Pipeline provider behavior:

- `picture-it --provider replicate pipeline --spec ...` sets the initial provider for inference steps.
- Individual inference steps may override with `"provider": "fal"` or `"provider": "replicate"`.
- `batch` entries may set `"provider"` to override the command-level provider for that entry.
- Once a pipeline step switches provider, later inference steps keep using that provider until another step overrides it.

## Architecture

Single-entrypoint CLI: `index.ts` is a Commander program with inline command handlers. Each handler is thin — parse options, resolve provider, call `src/` modules, print output path.

| File | Role |
|------|------|
| `src/providers/types.ts` | `ImageProvider` interface (`generate`, `edit`, `removeBg`, `upscale`, `prepareImageInput`) |
| `src/providers/fal.ts` | FAL provider implementation |
| `src/providers/replicate.ts` | Replicate provider implementation |
| `src/providers/index.ts` | Factory: `getProvider(name)`, `configureProvider(name, key)` |
| `src/model-router.ts` | Per-provider endpoint maps, costs, model selection (cheapest-capable) |
| `src/operations.ts` | Shared helpers: `parseSize`, `readInput`, `writeOutput`, `ensureProviderKey`, `log` |
| `src/pipeline.ts` | Executes `pipeline`/`batch` JSON specs (provider-aware, per-step overrides) |
| `src/compositor.ts` | Sharp overlay compositing (`compose` command, advanced `text` JSX mode) |
| `src/satori-jsx.ts` | Converts overlay/JSX specs to PNG via Satori + resvg-js |
| `src/postprocess.ts` | Pure-Sharp filters: `applyColorGrade`, `applyGrain`, `applyVignette` |
| `src/templates/` | Named no-AI layouts (text-hero, vs-comparison, social-card, feature-hero) |
| `src/contrast.ts`, `src/zones.ts` | Text placement helpers (auto-contrast, safe zones) |
| `src/config.ts` | Persistent key/value config in `~/.picture-it/config.json`; `resolveProvider()` |
| `src/presets.ts` | Platform presets (og-image, youtube-thumbnail, etc.) |
| `src/types.ts` | Shared types: `ModelId` (provider-agnostic model names), `ProviderName`, overlays, pipeline steps, config |

Build externals — `scripts/build.ts` externalizes `sharp`, `@resvg/resvg-js`, `satori`, `@fal-ai/client`, and `replicate`. If you add a new native dependency, update the build script.

`skill/picture-it/` is the Claude agent skill — update it alongside behavior changes.

See also `CLAUDE.md` (parallel instruction file for Claude Code).

## Provider implementation notes

- **FAL**: uploads images via `fal.storage.upload()`, passes storage URLs to inference endpoints.
- **Replicate**: passes images as data URIs (`data:image/png;base64,...`). Uses `replicate.run()` with `wait: { mode: "block" }`. No version hashes pinned yet — model slugs resolve to latest version.
- **Image input preparation**: `prepareImageInput(buffer, filename)` abstracts FAL upload vs Replicate data URI. Pipeline steps call this instead of `uploadFile`/`uploadBuffer` directly.
- **Model gaps on Replicate**: `pixelcut` (bg removal) and `imagineart` (generate) are FAL-only. Replicate `remove-bg` rejects `pixelcut` with a clear error suggesting `bria` or `rembg`.
- **Replicate edit inputs**: Kontext uses `input_image`; Seedream and Nano Banana use `image_input`. Do not use FAL-style `image_url`/`image_urls` or generic `image`/`images` fields unless the specific Replicate schema requires them.
- **Replicate upscale**: Recraft creative upscale accepts `image` only. The CLI may accept `--scale` for command compatibility, but the Replicate provider must not send `scale`.
- **Replicate Seedream generate**: use `size: "custom"` with `width`/`height` only when both dimensions are within the supported custom range. Otherwise use provider presets (`1K` for Seedream v4 when applicable, otherwise `2K`/`4K`) plus `aspect_ratio`.
- **Cost tables**: per-provider in `src/model-router.ts` (`MODEL_COSTS[provider][model]`). Replicate prices are approximate — some models bill by hardware-second (actual cost only known post-run).

## Verification

No automated test suite yet. When changing inference, auth, routing, or pipeline behavior:

- `bun run build`
- Smoke invalid provider handling (`--provider nope`, `PICTURE_IT_PROVIDER=nope`, bad pipeline step provider, bad batch entry provider)
- Smoke: `generate`, `edit`, `remove-bg`, `upscale`, `pipeline` (test both FAL and Replicate)
- Smoke a non-AI path: `template` or `text`
