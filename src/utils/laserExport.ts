import { ATOMSTACK_X20_PRO_SPECS, SOFTWARE_PRESETS } from '../data/atomstackPresets';
import {
  LaserElement,
  LaserLayerType,
  MaterialPreset,
  SoftwarePresetId,
} from '../types/laser';

export interface ExportBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function computeElementsBoundingBox(
  elements: LaserElement[],
  paddingMm = 4
): ExportBounds {
  const visible = elements.filter((el) => el.visible);
  if (visible.length === 0) {
    return { x: 0, y: 0, width: 100, height: 100 };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const el of visible) {
    minX = Math.min(minX, el.x);
    minY = Math.min(minY, el.y);
    maxX = Math.max(maxX, el.x + el.width);
    maxY = Math.max(maxY, el.y + el.height);
  }

  const x = Math.max(0, minX - paddingMm);
  const y = Math.max(0, minY - paddingMm);
  const width = Math.max(10, maxX - minX + paddingMm * 2);
  const height = Math.max(10, maxY - minY + paddingMm * 2);

  return {
    x: Number(x.toFixed(2)),
    y: Number(y.toFixed(2)),
    width: Number(width.toFixed(2)),
    height: Number(height.toFixed(2)),
  };
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function buildExportSvg(
  elements: LaserElement[],
  options: {
    softwareId: SoftwarePresetId;
    material: MaterialPreset;
    scope: 'artwork' | 'bed';
    paddingMm?: number;
  }
): string {
  const preset = SOFTWARE_PRESETS[options.softwareId];
  const visible = elements.filter((el) => el.visible);
  const bounds: ExportBounds =
    options.scope === 'bed'
      ? {
          x: 0,
          y: 0,
          width: ATOMSTACK_X20_PRO_SPECS.bedWidthMm,
          height: ATOMSTACK_X20_PRO_SPECS.bedHeightMm,
        }
      : computeElementsBoundingBox(visible, options.paddingMm ?? 3);

  const offsetX = bounds.x;
  const offsetY = bounds.y;

  const cutItems: string[] = [];
  const scoreItems: string[] = [];
  const engraveItems: string[] = [];

  const pushLayerItem = (layer: LaserLayerType, markup: string) => {
    if (layer === 'cut') cutItems.push(markup);
    else if (layer === 'score') scoreItems.push(markup);
    else engraveItems.push(markup);
  };

  for (const el of visible) {
    const cx = el.x - offsetX + el.width / 2;
    const cy = el.y - offsetY + el.height / 2;
    const tx = el.x - offsetX;
    const ty = el.y - offsetY;

    if (el.kind === 'vector') {
      const sx = (el.width / el.viewBoxWidth) * (el.flipX ? -1 : 1);
      const sy = (el.height / el.viewBoxHeight) * (el.flipY ? -1 : 1);
      const transform = [
        el.rotation !== 0 ? `rotate(${el.rotation.toFixed(2)} ${cx.toFixed(2)} ${cy.toFixed(2)})` : '',
        `translate(${(el.flipX ? tx + el.width : tx).toFixed(2)} ${(el.flipY ? ty + el.height : ty).toFixed(2)})`,
        `scale(${sx.toFixed(4)} ${sy.toFixed(4)})`,
      ]
        .filter(Boolean)
        .join(' ');

      for (const prim of el.primitives) {
        const layer = el.useSubLayers ? prim.layer : el.layer;
        const strokeWidthScaled = (preset.strokeWidthMm / Math.max(0.01, Math.abs(sx))).toFixed(4);
        if (layer === 'cut') {
          pushLayerItem(
            'cut',
            `    <path d="${escapeXml(prim.d)}" fill="none" stroke="${preset.cutColor}" stroke-width="${strokeWidthScaled}" transform="${transform}" />`
          );
        } else if (layer === 'score') {
          pushLayerItem(
            'score',
            `    <path d="${escapeXml(prim.d)}" fill="none" stroke="${preset.scoreColor}" stroke-width="${strokeWidthScaled}" transform="${transform}" />`
          );
        } else {
          pushLayerItem(
            'engrave',
            `    <path d="${escapeXml(prim.d)}" fill="${preset.engraveColor}" fill-rule="${prim.fillRule ?? 'nonzero'}" stroke="none" transform="${transform}" />`
          );
        }
      }
    } else if (el.kind === 'text') {
      const rotateStr =
        el.rotation !== 0
          ? ` transform="rotate(${el.rotation.toFixed(2)} ${cx.toFixed(2)} ${cy.toFixed(2)})"`
          : '';
      const anchor =
        el.align === 'center' ? 'middle' : el.align === 'right' ? 'end' : 'start';
      const anchorX =
        el.align === 'center'
          ? tx + el.width / 2
          : el.align === 'right'
            ? tx + el.width
            : tx;
      const baselineY = ty + el.height * 0.78;
      const fillAttr =
        el.layer === 'engrave' ? preset.engraveColor : 'none';
      const strokeAttr =
        el.layer === 'cut'
          ? preset.cutColor
          : el.layer === 'score'
            ? preset.scoreColor
            : 'none';
      const strokeWidthAttr =
        el.layer === 'engrave' ? '' : ` stroke-width="${preset.strokeWidthMm}"`;

      pushLayerItem(
        el.layer,
        `    <text x="${anchorX.toFixed(2)}" y="${baselineY.toFixed(2)}" font-family="${escapeXml(el.fontFamily)}, sans-serif" font-size="${el.fontSizeMm.toFixed(2)}" font-weight="${el.fontWeight}" letter-spacing="${el.letterSpacingMm.toFixed(2)}" text-anchor="${anchor}" fill="${fillAttr}" stroke="${strokeAttr}"${strokeWidthAttr}${rotateStr}>${escapeXml(el.text)}</text>`
      );
    } else if (el.kind === 'raster') {
      const rotateStr =
        el.rotation !== 0
          ? ` transform="rotate(${el.rotation.toFixed(2)} ${cx.toFixed(2)} ${cy.toFixed(2)})"`
          : '';
      pushLayerItem(
        'engrave',
        `    <image href="${el.processedDataUrl}" x="${tx.toFixed(2)}" y="${ty.toFixed(2)}" width="${el.width.toFixed(2)}" height="${el.height.toFixed(2)}" preserveAspectRatio="none"${rotateStr} />`
      );
    }
  }

  const cutNote = options.material.cut
    ? `Cut: ${options.material.cut.speedMmMin} mm/min @ ${options.material.cut.powerPct}% (${options.material.cut.passes} pass)`
    : 'Cut: Not supported on this material';

  return `<?xml version="1.0" encoding="UTF-8"?>
<!--
  Generated by BeamForge Studio for ${ATOMSTACK_X20_PRO_SPECS.model} (400x400mm, 20W Optical)
  Target Software: ${preset.name}
  Material: ${options.material.name} (${options.material.thicknessLabel})
  Engrave: ${options.material.engrave.speedMmMin} mm/min @ ${options.material.engrave.powerPct}% | Score: ${options.material.score.speedMmMin} mm/min @ ${options.material.score.powerPct}% | ${cutNote}
-->
<svg xmlns="http://www.w3.org/2000/svg" width="${bounds.width}mm" height="${bounds.height}mm" viewBox="0 0 ${bounds.width} ${bounds.height}">
  <g id="Layer_Engrave">
${engraveItems.join('\n')}
  </g>
  <g id="Layer_Score">
${scoreItems.join('\n')}
  </g>
  <g id="Layer_Cut">
${cutItems.join('\n')}
  </g>
</svg>`;
}

export function buildSelectionSvg(
  selectedElements: LaserElement[],
  options: {
    softwareId: SoftwarePresetId;
    material: MaterialPreset;
  }
): string {
  const normalized = selectedElements.map((el) => ({ ...el, visible: true }));
  return buildExportSvg(normalized, {
    softwareId: options.softwareId,
    material: options.material,
    scope: 'artwork',
    paddingMm: 0,
  });
}

export async function buildExportPngDataUrl(
  elements: LaserElement[],
  options: {
    softwareId: SoftwarePresetId;
    material: MaterialPreset;
    scope: 'artwork' | 'bed';
    dpi: 254 | 300 | 318 | 600;
    includeCutLines: boolean;
    includeScoreLines: boolean;
    paddingMm?: number;
  }
): Promise<{ dataUrl: string; pixelWidth: number; pixelHeight: number; widthMm: number; heightMm: number }> {
  const visible = elements.filter((el) => el.visible);
  const bounds: ExportBounds =
    options.scope === 'bed'
      ? {
          x: 0,
          y: 0,
          width: ATOMSTACK_X20_PRO_SPECS.bedWidthMm,
          height: ATOMSTACK_X20_PRO_SPECS.bedHeightMm,
        }
      : computeElementsBoundingBox(visible, options.paddingMm ?? 3);

  const pxPerMm = options.dpi / 25.4;
  // Cap canvas dimensions safely at 4800px so high-DPI full-bed PNGs don't crash browser memory
  const rawW = Math.round(bounds.width * pxPerMm);
  const rawH = Math.round(bounds.height * pxPerMm);
  const safetyScale = Math.min(1, 4800 / Math.max(rawW, rawH));
  const pixelWidth = Math.max(32, Math.round(rawW * safetyScale));
  const pixelHeight = Math.max(32, Math.round(rawH * safetyScale));

  const filtered = visible.filter((el) => {
    if (el.kind === 'text') {
      if (el.layer === 'cut' && !options.includeCutLines) return false;
      if (el.layer === 'score' && !options.includeScoreLines) return false;
    }
    return true;
  });

  // Render via SVG -> Image -> Canvas so vectors, text, and raster layers match 1:1
  const preset = SOFTWARE_PRESETS[options.softwareId];
  const offsetX = bounds.x;
  const offsetY = bounds.y;
  const parts: string[] = [];

  for (const el of filtered) {
    const cx = el.x - offsetX + el.width / 2;
    const cy = el.y - offsetY + el.height / 2;
    const tx = el.x - offsetX;
    const ty = el.y - offsetY;

    if (el.kind === 'raster') {
      const rotateStr =
        el.rotation !== 0
          ? ` transform="rotate(${el.rotation.toFixed(2)} ${cx.toFixed(2)} ${cy.toFixed(2)})"`
          : '';
      parts.push(
        `<image href="${el.processedDataUrl}" x="${tx.toFixed(2)}" y="${ty.toFixed(2)}" width="${el.width.toFixed(2)}" height="${el.height.toFixed(2)}" preserveAspectRatio="none"${rotateStr} />`
      );
    } else if (el.kind === 'vector') {
      const sx = (el.width / el.viewBoxWidth) * (el.flipX ? -1 : 1);
      const sy = (el.height / el.viewBoxHeight) * (el.flipY ? -1 : 1);
      const transform = [
        el.rotation !== 0 ? `rotate(${el.rotation.toFixed(2)} ${cx.toFixed(2)} ${cy.toFixed(2)})` : '',
        `translate(${(el.flipX ? tx + el.width : tx).toFixed(2)} ${(el.flipY ? ty + el.height : ty).toFixed(2)})`,
        `scale(${sx.toFixed(4)} ${sy.toFixed(4)})`,
      ]
        .filter(Boolean)
        .join(' ');
      for (const prim of el.primitives) {
        const layer = el.useSubLayers ? prim.layer : el.layer;
        if (layer === 'cut' && !options.includeCutLines) continue;
        if (layer === 'score' && !options.includeScoreLines) continue;
        const strokeWidthScaled = (0.25 / Math.max(0.01, Math.abs(sx))).toFixed(4);
        if (layer === 'engrave') {
          parts.push(
            `<path d="${escapeXml(prim.d)}" fill="#000000" fill-rule="${prim.fillRule ?? 'nonzero'}" transform="${transform}" />`
          );
        } else {
          const strokeCol = layer === 'cut' ? preset.cutColor : preset.scoreColor;
          parts.push(
            `<path d="${escapeXml(prim.d)}" fill="none" stroke="${strokeCol}" stroke-width="${strokeWidthScaled}" transform="${transform}" />`
          );
        }
      }
    } else if (el.kind === 'text') {
      const rotateStr =
        el.rotation !== 0
          ? ` transform="rotate(${el.rotation.toFixed(2)} ${cx.toFixed(2)} ${cy.toFixed(2)})"`
          : '';
      const anchor =
        el.align === 'center' ? 'middle' : el.align === 'right' ? 'end' : 'start';
      const anchorX =
        el.align === 'center'
          ? tx + el.width / 2
          : el.align === 'right'
            ? tx + el.width
            : tx;
      const baselineY = ty + el.height * 0.78;
      parts.push(
        `<text x="${anchorX.toFixed(2)}" y="${baselineY.toFixed(2)}" font-family="${escapeXml(el.fontFamily)}, sans-serif" font-size="${el.fontSizeMm.toFixed(2)}" font-weight="${el.fontWeight}" letter-spacing="${el.letterSpacingMm.toFixed(2)}" text-anchor="${anchor}" fill="${el.layer === 'engrave' ? '#000000' : 'none'}" stroke="${el.layer === 'cut' ? preset.cutColor : el.layer === 'score' ? preset.scoreColor : 'none'}" stroke-width="${el.layer === 'engrave' ? 0 : 0.25}"${rotateStr}>${escapeXml(el.text)}</text>`
      );
    }
  }

  const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="${pixelWidth}" height="${pixelHeight}" viewBox="0 0 ${bounds.width} ${bounds.height}">${parts.join('')}</svg>`;
  const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
  const blobUrl = URL.createObjectURL(blob);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Failed to rasterize SVG to PNG.'));
      i.src = blobUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable.');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, pixelWidth, pixelHeight);
    ctx.drawImage(img, 0, 0, pixelWidth, pixelHeight);

    return {
      dataUrl: canvas.toDataURL('image/png'),
      pixelWidth,
      pixelHeight,
      widthMm: bounds.width,
      heightMm: bounds.height,
    };
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

export function buildSettingsGuideText(
  material: MaterialPreset,
  softwareId: SoftwarePresetId,
  bounds: ExportBounds
): string {
  const software = SOFTWARE_PRESETS[softwareId];
  return [
    `BEAMFORGE STUDIO — ATOMSTACK X20 PRO JOB SHEET`,
    `================================================`,
    `Machine: ${ATOMSTACK_X20_PRO_SPECS.model} (${ATOMSTACK_X20_PRO_SPECS.opticalPowerW}W Optical, ${ATOMSTACK_X20_PRO_SPECS.bedWidthMm}x${ATOMSTACK_X20_PRO_SPECS.bedHeightMm}mm)`,
    `Software Target: ${software.name}`,
    `Artwork Dimensions: ${bounds.width.toFixed(1)} mm × ${bounds.height.toFixed(1)} mm`,
    ``,
    `MATERIAL: ${material.name} (${material.thicknessLabel})`,
    `------------------------------------------------`,
    `1. ENGRAVE / FILL (${software.engraveColor})`,
    `   Speed: ${material.engrave.speedMmMin} mm/min | Power: ${material.engrave.powerPct}% | Passes: ${material.engrave.passes} | Air Assist: ${material.engrave.airAssist ? 'ON' : 'OFF'}`,
    `   Tip: ${material.engrave.note}`,
    ``,
    `2. SCORE / LINE (${software.scoreColor})`,
    `   Speed: ${material.score.speedMmMin} mm/min | Power: ${material.score.powerPct}% | Passes: ${material.score.passes} | Air Assist: ${material.score.airAssist ? 'ON' : 'OFF'}`,
    `   Tip: ${material.score.note}`,
    ``,
    `3. CUT (${software.cutColor})`,
    material.cut
      ? `   Speed: ${material.cut.speedMmMin} mm/min | Power: ${material.cut.powerPct}% | Passes: ${material.cut.passes} | Air Assist: ${material.cut.airAssist ? 'ON' : 'OFF'}\n   Tip: ${material.cut.note}`
      : `   Not applicable (20W diode engraves surface coating only on this material).`,
    ``,
    `IMPORT INSTRUCTION`,
    `------------------------------------------------`,
    software.importTip,
    ``,
  ].join('\n');
}

export function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadDataUrl(filename: string, dataUrl: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
