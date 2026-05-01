import Replicate from "replicate";
import { log } from "../operations.ts";
import {
  getGenerateEndpoint,
  getEditEndpoint,
  getBgRemovalEndpoint,
  getUpscaleEndpoint,
  getCost,
  selectGenerateModel,
  selectEditModel,
  canGenerate,
  canEdit,
  canRemoveBg,
  mapAspectRatio,
  mapResolution,
} from "../model-router.ts";
import type { ModelId } from "../types.ts";
import type { ImageProvider, GenerateOpts, EditOpts, RemoveBgOpts, UpscaleOpts } from "./types.ts";

let client: Replicate | null = null;

function getClient(): Replicate {
  if (!client) throw new Error("Replicate client not configured. Set REPLICATE_API_TOKEN.");
  return client;
}

export function configureReplicate(apiKey: string): void {
  client = new Replicate({ auth: apiKey });
}

const providerName = "replicate" as const;

export const ReplicateProvider: ImageProvider = {
  name: providerName,

  async prepareImageInput(buffer: Buffer, _filename: string): Promise<string> {
    return `data:image/png;base64,${buffer.toString("base64")}`;
  },

  // --- Generate ---

  async generate(opts: GenerateOpts): Promise<Buffer> {
    const model = selectGenerateModel(providerName, opts.model, opts.verbose);
    const endpoint = getGenerateEndpoint(providerName, model);
    const cost = getCost(providerName, model);

    log(`Replicate generate: ${model} @ $${cost.toFixed(3)}`);

    const w = opts.width || 1200;
    const h = opts.height || 630;
    const input = buildGenerateInput(model, opts.prompt, w, h);

    const repl = getClient();
    const prediction = await repl.run(endpoint, { input, wait: { mode: "block" } });

    return downloadPredictionOutput(prediction);
  },

  // --- Edit ---

  async edit(opts: EditOpts): Promise<Buffer> {
    const model = selectEditModel(providerName, opts.inputUrls.length, opts.model, opts.verbose);
    const endpoint = getEditEndpoint(providerName, model);
    const cost = getCost(providerName, model);

    log(`Replicate edit: ${model} @ $${cost.toFixed(2)} | ${opts.inputUrls.length} input(s)`);

    const input = buildEditInput(model, opts.prompt, opts.inputUrls);

    const repl = getClient();
    const prediction = await repl.run(endpoint, { input, wait: { mode: "block" } });

    return downloadPredictionOutput(prediction);
  },

  // --- Remove background ---

  async removeBg(opts: RemoveBgOpts): Promise<Buffer> {
    const model = (opts.model || "bria") as string;

    if (model === "pixelcut") {
      throw new Error(
        `pixelcut is not available on Replicate. Use --model bria or --model rembg instead.`
      );
    }

    const endpoint = getBgRemovalEndpoint(providerName, model);
    log(`Replicate: ${model} background removal`);

    const repl = getClient();
    const prediction = await repl.run(endpoint, {
      input: { image: opts.inputUrl },
      wait: { mode: "block" },
    });

    return downloadPredictionOutput(prediction);
  },

  // --- Upscale ---

  async upscale(opts: UpscaleOpts): Promise<Buffer> {
    log(`Replicate: upscale ${opts.scale || 2}x`);

    const endpoint = getUpscaleEndpoint(providerName);

    const repl = getClient();
    const prediction = await repl.run(endpoint, {
      input: {
        image: opts.inputUrl,
        scale: opts.scale || 2,
      },
      wait: { mode: "block" },
    });

    return downloadPredictionOutput(prediction);
  },

  // --- Capabilities ---

  canGenerate(model: ModelId): boolean {
    return canGenerate(providerName, model);
  },

  canEdit(model: ModelId): boolean {
    return canEdit(providerName, model);
  },

  canRemoveBg(model: string): boolean {
    if (model === "pixelcut") return false;
    return canRemoveBg(providerName, model);
  },

  listSupportedModels(): ModelId[] {
    return [
      "flux-schnell", "flux-dev", "recraft-v3", "recraft-v4",
      "fibo", "seedream", "seedream-v4", "banana2", "banana-pro",
      "kontext", "kontext-lora", "reve", "reve-fast", "fibo-edit",
    ] as ModelId[];
  },
};

// --- Input builders (per-model, Replicate-specific schemas) ---

function buildGenerateInput(model: ModelId, prompt: string, w: number, h: number): Record<string, unknown> {
  return {
    prompt,
    ...getCommonGenerateInput(model, w, h),
  };
}

function buildEditInput(model: ModelId, prompt: string, inputUrls: string[]): Record<string, unknown> {
  const base = {
    prompt,
  };

  if (model === "kontext" || model === "kontext-lora" || model === "reve" || model === "reve-fast" || model === "fibo-edit") {
    return { ...base, image: inputUrls[0] };
  }

  return { ...base, images: inputUrls };
}

function getCommonGenerateInput(model: ModelId, w: number, h: number): Record<string, unknown> {
  switch (model) {
    case "flux-schnell":
    case "flux-dev":
      return {
        num_outputs: 1,
        aspect_ratio: mapAspectRatio(w, h),
        output_format: "png",
        output_quality: 90,
        disable_safety_checker: true,
      };

    case "recraft-v3":
    case "recraft-v4":
      return {
        size: `${w}x${h}`,
        style: "digital_image",
      };

    case "fibo":
      return {
        num_images: 1,
        image_size: `${w}x${h}`,
      };

    case "seedream":
    case "seedream-v4":
      return {
        num_images: 1,
        size: `${w}x${h}`,
      };

    case "banana2":
    case "banana-pro":
      return {
        aspect_ratio: mapAspectRatio(w, h),
        resolution: mapResolution(w, h),
        output_format: "png",
        num_images: 1,
      };

    default:
      return {
        num_outputs: 1,
        output_format: "png",
      };
  }
}

// --- Result download ---

async function downloadPredictionOutput(prediction: unknown): Promise<Buffer> {
  const output = prediction as any;

  // Handle array of URLs (common)
  if (Array.isArray(output)) {
    const first = output[0];
    const url = typeof first === "string" ? first : first?.url?.() || first?.toString?.();
    if (!url) throw new Error("Replicate returned no image URL");
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to download: ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  }

  // Handle single URL string
  if (typeof output === "string") {
    const response = await fetch(output);
    if (!response.ok) throw new Error(`Failed to download: ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  }

  // Handle FileOutput object
  if (output && typeof output.url === "function") {
    const url = output.url().toString();
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to download: ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  }

  throw new Error(`Replicate returned unexpected output: ${typeof output}`);
}
