import type { FalModel } from "./types.ts";
import { log } from "./operations.ts";

// Models that have a generate (text-to-image) endpoint
const GENERATE_ENDPOINTS: Partial<Record<FalModel, string>> = {
  "flux-schnell": "fal-ai/flux/schnell",
  "flux-dev": "fal-ai/flux/dev",
  imagineart: "fal-ai/imagineart/imagineart-1.5-preview/text-to-image",
  "recraft-v3": "fal-ai/recraft/v3/text-to-image",
  "recraft-v4": "fal-ai/recraft/v4/pro/text-to-image",
  fibo: "bria/fibo/generate",
  // These also support generation
  seedream: "fal-ai/bytedance/seedream/v4.5/text-to-image",
  "seedream-v4": "fal-ai/bytedance/seedream/v4/text-to-image",
  banana2: "fal-ai/nano-banana-2",
  "banana-pro": "fal-ai/nano-banana-pro",
};

// Models that have an edit (image-to-image) endpoint
const EDIT_ENDPOINTS: Partial<Record<FalModel, string>> = {
  kontext: "fal-ai/flux-pro/kontext",
  "kontext-lora": "fal-ai/flux-kontext-lora",
  reve: "fal-ai/reve/edit",
  "reve-fast": "fal-ai/reve-fast/edit",
  "fibo-edit": "bria/fibo-edit/edit",
  // These also support editing
  seedream: "fal-ai/bytedance/seedream/v4.5/edit",
  "seedream-v4": "fal-ai/bytedance/seedream/v4/edit",
  banana2: "fal-ai/nano-banana-2/edit",
  "banana-pro": "fal-ai/nano-banana-pro/edit",
};

const MODEL_COSTS: Record<FalModel, number> = {
  "flux-schnell": 0.003,
  "reve-fast": 0.02,
  "seedream-v4": 0.03,
  imagineart: 0.03,
  "flux-dev": 0.03,
  "kontext-lora": 0.035,
  seedream: 0.04,
  kontext: 0.04,
  reve: 0.04,
  "fibo-edit": 0.04,
  "recraft-v3": 0.04,
  fibo: 0.04,
  banana2: 0.08,
  "banana-pro": 0.15,
  "recraft-v4": 0.25,
};

export function getGenerateEndpoint(model: FalModel): string {
  const ep = GENERATE_ENDPOINTS[model];
  if (!ep) throw new Error(`Model ${model} does not support generation`);
  return ep;
}

export function getEditEndpoint(model: FalModel): string {
  const ep = EDIT_ENDPOINTS[model];
  if (!ep) throw new Error(`Model ${model} does not support editing`);
  return ep;
}

export function canGenerate(model: FalModel): boolean {
  return model in GENERATE_ENDPOINTS;
}

export function canEdit(model: FalModel): boolean {
  return model in EDIT_ENDPOINTS;
}

export function getCost(model: FalModel): number {
  return MODEL_COSTS[model];
}

export function selectGenerateModel(explicit?: string, verbose = false): FalModel {
  if (explicit && explicit in MODEL_COSTS) {
    const m = explicit as FalModel;
    if (!canGenerate(m)) throw new Error(`Model ${m} does not support generation`);
    return m;
  }

  const model: FalModel = "flux-schnell";
  if (verbose) log(`Model: ${model} ($${getCost(model)}) — fast generation`);
  return model;
}

export function selectEditModel(
  inputCount: number,
  explicit?: string,
  verbose = false
): FalModel {
  if (explicit && explicit in MODEL_COSTS) {
    const m = explicit as FalModel;
    if (!canEdit(m)) throw new Error(`Model ${m} does not support editing`);
    return m;
  }

  let model: FalModel;
  let reason: string;

  if (inputCount > 10) {
    model = "banana2";
    reason = `${inputCount} inputs (>10), needs banana2`;
  } else if (inputCount > 1) {
    model = "seedream";
    reason = "multi-image compositing, $0.04";
  } else {
    model = "kontext";
    reason = "default single-image edit, $0.04, best targeted edits";
  }

  if (verbose) log(`Model: ${model} ($${getCost(model)}) — ${reason}`);
  return model;
}

export function mapAspectRatio(width: number, height: number): string {
  const ratio = width / height;
  if (Math.abs(ratio - 1) < 0.1) return "1:1";
  if (Math.abs(ratio - 16 / 9) < 0.15) return "16:9";
  if (Math.abs(ratio - 9 / 16) < 0.15) return "9:16";
  if (Math.abs(ratio - 4 / 3) < 0.15) return "4:3";
  if (Math.abs(ratio - 3 / 4) < 0.15) return "3:4";
  if (Math.abs(ratio - 3 / 2) < 0.15) return "3:2";
  if (Math.abs(ratio - 2 / 3) < 0.15) return "2:3";
  if (Math.abs(ratio - 21 / 9) < 0.2) return "21:9";
  if (ratio >= 3.5) return "4:1";
  return "auto";
}

export function mapResolution(width: number, height: number): string {
  const maxDim = Math.max(width, height);
  if (maxDim <= 512) return "0.5K";
  if (maxDim <= 1024) return "1K";
  if (maxDim <= 2048) return "2K";
  return "4K";
}
