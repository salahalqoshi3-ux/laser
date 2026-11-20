import {
  LaserElement,
  LaserLayerType,
  TemplateDefinition,
  TextElement,
  VectorElement,
  VectorPrimitive,
} from '../types/laser';

export function makeId(prefix = 'el'): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export function estimateTextWidthMm(
  text: string,
  fontSizeMm: number,
  letterSpacingMm = 0
): number {
  const safeLen = Math.max(1, text.length);
  return Number((safeLen * fontSizeMm * 0.62 + Math.max(0, safeLen - 1) * letterSpacingMm).toFixed(1));
}

export function instantiateTemplate(
  template: TemplateDefinition,
  options: {
    primaryText: string;
    secondaryText: string;
    hasHole: boolean;
    centerXMm?: number;
    centerYMm?: number;
    widthMm?: number;
    heightMm?: number;
  }
): LaserElement[] {
  const built = template.build({
    primaryText: options.primaryText,
    secondaryText: options.secondaryText,
    hasHole: options.hasHole,
  });

  const width = options.widthMm ?? template.defaultWidthMm;
  const height = options.heightMm ?? template.defaultHeightMm;
  const cx = options.centerXMm ?? 200;
  const cy = options.centerYMm ?? 200;
  const x = Number((cx - width / 2).toFixed(1));
  const y = Number((cy - height / 2).toFixed(1));

  const vec: VectorElement = {
    id: makeId('tpl'),
    kind: 'vector',
    name: template.title,
    x,
    y,
    width,
    height,
    rotation: 0,
    flipX: false,
    flipY: false,
    layer: 'cut',
    useSubLayers: true,
    viewBoxWidth: built.viewBoxWidth,
    viewBoxHeight: built.viewBoxHeight,
    primitives: built.primitives,
    visible: true,
    locked: false,
    category: template.category,
  };

  const result: LaserElement[] = [vec];

  if (built.textOverlay && built.textOverlay.text.trim()) {
    const ov = built.textOverlay;
    const fontSize = Number((height * ov.fontSizeRatio).toFixed(1));
    const textW = Math.min(width * 0.84, estimateTextWidthMm(ov.text, fontSize));
    const textH = Number((fontSize * 1.25).toFixed(1));
    const tx = Number((x + width * ov.relX - textW / 2).toFixed(1));
    const ty = Number((y + height * ov.relY - textH / 2).toFixed(1));

    const mainText: TextElement = {
      id: makeId('txt'),
      kind: 'text',
      name: `Text · ${ov.text}`,
      text: ov.text,
      x: tx,
      y: ty,
      width: Number(textW.toFixed(1)),
      height: textH,
      fontSizeMm: fontSize,
      fontFamily: ov.fontFamily,
      fontWeight: ov.fontWeight,
      letterSpacingMm: 0.4,
      align: 'center',
      rotation: 0,
      layer: ov.layer,
      visible: true,
      locked: false,
    };
    result.push(mainText);

    if (ov.subText && ov.subText.trim() && ov.subRelY && ov.subFontSizeRatio) {
      const subFontSize = Number((height * ov.subFontSizeRatio).toFixed(1));
      const subW = Math.min(width * 0.82, estimateTextWidthMm(ov.subText, subFontSize, 0.6));
      const subH = Number((subFontSize * 1.25).toFixed(1));
      result.push({
        id: makeId('sub'),
        kind: 'text',
        name: `Subtitle · ${ov.subText}`,
        text: ov.subText,
        x: Number((x + width * ov.relX - subW / 2).toFixed(1)),
        y: Number((y + height * ov.subRelY - subH / 2).toFixed(1)),
        width: Number(subW.toFixed(1)),
        height: subH,
        fontSizeMm: subFontSize,
        fontFamily: 'Plus Jakarta Sans',
        fontWeight: 600,
        letterSpacingMm: 0.6,
        align: 'center',
        rotation: 0,
        layer: ov.layer,
        visible: true,
        locked: false,
      });
    }
  }

  return result;
}

