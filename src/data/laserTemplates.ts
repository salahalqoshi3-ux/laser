import { TemplateDefinition, VectorPrimitive } from '../types/laser';

function circlePath(cx: number, cy: number, r: number): string {
  const x0 = (cx - r).toFixed(2);
  const cyFixed = cy.toFixed(2);
  const rFixed = r.toFixed(2);
  const d = (2 * r).toFixed(2);
  return `M ${x0} ${cyFixed} a ${rFixed} ${rFixed} 0 1 0 ${d} 0 a ${rFixed} ${rFixed} 0 1 0 -${d} 0 Z`;
}

function roundedRectPath(x: number, y: number, w: number, h: number, r: number): string {
  const cr = Math.min(r, w / 2, h / 2);
  return [
    `M ${(x + cr).toFixed(2)} ${y.toFixed(2)}`,
    `L ${(x + w - cr).toFixed(2)} ${y.toFixed(2)}`,
    `Q ${(x + w).toFixed(2)} ${y.toFixed(2)} ${(x + w).toFixed(2)} ${(y + cr).toFixed(2)}`,
    `L ${(x + w).toFixed(2)} ${(y + h - cr).toFixed(2)}`,
    `Q ${(x + w).toFixed(2)} ${(y + h).toFixed(2)} ${(x + w - cr).toFixed(2)} ${(y + h).toFixed(2)}`,
    `L ${(x + cr).toFixed(2)} ${(y + h).toFixed(2)}`,
    `Q ${x.toFixed(2)} ${(y + h).toFixed(2)} ${x.toFixed(2)} ${(y + h - cr).toFixed(2)}`,
    `L ${x.toFixed(2)} ${(y + cr).toFixed(2)}`,
    `Q ${x.toFixed(2)} ${y.toFixed(2)} ${(x + cr).toFixed(2)} ${y.toFixed(2)} Z`,
  ].join(' ');
}

function heartPath(cx: number, cy: number, scale: number): string {
  // Normalized heart centered around (cx, cy) roughly spanning [-scale, scale]
  const s = scale;
  return [
    `M ${cx.toFixed(2)} ${(cy + 0.85 * s).toFixed(2)}`,
    `C ${(cx - 0.95 * s).toFixed(2)} ${(cy + 0.25 * s).toFixed(2)}, ${(cx - 1.05 * s).toFixed(2)} ${(cy - 0.45 * s).toFixed(2)}, ${(cx - 0.52 * s).toFixed(2)} ${(cy - 0.78 * s).toFixed(2)}`,
    `C ${(cx - 0.18 * s).toFixed(2)} ${(cy - 0.98 * s).toFixed(2)}, ${cx.toFixed(2)} ${(cy - 0.62 * s).toFixed(2)}, ${cx.toFixed(2)} ${(cy - 0.48 * s).toFixed(2)}`,
    `C ${cx.toFixed(2)} ${(cy - 0.62 * s).toFixed(2)}, ${(cx + 0.18 * s).toFixed(2)} ${(cy - 0.98 * s).toFixed(2)}, ${(cx + 0.52 * s).toFixed(2)} ${(cy - 0.78 * s).toFixed(2)}`,
    `C ${(cx + 1.05 * s).toFixed(2)} ${(cy - 0.45 * s).toFixed(2)}, ${(cx + 0.95 * s).toFixed(2)} ${(cy + 0.25 * s).toFixed(2)}, ${cx.toFixed(2)} ${(cy + 0.85 * s).toFixed(2)} Z`,
  ].join(' ');
}

function polygonPointsPath(points: Array<[number, number]>, close = true): string {
  if (points.length === 0) return '';
  const cmds = points.map(
    ([px, py], i) => `${i === 0 ? 'M' : 'L'} ${px.toFixed(2)} ${py.toFixed(2)}`
  );
  if (close) cmds.push('Z');
  return cmds.join(' ');
}

function starPath(cx: number, cy: number, outerR: number, innerR: number, points = 5): string {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (Math.PI / points) * i - Math.PI / 2;
    pts.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
  }
  return polygonPointsPath(pts, true);
}

