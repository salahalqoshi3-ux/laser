import React, { useState } from 'react';
import { ImagePlus, Loader2, Wand2, X } from 'lucide-react';
import { LaserElement, TextElement, VectorElement } from '../types/laser';
import { estimateTextWidthMm, makeId } from '../utils/elementFactory';

interface AiGeneratorDrawerProps {
  onInsertGenerated: (elements: LaserElement[], replaceBed: boolean) => void;
}

const PROMPT_IDEAS: Array<{ label: string; prompt: string; archetype: string; theme: string }> = [
  {
    label: 'Valentine Floral Heart',
    prompt: 'Scalloped floral heart ornament with delicate rose petals and hanging loop',
    archetype: 'ornament',
    theme: 'valentine',
  },
  {
    label: 'Christmas Sleigh Crest',
    prompt: 'Circular Christmas ornament featuring pine trees, reindeer silhouette, and falling stars',
    archetype: 'ornament',
    theme: 'christmas',
  },
  {
    label: 'Easter Bunny Egg',
    prompt: 'Easter egg ornament with playful rabbit silhouette, spring daisies, and hanging hole',
    archetype: 'ornament',
    theme: 'easter',
  },
  {
    label: 'Mountain Coaster',
    prompt: 'Hexagonal mountain range and pine forest coaster with double score border',
    archetype: 'coaster',
    theme: 'general',
  },
];

