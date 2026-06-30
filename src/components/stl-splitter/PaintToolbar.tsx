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
    <div className="flex items-center justify-between gap-4 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
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
        onClick={() => addColor()}
        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition text-sm font-medium"
      >
        + Add Color
      </button>
    </div>
  );
}
