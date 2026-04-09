# Add Replicate as a Second Provider

**Status:** Draft for technical review
**Author:** Planning doc, not yet implemented
**Scope:** Add Replicate support alongside the existing FAL backend. Users pick the provider per-command, via env var, or via saved config. FAL remains the default.

## Goals

- Add Replicate as a fully-supported inference backend.
- Zero behavior change for existing users: FAL stays default, existing commands, flags, and outputs unchanged.
- Clean, reviewable diff suitable for an upstream PR.
- Preserve CLI reproducibility by pinning Replicate model versions.

## Non-goals

- Removing FAL. Both providers stay.
- Changes to post-processing (`sharp`, Satori, compositor, templates, fonts, presets).
- New models, new commands, or new flags beyond `--provider` and `auth --replicate`.
- Automated tests (the project has none today; adding them is a separate initiative).

## Design decisions

1. **Introduce a provider abstraction.** With two backends it's worth the seam. New file `src/providers/types.ts` defines an `ImageProvider` interface. FAL code moves to `src/providers/fal.ts`, Replicate code lives in `src/providers/replicate.ts`, and `src/fal.ts` either re-exports from `providers/fal.ts` for backward-compat or is deleted and its callers updated. Recommendation: delete `src/fal.ts` and update the ~3 import sites — cleaner for review.
2. **Provider selection precedence** (highest wins):
   1. `--provider <fal|replicate>` CLI flag on any command that does inference
   2. `PICTURE_IT_PROVIDER` environment variable
   3. Saved config value (`picture-it config set provider replicate`)
   4. Default: `fal`
3. **Auth is additive.** `auth --fal <key>` still works. New `auth --replicate <key>` added. `FAL_KEY` and `REPLICATE_API_TOKEN` env vars both honored. The active provider determines which key is required; the other can be absent.
4. **Model names are logical, not provider-specific.** The user types `--model seedream` regardless of provider. Internally, the router resolves `(provider, logicalModel)` → endpoint. The existing `FalModel` type is renamed to `ModelId` to reflect that it's provider-agnostic.
5. **Pin Replicate versions.** Endpoint strings are `owner/name:versionHash`, each with a `// pinned YYYY-MM-DD` comment. FAL endpoints remain slugs (FAL doesn't expose version pinning the same way).
6. **No uploads on Replicate.** Pass image buffers to Replicate as data URIs (`data:image/png;base64,...`). FAL keeps using `fal.storage.upload` — no change to its code path.
7. **Cost reporting.** Static cost table per `(provider, model)` for pre-call estimates and routing decisions. Post-call actual cost logged to stderr when Replicate returns `prediction.metrics`. FAL's current cost log is unchanged.
8. **Fallback policy for model coverage gaps.** If a user asks for a model that the active provider doesn't support (e.g. `--model imagineart --provider replicate` and imagineart isn't on Replicate), the CLI fails with a clear error listing available alternatives on that provider. It does **not** silently substitute.

## Provider interface (proposed)

```ts
// src/providers/types.ts
export interface ImageProvider {
  name: "fal" | "replicate";

  generate(opts: GenerateOpts): Promise<Buffer>;
  edit(opts: EditOpts): Promise<Buffer>;
  removeBg(opts: RemoveBgOpts): Promise<Buffer>;
  upscale(opts: UpscaleOpts): Promise<Buffer>;

  // FAL uploads to its own storage; Replicate returns a data URI.
  // Both implementations accept a Buffer and return a string that can
  // be passed back as an image input on the same provider.
  prepareImageInput(buffer: Buffer, filename: string): Promise<string>;

  canGenerate(model: ModelId): boolean;
  canEdit(model: ModelId): boolean;
  listSupportedModels(): ModelId[];
}
```

`EditOpts.inputUrls: string[]` stays — the strings are provider-specific (FAL storage URL or data URI), and each provider interprets them correctly because you pass them back to the same provider that produced them via `prepareImageInput`.

## Open questions (blockers for implementation)

1. **Model coverage on Replicate.** Which logical models in `model-router.ts` actually exist on Replicate? Phase 1 (inventory) answers this. Known-suspected gaps: `imagineart`, `fibo`, `fibo-edit`, `reve`, `reve-fast`, `pixelcut`. The mapping doc (`replicate-model-mapping.md`) tracks decisions per gap.

2. **Routing defaults per provider.** `selectEditModel` currently picks `kontext` for single-image edits, `seedream` for multi-image, `banana2` for >10 inputs. If the active provider doesn't support one of those, what's the fallback? Options:
   - **Per-provider default tables.** Each provider defines its own cheapest-model-per-tier. Cleanest but duplicates logic.
   - **Single logical table + coverage check.** One default table; if the chosen model isn't supported by the active provider, walk the cost-sorted list until a supported one is found.

   Recommendation: single table + walk. Simpler diff.

