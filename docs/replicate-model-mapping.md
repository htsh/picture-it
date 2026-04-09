# Replicate Model Mapping — TO BE FILLED

**Status:** Template. Phase 1 of the migration fills this in.
**Purpose:** Source-of-truth mapping from every current FAL model/endpoint to its Replicate equivalent, with the pinned version and input schema diff.

## How to fill this in

For each row:

1. Find the model on replicate.com/explore or via the Replicate API.
2. Grab the latest version hash from the model's page ("Versions" tab) or `GET /v1/models/{owner}/{name}`.
3. Diff the input schema against the FAL input builder in `src/fal.ts` and note renames/removals/additions.
4. Note pricing model: **flat** (fixed per-run) or **hardware** (per-second billing).
5. If no Replicate equivalent exists, write `NOT AVAILABLE` and add a row to the "Gaps" section with a proposed substitute.

## Generate endpoints

Source: `GENERATE_ENDPOINTS` in `src/model-router.ts`.

| FAL model | FAL endpoint | Replicate slug | Pinned version | Pricing | Input diff | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| flux-schnell | `fal-ai/flux/schnell` | `black-forest-labs/flux-schnell` | TODO | TODO | TODO | Likely direct match |
| flux-dev | `fal-ai/flux/dev` | `black-forest-labs/flux-dev` | TODO | TODO | TODO | Likely direct match |
| imagineart | `fal-ai/imagineart/imagineart-1.5-preview/text-to-image` | TODO | — | — | — | Suspected gap |
| recraft-v3 | `fal-ai/recraft/v3/text-to-image` | TODO | TODO | TODO | TODO | |
| recraft-v4 | `fal-ai/recraft/v4/pro/text-to-image` | TODO | TODO | TODO | TODO | |
| fibo | `bria/fibo/generate` | TODO | — | — | — | Suspected gap (Bria-hosted) |
| seedream | `fal-ai/bytedance/seedream/v4.5/text-to-image` | TODO | TODO | TODO | TODO | |
| seedream-v4 | `fal-ai/bytedance/seedream/v4/text-to-image` | TODO | TODO | TODO | TODO | |
| banana2 | `fal-ai/nano-banana-2` | TODO | TODO | TODO | TODO | Google Gemini image — find the Replicate slug |
| banana-pro | `fal-ai/nano-banana-pro` | TODO | TODO | TODO | TODO | |

## Edit endpoints

Source: `EDIT_ENDPOINTS` in `src/model-router.ts`.

| FAL model | FAL endpoint | Replicate slug | Pinned version | Pricing | Input diff | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| kontext | `fal-ai/flux-pro/kontext` | `black-forest-labs/flux-kontext-pro` (verify) | TODO | TODO | TODO | |
| kontext-lora | `fal-ai/flux-kontext-lora` | TODO | TODO | TODO | TODO | |
| reve | `fal-ai/reve/edit` | TODO | — | — | — | Suspected gap |
| reve-fast | `fal-ai/reve-fast/edit` | TODO | — | — | — | Suspected gap |
| fibo-edit | `bria/fibo-edit/edit` | TODO | — | — | — | Suspected gap |
| seedream | `fal-ai/bytedance/seedream/v4.5/edit` | TODO | TODO | TODO | TODO | |
| seedream-v4 | `fal-ai/bytedance/seedream/v4/edit` | TODO | TODO | TODO | TODO | |
| banana2 | `fal-ai/nano-banana-2/edit` | TODO | TODO | TODO | TODO | |
| banana-pro | `fal-ai/nano-banana-pro/edit` | TODO | TODO | TODO | TODO | |

## Background removal

Source: `BG_REMOVAL_ENDPOINTS` in `src/fal.ts`.

| FAL model | FAL endpoint | Replicate slug | Pinned version | Notes |
| --- | --- | --- | --- | --- |
| birefnet | `fal-ai/birefnet` | TODO | TODO | Well-known model, should exist |
| bria | `fal-ai/bria/background/remove` | TODO | TODO | Bria may or may not be on Replicate |
| pixelcut | `fal-ai/pixelcut/background-removal` | TODO | — | Suspected gap |
| rembg | `fal-ai/smoretalk-ai/rembg-enhance` | TODO | TODO | rembg is ubiquitous on Replicate |

## Upscale

| FAL model | FAL endpoint | Replicate slug | Pinned version | Notes |
| --- | --- | --- | --- | --- |
| creative-upscaler | `fal-ai/creative-upscaler` | TODO | TODO | Many upscalers on Replicate — pick the closest |

## Gaps — decisions needed

For each gap, pick one of: **substitute**, **drop**, **block**.

| Gap | Current use | Proposed action | Decision |
| --- | --- | --- | --- |
| imagineart | Alternative generate model | TBD | |
| fibo / fibo-edit | Alternative generate + edit | TBD | |
| reve / reve-fast | Alternative edit models | TBD | |
| pixelcut | Alternative bg removal | TBD | |

## Pricing snapshot

Once the mapping is filled in, update `MODEL_COSTS` in `src/model-router.ts` with Replicate numbers. Record the snapshot date here so future reviewers know when prices were last verified:

**Pricing verified:** TODO (date)

| Model | Old (FAL) | New (Replicate) | Pricing model |
| --- | --- | --- | --- |
| flux-schnell | $0.003 | TODO | TODO |
| flux-dev | $0.03 | TODO | TODO |
| seedream | $0.04 | TODO | TODO |
| kontext | $0.04 | TODO | TODO |
| banana2 | $0.08 | TODO | TODO |
| banana-pro | $0.15 | TODO | TODO |
| recraft-v4 | $0.25 | TODO | TODO |
| *(others)* | | | |
