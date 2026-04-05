import sharp from "sharp";
import fs from "fs";
import path from "path";
import { PLATFORM_PRESETS } from "./presets.ts";

export function log(msg: string) {
  process.stderr.write(`[picture-it] ${msg}\n`);
}

export function parseSize(
  sizeStr?: string,
  platform?: string
): { width: number; height: number } {
  if (sizeStr) {
    const [w, h] = sizeStr.split("x").map(Number);
    if (w && h) return { width: w, height: h };
  }
  if (platform && PLATFORM_PRESETS[platform]) {
    return {
      width: PLATFORM_PRESETS[platform]!.width,
      height: PLATFORM_PRESETS[platform]!.height,
    };
  }
  return { width: 1200, height: 630 };
}

export async function readInput(inputPath: string): Promise<Buffer> {
  if (!fs.existsSync(inputPath)) {
    log(`Input not found: ${inputPath}`);
    process.exit(1);
  }
  return sharp(inputPath).png().toBuffer();
}

export async function writeOutput(
  buffer: Buffer,
  outputPath: string
): Promise<string> {
  const resolved = path.resolve(outputPath);
  const ext = path.extname(resolved).toLowerCase();

  let img = sharp(buffer);
  switch (ext) {
    case ".jpg":
    case ".jpeg":
      await img.jpeg({ quality: 90 }).toFile(resolved);
      break;
    case ".webp":
      await img.webp({ quality: 90 }).toFile(resolved);
      break;
    default:
      await img.png({ quality: 90 }).toFile(resolved);
      break;
  }

  return resolved;
}

export function ensureFalKey(): string {
  const config = loadFalKey();
  if (!config) {
    log("No FAL API key configured. Run 'picture-it auth --fal <key>' to set up.");
    process.exit(1);
  }
  return config;
}

function loadFalKey(): string | undefined {
  // 1. Env var
  if (process.env["FAL_KEY"]) return process.env["FAL_KEY"];

  // 2. Config file
  const configPath = path.join(
    process.env["HOME"] || "~",
    ".picture-it",
    "config.json"
  );
  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    const config = JSON.parse(raw);
    return config.fal_key;
  } catch {
    return undefined;
  }
}
