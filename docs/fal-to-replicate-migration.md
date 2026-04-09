# FAL → Replicate Migration Plan

**Status:** Draft for technical review
**Author:** Planning doc, not yet implemented
**Scope:** Replace `@fal-ai/client` with `replicate` as the sole inference provider.

## Goals

- Swap FAL out for Replicate as the only image inference backend.
- Preserve the current CLI surface — no breaking changes to subcommand names, flags, or stdout contract.
- Keep pipeline reproducibility by pinning Replicate model versions.
- Log actual per-run cost from Replicate metrics where available.

## Non-goals

- Dual-provider support. FAL is removed entirely; no `--provider` flag.
- New features, new models, or changes to post-processing (`sharp`, Satori, compositor).
- Changes to the skill's workflow guidance beyond what model naming/cost forces.

## Current architecture (baseline)

FAL is isolated behind two files:

- `src/fal.ts` — all SDK calls (`generate`, `edit`, `removeBg`, `upscale`, `uploadFile`, `uploadBuffer`, `configureFal`).
- `src/model-router.ts` — endpoint maps (`GENERATE_ENDPOINTS`, `EDIT_ENDPOINTS`), `MODEL_COSTS`, and routing logic (`selectGenerateModel`, `selectEditModel`).

Callers:

- `index.ts` imports everything from `src/fal.ts` and wires it to Commander handlers.
- `src/pipeline.ts` calls `uploadFile`/`uploadBuffer` to turn intermediate buffers into URLs before passing them to `edit()`.
- `src/operations.ts` has `ensureFalKey()`.
- `src/config.ts` stores the key under a FAL-named slot (`auth --fal <key>`).
- `src/types.ts` defines `FalModel`.

No FAL types leak into `compositor.ts`, `postprocess.ts`, `satori-jsx.ts`, `templates/`, `fonts.ts`, `presets.ts`, `zones.ts`, or `contrast.ts`. Those files stay untouched.

## Design decisions (agreed with product)

1. **Clean swap, no abstraction layer.** Rename `src/fal.ts` → `src/replicate.ts` in place. No `ImageProvider` interface. If we ever want a second provider later, we can extract one then — YAGNI for now.
2. **Pin model versions.** Endpoint maps store `owner/name:versionHash` strings. Each pinned version gets a `// pinned YYYY-MM-DD` comment. Bumping a version is a deliberate PR.
3. **No uploads.** Drop `uploadFile`/`uploadBuffer`. Pass buffers to Replicate as data URIs (`data:image/png;base64,...`). Replicate's image models accept these on every model we use.
4. **Static cost table for routing, dynamic cost for reporting.** Routing decisions need a number *before* the call, so `MODEL_COSTS` stays as a hand-maintained hint. After each run, read `prediction.metrics.predict_time` × hardware rate (or a flat `price` when the model exposes one) and log the actual cost to stderr.
5. **Rename the model type.** `FalModel` → `ModelId` in `src/types.ts`. Cascade through all imports.
6. **Auth.** Replace `auth --fal <key>` with `auth --replicate <key>`. Env var `REPLICATE_API_TOKEN` continues to work (native to the Replicate SDK). No backward-compat for FAL keys — removal is clean.

## Open questions (blockers for implementation)

These must be resolved before step 3 (the rewrite). Step 1 of the execution plan produces answers.

1. **Model coverage gaps.** Not every FAL model is known to exist on Replicate. Suspected gaps:
   - `imagineart` — likely FAL-only
   - `fibo` / `fibo-edit` (Bria-hosted) — likely FAL-only
   - `reve` / `reve-fast` — unclear
   - `pixelcut` background removal — likely FAL-only
   - `nano-banana-2` / `nano-banana-pro` — Google Gemini image models, probably on Replicate under a different slug

   For each gap the team decides: **substitute** (pick a near-equivalent on Replicate), **drop** (remove from the router and update the skill), or **block the migration** (unacceptable gap).

2. **Version pinning cadence.** Who owns bumps, and how often do we revisit? Suggest: quarterly review, or ad-hoc when someone reports degraded output.

3. **Cost reporting for long-running models.** Some Replicate models bill per second of hardware time. We won't know the cost until after the prediction completes. Is it acceptable that the stderr cost line appears *after* the image download, not before? (Current FAL log prints the *estimated* cost before the call.)

## Execution plan

### Phase 1 — Inventory (no code)

Produce `docs/replicate-model-mapping.md` containing, for every model in `GENERATE_ENDPOINTS`, `EDIT_ENDPOINTS`, `BG_REMOVAL_ENDPOINTS`, and the creative upscaler:

- Current FAL slug
- Replicate slug + pinned version hash (or "NOT AVAILABLE")
- Input schema diff (FAL param names → Replicate param names)
- Pricing model (flat per-run vs hardware-time)
- Notes / gotchas

Deliverable: a table the team can review to answer Open Question #1.

### Phase 2 — Gap resolution

For each "NOT AVAILABLE" row, the team picks substitute / drop / block. Update the mapping doc with decisions. This phase is a meeting, not code.

### Phase 3 — Core rewrite

