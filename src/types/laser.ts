export type LaserLayerType = 'cut' | 'score' | 'engrave';

export type SoftwarePresetId = 'lightburn' | 'lasergrbl' | 'atomstack';

export type StudioMode = 'templates' | 'ai' | 'trace' | 'nametags';

export type TemplateCategory =
  | 'all'
  | 'nametags'
  | 'events'
  | 'valentine'
  | 'christmas'
  | 'easter';

export type ViewRenderMode = 'cad' | 'material';

export type DitherMode =
  | 'floyd-steinberg'
  | 'atkinson'
  | 'jarvis'
  | 'bayer'
  | 'threshold'
  | 'grayscale';

export interface VectorPrimitive {
  id: string;
  d: string;
  layer: LaserLayerType;
  fillRule?: 'nonzero' | 'evenodd';
}

export interface VectorElement {
  id: string;
  kind: 'vector';
  name: string;
  x: number; // mm from left of 400x400 bed
  y: number; // mm from top of 400x400 bed
  width: number; // mm
  height: number; // mm
  rotation: number; // degrees
  flipX: boolean;
  flipY: boolean;
  layer: LaserLayerType; // default / override layer for single-layer shapes
  useSubLayers: boolean; // true for multi-layer templates/AI SVGs
  viewBoxWidth: number;
  viewBoxHeight: number;
  primitives: VectorPrimitive[];
  visible: boolean;
  locked: boolean;
  category?: TemplateCategory;
}

export interface TextElement {
  id: string;
  kind: 'text';
  name: string;
  text: string;
  x: number; // center or left in mm (stored as bounding top-left x in mm)
  y: number; // bounding top-left y in mm
  width: number; // computed mm width
  height: number; // computed mm height
  fontSizeMm: number;
  fontFamily: 'Plus Jakarta Sans' | 'DM Sans' | 'Georgia' | 'JetBrains Mono';
  fontWeight: 400 | 600 | 700;
  letterSpacingMm: number;
  align: 'left' | 'center' | 'right';
  rotation: number;
  layer: LaserLayerType;
  visible: boolean;
  locked: boolean;
}

export interface RasterElement {
  id: string;
  kind: 'raster';
  name: string;
  sourceDataUrl: string;
  processedDataUrl: string;
  naturalWidth: number;
  naturalHeight: number;
  x: number; // mm
  y: number; // mm
  width: number; // mm
  height: number; // mm
  rotation: number;
  ditherMode: DitherMode;
  brightness: number; // -100 to 100
  contrast: number; // -100 to 100
  gamma: number; // 0.4 to 2.4
  threshold: number; // 0 to 255
  invert: boolean;
  dpi: 254 | 300 | 318 | 600;
  visible: boolean;
  locked: boolean;
}

export type LaserElement = VectorElement | TextElement | RasterElement;

export interface MaterialPassSetting {
  speedMmMin: number;
  powerPct: number;
  passes: number;
  airAssist: boolean;
  note: string;
}

export interface MaterialPreset {
  id: string;
  name: string;
  group: 'Wood' | 'Acrylic' | 'Leather & Paper' | 'Stone & Metal';
  thicknessLabel: string;
  surfaceColor: string;
  engraveBurnColor: string;
  scoreBurnColor: string;
  cutEdgeColor: string;
  invertRecommended: boolean;
  warning?: string;
  engrave: MaterialPassSetting;
  score: MaterialPassSetting;
  cut: MaterialPassSetting | null;
}

export interface SoftwarePreset {
  id: SoftwarePresetId;
  name: string;
  shortName: string;
  description: string;
  cutColor: string;
  scoreColor: string;
  engraveColor: string;
  strokeWidthMm: number;
  preferredExport: 'svg' | 'png';
  importTip: string;
}

export interface TemplateDefinition {
  id: string;
  title: string;
  category: Exclude<TemplateCategory, 'all'>;
  subtitle: string;
  defaultWidthMm: number;
  defaultHeightMm: number;
  supportsPrimaryText: boolean;
  defaultPrimaryText?: string;
  supportsSecondaryText: boolean;
  defaultSecondaryText?: string;
  supportsHoleToggle: boolean;
  defaultHasHole?: boolean;
  recommendedMaterialId: string;
  build: (opts: {
    primaryText: string;
    secondaryText: string;
    hasHole: boolean;
  }) => {
    viewBoxWidth: number;
    viewBoxHeight: number;
    primitives: VectorPrimitive[];
    textOverlay?: {
      text: string;
      subText?: string;
      relX: number; // 0..1 of width
      relY: number; // 0..1 of height
      subRelY?: number;
      fontSizeRatio: number; // relative to height
      subFontSizeRatio?: number;
      fontFamily: TextElement['fontFamily'];
      fontWeight: TextElement['fontWeight'];
      layer: LaserLayerType;
    };
  };
}

export interface SavedProject {
  id: string;
  name: string;
  updatedAt: string;
  materialId: string;
  softwareId: SoftwarePresetId;
  elements: LaserElement[];
}

export type ChatPersona = 'combined' | 'technician' | 'designer';

export type ChatRoutingMode = 'auto' | 'fast' | 'general' | 'deep';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  modelUsed?: string;
  createdAt: string;
}

export interface BedChatContext {
  materialName: string;
  materialThickness: string;
  softwareName: string;
  elementCount: number;
  selectedSummary: string | null;
}

