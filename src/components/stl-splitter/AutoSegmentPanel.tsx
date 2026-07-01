'use client';

import React, { useState } from 'react';
import { useSTLSplitterStore } from '@/store/stl-splitter.store';
import { autoSegmentBySharpEdges } from '@/lib/stl-splitter/geometry-utils';
import { Wand2 } from 'lucide-react';

export function AutoSegmentPanel() {
  const model            = useSTLSplitterStore((state) => state.model);
  const threshold        = useSTLSplitterStore((state) => state.painting.autoSegmentThreshold);
  const setThreshold     = useSTLSplitterStore((state) => state.setAutoSegmentThreshold);
  const applyAutoSegment = useSTLSplitterStore((state) => state.applyAutoSegment);

  const [running, setRunning]     = useState(false);
  const [lastCount, setLastCount] = useState<number | null>(null);

  const handleAutoSegment = () => {
    if (!model?.geometry) return;
    setRunning(true);
    setLastCount(null);
    console.log('🔷 Auto-segment started, threshold:', threshold);

    // Defer to next tick so "Calculando…" state renders before blocking compute
    setTimeout(() => {
      const segmentMap = autoSegmentBySharpEdges(model.geometry!, threshold);
      const uniqueSegs = new Set(segmentMap.values()).size;
      applyAutoSegment(segmentMap);
      setLastCount(Math.min(uniqueSegs, 16));
      setRunning(false);
      console.log('🔷 Auto-segment complete:', uniqueSegs, 'segments found');
    }, 16);
  };

  if (!model) return null;

  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow space-y-3">
      <h3 className="font-semibold text-sm flex items-center gap-2">
        <Wand2 className="h-4 w-4 text-purple-500" />
        Auto-segmentação
      </h3>

      <div>
        <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-400">
          Ângulo de borda: {threshold === 180 ? 'só componentes' : `${threshold}°`}
        </label>
        <input
          type="range" min="10" max="180" step="5"
          value={threshold}
          onChange={(e) => setThreshold(parseInt(e.target.value))}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-0.5">
          <span>10° mais divisões</span>
          <span>180° só shells</span>
        </div>
      </div>

      <button
        onClick={handleAutoSegment}
        disabled={running}
        className="w-full py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-wait text-white rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
      >
        {running ? (
          <>
            <span className="animate-spin inline-block">⚙️</span>
            Calculando…
          </>
        ) : (
          <>
            <Wand2 className="h-4 w-4" />
            Auto-segmentar
          </>
        )}
      </button>

      {lastCount !== null && (
        <p className="text-xs text-center text-purple-600 dark:text-purple-400">
          ✅ {lastCount} partes criadas — ajuste o ângulo e repita se precisar
        </p>
      )}

      <p className="text-xs text-gray-400 dark:text-gray-500">
        Detecta regiões por bordas afiadas. Menor ângulo = mais partes. 180° = só separa peças desconectadas.
      </p>
    </div>
  );
}
