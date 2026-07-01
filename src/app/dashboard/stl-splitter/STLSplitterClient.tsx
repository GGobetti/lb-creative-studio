'use client';

import React, { useState, useEffect } from 'react';
import { useSTLSplitterStore } from '@/store/stl-splitter.store';
import { STLUploader } from '@/components/stl-splitter/STLUploader';
import { STLViewer } from '@/components/stl-splitter/STLViewer';
import { PaintToolbar } from '@/components/stl-splitter/PaintToolbar';
import { ColorList } from '@/components/stl-splitter/ColorList';
import { ExportModal } from '@/components/stl-splitter/ExportModal';
import { SessionHistory } from '@/components/stl-splitter/SessionHistory';
import { AutoSegmentPanel } from '@/components/stl-splitter/AutoSegmentPanel';
import { AlertCircle, Download, RotateCcw } from 'lucide-react';

export function STLSplitterClient() {
  const mode = useSTLSplitterStore((state) => state.ui.mode);
  const error = useSTLSplitterStore((state) => state.ui.error);
  const isLoading = useSTLSplitterStore((state) => state.ui.isLoading);
  const model = useSTLSplitterStore((state) => state.model);
  const painting = useSTLSplitterStore((state) => state.painting);
  const clearAll = useSTLSplitterStore((state) => state.clearAll);
  const setError = useSTLSplitterStore((state) => state.setError);

  const [exportModalOpen, setExportModalOpen] = useState(false);

  useEffect(() => {
    if (mode !== 'painting') return;

    const interval = setInterval(() => {
      // TODO: auto-save to localStorage
    }, 30000);

    return () => clearInterval(interval);
  }, [mode, model, painting]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin mb-4">
            <RotateCcw className="h-12 w-12 text-blue-600" />
          </div>
          <p className="text-lg font-medium">Parsing STL file...</p>
        </div>
      </div>
    );
  }

  if (mode === 'upload') {
    return (
      <div className="h-full flex flex-col p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">STL Splitter</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Upload an STL file, paint to separate parts, and export as 3MF
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
    <div className="h-full flex gap-6 p-6">
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

      <div className="w-80 flex flex-col gap-4 overflow-y-auto">
        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
          <h2 className="font-semibold mb-4">Upload New Model</h2>
          <STLUploader />
        </div>

        <div className="p-0 bg-white dark:bg-gray-800 rounded-lg shadow">
          <PaintToolbar />
        </div>

        <AutoSegmentPanel />

        <div className="p-0 bg-white dark:bg-gray-800 rounded-lg shadow">
          <h3 className="font-semibold p-4 border-b border-gray-200 dark:border-gray-700">Parts</h3>
          <ColorList />
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setExportModalOpen(true)}
            disabled={painting.colors.size === 0}
            className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2 transition"
          >
            <Download className="h-5 w-5" />
            Export
          </button>
          <button
            onClick={clearAll}
            className="flex-1 px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium transition"
          >
            Clear All
          </button>
        </div>

        <SessionHistory />
      </div>

      <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <STLViewer />
      </div>

      <ExportModal open={exportModalOpen} onOpenChange={setExportModalOpen} />
    </div>
  );
}
