import type { ModelId, BgRemovalModel, ProviderName } from "../types.ts";

export interface GenerateOpts {
  prompt: string;
  model?: string;
  width?: number;
  height?: number;
  verbose?: boolean;
}

export interface EditOpts {
  inputUrls: string[];
  prompt: string;
  model?: string;
  width?: number;
  height?: number;
  verbose?: boolean;
}

export interface RemoveBgOpts {
  inputUrl: string;
  model?: string;
  verbose?: boolean;
}

export interface UpscaleOpts {
  inputUrl: string;
  scale?: number;
  verbose?: boolean;
}

export interface ImageProvider {
  readonly name: ProviderName;

  generate(opts: GenerateOpts): Promise<Buffer>;
  edit(opts: EditOpts): Promise<Buffer>;
  removeBg(opts: RemoveBgOpts): Promise<Buffer>;
  upscale(opts: UpscaleOpts): Promise<Buffer>;

  prepareImageInput(buffer: Buffer, filename: string): Promise<string>;

  canGenerate(model: ModelId): boolean;
  canEdit(model: ModelId): boolean;
  canRemoveBg(model: string): boolean;
  listSupportedModels(): ModelId[];
}

export type { ProviderName, ModelId, BgRemovalModel };
