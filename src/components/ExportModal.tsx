import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Download,
  FileCode2,
  FileImage,
  FileText,
  X,
} from 'lucide-react';
import { SOFTWARE_PRESETS } from '../data/atomstackPresets';
import {
  LaserElement,
  MaterialPreset,
  SoftwarePresetId,
} from '../types/laser';
import {
  buildExportPngDataUrl,
  buildExportSvg,
  buildSettingsGuideText,
  computeElementsBoundingBox,
  downloadDataUrl,
  downloadTextFile,
} from '../utils/laserExport';

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  elements: LaserElement[];
  softwareId: SoftwarePresetId;
  onChangeSoftware: (id: SoftwarePresetId) => void;
  material: MaterialPreset;
  onNotify: (msg: string) => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  open,
  onClose,
  elements,
  softwareId,
  onChangeSoftware,
  material,
  onNotify,
}) => {
  const [scope, setScope] = useState<'artwork' | 'bed'>('artwork');
  const [pngDpi, setPngDpi] = useState<254 | 300 | 318 | 600>(300);
  const [includeCutLines, setIncludeCutLines] = useState(true);
  const [includeScoreLines, setIncludeScoreLines] = useState(true);
  const [exportingPng, setExportingPng] = useState(false);

  const bounds = useMemo(() => {
    if (scope === 'bed') {
      return { x: 0, y: 0, width: 400, height: 400 };
    }
    return computeElementsBoundingBox(elements, 3);
  }, [elements, scope]);

  if (!open) return null;

  const preset = SOFTWARE_PRESETS[softwareId];
  const visibleCount = elements.filter((e) => e.visible).length;

  const handleDownloadSvg = () => {
    const svg = buildExportSvg(elements, {
      softwareId,
      material,
      scope,
      paddingMm: 3,
    });
    const slug = `${softwareId}-atomstack-x20-${Math.round(bounds.width)}x${Math.round(bounds.height)}mm`;
    downloadTextFile(`${slug}.svg`, svg, 'image/svg+xml;charset=utf-8');
    onNotify(`Exported ${slug}.svg for ${preset.shortName}`);
  };

  const handleDownloadPng = async () => {
    setExportingPng(true);
    try {
      const res = await buildExportPngDataUrl(elements, {
        softwareId,
        material,
        scope,
        dpi: pngDpi,
        includeCutLines,
        includeScoreLines,
        paddingMm: 3,
      });
      const slug = `${softwareId}-atomstack-x20-${pngDpi}dpi-${Math.round(res.widthMm)}x${Math.round(res.heightMm)}mm`;
      downloadDataUrl(`${slug}.png`, res.dataUrl);
      onNotify(
        `Exported ${slug}.png (${res.pixelWidth}×${res.pixelHeight} px)`
      );
    } catch (err: unknown) {
      onNotify(
        err instanceof Error ? err.message : 'Failed to export PNG.'
      );
    } finally {
      setExportingPng(false);
    }
  };

  const handleDownloadSettings = () => {
    const txt = buildSettingsGuideText(material, softwareId, bounds);
    downloadTextFile(
      `atomstack-x20-pro-${material.id}-settings.txt`,
      txt,
      'text/plain;charset=utf-8'
    );
    onNotify('Downloaded AtomStack X20 Pro job settings guide.');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl rounded-lg border border-[#232A3B] bg-[#131722] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[#232A3B] px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-[#F1F5F9]">
              Export for AtomStack X20 Pro
            </h2>
            <p className="mt-0.5 text-xs text-[#94A3B8]">
              True 1:1 millimeter geometry calibrated for direct machine
              processing.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-[#94A3B8] hover:bg-[#1E2534] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {/* Software Target Selector */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#CBD5E1]">
              Target Laser Software
            </label>
            <div className="grid grid-cols-3 gap-2">
              {Object.values(SOFTWARE_PRESETS).map((sw) => (
                <button
                  key={sw.id}
                  type="button"
                  onClick={() => onChangeSoftware(sw.id)}
                  className={`rounded-md border px-3 py-2 text-left transition-colors ${
                    softwareId === sw.id
                      ? 'border-[#EF4444] bg-[#EF4444]/10 text-white'
                      : 'border-[#232A3B] bg-[#0D1018] text-[#94A3B8] hover:border-[#334155] hover:text-[#F1F5F9]'
                  }`}
                >
                  <div className="text-xs font-semibold">{sw.shortName}</div>
                  <div className="mt-0.5 text-[10px] text-[#94A3B8]">
                    {sw.preferredExport.toUpperCase()} ready
                  </div>
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-[#94A3B8]">
              {preset.importTip}
            </p>
          </div>

          {/* Scope & Dimensions */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#CBD5E1]">
                Export Area
              </label>
              <div className="grid grid-cols-2 gap-1 rounded border border-[#232A3B] bg-[#0D1018] p-1">
                <button
                  type="button"
                  onClick={() => setScope('artwork')}
                  className={`rounded py-1.5 text-xs font-medium transition-colors ${
                    scope === 'artwork'
                      ? 'bg-[#1F2737] text-white'
                      : 'text-[#94A3B8] hover:text-white'
                  }`}
                >
                  Artwork
                </button>
                <button
                  type="button"
                  onClick={() => setScope('bed')}
                  className={`rounded py-1.5 text-xs font-medium transition-colors ${
                    scope === 'bed'
                      ? 'bg-[#1F2737] text-white'
                      : 'text-[#94A3B8] hover:text-white'
                  }`}
                >
                  Full 400×400
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#CBD5E1]">
                PNG Resolution
              </label>
              <select
                value={pngDpi}
                onChange={(e) =>
                  setPngDpi(Number(e.target.value) as 254 | 300 | 318 | 600)
                }
                className="w-full rounded border border-[#232A3B] bg-[#0D1018] px-2.5 py-2 font-mono text-xs text-[#F1F5F9]"
              >
                <option value={254}>254 DPI (0.10mm pitch)</option>
                <option value={300}>300 DPI (Standard)</option>
                <option value={318}>318 DPI (0.08mm X20 Spot)</option>
                <option value={600}>600 DPI (Ultra Fine)</option>
              </select>
            </div>
          </div>

          {/* PNG Raster Pass Options */}
          <div className="grid grid-cols-2 gap-2">
            <label className="flex cursor-pointer items-center justify-between rounded border border-[#232A3B] bg-[#0D1018] px-3 py-2 text-xs text-[#CBD5E1]">
              <span>Include Cut lines in PNG</span>
              <input
                type="checkbox"
                checked={includeCutLines}
                onChange={(e) => setIncludeCutLines(e.target.checked)}
                className="h-3.5 w-3.5 accent-[#EF4444]"
              />
            </label>
            <label className="flex cursor-pointer items-center justify-between rounded border border-[#232A3B] bg-[#0D1018] px-3 py-2 text-xs text-[#CBD5E1]">
              <span>Include Score lines in PNG</span>
              <input
                type="checkbox"
                checked={includeScoreLines}
                onChange={(e) => setIncludeScoreLines(e.target.checked)}
                className="h-3.5 w-3.5 accent-[#EF4444]"
              />
            </label>
          </div>

          {/* Summary Readout */}
          <div className="flex items-center justify-between rounded-md border border-[#232A3B] bg-[#0D1018] px-3.5 py-2.5 text-xs">
            <div className="flex items-center gap-2 text-[#CBD5E1]">
              <CheckCircle2 className="h-4 w-4 text-[#10B981]" />
              <span>
                {visibleCount} visible object{visibleCount === 1 ? '' : 's'} ·{' '}
                {material.name}
              </span>
            </div>
            <span className="font-mono text-[#F1F5F9] tabular-nums">
              {bounds.width.toFixed(1)} × {bounds.height.toFixed(1)} mm
            </span>
          </div>

          {/* Download Buttons */}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              disabled={visibleCount === 0}
              onClick={handleDownloadSvg}
              className="flex items-center justify-center gap-2 rounded-md bg-[#EF4444] px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#DC2626] disabled:opacity-40"
            >
              <FileCode2 className="h-4 w-4" />
              Export Laser SVG (mm)
            </button>
            <button
              type="button"
              disabled={visibleCount === 0 || exportingPng}
              onClick={handleDownloadPng}
              className="flex items-center justify-center gap-2 rounded-md border border-[#334155] bg-[#181F2E] px-4 py-2.5 text-xs font-semibold text-[#F1F5F9] transition-colors hover:bg-[#232C40] disabled:opacity-40"
            >
              <FileImage className="h-4 w-4" />
              {exportingPng ? 'Rasterizing...' : `Export PNG (${pngDpi} DPI)`}
            </button>
          </div>

          <button
            type="button"
            onClick={handleDownloadSettings}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-[#232A3B] bg-[#0D1018] px-3 py-2 text-xs font-medium text-[#CBD5E1] transition-colors hover:border-[#334155] hover:text-white"
          >
            <FileText className="h-3.5 w-3.5" />
            <Download className="h-3.5 w-3.5" />
            Download AtomStack X20 Pro Settings Sheet (.txt)
          </button>
        </div>
      </div>
    </div>
  );
};
