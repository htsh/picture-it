import type { ImageProvider } from "./types.ts";
import type { ProviderName } from "../types.ts";
import { FalProvider } from "./fal.ts";
import { ReplicateProvider, configureReplicate } from "./replicate.ts";
import { fal } from "@fal-ai/client";

const providers: Record<ProviderName, ImageProvider> = {
  fal: FalProvider,
  replicate: ReplicateProvider,
};

export function getProvider(name: ProviderName): ImageProvider {
  return providers[name];
}

export function configureProvider(provider: ProviderName, apiKey: string): void {
  if (provider === "fal") {
    fal.config({ credentials: apiKey });
  } else {
    configureReplicate(apiKey);
  }
}
