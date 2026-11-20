import React, { useMemo, useState } from 'react';
import { Grid, Layers } from 'lucide-react';
import { TextElement } from '../types/laser';
import { buildBatchNameTags, NameTagShape } from '../utils/elementFactory';

interface NameTagBatchDrawerProps {
  onApplyBatch: (elements: ReturnType<typeof buildBatchNameTags>['elements'], replaceBed: boolean) => void;
}

const SAMPLE_LISTS: Array<{ label: string; subtitle: string; names: string }> = [
  {
    label: 'Wedding Guests',
    subtitle: 'TABLE 04 · JUNE 14',
    names: 'Elena Rostova\nLucas Vance\nMaya Lin\nDaniel Brooks\nSofia Alvarez\nNoah Bennett\nClara Sterling\nLiam O’Connor',
  },
  {
    label: 'Christmas Gifts',
    subtitle: 'MERRY CHRISTMAS',
    names: 'Mom & Dad\nGrandma Rose\nUncle David\nSarah\nOliver\nAunt Claire',
  },
  {
    label: 'Easter Baskets',
    subtitle: 'EASTER 2026',
    names: 'Charlotte\nEthan\nAmelia\nMason\nHarper\nBenjamin',
  },
];

export const NameTagBatchDrawer: React.FC<NameTagBatchDrawerProps> = ({
  onApplyBatch,
}) => {
  const [namesText, setNamesText] = useState(SAMPLE_LISTS[0].names);
  const [subtitle, setSubtitle] = useState(SAMPLE_LISTS[0].subtitle);
  const [shape, setShape] = useState<NameTagShape>('rounded');
  const [tagWidthMm, setTagWidthMm] = useState(82);
  const [tagHeightMm, setTagHeightMm] = useState(34);
  const [spacingMm, setSpacingMm] = useState(5);
  const [hasHole, setHasHole] = useState(true);
  const [fontFamily, setFontFamily] =
    useState<TextElement['fontFamily']>('Plus Jakarta Sans');

  const namesList = useMemo(
    () =>
      namesText
        .split('\n')
        .map((n) => n.trim())
        .filter(Boolean),
    [namesText]
  );

  const sheetPreview = useMemo(() => {
    const usableW = 376;
    const usableH = 376;
    const cols = Math.max(
      1,
      Math.floor((usableW + spacingMm) / (tagWidthMm + spacingMm))
    );
    const rows = Math.max(
      1,
      Math.floor((usableH + spacingMm) / (tagHeightMm + spacingMm))
    );
    const capacity = cols * rows;
    return {
      cols,
      rows,
      capacity,
      fitsAll: namesList.length <= capacity,
      placed: Math.min(namesList.length, capacity),
    };
  }, [namesList.length, spacingMm, tagHeightMm, tagWidthMm]);

  const handleGenerate = (replaceBed: boolean) => {
    const result = buildBatchNameTags({
      names: namesList,
      subtitle,
      shape,
      tagWidthMm: Math.max(25, Math.min(200, tagWidthMm)),
      tagHeightMm: Math.max(16, Math.min(120, tagHeightMm)),
      spacingMm: Math.max(2, Math.min(25, spacingMm)),
      hasHole,
      fontFamily,
    });
    onApplyBatch(result.elements, replaceBed);
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4 space-y-4">
      <div>
        <h2 className="text-xs font-semibold text-[#F1F5F9]">
          Batch Name Tag Auto-Nester
        </h2>
        <p className="mt-1 text-[11px] leading-relaxed text-[#94A3B8]">
          Enter one name per line to automatically tile cut-ready tags across the
          400 × 400 mm AtomStack X20 Pro bed.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {SAMPLE_LISTS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => {
              setNamesText(preset.names);
              setSubtitle(preset.subtitle);
            }}
            className="rounded border border-[#232A3B] bg-[#0D1018] px-2 py-1 text-[11px] font-medium text-[#CBD5E1] transition-colors hover:border-[#334155] hover:text-white"
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between text-[11px]">
          <label className="font-medium text-[#94A3B8]">Names List</label>
          <span className="font-mono text-[#CBD5E1] tabular-nums">
            {namesList.length} tags
          </span>
        </div>
        <textarea
          rows={5}
          value={namesText}
          onChange={(e) => setNamesText(e.target.value)}
          placeholder="Enter one name per line..."
          className="w-full rounded-md border border-[#232A3B] bg-[#0D1018] p-2.5 text-xs text-[#F1F5F9] placeholder-[#64748B] focus:border-[#EF4444] focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-1 block text-[11px] font-medium text-[#94A3B8]">
          Shared Subtitle (optional)
        </label>
        <input
          type="text"
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          placeholder="e.g., VIP GUEST, ROOM 204, 2026"
          className="w-full rounded border border-[#232A3B] bg-[#0D1018] px-2.5 py-1.5 text-xs text-[#F1F5F9] focus:border-[#EF4444] focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label className="mb-1 block text-[11px] font-medium text-[#94A3B8]">
            Tag Shape
          </label>
          <select
            value={shape}
            onChange={(e) => setShape(e.target.value as NameTagShape)}
            className="w-full rounded border border-[#232A3B] bg-[#0D1018] px-2 py-1.5 text-xs text-[#F1F5F9] focus:border-[#EF4444] focus:outline-none"
          >
            <option value="rounded">Rounded Rect</option>
            <option value="pill">Pill Capsule</option>
            <option value="hex">Hexagon Badge</option>
            <option value="ribbon">Ribbon Gift Tag</option>
            <option value="bone">Pet Bone Tag</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-medium text-[#94A3B8]">
            Typography
          </label>
          <select
            value={fontFamily}
            onChange={(e) =>
              setFontFamily(e.target.value as TextElement['fontFamily'])
            }
            className="w-full rounded border border-[#232A3B] bg-[#0D1018] px-2 py-1.5 text-xs text-[#F1F5F9] focus:border-[#EF4444] focus:outline-none"
          >
            <option value="Plus Jakarta Sans">Clean Sans</option>
            <option value="Georgia">Classic Serif</option>
            <option value="JetBrains Mono">Technical Mono</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="mb-1 block text-[11px] font-medium text-[#94A3B8]">
            Width (mm)
          </label>
          <input
            type="number"
            min={25}
            max={200}
            value={tagWidthMm}
            onChange={(e) => setTagWidthMm(Number(e.target.value) || 60)}
            className="w-full rounded border border-[#232A3B] bg-[#0D1018] px-2 py-1.5 font-mono text-xs text-[#F1F5F9] tabular-nums focus:border-[#EF4444] focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium text-[#94A3B8]">
            Height (mm)
          </label>
          <input
            type="number"
            min={16}
            max={120}
            value={tagHeightMm}
            onChange={(e) => setTagHeightMm(Number(e.target.value) || 30)}
            className="w-full rounded border border-[#232A3B] bg-[#0D1018] px-2 py-1.5 font-mono text-xs text-[#F1F5F9] tabular-nums focus:border-[#EF4444] focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium text-[#94A3B8]">
            Gap (mm)
          </label>
          <input
            type="number"
            min={2}
            max={25}
            value={spacingMm}
            onChange={(e) => setSpacingMm(Number(e.target.value) || 4)}
            className="w-full rounded border border-[#232A3B] bg-[#0D1018] px-2 py-1.5 font-mono text-xs text-[#F1F5F9] tabular-nums focus:border-[#EF4444] focus:outline-none"
          />
        </div>
      </div>

      <label className="flex cursor-pointer items-center justify-between rounded border border-[#232A3B] bg-[#0D1018] px-2.5 py-2 text-xs text-[#E2E8F0]">
        <span>Cut keyring / ribbon hole on each tag</span>
        <input
          type="checkbox"
          checked={hasHole}
          onChange={(e) => setHasHole(e.target.checked)}
          className="h-3.5 w-3.5 accent-[#EF4444]"
        />
      </label>

      <div className="rounded-md border border-[#232A3B] bg-[#0D1018] p-3 text-xs space-y-1">
        <div className="flex items-center justify-between text-[#CBD5E1]">
          <span>Bed Grid Capacity</span>
          <span className="font-mono tabular-nums">
            {sheetPreview.cols} × {sheetPreview.rows} ({sheetPreview.capacity} max)
          </span>
        </div>
        {!sheetPreview.fitsAll && (
          <p className="text-[11px] text-[#F59E0B]">
            {namesList.length - sheetPreview.capacity} tags exceed one 400×400mm
            sheet and will be omitted from this sheet.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={namesList.length === 0}
          onClick={() => handleGenerate(false)}
          className="flex items-center justify-center gap-1.5 rounded-md border border-[#334155] bg-[#181F2E] px-3 py-2 text-xs font-medium text-[#F1F5F9] whitespace-nowrap transition-colors hover:bg-[#232C40] disabled:opacity-40"
        >
          <Layers className="h-3.5 w-3.5" />
          Add Batch
        </button>
        <button
          type="button"
          disabled={namesList.length === 0}
          onClick={() => handleGenerate(true)}
          className="flex items-center justify-center gap-1.5 rounded-md bg-[#EF4444] px-3 py-2 text-xs font-semibold text-white whitespace-nowrap transition-colors hover:bg-[#DC2626] disabled:opacity-40"
        >
          <Grid className="h-3.5 w-3.5" />
          Fill 400×400 Bed
        </button>
      </div>
    </div>
  );
};
