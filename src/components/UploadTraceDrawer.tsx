import React, { useEffect, useState } from 'react';
import { FileUp, Image as ImageIcon, Loader2, Spline } from 'lucide-react';
import {
  DitherMode,
  LaserElement,
  LaserLayerType,
  RasterElement,
  VectorElement,
} from '../types/laser';
import { makeId } from '../utils/elementFactory';
import {
  parseUploadedSvg,
  processRasterImage,
  traceImageToVector,
} from '../utils/imageProcessing';

interface UploadTraceDrawerProps {
  onAddElement: (el: LaserElement, replaceBed: boolean) => void;
  invertRecommended: boolean;
}

export const UploadTraceDrawer: React.FC<UploadTraceDrawerProps> = ({
  onAddElement,
  invertRecommended,
}) => {
  const [fileName, setFileName] = useState<string>('');
  const [sourceDataUrl, setSourceDataUrl] = useState<string | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number }>({
    w: 100,
    h: 100,
  });

  const [conversionMode, setConversionMode] = useState<'dither' | 'trace'>(
    'dither'
  );
  const [ditherMode, setDitherMode] = useState<DitherMode>('floyd-steinberg');
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(15);
  const [gamma, setGamma] = useState(1.0);
  const [threshold, setThreshold] = useState(128);
  const [invert, setInvert] = useState(invertRecommended);
  const [dpi, setDpi] = useState<254 | 300 | 318 | 600>(300);

  // Vector trace controls
  const [simplifyEpsilon, setSimplifyEpsilon] = useState(0.75);
  const [traceLayer, setTraceLayer] = useState<LaserLayerType>('engrave');
  const [addOuterCutFrame, setAddOuterCutFrame] = useState(true);
  const [addKeychainHole, setAddKeychainHole] = useState(false);

  const [targetWidthMm, setTargetWidthMm] = useState(100);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setInvert(invertRecommended);
  }, [invertRecommended]);

  // Live preview processing for uploaded raster images
  useEffect(() => {
    if (!sourceDataUrl) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await processRasterImage(sourceDataUrl, {
          mode: conversionMode === 'trace' ? 'threshold' : ditherMode,
          brightness,
          contrast,
          gamma,
          threshold,
          invert,
          maxDimensionPx: 420,
        });
        if (!cancelled) {
          setPreviewDataUrl(res.dataUrl);
          setNaturalSize({ w: res.width, h: res.height });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Processing failed.');
        }
      }
    }, 90);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    sourceDataUrl,
    conversionMode,
    ditherMode,
    brightness,
    contrast,
    gamma,
    threshold,
    invert,
  ]);

  const handleFile = async (file: File) => {
    setError(null);
    setFileName(file.name);

    if (file.name.toLowerCase().endsWith('.svg') || file.type === 'image/svg+xml') {
      try {
        const text = await file.text();
        const parsed = parseUploadedSvg(text);
        const vec: VectorElement = {
          id: makeId('svg'),
          kind: 'vector',
          name: file.name.replace(/\.svg$/i, ''),
          x: Number((200 - parsed.widthMm / 2).toFixed(1)),
          y: Number((200 - parsed.heightMm / 2).toFixed(1)),
          width: parsed.widthMm,
          height: parsed.heightMm,
          rotation: 0,
          flipX: false,
          flipY: false,
          layer: 'cut',
          useSubLayers: true,
          viewBoxWidth: parsed.viewBoxWidth,
          viewBoxHeight: parsed.viewBoxHeight,
          primitives: parsed.primitives,
          visible: true,
          locked: false,
        };
        onAddElement(vec, false);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Invalid SVG file.');
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setSourceDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handlePlaceOnBed = async (replaceBed: boolean) => {
    if (!sourceDataUrl) return;
    setBusy(true);
    setError(null);

    try {
      const safeWidth = Math.max(15, Math.min(380, targetWidthMm));
      const aspect = naturalSize.h / Math.max(1, naturalSize.w);
      const heightMm = Number((safeWidth * aspect).toFixed(1));

      if (conversionMode === 'dither') {
        const highRes = await processRasterImage(sourceDataUrl, {
          mode: ditherMode,
          brightness,
          contrast,
          gamma,
          threshold,
          invert,
          maxDimensionPx: 1400,
        });
        const rasterEl: RasterElement = {
          id: makeId('img'),
          kind: 'raster',
          name: fileName ? fileName.replace(/\.[^.]+$/, '') : 'Engraved Image',
          sourceDataUrl,
          processedDataUrl: highRes.dataUrl,
          naturalWidth: highRes.width,
          naturalHeight: highRes.height,
          x: Number((200 - safeWidth / 2).toFixed(1)),
          y: Number((200 - heightMm / 2).toFixed(1)),
          width: safeWidth,
          height: heightMm,
          rotation: 0,
          ditherMode,
          brightness,
          contrast,
          gamma,
          threshold,
          invert,
          dpi,
          visible: true,
          locked: false,
        };
        onAddElement(rasterEl, replaceBed);
      } else {
        const traced = await traceImageToVector(sourceDataUrl, {
          threshold,
          invert,
          simplifyEpsilon,
          traceLayer,
          addOuterCutFrame,
          addKeychainHole,
        });
        const vecHeightMm = Number(
          ((safeWidth * traced.viewBoxHeight) / traced.viewBoxWidth).toFixed(1)
        );
        const vecEl: VectorElement = {
          id: makeId('trace'),
          kind: 'vector',
          name: `${fileName ? fileName.replace(/\.[^.]+$/, '') : 'Traced'} (Vector)`,
          x: Number((200 - safeWidth / 2).toFixed(1)),
          y: Number((200 - vecHeightMm / 2).toFixed(1)),
          width: safeWidth,
          height: vecHeightMm,
          rotation: 0,
          flipX: false,
          flipY: false,
          layer: traceLayer,
          useSubLayers: true,
          viewBoxWidth: traced.viewBoxWidth,
          viewBoxHeight: traced.viewBoxHeight,
          primitives: traced.primitives,
          visible: true,
          locked: false,
        };
        onAddElement(vecEl, replaceBed);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Conversion failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4 space-y-4">
      <div>
        <h2 className="text-xs font-semibold text-[#F1F5F9]">
          Upload SVG or Trace Photo / Logo
        </h2>
        <p className="mt-1 text-[11px] leading-relaxed text-[#94A3B8]">
          Import existing SVGs directly onto the 400 × 400 mm bed, or convert
          PNG/JPG images into laser-dithered rasters or cuttable SVG vectors.
        </p>
      </div>

      <label
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f) handleFile(f);
        }}
        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[#334155] bg-[#0D1018] px-4 py-5 text-center transition-colors hover:border-[#EF4444] hover:bg-[#131826]"
      >
        <FileUp className="h-5 w-5 text-[#94A3B8]" />
        <div className="text-xs font-medium text-[#E2E8F0]">
          {fileName ? fileName : 'Drop SVG, PNG, or JPG here'}
        </div>
        <div className="text-[11px] text-[#64748B]">
          Click to browse files
        </div>
        <input
          type="file"
          accept=".svg,image/svg+xml,image/png,image/jpeg,image/webp"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
          className="hidden"
        />
      </label>

      {error && (
        <div className="rounded-md border border-[#EF4444]/40 bg-[#EF4444]/10 p-2.5 text-xs text-[#FCA5A5]">
          {error}
        </div>
      )}

      {sourceDataUrl && (
        <div className="space-y-3.5">
          {previewDataUrl && (
            <div className="overflow-hidden rounded-md border border-[#232A3B] bg-white p-2">
              <img
                src={previewDataUrl}
                alt="Processed laser preview"
                className="mx-auto max-h-40 w-auto object-contain"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-1 rounded-md border border-[#232A3B] bg-[#0D1018] p-1">
            <button
              type="button"
              onClick={() => setConversionMode('dither')}
              className={`flex items-center justify-center gap-1.5 rounded py-1.5 text-xs font-medium transition-colors ${
                conversionMode === 'dither'
                  ? 'bg-[#1F2737] text-white'
                  : 'text-[#94A3B8] hover:text-[#F1F5F9]'
              }`}
            >
              <ImageIcon className="h-3.5 w-3.5" />
              Engrave Dither
            </button>
            <button
              type="button"
              onClick={() => setConversionMode('trace')}
              className={`flex items-center justify-center gap-1.5 rounded py-1.5 text-xs font-medium transition-colors ${
                conversionMode === 'trace'
                  ? 'bg-[#1F2737] text-white'
                  : 'text-[#94A3B8] hover:text-[#F1F5F9]'
              }`}
            >
              <Spline className="h-3.5 w-3.5" />
              Vector Trace
            </button>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-[#94A3B8]">
              Target Width on Bed (mm)
            </label>
            <input
              type="number"
              min={15}
              max={380}
              value={targetWidthMm}
              onChange={(e) => setTargetWidthMm(Number(e.target.value) || 80)}
              className="w-full rounded border border-[#232A3B] bg-[#0D1018] px-2.5 py-1.5 font-mono text-xs text-[#F1F5F9] tabular-nums focus:border-[#EF4444] focus:outline-none"
            />
          </div>

          {conversionMode === 'dither' ? (
            <div className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-[#94A3B8]">
                    Dithering Algorithm
                  </label>
                  <select
                    value={ditherMode}
                    onChange={(e) => setDitherMode(e.target.value as DitherMode)}
                    className="w-full rounded border border-[#232A3B] bg-[#0D1018] px-2 py-1.5 text-xs text-[#F1F5F9]"
                  >
                    <option value="floyd-steinberg">Floyd-Steinberg</option>
                    <option value="atkinson">Atkinson (Wood)</option>
                    <option value="jarvis">Jarvis (Photo)</option>
                    <option value="bayer">Ordered Bayer 4×4</option>
                    <option value="threshold">1-Bit B&amp;W</option>
                    <option value="grayscale">Grayscale</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-[#94A3B8]">
                    Laser DPI
                  </label>
                  <select
                    value={dpi}
                    onChange={(e) =>
                      setDpi(Number(e.target.value) as 254 | 300 | 318 | 600)
                    }
                    className="w-full rounded border border-[#232A3B] bg-[#0D1018] px-2 py-1.5 font-mono text-xs text-[#F1F5F9]"
                  >
                    <option value={254}>254 DPI (0.1mm)</option>
                    <option value={300}>300 DPI</option>
                    <option value={318}>318 DPI (X20 Spot)</option>
                    <option value={600}>600 DPI</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-[#94A3B8]">
                  <span>Brightness</span>
                  <span className="font-mono tabular-nums">{brightness}</span>
                </div>
                <input
                  type="range"
                  min={-80}
                  max={80}
                  value={brightness}
                  onChange={(e) => setBrightness(Number(e.target.value))}
                  className="w-full accent-[#EF4444]"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-[#94A3B8]">
                  <span>Contrast</span>
                  <span className="font-mono tabular-nums">{contrast}</span>
                </div>
                <input
                  type="range"
                  min={-60}
                  max={80}
                  value={contrast}
                  onChange={(e) => setContrast(Number(e.target.value))}
                  className="w-full accent-[#EF4444]"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-[#94A3B8]">
                  <span>Gamma</span>
                  <span className="font-mono tabular-nums">{gamma.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={2.2}
                  step={0.05}
                  value={gamma}
                  onChange={(e) => setGamma(Number(e.target.value))}
                  className="w-full accent-[#EF4444]"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div>
                <div className="flex justify-between text-[11px] text-[#94A3B8]">
                  <span>Trace Threshold</span>
                  <span className="font-mono tabular-nums">{threshold}</span>
                </div>
                <input
                  type="range"
                  min={30}
                  max={225}
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  className="w-full accent-[#EF4444]"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-[#94A3B8]">
                  <span>Path Smoothing</span>
                  <span className="font-mono tabular-nums">
                    {simplifyEpsilon.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min={0.25}
                  max={2.5}
                  step={0.25}
                  value={simplifyEpsilon}
                  onChange={(e) => setSimplifyEpsilon(Number(e.target.value))}
                  className="w-full accent-[#EF4444]"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium text-[#94A3B8]">
                  Traced Artwork Layer
                </label>
                <select
                  value={traceLayer}
                  onChange={(e) =>
                    setTraceLayer(e.target.value as LaserLayerType)
                  }
                  className="w-full rounded border border-[#232A3B] bg-[#0D1018] px-2 py-1.5 text-xs text-[#F1F5F9]"
                >
                  <option value="engrave">Engrave (Solid Fill)</option>
                  <option value="score">Score (Cyan Outline)</option>
                  <option value="cut">Cut (Red Vector)</option>
                </select>
              </div>

              <label className="flex cursor-pointer items-center justify-between rounded border border-[#232A3B] bg-[#0D1018] px-2.5 py-2 text-xs text-[#E2E8F0]">
                <span>Add outer Cut border frame</span>
                <input
                  type="checkbox"
                  checked={addOuterCutFrame}
                  onChange={(e) => setAddOuterCutFrame(e.target.checked)}
                  className="h-3.5 w-3.5 accent-[#EF4444]"
                />
              </label>

              <label className="flex cursor-pointer items-center justify-between rounded border border-[#232A3B] bg-[#0D1018] px-2.5 py-2 text-xs text-[#E2E8F0]">
                <span>Add top keyring / hanging hole</span>
                <input
                  type="checkbox"
                  checked={addKeychainHole}
                  onChange={(e) => setAddKeychainHole(e.target.checked)}
                  className="h-3.5 w-3.5 accent-[#EF4444]"
                />
              </label>
            </div>
          )}

          <label className="flex cursor-pointer items-center justify-between rounded border border-[#232A3B] bg-[#0D1018] px-2.5 py-2 text-xs text-[#E2E8F0]">
            <span>Invert tones (Slate &amp; Anodized Metal)</span>
            <input
              type="checkbox"
              checked={invert}
              onChange={(e) => setInvert(e.target.checked)}
              className="h-3.5 w-3.5 accent-[#EF4444]"
            />
          </label>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              disabled={busy}
              onClick={() => handlePlaceOnBed(false)}
              className="flex items-center justify-center gap-1.5 rounded-md border border-[#334155] bg-[#181F2E] px-3 py-2 text-xs font-medium text-[#F1F5F9] whitespace-nowrap transition-colors hover:bg-[#232C40]"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Add to Bed
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => handlePlaceOnBed(true)}
              className="flex items-center justify-center gap-1.5 rounded-md bg-[#EF4444] px-3 py-2 text-xs font-semibold text-white whitespace-nowrap transition-colors hover:bg-[#DC2626]"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Place on Bed
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
