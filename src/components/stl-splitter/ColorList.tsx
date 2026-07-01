'use client';

import React from 'react';
import { useSTLSplitterStore } from '@/store/stl-splitter.store';
import { Trash2, Eye, EyeOff } from 'lucide-react';

export function ColorList() {
  const colors             = useSTLSplitterStore((state) => state.painting.colors);
  const selectedColorId    = useSTLSplitterStore((state) => state.painting.selectedColorId);
  const isolatedColorId    = useSTLSplitterStore((state) => state.painting.isolatedColorId);
  const selectColor        = useSTLSplitterStore((state) => state.selectColor);
  const removeColor        = useSTLSplitterStore((state) => state.removeColor);
  const setIsolatedColorId = useSTLSplitterStore((state) => state.setIsolatedColorId);

  if (colors.size === 0) {
    return (
      <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
        Nenhuma cor ainda. Adicione uma cor e comece a pintar.
      </div>
    );
  }

  return (
    <div>
      {/* "Show all" banner when isolating */}
      {isolatedColorId && (
        <div className="px-4 pt-3 pb-1 flex items-center justify-between border-b border-gray-100 dark:border-gray-700">
          <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
            👁️ Modo isolado ativo
          </span>
          <button
            onClick={() => setIsolatedColorId(null)}
            className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 underline"
          >
            Mostrar todas
          </button>
        </div>
      )}

      <div className="space-y-1.5 max-h-96 overflow-y-auto p-3">
        {Array.from(colors.values()).map((color) => {
          const isIsolated = isolatedColorId === color.id;
          const isOtherIsolated = isolatedColorId !== null && !isIsolated;

          return (
            <div
              key={color.id}
              onClick={() => {
                console.log('🎯 Color selected:', color.id, color.name);
                selectColor(color.id);
              }}
              className={`flex items-center gap-2 p-2.5 rounded-lg cursor-pointer transition ${
                selectedColorId === color.id
                  ? 'bg-blue-100 dark:bg-blue-900 border-2 border-blue-500'
                  : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 border-2 border-transparent'
              } ${isOtherIsolated ? 'opacity-40' : ''}`}
            >
              {/* Color swatch */}
              <div
                className="w-5 h-5 rounded flex-shrink-0 border border-gray-300 dark:border-gray-500"
                style={{ backgroundColor: color.hex }}
              />

              {/* Name + face count */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm leading-tight truncate">{color.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{color.faceCount} faces</p>
              </div>

              {/* Isolate eye button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const newId = isIsolated ? null : color.id;
                  console.log('👁️ Isolate toggled:', newId);
                  setIsolatedColorId(newId);
                }}
                title={isIsolated ? 'Mostrar todas as cores' : `Isolar ${color.name}`}
                className={`p-1 rounded transition flex-shrink-0 ${
                  isIsolated
                    ? 'text-blue-500 hover:text-blue-700 dark:text-blue-400'
                    : 'text-gray-400 hover:text-blue-500 dark:hover:text-blue-400'
                }`}
              >
                {isIsolated ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>

              {/* Delete button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (isIsolated) setIsolatedColorId(null); // clear isolate if deleting isolated color
                  removeColor(color.id);
                }}
                title={`Remover ${color.name}`}
                className="p-1 rounded text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition flex-shrink-0"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
