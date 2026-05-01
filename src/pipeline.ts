import sharp from "sharp";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import path from "path";
import fs from "fs";
import { log, parseSize, ensureProviderKey, writeOutput } from "./operations.ts";
import { getProvider, configureProvider } from "./providers/index.ts";
import { composite } from "./compositor.ts";
import { applyColorGrade, applyGrain, applyVignette } from "./postprocess.ts";
import { loadFonts } from "./fonts.ts";
import { resolveProvider } from "./config.ts";
import type { PipelineStep, Overlay, ProviderName } from "./types.ts";
import type { ImageProvider } from "./providers/types.ts";

export async function executePipeline(
  steps: PipelineStep[],
  outputPath: string,
  verbose = false
): Promise<string> {
  let buffer: Buffer | null = null;
  let provider: ImageProvider | null = null;
  let providerName: ProviderName = "fal";

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]!;
    if (verbose) log(`Pipeline step ${i + 1}/${steps.length}: ${step.op}`);

    // Resolve provider for this step (step-level override wins, then previously resolved)
    if (step.op === "generate" || step.op === "edit" || step.op === "remove-bg" || step.op === "replace-bg" || step.op === "upscale") {
      const stepProviderName = (step as any).provider
        ? resolveProvider((step as any).provider)
        : providerName;
      if (!provider || stepProviderName !== provider.name) {
        providerName = stepProviderName;
        const key = ensureProviderKey(providerName);
        configureProvider(providerName, key);
        provider = getProvider(providerName);
      }
    }

    switch (step.op) {
      case "generate": {
        const { width, height } = parseSize(step.size, step.platform);
        buffer = await provider!.generate({
          prompt: step.prompt,
          model: step.model,
          width,
          height,
          verbose,
        });
        // Crop to exact size using sharp (non-AI)
        buffer = await sharp(buffer)
          .resize(width, height, { fit: "cover", position: "attention" })
          .png()
          .toBuffer();
        break;
      }

      case "edit": {
        if (!buffer && (!step.assets || step.assets.length === 0)) {
          throw new Error("Edit step requires input buffer or assets");
        }
        const urls: string[] = [];
        if (buffer) {
          urls.push(await provider!.prepareImageInput(buffer, "input.png"));
        }
        if (step.assets) {
          for (const asset of step.assets) {
            const assetBuf = await sharp(path.resolve(asset)).png().toBuffer();
            urls.push(await provider!.prepareImageInput(assetBuf, path.basename(asset)));
          }
        }
        const size = step.size ? parseSize(step.size) : buffer ? await getBufferSize(buffer) : { width: 1200, height: 630 };
        buffer = await provider!.edit({
          inputUrls: urls,
          prompt: step.prompt,
          model: step.model,
          width: size.width,
          height: size.height,
          verbose,
        });
        buffer = await sharp(buffer)
          .resize(size.width, size.height, { fit: "cover", position: "attention" })
          .png()
          .toBuffer();
        break;
      }

      case "remove-bg": {
        if (!buffer) throw new Error("remove-bg requires input");
        const url = await provider!.prepareImageInput(buffer, "input.png");
        buffer = await provider!.removeBg({ inputUrl: url, model: step.model, verbose });
        break;
      }

      case "replace-bg": {
        if (!buffer) throw new Error("replace-bg requires input");
        const cutoutUrl = await provider!.prepareImageInput(buffer, "input.png");
        const cutout = await provider!.removeBg({ inputUrl: cutoutUrl, verbose });
        const size = await getBufferSize(buffer);
        const bg = await provider!.generate({
          prompt: step.prompt,
          model: step.model,
          width: size.width,
          height: size.height,
          verbose,
        });
        const bgCropped = await sharp(bg)
          .resize(size.width, size.height, { fit: "cover", position: "attention" })
          .png()
          .toBuffer();
        buffer = await sharp(bgCropped)
          .composite([{ input: cutout, blend: "over" }])
          .png()
          .toBuffer();
        break;
      }

      case "crop": {
        if (!buffer) throw new Error("crop requires input");
        const { width, height } = parseSize(step.size);
        const pos = (step.position || "attention") as any;
        buffer = await sharp(buffer)
          .resize(width, height, { fit: "cover", position: pos })
          .png()
          .toBuffer();
        break;
      }

      case "grade": {
        if (!buffer) throw new Error("grade requires input");
        buffer = await applyColorGrade(buffer, step.name);
        break;
      }

      case "grain": {
        if (!buffer) throw new Error("grain requires input");
        buffer = await applyGrain(buffer, step.intensity);
        break;
      }

      case "vignette": {
        if (!buffer) throw new Error("vignette requires input");
        buffer = await applyVignette(buffer, step.opacity);
        break;
      }

      case "text": {
        if (!buffer) throw new Error("text requires input");
        buffer = await renderTextOnto(buffer, step);
        break;
      }

      case "compose": {
        if (!buffer) throw new Error("compose requires input");
        let overlays: Overlay[];
        if (typeof step.overlays === "string") {
          overlays = JSON.parse(fs.readFileSync(path.resolve(step.overlays), "utf-8"));
        } else {
          overlays = step.overlays;
        }
        const size = await getBufferSize(buffer);
        buffer = await composite(buffer, overlays, size.width, size.height, process.cwd(), verbose);
        break;
      }

      case "upscale": {
        if (!buffer) throw new Error("upscale requires input");
        const url = await provider!.prepareImageInput(buffer, "input.png");
        buffer = await provider!.upscale({ inputUrl: url, scale: step.scale, verbose });
        break;
      }
    }
  }

  if (!buffer) throw new Error("Pipeline produced no output");

  const finalPath = await writeOutput(buffer, outputPath);
  return finalPath;
}