3. **Do we need `--provider` on every command or a global flag?** Commander supports both. Global flag (before the subcommand) is less noisy: `picture-it --provider replicate edit -i foo.png ...`. Per-command flag is more explicit and discoverable in `--help`. Recommendation: **global**, since the provider choice rarely changes mid-pipeline.

4. **Pipeline/batch specs — can a spec pin its provider?** A `pipeline.json` might want `"provider": "replicate"` at the top level so the spec is reproducible independent of the caller's config. Recommendation: yes, add an optional top-level `provider` field; fall back to the CLI/env/config chain if absent.

5. **Cost estimation timing for Replicate.** Some Replicate models bill per hardware-second, so the true cost is only known post-run. Acceptable to log "estimated" before and "actual" after? (FAL logs only estimated today.)

## Execution plan

### Phase 1 — Inventory (no code)

Fill in `docs/replicate-model-mapping.md`. For each model in the FAL router: find the Replicate slug + version, diff the input schema, record pricing. Flag gaps.

Deliverable: a reviewed mapping table the team signs off on before Phase 3.

### Phase 2 — Gap resolution

Team decides per gap: **add Replicate support with a substitute**, **mark the model as FAL-only** (router rejects it when provider=replicate), or **block the PR** (unacceptable gap). Update the mapping doc with decisions.

### Phase 3 — Provider abstraction (refactor, FAL-only first)

Goal: extract the interface without introducing Replicate yet. This keeps the diff small and means the refactor can be reviewed independently.

1. Create `src/providers/types.ts` with the `ImageProvider` interface and shared option types (`GenerateOpts`, `EditOpts`, etc.).
2. Move `src/fal.ts` → `src/providers/fal.ts`. Wrap the existing functions in a `FalProvider` class/object implementing `ImageProvider`. Rename `uploadFile`/`uploadBuffer` → `prepareImageInput` on the interface; keep the old function names as internal helpers.
3. Create `src/providers/index.ts` exporting a `getProvider(name): ImageProvider` factory. For now it only returns `FalProvider`.
4. Update `index.ts` and `src/pipeline.ts` to call `getProvider(providerName).generate(...)` etc. instead of importing from `src/fal.ts` directly.
5. Rename `FalModel` → `ModelId` in `src/types.ts` and cascade imports.
6. `src/model-router.ts` — endpoint maps remain FAL-only for now but add a `provider` parameter to the accessor functions so the signature is ready for Phase 4.

**Acceptance criteria for Phase 3:** all existing commands work exactly as before, no behavior change, no new dependencies. The PR author can stop here and ship an interim PR if the team prefers two smaller reviews.

### Phase 4 — Replicate provider

1. `bun add replicate`
2. Create `src/providers/replicate.ts` implementing `ImageProvider`:
   - `generate()` — per-model input builders mirroring the Replicate schemas from Phase 1.
   - `edit()` — accepts data URI strings; constructs model-specific input.
   - `removeBg()` — Replicate bg removal slugs.
   - `upscale()` — Replicate upscaler.
   - `prepareImageInput()` — returns a data URI.
   - Uses `predictions.create()` + polling (not `run()`) so we can read `prediction.metrics.predict_time` for cost logging.
3. Extend `src/model-router.ts`:
   - Endpoint maps become `Record<ProviderName, Partial<Record<ModelId, string>>>`.
   - `getGenerateEndpoint(provider, model)` / `getEditEndpoint(provider, model)`.
   - `canGenerate(provider, model)` / `canEdit(provider, model)`.
   - `selectGenerateModel(provider, explicit?)` — same logic, but falls through the cost-sorted list skipping models the provider doesn't support.
   - `selectEditModel(provider, inputCount, explicit?)` — same treatment.
   - `MODEL_COSTS` stays a single table (cost is a property of the model, not the provider, and the differences are small enough that one table is fine).
4. `src/providers/index.ts` — `getProvider("replicate")` returns the new provider.
5. Register `replicate` with the factory.

### Phase 5 — CLI wiring

1. Add a global `--provider <name>` option on the Commander root program.
2. Add `auth --replicate <key>` flag alongside `auth --fal <key>`.
3. New helper `resolveProvider(cliFlag?: string): ProviderName` that implements the precedence chain (CLI → env → config → default).
4. `src/operations.ts` — `ensureFalKey()` becomes `ensureProviderKey(provider)` which dispatches to the right key lookup. Old name kept as a thin alias for backward-compat during the refactor; removed before the PR goes out.
5. `src/config.ts` — add `replicateKey` and `defaultProvider` slots.
6. All inference commands (`generate`, `edit`, `remove-bg`, `upscale`, `pipeline`, `batch`) resolve the provider at the top of their handler and pass it into the provider factory.
7. `pipeline.ts` / `batch.ts` — honor an optional `provider` field at the top of the spec; falls back to the resolved CLI provider if absent.

