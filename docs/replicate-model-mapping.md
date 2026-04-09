# Replicate Model Mapping

**Status:** Coverage survey complete (2026-04-09). Version hashes, input schemas, and pricing still TODO.
**Purpose:** Source-of-truth mapping from every current FAL model/endpoint to its Replicate equivalent. Drives decisions about which logical models the Replicate provider will support, and which stay FAL-only.

## Key

- **Official** — listed under the vendor's own namespace on Replicate (e.g. `black-forest-labs/...`, `bytedance/...`, `bria/...`). Stable, vendor-backed, safe to pin.
- **Community** — uploaded by a third party (e.g. `men1scus/birefnet`, `cjwbw/rembg`). Usable but not vendor-blessed; higher risk of deprecation.
- **Missing** — no clear Replicate equivalent.

## Generate endpoints

Source: `GENERATE_ENDPOINTS` in `src/model-router.ts`.

| Logical model | FAL endpoint | Replicate slug | Status | Pinned version | Input diff | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| flux-schnell | `fal-ai/flux/schnell` | `black-forest-labs/flux-schnell` | Official | TODO | TODO | Direct match |
| flux-dev | `fal-ai/flux/dev` | `black-forest-labs/flux-dev` | Official | TODO | TODO | Direct match |
| imagineart | `fal-ai/imagineart/imagineart-1.5-preview/text-to-image` | `imagineart/imagineart-1.0` | Community (non-official on Replicate) | TODO | TODO | Version on Replicate is 1.0 vs 1.5-preview on FAL — treat as approximate, not identical |
| recraft-v3 | `fal-ai/recraft/v3/text-to-image` | `recraft-ai/recraft-v3` | Official | TODO | TODO | |
| recraft-v4 | `fal-ai/recraft/v4/pro/text-to-image` | `recraft-ai/recraft-v4` | Official | TODO | TODO | |
| fibo | `bria/fibo/generate` | `bria/fibo` | Official | TODO | TODO | |
| seedream | `fal-ai/bytedance/seedream/v4.5/text-to-image` | `bytedance/seedream-4.5` | Official | TODO | TODO | |
| seedream-v4 | `fal-ai/bytedance/seedream/v4/text-to-image` | `bytedance/seedream-4` | Official | TODO | TODO | |
| banana2 | `fal-ai/nano-banana-2` | `google/nano-banana-2` | Official | TODO | TODO | |
| banana-pro | `fal-ai/nano-banana-pro` | `google/nano-banana-pro` | Official | TODO | TODO | |

## Edit endpoints

Source: `EDIT_ENDPOINTS` in `src/model-router.ts`.

| Logical model | FAL endpoint | Replicate slug | Status | Pinned version | Input diff | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| kontext | `fal-ai/flux-pro/kontext` | `black-forest-labs/flux-kontext-pro` | Official | TODO | TODO | `max`/`dev` variants also available |
| kontext-lora | `fal-ai/flux-kontext-lora` | `black-forest-labs/flux-kontext-dev-lora` | Official | TODO | TODO | |
| reve | `fal-ai/reve/edit` | `reve/edit` | Official | TODO | TODO | `reve/create` and `reve/remix` also exist |
| reve-fast | `fal-ai/reve-fast/edit` | `reve/edit-fast` | Official | TODO | TODO | |
| fibo-edit | `bria/fibo-edit/edit` | TODO (verify under `bria/*`) | Likely Official | TODO | TODO | Bria has several official models on Replicate — confirm exact slug |
| seedream | `fal-ai/bytedance/seedream/v4.5/edit` | `bytedance/seedream-4.5` | Official | TODO | TODO | Same slug handles generate + edit; check input schema for the edit path |
| seedream-v4 | `fal-ai/bytedance/seedream/v4/edit` | `bytedance/seedream-4` | Official | TODO | TODO | Same as above |
| banana2 | `fal-ai/nano-banana-2/edit` | `google/nano-banana-2` | Official | TODO | TODO | Confirm whether edit is the same slug with image input, or a separate endpoint |
| banana-pro | `fal-ai/nano-banana-pro/edit` | `google/nano-banana-pro` | Official | TODO | TODO | Same |

## Background removal

Source: `BG_REMOVAL_ENDPOINTS` in `src/fal.ts`.

| Logical model | FAL endpoint | Replicate slug | Status | Notes |
| --- | --- | --- | --- | --- |
| birefnet | `fal-ai/birefnet` | `men1scus/birefnet` | Community | Works but not vendor-backed; consider using Bria as the primary default on Replicate |
| bria | `fal-ai/bria/background/remove` | `bria/remove-background` | Official | Direct match, recommended default on Replicate |
| pixelcut | `fal-ai/pixelcut/background-removal` | **Missing** | — | No Pixelcut on Replicate. Substitute with `bria/remove-background` (official) or `recraft-ai/recraft-remove-background` (official) |
| rembg | `fal-ai/smoretalk-ai/rembg-enhance` | `cjwbw/rembg` (or similar) | Community | Multiple rembg community models exist; pick one and pin |

