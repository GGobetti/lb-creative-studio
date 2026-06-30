'use client';

import React from 'react';
import { useSTLSplitterStore } from '@/store/stl-splitter.store';
import { PaintTool } from '@/types/stl-splitter.types';

const TOOLS: { id: PaintTool; label: string; icon: string; hint: string }[] = [
  { id: 'brush',  icon: '🖌️', label: 'Brush',  hint: 'Click and paint individual faces within brush radius' },
  { id: 'bucket', icon: '🪣', label: 'Bucket', hint: 'Flood fill entire connected region from clicked face' },
  { id: 'wand',   icon: '✨', label: 'Wand',   hint: 'Fill faces with similar surface angle (magic wand)' },
];

export function PaintToolbar() {
  const brushSize     = useSTLSplitterStore((state) => state.painting.brushSize);
  const selectedColorId = useSTLSplitterStore((state) => state.painting.selectedColorId);
  const activeTool    = useSTLSplitterStore((state) => state.painting.activeTool);
  const colors        = useSTLSplitterStore((state) => state.painting.colors);
  const setBrushSize  = useSTLSplitterStore((state) => state.setBrushSize);
  const addColor      = useSTLSplitterStore((state) => state.addColor);
  const setActiveTool = useSTLSplitterStore((state) => state.setActiveTool);

  const selectedColor = selectedColorId ? colors.get(selectedColorId) : null;

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
      </div>

      {/* Brush size — only relevant for brush tool */}
      {activeTool === 'brush' && (
        <div>
          <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-400">
            Brush size: {brushSize}px
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
          <span className="text-sm text-gray-500 flex-1">No color selected</span>
        )}

        <button
          onClick={() => {
            const id = addColor();
            console.log('🖍️ Add Color clicked. New color id:', id);
          }}
          className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition text-xs font-medium whitespace-nowrap"
        >
          + Add Color
        </button>
      </div>

      {/* Status hint */}
      {selectedColor ? (
        <div className="text-xs px-3 py-2 rounded bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300">
          {activeTool === 'brush'  && `🖌️ Click model to paint with ${selectedColor.name}`}
          {activeTool === 'bucket' && `🪣 Click any region on model to fill entire connected area with ${selectedColor.name}`}
          {activeTool === 'wand'   && `✨ Click a surface to select all faces with similar angle — then it paints with ${selectedColor.name}`}
        </div>
      ) : (
        <div className="text-xs px-3 py-2 rounded bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
          ⚠️ Click "+ Add Color" to create a part and start painting
        </div>
      )}
    </div>
  );
}