export type NameTagShape = 'rounded' | 'pill' | 'hex' | 'bone' | 'ribbon';

export function buildBatchNameTags(config: {
  names: string[];
  subtitle: string;
  shape: NameTagShape;
  tagWidthMm: number;
  tagHeightMm: number;
  spacingMm: number;
  hasHole: boolean;
  fontFamily: TextElement['fontFamily'];
}): { elements: LaserElement[]; fitCount: number; overflowCount: number } {
  const bedMargin = 12;
  const usableW = 400 - bedMargin * 2;
  const usableH = 400 - bedMargin * 2;

  const cols = Math.max(
    1,
    Math.floor((usableW + config.spacingMm) / (config.tagWidthMm + config.spacingMm))
  );
  const rows = Math.max(
    1,
    Math.floor((usableH + config.spacingMm) / (config.tagHeightMm + config.spacingMm))
  );
  const maxFit = cols * rows;

  const cleanNames = config.names.map((n) => n.trim()).filter(Boolean);
  const itemsToPlace = cleanNames.slice(0, maxFit);
  const overflowCount = Math.max(0, cleanNames.length - maxFit);

  const elements: LaserElement[] = [];

  itemsToPlace.forEach((name, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const x = Number((bedMargin + col * (config.tagWidthMm + config.spacingMm)).toFixed(1));
    const y = Number((bedMargin + row * (config.tagHeightMm + config.spacingMm)).toFixed(1));

    const vbW = 100;
    const vbH = Number(((100 * config.tagHeightMm) / config.tagWidthMm).toFixed(2));
    const primitives: VectorPrimitive[] = [];

    if (config.shape === 'rounded' || config.shape === 'pill') {
      const r = config.shape === 'pill' ? vbH / 2 - 1 : Math.min(10, vbH * 0.2);
      primitives.push({
        id: 'cut',
        layer: 'cut',
        d: `M ${1 + r} 1 L ${vbW - 1 - r} 1 Q ${vbW - 1} 1 ${vbW - 1} ${1 + r} L ${vbW - 1} ${vbH - 1 - r} Q ${vbW - 1} ${vbH - 1} ${vbW - 1 - r} ${vbH - 1} L ${1 + r} ${vbH - 1} Q 1 ${vbH - 1} 1 ${vbH - 1 - r} L 1 ${1 + r} Q 1 1 ${1 + r} 1 Z`,
      });
      const ir = Math.max(2, r - 3);
      primitives.push({
        id: 'score',
        layer: 'score',
        d: `M ${4 + ir} 4 L ${vbW - 4 - ir} 4 Q ${vbW - 4} 4 ${vbW - 4} ${4 + ir} L ${vbW - 4} ${vbH - 4 - ir} Q ${vbW - 4} ${vbH - 4} ${vbW - 4 - ir} ${vbH - 4} L ${4 + ir} ${vbH - 4} Q 4 ${vbH - 4} 4 ${vbH - 4 - ir} L 4 ${4 + ir} Q 4 4 ${4 + ir} 4 Z`,
      });
    } else if (config.shape === 'hex') {
      primitives.push({
        id: 'cut',
        layer: 'cut',
        d: `M 16 1 L 84 1 L 99 ${(vbH / 2).toFixed(2)} L 84 ${vbH - 1} L 16 ${vbH - 1} L 1 ${(vbH / 2).toFixed(2)} Z`,
      });
      primitives.push({
        id: 'score',
        layer: 'score',
        d: `M 18 4.5 L 82 4.5 L 95 ${(vbH / 2).toFixed(2)} L 82 ${vbH - 4.5} L 18 ${vbH - 4.5} L 5 ${(vbH / 2).toFixed(2)} Z`,
      });
    } else if (config.shape === 'bone') {
      const mY = vbH / 2;
      primitives.push({
        id: 'cut',
        layer: 'cut',
        d: `M 22 ${mY - 12} C 15 ${mY - 22}, 3 ${mY - 18}, 4 ${mY - 7} C 5 ${mY - 2}, 8 ${mY}, 8 ${mY} C 8 ${mY}, 5 ${mY + 2}, 4 ${mY + 7} C 3 ${mY + 18}, 15 ${mY + 22}, 22 ${mY + 12} L 78 ${mY + 12} C 85 ${mY + 22}, 97 ${mY + 18}, 96 ${mY + 7} C 95 ${mY + 2}, 92 ${mY}, 92 ${mY} C 92 ${mY}, 95 ${mY - 2}, 96 ${mY - 7} C 97 ${mY - 18}, 85 ${mY - 22}, 78 ${mY - 12} Z`,
      });
    } else {
      // ribbon
      primitives.push({
        id: 'cut',
        layer: 'cut',
        d: `M 16 1 L 95 1 Q 99 1 99 5 L 99 ${vbH - 5} Q 99 ${vbH - 1} 95 ${vbH - 1} L 16 ${vbH - 1} L 2 ${(vbH * 0.58).toFixed(2)} Q 0.5 ${(vbH * 0.5).toFixed(2)} 2 ${(vbH * 0.42).toFixed(2)} Z`,
      });
      primitives.push({
        id: 'score',
        layer: 'score',
        d: `M 18 4.5 L 94 4.5 Q 95.5 4.5 95.5 6 L 95.5 ${vbH - 6} Q 95.5 ${vbH - 4.5} 94 ${vbH - 4.5} L 18 ${vbH - 4.5} L 7 ${(vbH * 0.56).toFixed(2)} Q 5.5 ${(vbH * 0.5).toFixed(2)} 7 ${(vbH * 0.44).toFixed(2)} Z`,
      });
    }

    if (config.hasHole) {
      const hx = config.shape === 'hex' ? 14 : 11;
      const hy = vbH / 2;
      const hr = Math.min(3.5, vbH * 0.1);
      primitives.push({
        id: 'hole',
        layer: 'cut',
        d: `M ${(hx - hr).toFixed(2)} ${hy.toFixed(2)} a ${hr.toFixed(2)} ${hr.toFixed(2)} 0 1 0 ${(hr * 2).toFixed(2)} 0 a ${hr.toFixed(2)} ${hr.toFixed(2)} 0 1 0 -${(hr * 2).toFixed(2)} 0 Z`,
      });
    }

    elements.push({
      id: makeId('tag'),
      kind: 'vector',
      name: `Tag · ${name}`,
      x,
      y,
      width: config.tagWidthMm,
      height: config.tagHeightMm,
      rotation: 0,
      flipX: false,
      flipY: false,
      layer: 'cut',
      useSubLayers: true,
      viewBoxWidth: vbW,
      viewBoxHeight: vbH,
      primitives,
      visible: true,
      locked: false,
      category: 'nametags',
    });

    const hasSub = Boolean(config.subtitle.trim());
    const fontSize = Number(
      Math.min(config.tagHeightMm * 0.28, (config.tagWidthMm * 0.72) / Math.max(3, name.length * 0.62)).toFixed(1)
    );
    const textW = Number(Math.min(config.tagWidthMm * 0.76, estimateTextWidthMm(name, fontSize)).toFixed(1));
    const textH = Number((fontSize * 1.25).toFixed(1));
    const centerOffset = config.hasHole ? 0.54 : 0.5;

    elements.push({
      id: makeId('tagtxt'),
      kind: 'text',
      name: `Name · ${name}`,
      text: name,
      x: Number((x + config.tagWidthMm * centerOffset - textW / 2).toFixed(1)),
      y: Number((y + config.tagHeightMm * (hasSub ? 0.4 : 0.5) - textH / 2).toFixed(1)),
      width: textW,
      height: textH,
      fontSizeMm: fontSize,
      fontFamily: config.fontFamily,
      fontWeight: 700,
      letterSpacingMm: 0.3,
      align: 'center',
      rotation: 0,
      layer: 'engrave',
      visible: true,
      locked: false,
    });

    if (hasSub) {
      const subSize = Number(Math.max(2.8, config.tagHeightMm * 0.13).toFixed(1));
      const subW = Number(
        Math.min(config.tagWidthMm * 0.75, estimateTextWidthMm(config.subtitle, subSize, 0.4)).toFixed(1)
      );
      const subH = Number((subSize * 1.25).toFixed(1));
      elements.push({
        id: makeId('tagsub'),
        kind: 'text',
        name: `Sub · ${config.subtitle}`,
        text: config.subtitle,
        x: Number((x + config.tagWidthMm * centerOffset - subW / 2).toFixed(1)),
        y: Number((y + config.tagHeightMm * 0.72 - subH / 2).toFixed(1)),
        width: subW,
        height: subH,
        fontSizeMm: subSize,
        fontFamily: 'Plus Jakarta Sans',
        fontWeight: 600,
        letterSpacingMm: 0.5,
        align: 'center',
        rotation: 0,
        layer: 'engrave',
        visible: true,
        locked: false,
      });
    }
  });

  return {
    elements,
    fitCount: itemsToPlace.length,
    overflowCount,
  };
}

