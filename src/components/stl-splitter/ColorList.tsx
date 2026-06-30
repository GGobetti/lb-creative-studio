'use client';

import React from 'react';
import { useSTLSplitterStore } from '@/store/stl-splitter.store';
import { Trash2 } from 'lucide-react';

export function ColorList() {
  const colors = useSTLSplitterStore((state) => state.painting.colors);
  const selectedColorId = useSTLSplitterStore((state) => state.painting.selectedColorId);
  const selectColor = useSTLSplitterStore((state) => state.selectColor);
  const removeColor = useSTLSplitterStore((state) => state.removeColor);

  if (colors.size === 0) {
    return (
      <div className="p-4 text-center text-gray-500 dark:text-gray-400">
        No colors yet. Start painting to create parts.
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-96 overflow-y-auto p-4">
      {Array.from(colors.values()).map((color) => (
        <div
          key={color.id}
          onClick={() => selectColor(color.id)}
          className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition ${
            selectedColorId === color.id
              ? 'bg-blue-100 dark:bg-blue-900 border-2 border-blue-500'
              : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          <div
            className="w-6 h-6 rounded border border-gray-400"
            style={{ backgroundColor: color.hex }}
          />
          <div className="flex-1">
            <p className="font-medium text-sm">{color.name}</p>
            <p className="text-xs text-gray-500">{color.faceCount} faces</p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              removeColor(color.id);
            }}
            className="p-1 text-gray-400 hover:text-red-600 transition"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
