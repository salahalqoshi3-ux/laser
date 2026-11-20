import React, { useMemo, useState } from 'react';
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalDistributeCenter,
  BringToFront,
  Check,
  ChevronDown,
  ChevronRight,
  Code2,
  Copy,
  Crosshair,
  Eye,
  EyeOff,
  FlipHorizontal2,
  FlipVertical2,
  FolderOpen,
  Lock,
  PanelRightClose,
  RotateCcw,
  Save,
  SendToBack,
  Trash2,
  Unlock,
} from 'lucide-react';
import { MATERIAL_PRESETS, SOFTWARE_PRESETS } from '../data/atomstackPresets';
import {
  LaserElement,
  LaserLayerType,
  MaterialPreset,
  SavedProject,
  SoftwarePresetId,
  TextElement,
} from '../types/laser';
import { estimateTextWidthMm } from '../utils/elementFactory';
import { buildSelectionSvg } from '../utils/laserExport';

export type AlignAction =
  | 'center-both'
  | 'center-x'
  | 'center-y'
  | 'edge-left'
  | 'edge-right'
  | 'edge-top'
  | 'edge-bottom';

export type RelativeAlignAction =
  | 'rel-left'
  | 'rel-center-x'
  | 'rel-right'
  | 'rel-top'
  | 'rel-center-y'
  | 'rel-bottom';

interface AccordionSectionProps {
  title: string;
  meta?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

const AccordionSection: React.FC<AccordionSectionProps> = ({
  title,
  meta,
  defaultOpen = false,
  children,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-[#232A3B]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left transition-colors hover:bg-[#171C29]"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          {open ? (
            <ChevronDown className="h-3.5 w-3.5 text-[#94A3B8] shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-[#94A3B8] shrink-0" />
          )}
          <span className="truncate text-xs font-medium text-[#E2E8F0]">
            {title}
          </span>
        </div>
        {meta && (
          <span className="font-mono text-[10px] text-[#64748B] tabular-nums shrink-0">
            {meta}
          </span>
        )}
      </button>
      {open && <div className="px-4 pb-3.5 pt-1 space-y-2.5">{children}</div>}
    </div>
  );
};