1. `bun remove @fal-ai/client && bun add replicate`
2. Rename `src/fal.ts` → `src/replicate.ts`. Rewrite:
   - `configureFal` → `configureReplicate` (constructs the client from the stored token).
   - `generate()` — same signature, per-model input builders rewritten for Replicate schemas.
   - `edit()` — same signature; accept `Buffer[]` instead of `string[]` for inputs (see Phase 4).
   - `removeBg()` — new slug map, same return shape.
   - `upscale()` — new slug, same return shape.
   - Delete `uploadFile`, `uploadBuffer`, the `BG_REMOVAL_ENDPOINTS` FAL paths.
   - Replace `downloadResult` with a helper that normalizes Replicate's output (URL string, array of URLs, or `ReadableStream` depending on the model) into a `Buffer`.
3. Rewrite `src/model-router.ts`:
   - `FalModel` → `ModelId` (re-exported from `src/types.ts`).
   - `GENERATE_ENDPOINTS` / `EDIT_ENDPOINTS` hold `owner/name:version` strings.
   - `MODEL_COSTS` numbers updated to Replicate pricing (one-time hand update).
   - Routing logic (`selectGenerateModel`, `selectEditModel`) unchanged structurally — only the default model identifiers may change if our Phase 2 decisions alter the cheapest option per input count.
4. `src/types.ts` — rename `FalModel` → `ModelId`, update re-exports.
5. `src/operations.ts` — `ensureFalKey` → `ensureReplicateKey`.
6. `src/config.ts` — rename the key slot; update the `auth` command wiring in `index.ts`.
7. `index.ts` — update all imports, rename the `auth --fal` flag to `auth --replicate`, bump the command description if it mentions FAL.

### Phase 4 — Pipeline + uploads refactor

1. `src/pipeline.ts` currently calls `uploadFile`/`uploadBuffer` to convert intermediate buffers to URLs before the next `edit` step. Replace with a buffer → data URI helper (`bufferToDataUri(buf: Buffer): string`) co-located in `src/replicate.ts`.
2. The `edit` command in `index.ts` reads file paths into buffers via `readInput()` already — that path stays; remove the upload hop.
3. Any `-i` input that is itself an HTTP URL (if supported today — verify in `operations.ts`) continues to pass through unchanged; Replicate accepts URLs directly.

### Phase 5 — Cost reporting

1. Switch from `replicate.run()` (fire-and-forget) to `replicate.predictions.create()` + polling. This exposes `prediction.metrics` on completion.
2. After each prediction resolves, compute actual cost:
   - If the model has a flat per-run price in our static table, log that.
   - If Replicate returns `predict_time` and we know the hardware tier, log `predict_time * hardwareRate`.
3. Emit the cost line to stderr via `log()` — same format as today, but labeled "actual" vs current "estimated".
4. The pre-call estimate log (currently `FAL generate: <model> @ $<cost>`) stays so agents see a cost hint before the call.

### Phase 6 — Docs & skill

1. `README.md`:
   - "Install" — swap FAL setup for Replicate.
   - "Setup" — `picture-it auth --replicate <token>`.
   - "Model routing" table — new model names + prices.
   - "Dependencies" section — replace `@fal-ai/client` with `replicate`.
2. `skill/picture-it/`:
   - Model selection guidance updated to Replicate names.
   - Cost table synced with the new `MODEL_COSTS`.
   - Any FAL-specific gotchas (e.g. "FAL renders text as part of the scene") rewritten if the substitute model behaves differently.
3. `CLAUDE.md` — update the `fal.ts` bullet under Architecture to `replicate.ts`.

### Phase 7 — Manual smoke tests

No automated test suite exists. The reviewer runs each command against a small fixture and eyeballs the output:

- `generate` — default model + each `--model` override
- `edit` — 1 input, multi-input (2–3), >10 inputs (router switches tiers)
- `remove-bg` — each model in the bg removal map
- `upscale`
- `pipeline` — a 3-step spec (generate → edit → grade)
- `batch` — two entries
- `template text-hero` — confirms non-AI path is unaffected

Pass criteria: each command exits 0, writes a valid PNG, and stdout is exactly the output path.

## Risk register

| Risk | Impact | Mitigation |
| --- | --- | --- |
| A required model has no Replicate equivalent | Blocks migration or forces feature loss | Phase 1 inventory surfaces this before any code is written |
| Replicate output quality differs from FAL for the same nominal model | Samples in README look worse; skill guidance becomes wrong | Regenerate the README samples post-migration; update skill if techniques change |
| Version pinning drift — pinned version gets deprecated by Replicate | Breakage at runtime | Cost of a version bump PR is low; add a scheduled quarterly review |
| Data URI size limits | Large multi-image edits fail | If hit, fall back to Replicate's file upload API (not the FAL storage API) for that call path only |
| Cost reporting is post-hoc for hardware-billed models | Users can't see estimated cost upfront | Keep static `MODEL_COSTS` as the pre-call estimate; log actual cost after |

## Out-of-scope follow-ups

Things the team may want but are explicitly not part of this migration:

- A provider abstraction (only worth it if a third provider appears).
- Automated tests — the project has none today; adding them is a separate initiative.
- Regenerating all README sample images — depends on whether quality differs.
- Dynamic cost-based routing (picking the cheapest model at call-time using Replicate's pricing API).
