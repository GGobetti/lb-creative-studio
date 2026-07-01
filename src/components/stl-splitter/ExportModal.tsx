'use client';

import React, { useState } from 'react';
import { useSTLSplitterStore } from '@/store/stl-splitter.store';
import { export3MF } from '@/lib/stl-splitter/3mf-exporter';
import { Download, AlertCircle } from 'lucide-react';

interface ExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExportModal({ open, onOpenChange }: ExportModalProps) {
  const model           = useSTLSplitterStore((state) => state.model);
  const painting        = useSTLSplitterStore((state) => state.painting);
  const connectors      = useSTLSplitterStore((state) => state.connectors);
  const setExportProgress = useSTLSplitterStore((state) => state.setExportProgress);
  const [filename, setFilename] = useState('model_split');
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExport = async () => {
    if (!model || !model.geometry || painting.colors.size === 0) {
      setExportError('Nenhum modelo ou cor para exportar.');
      return;
    }

    try {
      setIsExporting(true);
      setExportError(null);
      setExportProgress(0);

      setExportProgress(30);
      if (connectors.length > 0) setExportProgress(40); // CSG will take longer
      const { blob, warnings } = await export3MF(model.geometry, painting.colorMap, painting.colors, connectors);

      setExportProgress(75);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${filename}.3mf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setExportProgress(100);
      if (warnings.length > 0) {
        // Some connector(s) failed to embed — keep the modal open so the
        // user actually sees which part(s), instead of silently shipping a
        // file that's missing them.
        setExportError(`Exportado com avisos:\n${warnings.join('\n')}`);
        setExportProgress(0);
      } else {
        setTimeout(() => {
          setExportProgress(0);
          onOpenChange(false);
        }, 500);
      }
    } catch (error) {
      setExportError('Falha na exportação: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
      setExportProgress(0);
    } finally {
      setIsExporting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm w-full">
        <h2 className="text-lg font-bold mb-2">Exportar para 3MF</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Seu modelo será salvo como {filename}.3mf com {painting.colors.size} partes separadas.
        </p>

        {exportError && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-600 rounded-lg flex gap-2 items-start">
            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-900 dark:text-red-100 whitespace-pre-line">{exportError}</p>
          </div>
        )}

        <div className="p-4 bg-gray-100 dark:bg-gray-900 rounded-lg mb-4">
          <p className="text-sm font-medium mb-2">Resumo da exportação</p>
          <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
            <li>📦 Partes: {painting.colors.size}</li>
            <li>📐 Vértices: {model?.vertexCount?.toLocaleString() || '0'}</li>
            <li>🔺 Faces: {model?.faceCount?.toLocaleString() || '0'}</li>
            {connectors.length > 0 && <li>🔩 Conectores: {connectors.length} (CSG aplicado no export)</li>}
          </ul>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Nome do arquivo</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              className="flex-1 px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
              disabled={isExporting}
            />
            <span className="px-2 py-2 text-sm text-gray-500">.3mf</span>
          </div>
        </div>

        {isExporting && (
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-4">
            <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: '75%' }} />
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <button
            onClick={() => onOpenChange(false)}
            disabled={isExporting}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting || painting.colors.size === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            {isExporting ? 'Exportando...' : 'Exportar'}
          </button>
        </div>
      </div>
    </div>
  );
}
