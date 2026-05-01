// Core types for picture-it v2 — composable operations architecture

export type ProviderName = "fal" | "replicate";

export type ModelId =
  // Generate only
  | "flux-schnell"
  | "flux-dev"
  | "recraft-v3"
  | "recraft-v4"
  | "imagineart"
  | "fibo"
  // Edit only
  | "kontext"
  | "kontext-lora"
  | "reve"
  | "reve-fast"
  | "fibo-edit"
  // Both generate and edit
  | "seedream"
  | "seedream-v4"
  | "banana2"
  | "banana-pro";

export type BgRemovalModel = "birefnet" | "bria" | "pixelcut" | "rembg";

export type ColorGrade =
  | "cinematic"
  | "moody"
  | "vibrant"
  | "clean"
  | "warm-editorial"
  | "cool-tech";

export type DepthLayer =
  | "background"
  | "midground"
  | "foreground"
  | "overlay"
  | "frame";

export type BlendMode = "normal" | "multiply" | "screen" | "overlay";

export type MaskShape = "circle" | "rounded" | "hexagon" | "diamond" | "blob" | string;

export type DeviceFrame = "iphone" | "macbook" | "browser" | "ipad";

export type AnchorPosition = "center" | "top-left" | "top-right" | "bottom-left" | "bottom-right";

export type CropPosition =
  | "attention" | "entropy" | "center"
  | "top" | "bottom" | "left" | "right"
  | { left: number; top: number };

export type ZoneName =
  | "hero-center" | "title-area" | "top-bar" | "bottom-bar"
  | "left-third" | "right-third"
  | "top-left-safe" | "top-right-safe" | "bottom-left-safe" | "bottom-right-safe"
  | "center-left" | "center-right";

export interface Zone {
  x: number;
  y: number;
}

export const ZONES: Record<ZoneName, Zone> = {
  "hero-center": { x: 50, y: 45 },
  "title-area": { x: 50, y: 75 },
  "top-bar": { x: 50, y: 8 },
  "bottom-bar": { x: 50, y: 92 },
  "left-third": { x: 25, y: 50 },
  "right-third": { x: 75, y: 50 },
  "top-left-safe": { x: 15, y: 12 },
  "top-right-safe": { x: 85, y: 12 },
  "bottom-left-safe": { x: 15, y: 88 },
  "bottom-right-safe": { x: 85, y: 88 },
  "center-left": { x: 30, y: 50 },
  "center-right": { x: 70, y: 50 },
};

// --- Overlay types (used by compose/text commands) ---

export interface ShadowConfig {
  blur: number;
  color: string;
  offsetX: number;
  offsetY: number;
  opacity?: number;
}

export interface GlowConfig {
  color: string;
  blur: number;
  spread: number;
}

export interface ReflectionConfig {
  opacity: number;
  fadeHeight: number;
}

export interface ImageOverlay {
  type: "image";
  src: string;
  zone?: ZoneName | { x: number; y: number };
  width?: number | string;
  height?: number | string;
  anchor?: AnchorPosition;
  opacity?: number;
  borderRadius?: number;
  shadow?: ShadowConfig | "auto";
  glow?: GlowConfig;
  reflection?: ReflectionConfig;
  rotation?: number;
  mask?: MaskShape;
  deviceFrame?: DeviceFrame;
  depth?: DepthLayer;
}

export interface SatoriTextOverlay {
  type: "satori-text";
  jsx: SatoriJSX;
  zone?: ZoneName | { x: number; y: number };
  width?: number;
  height?: number;
  anchor?: AnchorPosition;
  opacity?: number;
  depth?: DepthLayer;
}

export interface ShapeOverlay {
  type: "shape";
  shape: "rect" | "circle" | "line" | "arrow";
  zone?: ZoneName | { x: number; y: number };
  width?: number;
  height?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  borderRadius?: number;
  opacity?: number;
  from?: { x: number; y: number };
  to?: { x: number; y: number };
  headSize?: number;
  curve?: number;
  depth?: DepthLayer;
}

export interface GradientOverlay {
  type: "gradient-overlay";
  gradient: string;
  opacity?: number;
  blend?: BlendMode;
  depth?: DepthLayer;
}

export interface WatermarkOverlay {
  type: "watermark";
  src: string;
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
  margin?: number;
  opacity?: number;
  size?: number;
  depth?: DepthLayer;
}

export type Overlay =
  | ImageOverlay
  | SatoriTextOverlay
  | ShapeOverlay
  | GradientOverlay
  | WatermarkOverlay;

export interface SatoriJSX {
  tag: string;
  props?: Record<string, unknown>;
  children?: (SatoriJSX | string)[];
}

// --- Pipeline types ---

export type PipelineStep =
  | { op: "generate"; prompt: string; model?: ModelId; size?: string; platform?: string; provider?: ProviderName }
  | { op: "edit"; prompt: string; model?: ModelId; assets?: string[]; size?: string; provider?: ProviderName }
  | { op: "remove-bg"; model?: string; provider?: ProviderName }
  | { op: "replace-bg"; prompt: string; model?: ModelId; provider?: ProviderName }
  | { op: "crop"; size: string; position?: string }
  | { op: "grade"; name: ColorGrade }
  | { op: "grain"; intensity?: number }
  | { op: "vignette"; opacity?: number }
  | { op: "text"; title: string; font?: string; color?: string; fontSize?: number; zone?: string }
  | { op: "compose"; overlays: string | Overlay[] }
  | { op: "upscale"; scale?: number; provider?: ProviderName };

// --- Config ---

export interface PictureItConfig {
  fal_key?: string;
  replicate_key?: string;
  default_model?: ModelId;
  default_platform?: string;
  default_grade?: ColorGrade;
  default_provider?: ProviderName;
}

// --- Platform/style presets ---

export interface PlatformPreset {
  width: number;
  height: number;
  safeZone: string;
  minHeading?: number;
  defaultGrade?: ColorGrade;
  notes?: string;
}

export interface StylePreset {
  falPromptStyle: string;
  font: string;
  defaultGrade: ColorGrade;
  glowDefault?: string;
}

// --- Asset info ---

export interface ImageInfo {
  path: string;
  filename: string;
  width: number;
  height: number;
  aspectRatio: number;
  hasTransparency: boolean;
  dominantColors: string[];
  contentType: "icon" | "logo" | "screenshot" | "avatar" | "cutout" | "photo";
  format: string;
  sizeBytes: number;
}

// --- Batch ---

export interface BatchEntry {
  id: string;
  pipeline: PipelineStep[];
  output?: string;
  provider?: ProviderName;
}