async function getBufferSize(buffer: Buffer): Promise<{ width: number; height: number }> {
  const meta = await sharp(buffer).metadata();
  return { width: meta.width || 1200, height: meta.height || 630 };
}

async function renderTextOnto(
  buffer: Buffer,
  step: { title: string; font?: string; color?: string; fontSize?: number; zone?: string }
): Promise<Buffer> {
  const meta = await sharp(buffer).metadata();
  const w = meta.width || 1200;
  const h = meta.height || 630;
  const fonts = await loadFonts();

  const fontSize = step.fontSize || 64;
  const fontFamily = step.font || "Space Grotesk";
  const color = step.color || "white";

  const jsx = {
    type: "div",
    props: {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
      },
      children: {
        type: "span",
        props: {
          style: {
            fontSize,
            fontFamily,
            fontWeight: 700,
            color,
            textShadow: "0 2px 10px rgba(0,0,0,0.5)",
            textAlign: "center",
          },
          children: step.title,
        },
      },
    },
  };

  const textW = Math.round(w * 0.9);
  const textH = Math.round(h * 0.3);

  const svg = await satori(jsx as any, { width: textW, height: textH, fonts });
  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: textW } });
  const textPng = Buffer.from(resvg.render().asPng());

  const { resolvePosition } = await import("./zones.ts");
  const { ZONES } = await import("./types.ts");
  const zoneName = step.zone || "hero-center";
  const pos = resolvePosition(
    zoneName as any,
    w, h, textW, textH, "center"
  );

  return sharp(buffer)
    .composite([{ input: textPng, left: Math.max(0, pos.x), top: Math.max(0, pos.y), blend: "over" }])
    .png()
    .toBuffer();
}

export async function createGradientBackground(
  gradient: string,
  width: number,
  height: number
): Promise<Buffer> {
  const fonts = await loadFonts();

  const jsx = {
    type: "div",
    props: {
      style: { width, height, backgroundImage: gradient, display: "flex" },
      children: [],
    },
  };

  const svg = await satori(jsx as any, { width, height, fonts });
  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: width } });
  return Buffer.from(resvg.render().asPng());
}
