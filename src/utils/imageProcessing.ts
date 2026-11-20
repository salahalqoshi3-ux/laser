import { DitherMode, LaserLayerType, VectorPrimitive } from '../types/laser';

export interface DitherOptions {
  mode: DitherMode;
  brightness: number; // -100..100
  contrast: number; // -100..100
  gamma: number; // 0.4..2.4
  threshold: number; // 0..255
  invert: boolean;
  maxDimensionPx?: number;
}

const BAYER_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

function clamp255(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image data.'));
    img.src = src;
  });
}

export async function processRasterImage(
  sourceDataUrl: string,
  options: DitherOptions
): Promise<{ dataUrl: string; width: number; height: number }> {
  const img = await loadImage(sourceDataUrl);
  const maxDim = options.maxDimensionPx ?? 640;
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable.');

  // Paint white backdrop for transparent PNGs so laser ignores transparent regions cleanly
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  const contrastFactor =
    (259 * (options.contrast + 255)) / (255 * (259 - options.contrast));
  const gray = new Float32Array(w * h);

  for (let i = 0; i < w * h; i++) {
    const idx = i * 4;
    // ITU-R BT.601 luminance
    let lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    // Brightness
    lum += options.brightness * 1.28;
    // Contrast
    lum = contrastFactor * (lum - 128) + 128;
    lum = clamp255(lum);
    // Gamma
    if (options.gamma !== 1) {
      lum = 255 * Math.pow(lum / 255, 1 / options.gamma);
    }
    if (options.invert) {
      lum = 255 - lum;
    }
    gray[i] = clamp255(lum);
  }

  if (options.mode === 'grayscale') {
    for (let i = 0; i < w * h; i++) {
      const v = Math.round(gray[i]);
      const idx = i * 4;
      data[idx] = v;
      data[idx + 1] = v;
      data[idx + 2] = v;
      data[idx + 3] = 255;
    }
  } else if (options.mode === 'threshold') {
    for (let i = 0; i < w * h; i++) {
      const v = gray[i] >= options.threshold ? 255 : 0;
      const idx = i * 4;
      data[idx] = v;
      data[idx + 1] = v;
      data[idx + 2] = v;
      data[idx + 3] = 255;
    }
  } else if (options.mode === 'bayer') {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const threshold = ((BAYER_4X4[y % 4][x % 4] + 0.5) / 16) * 255;
        const v = gray[i] >= threshold ? 255 : 0;
        const idx = i * 4;
        data[idx] = v;
        data[idx + 1] = v;
        data[idx + 2] = v;
        data[idx + 3] = 255;
      }
    }
  } else if (options.mode === 'floyd-steinberg') {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const oldVal = gray[i];
        const newVal = oldVal >= options.threshold ? 255 : 0;
        const err = oldVal - newVal;
        gray[i] = newVal;
        if (x + 1 < w) gray[i + 1] += (err * 7) / 16;
        if (y + 1 < h) {
          if (x > 0) gray[i + w - 1] += (err * 3) / 16;
          gray[i + w] += (err * 5) / 16;
          if (x + 1 < w) gray[i + w + 1] += (err * 1) / 16;
        }
      }
    }
    for (let i = 0; i < w * h; i++) {
      const v = gray[i] >= 128 ? 255 : 0;
      const idx = i * 4;
      data[idx] = v;
      data[idx + 1] = v;
      data[idx + 2] = v;
      data[idx + 3] = 255;
    }
  } else if (options.mode === 'atkinson') {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const oldVal = gray[i];
        const newVal = oldVal >= options.threshold ? 255 : 0;
        const err = (oldVal - newVal) / 8;
        gray[i] = newVal;
        if (x + 1 < w) gray[i + 1] += err;
        if (x + 2 < w) gray[i + 2] += err;
        if (y + 1 < h) {
          if (x > 0) gray[i + w - 1] += err;
          gray[i + w] += err;
          if (x + 1 < w) gray[i + w + 1] += err;
        }
        if (y + 2 < h) {
          gray[i + 2 * w] += err;
        }
      }
    }
    for (let i = 0; i < w * h; i++) {
      const v = gray[i] >= 128 ? 255 : 0;
      const idx = i * 4;
      data[idx] = v;
      data[idx + 1] = v;
      data[idx + 2] = v;
      data[idx + 3] = 255;
    }
  } else if (options.mode === 'jarvis') {
    const weights: Array<[number, number, number]> = [
      [1, 0, 7],
      [2, 0, 5],
      [-2, 1, 3],
      [-1, 1, 5],
      [0, 1, 7],
      [1, 1, 5],
      [2, 1, 3],
      [-2, 2, 1],
      [-1, 2, 3],
      [0, 2, 5],
      [1, 2, 3],
      [2, 2, 1],
    ];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const oldVal = gray[i];
        const newVal = oldVal >= options.threshold ? 255 : 0;
        const err = (oldVal - newVal) / 48;
        gray[i] = newVal;
        for (const [dx, dy, weight] of weights) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < w && ny < h) {
            gray[ny * w + nx] += err * weight;
          }
        }
      }
    }
    for (let i = 0; i < w * h; i++) {
      const v = gray[i] >= 128 ? 255 : 0;
      const idx = i * 4;
      data[idx] = v;
      data[idx + 1] = v;
      data[idx + 2] = v;
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return {
    dataUrl: canvas.toDataURL('image/png'),
    width: img.width,
    height: img.height,
  };
}

