import type { FalModel } from "./types.ts";
import { log } from "./operations.ts";

const MODEL_ENDPOINTS: Record<FalModel, string> = {
  seedream: "fal-ai/bytedance/seedream/v4.5/edit",
  banana2: "fal-ai/nano-banana-2/edit",
  "banana-pro": "fal-ai/nano-banana-pro/edit",
  "flux-dev": "fal-ai/flux/dev",
  "flux-schnell": "fal-ai/flux/schnell",
};

const MODEL_COSTS: Record<FalModel, number> = {
  seedream: 0.04,
  banana2: 0.08,
  "banana-pro": 0.15,
  "flux-dev": 0.03,
  "flux-schnell": 0.003,
};

export function getEndpoint(model: FalModel): string {
  return MODEL_ENDPOINTS[model];
}

export function getCost(model: FalModel): number {
  return MODEL_COSTS[model];
}

export function selectGenerateModel(explicit?: string, verbose = false): FalModel {
  if (explicit && explicit in MODEL_ENDPOINTS) return explicit as FalModel;

  const model: FalModel = "flux-schnell";
  if (verbose) log(`Model: ${model} ($${getCost(model)}) — fast generation`);
  return model;
}

export function selectEditModel(
  inputCount: number,
  explicit?: string,
  verbose = false
): FalModel {
  if (explicit && explicit in MODEL_ENDPOINTS) return explicit as FalModel;

  let model: FalModel;
  let reason: string;

  if (inputCount > 10) {
    model = "banana2";
    reason = `${inputCount} inputs (>10), needs banana2`;
  } else {
    model = "seedream";
    reason = "default edit model, $0.04";
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
