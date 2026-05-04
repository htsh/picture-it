import fs from "fs";
import path from "path";
import type { PictureItConfig, ProviderName } from "./types.ts";

type ConfigKey = "fal_key" | "anthropic_api_key" | "replicate_key";
type ConfigWithLegacyKeys = PictureItConfig & { anthropic_api_key?: string };

export const APP_DIR = path.join(
  process.env["HOME"] || process.env["USERPROFILE"] || "~",
  ".picture-it"
);
const CONFIG_PATH = path.join(APP_DIR, "config.json");

function loadConfigFile(): PictureItConfig {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
    return JSON.parse(raw) as PictureItConfig;
  } catch {
    return {};
  }
}

function saveConfigFile(config: PictureItConfig): void {
  fs.mkdirSync(APP_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), {
    mode: 0o600,
  });
}

export function getConfig(): PictureItConfig {
  const file = loadConfigFile();
  return {
    fal_key: process.env["FAL_KEY"] || file.fal_key,
    replicate_key: process.env["REPLICATE_API_TOKEN"] || file.replicate_key,
    default_model: file.default_model,
    default_platform: file.default_platform,
    default_grade: file.default_grade,
    default_provider: file.default_provider,
  };
}

export function setConfigValue(key: string, value: string): void {
  const config = loadConfigFile();
  (config as any)[key] = value;
  saveConfigFile(config);
}

export function getConfigValue(key: string): string | undefined {
  const config = loadConfigFile();
  return (config as any)[key];
}

export function listConfig(): PictureItConfig {
  return loadConfigFile();
}

export function clearConfig(): void {
  try {
    fs.unlinkSync(CONFIG_PATH);
  } catch {
    // Already gone
  }
}

export function maskKey(key: string): string {
  if (key.length <= 8) return "****";
  return key.slice(0, 4) + "..." + key.slice(-4);
}

export function getKeySource(
  key: ConfigKey
): { value: string; source: string } | null {

  const envMap: Record<string, string> = {
    fal_key: "FAL_KEY",
    anthropic_api_key: "ANTHROPIC_API_KEY",
    replicate_key: "REPLICATE_API_TOKEN",
  };
  const envKey = envMap[key];
  if (envKey && process.env[envKey]) {
    return { value: process.env[envKey]!, source: "env variable" };
  }

  const file = loadConfigFile() as ConfigWithLegacyKeys;
  const fileVal = file[key];
  if (fileVal) {
    return { value: fileVal, source: "config.json" };
  }

  return null;
}

export function ensureKeys(
  ...keys: ConfigKey[]
): void {
  const config = getConfig() as ConfigWithLegacyKeys;
  const missing: string[] = [];

  for (const k of keys) {
    if (!config[k]) {
      missing.push(k === "fal_key" ? "FAL_KEY" : k === "replicate_key" ? "REPLICATE_API_TOKEN" : "ANTHROPIC_API_KEY");
    }
  }

  if (missing.length > 0) {
    process.stderr.write(
      `No API keys configured for: ${missing.join(", ")}\n` +
        `Run 'picture-it auth' to set up.\n`
    );
    process.exit(1);
  }
}

function parseProvider(value: string, source: string): ProviderName {
  if (value === "fal" || value === "replicate") return value;

  process.stderr.write(
    `[picture-it] Invalid provider from ${source}: ${value}. Use "fal" or "replicate".\n`
  );
  process.exit(1);
}

export function resolveProvider(providerOverride?: string, source = "--provider"): ProviderName {
  if (providerOverride !== undefined) return parseProvider(providerOverride, source);

  const env = process.env["PICTURE_IT_PROVIDER"];
  if (env) return parseProvider(env, "PICTURE_IT_PROVIDER");

  const file = loadConfigFile();
  if (file.default_provider) return parseProvider(file.default_provider, "default_provider config");

  return "fal";
}