export function createQuickShapeElement(
  shape: 'rect' | 'circle' | 'heart' | 'star' | 'hex' | 'hole',
  layer: LaserLayerType = 'cut'
): VectorElement {
  const id = makeId('shape');
  if (shape === 'hole') {
    return {
      id,
      kind: 'vector',
      name: 'Keychain Cutout (4mm)',
      x: 198,
      y: 198,
      width: 4,
      height: 4,
      rotation: 0,
      flipX: false,
      flipY: false,
      layer: 'cut',
      useSubLayers: false,
      viewBoxWidth: 100,
      viewBoxHeight: 100,
      primitives: [
        {
          id: 'p1',
          layer: 'cut',
          d: 'M 4 50 a 46 46 0 1 0 92 0 a 46 46 0 1 0 -92 0 Z',
        },
      ],
      visible: true,
      locked: false,
    };
  }

  let d = '';
  let name = 'Shape';
  if (shape === 'rect') {
    name = 'Rounded Rectangle';
    d = 'M 10 2 L 90 2 Q 98 2 98 10 L 98 90 Q 98 98 90 98 L 10 98 Q 2 98 2 90 L 2 10 Q 2 2 10 2 Z';
  } else if (shape === 'circle') {
    name = 'Circle';
    d = 'M 2 50 a 48 48 0 1 0 96 0 a 48 48 0 1 0 -96 0 Z';
  } else if (shape === 'heart') {
    name = 'Heart';
    d = 'M 50 88 C 8 60, 4 28, 26 14 C 42 5, 50 22, 50 28 C 50 22, 58 5, 74 14 C 96 28, 92 60, 50 88 Z';
  } else if (shape === 'star') {
    name = '5-Point Star';
    d = 'M 50 3 L 62 35 L 96 36 L 69 57 L 78 90 L 50 71 L 22 90 L 31 57 L 4 36 L 38 35 Z';
  } else if (shape === 'hex') {
    name = 'Hexagon';
    d = 'M 50 2 L 92 26 L 92 74 L 50 98 L 8 74 L 8 26 Z';
  }

  return {
    id,
    kind: 'vector',
    name,
    x: 170,
    y: 170,
    width: 60,
    height: 60,
    rotation: 0,
    flipX: false,
    flipY: false,
    layer,
    useSubLayers: false,
    viewBoxWidth: 100,
    viewBoxHeight: 100,
    primitives: [{ id: 'p1', layer, d }],
    visible: true,
    locked: false,
  };
}