function pointLineDistance(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) return Math.hypot(px - x1, py - y1);
  const t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy);
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.hypot(px - projX, py - projY);
}

function rdpSimplify(points: Array<[number, number]>, epsilon: number): Array<[number, number]> {
  if (points.length < 3) return points;
  let maxDist = 0;
  let index = 0;
  const [x1, y1] = points[0];
  const [x2, y2] = points[points.length - 1];
  for (let i = 1; i < points.length - 1; i++) {
    const d = pointLineDistance(points[i][0], points[i][1], x1, y1, x2, y2);
    if (d > maxDist) {
      maxDist = d;
      index = i;
    }
  }
  if (maxDist > epsilon) {
    const left = rdpSimplify(points.slice(0, index + 1), epsilon);
    const right = rdpSimplify(points.slice(index), epsilon);
    return [...left.slice(0, -1), ...right];
  }
  return [points[0], points[points.length - 1]];
}

export async function traceImageToVector(
  sourceDataUrl: string,
  options: {
    threshold: number;
    invert: boolean;
    simplifyEpsilon: number;
    traceLayer: LaserLayerType;
    addOuterCutFrame: boolean;
    addKeychainHole: boolean;
  }
): Promise<{
  viewBoxWidth: number;
  viewBoxHeight: number;
  primitives: VectorPrimitive[];
}> {
  const img = await loadImage(sourceDataUrl);
  const maxGrid = 140;
  const scale = Math.min(1, maxGrid / Math.max(img.width, img.height));
  const w = Math.max(16, Math.round(img.width * scale));
  const h = Math.max(16, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable.');

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);

  // Binary mask with 1px white border padding
  const gw = w + 2;
  const gh = h + 2;
  const grid = new Uint8Array(gw * gh);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      const dark = options.invert ? lum >= options.threshold : lum < options.threshold;
      grid[(y + 1) * gw + (x + 1)] = dark ? 1 : 0;
    }
  }

  // Extract boundary directed edges between 1 and 0 cells
  const edges = new Map<string, Array<[number, number]>>();
  const addEdge = (x1: number, y1: number, x2: number, y2: number) => {
    const key = `${x1},${y1}`;
    const list = edges.get(key) ?? [];
    list.push([x2, y2]);
    edges.set(key, list);
  };

  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      if (grid[y * gw + x] !== 1) continue;
      if (y === 0 || grid[(y - 1) * gw + x] === 0) addEdge(x, y, x + 1, y);
      if (x === gw - 1 || grid[y * gw + (x + 1)] === 0) addEdge(x + 1, y, x + 1, y + 1);
      if (y === gh - 1 || grid[(y + 1) * gw + x] === 0) addEdge(x + 1, y + 1, x, y + 1);
      if (x === 0 || grid[y * gw + (x - 1)] === 0) addEdge(x, y + 1, x, y);
    }
  }

  // Stitch directed edges into closed loops
  const loops: Array<Array<[number, number]>> = [];
  while (edges.size > 0) {
    const firstIter = edges.entries().next();
    if (firstIter.done) break;
    const [startKey, targets] = firstIter.value;
    const nextPt = targets.pop()!;
    if (targets.length === 0) edges.delete(startKey);

    const [sx, sy] = startKey.split(',').map(Number);
    const loop: Array<[number, number]> = [[sx, sy], nextPt];
    let cx = nextPt[0];
    let cy = nextPt[1];
    let guard = 0;

    while ((cx !== sx || cy !== sy) && guard < 20000) {
      guard++;
      const k = `${cx},${cy}`;
      const list = edges.get(k);
      if (!list || list.length === 0) break;
      const pt = list.pop()!;
      if (list.length === 0) edges.delete(k);
      loop.push(pt);
      cx = pt[0];
      cy = pt[1];
    }

    if (loop.length >= 6) {
      loops.push(loop);
    }
  }

  // Normalize loops into 0..100 aspect-preserving box
  const pad = options.addOuterCutFrame ? 8 : 2;
  const targetW = 100;
  const targetH = Math.round((100 * h) / w);
  const scaleX = (targetW - pad * 2) / w;
  const scaleY = (targetH - pad * 2) / h;

  const pathStrings: string[] = [];
  for (const rawLoop of loops) {
    const simplified = rdpSimplify(rawLoop, Math.max(0.25, options.simplifyEpsilon));
    if (simplified.length < 3) continue;
    const mapped = simplified.map(([px, py]) => [
      pad + (px - 1) * scaleX,
      pad + (py - 1) * scaleY,
    ]);
    const cmd = mapped
      .map(([mx, my], idx) => `${idx === 0 ? 'M' : 'L'} ${mx.toFixed(2)} ${my.toFixed(2)}`)
      .join(' ');
    pathStrings.push(`${cmd} Z`);
  }

  const primitives: VectorPrimitive[] = [];
  if (pathStrings.length > 0) {
    primitives.push({
      id: 'traced-artwork',
      d: pathStrings.join(' '),
      layer: options.traceLayer,
      fillRule: 'evenodd',
    });
  }

  if (options.addOuterCutFrame) {
    const r = Math.min(8, targetW * 0.1, targetH * 0.1);
    const frameD = [
      `M ${(1 + r).toFixed(2)} 1`,
      `L ${(targetW - 1 - r).toFixed(2)} 1`,
      `Q ${(targetW - 1).toFixed(2)} 1 ${(targetW - 1).toFixed(2)} ${(1 + r).toFixed(2)}`,
      `L ${(targetW - 1).toFixed(2)} ${(targetH - 1 - r).toFixed(2)}`,
      `Q ${(targetW - 1).toFixed(2)} ${(targetH - 1).toFixed(2)} ${(targetW - 1 - r).toFixed(2)} ${(targetH - 1).toFixed(2)}`,
      `L ${(1 + r).toFixed(2)} ${(targetH - 1).toFixed(2)}`,
      `Q 1 ${(targetH - 1).toFixed(2)} 1 ${(targetH - 1 - r).toFixed(2)}`,
      `L 1 ${(1 + r).toFixed(2)}`,
      `Q 1 1 ${(1 + r).toFixed(2)} 1 Z`,
    ].join(' ');
    primitives.push({
      id: 'outer-cut-frame',
      d: frameD,
      layer: 'cut',
    });
  }

  if (options.addKeychainHole) {
    const hx = targetW / 2;
    const hy = 5;
    const hr = 2.2;
    primitives.push({
      id: 'keychain-hole',
      d: `M ${(hx - hr).toFixed(2)} ${hy} a ${hr} ${hr} 0 1 0 ${(hr * 2).toFixed(2)} 0 a ${hr} ${hr} 0 1 0 -${(hr * 2).toFixed(2)} 0 Z`,
      layer: 'cut',
    });
  }

  return {
    viewBoxWidth: targetW,
    viewBoxHeight: targetH,
    primitives,
  };
}