interface InspectorPanelProps {
  elements: LaserElement[];
  selectedIds: string[];
  onSelectElements: (ids: string[]) => void;
  onUpdateElement: (
    id: string,
    patch: Partial<LaserElement>,
    commitHistory?: boolean
  ) => void;
  onAlignElement: (id: string, action: AlignAction) => void;
  onBulkAlign: (ids: string[], action: AlignAction | RelativeAlignAction) => void;
  onDistributeElements: (
    axis: 'horizontal' | 'vertical',
    ids?: string[]
  ) => void;
  onReorderElements: (ids: string[], direction: 'front' | 'back') => void;
  onBulkLayer: (ids: string[], layer: LaserLayerType) => void;
  onBulkDuplicate: (ids: string[]) => void;
  onBulkDelete: (ids: string[]) => void;
  onBulkLock: (ids: string[], locked: boolean) => void;
  onClearBed: () => void;
  softwareId: SoftwarePresetId;
  onChangeSoftware: (id: SoftwarePresetId) => void;
  material: MaterialPreset;
  onChangeMaterial: (id: string) => void;
  savedProjects: SavedProject[];
  onSaveProject: (name: string) => void;
  onLoadProject: (proj: SavedProject) => void;
  onDeleteProject: (id: string) => void;
  onCollapse?: () => void;
  onNotify?: (msg: string) => void;
}

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  elements,
  selectedIds,
  onSelectElements,
  onUpdateElement,
  onAlignElement,
  onBulkAlign,
  onDistributeElements,
  onReorderElements,
  onBulkLayer,
  onBulkDuplicate,
  onBulkDelete,
  onBulkLock,
  onClearBed,
  softwareId,
  onChangeSoftware,
  material,
  onChangeMaterial,
  savedProjects,
  onSaveProject,
  onLoadProject,
  onDeleteProject,
  onCollapse,
  onNotify,
}) => {
  const [activeTab, setActiveTab] = useState<'inspect' | 'machine' | 'projects'>(
    'inspect'
  );
  const [projectName, setProjectName] = useState('');
  const [copiedSvg, setCopiedSvg] = useState(false);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedElements = useMemo(
    () => elements.filter((el) => selectedSet.has(el.id)),
    [elements, selectedSet]
  );

  const singleSelected =
    selectedElements.length === 1 ? selectedElements[0] : null;
  const isMultiSelected = selectedElements.length > 1;

  const groupBounds = useMemo(() => {
    if (selectedElements.length === 0) return null;
    const minX = Math.min(...selectedElements.map((e) => e.x));
    const minY = Math.min(...selectedElements.map((e) => e.y));
    const maxX = Math.max(...selectedElements.map((e) => e.x + e.width));
    const maxY = Math.max(...selectedElements.map((e) => e.y + e.height));
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }, [selectedElements]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) return;
    onSaveProject(projectName.trim());
    setProjectName('');
  };

  const handleCopyAsSvg = async () => {
    if (selectedElements.length === 0) return;
    const svgMarkup = buildSelectionSvg(selectedElements, {
      softwareId,
      material,
    });

    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(svgMarkup);
        copied = true;
      }
    } catch {
      copied = false;
    }

    if (!copied) {
      try {
        const ta = document.createElement('textarea');
        ta.value = svgMarkup;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        copied = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch {
        copied = false;
      }
    }

    if (copied) {
      setCopiedSvg(true);
      setTimeout(() => setCopiedSvg(false), 1800);
      onNotify?.(
        selectedElements.length === 1
          ? `Copied "${selectedElements[0].name}" SVG markup to clipboard`
          : `Copied ${selectedElements.length} selected elements as SVG`
      );
    } else {
      onNotify?.('Clipboard access was blocked by the browser.');
    }
  };

  return (
    <aside className="flex h-full w-[300px] shrink-0 flex-col border-l border-[#232A3B] bg-[#131722]">
      {/* Inspector Section Switcher + Collapse */}
      <div className="flex items-center gap-1 border-b border-[#232A3B] bg-[#0F131C] p-1">
        <div className="grid flex-1 grid-cols-3 gap-1">
          {[
            { id: 'inspect', label: 'Properties' },
            { id: 'machine', label: 'X20 Pro' },
            { id: 'projects', label: 'Saved' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() =>
                setActiveTab(tab.id as 'inspect' | 'machine' | 'projects')
              }
              className={`rounded py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-[#1F2737] text-white'
                  : 'text-[#94A3B8] hover:text-[#F1F5F9]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {onCollapse && (
          <button
            type="button"
            onClick={onCollapse}
            title="Collapse Inspector"
            aria-label="Collapse Inspector"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-[#94A3B8] transition-colors hover:bg-[#1F2737] hover:text-white"
          >
            <PanelRightClose className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {activeTab === 'inspect' && (
        <div className="flex flex-1 flex-col overflow-y-auto">
          {/* Essential-First Primary Block */}
          {isMultiSelected && groupBounds ? (
            <div className="border-b border-[#232A3B] p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold text-[#F1F5F9]">
                    {selectedElements.length} Selected
                  </div>
                  <div className="font-mono text-[11px] text-[#94A3B8] tabular-nums">
                    {groupBounds.width.toFixed(1)} ×{' '}
                    {groupBounds.height.toFixed(1)} mm
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectElements([])}
                  className="text-[11px] text-[#94A3B8] hover:text-white"
                >
                  Deselect
                </button>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => onBulkDuplicate(selectedIds)}
                  className="flex items-center justify-center gap-1 rounded border border-[#232A3B] bg-[#0B0E14] py-1.5 text-[11px] font-medium text-[#E2E8F0] hover:border-[#334155] hover:bg-[#181E2C]"
                >
                  <Copy className="h-3.5 w-3.5 text-[#38BDF8]" />
                  Clone
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const anyUnlocked = selectedElements.some((e) => !e.locked);
                    onBulkLock(selectedIds, anyUnlocked);
                  }}
                  className="flex items-center justify-center gap-1 rounded border border-[#232A3B] bg-[#0B0E14] py-1.5 text-[11px] font-medium text-[#E2E8F0] hover:border-[#334155] hover:bg-[#181E2C]"
                >
                  <Lock className="h-3.5 w-3.5 text-[#F59E0B]" />
                  Lock
                </button>
                <button
                  type="button"
                  onClick={() => onBulkDelete(selectedIds)}
                  className="flex items-center justify-center gap-1 rounded border border-[#EF4444]/40 bg-[#EF4444]/10 py-1.5 text-[11px] font-medium text-[#FCA5A5] hover:bg-[#EF4444]/20"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </div>

              <div>
                <div className="mb-1 text-[11px] font-medium text-[#94A3B8]">
                  Bulk Laser Layer
                </div>
                <div className="grid grid-cols-3 gap-1 rounded border border-[#232A3B] bg-[#0B0E14] p-1">
                  {(['cut', 'score', 'engrave'] as LaserLayerType[]).map(
                    (layerType) => (
                      <button
                        key={layerType}
                        type="button"
                        onClick={() => onBulkLayer(selectedIds, layerType)}
                        className={`rounded py-1 text-xs font-medium capitalize transition-colors ${
                          layerType === 'cut'
                            ? 'text-[#EF4444] hover:bg-[#EF4444]/15'
                            : layerType === 'score'
                              ? 'text-[#06B6D4] hover:bg-[#06B6D4]/15'
                              : 'text-[#F59E0B] hover:bg-[#F59E0B]/15'
                        }`}
                      >
                        {layerType}
                      </button>
                    )
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={handleCopyAsSvg}
                className="flex w-full items-center justify-center gap-1.5 rounded border border-[#232A3B] bg-[#0D1018] py-1.5 text-xs font-medium text-[#E2E8F0] transition-colors hover:border-[#334155] hover:bg-[#181E2C]"
              >
                {copiedSvg ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-[#22C55E]" />
                    <span className="text-[#86EFAC]">Copied SVG</span>
                  </>
                ) : (
                  <>
                    <Code2 className="h-3.5 w-3.5 text-[#38BDF8]" />
                    <span>Copy as SVG</span>
                  </>
                )}
              </button>
            </div>
          ) : singleSelected ? (
            <div className="border-b border-[#232A3B] p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs font-semibold text-[#F1F5F9]">
                  {singleSelected.name}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => onBulkDuplicate([singleSelected.id])}
                    title="Duplicate (Ctrl+D)"
                    className="rounded p-1.5 text-[#94A3B8] hover:bg-[#1E2534] hover:text-white"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onBulkDelete([singleSelected.id])}
                    title="Delete element"
                    className="rounded p-1.5 text-[#94A3B8] hover:bg-[#EF4444]/15 hover:text-[#EF4444]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Quick Text Content when Text Element is Selected */}
              {singleSelected.kind === 'text' && (
                <div>
                  <label className="mb-1 block text-[11px] text-[#94A3B8]">
                    Text
                  </label>
                  <input
                    type="text"
                    value={singleSelected.text}
                    onChange={(e) => {
                      const val = e.target.value;
                      const newW = estimateTextWidthMm(
                        val,
                        singleSelected.fontSizeMm,
                        singleSelected.letterSpacingMm
                      );
                      onUpdateElement(
                        singleSelected.id,
                        { text: val, width: Math.max(8, newW) },
                        true
                      );
                    }}
                    className="w-full rounded border border-[#232A3B] bg-[#0B0E14] px-2.5 py-1.5 text-xs text-[#F1F5F9] focus:border-[#EF4444] focus:outline-none"
                  />
                </div>
              )}

              {/* Essential Coordinates & Dimensions (mm) */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[11px] text-[#94A3B8]">
                    X (mm)
                  </label>
                  <input
                    type="number"
                    step={0.5}
                    value={singleSelected.x}
                    onChange={(e) =>
                      onUpdateElement(
                        singleSelected.id,
                        { x: Number(e.target.value) },
                        true
                      )
                    }
                    className="w-full rounded border border-[#232A3B] bg-[#0B0E14] px-2 py-1 font-mono text-xs text-[#F1F5F9] tabular-nums focus:border-[#EF4444] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-[#94A3B8]">
                    Y (mm)
                  </label>
                  <input
                    type="number"
                    step={0.5}
                    value={singleSelected.y}
                    onChange={(e) =>
                      onUpdateElement(
                        singleSelected.id,
                        { y: Number(e.target.value) },
                        true
                      )
                    }
                    className="w-full rounded border border-[#232A3B] bg-[#0B0E14] px-2 py-1 font-mono text-xs text-[#F1F5F9] tabular-nums focus:border-[#EF4444] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-[#94A3B8]">
                    Width (mm)
                  </label>
                  <input
                    type="number"
                    min={2}
                    max={400}
                    step={0.5}
                    value={singleSelected.width}
                    onChange={(e) =>
                      onUpdateElement(
                        singleSelected.id,
                        { width: Math.max(2, Number(e.target.value)) },
                        true
                      )
                    }
                    className="w-full rounded border border-[#232A3B] bg-[#0B0E14] px-2 py-1 font-mono text-xs text-[#F1F5F9] tabular-nums focus:border-[#EF4444] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-[#94A3B8]">
                    Height (mm)
                  </label>
                  <input
                    type="number"
                    min={2}
                    max={400}
                    step={0.5}
                    value={singleSelected.height}
                    onChange={(e) =>
                      onUpdateElement(
                        singleSelected.id,
                        { height: Math.max(2, Number(e.target.value)) },
                        true
                      )
                    }
                    className="w-full rounded border border-[#232A3B] bg-[#0B0E14] px-2 py-1 font-mono text-xs text-[#F1F5F9] tabular-nums focus:border-[#EF4444] focus:outline-none"
                  />
                </div>
              </div>

              {/* Essential Laser Operation */}
              {singleSelected.kind !== 'raster' && (
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[11px] font-medium text-[#94A3B8]">
                      Laser Operation
                    </span>
                    {singleSelected.kind === 'vector' &&
                      singleSelected.useSubLayers && (
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateElement(
                              singleSelected.id,
                              { useSubLayers: false },
                              true
                            )
                          }
                          className="text-[11px] text-[#06B6D4] hover:underline"
                        >
                          Multi-Layer
                        </button>
                      )}
                  </div>
                  <div className="grid grid-cols-3 gap-1 rounded border border-[#232A3B] bg-[#0B0E14] p-1">
                    {(['cut', 'score', 'engrave'] as LaserLayerType[]).map(
                      (layerType) => {
                        const isActive =
                          singleSelected.kind === 'text'
                            ? singleSelected.layer === layerType
                            : !singleSelected.useSubLayers &&
                              singleSelected.layer === layerType;
                        return (
                          <button
                            key={layerType}
                            type="button"
                            onClick={() => {
                              if (singleSelected.kind === 'vector') {
                                onUpdateElement(
                                  singleSelected.id,
                                  {
                                    useSubLayers: false,
                                    layer: layerType,
                                  },
                                  true
                                );
                              } else {
                                onUpdateElement(
                                  singleSelected.id,
                                  { layer: layerType },
                                  true
                                );
                              }
                            }}
                            className={`rounded py-1 text-xs font-medium capitalize transition-colors ${
                              isActive
                                ? layerType === 'cut'
                                  ? 'bg-[#EF4444]/20 text-[#EF4444]'
                                  : layerType === 'score'
                                    ? 'bg-[#06B6D4]/20 text-[#06B6D4]'
                                    : 'bg-[#F59E0B]/20 text-[#F59E0B]'
                                : 'text-[#94A3B8] hover:text-white'
                            }`}
                          >
                            {layerType}
                          </button>
                        );
                      }
                    )}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={handleCopyAsSvg}
                title="Copy raw SVG markup of the selected design to clipboard"
                className="flex w-full items-center justify-center gap-1.5 rounded border border-[#232A3B] bg-[#0D1018] py-1.5 text-xs font-medium text-[#E2E8F0] transition-colors hover:border-[#334155] hover:bg-[#181E2C]"
              >
                {copiedSvg ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-[#22C55E]" />
                    <span className="text-[#86EFAC]">Copied SVG</span>
                  </>
                ) : (
                  <>
                    <Code2 className="h-3.5 w-3.5 text-[#38BDF8]" />
                    <span>Copy as SVG</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="border-b border-[#232A3B] p-4 text-xs leading-relaxed text-[#94A3B8]">
              Select an object or drag across the 400 × 400 mm bed to edit
              dimensions and laser layers.
            </div>
          )}

          {/* Progressive Disclosure: Rotation & Flip */}
          {singleSelected && (
            <AccordionSection
              title="Rotation & Flip"
              meta={`${singleSelected.rotation}°`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[#94A3B8]">Angle (0–360°)</span>
                <button
                  type="button"
                  disabled={singleSelected.rotation === 0}
                  onClick={() =>
                    onUpdateElement(singleSelected.id, { rotation: 0 }, true)
                  }
                  className="flex items-center gap-1 text-[11px] font-medium text-[#38BDF8] hover:underline disabled:text-[#475569] disabled:no-underline"
                >
                  <RotateCcw className="h-3 w-3" />
                  Reset Rotation
                </button>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={360}
                  step={1}
                  value={((singleSelected.rotation % 360) + 360) % 360}
                  onChange={(e) =>
                    onUpdateElement(
                      singleSelected.id,
                      { rotation: Number(e.target.value) },
                      false
                    )
                  }
                  onMouseUp={() =>
                    onUpdateElement(singleSelected.id, {}, true)
                  }
                  onTouchEnd={() =>
                    onUpdateElement(singleSelected.id, {}, true)
                  }
                  className="flex-1 accent-[#EF4444]"
                />
                <input
                  type="number"
                  min={0}
                  max={360}
                  step={1}
                  value={singleSelected.rotation}
                  onChange={(e) => {
                    const raw = Number(e.target.value);
                    const clamped = Number.isNaN(raw)
                      ? 0
                      : Math.max(0, Math.min(360, raw));
                    onUpdateElement(
                      singleSelected.id,
                      { rotation: clamped },
                      true
                    );
                  }}
                  className="w-16 rounded border border-[#232A3B] bg-[#0B0E14] px-2 py-1 font-mono text-xs text-[#F1F5F9] tabular-nums focus:border-[#EF4444] focus:outline-none"
                />
              </div>

              {singleSelected.kind === 'vector' && (
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateElement(
                        singleSelected.id,
                        { flipX: !singleSelected.flipX },
                        true
                      )
                    }
                    className={`flex items-center justify-center gap-1.5 rounded border py-1.5 text-[11px] font-medium transition-colors ${
                      singleSelected.flipX
                        ? 'border-[#EF4444] bg-[#EF4444]/15 text-[#EF4444]'
                        : 'border-[#232A3B] bg-[#0B0E14] text-[#94A3B8] hover:text-white'
                    }`}
                  >
                    <FlipHorizontal2 className="h-3.5 w-3.5" />
                    Flip H
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateElement(
                        singleSelected.id,
                        { flipY: !singleSelected.flipY },
                        true
                      )
                    }
                    className={`flex items-center justify-center gap-1.5 rounded border py-1.5 text-[11px] font-medium transition-colors ${
                      singleSelected.flipY
                        ? 'border-[#EF4444] bg-[#EF4444]/15 text-[#EF4444]'
                        : 'border-[#232A3B] bg-[#0B0E14] text-[#94A3B8] hover:text-white'
                    }`}
                  >
                    <FlipVertical2 className="h-3.5 w-3.5" />
                    Flip V
                  </button>
                </div>
              )}
            </AccordionSection>
          )}

          {/* Progressive Disclosure: Typography (Text only) */}
          {singleSelected?.kind === 'text' && (
            <AccordionSection
              title="Typography"
              meta={`${singleSelected.fontSizeMm}mm`}
            >
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[11px] text-[#94A3B8]">
                    Font
                  </label>
                  <select
                    value={singleSelected.fontFamily}
                    onChange={(e) =>
                      onUpdateElement(
                        singleSelected.id,
                        {
                          fontFamily: e.target
                            .value as TextElement['fontFamily'],
                        },
                        true
                      )
                    }
                    className="w-full rounded border border-[#232A3B] bg-[#0B0E14] px-2 py-1 text-xs text-[#F1F5F9]"
                  >
                    <option value="Plus Jakarta Sans">Sans</option>
                    <option value="Georgia">Serif</option>
                    <option value="JetBrains Mono">Mono</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-[#94A3B8]">
                    Size (mm)
                  </label>
                  <input
                    type="number"
                    min={2}
                    max={80}
                    step={0.5}
                    value={singleSelected.fontSizeMm}
                    onChange={(e) => {
                      const fs = Math.max(2, Number(e.target.value) || 6);
                      onUpdateElement(
                        singleSelected.id,
                        {
                          fontSizeMm: fs,
                          height: Number((fs * 1.25).toFixed(1)),
                          width: estimateTextWidthMm(
                            singleSelected.text,
                            fs,
                            singleSelected.letterSpacingMm
                          ),
                        },
                        true
                      );
                    }}
                    className="w-full rounded border border-[#232A3B] bg-[#0B0E14] px-2 py-1 font-mono text-xs text-[#F1F5F9] tabular-nums"
                  />
                </div>
              </div>
            </AccordionSection>
          )}

          {/* Progressive Disclosure: Alignment, Distribution & Stacking Order */}
          <AccordionSection title="Alignment & Order" meta="400×400">
            {selectedElements.length > 0 && (
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  disabled={elements.length < 2}
                  onClick={() => onReorderElements(selectedIds, 'front')}
                  className="flex items-center justify-center gap-1.5 rounded border border-[#232A3B] bg-[#0B0E14] px-2 py-1.5 text-[11px] font-medium text-[#E2E8F0] hover:border-[#334155] hover:bg-[#181E2C] disabled:opacity-35"
                >
                  <BringToFront className="h-3.5 w-3.5 text-[#38BDF8]" />
                  Bring to Front
                </button>
                <button
                  type="button"
                  disabled={elements.length < 2}
                  onClick={() => onReorderElements(selectedIds, 'back')}
                  className="flex items-center justify-center gap-1.5 rounded border border-[#232A3B] bg-[#0B0E14] px-2 py-1.5 text-[11px] font-medium text-[#E2E8F0] hover:border-[#334155] hover:bg-[#181E2C] disabled:opacity-35"
                >
                  <SendToBack className="h-3.5 w-3.5 text-[#94A3B8]" />
                  Send to Back
                </button>
              </div>
            )}

            {isMultiSelected && (
              <div className="space-y-1">
                <div className="text-[11px] text-[#94A3B8]">
                  Align Selection Together
                </div>
                <div className="grid grid-cols-6 gap-1">
                  <button
                    type="button"
                    onClick={() => onBulkAlign(selectedIds, 'rel-left')}
                    title="Align Left Edges"
                    className="flex items-center justify-center rounded border border-[#232A3B] bg-[#0B0E14] py-1.5 text-[#CBD5E1] hover:border-[#334155] hover:bg-[#181E2C]"
                  >
                    <AlignStartVertical className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onBulkAlign(selectedIds, 'rel-center-x')}
                    title="Align Horizontal Centers"
                    className="flex items-center justify-center rounded border border-[#232A3B] bg-[#0B0E14] py-1.5 text-[#CBD5E1] hover:border-[#334155] hover:bg-[#181E2C]"
                  >
                    <AlignCenterHorizontal className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onBulkAlign(selectedIds, 'rel-right')}
                    title="Align Right Edges"
                    className="flex items-center justify-center rounded border border-[#232A3B] bg-[#0B0E14] py-1.5 text-[#CBD5E1] hover:border-[#334155] hover:bg-[#181E2C]"
                  >
                    <AlignEndVertical className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onBulkAlign(selectedIds, 'rel-top')}
                    title="Align Top Edges"
                    className="flex items-center justify-center rounded border border-[#232A3B] bg-[#0B0E14] py-1.5 text-[#CBD5E1] hover:border-[#334155] hover:bg-[#181E2C]"
                  >
                    <AlignStartHorizontal className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onBulkAlign(selectedIds, 'rel-center-y')}
                    title="Align Vertical Centers"
                    className="flex items-center justify-center rounded border border-[#232A3B] bg-[#0B0E14] py-1.5 text-[#CBD5E1] hover:border-[#334155] hover:bg-[#181E2C]"
                  >
                    <AlignCenterVertical className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onBulkAlign(selectedIds, 'rel-bottom')}
                    title="Align Bottom Edges"
                    className="flex items-center justify-center rounded border border-[#232A3B] bg-[#0B0E14] py-1.5 text-[#CBD5E1] hover:border-[#334155] hover:bg-[#181E2C]"
                  >
                    <AlignEndHorizontal className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <div className="text-[11px] text-[#94A3B8]">Bed Snap</div>
              <div className="grid grid-cols-4 gap-1.5">
                <button
                  type="button"
                  disabled={
                    selectedElements.length === 0 ||
                    selectedElements.every((e) => e.locked)
                  }
                  onClick={() => {
                    if (isMultiSelected) onBulkAlign(selectedIds, 'center-both');
                    else if (singleSelected)
                      onAlignElement(singleSelected.id, 'center-both');
                  }}
                  title="Align to Grid Center (200, 200 mm)"
                  className="col-span-2 flex items-center justify-center gap-1.5 rounded border border-[#232A3B] bg-[#0D1018] px-2 py-1.5 text-[11px] font-medium text-[#E2E8F0] hover:border-[#334155] hover:bg-[#181E2C] disabled:opacity-35"
                >
                  <Crosshair className="h-3.5 w-3.5 text-[#38BDF8]" />
                  Grid Center
                </button>
                <button
                  type="button"
                  disabled={
                    selectedElements.length === 0 ||
                    selectedElements.every((e) => e.locked)
                  }
                  onClick={() => {
                    if (isMultiSelected) onBulkAlign(selectedIds, 'center-x');
                    else if (singleSelected)
                      onAlignElement(singleSelected.id, 'center-x');
                  }}
                  title="Center Horizontally"
                  className="flex items-center justify-center rounded border border-[#232A3B] bg-[#0D1018] py-1.5 text-[#CBD5E1] hover:border-[#334155] hover:bg-[#181E2C] disabled:opacity-35"
                >
                  <AlignCenterHorizontal className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  disabled={
                    selectedElements.length === 0 ||
                    selectedElements.every((e) => e.locked)
                  }
                  onClick={() => {
                    if (isMultiSelected) onBulkAlign(selectedIds, 'center-y');
                    else if (singleSelected)
                      onAlignElement(singleSelected.id, 'center-y');
                  }}
                  title="Center Vertically"
                  className="flex items-center justify-center rounded border border-[#232A3B] bg-[#0D1018] py-1.5 text-[#CBD5E1] hover:border-[#334155] hover:bg-[#181E2C] disabled:opacity-35"
                >
                  <AlignCenterVertical className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-4 gap-1.5">
                {(
                  [
                    ['edge-left', 'L', AlignStartVertical, 'Left Edge'],
                    ['edge-right', 'R', AlignEndVertical, 'Right Edge'],
                    ['edge-top', 'T', AlignStartHorizontal, 'Top Edge'],
                    ['edge-bottom', 'B', AlignEndHorizontal, 'Bottom Edge'],
                  ] as const
                ).map(([act, label, Icon, title]) => (
                  <button
                    key={act}
                    type="button"
                    disabled={
                      selectedElements.length === 0 ||
                      selectedElements.every((e) => e.locked)
                    }
                    onClick={() => {
                      if (isMultiSelected) onBulkAlign(selectedIds, act);
                      else if (singleSelected)
                        onAlignElement(singleSelected.id, act);
                    }}
                    title={title}
                    className="flex items-center justify-center gap-1 rounded border border-[#232A3B] bg-[#0D1018] py-1.5 text-[11px] text-[#CBD5E1] hover:border-[#334155] hover:bg-[#181E2C] disabled:opacity-35"
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5 pt-0.5">
              <button
                type="button"
                disabled={
                  isMultiSelected
                    ? selectedElements.length < 2
                    : elements.filter((el) => el.visible).length < 2
                }
                onClick={() =>
                  onDistributeElements(
                    'horizontal',
                    isMultiSelected ? selectedIds : undefined
                  )
                }
                className="flex items-center justify-center gap-1.5 rounded border border-[#232A3B] bg-[#0D1018] px-2 py-1.5 text-[11px] font-medium text-[#E2E8F0] hover:border-[#334155] hover:bg-[#181E2C] disabled:opacity-35"
              >
                <AlignHorizontalDistributeCenter className="h-3.5 w-3.5 text-[#06B6D4]" />
                Distribute H
              </button>
              <button
                type="button"
                disabled={
                  isMultiSelected
                    ? selectedElements.length < 2
                    : elements.filter((el) => el.visible).length < 2
                }
                onClick={() =>
                  onDistributeElements(
                    'vertical',
                    isMultiSelected ? selectedIds : undefined
                  )
                }
                className="flex items-center justify-center gap-1.5 rounded border border-[#232A3B] bg-[#0D1018] px-2 py-1.5 text-[11px] font-medium text-[#E2E8F0] hover:border-[#334155] hover:bg-[#181E2C] disabled:opacity-35"
              >
                <AlignVerticalDistributeCenter className="h-3.5 w-3.5 text-[#06B6D4]" />
                Distribute V
              </button>
            </div>
          </AccordionSection>

          {/* Progressive Disclosure: Bed Objects Stack */}
          <AccordionSection
            title="Bed Objects"
            meta={`${elements.length}`}
            defaultOpen={false}
          >
            {elements.length > 0 && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={onClearBed}
                  className="text-[11px] text-[#94A3B8] hover:text-[#EF4444]"
                >
                  Clear Bed
                </button>
              </div>
            )}

            {elements.length === 0 ? (
              <div className="rounded border border-[#232A3B] bg-[#0D1018] p-3 text-center text-xs text-[#64748B]">
                Bed is empty.
              </div>
            ) : (
              <div className="space-y-1.5">
                {elements.map((el) => {
                  const isSel = selectedSet.has(el.id);
                  return (
                    <div
                      key={el.id}
                      onClick={(e) => {
                        if (e.shiftKey) {
                          const nextIds = selectedSet.has(el.id)
                            ? selectedIds.filter((id) => id !== el.id)
                            : [...selectedIds, el.id];
                          onSelectElements(nextIds);
                        } else {
                          onSelectElements([el.id]);
                        }
                      }}
                      className={`flex cursor-pointer items-center justify-between gap-2 rounded border px-2.5 py-1.5 text-xs transition-colors ${
                        isSel
                          ? 'border-[#38BDF8] bg-[#172030]'
                          : 'border-[#232A3B] bg-[#0D1018] hover:border-[#334155]'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-[#E2E8F0]">
                          {el.name}
                        </div>
                        <div className="font-mono text-[10px] text-[#64748B] tabular-nums">
                          {el.width.toFixed(0)}×{el.height.toFixed(0)}mm
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onUpdateElement(
                              el.id,
                              { visible: !el.visible },
                              false
                            );
                          }}
                          className="p-1 text-[#94A3B8] hover:text-white"
                          title={el.visible ? 'Hide' : 'Show'}
                        >
                          {el.visible ? (
                            <Eye className="h-3.5 w-3.5" />
                          ) : (
                            <EyeOff className="h-3.5 w-3.5 text-[#475569]" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onUpdateElement(
                              el.id,
                              { locked: !el.locked },
                              false
                            );
                          }}
                          className="p-1 text-[#94A3B8] hover:text-white"
                          title={el.locked ? 'Unlock' : 'Lock'}
                        >
                          {el.locked ? (
                            <Lock className="h-3.5 w-3.5 text-[#F59E0B]" />
                          ) : (
                            <Unlock className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </AccordionSection>
        </div>
      )}

      {activeTab === 'machine' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <h3 className="text-xs font-semibold text-[#F1F5F9]">
              AtomStack X20 Pro Profile
            </h3>
            <p className="mt-1 text-[11px] text-[#94A3B8]">
              20W Optical Quad-Diode · 400 × 400 mm · 0.08 × 0.10 mm Spot
            </p>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-[#94A3B8]">
              Laser Control Software
            </label>
            <select
              value={softwareId}
              onChange={(e) =>
                onChangeSoftware(e.target.value as SoftwarePresetId)
              }
              className="w-full rounded border border-[#232A3B] bg-[#0D1018] px-2.5 py-2 text-xs text-[#F1F5F9] focus:border-[#EF4444] focus:outline-none"
            >
              {Object.values(SOFTWARE_PRESETS).map((sw) => (
                <option key={sw.id} value={sw.id}>
                  {sw.name}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-[11px] leading-relaxed text-[#94A3B8]">
              {SOFTWARE_PRESETS[softwareId].description}
            </p>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-[#94A3B8]">
              Target Material
            </label>
            <select
              value={material.id}
              onChange={(e) => onChangeMaterial(e.target.value)}
              className="w-full rounded border border-[#232A3B] bg-[#0D1018] px-2.5 py-2 text-xs text-[#F1F5F9] focus:border-[#EF4444] focus:outline-none"
            >
              {MATERIAL_PRESETS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.thicknessLabel})
                </option>
              ))}
            </select>
          </div>

          {material.warning && (
            <div className="rounded border border-[#F59E0B]/40 bg-[#F59E0B]/10 p-2.5 text-[11px] leading-relaxed text-[#FCD34D]">
              {material.warning}
            </div>
          )}

          <div className="rounded-md border border-[#232A3B] bg-[#0D1018] divide-y divide-[#232A3B]">
            <div className="p-3 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#F59E0B]">
                  Engrave / Fill
                </span>
                <span className="font-mono text-[#F1F5F9] tabular-nums">
                  {material.engrave.speedMmMin} mm/min ·{' '}
                  {material.engrave.powerPct}%
                </span>
              </div>
              <div className="text-[11px] text-[#94A3B8]">
                {material.engrave.passes} pass · Air Assist:{' '}
                {material.engrave.airAssist ? 'ON' : 'OFF'}
              </div>
            </div>

            <div className="p-3 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#06B6D4]">
                  Score / Line
                </span>
                <span className="font-mono text-[#F1F5F9] tabular-nums">
                  {material.score.speedMmMin} mm/min · {material.score.powerPct}
                  %
                </span>
              </div>
              <div className="text-[11px] text-[#94A3B8]">
                {material.score.passes} pass · Air Assist:{' '}
                {material.score.airAssist ? 'ON' : 'OFF'}
              </div>
            </div>

            <div className="p-3 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#EF4444]">
                  Cut Through
                </span>
                <span className="font-mono text-[#F1F5F9] tabular-nums">
                  {material.cut
                    ? `${material.cut.speedMmMin} mm/min · ${material.cut.powerPct}%`
                    : 'N/A'}
                </span>
              </div>
              <div className="text-[11px] text-[#94A3B8]">
                {material.cut
                  ? `${material.cut.passes} pass${material.cut.passes > 1 ? 'es' : ''} · Air Assist: ${material.cut.airAssist ? 'ON' : 'OFF'}`
                  : 'Surface marking only on this material.'}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'projects' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <form onSubmit={handleSave} className="space-y-2">
            <label className="block text-[11px] font-medium text-[#94A3B8]">
              Save Current Bed Locally
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="e.g., Christmas Ornaments Batch"
                className="min-w-0 flex-1 rounded border border-[#232A3B] bg-[#0D1018] px-2.5 py-1.5 text-xs text-[#F1F5F9] focus:border-[#EF4444] focus:outline-none"
              />
              <button
                type="submit"
                disabled={!projectName.trim() || elements.length === 0}
                className="flex items-center gap-1 rounded bg-[#EF4444] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#DC2626] disabled:opacity-40"
              >
                <Save className="h-3.5 w-3.5" />
                Save
              </button>
            </div>
          </form>

          <div className="space-y-2">
            <div className="text-xs font-semibold text-[#F1F5F9]">
              Saved Projects ({savedProjects.length})
            </div>
            {savedProjects.length === 0 ? (
              <div className="rounded border border-[#232A3B] bg-[#0D1018] p-4 text-center text-xs text-[#64748B]">
                No saved projects yet.
              </div>
            ) : (
              savedProjects.map((proj) => (
                <div
                  key={proj.id}
                  className="flex items-center justify-between gap-2 rounded border border-[#232A3B] bg-[#0D1018] p-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium text-[#F1F5F9]">
                      {proj.name}
                    </div>
                    <div className="font-mono text-[10px] text-[#64748B] tabular-nums">
                      {proj.elements.length} items ·{' '}
                      {new Date(proj.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onLoadProject(proj)}
                      title="Load onto bed"
                      className="rounded border border-[#334155] bg-[#181F2E] px-2 py-1 text-[11px] font-medium text-[#E2E8F0] hover:bg-[#232C40]"
                    >
                      <FolderOpen className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteProject(proj.id)}
                      title="Delete project"
                      className="rounded p-1 text-[#94A3B8] hover:text-[#EF4444]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </aside>
  );
};
