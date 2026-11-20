import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Info, MessageSquare } from 'lucide-react';
import { AiGeneratorDrawer } from './components/AiGeneratorDrawer';
import { ChatDrawer } from './components/ChatDrawer';
import { ExportModal } from './components/ExportModal';
import {
  AlignAction,
  InspectorPanel,
  RelativeAlignAction,
} from './components/InspectorPanel';
import { LaserBedCanvas } from './components/LaserBedCanvas';
import { NameTagBatchDrawer } from './components/NameTagBatchDrawer';
import { ShortcutsOverviewModal } from './components/ShortcutsOverviewModal';
import { TemplatesDrawer } from './components/TemplatesDrawer';
import { UploadTraceDrawer } from './components/UploadTraceDrawer';
import { MATERIAL_PRESETS, SOFTWARE_PRESETS } from './data/atomstackPresets';
import { LASER_TEMPLATES } from './data/laserTemplates';
import {
  BedChatContext,
  LaserElement,
  LaserLayerType,
  SavedProject,
  SoftwarePresetId,
  StudioMode,
  TemplateDefinition,
  TextElement,
  ViewRenderMode,
} from './types/laser';
import {
  createQuickShapeElement,
  estimateTextWidthMm,
  instantiateTemplate,
  makeId,
} from './utils/elementFactory';

const PROJECTS_STORAGE_KEY = 'beamforge_atomstack_projects_v1';

function buildInitialStarterElements(): LaserElement[] {
  const starter =
    LASER_TEMPLATES.find((t) => t.id === 'valentine-floral-heart') ??
    LASER_TEMPLATES[0];
  return instantiateTemplate(starter, {
    primaryText: starter.defaultPrimaryText ?? 'Be Mine',
    secondaryText: starter.defaultSecondaryText ?? 'FEB 14 · FOREVER',
    hasHole: true,
    centerXMm: 200,
    centerYMm: 200,
    widthMm: 130,
    heightMm: 124,
  });
}