function parseLengthMm(raw: string | null): number | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const m = /^([0-9.]+)\s*(mm|cm|in|px|pt)?$/i.exec(trimmed);
  if (!m) return null;
  const val = parseFloat(m[1]);
  if (Number.isNaN(val)) return null;
  const unit = (m[2] ?? 'px').toLowerCase();
  if (unit === 'mm') return val;
  if (unit === 'cm') return val * 10;
  if (unit === 'in') return val * 25.4;
  if (unit === 'pt') return (val * 25.4) / 72;
  // Standard 96 DPI SVG px -> mm
  return (val * 25.4) / 96;
}

function classifyLayerByStyle(el: Element): LaserLayerType {
  const stroke = (el.getAttribute('stroke') || '').toLowerCase();
  const fill = (el.getAttribute('fill') || '').toLowerCase();
  const style = (el.getAttribute('style') || '').toLowerCase();

  if (
    stroke.includes('red') ||
    stroke.includes('#f00') ||
    stroke.includes('#ff0000') ||
    stroke.includes('#ef4444') ||
    style.includes('stroke:#ff0000') ||
    style.includes('stroke:red')
  ) {
    return 'cut';
  }
  if (
    stroke.includes('blue') ||
    stroke.includes('#00f') ||
    stroke.includes('#0000ff') ||
    stroke.includes('#06b6d4') ||
    style.includes('stroke:#0000ff') ||
    style.includes('stroke:blue')
  ) {
    return 'score';
  }
  if (fill && fill !== 'none' && fill !== 'transparent') {
    return 'engrave';
  }
  return 'cut';
}