### Phase 6 — Pipeline + uploads

No refactor needed for FAL. For Replicate, the pipeline's intermediate-buffer step calls `provider.prepareImageInput(buf, name)` which returns a data URI on Replicate and an uploaded URL on FAL. The call site is provider-agnostic.

### Phase 7 — Cost reporting

1. Pre-call log (both providers): `<provider> <op>: <model> @ $<estimated>` — matches current FAL format with provider prefix.
2. Post-call log (Replicate only, when metrics available): `replicate <op>: actual $<computed>`.
3. If the team wants parity, FAL also gains a post-call log in a follow-up PR (out of scope here).

### Phase 8 — Docs & skill

1. `README.md`:
   - Setup section — document both `auth --fal` and `auth --replicate`.
   - New "Providers" subsection explaining the selection precedence and when to pick which.
   - Model routing table — note which models are available on each provider.
   - Dependencies — add `replicate`.
2. `skill/picture-it/`:
   - New section: "Choosing a provider". Guidance: default FAL for legacy compat, Replicate if the user has a Replicate account / prefers pinning / has credits there.
   - Model selection guidance annotated with provider availability where it differs.
3. `CLAUDE.md` — update the architecture section to mention `src/providers/` and note that FAL and Replicate are both supported, default FAL.

### Phase 9 — Manual smoke tests

Run each command twice — once with default (FAL) provider, once with `--provider replicate`:

- `generate` — default model + each supported `--model` override per provider
- `edit` — 1 input, multi-input, >10 inputs (verify router picks the right model per provider)
- `remove-bg` — each model in each provider's bg removal map
- `upscale`
- `pipeline` — 3-step spec, run once per provider, then once with explicit `"provider"` in the spec
- `batch` — two entries
- `template text-hero` — confirms non-AI path is unaffected by the refactor

Also test:
- `auth --fal <bad>` + `--provider fal` → clean error
- `auth --replicate <bad>` + `--provider replicate` → clean error
- `--model imagineart --provider replicate` → clean error listing Replicate-supported alternatives (assuming imagineart is FAL-only per Phase 2)
- Unset both keys, run a command → clean error naming the expected env var or config command

## PR strategy (for the upstream review)

Two options for how to land this:

**Option A: Single PR with everything.**
- Pros: reviewer sees the full picture, one round of review.
- Cons: big diff (~800-1200 lines est.), harder to bisect if something breaks.

**Option B: Two PRs.**
1. PR #1 — Phase 3 only (provider abstraction, FAL still only implementation). Pure refactor, no behavior change, small diff.
2. PR #2 — Phases 4–8 (add Replicate). Builds on PR #1's abstraction.
- Pros: PR #1 is trivially reviewable and can land fast. PR #2 is scoped to the new provider.
- Cons: two review cycles, coordination with maintainer.

**Recommendation:** Option B. Ask the maintainer upfront which they prefer — this is a judgment call that depends on their review bandwidth and preference.

## Risk register

| Risk | Impact | Mitigation |
| --- | --- | --- |
| A required model has no Replicate equivalent | Feature gap when using Replicate | Phase 1 inventory surfaces this; user-facing behavior is a clean error, not a silent failure |
| Replicate output quality differs from FAL for the same nominal model | Skill guidance becomes model-specific | Document per-provider quirks in the skill |
| Version pinning drift — pinned Replicate version gets deprecated | Breakage on Replicate only | Quarterly review of pinned versions; FAL unaffected |
| Provider abstraction leaks FAL-specific assumptions | Replicate implementation has to work around the interface | Phase 3 is pure refactor — if the interface feels wrong when writing Replicate, revise the interface before merging Phase 3 |
| Data URI size limits on Replicate | Large multi-image edits fail | If hit, add Replicate's native file upload API as a fallback inside `prepareImageInput` |
| Cost reporting is post-hoc for hardware-billed Replicate models | Users can't see actual cost upfront | Pre-call estimate from static table; actual cost logged after |
| Maintainer prefers a different design | PR rejected or heavily revised | Share this doc with the maintainer *before* writing code; get design sign-off first |

## Out-of-scope follow-ups

- Automated tests.
- Regenerating README sample images under Replicate.
- Dynamic cost-based routing (picking cheapest at call-time via Replicate's pricing API).
- FAL post-call actual-cost logging (parity with Replicate).
- A third provider (the abstraction supports it, but no one is asking).
