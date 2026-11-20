import React, { useMemo, useState } from 'react';
import { Plus, Replace, Search } from 'lucide-react';
import { LASER_TEMPLATES } from '../data/laserTemplates';
import { TemplateCategory, TemplateDefinition } from '../types/laser';

interface TemplatesDrawerProps {
  onInsertTemplate: (
    template: TemplateDefinition,
    opts: { primaryText: string; secondaryText: string; hasHole: boolean },
    replaceBed: boolean
  ) => void;
  onSelectMaterial: (materialId: string) => void;
}

const CATEGORIES: Array<{ id: TemplateCategory; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'nametags', label: 'Name Tags' },
  { id: 'events', label: 'Events' },
  { id: 'valentine', label: 'Valentine' },
  { id: 'christmas', label: 'Christmas' },
  { id: 'easter', label: 'Easter' },
];

export const TemplatesDrawer: React.FC<TemplatesDrawerProps> = ({
  onInsertTemplate,
  onSelectMaterial,
}) => {
  const [category, setCategory] = useState<TemplateCategory>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string>(LASER_TEMPLATES[0].id);

  const selectedTemplate = useMemo(
    () => LASER_TEMPLATES.find((t) => t.id === selectedId) ?? LASER_TEMPLATES[0],
    [selectedId]
  );

  const [primaryText, setPrimaryText] = useState(
    selectedTemplate.defaultPrimaryText ?? ''
  );
  const [secondaryText, setSecondaryText] = useState(
    selectedTemplate.defaultSecondaryText ?? ''
  );
  const [hasHole, setHasHole] = useState(
    selectedTemplate.defaultHasHole ?? false
  );

  const handleSelectCard = (tpl: TemplateDefinition) => {
    setSelectedId(tpl.id);
    setPrimaryText(tpl.defaultPrimaryText ?? '');
    setSecondaryText(tpl.defaultSecondaryText ?? '');
    setHasHole(tpl.defaultHasHole ?? false);
  };

  const filteredTemplates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return LASER_TEMPLATES.filter((t) => {
      if (category !== 'all' && t.category !== category) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        t.subtitle.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      );
    });
  }, [category, search]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[#232A3B] p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[#64748B]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Valentine, Christmas, Easter, tags..."
            className="w-full rounded-md border border-[#232A3B] bg-[#0D1018] py-2 pr-3 pl-8 text-xs text-[#F1F5F9] placeholder-[#64748B] focus:border-[#EF4444] focus:outline-none"
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-1 rounded-md bg-[#0D1018] p-1 border border-[#232A3B]">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategory(cat.id)}
              className={`rounded px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
                category === cat.id
                  ? 'bg-[#1F2737] text-white'
                  : 'text-[#94A3B8] hover:text-[#F1F5F9]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
        {filteredTemplates.length === 0 ? (
          <div className="rounded-md border border-[#232A3B] bg-[#0D1018] p-5 text-center">
            <p className="text-xs text-[#94A3B8]">
              No templates match &ldquo;{search}&rdquo;.
            </p>
            <button
              type="button"
              onClick={() => {
                setCategory('all');
                setSearch('');
              }}
              className="mt-2.5 text-xs font-medium text-[#EF4444] hover:underline"
            >
              Reset filters
            </button>
          </div>
        ) : (
          filteredTemplates.map((tpl) => {
            const isSelected = tpl.id === selectedTemplate.id;
            const preview = tpl.build({
              primaryText: tpl.defaultPrimaryText ?? '',
              secondaryText: tpl.defaultSecondaryText ?? '',
              hasHole: tpl.defaultHasHole ?? false,
            });
            return (
              <button
                key={tpl.id}
                type="button"
                onClick={() => handleSelectCard(tpl)}
                className={`group flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition-colors ${
                  isSelected
                    ? 'border-[#EF4444] bg-[#181E2C]'
                    : 'border-[#232A3B] bg-[#0D1018] hover:border-[#334155] hover:bg-[#141925]'
                }`}
              >
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded border border-[#232A3B] bg-[#0B0E14] p-1.5">
                  <svg
                    viewBox={`0 0 ${preview.viewBoxWidth} ${preview.viewBoxHeight}`}
                    className="h-full w-full"
                  >
                    {preview.primitives.map((p) => (
                      <path
                        key={p.id}
                        d={p.d}
                        fill={p.layer === 'engrave' ? '#F59E0B' : 'none'}
                        fillRule={p.fillRule ?? 'nonzero'}
                        stroke={
                          p.layer === 'cut'
                            ? '#EF4444'
                            : p.layer === 'score'
                              ? '#06B6D4'
                              : 'none'
                        }
                        strokeWidth={p.layer === 'engrave' ? 0 : 1.8}
                      />
                    ))}
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-semibold text-[#F1F5F9]">
                    {tpl.title}
                  </div>
                  <div className="mt-0.5 truncate text-[11px] text-[#94A3B8]">
                    {tpl.subtitle}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Selected Template Live Customizer */}
      <div className="border-t border-[#232A3B] bg-[#10141E] p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs font-semibold text-[#F1F5F9]">
            {selectedTemplate.title}
          </span>
          <span className="font-mono text-[11px] text-[#94A3B8] tabular-nums whitespace-nowrap">
            {selectedTemplate.defaultWidthMm}×{selectedTemplate.defaultHeightMm}mm
          </span>
        </div>

        {selectedTemplate.supportsPrimaryText && (
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[#94A3B8]">
              Main Text
            </label>
            <input
              type="text"
              value={primaryText}
              onChange={(e) => setPrimaryText(e.target.value)}
              className="w-full rounded border border-[#232A3B] bg-[#0B0E14] px-2.5 py-1.5 text-xs text-[#F1F5F9] focus:border-[#EF4444] focus:outline-none"
            />
          </div>
        )}

        {selectedTemplate.supportsSecondaryText && (
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[#94A3B8]">
              Subtitle / Year
            </label>
            <input
              type="text"
              value={secondaryText}
              onChange={(e) => setSecondaryText(e.target.value)}
              className="w-full rounded border border-[#232A3B] bg-[#0B0E14] px-2.5 py-1.5 text-xs text-[#F1F5F9] focus:border-[#EF4444] focus:outline-none"
            />
          </div>
        )}

        {selectedTemplate.supportsHoleToggle && (
          <label className="flex cursor-pointer items-center justify-between rounded border border-[#232A3B] bg-[#0B0E14] px-2.5 py-2 text-xs text-[#E2E8F0]">
            <span>Include hanging / keyring cut hole</span>
            <input
              type="checkbox"
              checked={hasHole}
              onChange={(e) => setHasHole(e.target.checked)}
              className="h-3.5 w-3.5 accent-[#EF4444]"
            />
          </label>
        )}

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={() => {
              onSelectMaterial(selectedTemplate.recommendedMaterialId);
              onInsertTemplate(
                selectedTemplate,
                { primaryText, secondaryText, hasHole },
                false
              );
            }}
            className="flex items-center justify-center gap-1.5 rounded-md border border-[#334155] bg-[#181F2E] px-3 py-2 text-xs font-medium text-[#F1F5F9] whitespace-nowrap transition-colors hover:bg-[#232C40]"
          >
            <Plus className="h-3.5 w-3.5" />
            Add to Bed
          </button>
          <button
            type="button"
            onClick={() => {
              onSelectMaterial(selectedTemplate.recommendedMaterialId);
              onInsertTemplate(
                selectedTemplate,
                { primaryText, secondaryText, hasHole },
                true
              );
            }}
            className="flex items-center justify-center gap-1.5 rounded-md bg-[#EF4444] px-3 py-2 text-xs font-semibold text-white whitespace-nowrap transition-colors hover:bg-[#DC2626]"
          >
            <Replace className="h-3.5 w-3.5" />
            Load on Bed
          </button>
        </div>
      </div>
    </div>
  );
};
