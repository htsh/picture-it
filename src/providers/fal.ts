import { fal } from "@fal-ai/client";
import sharp from "sharp";
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

const providerName = "fal" as const;

export const FalProvider: ImageProvider = {
  name: providerName,

  async prepareImageInput(buffer: Buffer, filename: string): Promise<string> {
    const file = new File([buffer], filename, { type: "image/png" });
    return fal.storage.upload(file);
  },

  // --- Generate ---

  async generate(opts: GenerateOpts): Promise<Buffer> {
    const model = selectGenerateModel(providerName, opts.model, opts.verbose);
    const endpoint = getGenerateEndpoint(providerName, model);
    const cost = getCost(providerName, model);

    log(`FAL generate: ${model} @ $${cost.toFixed(3)}`);

    const w = opts.width || 1200;
    const h = opts.height || 630;

    let input: Record<string, unknown>;

    if (model === "recraft-v3" || model === "recraft-v4") {
      input = {
        prompt: opts.prompt,
        image_size: { width: w, height: h },
      };
    } else if (model === "imagineart") {
      input = {
        prompt: opts.prompt,
        image_size: { width: Math.min(w, 2048), height: Math.min(h, 2048) },
      };
    } else if (model === "fibo") {
      input = {
        prompt: opts.prompt,
        num_images: 1,
        image_size: { width: w, height: h },
      };
    } else if (model === "seedream" || model === "seedream-v4") {
      input = {
        prompt: opts.prompt,
        image_size: seedreamSize(w, h),
        num_images: 1,
      };
    } else if (model === "banana2" || model === "banana-pro") {
      input = {
        prompt: opts.prompt,
        aspect_ratio: mapAspectRatio(w, h),
        resolution: mapResolution(w, h),
        output_format: "png",
        num_images: 1,
      };
    } else {
      // flux-dev, flux-schnell
      input = {
        prompt: opts.prompt,
        num_images: 1,
        image_size: mapFluxSize(w, h),
      };
    }

    const result = await fal.subscribe(endpoint, {
      input,
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS" && opts.verbose) {
          for (const entry of (update as any).logs || []) {
            log(`FAL: ${entry.message}`);
          }
        }
      },
    });

    return downloadResult(result);
  },

  // --- Edit ---

  async edit(opts: EditOpts): Promise<Buffer> {
    const model = selectEditModel(providerName, opts.inputUrls.length, opts.model, opts.verbose);
    const endpoint = getEditEndpoint(providerName, model);
    const cost = getCost(providerName, model);

    log(`FAL edit: ${model} @ $${cost.toFixed(2)} | ${opts.inputUrls.length} input(s)`);

    const w = opts.width || 1200;
    const h = opts.height || 630;

    let input: Record<string, unknown>;

    if (model === "seedream") {
      input = {
        prompt: opts.prompt,
        image_urls: opts.inputUrls,
        image_size: seedreamSize(w, h),
        num_images: 1,
        max_images: 1,
      };
    } else if (model === "banana2") {
      input = {
        prompt: opts.prompt,
        image_urls: opts.inputUrls,
        aspect_ratio: mapAspectRatio(w, h),
        resolution: mapResolution(w, h),
        output_format: "png",
        num_images: 1,
        limit_generations: true,
      };
    } else if (model === "kontext" || model === "kontext-lora") {
      input = {
        prompt: opts.prompt,
        image_url: opts.inputUrls[0],
      };
    } else if (model === "reve" || model === "reve-fast") {
      input = {
        prompt: opts.prompt,
        image_url: opts.inputUrls[0],
        num_images: 1,
      };
    } else if (model === "fibo-edit") {
      input = {
        prompt: opts.prompt,
        image_url: opts.inputUrls[0],
      };
    } else if (model === "seedream-v4") {
      input = {
        prompt: opts.prompt,
        image_urls: opts.inputUrls,
        image_size: seedreamSize(w, h),
        num_images: 1,
        max_images: 1,
      };
    } else {
      // banana-pro — minimal params
      input = {
        prompt: opts.prompt,
        image_urls: opts.inputUrls,
        num_images: 1,
      };
    }

    const result = await fal.subscribe(endpoint, {
      input,
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS" && opts.verbose) {
          for (const entry of (update as any).logs || []) {
            log(`FAL: ${entry.message}`);
          }
        }
      },
    });

    return downloadResult(result);
  },

  // --- Remove background ---

  async removeBg(opts: RemoveBgOpts): Promise<Buffer> {
    const model = opts.model || "bria";
    const endpoint = getBgRemovalEndpoint(providerName, model);

    log(`FAL: ${model} background removal`);

    const result = await fal.subscribe(endpoint, {
      input: { image_url: opts.inputUrl },
    });

    const data = (result as any).data;
    const outputUrl = data?.image?.url || data?.images?.[0]?.url;
    if (!outputUrl) throw new Error(`${model} returned no image`);

    const response = await fetch(outputUrl);
    return Buffer.from(await response.arrayBuffer());
  },

  // --- Upscale ---

  async upscale(opts: UpscaleOpts): Promise<Buffer> {
    log(`FAL: upscale ${opts.scale || 2}x`);

    const endpoint = getUpscaleEndpoint(providerName);
    const result = await fal.subscribe(endpoint, {
      input: {
        image_url: opts.inputUrl,
        scale: opts.scale || 2,
      },
    });

    return downloadResult(result);
  },

  // --- Capabilities ---

  canGenerate(model: ModelId): boolean {
    return canGenerate(providerName, model);
  },

  canEdit(model: ModelId): boolean {
    return canEdit(providerName, model);
  },

  canRemoveBg(model: string): boolean {
    return canRemoveBg(providerName, model);
  },

  listSupportedModels(): ModelId[] {
    return [
      "flux-schnell", "flux-dev", "imagineart", "recraft-v3", "recraft-v4",
      "fibo", "seedream", "seedream-v4", "banana2", "banana-pro",
      "kontext", "kontext-lora", "reve", "reve-fast", "fibo-edit",
    ] as ModelId[];
  },
};

// --- Helpers ---

async function downloadResult(result: any): Promise<Buffer> {
  const url = result?.data?.images?.[0]?.url || result?.data?.image?.url;
  if (!url) throw new Error("FAL returned no image URL");

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

function mapFluxSize(w: number, h: number): string {
  const ratio = w / h;
  if (Math.abs(ratio - 1) < 0.1) return "square_hd";
  if (ratio > 1.5) return "landscape_16_9";
  if (ratio < 0.67) return "portrait_16_9";
  if (ratio > 1) return "landscape_4_3";
  return "portrait_4_3";
}

function seedreamSize(w: number, h: number): unknown {
  if (w >= 1920 && h >= 1080 && w <= 4096 && h <= 4096) {
    return { width: w, height: h };
  }
  return "auto_2K";
}
