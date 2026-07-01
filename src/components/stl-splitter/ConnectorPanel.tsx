'use client';

import React, { useState } from 'react';
import { useSTLSplitterStore } from '@/store/stl-splitter.store';
import { findColorBoundaryEdges, sampleConnectorPositions } from '@/lib/stl-splitter/geometry-utils';
import { Trash2, Zap, ArrowLeftRight } from 'lucide-react';
import type { ColorID, ConnectorPoint } from '@/types/stl-splitter.types';

function Slider({
  label, value, min, max, step, unit, onChange,
}: {
  label: string; value: number; min: number; max: number; step: number; unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-400">
        {label}: {value.toFixed(step < 1 ? 2 : 0)}{unit}
      </label>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full"
      />
    </div>
  );
}

export function ConnectorPanel() {
  const model           = useSTLSplitterStore((state) => state.model);
  const painting        = useSTLSplitterStore((state) => state.painting);
  const connectors      = useSTLSplitterStore((state) => state.connectors);
  const connectorRadius = useSTLSplitterStore((state) => state.connectorRadius);
  const addConnector    = useSTLSplitterStore((state) => state.addConnector);
  const updateConnector = useSTLSplitterStore((state) => state.updateConnector);
  const removeConnector = useSTLSplitterStore((state) => state.removeConnector);
  const clearConnectors = useSTLSplitterStore((state) => state.clearConnectors);
  const setRadius       = useSTLSplitterStore((state) => state.setConnectorRadius);
  const setActiveTool   = useSTLSplitterStore((state) => state.setActiveTool);
  const activeTool      = useSTLSplitterStore((state) => state.painting.activeTool);

  const [spacing, setSpacing]     = useState(15); // mm between auto-connectors
  const [running, setRunning]     = useState(false);
  const [lastAuto, setLastAuto]   = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const hasParts = painting.colors.size >= 2;
  const selected = connectors.find((c) => c.id === selectedId) ?? null;

  const handleAutoConnectors = () => {
    if (!model?.geometry || !hasParts) return;
    setRunning(true);
    setLastAuto(null);

    setTimeout(() => {
      const edges = findColorBoundaryEdges(painting.colorMap as Map<number, ColorID>, model.geometry!);
      const sampled = sampleConnectorPositions(edges, spacing);

      for (const edge of sampled) {
        addConnector({
          position: { x: edge.midpoint.x, y: edge.midpoint.y, z: edge.midpoint.z },
          normal:   { x: edge.normal.x,   y: edge.normal.y,   z: edge.normal.z   },
          positionOffset: { x: 0, y: 0, z: 0 },
          rotationDeg: { x: 0, y: 0, z: 0 },
          partAColorId: edge.colorA,
          partBColorId: edge.colorB,
          radius: connectorRadius,
          depth:  Math.max(connectorRadius * 4, edge.gap + connectorRadius * 3),
          clearance: 0.2,
        });
      }

      setLastAuto(sampled.length);
      setRunning(false);
      console.log(`🔩 Auto-connectors: ${sampled.length} placed`);
    }, 16);
  };

  if (!model) return null;

  return (
    <div className="space-y-2.5">
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
        🔩 {activeTool === 'connector' ? 'Passe o mouse e clique para confirmar' : 'Conector Manual  [C]'}
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
              onClick={() => { clearConnectors(); setSelectedId(null); }}
              className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
            >
              <Trash2 className="h-3 w-3" /> Limpar todos
            </button>
          </div>

          <div className="max-h-32 overflow-y-auto space-y-1">
            {connectors.map((conn, idx) => {
              const partA = painting.colors.get(conn.partAColorId);
              const partB = painting.colors.get(conn.partBColorId);
              const isSelected = conn.id === selectedId;
              return (
                <div
                  key={conn.id}
                  onClick={() => setSelectedId(isSelected ? null : conn.id)}
                  className={`flex items-center gap-2 text-xs rounded px-2 py-1 cursor-pointer transition ${
                    isSelected
                      ? 'bg-orange-100 dark:bg-orange-950 border border-orange-400'
                      : 'bg-gray-50 dark:bg-gray-700 border border-transparent hover:border-orange-300'
                  }`}
                >
                  <span className="text-green-600">●</span>
                  <span className="flex-1 truncate text-gray-600 dark:text-gray-300">
                    #{idx + 1} — {partA?.name ?? '?'} → {partB?.name ?? '?'}
                  </span>
                  <span className="text-red-600">●</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isSelected) setSelectedId(null);
                      removeConnector(conn.id);
                    }}
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

      {/* Editing panel for the selected connector */}
      {selected && (
        <ConnectorEditor
          key={selected.id}
          connector={selected}
          partAName={painting.colors.get(selected.partAColorId)?.name ?? '?'}
          partBName={painting.colors.get(selected.partBColorId)?.name ?? '?'}
          onUpdate={(updates) => updateConnector(selected.id, updates)}
        />
      )}

      <p className="text-xs text-gray-400 dark:text-gray-500">
        🟢 pino (protuberância) · 🔴 furo — baked no export 3MF
      </p>
    </div>
  );
}

function ConnectorEditor({
  connector, partAName, partBName, onUpdate,
}: {
  connector: ConnectorPoint;
  partAName: string;
  partBName: string;
  onUpdate: (updates: Partial<Omit<ConnectorPoint, 'id'>>) => void;
}) {
  const { positionOffset, rotationDeg } = connector;

  return (
    <div className="p-3 rounded-lg border border-orange-300 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/30 space-y-3">
      <p className="text-xs font-semibold text-orange-700 dark:text-orange-300">
        Editando conector: {partAName} → {partBName}
      </p>

      <Slider label="Diâmetro" value={connector.radius * 2} min={1} max={10} step={0.5} unit=" mm"
        onChange={(v) => onUpdate({ radius: v / 2 })} />
      <Slider label="Profundidade" value={connector.depth} min={1} max={20} step={0.5} unit=" mm"
        onChange={(v) => onUpdate({ depth: v })} />
      <Slider label="Folga" value={connector.clearance} min={0} max={1} step={0.05} unit=" mm"
        onChange={(v) => onUpdate({ clearance: v })} />

      <div className="grid grid-cols-3 gap-2">
        <Slider label="Mover X" value={positionOffset.x} min={-10} max={10} step={0.1} unit=""
          onChange={(v) => onUpdate({ positionOffset: { ...positionOffset, x: v } })} />
        <Slider label="Mover Y" value={positionOffset.y} min={-10} max={10} step={0.1} unit=""
          onChange={(v) => onUpdate({ positionOffset: { ...positionOffset, y: v } })} />
        <Slider label="Mover Z" value={positionOffset.z} min={-10} max={10} step={0.1} unit=""
          onChange={(v) => onUpdate({ positionOffset: { ...positionOffset, z: v } })} />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Slider label="Girar X" value={rotationDeg.x} min={-180} max={180} step={1} unit="°"
          onChange={(v) => onUpdate({ rotationDeg: { ...rotationDeg, x: v } })} />
        <Slider label="Girar Y" value={rotationDeg.y} min={-180} max={180} step={1} unit="°"
          onChange={(v) => onUpdate({ rotationDeg: { ...rotationDeg, y: v } })} />
        <Slider label="Girar Z" value={rotationDeg.z} min={-180} max={180} step={1} unit="°"
          onChange={(v) => onUpdate({ rotationDeg: { ...rotationDeg, z: v } })} />
      </div>

      <button
        onClick={() => onUpdate({ partAColorId: connector.partBColorId, partBColorId: connector.partAColorId })}
        className="w-full py-1.5 rounded border text-xs font-medium transition flex items-center justify-center gap-1.5
          border-gray-300 dark:border-gray-600 hover:border-orange-400 text-gray-700 dark:text-gray-300"
      >
        <ArrowLeftRight className="h-3.5 w-3.5" /> Inverter pino/furo
      </button>
    </div>
  );
}
