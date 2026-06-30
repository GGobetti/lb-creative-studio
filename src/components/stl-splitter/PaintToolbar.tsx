'use client';

import React, { useEffect } from 'react';
import { useSTLSplitterStore } from '@/store/stl-splitter.store';
import { PaintTool } from '@/types/stl-splitter.types';

const TOOLS: { id: PaintTool; label: string; icon: string; hint: string }[] = [
  { id: 'brush',  icon: '🖌️', label: 'Pincel',  hint: 'Clique e pinte faces individuais dentro do raio do pincel' },
  { id: 'bucket', icon: '🪣', label: 'Balde',   hint: 'Preenchimento por região conectada a partir da face clicada' },
  { id: 'wand',   icon: '✨', label: 'Varinha',  hint: 'Preenche faces com ângulo de superfície similar (varinha mágica)' },
];

export function PaintToolbar() {
  const brushSize        = useSTLSplitterStore((state) => state.painting.brushSize);
  const selectedColorId  = useSTLSplitterStore((state) => state.painting.selectedColorId);
  const activeTool       = useSTLSplitterStore((state) => state.painting.activeTool);
  const wandThreshold    = useSTLSplitterStore((state) => state.painting.wandThreshold);
  const bucketThreshold  = useSTLSplitterStore((state) => state.painting.bucketThreshold);
  const colors           = useSTLSplitterStore((state) => state.painting.colors);
  const colorMapHistory  = useSTLSplitterStore((state) => state.colorMapHistory);

  const setBrushSize       = useSTLSplitterStore((state) => state.setBrushSize);
  const addColor           = useSTLSplitterStore((state) => state.addColor);
  const setActiveTool      = useSTLSplitterStore((state) => state.setActiveTool);
  const setWandThreshold   = useSTLSplitterStore((state) => state.setWandThreshold);
  const setBucketThreshold = useSTLSplitterStore((state) => state.setBucketThreshold);
  const undoPaint          = useSTLSplitterStore((state) => state.undoPaint);

  const selectedColor = selectedColorId ? colors.get(selectedColorId) : null;
  const canUndo = colorMapHistory.length > 0;

  // Ctrl+Z global shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        console.log('↩️ Ctrl+Z pressed — undoing last paint');
        undoPaint();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undoPaint]);

  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow space-y-3">
      {/* Tool selector */}
      <div className="flex gap-2">
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            title={tool.hint}
            onClick={() => {
              setActiveTool(tool.id);
              console.log('🔧 Tool selected:', tool.id);
            }}
            className={`flex-1 flex flex-col items-center py-2 px-1 rounded-lg border-2 transition text-sm font-medium ${
              activeTool === tool.id
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                : 'border-gray-200 dark:border-gray-600 hover:border-gray-400 text-gray-600 dark:text-gray-400'
            }`}
          >
            <span className="text-xl leading-none mb-1">{tool.icon}</span>
            <span className="text-xs">{tool.label}</span>
          </button>
        ))}

        {/* Undo button */}
        <button
          title="Desfazer última pintura (Ctrl+Z)"
          onClick={() => {
            console.log('↩️ Undo button clicked');
            undoPaint();
          }}
          disabled={!canUndo}
          className={`flex flex-col items-center py-2 px-3 rounded-lg border-2 transition text-sm font-medium ${
            canUndo
              ? 'border-gray-300 dark:border-gray-500 hover:border-orange-400 hover:text-orange-600 dark:hover:text-orange-400 text-gray-600 dark:text-gray-400'
              : 'border-gray-100 dark:border-gray-700 text-gray-300 dark:text-gray-600 cursor-not-allowed'
          }`}
        >
          <span className="text-xl leading-none mb-1">↩️</span>
          <span className="text-xs">Undo</span>
        </button>
      </div>

      {/* Brush size — only relevant for brush tool */}
      {activeTool === 'brush' && (
        <div>
          <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-400">
            Tamanho do pincel: {brushSize}px
          </label>
          <input
            type="range"
            min="5"
            max="50"
            step="1"
            value={brushSize}
            onChange={(e) => setBrushSize(parseInt(e.target.value))}
            className="w-full"
          />
        </div>
      )}

      {/* Magic wand threshold */}
      {activeTool === 'wand' && (
        <div>
          <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-400">
            Sensibilidade da varinha: {wandThreshold}°
            <span className="ml-1 text-gray-400">(menor = mais preciso)</span>
          </label>
          <input
            type="range"
            min="5"
            max="60"
            step="5"
            value={wandThreshold}
            onChange={(e) => {
              const v = parseInt(e.target.value);
              setWandThreshold(v);
              console.log('✨ Wand threshold changed to', v, 'degrees');
            }}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-0.5">
            <span>5° preciso</span>
            <span>60° amplo</span>
          </div>
        </div>
      )}

      {/* Bucket threshold */}
      {activeTool === 'bucket' && (
        <div>
          <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-400">
            Limite do balde: {bucketThreshold === 0 ? 'sem limite' : `${bucketThreshold}°`}
            <span className="ml-1 text-gray-400">(menor = para em curvas)</span>
          </label>
          <input
            type="range"
            min="0"
            max="90"
            step="10"
            value={bucketThreshold}
            onChange={(e) => {
              const v = parseInt(e.target.value);
              setBucketThreshold(v);
              console.log('🪣 Bucket threshold changed to', v, 'degrees');
            }}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-0.5">
            <span>0 sem limite</span>
            <span>90° só plano</span>
          </div>
        </div>
      )}

      {/* Active color + add */}
      <div className="flex items-center gap-2">
        {selectedColor ? (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div
              className="w-6 h-6 rounded border-2 border-gray-300 dark:border-gray-600 flex-shrink-0"
              style={{ backgroundColor: selectedColor.hex }}
            />
            <span className="font-medium text-sm truncate">{selectedColor.name}</span>
          </div>
        ) : (
          <span className="text-sm text-gray-500 flex-1">Nenhuma cor selecionada</span>
        )}

        <button
          onClick={() => {
            const id = addColor();
            console.log('🖍️ Add Color clicked. New color id:', id);
          }}
          className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition text-xs font-medium whitespace-nowrap"
        >
          + Adicionar Cor
        </button>
      </div>

      {/* Undo hint */}
      {canUndo && (
        <div className="text-xs text-gray-400 dark:text-gray-500">
          ↩️ {colorMapHistory.length} {colorMapHistory.length === 1 ? 'ação' : 'ações'} para desfazer (Ctrl+Z)
        </div>
      )}

      {/* Status hint */}
      {selectedColor ? (
        <div className="text-xs px-3 py-2 rounded bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300">
          {activeTool === 'brush'  && `🖌️ Clique no modelo para pintar com ${selectedColor.name}`}
          {activeTool === 'bucket' && `🪣 Clique em qualquer região para preencher área conectada com ${selectedColor.name}`}
          {activeTool === 'wand'   && `✨ Clique numa superfície para selecionar faces com ângulo similar e pintar com ${selectedColor.name}`}
        </div>
      ) : (
        <div className="text-xs px-3 py-2 rounded bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
          ⚠️ Clique em "+ Adicionar Cor" para criar uma parte e começar a pintar
        </div>
      )}
    </div>
  );
}
