import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Circle,
  Eye,
  Grid3X3,
  Heart,
  Hexagon,
  Layers,
  Magnet,
  Maximize2,
  PanelLeft,
  PanelRight,
  Redo2,
  Ruler,
  SlidersHorizontal,
  Square,
  Star,
  Type as TypeIcon,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { ATOMSTACK_X20_PRO_SPECS } from '../data/atomstackPresets';
import {
  LaserElement,
  MaterialPreset,
  ViewRenderMode,
} from '../types/laser';

export interface SmartGuide {
  axis: 'x' | 'y';
  pos: number;
  start: number;
  end: number;
  kind: 'center' | 'edge';
}

interface LaserBedCanvasProps {
  elements: LaserElement[];
  selectedIds: string[];
  material: MaterialPreset;
  viewMode: ViewRenderMode;
  onChangeViewMode: (mode: ViewRenderMode) => void;
  onSelectElements: (ids: string[]) => void;
  onUpdateElement: (id: string, patch: Partial<LaserElement>, commitHistory?: boolean) => void;
  onMoveElements: (
    updates: Array<{ id: string; x: number; y: number }>,
    commitHistory?: boolean
  ) => void;
  onAddQuickShape: (shape: 'rect' | 'circle' | 'heart' | 'star' | 'hex' | 'hole') => void;
  onAddText: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  leftDrawerOpen?: boolean;
  onToggleLeftDrawer?: () => void;
  rightInspectorOpen?: boolean;
  onToggleRightInspector?: () => void;
}

type DragState =
  | {
      type: 'move';
      startClientX: number;
      startClientY: number;
      items: Array<{ id: string; origX: number; origY: number; width: number; height: number }>;
      groupOrigX: number;
      groupOrigY: number;
      groupWidth: number;
      groupHeight: number;
    }
  | {
      type: 'resize';
      id: string;
      corner: 'nw' | 'ne' | 'sw' | 'se';
      startClientX: number;
      startClientY: number;
      origX: number;
      origY: number;
      origW: number;
      origH: number;
    }
  | {
      type: 'marquee';
      startMmX: number;
      startMmY: number;
      currMmX: number;
      currMmY: number;
      additive: boolean;
      baseSelectedIds: string[];
    };