export const AiGeneratorDrawer: React.FC<AiGeneratorDrawerProps> = ({
  onInsertGenerated,
}) => {
  const [prompt, setPrompt] = useState(PROMPT_IDEAS[0].prompt);
  const [archetype, setArchetype] = useState('ornament');
  const [theme, setTheme] = useState('valentine');
  const [widthMm, setWidthMm] = useState(95);
  const [heightMm, setHeightMm] = useState(95);
  const [replaceBed, setReplaceBed] = useState(true);
  const [referenceDataUrl, setReferenceDataUrl] = useState<string | null>(null);
  const [referenceMime, setReferenceMime] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReferenceFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setReferenceDataUrl(reader.result);
        setReferenceMime(file.type || 'image/png');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) {
      setError('Describe the design you want to cut or engrave.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/generate-laser-design', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          archetype,
          theme,
          widthMm,
          heightMm,
          referenceImageBase64: referenceDataUrl,
          referenceMimeType: referenceMime,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate laser vector design.');
      }

      const primitives = [
        ...(data.engravePaths || []).map((d: string, i: number) => ({
          id: `ai-eng-${i}`,
          d,
          layer: 'engrave' as const,
          fillRule: 'evenodd' as const,
        })),
        ...(data.scorePaths || []).map((d: string, i: number) => ({
          id: `ai-scr-${i}`,
          d,
          layer: 'score' as const,
        })),
        ...(data.cutPaths || []).map((d: string, i: number) => ({
          id: `ai-cut-${i}`,
          d,
          layer: 'cut' as const,
        })),
      ];

      const w = Math.max(20, Math.min(380, widthMm));
      const h = Math.max(20, Math.min(380, heightMm));

      const vec: VectorElement = {
        id: makeId('ai'),
        kind: 'vector',
        name: data.title || 'AI Laser Design',
        x: Number((200 - w / 2).toFixed(1)),
        y: Number((200 - h / 2).toFixed(1)),
        width: w,
        height: h,
        rotation: 0,
        flipX: false,
        flipY: false,
        layer: 'cut',
        useSubLayers: true,
        viewBoxWidth: 100,
        viewBoxHeight: 100,
        primitives,
        visible: true,
        locked: false,
      };

      const created: LaserElement[] = [vec];
      if (data.suggestedText && typeof data.suggestedText === 'string' && data.suggestedText.trim()) {
        const label = data.suggestedText.trim();
        const fontSize = Number((h * 0.12).toFixed(1));
        const textW = Number(Math.min(w * 0.78, estimateTextWidthMm(label, fontSize)).toFixed(1));
        const textH = Number((fontSize * 1.25).toFixed(1));
        const textEl: TextElement = {
          id: makeId('aitxt'),
          kind: 'text',
          name: `Text · ${label}`,
          text: label,
          x: Number((200 - textW / 2).toFixed(1)),
          y: Number((200 - textH / 2).toFixed(1)),
          width: textW,
          height: textH,
          fontSizeMm: fontSize,
          fontFamily: 'Plus Jakarta Sans',
          fontWeight: 700,
          letterSpacingMm: 0.4,
          align: 'center',
          rotation: 0,
          layer: 'engrave',
          visible: true,
          locked: false,
        };
        created.push(textEl);
      }

      onInsertGenerated(created, replaceBed);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Unable to synthesize design.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleGenerate} className="flex h-full flex-col overflow-y-auto p-4 space-y-4">
      <div>
        <h2 className="text-xs font-semibold text-[#F1F5F9]">
          Idea to Laser SVG Generator
        </h2>
        <p className="mt-1 text-[11px] leading-relaxed text-[#94A3B8]">
          Describe any ornament, sign, coaster, or event keepsake. Generates
          separated Cut, Score, and Engrave vector paths calibrated in mm.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {PROMPT_IDEAS.map((idea) => (
          <button
            key={idea.label}
            type="button"
            onClick={() => {
              setPrompt(idea.prompt);
              setArchetype(idea.archetype);
              setTheme(idea.theme);
            }}
            className="rounded border border-[#232A3B] bg-[#0D1018] px-2 py-1 text-[11px] font-medium text-[#CBD5E1] transition-colors hover:border-[#334155] hover:text-white"
          >
            {idea.label}
          </button>
        ))}
      </div>

      <div>
        <label className="mb-1 block text-[11px] font-medium text-[#94A3B8]">
          Design Idea
        </label>
        <textarea
          rows={4}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g., Layered Christmas reindeer ornament with pine needles and hanging hole..."
          className="w-full rounded-md border border-[#232A3B] bg-[#0D1018] p-2.5 text-xs text-[#F1F5F9] placeholder-[#64748B] focus:border-[#EF4444] focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label className="mb-1 block text-[11px] font-medium text-[#94A3B8]">
            Project Type
          </label>
          <select
            value={archetype}
            onChange={(e) => setArchetype(e.target.value)}
            className="w-full rounded border border-[#232A3B] bg-[#0D1018] px-2 py-1.5 text-xs text-[#F1F5F9] focus:border-[#EF4444] focus:outline-none"
          >
            <option value="ornament">Cutout Ornament</option>
            <option value="keychain">Keychain / Tag</option>
            <option value="coaster">Coaster</option>
            <option value="plaque">Engraved Plaque</option>
            <option value="caketopper">Cake Topper</option>
            <option value="layered-sign">Event Sign</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-medium text-[#94A3B8]">
            Event / Theme
          </label>
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            className="w-full rounded border border-[#232A3B] bg-[#0D1018] px-2 py-1.5 text-xs text-[#F1F5F9] focus:border-[#EF4444] focus:outline-none"
          >
            <option value="general">General Craft</option>
            <option value="valentine">Valentine&apos;s Day</option>
            <option value="christmas">Christmas</option>
            <option value="easter">Easter</option>
            <option value="event">Wedding / Event</option>
            <option value="nametag">Name Tag</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label className="mb-1 block text-[11px] font-medium text-[#94A3B8]">
            Width (mm)
          </label>
          <input
            type="number"
            min={20}
            max={380}
            value={widthMm}
            onChange={(e) => setWidthMm(Number(e.target.value) || 80)}
            className="w-full rounded border border-[#232A3B] bg-[#0D1018] px-2.5 py-1.5 font-mono text-xs text-[#F1F5F9] tabular-nums focus:border-[#EF4444] focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium text-[#94A3B8]">
            Height (mm)
          </label>
          <input
            type="number"
            min={20}
            max={380}
            value={heightMm}
            onChange={(e) => setHeightMm(Number(e.target.value) || 80)}
            className="w-full rounded border border-[#232A3B] bg-[#0D1018] px-2.5 py-1.5 font-mono text-xs text-[#F1F5F9] tabular-nums focus:border-[#EF4444] focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-[11px] font-medium text-[#94A3B8]">
          Optional Reference Sketch / Photo
        </label>
        {referenceDataUrl ? (
          <div className="relative flex items-center gap-2.5 rounded border border-[#232A3B] bg-[#0D1018] p-2">
            <img
              src={referenceDataUrl}
              alt="Reference sketch"
              className="h-10 w-10 rounded object-cover"
            />
            <span className="flex-1 truncate text-xs text-[#CBD5E1]">
              Reference attached
            </span>
            <button
              type="button"
              onClick={() => {
                setReferenceDataUrl(null);
                setReferenceMime(null);
              }}
              className="rounded p-1 text-[#94A3B8] hover:bg-[#1E2534] hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-[#334155] bg-[#0D1018] px-3 py-3 text-xs text-[#94A3B8] transition-colors hover:border-[#64748B] hover:text-[#F1F5F9]">
            <ImagePlus className="h-4 w-4" />
            <span>Attach sketch or motif image</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleReferenceFile}
              className="hidden"
            />
          </label>
        )}
      </div>

      <label className="flex cursor-pointer items-center justify-between rounded border border-[#232A3B] bg-[#0D1018] px-2.5 py-2 text-xs text-[#E2E8F0]">
        <span>Replace current bed elements</span>
        <input
          type="checkbox"
          checked={replaceBed}
          onChange={(e) => setReplaceBed(e.target.checked)}
          className="h-3.5 w-3.5 accent-[#EF4444]"
        />
      </label>

      {error && (
        <div className="rounded-md border border-[#EF4444]/40 bg-[#EF4444]/10 p-2.5 text-xs text-[#FCA5A5]">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-md bg-[#EF4444] px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#DC2626] disabled:opacity-60"
      >
        {loading ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Synthesizing Vector Layers...
          </>
        ) : (
          <>
            <Wand2 className="h-3.5 w-3.5" />
            Generate Laser Vector
          </>
        )}
      </button>
    </form>
  );
};
