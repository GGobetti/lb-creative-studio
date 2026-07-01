'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSTLSplitterStore } from '@/store/stl-splitter.store';
import { STLUploader } from '@/components/stl-splitter/STLUploader';
import { STLViewer } from '@/components/stl-splitter/STLViewer';
import { PaintToolbar } from '@/components/stl-splitter/PaintToolbar';
import { ColorList } from '@/components/stl-splitter/ColorList';
import { ExportModal } from '@/components/stl-splitter/ExportModal';
import { SessionHistory } from '@/components/stl-splitter/SessionHistory';
import { AutoSegmentPanel } from '@/components/stl-splitter/AutoSegmentPanel';
import { ConnectorPanel } from '@/components/stl-splitter/ConnectorPanel';
import { CollapsibleSection } from '@/components/stl-splitter/CollapsibleSection';
import {
  serializeColorMap,
  serializeGeometry,
  serializeColors,
  serializeConnectors,
} from '@/lib/stl-splitter/session-storage';
import { AlertCircle, Download, RotateCcw, Upload, Wand2, Link2, Palette } from 'lucide-react';

export function STLSplitterClient() {
  const mode = useSTLSplitterStore((state) => state.ui.mode);
  const error = useSTLSplitterStore((state) => state.ui.error);
  const isLoading = useSTLSplitterStore((state) => state.ui.isLoading);
  const model = useSTLSplitterStore((state) => state.model);
  const painting = useSTLSplitterStore((state) => state.painting);
  const connectors = useSTLSplitterStore((state) => state.connectors);
  const clearAll = useSTLSplitterStore((state) => state.clearAll);
  const setError = useSTLSplitterStore((state) => state.setError);
  const addSession = useSTLSplitterStore((state) => state.addSession);

  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  // The shared dashboard shell wraps every page's content in a centered
  // `mx-auto max-w-6xl` box with no explicit height. That caps our width to
  // 1152px AND — having no h-full/flex-1 of its own — breaks any h-full
  // percentage chain below it, leaving a shrunken box surrounded by unused
  // space. We can't touch that shared layout (it'd affect every other
  // dashboard page), so instead we measure <main>'s real content box
  // (ignoring the constraining wrapper entirely) and pin ourselves to it
  // with fixed positioning, which isn't subject to ancestor width/height
  // constraints at all.
  const rootRef = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

  useEffect(() => {
    const el = rootRef.current;
    const main = el?.closest('main');
    if (!main) return;

    const measure = () => {
      const rect = main.getBoundingClientRect();
      const style = getComputedStyle(main);
      const padTop = parseFloat(style.paddingTop) || 0;
      const padBottom = parseFloat(style.paddingBottom) || 0;
      const padLeft = parseFloat(style.paddingLeft) || 0;
      const padRight = parseFloat(style.paddingRight) || 0;
      setBounds({
        top: rect.top + padTop,
        left: rect.left + padLeft,
        width: rect.width - padLeft - padRight,
        height: rect.height - padTop - padBottom,
      });
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(main);
    window.addEventListener('resize', measure);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
  }, [mode]);

  const fillStyle: React.CSSProperties = bounds
    ? { position: 'fixed', top: bounds.top, left: bounds.left, width: bounds.width, height: bounds.height, zIndex: 1 }
    : { position: 'relative', width: '100%', height: '100%' };

  // Always-fresh refs so the 30s timer doesn't reset every time the user
  // paints a stroke (painting/connectors change on every action — if they
  // were direct effect deps, the interval would keep getting torn down and
  // recreated and would practically never fire during active painting).
  const modelRef = useRef(model);
  useEffect(() => { modelRef.current = model; }, [model]);
  const paintingRef = useRef(painting);
  useEffect(() => { paintingRef.current = painting; }, [painting]);
  const connectorsRef = useRef(connectors);
  useEffect(() => { connectorsRef.current = connectors; }, [connectors]);

  const sessionIdRef = useRef<string | null>(null);
  const autoSaveFailedRef = useRef(false);
  useEffect(() => {
    if (mode !== 'painting') { sessionIdRef.current = null; autoSaveFailedRef.current = false; return; }

    const interval = setInterval(() => {
      // Once a save has failed (model too big for localStorage's quota),
      // stop retrying every 30s — it'll just keep failing and spamming the
      // console for the rest of the session.
      if (autoSaveFailedRef.current) return;

      const m = modelRef.current;
      const p = paintingRef.current;
      if (!m?.geometry || p.colors.size === 0) return;

      if (!sessionIdRef.current) {
        sessionIdRef.current = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      }

      const saved = addSession({
        id: sessionIdRef.current,
        timestamp: Date.now(),
        originalFileName: m.originalFile,
        colorMapCompressed: serializeColorMap(p.colorMap),
        geometryCompressed: serializeGeometry(m.geometry),
        colorsJSON: serializeColors(p.colors),
        connectorsJSON: serializeConnectors(connectorsRef.current),
        metadata: {
          vertexCount: m.vertexCount,
          faceCount: m.faceCount,
          colorGroupCount: p.colors.size,
        },
      });

      if (!saved) {
        autoSaveFailedRef.current = true;
        setError('Este modelo é grande demais para o salvamento automático do navegador — seu progresso não será restaurado se você recarregar a página, mas a exportação continua funcionando normalmente.');
        return;
      }
      console.log('💾 Auto-save:', sessionIdRef.current);
    }, 30000);

    return () => clearInterval(interval);
  }, [mode, addSession, setError]);

  if (isLoading) {
    return (
      <div ref={rootRef} style={fillStyle} className="flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin mb-4">
            <RotateCcw className="h-12 w-12 text-blue-600" />
          </div>
          <p className="text-lg font-medium">Lendo arquivo STL...</p>
        </div>
      </div>
    );
  }

  if (mode === 'upload') {
    return (
      <div ref={rootRef} style={fillStyle} className="flex flex-col p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">STL Splitter</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Envie um arquivo STL, pinte para separar as partes e exporte como 3MF
          </p>
        </div>

        <div className="max-w-2xl mx-auto w-full flex-1 flex items-center">
          <STLUploader />
        </div>

        {error && (
          <div className="mt-4 max-w-2xl mx-auto w-full p-4 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-600 rounded-lg flex gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0" />
            <div>
              <p className="font-medium text-red-900 dark:text-red-100">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-600 dark:text-red-400 hover:text-red-800"
            >
              ✕
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={rootRef} style={fillStyle} className="flex flex-col gap-2.5 p-3">
      {error && (
        <div className="fixed top-6 right-6 max-w-sm p-4 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-600 rounded-lg flex gap-3 z-50">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-900 dark:text-red-100 flex-1">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-red-600 dark:text-red-400 hover:text-red-800"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top bar — global, page-level actions: not tied to any one tool, so
          they don't compete for space with the panels you use constantly. */}
      <div className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-lg shadow px-3 py-2 flex-shrink-0">
        <span className="font-semibold text-sm truncate flex-1 min-w-0">
          {model?.originalFile ?? 'STL Splitter'}
        </span>
        <button
          onClick={() => setUploadOpen((o) => !o)}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition flex items-center gap-1.5 border ${
            uploadOpen
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
              : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-blue-400'
          }`}
        >
          <Upload className="h-3.5 w-3.5" /> Novo modelo
        </button>
        <button
          onClick={() => setExportModalOpen(true)}
          disabled={painting.colors.size === 0}
          className="px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium flex items-center gap-1.5 transition"
        >
          <Download className="h-3.5 w-3.5" /> Exportar
        </button>
        <button
          onClick={clearAll}
          className="px-3 py-1.5 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-xs font-medium transition"
        >
          Limpar tudo
        </button>
      </div>

      {uploadOpen && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 flex-shrink-0">
          <STLUploader />
        </div>
      )}

      <div className="flex-1 flex gap-2.5 min-h-0">
        {/* Left — active tool controls, used constantly while working */}
        <div className="w-64 flex flex-col gap-2.5 overflow-y-auto flex-shrink-0 min-h-0">
          <div className="p-0 bg-white dark:bg-gray-800 rounded-lg shadow">
            <PaintToolbar />
          </div>
        </div>

        {/* Center — viewport */}
        <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden min-w-0">
          <STLViewer />
        </div>

        {/* Right — setup/organization panels */}
        <div className="w-80 flex flex-col gap-2.5 overflow-y-auto flex-shrink-0 min-h-0">
          <CollapsibleSection title="Auto-segmentação" icon={<Wand2 className="h-4 w-4 text-purple-500" />}>
            <AutoSegmentPanel />
          </CollapsibleSection>

          <CollapsibleSection
            title="Conectores"
            icon={<Link2 className="h-4 w-4 text-orange-500" />}
            badge={connectors.length > 0 && (
              <span className="text-xs font-normal bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 px-1.5 py-0.5 rounded-full">
                {connectors.length}
              </span>
            )}
          >
            <ConnectorPanel />
          </CollapsibleSection>

          <div className="p-0 bg-white dark:bg-gray-800 rounded-lg shadow">
            <h3 className="font-semibold px-3 py-2.5 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2 text-sm">
              <Palette className="h-4 w-4 text-gray-500" />
              Partes
              {painting.colors.size > 0 && (
                <span className="text-xs font-normal bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded-full ml-auto">
                  {painting.colors.size}
                </span>
              )}
            </h3>
            <ColorList />
          </div>

          <SessionHistory />
        </div>
      </div>

      <ExportModal open={exportModalOpen} onOpenChange={setExportModalOpen} />
    </div>
  );
}