export default function App() {
  const [mode, setMode] = useState<StudioMode>('templates');
  const [softwareId, setSoftwareId] = useState<SoftwarePresetId>('lightburn');
  const [materialId, setMaterialId] = useState<string>('basswood-3mm');
  const [viewMode, setViewMode] = useState<ViewRenderMode>('cad');

  const [elements, setElements] = useState<LaserElement[]>(() =>
    buildInitialStarterElements()
  );
  const [history, setHistory] = useState<LaserElement[][]>([]);
  const [future, setFuture] = useState<LaserElement[][]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [exportOpen, setExportOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [leftDrawerOpen, setLeftDrawerOpen] = useState(true);
  const [rightInspectorOpen, setRightInspectorOpen] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const [savedProjects, setSavedProjects] = useState<SavedProject[]>(() => {
    try {
      const raw = localStorage.getItem(PROJECTS_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as SavedProject[]) : [];
    } catch {
      return [];
    }
  });

  const material = useMemo(
    () =>
      MATERIAL_PRESETS.find((m) => m.id === materialId) ?? MATERIAL_PRESETS[0],
    [materialId]
  );

  const notify = useCallback((msg: string) => {
    setToast(msg);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const commitElements = useCallback(
    (next: LaserElement[]) => {
      setHistory((prev) => [...prev.slice(-39), elements]);
      setFuture([]);
      setElements(next);
    },
    [elements]
  );

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setFuture((f) => [elements, ...f.slice(0, 39)]);
    setElements(prev);
    setSelectedIds([]);
  }, [elements, history]);

  const handleRedo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    setFuture((f) => f.slice(1));
    setHistory((h) => [...h.slice(-39), elements]);
    setElements(next);
    setSelectedIds([]);
  }, [elements, future]);

  const handleUpdateElement = useCallback(
    (id: string, patch: Partial<LaserElement>, commitHistory = true) => {
      setElements((curr) => {
        if (commitHistory) {
          setHistory((h) => [...h.slice(-39), curr]);
          setFuture([]);
        }
        return curr.map((el) =>
          el.id === id ? ({ ...el, ...patch } as LaserElement) : el
        );
      });
    },
    []
  );

  const handleMoveElements = useCallback(
    (
      updates: Array<{ id: string; x: number; y: number }>,
      commitHistory = true
    ) => {
      setElements((curr) => {
        if (commitHistory) {
          setHistory((h) => [...h.slice(-39), curr]);
          setFuture([]);
        }
        if (updates.length === 0) return curr;
        const map = new Map(updates.map((u) => [u.id, u]));
        return curr.map((el) => {
          const u = map.get(el.id);
          return u ? ({ ...el, x: u.x, y: u.y } as LaserElement) : el;
        });
      });
    },
    []
  );

  const handleBulkDelete = useCallback(
    (ids: string[]) => {
      const delSet = new Set(ids);
      const next = elements.filter((el) => !delSet.has(el.id));
      commitElements(next);
      setSelectedIds((prev) => prev.filter((id) => !delSet.has(id)));
    },
    [commitElements, elements]
  );

  const handleBulkDuplicate = useCallback(
    (ids: string[]) => {
      const selSet = new Set(ids);
      const targets = elements.filter((el) => selSet.has(el.id));
      if (targets.length === 0) return;
      const copies: LaserElement[] = targets.map((t) => ({
        ...t,
        id: makeId('copy'),
        name: `${t.name} Copy`,
        x: Number(Math.min(380, t.x + 12).toFixed(1)),
        y: Number(Math.min(380, t.y + 12).toFixed(1)),
      }));
      commitElements([...elements, ...copies]);
      setSelectedIds(copies.map((c) => c.id));
      notify(
        copies.length === 1
          ? `Duplicated "${targets[0].name}"`
          : `Duplicated ${copies.length} elements`
      );
    },
    [commitElements, elements, notify]
  );

  const handleBulkLayer = useCallback(
    (ids: string[], layer: LaserLayerType) => {
      const selSet = new Set(ids);
      const next = elements.map((el) => {
        if (!selSet.has(el.id) || el.kind === 'raster') return el;
        if (el.kind === 'vector') {
          return { ...el, useSubLayers: false, layer } as LaserElement;
        }
        return { ...el, layer } as LaserElement;
      });
      commitElements(next);
      notify(`Set ${ids.length} elements to ${layer.toUpperCase()} layer`);
    },
    [commitElements, elements, notify]
  );

  const handleBulkLock = useCallback(
    (ids: string[], locked: boolean) => {
      const selSet = new Set(ids);
      const next = elements.map((el) =>
        selSet.has(el.id) ? ({ ...el, locked } as LaserElement) : el
      );
      commitElements(next);
      notify(
        locked
          ? `Locked ${ids.length} elements`
          : `Unlocked ${ids.length} elements`
      );
    },
    [commitElements, elements, notify]
  );

  const handleAlignElement = useCallback(
    (id: string, action: AlignAction) => {
      const target = elements.find((el) => el.id === id);
      if (!target || target.locked) return;

      let nextX = target.x;
      let nextY = target.y;

      if (action === 'center-both') {
        nextX = Number((200 - target.width / 2).toFixed(1));
        nextY = Number((200 - target.height / 2).toFixed(1));
      } else if (action === 'center-x') {
        nextX = Number((200 - target.width / 2).toFixed(1));
      } else if (action === 'center-y') {
        nextY = Number((200 - target.height / 2).toFixed(1));
      } else if (action === 'edge-left') {
        nextX = 0;
      } else if (action === 'edge-right') {
        nextX = Number((400 - target.width).toFixed(1));
      } else if (action === 'edge-top') {
        nextY = 0;
      } else if (action === 'edge-bottom') {
        nextY = Number((400 - target.height).toFixed(1));
      }

      handleUpdateElement(id, { x: nextX, y: nextY }, true);
    },
    [elements, handleUpdateElement]
  );

  const handleBulkAlign = useCallback(
    (ids: string[], action: AlignAction | RelativeAlignAction) => {
      const selSet = new Set(ids);
      const targets = elements.filter(
        (el) => selSet.has(el.id) && el.visible && !el.locked
      );
      if (targets.length === 0) return;

      const minX = Math.min(...targets.map((t) => t.x));
      const minY = Math.min(...targets.map((t) => t.y));
      const maxX = Math.max(...targets.map((t) => t.x + t.width));
      const maxY = Math.max(...targets.map((t) => t.y + t.height));
      const groupW = maxX - minX;
      const groupH = maxY - minY;
      const groupCx = (minX + maxX) / 2;
      const groupCy = (minY + maxY) / 2;

      const updates = new Map<string, { x?: number; y?: number }>();

      if (action.startsWith('rel-')) {
        for (const t of targets) {
          if (action === 'rel-left') updates.set(t.id, { x: minX });
          else if (action === 'rel-center-x')
            updates.set(t.id, { x: Number((groupCx - t.width / 2).toFixed(1)) });
          else if (action === 'rel-right')
            updates.set(t.id, { x: Number((maxX - t.width).toFixed(1)) });
          else if (action === 'rel-top') updates.set(t.id, { y: minY });
          else if (action === 'rel-center-y')
            updates.set(t.id, { y: Number((groupCy - t.height / 2).toFixed(1)) });
          else if (action === 'rel-bottom')
            updates.set(t.id, { y: Number((maxY - t.height).toFixed(1)) });
        }
      } else {
        // Align whole group rigidly relative to the 400x400mm bed
        let dx = 0;
        let dy = 0;
        if (action === 'center-both') {
          dx = 200 - groupW / 2 - minX;
          dy = 200 - groupH / 2 - minY;
        } else if (action === 'center-x') {
          dx = 200 - groupW / 2 - minX;
        } else if (action === 'center-y') {
          dy = 200 - groupH / 2 - minY;
        } else if (action === 'edge-left') {
          dx = -minX;
        } else if (action === 'edge-right') {
          dx = 400 - maxX;
        } else if (action === 'edge-top') {
          dy = -minY;
        } else if (action === 'edge-bottom') {
          dy = 400 - maxY;
        }
        for (const t of targets) {
          updates.set(t.id, {
            x: Number((t.x + dx).toFixed(1)),
            y: Number((t.y + dy).toFixed(1)),
          });
        }
      }

      const next = elements.map((el) => {
        const patch = updates.get(el.id);
        return patch ? ({ ...el, ...patch } as LaserElement) : el;
      });
      commitElements(next);
    },
    [commitElements, elements]
  );

  const handleDistributeElements = useCallback(
    (axis: 'horizontal' | 'vertical', ids?: string[]) => {
      const idSet = ids && ids.length > 0 ? new Set(ids) : null;
      const movable = elements.filter(
        (el) => el.visible && !el.locked && (!idSet || idSet.has(el.id))
      );
      if (movable.length < 2) return;

      const sorted = [...movable].sort((a, b) =>
        axis === 'horizontal' ? a.x - b.x : a.y - b.y
      );

      const updates = new Map<string, { x?: number; y?: number }>();

      if (sorted.length === 2) {
        const gap = 10;
        const firstSize =
          axis === 'horizontal' ? sorted[0].width : sorted[0].height;
        const secondSize =
          axis === 'horizontal' ? sorted[1].width : sorted[1].height;
        const total = firstSize + gap + secondSize;
        const start = Number((200 - total / 2).toFixed(1));
        if (axis === 'horizontal') {
          updates.set(sorted[0].id, { x: start });
          updates.set(sorted[1].id, {
            x: Number((start + firstSize + gap).toFixed(1)),
          });
        } else {
          updates.set(sorted[0].id, { y: start });
          updates.set(sorted[1].id, {
            y: Number((start + firstSize + gap).toFixed(1)),
          });
        }
      } else {
        const minStart =
          axis === 'horizontal' ? sorted[0].x : sorted[0].y;
        const maxEnd = Math.max(
          ...sorted.map((el) =>
            axis === 'horizontal' ? el.x + el.width : el.y + el.height
          )
        );
        const totalSize = sorted.reduce(
          (sum, el) => sum + (axis === 'horizontal' ? el.width : el.height),
          0
        );
        const gap = (maxEnd - minStart - totalSize) / (sorted.length - 1);

        let cursor = minStart;
        for (const el of sorted) {
          const size = axis === 'horizontal' ? el.width : el.height;
          if (axis === 'horizontal') {
            updates.set(el.id, { x: Number(cursor.toFixed(1)) });
          } else {
            updates.set(el.id, { y: Number(cursor.toFixed(1)) });
          }
          cursor += size + gap;
        }
      }

      const next = elements.map((el) => {
        const patch = updates.get(el.id);
        return patch ? ({ ...el, ...patch } as LaserElement) : el;
      });

      commitElements(next);
      notify(
        `Distributed ${sorted.length} objects ${axis === 'horizontal' ? 'horizontally' : 'vertically'}`
      );
    },
    [commitElements, elements, notify]
  );

  const handleReorderElements = useCallback(
    (ids: string[], direction: 'front' | 'back') => {
      const selSet = new Set(ids);
      const selected = elements.filter((el) => selSet.has(el.id));
      if (selected.length === 0) return;
      const others = elements.filter((el) => !selSet.has(el.id));
      const next =
        direction === 'front'
          ? [...others, ...selected]
          : [...selected, ...others];
      commitElements(next);
      notify(
        direction === 'front'
          ? `Brought ${selected.length === 1 ? `"${selected[0].name}"` : `${selected.length} items`} to front`
          : `Sent ${selected.length === 1 ? `"${selected[0].name}"` : `${selected.length} items`} to back`
      );
    },
    [commitElements, elements, notify]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShortcutsOpen(false);
        setExportOpen(false);
        setChatOpen(false);
        return;
      }

      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === '?') {
        e.preventDefault();
        setShortcutsOpen((v) => !v);
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setSelectedIds(elements.filter((el) => el.visible).map((el) => el.id));
        return;
      }

      if (
        (e.metaKey || e.ctrlKey) &&
        e.key.toLowerCase() === 'd' &&
        selectedIds.length > 0
      ) {
        e.preventDefault();
        handleBulkDuplicate(selectedIds);
        return;
      }

      if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        selectedIds.length > 0
      ) {
        e.preventDefault();
        handleBulkDelete(selectedIds);
        return;
      }

      if (
        selectedIds.length > 0 &&
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)
      ) {
        e.preventDefault();
        const step = e.shiftKey ? 5 : 1;
        const selSet = new Set(selectedIds);
        const dx =
          e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0;
        const dy =
          e.key === 'ArrowDown' ? step : e.key === 'ArrowUp' ? -step : 0;
        const updates = elements
          .filter((el) => selSet.has(el.id) && !el.locked)
          .map((el) => ({
            id: el.id,
            x: Number((el.x + dx).toFixed(1)),
            y: Number((el.y + dy).toFixed(1)),
          }));
        if (updates.length > 0) {
          handleMoveElements(updates, true);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    elements,
    handleBulkDelete,
    handleBulkDuplicate,
    handleMoveElements,
    handleRedo,
    handleUndo,
    selectedIds,
  ]);

  const handleInsertTemplate = (
    template: TemplateDefinition,
    opts: { primaryText: string; secondaryText: string; hasHole: boolean },
    replaceBed: boolean
  ) => {
    const created = instantiateTemplate(template, {
      ...opts,
      centerXMm: 200,
      centerYMm: 200,
    });
    const next = replaceBed ? created : [...elements, ...created];
    commitElements(next);
    setSelectedIds(created.map((c) => c.id));
    notify(`Loaded "${template.title}" onto 400×400mm bed`);
  };

  const handleApplyBatch = (batch: LaserElement[], replaceBed: boolean) => {
    const next = replaceBed ? batch : [...elements, ...batch];
    commitElements(next);
    if (batch[0]) setSelectedIds([batch[0].id]);
    notify(`Generated ${Math.round(batch.length / 2)} cut-ready name tags`);
  };

  const handleInsertGenerated = (created: LaserElement[], replaceBed: boolean) => {
    const next = replaceBed ? created : [...elements, ...created];
    commitElements(next);
    setSelectedIds(created.map((c) => c.id));
    notify(`Generated "${created[0]?.name ?? 'AI Laser Design'}"`);
  };

  const handleAddUploaded = (el: LaserElement, replaceBed: boolean) => {
    const next = replaceBed ? [el] : [...elements, el];
    commitElements(next);
    setSelectedIds([el.id]);
    notify(`Placed "${el.name}" onto bed`);
  };

  const handleAddQuickShape = (
    shape: 'rect' | 'circle' | 'heart' | 'star' | 'hex' | 'hole'
  ) => {
    const el = createQuickShapeElement(shape, 'cut');
    commitElements([...elements, el]);
    setSelectedIds([el.id]);
  };

  const handleAddText = () => {
    const fontSizeMm = 12;
    const label = 'CUSTOM TEXT';
    const width = estimateTextWidthMm(label, fontSizeMm, 0.4);
    const height = Number((fontSizeMm * 1.25).toFixed(1));
    const el: TextElement = {
      id: makeId('txt'),
      kind: 'text',
      name: 'Custom Label',
      text: label,
      x: Number((200 - width / 2).toFixed(1)),
      y: Number((200 - height / 2).toFixed(1)),
      width,
      height,
      fontSizeMm,
      fontFamily: 'Plus Jakarta Sans',
      fontWeight: 700,
      letterSpacingMm: 0.4,
      align: 'center',
      rotation: 0,
      layer: 'engrave',
      visible: true,
      locked: false,
    };
    commitElements([...elements, el]);
    setSelectedIds([el.id]);
  };

  const persistProjects = (projects: SavedProject[]) => {
    setSavedProjects(projects);
    try {
      localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
    } catch {
      // Ignore storage quota errors
    }
  };

  const handleSaveProject = (name: string) => {
    const proj: SavedProject = {
      id: makeId('proj'),
      name,
      updatedAt: new Date().toISOString(),
      materialId,
      softwareId,
      elements,
    };
    persistProjects([proj, ...savedProjects]);
    notify(`Saved "${name}"`);
  };

  const handleLoadProject = (proj: SavedProject) => {
    commitElements(proj.elements);
    setMaterialId(proj.materialId);
    setSoftwareId(proj.softwareId);
    setSelectedIds(proj.elements[0] ? [proj.elements[0].id] : []);
    notify(`Loaded "${proj.name}"`);
  };

  const handleDeleteProject = (id: string) => {
    persistProjects(savedProjects.filter((p) => p.id !== id));
  };

  const bedChatContext: BedChatContext = useMemo(() => {
    const selectedSet = new Set(selectedIds);
    const activeSel = elements.filter((el) => selectedSet.has(el.id));
    const selectedSummary =
      activeSel.length === 1
        ? `${activeSel[0].name} (${activeSel[0].width.toFixed(0)}×${activeSel[0].height.toFixed(0)}mm, ${activeSel[0].kind})`
        : activeSel.length > 1
          ? `${activeSel.length} objects selected`
          : null;
    return {
      materialName: material.name,
      materialThickness: material.thicknessLabel,
      softwareName: SOFTWARE_PRESETS[softwareId].name,
      elementCount: elements.length,
      selectedSummary,
    };
  }, [elements, material, selectedIds, softwareId]);

  const navTabs: Array<{ id: StudioMode; label: string }> = [
    { id: 'templates', label: 'Templates' },
    { id: 'ai', label: 'AI Generator' },
    { id: 'trace', label: 'Upload & Trace' },
    { id: 'nametags', label: 'Name Tags' },
  ];

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#0B0E14] text-[#F1F5F9]">
      {/* Clean 3-Zone Top Bar */}
      <header className="flex h-14 shrink-0 items-center justify-between gap-8 border-b border-[#232A3B] bg-[#10141D] px-6">
        <span className="font-[var(--font-display)] text-base font-bold tracking-tight text-[#F1F5F9] whitespace-nowrap shrink-0">
          BeamForge Studio
        </span>

        <nav className="flex items-center gap-6">
          {navTabs.map((tab) => {
            const active = mode === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setMode(tab.id);
                  setLeftDrawerOpen(true);
                }}
                className={`relative py-4 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                  active
                    ? 'text-[#F1F5F9]'
                    : 'text-[#94A3B8] hover:text-[#E2E8F0]'
                }`}
              >
                {tab.label}
                {active && (
                  <span className="absolute right-0 bottom-0 left-0 h-0.5 bg-[#EF4444]" />
                )}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShortcutsOpen(true)}
            title="Keyboard Shortcuts Overview (?)"
            className="flex items-center gap-1.5 rounded-md border border-[#232A3B] bg-[#131722] px-3 py-2 text-xs font-medium text-[#CBD5E1] whitespace-nowrap shrink-0 transition-colors hover:border-[#334155] hover:bg-[#1B2233] hover:text-white"
          >
            <Info className="h-3.5 w-3.5 text-[#38BDF8]" />
            Overview
          </button>
          <button
            type="button"
            onClick={() => setChatOpen((v) => !v)}
            title="Toggle Studio Assistant"
            className={`flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
              chatOpen
                ? 'border-[#38BDF8]/60 bg-[#172030] text-white'
                : 'border-[#232A3B] bg-[#131722] text-[#CBD5E1] hover:border-[#334155] hover:bg-[#1B2233] hover:text-white'
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5 text-[#38BDF8]" />
            Assistant
          </button>
          <button
            type="button"
            onClick={() => setExportOpen(true)}
            className="flex items-center gap-2 rounded-md bg-[#EF4444] px-4 py-2 text-xs font-semibold text-white whitespace-nowrap shrink-0 transition-colors hover:bg-[#DC2626]"
          >
            <Download className="h-3.5 w-3.5" />
            Export Design
          </button>
        </div>
      </header>

      {/* Main Collapsible Precision CAD Studio */}
      <main className="flex min-h-0 flex-1 overflow-hidden">
        {leftDrawerOpen && (
          <section className="h-full w-[310px] shrink-0 border-r border-[#232A3B] bg-[#131722] overflow-hidden">
            {mode === 'templates' && (
              <TemplatesDrawer
                onInsertTemplate={handleInsertTemplate}
                onSelectMaterial={(id) => setMaterialId(id)}
              />
            )}
            {mode === 'ai' && (
              <AiGeneratorDrawer onInsertGenerated={handleInsertGenerated} />
            )}
            {mode === 'trace' && (
              <UploadTraceDrawer
                onAddElement={handleAddUploaded}
                invertRecommended={material.invertRecommended}
              />
            )}
            {mode === 'nametags' && (
              <NameTagBatchDrawer onApplyBatch={handleApplyBatch} />
            )}
          </section>
        )}

        {/* Center 400x400mm Interactive Laser Bed */}
        <LaserBedCanvas
          elements={elements}
          selectedIds={selectedIds}
          material={material}
          viewMode={viewMode}
          onChangeViewMode={setViewMode}
          onSelectElements={setSelectedIds}
          onUpdateElement={handleUpdateElement}
          onMoveElements={handleMoveElements}
          onAddQuickShape={handleAddQuickShape}
          onAddText={handleAddText}
          canUndo={history.length > 0}
          canRedo={future.length > 0}
          onUndo={handleUndo}
          onRedo={handleRedo}
          leftDrawerOpen={leftDrawerOpen}
          onToggleLeftDrawer={() => setLeftDrawerOpen((v) => !v)}
          rightInspectorOpen={rightInspectorOpen}
          onToggleRightInspector={() => setRightInspectorOpen((v) => !v)}
        />

        {/* Right Essential-First Inspector */}
        {rightInspectorOpen && (
          <InspectorPanel
            elements={elements}
            selectedIds={selectedIds}
            onSelectElements={setSelectedIds}
            onUpdateElement={handleUpdateElement}
            onAlignElement={handleAlignElement}
            onBulkAlign={handleBulkAlign}
            onDistributeElements={handleDistributeElements}
            onReorderElements={handleReorderElements}
            onBulkLayer={handleBulkLayer}
            onBulkDuplicate={handleBulkDuplicate}
            onBulkDelete={handleBulkDelete}
            onBulkLock={handleBulkLock}
            onClearBed={() => {
              commitElements([]);
              setSelectedIds([]);
            }}
            softwareId={softwareId}
            onChangeSoftware={setSoftwareId}
            material={material}
            onChangeMaterial={setMaterialId}
            savedProjects={savedProjects}
            onSaveProject={handleSaveProject}
            onLoadProject={handleLoadProject}
            onDeleteProject={handleDeleteProject}
            onCollapse={() => setRightInspectorOpen(false)}
            onNotify={notify}
          />
        )}
      </main>

      <ChatDrawer
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        bedContext={bedChatContext}
      />

      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        elements={elements}
        softwareId={softwareId}
        onChangeSoftware={setSoftwareId}
        material={material}
        onNotify={notify}
      />

      <ShortcutsOverviewModal
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />

      {toast && (
        <div className="fixed right-6 bottom-5 z-50 rounded-md border border-[#334155] bg-[#181E2C] px-4 py-2.5 text-xs font-medium text-[#F1F5F9] shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
