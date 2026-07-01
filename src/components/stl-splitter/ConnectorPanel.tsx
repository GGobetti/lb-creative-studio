'use client';

import React, { useState } from 'react';
import { useSTLSplitterStore } from '@/store/stl-splitter.store';
import { findColorBoundaryEdges, sampleConnectorPositions } from '@/lib/stl-splitter/geometry-utils';
import { Link2, Trash2, Zap } from 'lucide-react';

export function ConnectorPanel() {
  const model           = useSTLSplitterStore((state) => state.model);
  const painting        = useSTLSplitterStore((state) => state.painting);
  const connectors      = useSTLSplitterStore((state) => state.connectors);
  const connectorRadius = useSTLSplitterStore((state) => state.connectorRadius);
  const addConnector    = useSTLSplitterStore((state) => state.addConnector);
  const removeConnector = useSTLSplitterStore((state) => state.removeConnector);
  const clearConnectors = useSTLSplitterStore((state) => state.clearConnectors);
  const setRadius       = useSTLSplitterStore((state) => state.setConnectorRadius);
  const setActiveTool   = useSTLSplitterStore((state) => state.setActiveTool);
  const activeTool      = useSTLSplitterStore((state) => state.painting.activeTool);

  const [spacing, setSpacing]   = useState(15); // mm between auto-connectors
  const [running, setRunning]   = useState(false);
  const [lastAuto, setLastAuto] = useState<number | null>(null);

  const hasParts = painting.colors.size >= 2;

  const handleAutoConnectors = () => {
    if (!model?.geometry || !hasParts) return;
    setRunning(true);
    setLastAuto(null);

    setTimeout(() => {
      const edges = findColorBoundaryEdges(painting.colorMap as Map<number, any>, model.geometry!);
      const sampled = sampleConnectorPositions(edges, spacing);

      for (const edge of sampled) {
        addConnector({
          position: { x: edge.midpoint.x, y: edge.midpoint.y, z: edge.midpoint.z },
          normal:   { x: edge.normal.x,   y: edge.normal.y,   z: edge.normal.z   },
          partAColorId: edge.colorA,
          partBColorId: edge.colorB,
          radius: connectorRadius,
          depth:  Math.max(connectorRadius * 4, edge.gap + connectorRadius * 3),
        });
      }

      setLastAuto(sampled.length);
      setRunning(false);
      console.log(`🔩 Auto-connectors: ${sampled.length} placed`);
    }, 16);
  };

  if (!model) return null;

  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow space-y-3">
      <h3 className="font-semibold text-sm flex items-center gap-2">
        <Link2 className="h-4 w-4 text-orange-500" />
        Conectores
      </h3>

      {/* Radius */}
      <div>
        <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-400">
          Raio do pino: {connectorRadius.toFixed(1)} mm
        </label>
        <input
          type="range" min="0.5" max="5" step="0.5"
          value={connectorRadius}
          onChange={(e) => setRadius(parseFloat(e.target.value))}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-0.5">
          <span>0.5 mm fino</span><span>5 mm largo</span>
        </div>
      </div>

      {/* Manual connector tool toggle */}
      <button
        onClick={() => setActiveTool(activeTool === 'connector' ? 'navigate' : 'connector')}
        className={`w-full py-2 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2 border-2 ${
          activeTool === 'connector'
            ? 'border-orange-500 bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-300'
            : 'border-gray-200 dark:border-gray-600 hover:border-orange-400 text-gray-600 dark:text-gray-400'
        }`}
      >
        🔩 {activeTool === 'connector' ? 'Clique no modelo para adicionar' : 'Conector Manual  [C]'}
      </button>

      {/* Auto connectors */}
      {hasParts && (
        <div className="space-y-2">
          <div>
            <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-400">
              Espaçamento auto: {spacing} mm
            </label>
            <input
              type="range" min="5" max="50" step="5"
              value={spacing}
              onChange={(e) => setSpacing(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-0.5">
              <span>5 mm denso</span><span>50 mm esparso</span>
            </div>
          </div>

          <button
            onClick={handleAutoConnectors}
            disabled={running}
            className="w-full py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
          >
            {running ? (
              <><span className="animate-spin inline-block">⚙️</span> Calculando…</>
            ) : (
              <><Zap className="h-4 w-4" /> Auto-conectores</>
            )}
          </button>

          {lastAuto !== null && (
            <p className="text-xs text-center text-orange-600 dark:text-orange-400">
              ✅ {lastAuto} conectores colocados automaticamente
            </p>
          )}
        </div>
      )}

      {!hasParts && (
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Pinte pelo menos 2 partes para usar auto-conectores.
        </p>
      )}

      {/* Connector list */}
      {connectors.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
              {connectors.length} conector{connectors.length !== 1 ? 'es' : ''}
            </span>
            <button
              onClick={clearConnectors}
              className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
            >
              <Trash2 className="h-3 w-3" /> Limpar todos
            </button>
          </div>

          <div className="max-h-32 overflow-y-auto space-y-1">
            {connectors.map((conn, idx) => {
              const partA = painting.colors.get(conn.partAColorId);
              const partB = painting.colors.get(conn.partBColorId);
              return (
                <div
                  key={conn.id}
                  className="flex items-center gap-2 text-xs bg-gray-50 dark:bg-gray-700 rounded px-2 py-1"
                >
                  <span className="text-green-600">●</span>
                  <span className="flex-1 truncate text-gray-600 dark:text-gray-300">
                    #{idx + 1} — {partA?.name ?? '?'} → {partB?.name ?? '?'}
                  </span>
                  <span className="text-red-600">●</span>
                  <button
                    onClick={() => removeConnector(conn.id)}
                    className="text-gray-400 hover:text-red-500 flex-shrink-0"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400 dark:text-gray-500">
        🟢 pino (protuberância) · 🔴 furo — baked no export 3MF
      </p>
    </div>
  );
}
