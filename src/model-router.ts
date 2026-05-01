import type { ModelId, BgRemovalModel, ProviderName } from "./types.ts";
import { log } from "./operations.ts";

// --- Per-provider generate endpoints ---

const GENERATE_ENDPOINTS: Record<ProviderName, Partial<Record<ModelId, string>>> = {
  fal: {
    "flux-schnell": "fal-ai/flux/schnell",
    "flux-dev": "fal-ai/flux/dev",
    imagineart: "fal-ai/imagineart/imagineart-1.5-preview/text-to-image",
    "recraft-v3": "fal-ai/recraft/v3/text-to-image",
    "recraft-v4": "fal-ai/recraft/v4/pro/text-to-image",
    fibo: "bria/fibo/generate",
    seedream: "fal-ai/bytedance/seedream/v4.5/text-to-image",
    "seedream-v4": "fal-ai/bytedance/seedream/v4/text-to-image",
    banana2: "fal-ai/nano-banana-2",
    "banana-pro": "fal-ai/nano-banana-pro",
  },
  replicate: {
    "flux-schnell": "black-forest-labs/flux-schnell",
    "flux-dev": "black-forest-labs/flux-dev",
    "recraft-v3": "recraft-ai/recraft-v3",
    "recraft-v4": "recraft-ai/recraft-v4",
    fibo: "bria/fibo",
    seedream: "bytedance/seedream-4.5",
    "seedream-v4": "bytedance/seedream-4",
    banana2: "google/nano-banana-2",
    "banana-pro": "google/nano-banana-pro",
  },
};

// --- Per-provider edit endpoints ---

const EDIT_ENDPOINTS: Record<ProviderName, Partial<Record<ModelId, string>>> = {
  fal: {
    kontext: "fal-ai/flux-pro/kontext",
    "kontext-lora": "fal-ai/flux-kontext-lora",
    reve: "fal-ai/reve/edit",
    "reve-fast": "fal-ai/reve-fast/edit",
    "fibo-edit": "bria/fibo-edit/edit",
    seedream: "fal-ai/bytedance/seedream/v4.5/edit",
    "seedream-v4": "fal-ai/bytedance/seedream/v4/edit",
    banana2: "fal-ai/nano-banana-2/edit",
    "banana-pro": "fal-ai/nano-banana-pro/edit",
  },
  replicate: {
    kontext: "black-forest-labs/flux-kontext-pro",
    "kontext-lora": "black-forest-labs/flux-kontext-dev-lora",
    reve: "reve/edit",
    "reve-fast": "reve/edit-fast",
    "fibo-edit": "bria/fibo-edit",
    seedream: "bytedance/seedream-4.5",
    "seedream-v4": "bytedance/seedream-4",
    banana2: "google/nano-banana-2",
    "banana-pro": "google/nano-banana-pro",
  },
};

// --- Per-provider background removal endpoints ---

const BG_REMOVAL_ENDPOINTS: Record<ProviderName, Record<string, string>> = {
  fal: {
    birefnet: "fal-ai/birefnet",
    bria: "fal-ai/bria/background/remove",
    pixelcut: "fal-ai/pixelcut/background-removal",
    rembg: "fal-ai/smoretalk-ai/rembg-enhance",
  },
  replicate: {
    birefnet: "men1scus/birefnet",
    bria: "bria/remove-background",
    rembg: "cjwbw/rembg",
  },
};

// --- Per-provider upscale endpoints ---

const UPSCALE_ENDPOINTS: Record<ProviderName, string> = {
  fal: "fal-ai/creative-upscaler",
  replicate: "recraft-ai/recraft-creative-upscale",
};

// --- Per-provider model costs (for pre-call estimation) ---

const MODEL_COSTS: Record<ProviderName, Partial<Record<ModelId, number>>> = {
  fal: {
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
  },
  replicate: {
    "flux-schnell": 0.003,
    "reve-fast": 0.02,
    "seedream-v4": 0.03,
    "flux-dev": 0.025,
    "kontext-lora": 0.035,
    seedream: 0.03,
    kontext: 0.04,
    reve: 0.04,
    "fibo-edit": 0.04,
    "recraft-v3": 0.04,
    fibo: 0.04,
    banana2: 0.08,
    "banana-pro": 0.15,
    "recraft-v4": 0.25,
  },
};

// --- Endpoint accessors ---

export function getGenerateEndpoint(provider: ProviderName, model: ModelId): string {
  const ep = GENERATE_ENDPOINTS[provider][model];
  if (!ep) throw new Error(`Model ${model} does not support generation on ${provider}`);
  return ep;
}

export function getEditEndpoint(provider: ProviderName, model: ModelId): string {
  const ep = EDIT_ENDPOINTS[provider][model];
  if (!ep) throw new Error(`Model ${model} does not support editing on ${provider}`);
  return ep;
}

export function getBgRemovalEndpoint(provider: ProviderName, model: string): string {
  const eps = BG_REMOVAL_ENDPOINTS[provider];
  const ep = eps[model] || eps["bria"]!;
  return ep;
}

export function getUpscaleEndpoint(provider: ProviderName): string {
  return UPSCALE_ENDPOINTS[provider]!;
}

// --- Model capability checks ---

export function canGenerate(provider: ProviderName, model: ModelId): boolean {
  return model in GENERATE_ENDPOINTS[provider];
}

export function canEdit(provider: ProviderName, model: ModelId): boolean {
  return model in EDIT_ENDPOINTS[provider];
}

export function canRemoveBg(provider: ProviderName, model: string): boolean {
  return model in BG_REMOVAL_ENDPOINTS[provider];
}

export function getCost(provider: ProviderName, model: ModelId): number {
  return MODEL_COSTS[provider][model] ?? 0;
}

// --- Model selection (cheapest-capable for a provider) ---

export function selectGenerateModel(
  provider: ProviderName,
  explicit?: string,
  verbose = false
): ModelId {
  if (explicit) {
    const m = explicit as ModelId;
    if (!(m in MODEL_COSTS[provider])) {
      throw new Error(`Model ${m} is not available on ${provider}`);
    }
    if (!canGenerate(provider, m)) {
      throw new Error(`Model ${m} does not support generation on ${provider}`);
    }
    return m;
  }

  const model: ModelId = "flux-schnell";
  if (verbose) log(`Model: ${model} ($${getCost(provider, model).toFixed(3)}) — fast generation`);
  return model;
}

export function selectEditModel(
  provider: ProviderName,
  inputCount: number,
  explicit?: string,
  verbose = false
): ModelId {
  if (explicit) {
    const m = explicit as ModelId;
    if (!(m in MODEL_COSTS[provider])) {
      throw new Error(`Model ${m} is not available on ${provider}`);
    }
    if (!canEdit(provider, m)) {
      throw new Error(`Model ${m} does not support editing on ${provider}`);
    }
    return m;
  }

  let model: ModelId;
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

  if (verbose) log(`Model: ${model} ($${getCost(provider, model).toFixed(2)}) — ${reason}`);
  return model;
}

// --- Utility ---

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