export const LASER_TEMPLATES: TemplateDefinition[] = [
  // ================= NAME TAGS =================
  {
    id: 'nametag-rounded-keychain',
    title: 'Workshop Keychain Name Tag',
    category: 'nametags',
    subtitle: '80 × 32 mm · Rounded Cut + Inner Score',
    defaultWidthMm: 80,
    defaultHeightMm: 32,
    supportsPrimaryText: true,
    defaultPrimaryText: 'ALEXANDER',
    supportsSecondaryText: true,
    defaultSecondaryText: 'MAKER STUDIO',
    supportsHoleToggle: true,
    defaultHasHole: true,
    recommendedMaterialId: 'basswood-3mm',
    build: ({ primaryText, secondaryText, hasHole }) => {
      const primitives: VectorPrimitive[] = [
        { id: 'outer-cut', d: roundedRectPath(1, 1, 78, 30, 6), layer: 'cut' },
        { id: 'inner-score', d: roundedRectPath(3.5, 3.5, 73, 25, 4.2), layer: 'score' },
      ];
      if (hasHole) {
        primitives.push({ id: 'keyring-hole', d: circlePath(9, 16, 2.3), layer: 'cut' });
        primitives.push({ id: 'hole-accent', d: circlePath(9, 16, 4.0), layer: 'score' });
      }
      return {
        viewBoxWidth: 80,
        viewBoxHeight: 32,
        primitives,
        textOverlay: {
          text: primaryText || 'NAME',
          subText: secondaryText,
          relX: hasHole ? 0.56 : 0.5,
          relY: secondaryText ? 0.42 : 0.52,
          subRelY: 0.72,
          fontSizeRatio: 0.24,
          subFontSizeRatio: 0.13,
          fontFamily: 'Plus Jakarta Sans',
          fontWeight: 700,
          layer: 'engrave',
        },
      };
    },
  },
  {
    id: 'nametag-hex-badge',
    title: 'Hexagon Conference Badge',
    category: 'nametags',
    subtitle: '78 × 68 mm · Geometric Cut + Lanyard Slot',
    defaultWidthMm: 78,
    defaultHeightMm: 68,
    supportsPrimaryText: true,
    defaultPrimaryText: 'MAYA CHEN',
    supportsSecondaryText: true,
    defaultSecondaryText: 'LEAD ENGINEER',
    supportsHoleToggle: true,
    defaultHasHole: true,
    recommendedMaterialId: 'anodized-aluminum',
    build: ({ primaryText, secondaryText, hasHole }) => {
      const hex = (cx: number, cy: number, rx: number, ry: number) =>
        polygonPointsPath([
          [cx, cy - ry],
          [cx + rx, cy - ry * 0.5],
          [cx + rx, cy + ry * 0.5],
          [cx, cy + ry],
          [cx - rx, cy + ry * 0.5],
          [cx - rx, cy - ry * 0.5],
        ]);
      const primitives: VectorPrimitive[] = [
        { id: 'hex-cut', d: hex(39, 34, 37, 32), layer: 'cut' },
        { id: 'hex-score', d: hex(39, 34, 33.5, 29), layer: 'score' },
        { id: 'divider', d: 'M 14 40 L 64 40', layer: 'score' },
      ];
      if (hasHole) {
        primitives.push({ id: 'slot', d: roundedRectPath(32, 7.5, 14, 3.5, 1.75), layer: 'cut' });
      }
      return {
        viewBoxWidth: 78,
        viewBoxHeight: 68,
        primitives,
        textOverlay: {
          text: primaryText || 'NAME',
          subText: secondaryText,
          relX: 0.5,
          relY: 0.45,
          subRelY: 0.71,
          fontSizeRatio: 0.15,
          subFontSizeRatio: 0.09,
          fontFamily: 'Plus Jakarta Sans',
          fontWeight: 700,
          layer: 'engrave',
        },
      };
    },
  },
  {
    id: 'nametag-pet-bone',
    title: 'Pet Collar Bone Tag',
    category: 'nametags',
    subtitle: '68 × 38 mm · Bone Cutout + Collar Hole',
    defaultWidthMm: 68,
    defaultHeightMm: 38,
    supportsPrimaryText: true,
    defaultPrimaryText: 'MILO',
    supportsSecondaryText: true,
    defaultSecondaryText: '555-0194',
    supportsHoleToggle: true,
    defaultHasHole: true,
    recommendedMaterialId: 'leather-2mm',
    build: ({ primaryText, secondaryText, hasHole }) => {
      const boneD =
        'M 16 11 C 11 4, 2 6, 3 14 C 3.5 17, 6 19, 6 19 C 6 19, 3.5 21, 3 24 C 2 32, 11 34, 16 27 L 52 27 C 57 34, 66 32, 65 24 C 64.5 21, 62 19, 62 19 C 62 19, 64.5 17, 65 14 C 66 6, 57 4, 52 11 Z';
      const primitives: VectorPrimitive[] = [
        { id: 'bone-cut', d: boneD, layer: 'cut' },
        { id: 'bone-score', d: roundedRectPath(15, 13, 38, 12, 3), layer: 'score' },
      ];
      if (hasHole) {
        primitives.push({ id: 'collar-hole', d: circlePath(9.5, 19, 2.1), layer: 'cut' });
      }
      return {
        viewBoxWidth: 68,
        viewBoxHeight: 38,
        primitives,
        textOverlay: {
          text: primaryText || 'PET NAME',
          subText: secondaryText,
          relX: 0.51,
          relY: secondaryText ? 0.43 : 0.51,
          subRelY: 0.69,
          fontSizeRatio: 0.22,
          subFontSizeRatio: 0.12,
          fontFamily: 'Plus Jakarta Sans',
          fontWeight: 700,
          layer: 'engrave',
        },
      };
    },
  },
  {
    id: 'nametag-luggage-ribbon',
    title: 'Ribbon-End Gift & Luggage Tag',
    category: 'nametags',
    subtitle: '88 × 44 mm · Angled Cut + Botanical Flourish',
    defaultWidthMm: 88,
    defaultHeightMm: 44,
    supportsPrimaryText: true,
    defaultPrimaryText: 'SOPHIA',
    supportsSecondaryText: true,
    defaultSecondaryText: 'HANDMADE GIFT',
    supportsHoleToggle: true,
    defaultHasHole: true,
    recommendedMaterialId: 'cardboard-2mm',
    build: ({ primaryText, secondaryText, hasHole }) => {
      const tagCut =
        'M 14 2 L 82 2 Q 86 2 86 6 L 86 38 Q 86 42 82 42 L 14 42 L 2 26 Q 0.5 22 2 18 Z';
      const innerScore =
        'M 16 5.5 L 81 5.5 Q 82.5 5.5 82.5 7 L 82.5 37 Q 82.5 38.5 81 38.5 L 16 38.5 L 6.5 25.5 Q 5 22 6.5 18.5 Z';
      const primitives: VectorPrimitive[] = [
        { id: 'tag-cut', d: tagCut, layer: 'cut' },
        { id: 'tag-score', d: innerScore, layer: 'score' },
        {
          id: 'leaf-motif',
          d: 'M 72 13 C 76 11, 79 14, 77 18 C 74 17, 72 15, 72 13 Z M 72 31 C 76 33, 79 30, 77 26 C 74 27, 72 29, 72 31 Z',
          layer: 'engrave',
        },
      ];
      if (hasHole) {
        primitives.push({ id: 'ribbon-hole', d: circlePath(11.5, 22, 2.4), layer: 'cut' });
      }
      return {
        viewBoxWidth: 88,
        viewBoxHeight: 44,
        primitives,
        textOverlay: {
          text: primaryText || 'GIFT FOR',
          subText: secondaryText,
          relX: 0.52,
          relY: secondaryText ? 0.43 : 0.52,
          subRelY: 0.71,
          fontSizeRatio: 0.22,
          subFontSizeRatio: 0.11,
          fontFamily: 'Georgia',
          fontWeight: 700,
          layer: 'engrave',
        },
      };
    },
  },

  // ================= EVENTS =================
  {
    id: 'event-wedding-arch',
    title: 'Wedding Arch Place Card',
    category: 'events',
    subtitle: '96 × 64 mm · Arch Silhouette + Botanical Score',
    defaultWidthMm: 96,
    defaultHeightMm: 64,
    supportsPrimaryText: true,
    defaultPrimaryText: 'Elena & Lucas',
    supportsSecondaryText: true,
    defaultSecondaryText: 'TABLE FOUR · JUNE 14',
    supportsHoleToggle: false,
    recommendedMaterialId: 'acrylic-black-3mm',
    build: ({ primaryText, secondaryText }) => {
      const archOuter =
        'M 3 62 L 3 34 A 45 31 0 0 1 93 34 L 93 62 Z';
      const archInner =
        'M 7.5 58 L 7.5 34 A 40.5 26.5 0 0 1 88.5 34 L 88.5 58 Z';
      const botanicalSprig =
        'M 36 16 Q 48 12 60 16 M 42 14 C 40 10, 44 9, 45 13 M 54 14 C 56 10, 52 9, 51 13';
      return {
        viewBoxWidth: 96,
        viewBoxHeight: 64,
        primitives: [
          { id: 'arch-cut', d: archOuter, layer: 'cut' },
          { id: 'arch-score', d: archInner, layer: 'score' },
          { id: 'sprig', d: botanicalSprig, layer: 'score' },
        ],
        textOverlay: {
          text: primaryText || 'Guest Name',
          subText: secondaryText,
          relX: 0.5,
          relY: 0.53,
          subRelY: 0.75,
          fontSizeRatio: 0.16,
          subFontSizeRatio: 0.08,
          fontFamily: 'Georgia',
          fontWeight: 600,
          layer: 'engrave',
        },
      };
    },
  },
  {
    id: 'event-celebration-coaster',
    title: 'Event Crest Octagon Coaster',
    category: 'events',
    subtitle: '96 × 96 mm · Slate / Cork Ready',
    defaultWidthMm: 96,
    defaultHeightMm: 96,
    supportsPrimaryText: true,
    defaultPrimaryText: 'EST. 2026',
    supportsSecondaryText: true,
    defaultSecondaryText: 'CELEBRATION',
    supportsHoleToggle: false,
    recommendedMaterialId: 'slate-stone',
    build: ({ primaryText, secondaryText }) => {
      const oct = (cx: number, cy: number, r: number) => {
        const pts: Array<[number, number]> = [];
        for (let i = 0; i < 8; i++) {
          const a = (Math.PI / 4) * i + Math.PI / 8;
          pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
        }
        return polygonPointsPath(pts);
      };
      return {
        viewBoxWidth: 96,
        viewBoxHeight: 96,
        primitives: [
          { id: 'oct-cut', d: oct(48, 48, 46), layer: 'cut' },
          { id: 'oct-score-1', d: oct(48, 48, 42), layer: 'score' },
          { id: 'ring-score', d: circlePath(48, 48, 34), layer: 'score' },
          { id: 'top-star', d: starPath(48, 22, 5, 2.2, 5), layer: 'engrave' },
          { id: 'bottom-diamond', d: polygonPointsPath([[48, 70], [52, 74], [48, 78], [44, 74]]), layer: 'engrave' },
        ],
        textOverlay: {
          text: primaryText || 'EVENT',
          subText: secondaryText,
          relX: 0.5,
          relY: 0.48,
          subRelY: 0.63,
          fontSizeRatio: 0.12,
          subFontSizeRatio: 0.075,
          fontFamily: 'Plus Jakarta Sans',
          fontWeight: 700,
          layer: 'engrave',
        },
      };
    },
  },
  {
    id: 'event-milestone-shield',
    title: 'Milestone Award Crest Plaque',
    category: 'events',
    subtitle: '92 × 110 mm · Shield Cut + Star Engrave',
    defaultWidthMm: 92,
    defaultHeightMm: 110,
    supportsPrimaryText: true,
    defaultPrimaryText: 'FIRST PLACE',
    supportsSecondaryText: true,
    defaultSecondaryText: 'ANNUAL TOURNAMENT',
    supportsHoleToggle: true,
    defaultHasHole: false,
    recommendedMaterialId: 'plywood-5mm',
    build: ({ primaryText, secondaryText, hasHole }) => {
      const shieldCut =
        'M 8 10 Q 46 2 84 10 L 84 56 C 84 82, 62 98, 46 107 C 30 98, 8 82, 8 56 Z';
      const shieldScore =
        'M 13 15 Q 46 8 79 15 L 79 55 C 79 77, 60 91, 46 99 C 32 91, 13 77, 13 55 Z';
      const primitives: VectorPrimitive[] = [
        { id: 'shield-cut', d: shieldCut, layer: 'cut' },
        { id: 'shield-score', d: shieldScore, layer: 'score' },
        { id: 'crown-star', d: starPath(46, 30, 10, 4.5, 5), layer: 'engrave' },
        { id: 'ribbon-line', d: 'M 20 46 L 72 46', layer: 'score' },
      ];
      if (hasHole) {
        primitives.push({ id: 'hang-hole', d: circlePath(46, 13, 2.2), layer: 'cut' });
      }
      return {
        viewBoxWidth: 92,
        viewBoxHeight: 110,
        primitives,
        textOverlay: {
          text: primaryText || 'AWARD',
          subText: secondaryText,
          relX: 0.5,
          relY: 0.57,
          subRelY: 0.71,
          fontSizeRatio: 0.11,
          subFontSizeRatio: 0.065,
          fontFamily: 'Plus Jakarta Sans',
          fontWeight: 700,
          layer: 'engrave',
        },
      };
    },
  },

  // ================= VALENTINE'S DAY =================
  {
    id: 'valentine-floral-heart',
    title: 'Valentine Botanical Heart Ornament',
    category: 'valentine',
    subtitle: '96 × 92 mm · Heart Cutout + Floral Wreath',
    defaultWidthMm: 96,
    defaultHeightMm: 92,
    supportsPrimaryText: true,
    defaultPrimaryText: 'Be Mine',
    supportsSecondaryText: true,
    defaultSecondaryText: 'FEB 14 · FOREVER',
    supportsHoleToggle: true,
    defaultHasHole: true,
    recommendedMaterialId: 'basswood-3mm',
    build: ({ primaryText, secondaryText, hasHole }) => {
      const primitives: VectorPrimitive[] = [
        { id: 'heart-cut', d: heartPath(48, 48, 44), layer: 'cut' },
        { id: 'heart-score', d: heartPath(48, 48, 38), layer: 'score' },
        {
          id: 'left-leaf-1',
          d: 'M 22 44 C 15 38, 16 29, 23 33 C 27 36, 26 42, 22 44 Z',
          layer: 'engrave',
        },
        {
          id: 'left-leaf-2',
          d: 'M 28 56 C 20 55, 19 47, 26 48 C 30 49, 31 54, 28 56 Z',
          layer: 'engrave',
        },
        {
          id: 'right-leaf-1',
          d: 'M 74 44 C 81 38, 80 29, 73 33 C 69 36, 70 42, 74 44 Z',
          layer: 'engrave',
        },
        {
          id: 'right-leaf-2',
          d: 'M 68 56 C 76 55, 77 47, 70 48 C 66 49, 65 54, 68 56 Z',
          layer: 'engrave',
        },
        { id: 'mini-heart', d: heartPath(48, 72, 6), layer: 'engrave' },
      ];
      if (hasHole) {
        primitives.push({ id: 'hang-hole', d: circlePath(48, 25, 2.3), layer: 'cut' });
      }
      return {
        viewBoxWidth: 96,
        viewBoxHeight: 92,
        primitives,
        textOverlay: {
          text: primaryText || 'Love You',
          subText: secondaryText,
          relX: 0.5,
          relY: 0.45,
          subRelY: 0.60,
          fontSizeRatio: 0.145,
          subFontSizeRatio: 0.072,
          fontFamily: 'Georgia',
          fontWeight: 700,
          layer: 'engrave',
        },
      };
    },
  },
  {
    id: 'valentine-double-heart-keychain',
    title: 'Double Heart Keychain Tag',
    category: 'valentine',
    subtitle: '78 × 54 mm · Interlocking Hearts + Keyring Hole',
    defaultWidthMm: 78,
    defaultHeightMm: 54,
    supportsPrimaryText: true,
    defaultPrimaryText: 'J + M',
    supportsSecondaryText: true,
    defaultSecondaryText: 'ALWAYS',
    supportsHoleToggle: true,
    defaultHasHole: true,
    recommendedMaterialId: 'acrylic-black-3mm',
    build: ({ primaryText, secondaryText, hasHole }) => {
      const outerRibbon = roundedRectPath(4, 6, 70, 42, 21);
      const primitives: VectorPrimitive[] = [
        { id: 'outer-cut', d: outerRibbon, layer: 'cut' },
        { id: 'inner-score', d: roundedRectPath(7, 9, 64, 36, 18), layer: 'score' },
        { id: 'left-heart', d: heartPath(21, 27, 10), layer: 'engrave' },
        { id: 'right-heart', d: heartPath(57, 27, 10), layer: 'score' },
      ];
      if (hasHole) {
        primitives.push({ id: 'keyring-hole', d: circlePath(10.5, 27, 2.2), layer: 'cut' });
      }
      return {
        viewBoxWidth: 78,
        viewBoxHeight: 54,
        primitives,
        textOverlay: {
          text: primaryText || 'A + B',
          subText: secondaryText,
          relX: 0.5,
          relY: 0.44,
          subRelY: 0.66,
          fontSizeRatio: 0.2,
          subFontSizeRatio: 0.1,
          fontFamily: 'Georgia',
          fontWeight: 700,
          layer: 'engrave',
        },
      };
    },
  },
  {
    id: 'valentine-love-letter-coaster',
    title: 'Love Letter Wax-Seal Coaster',
    category: 'valentine',
    subtitle: '94 × 94 mm · Envelope Score + Heart Seal',
    defaultWidthMm: 94,
    defaultHeightMm: 94,
    supportsPrimaryText: true,
    defaultPrimaryText: 'XOXO',
    supportsSecondaryText: true,
    defaultSecondaryText: 'WITH ALL MY LOVE',
    supportsHoleToggle: false,
    recommendedMaterialId: 'cork-3mm',
    build: ({ primaryText, secondaryText }) => {
      const primitives: VectorPrimitive[] = [
        { id: 'coaster-cut', d: roundedRectPath(2, 2, 90, 90, 10), layer: 'cut' },
        { id: 'inner-frame', d: roundedRectPath(7, 7, 80, 80, 6), layer: 'score' },
        { id: 'envelope-flap', d: 'M 7 20 L 47 50 L 87 20', layer: 'score' },
        { id: 'envelope-bottom', d: 'M 7 78 L 35 50 M 87 78 L 59 50', layer: 'score' },
        { id: 'wax-seal-ring', d: circlePath(47, 50, 11), layer: 'score' },
        { id: 'wax-seal-heart', d: heartPath(47, 50, 7.5), layer: 'engrave' },
      ];
      return {
        viewBoxWidth: 94,
        viewBoxHeight: 94,
        primitives,
        textOverlay: {
          text: primaryText || 'XOXO',
          subText: secondaryText,
          relX: 0.5,
          relY: 0.23,
          subRelY: 0.79,
          fontSizeRatio: 0.13,
          subFontSizeRatio: 0.065,
          fontFamily: 'Georgia',
          fontWeight: 700,
          layer: 'engrave',
        },
      };
    },
  },

  // ================= CHRISTMAS EVENTS =================
  {
    id: 'christmas-snowflake-bauble',
    title: 'Nordic Snowflake Bauble Ornament',
    category: 'christmas',
    subtitle: '92 × 106 mm · Bauble Cut + 6-Point Snowflake',
    defaultWidthMm: 92,
    defaultHeightMm: 106,
    supportsPrimaryText: true,
    defaultPrimaryText: '2026',
    supportsSecondaryText: true,
    defaultSecondaryText: 'MERRY CHRISTMAS',
    supportsHoleToggle: true,
    defaultHasHole: true,
    recommendedMaterialId: 'basswood-3mm',
    build: ({ primaryText, secondaryText, hasHole }) => {
      const baubleCut =
        'M 36 16 L 36 8 Q 36 4 40 4 L 52 4 Q 56 4 56 8 L 56 16 A 42 42 0 1 1 36 16 Z';
      // 6-point geometric snowflake centered at (46, 54)
      const cx = 46;
      const cy = 54;
      const spokes: string[] = [];
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i;
        const cos = Math.cos(a);
        const sin = Math.sin(a);
        const px = -sin;
        const py = cos;
        const x2 = cx + 22 * cos;
        const y2 = cy + 22 * sin;
        spokes.push(`M ${cx} ${cy} L ${x2.toFixed(2)} ${y2.toFixed(2)}`);
        // Branch pair
        const b1x = cx + 13 * cos;
        const b1y = cy + 13 * sin;
        spokes.push(
          `M ${(b1x + 5 * px + 4 * cos).toFixed(2)} ${(b1y + 5 * py + 4 * sin).toFixed(2)} L ${b1x.toFixed(2)} ${b1y.toFixed(2)} L ${(b1x - 5 * px + 4 * cos).toFixed(2)} ${(b1y - 5 * py + 4 * sin).toFixed(2)}`
        );
      }
      const primitives: VectorPrimitive[] = [
        { id: 'bauble-cut', d: baubleCut, layer: 'cut' },
        { id: 'bauble-ring', d: circlePath(46, 56, 37), layer: 'score' },
        { id: 'snowflake-lines', d: spokes.join(' '), layer: 'score' },
        { id: 'snowflake-core', d: starPath(46, 54, 7.5, 3.8, 6), layer: 'engrave' },
      ];
      if (hasHole) {
        primitives.push({ id: 'cap-hole', d: circlePath(46, 10, 2.3), layer: 'cut' });
      }
      return {
        viewBoxWidth: 92,
        viewBoxHeight: 106,
        primitives,
        textOverlay: {
          text: primaryText || '2026',
          subText: secondaryText,
          relX: 0.5,
          relY: 0.81,
          subRelY: 0.90,
          fontSizeRatio: 0.11,
          subFontSizeRatio: 0.055,
          fontFamily: 'Plus Jakarta Sans',
          fontWeight: 700,
          layer: 'engrave',
        },
      };
    },
  },
  {
    id: 'christmas-pine-gift-tag',
    title: 'Layered Pine Tree Gift Tag',
    category: 'christmas',
    subtitle: '78 × 106 mm · Tiered Tree Cut + Top Star',
    defaultWidthMm: 78,
    defaultHeightMm: 106,
    supportsPrimaryText: true,
    defaultPrimaryText: 'THE MILLERS',
    supportsSecondaryText: true,
    defaultSecondaryText: 'HAPPY HOLIDAYS',
    supportsHoleToggle: true,
    defaultHasHole: true,
    recommendedMaterialId: 'plywood-5mm',
    build: ({ primaryText, secondaryText, hasHole }) => {
      const treeCut =
        'M 39 4 L 54 30 L 45 30 L 63 55 L 52 55 L 72 82 L 46 82 L 46 98 L 32 98 L 32 82 L 6 82 L 26 55 L 15 55 L 33 30 L 24 30 Z';
      const innerGarland =
        'M 28 34 Q 39 40 50 34 M 20 59 Q 39 67 58 59 M 14 78 L 64 78';
      const primitives: VectorPrimitive[] = [
        { id: 'tree-cut', d: treeCut, layer: 'cut' },
        { id: 'garland-score', d: innerGarland, layer: 'score' },
        { id: 'top-star', d: starPath(39, 17, 6, 2.6, 5), layer: 'engrave' },
        { id: 'ornament-1', d: circlePath(32, 46, 2.6), layer: 'engrave' },
        { id: 'ornament-2', d: circlePath(47, 48, 2.6), layer: 'engrave' },
      ];
      if (hasHole) {
        primitives.push({ id: 'hang-hole', d: circlePath(39, 9.5, 2.0), layer: 'cut' });
      }
      return {
        viewBoxWidth: 78,
        viewBoxHeight: 106,
        primitives,
        textOverlay: {
          text: primaryText || 'FAMILY',
          subText: secondaryText,
          relX: 0.5,
          relY: 0.66,
          subRelY: 0.74,
          fontSizeRatio: 0.085,
          subFontSizeRatio: 0.055,
          fontFamily: 'Plus Jakarta Sans',
          fontWeight: 700,
          layer: 'engrave',
        },
      };
    },
  },
  {
    id: 'christmas-reindeer-crest',
    title: 'Christmas Wreath & Star Crest',
    category: 'christmas',
    subtitle: '98 × 98 mm · Wreath Cut + Holiday Greeting',
    defaultWidthMm: 98,
    defaultHeightMm: 98,
    supportsPrimaryText: true,
    defaultPrimaryText: 'NOEL',
    supportsSecondaryText: true,
    defaultSecondaryText: 'DEC 25 · WINTER EVE',
    supportsHoleToggle: true,
    defaultHasHole: true,
    recommendedMaterialId: 'basswood-3mm',
    build: ({ primaryText, secondaryText, hasHole }) => {
      const hollyLeaves: string[] = [];
      for (let i = 0; i < 12; i++) {
        const a = (Math.PI / 6) * i;
        const cx = 49 + 38 * Math.cos(a);
        const cy = 49 + 38 * Math.sin(a);
        const dx = Math.cos(a + 0.5) * 6;
        const dy = Math.sin(a + 0.5) * 6;
        hollyLeaves.push(
          `M ${(cx - dx).toFixed(2)} ${(cy - dy).toFixed(2)} Q ${(cx + Math.cos(a) * 5).toFixed(2)} ${(cy + Math.sin(a) * 5).toFixed(2)} ${(cx + dx).toFixed(2)} ${(cy + dy).toFixed(2)} Q ${(cx - Math.cos(a) * 3).toFixed(2)} ${(cy - Math.sin(a) * 3).toFixed(2)} ${(cx - dx).toFixed(2)} ${(cy - dy).toFixed(2)} Z`
        );
      }
      const primitives: VectorPrimitive[] = [
        { id: 'wreath-outer', d: circlePath(49, 49, 47), layer: 'cut' },
        { id: 'wreath-inner-score', d: circlePath(49, 49, 32), layer: 'score' },
        { id: 'holly-ring', d: hollyLeaves.join(' '), layer: 'engrave' },
        { id: 'north-star', d: starPath(49, 28, 7, 2.2, 4), layer: 'engrave' },
      ];
      if (hasHole) {
        primitives.push({ id: 'hang-hole', d: circlePath(49, 9, 2.2), layer: 'cut' });
      }
      return {
        viewBoxWidth: 98,
        viewBoxHeight: 98,
        primitives,
        textOverlay: {
          text: primaryText || 'NOEL',
          subText: secondaryText,
          relX: 0.5,
          relY: 0.51,
          subRelY: 0.64,
          fontSizeRatio: 0.15,
          subFontSizeRatio: 0.068,
          fontFamily: 'Georgia',
          fontWeight: 700,
          layer: 'engrave',
        },
      };
    },
  },

  // ================= EASTER SPECIAL =================
  {
    id: 'easter-floral-egg',
    title: 'Floral Easter Egg Ornament',
    category: 'easter',
    subtitle: '78 × 102 mm · Egg Cutout + Chevron & Petal Bands',
    defaultWidthMm: 78,
    defaultHeightMm: 102,
    supportsPrimaryText: true,
    defaultPrimaryText: 'Happy Easter',
    supportsSecondaryText: true,
    defaultSecondaryText: 'SPRING 2026',
    supportsHoleToggle: true,
    defaultHasHole: true,
    recommendedMaterialId: 'basswood-3mm',
    build: ({ primaryText, secondaryText, hasHole }) => {
      const eggCut =
        'M 39 4 C 58 4, 74 36, 74 62 C 74 84, 59 98, 39 98 C 19 98, 4 84, 4 62 C 4 36, 20 4, 39 4 Z';
      const chevronBand =
        'M 9 42 L 19 34 L 29 42 L 39 34 L 49 42 L 59 34 L 69 42 M 7 74 L 18 82 L 29 74 L 39 82 L 49 74 L 60 82 L 71 74';
      const dotRow =
        [18, 28.5, 39, 49.5, 60].map((cx) => circlePath(cx, 25, 2.1)).join(' ') +
        ' ' +
        [20, 32.5, 45.5, 58].map((cx) => circlePath(cx, 87, 2.0)).join(' ');
      const primitives: VectorPrimitive[] = [
        { id: 'egg-cut', d: eggCut, layer: 'cut' },
        { id: 'chevron-score', d: chevronBand, layer: 'score' },
        { id: 'band-top', d: 'M 7 46 L 71 46', layer: 'score' },
        { id: 'band-bottom', d: 'M 6 69 L 72 69', layer: 'score' },
        { id: 'egg-dots', d: dotRow, layer: 'engrave' },
      ];
      if (hasHole) {
        primitives.push({ id: 'hang-hole', d: circlePath(39, 12, 2.2), layer: 'cut' });
      }
      return {
        viewBoxWidth: 78,
        viewBoxHeight: 102,
        primitives,
        textOverlay: {
          text: primaryText || 'Happy Easter',
          subText: secondaryText,
          relX: 0.5,
          relY: 0.55,
          subRelY: 0.64,
          fontSizeRatio: 0.11,
          subFontSizeRatio: 0.06,
          fontFamily: 'Georgia',
          fontWeight: 700,
          layer: 'engrave',
        },
      };
    },
  },
  {
    id: 'easter-bunny-nametag',
    title: 'Bunny Ear Basket Name Tag',
    category: 'easter',
    subtitle: '76 × 106 mm · Rabbit Silhouette + Inner Ear Score',
    defaultWidthMm: 76,
    defaultHeightMm: 106,
    supportsPrimaryText: true,
    defaultPrimaryText: 'OLIVIA',
    supportsSecondaryText: true,
    defaultSecondaryText: 'EASTER BASKET',
    supportsHoleToggle: true,
    defaultHasHole: true,
    recommendedMaterialId: 'basswood-3mm',
    build: ({ primaryText, secondaryText, hasHole }) => {
      const bunnyHeadCut =
        'M 23 48 C 14 28, 15 6, 25 5 C 33 4, 36 22, 35 41 Q 38 40 41 41 C 40 22, 43 4, 51 5 C 61 6, 62 28, 53 48 C 65 54, 70 67, 68 80 C 66 94, 54 102, 38 102 C 22 102, 10 94, 8 80 C 6 67, 11 54, 23 48 Z';
      const innerEarL =
        'M 25 40 C 20 26, 21 13, 25.5 13 C 30 13, 31 26, 30 40 Z';
      const innerEarR =
        'M 46 40 C 45 26, 46 13, 50.5 13 C 55 13, 56 26, 51 40 Z';
      const noseAndWhiskers =
        'M 35 58 L 41 58 L 38 62 Z M 18 60 L 29 61 M 17 65 L 29 64 M 58 60 L 47 61 M 59 65 L 47 64';
      const primitives: VectorPrimitive[] = [
        { id: 'bunny-cut', d: bunnyHeadCut, layer: 'cut' },
        { id: 'ear-l-score', d: innerEarL, layer: 'score' },
        { id: 'ear-r-score', d: innerEarR, layer: 'score' },
        { id: 'face-score', d: noseAndWhiskers, layer: 'score' },
      ];
      if (hasHole) {
        primitives.push({ id: 'tag-hole', d: circlePath(38, 49, 2.2), layer: 'cut' });
      }
      return {
        viewBoxWidth: 76,
        viewBoxHeight: 106,
        primitives,
        textOverlay: {
          text: primaryText || 'NAME',
          subText: secondaryText,
          relX: 0.5,
          relY: 0.75,
          subRelY: 0.85,
          fontSizeRatio: 0.12,
          subFontSizeRatio: 0.06,
          fontFamily: 'Plus Jakarta Sans',
          fontWeight: 700,
          layer: 'engrave',
        },
      };
    },
  },
  {
    id: 'easter-spring-tulip-coaster',
    title: 'Spring Tulip & Egg Coaster',
    category: 'easter',
    subtitle: '94 × 94 mm · Circular Frame + Tulip Motif',
    defaultWidthMm: 94,
    defaultHeightMm: 94,
    supportsPrimaryText: true,
    defaultPrimaryText: 'SPRING BLOOM',
    supportsSecondaryText: true,
    defaultSecondaryText: 'EASTER BRUNCH',
    supportsHoleToggle: false,
    recommendedMaterialId: 'cork-3mm',
    build: ({ primaryText, secondaryText }) => {
      const tulip =
        'M 47 46 L 47 64 M 47 58 C 39 56, 36 49, 41 47 C 44 49, 46 54, 47 58 Z M 47 58 C 55 56, 58 49, 53 47 C 50 49, 48 54, 47 58 Z M 40 34 C 40 42, 43 46, 47 46 C 51 46, 54 42, 54 34 L 51 38 L 47 31 L 43 38 Z';
      const primitives: VectorPrimitive[] = [
        { id: 'coaster-cut', d: circlePath(47, 47, 45), layer: 'cut' },
        { id: 'coaster-score-1', d: circlePath(47, 47, 40.5), layer: 'score' },
        { id: 'coaster-score-2', d: circlePath(47, 47, 37.5), layer: 'score' },
        { id: 'tulip-engrave', d: tulip, layer: 'engrave' },
      ];
      return {
        viewBoxWidth: 94,
        viewBoxHeight: 94,
        primitives,
        textOverlay: {
          text: primaryText || 'SPRING',
          subText: secondaryText,
          relX: 0.5,
          relY: 0.25,
          subRelY: 0.77,
          fontSizeRatio: 0.1,
          subFontSizeRatio: 0.068,
          fontFamily: 'Georgia',
          fontWeight: 700,
          layer: 'engrave',
        },
      };
    },
  },
];