export function parseUploadedSvg(svgText: string): {
  viewBoxWidth: number;
  viewBoxHeight: number;
  widthMm: number;
  heightMm: number;
  primitives: VectorPrimitive[];
} {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, 'image/svg+xml');
  const svg = doc.querySelector('svg');
  if (!svg) {
    throw new Error('Uploaded file does not contain a valid <svg> root element.');
  }

  let vbX = 0;
  let vbY = 0;
  let vbW = 100;
  let vbH = 100;

  const viewBoxAttr = svg.getAttribute('viewBox');
  if (viewBoxAttr) {
    const nums = viewBoxAttr
      .trim()
      .split(/[\s,]+/)
      .map(Number)
      .filter((n) => !Number.isNaN(n));
    if (nums.length === 4 && nums[2] > 0 && nums[3] > 0) {
      [vbX, vbY, vbW, vbH] = nums;
    }
  } else {
    const rawW = parseFloat(svg.getAttribute('width') || '100');
    const rawH = parseFloat(svg.getAttribute('height') || '100');
    if (rawW > 0 && rawH > 0) {
      vbW = rawW;
      vbH = rawH;
    }
  }

  const widthMmAttr = parseLengthMm(svg.getAttribute('width'));
  const heightMmAttr = parseLengthMm(svg.getAttribute('height'));
  let widthMm = widthMmAttr ?? 100;
  let heightMm = heightMmAttr ?? (widthMm * vbH) / vbW;

  // Clamp reasonable initial import size inside 400x400 bed
  if (widthMm > 360 || heightMm > 360) {
    const fit = 160 / Math.max(widthMm, heightMm);
    widthMm = Number((widthMm * fit).toFixed(1));
    heightMm = Number((heightMm * fit).toFixed(1));
  }

  const primitives: VectorPrimitive[] = [];
  let count = 0;

  const shapeEls = svg.querySelectorAll('path, rect, circle, ellipse, polygon, polyline, line');
  shapeEls.forEach((el) => {
    const tag = el.tagName.toLowerCase();
    let d = '';
    if (tag === 'path') {
      d = el.getAttribute('d') || '';
    } else if (tag === 'rect') {
      const x = parseFloat(el.getAttribute('x') || '0') - vbX;
      const y = parseFloat(el.getAttribute('y') || '0') - vbY;
      const w = parseFloat(el.getAttribute('width') || '0');
      const h = parseFloat(el.getAttribute('height') || '0');
      const rx = parseFloat(el.getAttribute('rx') || '0');
      if (w > 0 && h > 0) {
        if (rx > 0) {
          d = `M ${x + rx} ${y} L ${x + w - rx} ${y} Q ${x + w} ${y} ${x + w} ${y + rx} L ${x + w} ${y + h - rx} Q ${x + w} ${y + h} ${x + w - rx} ${y + h} L ${x + rx} ${y + h} Q ${x} ${y + h} ${x} ${y + h - rx} L ${x} ${y + rx} Q ${x} ${y} ${x + rx} ${y} Z`;
        } else {
          d = `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z`;
        }
      }
    } else if (tag === 'circle') {
      const cx = parseFloat(el.getAttribute('cx') || '0') - vbX;
      const cy = parseFloat(el.getAttribute('cy') || '0') - vbY;
      const r = parseFloat(el.getAttribute('r') || '0');
      if (r > 0) {
        d = `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 -${2 * r} 0 Z`;
      }
    } else if (tag === 'ellipse') {
      const cx = parseFloat(el.getAttribute('cx') || '0') - vbX;
      const cy = parseFloat(el.getAttribute('cy') || '0') - vbY;
      const rx = parseFloat(el.getAttribute('rx') || '0');
      const ry = parseFloat(el.getAttribute('ry') || '0');
      if (rx > 0 && ry > 0) {
        d = `M ${cx - rx} ${cy} a ${rx} ${ry} 0 1 0 ${2 * rx} 0 a ${rx} ${ry} 0 1 0 -${2 * rx} 0 Z`;
      }
    } else if (tag === 'polygon' || tag === 'polyline') {
      const pts = (el.getAttribute('points') || '')
        .trim()
        .split(/[\s,]+/)
        .map(Number)
        .filter((n) => !Number.isNaN(n));
      const cmds: string[] = [];
      for (let i = 0; i + 1 < pts.length; i += 2) {
        cmds.push(`${i === 0 ? 'M' : 'L'} ${pts[i] - vbX} ${pts[i + 1] - vbY}`);
      }
      if (tag === 'polygon' && cmds.length > 0) cmds.push('Z');
      d = cmds.join(' ');
    } else if (tag === 'line') {
      const x1 = parseFloat(el.getAttribute('x1') || '0') - vbX;
      const y1 = parseFloat(el.getAttribute('y1') || '0') - vbY;
      const x2 = parseFloat(el.getAttribute('x2') || '0') - vbX;
      const y2 = parseFloat(el.getAttribute('y2') || '0') - vbY;
      d = `M ${x1} ${y1} L ${x2} ${y2}`;
    }

    if (d.trim()) {
      count++;
      primitives.push({
        id: `svg-shape-${count}`,
        d: d.trim(),
        layer: classifyLayerByStyle(el),
      });
    }
  });

  if (primitives.length === 0) {
    throw new Error('No supported vector shapes (<path>, <rect>, <circle>, <polygon>) found in SVG.');
  }

  return {
    viewBoxWidth: vbW,
    viewBoxHeight: vbH,
    widthMm: Math.max(10, Number(widthMm.toFixed(1))),
    heightMm: Math.max(10, Number(heightMm.toFixed(1))),
    primitives,
  };
}