## Upscale

| Logical model | FAL endpoint | Replicate slug | Status | Notes |
| --- | --- | --- | --- | --- |
| creative-upscaler | `fal-ai/creative-upscaler` | `recraft-ai/recraft-creative-upscale` | Official | Direct match |

## Gap resolution

From the coverage survey, only one clear gap remains. A few more rows need a "quality/officialness" call rather than a pure substitution.

| Item | Issue | Proposed action | Decision |
| --- | --- | --- | --- |
| pixelcut (bg removal) | No Replicate equivalent | **Substitute**: router rejects `--model pixelcut --provider replicate` with a clear error suggesting `bria` or a new `recraft-bg` logical model. Alternative: silently alias `pixelcut` to `bria` on Replicate (simpler, but opaque). Recommendation: **explicit error**. | TBD |
| imagineart | Replicate version is 1.0, non-official; FAL uses 1.5-preview | Accept the version drift and ship it on Replicate, OR mark as FAL-only. Recommendation: **FAL-only** — agents rely on imagineart for a specific look and a silent version downgrade is worse than a clean "not supported on replicate" error. | TBD |
| birefnet | Community model on Replicate | Ship it but document the community-model caveat in the skill. Prefer `bria` as the default on Replicate. | TBD |
| rembg | Community model on Replicate | Same as birefnet. | TBD |
| fibo-edit | Bria slug needs verification | Verify during Phase 1 version-hash pass. Likely `bria/fibo-edit` or similar. | TBD |
| banana2 / banana-pro edit path | Unclear whether Replicate exposes edit as a separate endpoint or the same slug with image input | Verify input schema during Phase 1. If same slug, simplify the endpoint maps (one slug for both generate + edit). | TBD |

### Proposed "official-only" mode (optional)

Per the survey, a cleaner subset avoids all community models:

- Background removal on Replicate uses `bria/remove-background` and `recraft-ai/recraft-remove-background` only (drop `birefnet` and `rembg` from the Replicate provider).
- `imagineart` is FAL-only.
- Everything else maps to an official Replicate vendor namespace.

This produces a tighter, more defensible Replicate provider at the cost of reducing user choice. Team decision needed.

## Outstanding Phase 1 work

The coverage survey answered "does it exist." Still needed before writing code:

1. **Version hashes.** For each mapped model, fetch the current version via `GET /v1/models/{owner}/{name}` and pin it. Record the pin date.
2. **Input schema diffs.** For each per-model branch in `src/fal.ts`'s `generate()` and `edit()`, diff the FAL input shape against the Replicate schema. Note every rename/addition/removal.
3. **Pricing.** Pull current pricing per model. Flag which use flat per-run pricing vs hardware-time billing.
4. **Gap decisions.** Team signs off on the proposed actions above.

## Pricing snapshot

Updated once Phase 1 completes. Both FAL and Replicate columns are populated because `MODEL_COSTS` in the router is keyed per `(provider, model)` — see `add-replicate-provider.md` Phase 4. A dash means the model is not offered by that provider (and therefore won't appear in that provider's branch of `MODEL_COSTS`).

Record the snapshot date so future reviewers know when prices were last verified.

**Pricing verified:** TODO (date)

| Logical model | FAL price | FAL billing | Replicate price | Replicate billing |
| --- | --- | --- | --- | --- |
| flux-schnell | $0.003 | flat | TODO | TODO |
| flux-dev | $0.03 | flat | TODO | TODO |
| seedream | $0.04 | flat | TODO | TODO |
| seedream-v4 | TODO | TODO | TODO | TODO |
| kontext | $0.04 | flat | TODO | TODO |
| kontext-lora | $0.035 | flat | TODO | TODO |
| banana2 | $0.08 | flat | TODO | TODO |
| banana-pro | $0.15 | flat | TODO | TODO |
| recraft-v3 | $0.04 | flat | TODO | TODO |
| recraft-v4 | $0.25 | flat | TODO | TODO |
| fibo | $0.04 | flat | TODO | TODO |
| fibo-edit | $0.04 | flat | TODO | TODO |
| reve | $0.04 | flat | TODO | TODO |
| reve-fast | $0.02 | flat | TODO | TODO |
| imagineart | $0.03 | flat | — (FAL-only, proposed) | — |
| birefnet | — | — | TODO (community) | TODO |
| bria (bg removal) | TODO | TODO | TODO | TODO |
| pixelcut | TODO | TODO | — (no equivalent) | — |
| rembg | TODO | TODO | TODO (community) | TODO |
| creative-upscaler | TODO | TODO | TODO | TODO |