export const LaserBedCanvas: React.FC<LaserBedCanvasProps> = ({
  elements,
  selectedIds,
  material,
  viewMode,
  onChangeViewMode,
  onSelectElements,
  onUpdateElement,
  onMoveElements,
  onAddQuickShape,
  onAddText,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  leftDrawerOpen = true,
  onToggleLeftDrawer,
  rightInspectorOpen = true,
  onToggleRightInspector,
}) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [showRulers, setShowRulers] = useState(true);
  const [snapToMm, setSnapToMm] = useState(true);
  const [shapesMenuOpen, setShapesMenuOpen] = useState(false);
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [materialHudCollapsed, setMaterialHudCollapsed] = useState(true);
  const [cursorMm, setCursorMm] = useState<{ x: number; y: number } | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [activeGuides, setActiveGuides] = useState<SmartGuide[]>([]);

  const bedW = ATOMSTACK_X20_PRO_SPECS.bedWidthMm;
  const bedH = ATOMSTACK_X20_PRO_SPECS.bedHeightMm;
  const baseBedPx = 580;
  const bedPx = Math.round(baseBedPx * zoom);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedElements = useMemo(
    () => elements.filter((el) => selectedSet.has(el.id) && el.visible),
    [elements, selectedSet]
  );

  const selectionBounds = useMemo(() => {
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

  const singleSelected =
    selectedElements.length === 1 ? selectedElements[0] : null;

  const outOfBoundsCount = elements.filter(
    (el) =>
      el.visible &&
      (el.x < 0 ||
        el.y < 0 ||
        el.x + el.width > bedW ||
        el.y + el.height > bedH)
  ).length;

  useEffect(() => {
    if (!dragState) return;

    const handleMove = (e: PointerEvent) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const mmPerPxX = bedW / rect.width;
      const mmPerPxY = bedH / rect.height;

      if (dragState.type === 'marquee') {
        const mx = Math.max(0, Math.min(bedW, (e.clientX - rect.left) * mmPerPxX));
        const my = Math.max(0, Math.min(bedH, (e.clientY - rect.top) * mmPerPxY));
        setDragState((prev) =>
          prev && prev.type === 'marquee'
            ? { ...prev, currMmX: mx, currMmY: my }
            : prev
        );
        return;
      }

      const rawDx = (e.clientX - dragState.startClientX) * mmPerPxX;
      const rawDy = (e.clientY - dragState.startClientY) * mmPerPxY;

      if (dragState.type === 'move') {
        let dxMm = rawDx;
        let dyMm = rawDy;
        const guides: SmartGuide[] = [];

        const movingSet = new Set(dragState.items.map((it) => it.id));
        const staticTargets = elements.filter(
          (el) => el.visible && !movingSet.has(el.id)
        );

        const rawGX = dragState.groupOrigX + dxMm;
        const rawGY = dragState.groupOrigY + dyMm;
        const rawGW = dragState.groupWidth;
        const rawGH = dragState.groupHeight;

        const snapEnabled = snapToMm && !e.shiftKey;
        const snapThreshold = 2.6;

        if (snapEnabled) {
          // Candidate X alignments: Bed center (200) + static elements left, center, right
          const xCandidates: Array<{
            target: number;
            sourceOffset: number;
            spanStart: number;
            spanEnd: number;
            kind: 'center' | 'edge';
          }> = [
            {
              target: bedW / 2,
              sourceOffset: rawGW / 2,
              spanStart: 0,
              spanEnd: bedH,
              kind: 'center',
            },
          ];

          const yCandidates: Array<{
            target: number;
            sourceOffset: number;
            spanStart: number;
            spanEnd: number;
            kind: 'center' | 'edge';
          }> = [
            {
              target: bedH / 2,
              sourceOffset: rawGH / 2,
              spanStart: 0,
              spanEnd: bedW,
              kind: 'center',
            },
          ];

          for (const other of staticTargets) {
            const oLeft = other.x;
            const oCenterX = other.x + other.width / 2;
            const oRight = other.x + other.width;
            const spanYStart = Math.min(rawGY, other.y);
            const spanYEnd = Math.max(rawGY + rawGH, other.y + other.height);

            // Moving Left, Center, Right against other Left, Center, Right
            for (const [tVal, kind] of [
              [oLeft, 'edge'],
              [oCenterX, 'center'],
              [oRight, 'edge'],
            ] as const) {
              xCandidates.push(
                { target: tVal, sourceOffset: 0, spanStart: spanYStart, spanEnd: spanYEnd, kind },
                { target: tVal, sourceOffset: rawGW / 2, spanStart: spanYStart, spanEnd: spanYEnd, kind },
                { target: tVal, sourceOffset: rawGW, spanStart: spanYStart, spanEnd: spanYEnd, kind }
              );
            }

            const oTop = other.y;
            const oCenterY = other.y + other.height / 2;
            const oBottom = other.y + other.height;
            const spanXStart = Math.min(rawGX, other.x);
            const spanXEnd = Math.max(rawGX + rawGW, other.x + other.width);

            for (const [tVal, kind] of [
              [oTop, 'edge'],
              [oCenterY, 'center'],
              [oBottom, 'edge'],
            ] as const) {
              yCandidates.push(
                { target: tVal, sourceOffset: 0, spanStart: spanXStart, spanEnd: spanXEnd, kind },
                { target: tVal, sourceOffset: rawGH / 2, spanStart: spanXStart, spanEnd: spanXEnd, kind },
                { target: tVal, sourceOffset: rawGH, spanStart: spanXStart, spanEnd: spanXEnd, kind }
              );
            }
          }

          let bestXDelta = snapThreshold + 1;
          let bestXSnap: (typeof xCandidates)[number] | null = null;
          for (const c of xCandidates) {
            const delta = Math.abs(rawGX + c.sourceOffset - c.target);
            if (delta <= snapThreshold && delta < bestXDelta) {
              bestXDelta = delta;
              bestXSnap = c;
            }
          }

          if (bestXSnap) {
            const snappedGX = bestXSnap.target - bestXSnap.sourceOffset;
            dxMm = snappedGX - dragState.groupOrigX;
            guides.push({
              axis: 'x',
              pos: bestXSnap.target,
              start: bestXSnap.spanStart,
              end: bestXSnap.spanEnd,
              kind: bestXSnap.kind,
            });
          } else {
            dxMm = Math.round(rawDx);
          }

          let bestYDelta = snapThreshold + 1;
          let bestYSnap: (typeof yCandidates)[number] | null = null;
          for (const c of yCandidates) {
            const delta = Math.abs(rawGY + c.sourceOffset - c.target);
            if (delta <= snapThreshold && delta < bestYDelta) {
              bestYDelta = delta;
              bestYSnap = c;
            }
          }

          if (bestYSnap) {
            const snappedGY = bestYSnap.target - bestYSnap.sourceOffset;
            dyMm = snappedGY - dragState.groupOrigY;
            guides.push({
              axis: 'y',
              pos: bestYSnap.target,
              start: bestYSnap.spanStart,
              end: bestYSnap.spanEnd,
              kind: bestYSnap.kind,
            });
          } else {
            dyMm = Math.round(rawDy);
          }
        }

        setActiveGuides(guides);
        onMoveElements(
          dragState.items.map((item) => ({
            id: item.id,
            x: Number((item.origX + dxMm).toFixed(1)),
            y: Number((item.origY + dyMm).toFixed(1)),
          })),
          false
        );
      } else if (dragState.type === 'resize') {
        const snap = (v: number) =>
          snapToMm && !e.shiftKey ? Math.round(v) : Number(v.toFixed(1));

        let newX = dragState.origX;
        let newY = dragState.origY;
        let newW = dragState.origW;
        let newH = dragState.origH;

        if (dragState.corner.includes('e')) {
          newW = Math.max(4, dragState.origW + rawDx);
        }
        if (dragState.corner.includes('s')) {
          newH = Math.max(4, dragState.origH + rawDy);
        }
        if (dragState.corner.includes('w')) {
          const nextW = Math.max(4, dragState.origW - rawDx);
          newX = dragState.origX + (dragState.origW - nextW);
          newW = nextW;
        }
        if (dragState.corner.includes('n')) {
          const nextH = Math.max(4, dragState.origH - rawDy);
          newY = dragState.origY + (dragState.origH - nextH);
          newH = nextH;
        }

        if (e.shiftKey) {
          const ratio = dragState.origH / Math.max(0.1, dragState.origW);
          newH = newW * ratio;
        }

        onUpdateElement(
          dragState.id,
          {
            x: snap(newX),
            y: snap(newY),
            width: Math.max(4, snap(newW)),
            height: Math.max(4, snap(newH)),
          },
          false
        );
      }
    };

    const handleUp = () => {
      if (dragState.type === 'marquee') {
        const x1 = Math.min(dragState.startMmX, dragState.currMmX);
        const y1 = Math.min(dragState.startMmY, dragState.currMmY);
        const x2 = Math.max(dragState.startMmX, dragState.currMmX);
        const y2 = Math.max(dragState.startMmY, dragState.currMmY);

        const movedEnough = x2 - x1 > 2 || y2 - y1 > 2;
        if (movedEnough) {
          const hitIds = elements
            .filter(
              (el) =>
                el.visible &&
                el.x + el.width >= x1 &&
                el.x <= x2 &&
                el.y + el.height >= y1 &&
                el.y <= y2
            )
            .map((el) => el.id);

          if (dragState.additive) {
            const combined = Array.from(
              new Set([...dragState.baseSelectedIds, ...hitIds])
            );
            onSelectElements(combined);
          } else {
            onSelectElements(hitIds);
          }
        } else if (!dragState.additive) {
          onSelectElements([]);
        }
      } else if (dragState.type === 'move') {
        onMoveElements([], true);
      } else if (dragState.type === 'resize') {
        onUpdateElement(dragState.id, {}, true);
      }
      setActiveGuides([]);
      setDragState(null);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [
    dragState,
    bedW,
    bedH,
    elements,
    snapToMm,
    onMoveElements,
    onSelectElements,
    onUpdateElement,
  ]);

  const minorTicks = Array.from({ length: 41 }, (_, i) => i * 10);

  const getColors = (layer: 'cut' | 'score' | 'engrave') => {
    if (viewMode === 'material') {
      if (layer === 'cut') {
        return { stroke: material.cutEdgeColor, fill: 'none' };
      }
      if (layer === 'score') {
        return { stroke: material.scoreBurnColor, fill: 'none' };
      }
      return { stroke: 'none', fill: material.engraveBurnColor };
    }
    if (layer === 'cut') return { stroke: '#EF4444', fill: 'none' };
    if (layer === 'score') return { stroke: '#06B6D4', fill: 'none' };
    return { stroke: 'none', fill: '#F59E0B' };
  };

  const handleElementPointerDown = (
    e: React.PointerEvent,
    el: LaserElement
  ) => {
    e.stopPropagation();

    if (e.shiftKey) {
      const nextIds = selectedSet.has(el.id)
        ? selectedIds.filter((id) => id !== el.id)
        : [...selectedIds, el.id];
      onSelectElements(nextIds);
      return;
    }

    const activeIds = selectedSet.has(el.id) ? selectedIds : [el.id];
    if (!selectedSet.has(el.id)) {
      onSelectElements([el.id]);
    }

    const activeSet = new Set(activeIds);
    const movableItems = elements
      .filter((item) => activeSet.has(item.id) && item.visible && !item.locked)
      .map((item) => ({
        id: item.id,
        origX: item.x,
        origY: item.y,
        width: item.width,
        height: item.height,
      }));

    if (movableItems.length === 0) return;

    const minX = Math.min(...movableItems.map((i) => i.origX));
    const minY = Math.min(...movableItems.map((i) => i.origY));
    const maxX = Math.max(...movableItems.map((i) => i.origX + i.width));
    const maxY = Math.max(...movableItems.map((i) => i.origY + i.height));

    setDragState({
      type: 'move',
      startClientX: e.clientX,
      startClientY: e.clientY,
      items: movableItems,
      groupOrigX: minX,
      groupOrigY: minY,
      groupWidth: maxX - minX,
      groupHeight: maxY - minY,
    });
  };

  const marqueeRect =
    dragState?.type === 'marquee'
      ? {
          x: Math.min(dragState.startMmX, dragState.currMmX),
          y: Math.min(dragState.startMmY, dragState.currMmY),
          w: Math.abs(dragState.currMmX - dragState.startMmX),
          h: Math.abs(dragState.currMmY - dragState.startMmY),
        }
      : null;

  return (
    <div className="relative flex h-full flex-1 flex-col bg-[#0B0E14] min-w-0">
      {/* Simplified Contextual Canvas Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#232A3B] bg-[#10141D] px-3 py-2">
        <div className="flex items-center gap-1.5">
          {onToggleLeftDrawer && (
            <button
              type="button"
              onClick={onToggleLeftDrawer}
              title={leftDrawerOpen ? 'Hide Tools Panel' : 'Show Tools Panel'}
              className={`flex h-8 w-8 items-center justify-center rounded border transition-colors ${
                leftDrawerOpen
                  ? 'border-[#232A3B] bg-[#131722] text-[#94A3B8] hover:text-white'
                  : 'border-[#38BDF8]/50 bg-[#172030] text-[#38BDF8]'
              }`}
            >
              <PanelLeft className="h-3.5 w-3.5" />
            </button>
          )}

          <button
            type="button"
            disabled={!canUndo}
            onClick={onUndo}
            title="Undo (Ctrl+Z)"
            className="flex h-8 w-8 items-center justify-center rounded border border-[#232A3B] bg-[#131722] text-[#CBD5E1] transition-colors hover:bg-[#1C2233] disabled:opacity-35"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            disabled={!canRedo}
            onClick={onRedo}
            title="Redo (Ctrl+Shift+Z)"
            className="flex h-8 w-8 items-center justify-center rounded border border-[#232A3B] bg-[#131722] text-[#CBD5E1] transition-colors hover:bg-[#1C2233] disabled:opacity-35"
          >
            <Redo2 className="h-3.5 w-3.5" />
          </button>

          <div className="mx-1 h-4 w-px bg-[#232A3B]" />

          <button
            type="button"
            onClick={onAddText}
            className="flex h-8 items-center gap-1.5 rounded border border-[#232A3B] bg-[#131722] px-2.5 text-xs font-medium text-[#E2E8F0] whitespace-nowrap transition-colors hover:bg-[#1C2233]"
          >
            <TypeIcon className="h-3.5 w-3.5 text-[#F59E0B]" />
            Text
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setShapesMenuOpen((v) => !v)}
              className="flex h-8 items-center gap-1.5 rounded border border-[#232A3B] bg-[#131722] px-2.5 text-xs font-medium text-[#E2E8F0] whitespace-nowrap transition-colors hover:bg-[#1C2233]"
            >
              <Square className="h-3.5 w-3.5 text-[#EF4444]" />
              Shape
            </button>
            {shapesMenuOpen && (
              <div
                onMouseLeave={() => setShapesMenuOpen(false)}
                className="absolute top-9 left-0 z-30 w-48 rounded-md border border-[#232A3B] bg-[#131722] p-1.5 shadow-xl"
              >
                {[
                  { id: 'rect', label: 'Rounded Rectangle', icon: Square },
                  { id: 'circle', label: 'Circle Frame', icon: Circle },
                  { id: 'hex', label: 'Hexagon Badge', icon: Hexagon },
                  { id: 'heart', label: 'Valentine Heart', icon: Heart },
                  { id: 'star', label: '5-Point Star', icon: Star },
                  { id: 'hole', label: '4mm Keychain Hole', icon: Circle },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        onAddQuickShape(
                          item.id as
                            | 'rect'
                            | 'circle'
                            | 'heart'
                            | 'star'
                            | 'hex'
                            | 'hole'
                        );
                        setShapesMenuOpen(false);
                      }}
                      className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-xs text-[#E2E8F0] hover:bg-[#1E2638]"
                    >
                      <Icon className="h-3.5 w-3.5 text-[#94A3B8]" />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* View Mode + Grouped Canvas Options + Zoom */}
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md border border-[#232A3B] bg-[#0B0E14] p-0.5">
            <button
              type="button"
              onClick={() => onChangeViewMode('cad')}
              className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
                viewMode === 'cad'
                  ? 'bg-[#1F2737] text-white'
                  : 'text-[#94A3B8] hover:text-[#F1F5F9]'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              CAD
            </button>
            <button
              type="button"
              onClick={() => onChangeViewMode('material')}
              className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
                viewMode === 'material'
                  ? 'bg-[#1F2737] text-white'
                  : 'text-[#94A3B8] hover:text-[#F1F5F9]'
              }`}
            >
              <Eye className="h-3.5 w-3.5" />
              Preview
            </button>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setViewMenuOpen((v) => !v)}
              title="Bed Grid, Rulers & Snapping"
              className="flex h-8 items-center gap-1.5 rounded border border-[#232A3B] bg-[#131722] px-2.5 text-xs font-medium text-[#CBD5E1] whitespace-nowrap transition-colors hover:bg-[#1C2233] hover:text-white"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-[#94A3B8]" />
              View
            </button>
            {viewMenuOpen && (
              <div
                onMouseLeave={() => setViewMenuOpen(false)}
                className="absolute top-9 right-0 z-30 w-48 rounded-md border border-[#232A3B] bg-[#131722] p-1.5 shadow-xl space-y-0.5"
              >
                <button
                  type="button"
                  onClick={() => setShowGrid((v) => !v)}
                  className="flex w-full items-center justify-between rounded px-2.5 py-1.5 text-xs text-[#E2E8F0] hover:bg-[#1E2638]"
                >
                  <span className="flex items-center gap-2">
                    <Grid3X3 className="h-3.5 w-3.5 text-[#94A3B8]" />
                    Millimeter Grid
                  </span>
                  <span className="font-mono text-[10px] text-[#38BDF8]">
                    {showGrid ? 'ON' : 'OFF'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowRulers((v) => !v)}
                  className="flex w-full items-center justify-between rounded px-2.5 py-1.5 text-xs text-[#E2E8F0] hover:bg-[#1E2638]"
                >
                  <span className="flex items-center gap-2">
                    <Ruler className="h-3.5 w-3.5 text-[#94A3B8]" />
                    Edge Rulers
                  </span>
                  <span className="font-mono text-[10px] text-[#38BDF8]">
                    {showRulers ? 'ON' : 'OFF'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setSnapToMm((v) => !v)}
                  className="flex w-full items-center justify-between rounded px-2.5 py-1.5 text-xs text-[#E2E8F0] hover:bg-[#1E2638]"
                >
                  <span className="flex items-center gap-2">
                    <Magnet className="h-3.5 w-3.5 text-[#94A3B8]" />
                    Smart Guides & Snap
                  </span>
                  <span className="font-mono text-[10px] text-[#38BDF8]">
                    {snapToMm ? 'ON' : 'OFF'}
                  </span>
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center rounded border border-[#232A3B] bg-[#131722]">
            <button
              type="button"
              onClick={() =>
                setZoom((z) => Math.max(0.6, Number((z - 0.15).toFixed(2))))
              }
              className="flex h-8 w-7 items-center justify-center text-[#94A3B8] hover:text-white"
              title="Zoom out"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <span className="px-1.5 font-mono text-[11px] text-[#CBD5E1] tabular-nums">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() =>
                setZoom((z) => Math.min(2.2, Number((z + 0.15).toFixed(2))))
              }
              className="flex h-8 w-7 items-center justify-center text-[#94A3B8] hover:text-white"
              title="Zoom in"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setZoom(1)}
              className="flex h-8 w-7 items-center justify-center border-l border-[#232A3B] text-[#94A3B8] hover:text-white"
              title="Reset zoom"
            >
              <Maximize2 className="h-3 w-3" />
            </button>
          </div>

          {onToggleRightInspector && !rightInspectorOpen && (
            <button
              type="button"
              onClick={onToggleRightInspector}
              title="Show Inspector"
              className="flex h-8 w-8 items-center justify-center rounded border border-[#38BDF8]/50 bg-[#172030] text-[#38BDF8] transition-colors hover:bg-[#1E2B40]"
            >
              <PanelRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Out of bounds alert */}
      {outOfBoundsCount > 0 && (
        <div className="flex items-center gap-2 border-b border-[#F59E0B]/30 bg-[#F59E0B]/10 px-4 py-1.5 text-xs text-[#FCD34D]">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>
            {outOfBoundsCount} element
            {outOfBoundsCount > 1 ? 's extend' : ' extends'} outside the 400 ×
            400 mm AtomStack X20 Pro working area.
          </span>
        </div>
      )}

      {/* Main Centered Laser Bed Viewport */}
      <div
        ref={viewportRef}
        onClick={() => onSelectElements([])}
        className="relative flex-1 overflow-auto p-6"
      >
        <div className="mx-auto flex flex-col items-center">
          <div className="mb-2 flex w-full max-w-[660px] items-center justify-between text-[11px] text-[#94A3B8]">
            <span>
              AtomStack X20 Pro Working Bed (400 × 400 mm)
              {selectedElements.length > 1
                ? ` · ${selectedElements.length} selected`
                : ''}
            </span>
            <span className="font-mono tabular-nums">
              {cursorMm
                ? `X ${cursorMm.x.toFixed(1)} · Y ${cursorMm.y.toFixed(1)} mm`
                : viewMode === 'material'
                  ? `${material.name}`
                  : 'Shift+Click or drag box to multi-select'}
            </span>
          </div>

          <div
            className="relative select-none"
            style={{
              width: bedPx + (showRulers ? 32 : 0),
              height: bedPx + (showRulers ? 28 : 0),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {showRulers && (
              <div className="flex">
                <div className="flex h-7 w-8 shrink-0 items-center justify-center border-r border-b border-[#232A3B] bg-[#0B0E14] font-mono text-[9px] font-medium text-[#64748B]">
                  mm
                </div>

                {/* Horizontal Top Millimeter Ruler */}
                <div
                  className="relative h-7 overflow-hidden border-b border-[#232A3B] bg-[#0F131C]"
                  style={{ width: bedPx }}
                >
                  {selectionBounds && (
                    <div
                      className="pointer-events-none absolute top-0 bottom-0 bg-[#38BDF8]/18 border-x border-[#38BDF8]/70"
                      style={{
                        left: `${Math.max(0, (selectionBounds.x / bedW) * 100)}%`,
                        width: `${Math.min(100, (selectionBounds.width / bedW) * 100)}%`,
                      }}
                    />
                  )}
                  {minorTicks.map((mm) => {
                    const isMajor = mm % 50 === 0;
                    return (
                      <div
                        key={`h-${mm}`}
                        className="absolute bottom-0"
                        style={{ left: `${(mm / bedW) * 100}%` }}
                      >
                        {isMajor && (
                          <span
                            className={`absolute bottom-2.5 font-mono text-[9px] tabular-nums ${
                              mm === 400
                                ? '-translate-x-full pr-0.5 text-[#94A3B8]'
                                : mm === 0
                                  ? 'translate-x-0.5 text-[#94A3B8]'
                                  : '-translate-x-1/2 text-[#94A3B8]'
                            }`}
                          >
                            {mm}
                          </span>
                        )}
                        <div
                          className={
                            isMajor
                              ? 'h-2 w-px bg-[#475569]'
                              : 'h-1 w-px bg-[#273145]'
                          }
                        />
                      </div>
                    );
                  })}
                  {cursorMm && (
                    <div
                      className="pointer-events-none absolute top-0 bottom-0 w-px bg-[#EF4444]"
                      style={{ left: `${(cursorMm.x / bedW) * 100}%` }}
                    />
                  )}
                </div>
              </div>
            )}

            <div className="flex">
              {showRulers && (
                <div
                  className="relative w-8 shrink-0 overflow-hidden border-r border-[#232A3B] bg-[#0F131C]"
                  style={{ height: bedPx }}
                >
                  {selectionBounds && (
                    <div
                      className="pointer-events-none absolute right-0 left-0 bg-[#38BDF8]/18 border-y border-[#38BDF8]/70"
                      style={{
                        top: `${Math.max(0, (selectionBounds.y / bedH) * 100)}%`,
                        height: `${Math.min(100, (selectionBounds.height / bedH) * 100)}%`,
                      }}
                    />
                  )}
                  {minorTicks.map((mm) => {
                    const isMajor = mm % 50 === 0;
                    return (
                      <div
                        key={`v-${mm}`}
                        className="absolute right-0 flex items-center"
                        style={{ top: `${(mm / bedH) * 100}%` }}
                      >
                        {isMajor && (
                          <span
                            className={`pr-1.5 font-mono text-[9px] text-[#94A3B8] tabular-nums ${
                              mm === 400
                                ? '-translate-y-full'
                                : mm === 0
                                  ? 'translate-y-0.5'
                                  : '-translate-y-1/2'
                            }`}
                          >
                            {mm}
                          </span>
                        )}
                        <div
                          className={
                            isMajor
                              ? 'h-px w-2 bg-[#475569]'
                              : 'h-px w-1 bg-[#273145]'
                          }
                        />
                      </div>
                    );
                  })}
                  {cursorMm && (
                    <div
                      className="pointer-events-none absolute right-0 left-0 h-px bg-[#EF4444]"
                      style={{ top: `${(cursorMm.y / bedH) * 100}%` }}
                    />
                  )}
                </div>
              )}

              {/* 400x400mm Interactive SVG Bed */}
              <div
                className="relative overflow-hidden border border-[#2D364C] shadow-2xl"
                style={{
                  width: bedPx,
                  height: bedPx,
                  backgroundColor:
                    viewMode === 'material' ? material.surfaceColor : '#10141D',
                }}
              >
                <svg
                  ref={svgRef}
                  viewBox={`0 0 ${bedW} ${bedH}`}
                  className="h-full w-full"
                  onPointerMove={(e) => {
                    const rect = svgRef.current?.getBoundingClientRect();
                    if (!rect) return;
                    const mx = Math.max(
                      0,
                      Math.min(bedW, ((e.clientX - rect.left) / rect.width) * bedW)
                    );
                    const my = Math.max(
                      0,
                      Math.min(bedH, ((e.clientY - rect.top) / rect.height) * bedH)
                    );
                    setCursorMm({ x: mx, y: my });
                  }}
                  onPointerLeave={() => setCursorMm(null)}
                  onPointerDown={(e) => {
                    if (e.target !== svgRef.current) return;
                    const rect = svgRef.current.getBoundingClientRect();
                    const mx = Math.max(
                      0,
                      Math.min(bedW, ((e.clientX - rect.left) / rect.width) * bedW)
                    );
                    const my = Math.max(
                      0,
                      Math.min(bedH, ((e.clientY - rect.top) / rect.height) * bedH)
                    );
                    setDragState({
                      type: 'marquee',
                      startMmX: mx,
                      startMmY: my,
                      currMmX: mx,
                      currMmY: my,
                      additive: e.shiftKey,
                      baseSelectedIds: selectedIds,
                    });
                  }}
                >
                  <defs>
                    <pattern
                      id="grid-10mm"
                      width="10"
                      height="10"
                      patternUnits="userSpaceOnUse"
                    >
                      <path
                        d="M 10 0 L 0 0 0 10"
                        fill="none"
                        stroke={
                          viewMode === 'material'
                            ? material.invertRecommended ||
                              material.id === 'acrylic-black-3mm'
                              ? 'rgba(255,255,255,0.07)'
                              : 'rgba(0,0,0,0.09)'
                            : '#1A202E'
                        }
                        strokeWidth="0.35"
                      />
                    </pattern>
                    <pattern
                      id="grid-50mm"
                      width="50"
                      height="50"
                      patternUnits="userSpaceOnUse"
                    >
                      <rect width="50" height="50" fill="url(#grid-10mm)" />
                      <path
                        d="M 50 0 L 0 0 0 50"
                        fill="none"
                        stroke={
                          viewMode === 'material'
                            ? material.invertRecommended ||
                              material.id === 'acrylic-black-3mm'
                              ? 'rgba(255,255,255,0.14)'
                              : 'rgba(0,0,0,0.17)'
                            : '#242C3F'
                        }
                        strokeWidth="0.6"
                      />
                    </pattern>

                    {/* Wood Grain Texture (Basswood & Birch Plywood) */}
                    <pattern
                      id="mat-tex-wood"
                      width="120"
                      height="60"
                      patternUnits="userSpaceOnUse"
                    >
                      <path
                        d="M0,7 C30,4 62,10 120,6 M0,16 C40,19 85,12 120,17 M0,26 C35,23 78,29 120,25 M0,37 C45,40 90,33 120,38 M0,48 C28,45 72,52 120,47 M0,56 C48,58 88,54 120,56"
                        fill="none"
                        stroke={viewMode === 'material' ? '#7C4F28' : '#E2B98A'}
                        strokeOpacity={viewMode === 'material' ? 0.24 : 0.18}
                        strokeWidth="0.7"
                      />
                      <path
                        d="M0,11 C45,10 80,14 120,11 M12,31 C48,26 84,36 114,31 M0,42 C36,44 74,40 120,43"
                        fill="none"
                        stroke={viewMode === 'material' ? '#5C3819' : '#C89B6C'}
                        strokeOpacity={viewMode === 'material' ? 0.16 : 0.12}
                        strokeWidth="1.2"
                      />
                      <ellipse
                        cx="68"
                        cy="31"
                        rx="14"
                        ry="3.2"
                        fill="none"
                        stroke={viewMode === 'material' ? '#6D431E' : '#D4A879'}
                        strokeOpacity={viewMode === 'material' ? 0.18 : 0.14}
                        strokeWidth="0.55"
                      />
                    </pattern>

                    {/* Cast Acrylic Gloss & Specular Sheen */}
                    <linearGradient
                      id="mat-gloss-acrylic"
                      x1="0"
                      y1="0"
                      x2="1"
                      y2="1"
                    >
                      <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.12" />
                      <stop offset="28%" stopColor="#FFFFFF" stopOpacity="0.02" />
                      <stop offset="48%" stopColor="#38BDF8" stopOpacity="0.06" />
                      <stop offset="68%" stopColor="#FFFFFF" stopOpacity="0.01" />
                      <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.09" />
                    </linearGradient>
                    <pattern
                      id="mat-tex-acrylic"
                      width="160"
                      height="160"
                      patternUnits="userSpaceOnUse"
                    >
                      <path
                        d="M-20,40 L60,-40 M10,170 L170,10 M70,180 L190,60"
                        stroke="#FFFFFF"
                        strokeOpacity={viewMode === 'material' ? 0.06 : 0.045}
                        strokeWidth="10"
                      />
                      <path
                        d="M-10,100 L100,-10"
                        stroke="#E0F2FE"
                        strokeOpacity={viewMode === 'material' ? 0.045 : 0.035}
                        strokeWidth="3"
                      />
                    </pattern>

                    {/* Natural Black Slate Stone Cleavage */}
                    <pattern
                      id="mat-tex-slate"
                      width="100"
                      height="100"
                      patternUnits="userSpaceOnUse"
                    >
                      <path
                        d="M0,18 L34,14 L68,22 L100,16 M0,54 L28,59 L64,49 L100,56 M0,84 L42,79 L76,87 L100,82"
                        fill="none"
                        stroke="#94A3B8"
                        strokeOpacity={viewMode === 'material' ? 0.18 : 0.16}
                        strokeWidth="0.65"
                      />
                      <path
                        d="M14,0 L20,38 L12,74 L19,100 M62,0 L56,44 L66,78 L60,100"
                        fill="none"
                        stroke="#0F172A"
                        strokeOpacity={viewMode === 'material' ? 0.42 : 0.35}
                        strokeWidth="0.9"
                      />
                      <circle cx="24" cy="30" r="0.8" fill="#CBD5E1" fillOpacity="0.18" />
                      <circle cx="78" cy="64" r="1.1" fill="#CBD5E1" fillOpacity="0.14" />
                      <circle cx="48" cy="14" r="0.7" fill="#94A3B8" fillOpacity="0.2" />
                      <circle cx="88" cy="28" r="0.9" fill="#0F172A" fillOpacity="0.45" />
                    </pattern>

                    {/* Brushed Anodized Aluminum */}
                    <linearGradient
                      id="mat-sheen-aluminum"
                      x1="0"
                      y1="0"
                      x2="1"
                      y2="0.4"
                    >
                      <stop offset="0%" stopColor="#E2E8F0" stopOpacity="0.06" />
                      <stop offset="45%" stopColor="#F8FAFC" stopOpacity="0.14" />
                      <stop offset="100%" stopColor="#64748B" stopOpacity="0.08" />
                    </linearGradient>
                    <pattern
                      id="mat-tex-aluminum"
                      width="60"
                      height="16"
                      patternUnits="userSpaceOnUse"
                    >
                      <path
                        d="M0,2 H60 M0,5 H60 M0,9 H60 M0,13 H60"
                        stroke="#CBD5E1"
                        strokeOpacity={viewMode === 'material' ? 0.14 : 0.11}
                        strokeWidth="0.35"
                      />
                      <path
                        d="M0,7 H60 M0,15 H60"
                        stroke="#0F172A"
                        strokeOpacity={viewMode === 'material' ? 0.25 : 0.2}
                        strokeWidth="0.4"
                      />
                    </pattern>

                    {/* Veg-Tan Leather Pebble Grain */}
                    <pattern
                      id="mat-tex-leather"
                      width="24"
                      height="24"
                      patternUnits="userSpaceOnUse"
                    >
                      <circle cx="4" cy="5" r="2.1" fill="none" stroke="#3E2010" strokeOpacity="0.2" strokeWidth="0.45" />
                      <circle cx="13" cy="4" r="1.8" fill="none" stroke="#D9A37E" strokeOpacity="0.14" strokeWidth="0.4" />
                      <circle cx="20" cy="10" r="2.3" fill="none" stroke="#3E2010" strokeOpacity="0.18" strokeWidth="0.45" />
                      <circle cx="7" cy="14" r="2.2" fill="none" stroke="#3E2010" strokeOpacity="0.22" strokeWidth="0.45" />
                      <circle cx="16" cy="18" r="1.9" fill="none" stroke="#D9A37E" strokeOpacity="0.14" strokeWidth="0.4" />
                      <circle cx="3" cy="21" r="1.6" fill="none" stroke="#3E2010" strokeOpacity="0.18" strokeWidth="0.4" />
                    </pattern>

                    {/* Natural Cork Granules */}
                    <pattern
                      id="mat-tex-cork"
                      width="36"
                      height="36"
                      patternUnits="userSpaceOnUse"
                    >
                      <polygon points="3,4 9,3 11,8 5,10" fill="#5B3A1D" fillOpacity="0.22" />
                      <polygon points="18,6 25,4 27,10 20,12" fill="#E3B98A" fillOpacity="0.16" />
                      <polygon points="8,19 15,17 17,24 10,25" fill="#4A2B13" fillOpacity="0.2" />
                      <polygon points="24,22 32,19 33,27 25,29" fill="#5B3A1D" fillOpacity="0.18" />
                      <polygon points="14,29 20,28 21,34 15,35" fill="#E3B98A" fillOpacity="0.14" />
                      <circle cx="30" cy="9" r="1.8" fill="#4A2B13" fillOpacity="0.2" />
                    </pattern>

                    {/* Corrugated Kraft Cardboard */}
                    <pattern
                      id="mat-tex-cardboard"
                      width="14"
                      height="30"
                      patternUnits="userSpaceOnUse"
                    >
                      <rect x="0" y="0" width="4" height="30" fill="#4D3620" fillOpacity="0.14" />
                      <rect x="7" y="0" width="2.5" height="30" fill="#E2C39B" fillOpacity="0.08" />
                      <circle cx="5" cy="8" r="0.5" fill="#3B2614" fillOpacity="0.25" />
                      <circle cx="11" cy="21" r="0.6" fill="#3B2614" fillOpacity="0.22" />
                    </pattern>
                  </defs>

                  {/* Material Surface Base & Realistic Texture Overlay */}
                  {(() => {
                    const texturePatternId =
                      material.group === 'Wood'
                        ? 'mat-tex-wood'
                        : material.group === 'Acrylic'
                          ? 'mat-tex-acrylic'
                          : material.id === 'slate-stone'
                            ? 'mat-tex-slate'
                            : material.id === 'anodized-aluminum'
                              ? 'mat-tex-aluminum'
                              : material.id === 'leather-2mm'
                                ? 'mat-tex-leather'
                                : material.id === 'cork-3mm'
                                  ? 'mat-tex-cork'
                                  : 'mat-tex-cardboard';

                    return (
                      <g pointerEvents="none">
                        <rect
                          x="0"
                          y="0"
                          width={bedW}
                          height={bedH}
                          fill={material.surfaceColor}
                          fillOpacity={viewMode === 'material' ? 1 : 0.14}
                        />
                        <rect
                          x="0"
                          y="0"
                          width={bedW}
                          height={bedH}
                          fill={`url(#${texturePatternId})`}
                          fillOpacity={viewMode === 'material' ? 0.92 : 0.55}
                        />
                        {material.group === 'Acrylic' && (
                          <rect
                            x="0"
                            y="0"
                            width={bedW}
                            height={bedH}
                            fill="url(#mat-gloss-acrylic)"
                            fillOpacity={viewMode === 'material' ? 1 : 0.65}
                          />
                        )}
                        {material.id === 'anodized-aluminum' && (
                          <rect
                            x="0"
                            y="0"
                            width={bedW}
                            height={bedH}
                            fill="url(#mat-sheen-aluminum)"
                            fillOpacity={viewMode === 'material' ? 1 : 0.6}
                          />
                        )}
                      </g>
                    );
                  })()}

                  {showGrid && (
                    <rect
                      x="0"
                      y="0"
                      width={bedW}
                      height={bedH}
                      fill="url(#grid-50mm)"
                      pointerEvents="none"
                    />
                  )}

                  {showGrid && (
                    <g pointerEvents="none" opacity={0.35}>
                      <line
                        x1={200}
                        y1={0}
                        x2={200}
                        y2={400}
                        stroke={viewMode === 'material' ? '#000' : '#475569'}
                        strokeWidth="0.4"
                        strokeDasharray="2 2"
                      />
                      <line
                        x1={0}
                        y1={200}
                        x2={400}
                        y2={200}
                        stroke={viewMode === 'material' ? '#000' : '#475569'}
                        strokeWidth="0.4"
                        strokeDasharray="2 2"
                      />
                    </g>
                  )}

                  {/* Render Visible Laser Elements */}
                  {elements.map((el) => {
                    if (!el.visible) return null;
                    const cx = el.x + el.width / 2;
                    const cy = el.y + el.height / 2;
                    const rotateAttr =
                      el.rotation !== 0
                        ? `rotate(${el.rotation} ${cx} ${cy})`
                        : undefined;

                    if (el.kind === 'raster') {
                      return (
                        <g
                          key={el.id}
                          transform={rotateAttr}
                          style={{
                            cursor: el.locked ? 'not-allowed' : 'move',
                            mixBlendMode:
                              viewMode === 'material' && !material.invertRecommended
                                ? 'multiply'
                                : 'normal',
                          }}
                          onPointerDown={(e) => handleElementPointerDown(e, el)}
                        >
                          <image
                            href={el.processedDataUrl}
                            x={el.x}
                            y={el.y}
                            width={el.width}
                            height={el.height}
                            preserveAspectRatio="none"
                          />
                        </g>
                      );
                    }

                    if (el.kind === 'vector') {
                      const sx =
                        (el.width / el.viewBoxWidth) * (el.flipX ? -1 : 1);
                      const sy =
                        (el.height / el.viewBoxHeight) * (el.flipY ? -1 : 1);
                      const tx = el.flipX ? el.x + el.width : el.x;
                      const ty = el.flipY ? el.y + el.height : el.y;
                      const innerTransform = `translate(${tx} ${ty}) scale(${sx} ${sy})`;

                      return (
                        <g
                          key={el.id}
                          transform={rotateAttr}
                          style={{ cursor: el.locked ? 'not-allowed' : 'move' }}
                          onPointerDown={(e) => handleElementPointerDown(e, el)}
                        >
                          <rect
                            x={el.x}
                            y={el.y}
                            width={el.width}
                            height={el.height}
                            fill="transparent"
                          />
                          <g transform={innerTransform}>
                            {el.primitives.map((prim) => {
                              const layer = el.useSubLayers
                                ? prim.layer
                                : el.layer;
                              const colors = getColors(layer);
                              const strokeW =
                                layer === 'engrave'
                                  ? 0
                                  : 0.7 / Math.max(0.05, Math.abs(sx));
                              return (
                                <path
                                  key={prim.id}
                                  d={prim.d}
                                  fill={colors.fill}
                                  fillRule={prim.fillRule ?? 'nonzero'}
                                  stroke={colors.stroke}
                                  strokeWidth={strokeW}
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              );
                            })}
                          </g>
                        </g>
                      );
                    }

                    const tColors = getColors(el.layer);
                    const anchor =
                      el.align === 'center'
                        ? 'middle'
                        : el.align === 'right'
                          ? 'end'
                          : 'start';
                    const anchorX =
                      el.align === 'center'
                        ? el.x + el.width / 2
                        : el.align === 'right'
                          ? el.x + el.width
                          : el.x;
                    const baselineY = el.y + el.height * 0.78;

                    return (
                      <g
                        key={el.id}
                        transform={rotateAttr}
                        style={{ cursor: el.locked ? 'not-allowed' : 'move' }}
                        onPointerDown={(e) => handleElementPointerDown(e, el)}
                      >
                        <rect
                          x={el.x}
                          y={el.y}
                          width={el.width}
                          height={el.height}
                          fill="transparent"
                        />
                        <text
                          x={anchorX}
                          y={baselineY}
                          fontFamily={`${el.fontFamily}, sans-serif`}
                          fontSize={el.fontSizeMm}
                          fontWeight={el.fontWeight}
                          letterSpacing={el.letterSpacingMm}
                          textAnchor={anchor}
                          fill={el.layer === 'engrave' ? tColors.fill : 'none'}
                          stroke={el.layer === 'engrave' ? 'none' : tColors.stroke}
                          strokeWidth={el.layer === 'engrave' ? 0 : 0.45}
                        >
                          {el.text}
                        </text>
                      </g>
                    );
                  })}

                  {/* Smart Alignment Guides During Drag */}
                  {activeGuides.map((g, idx) =>
                    g.axis === 'x' ? (
                      <line
                        key={`gx-${idx}`}
                        x1={g.pos}
                        y1={Math.max(0, g.start - 8)}
                        x2={g.pos}
                        y2={Math.min(bedH, g.end + 8)}
                        stroke={g.kind === 'center' ? '#22D3EE' : '#F43F5E'}
                        strokeWidth={0.8}
                        strokeDasharray={g.kind === 'center' ? '3 1.5' : undefined}
                        pointerEvents="none"
                      />
                    ) : (
                      <line
                        key={`gy-${idx}`}
                        x1={Math.max(0, g.start - 8)}
                        y1={g.pos}
                        x2={Math.min(bedW, g.end + 8)}
                        y2={g.pos}
                        stroke={g.kind === 'center' ? '#22D3EE' : '#F43F5E'}
                        strokeWidth={0.8}
                        strokeDasharray={g.kind === 'center' ? '3 1.5' : undefined}
                        pointerEvents="none"
                      />
                    )
                  )}

                  {/* Multi-Selection Individual Outlines + Combined Bounding Frame */}
                  {selectedElements.length > 1 && selectionBounds && (
                    <g pointerEvents="none">
                      {selectedElements.map((sel) => (
                        <rect
                          key={`sel-${sel.id}`}
                          x={sel.x}
                          y={sel.y}
                          width={sel.width}
                          height={sel.height}
                          fill="none"
                          stroke="#38BDF8"
                          strokeOpacity={0.5}
                          strokeWidth={0.55}
                        />
                      ))}
                      <rect
                        x={selectionBounds.x}
                        y={selectionBounds.y}
                        width={selectionBounds.width}
                        height={selectionBounds.height}
                        fill="none"
                        stroke="#38BDF8"
                        strokeWidth={0.9}
                        strokeDasharray="3 1.5"
                      />
                    </g>
                  )}

                  {/* Single Selection Bounding Box & 4-Corner Resize Handles */}
                  {singleSelected && (
                    <g>
                      <rect
                        x={singleSelected.x}
                        y={singleSelected.y}
                        width={singleSelected.width}
                        height={singleSelected.height}
                        fill="none"
                        stroke="#38BDF8"
                        strokeWidth={0.8}
                        strokeDasharray="2.5 1.5"
                        pointerEvents="none"
                      />
                      {!singleSelected.locked &&
                        (
                          [
                            ['nw', singleSelected.x, singleSelected.y, 'nwse-resize'],
                            [
                              'ne',
                              singleSelected.x + singleSelected.width,
                              singleSelected.y,
                              'nesw-resize',
                            ],
                            [
                              'sw',
                              singleSelected.x,
                              singleSelected.y + singleSelected.height,
                              'nesw-resize',
                            ],
                            [
                              'se',
                              singleSelected.x + singleSelected.width,
                              singleSelected.y + singleSelected.height,
                              'nwse-resize',
                            ],
                          ] as const
                        ).map(([corner, hx, hy, cursor]) => (
                          <rect
                            key={corner}
                            x={hx - 2.4}
                            y={hy - 2.4}
                            width={4.8}
                            height={4.8}
                            rx={0.8}
                            fill="#0B0E14"
                            stroke="#38BDF8"
                            strokeWidth={0.9}
                            style={{ cursor }}
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              setDragState({
                                type: 'resize',
                                id: singleSelected.id,
                                corner,
                                startClientX: e.clientX,
                                startClientY: e.clientY,
                                origX: singleSelected.x,
                                origY: singleSelected.y,
                                origW: singleSelected.width,
                                origH: singleSelected.height,
                              });
                            }}
                          />
                        ))}
                    </g>
                  )}

                  {/* Marquee Drag Selection Box */}
                  {marqueeRect && (
                    <rect
                      x={marqueeRect.x}
                      y={marqueeRect.y}
                      width={marqueeRect.w}
                      height={marqueeRect.h}
                      fill="#38BDF8"
                      fillOpacity={0.12}
                      stroke="#38BDF8"
                      strokeWidth={0.75}
                      strokeDasharray="2.5 1.5"
                      pointerEvents="none"
                    />
                  )}
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Non-intrusive Floating Material & Parameter Indicator */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="absolute bottom-3 left-3 z-20 w-64 rounded-md border border-[#232A3B] bg-[#10141D]/92 backdrop-blur-xs shadow-lg"
      >
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-xs border border-white/20"
              style={{ backgroundColor: material.surfaceColor }}
            />
            <span className="truncate text-xs font-semibold text-[#F1F5F9]">
              {material.name}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="font-mono text-[11px] text-[#94A3B8] tabular-nums">
              {material.thicknessLabel}
            </span>
            <button
              type="button"
              onClick={() => setMaterialHudCollapsed((v) => !v)}
              aria-label={
                materialHudCollapsed
                  ? 'Expand material settings'
                  : 'Collapse material settings'
              }
              className="rounded p-0.5 text-[#94A3B8] transition-colors hover:bg-[#1E2534] hover:text-white"
            >
              {materialHudCollapsed ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>

        {!materialHudCollapsed && (
          <div className="border-t border-[#232A3B] px-3 py-2 space-y-1 text-[11px]">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-[#EF4444]">Cut</span>
              <span className="font-mono text-[#E2E8F0] tabular-nums">
                {material.cut
                  ? `${material.cut.speedMmMin} mm/min · ${material.cut.powerPct}%`
                  : 'Surface Only'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-[#F59E0B]">Engrave</span>
              <span className="font-mono text-[#E2E8F0] tabular-nums">
                {material.engrave.speedMmMin} mm/min · {material.engrave.powerPct}%
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
