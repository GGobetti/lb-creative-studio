'use client';

import React from 'react';
import { useSTLSplitterStore } from '@/store/stl-splitter.store';

export function PaintToolbar() {
  const brushSize = useSTLSplitterStore((state) => state.painting.brushSize);
  const selectedColorId = useSTLSplitterStore((state) => state.painting.selectedColorId);
  const colors = useSTLSplitterStore((state) => state.painting.colors);
  const setBrushSize = useSTLSplitterStore((state) => state.setBrushSize);
  const addColor = useSTLSplitterStore((state) => state.addColor);

  const selectedColor = selectedColorId ? colors.get(selectedColorId) : null;

  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 max-w-xs">
          <label className="block text-sm font-medium mb-2">Brush Size: {brushSize}px</label>
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

        <div className="flex items-center gap-2">
          {selectedColor ? (
            <>
              <div
                className="w-8 h-8 rounded border-2 border-gray-300 dark:border-gray-600"
                style={{ backgroundColor: selectedColor.hex }}
              />
              <span className="font-medium text-sm">{selectedColor.name}</span>
            </>
          ) : (
            <span className="text-sm text-gray-500">No color selected</span>
          )}
        </div>

        <button
          onClick={() => {
            const id = addColor();
            console.log('🖍️ Add Color clicked. New color id:', id);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition text-sm font-medium"
        >
          + Add Color
        </button>
      </div>

      {selectedColor ? (
        <div className="text-xs px-3 py-2 rounded bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 flex items-center gap-2">
          🖌️ Click directly on the 3D model to paint with <strong>{selectedColor.name}</strong>
        </div>
      ) : (
        <div className="text-xs px-3 py-2 rounded bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
          ⚠️ No color selected — clicking the model won't do anything yet. Click "+ Add Color" above to start painting.
        </div>
      )}
    </div>
  );
}
