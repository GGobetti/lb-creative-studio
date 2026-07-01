'use client';

import React, { useState, useRef } from 'react';
import { useSTLSplitterStore } from '@/store/stl-splitter.store';
import { ColorID } from '@/types/stl-splitter.types';
import { Trash2, Eye, EyeOff } from 'lucide-react';

export function ColorList() {
  const colors             = useSTLSplitterStore((state) => state.painting.colors);
  const selectedColorId    = useSTLSplitterStore((state) => state.painting.selectedColorId);
  const isolatedColorId    = useSTLSplitterStore((state) => state.painting.isolatedColorId);
  const selectColor        = useSTLSplitterStore((state) => state.selectColor);
  const removeColor        = useSTLSplitterStore((state) => state.removeColor);
  const updateColor        = useSTLSplitterStore((state) => state.updateColor);
  const setIsolatedColorId = useSTLSplitterStore((state) => state.setIsolatedColorId);

  const [editingNameId, setEditingNameId] = useState<ColorID | null>(null);
  const [draftName, setDraftName] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);

  const commitName = (colorId: ColorID) => {
    const trimmed = draftName.trim();
    if (trimmed) updateColor(colorId, { name: trimmed });
    setEditingNameId(null);
  };

  if (colors.size === 0) {
    return (
      <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
        Nenhuma cor ainda. Adicione uma cor e comece a pintar.
      </div>
    );
  }

  return (
    <div>
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
          const isIsolated      = isolatedColorId === color.id;
          const isOtherIsolated = isolatedColorId !== null && !isIsolated;
          const isEditingName   = editingNameId === color.id;

          return (
            <div
              key={color.id}
              onClick={() => { if (!isEditingName) selectColor(color.id); }}
              className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition group ${
                selectedColorId === color.id
                  ? 'bg-blue-100 dark:bg-blue-900 border-2 border-blue-500'
                  : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 border-2 border-transparent'
              } ${isOtherIsolated ? 'opacity-40' : ''}`}
            >
              {/* Color swatch — click to open native color picker */}
              <label
                className="relative flex-shrink-0 cursor-pointer"
                title="Clique para mudar a cor"
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  className="w-5 h-5 rounded border border-gray-300 dark:border-gray-500"
                  style={{ backgroundColor: color.hex }}
                />
                <input
                  type="color"
                  value={color.hex}
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                  onChange={(e) => {
                    updateColor(color.id, { hex: e.target.value });
                    console.log('🎨 Color changed:', color.id, e.target.value);
                  }}
                />
              </label>

              {/* Editable name */}
              <div className="flex-1 min-w-0">
                {isEditingName ? (
                  <input
                    ref={nameInputRef}
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    onBlur={() => commitName(color.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitName(color.id);
                      if (e.key === 'Escape') setEditingNameId(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full text-sm font-medium bg-white dark:bg-gray-600 border border-blue-400 rounded px-1 py-0 outline-none"
                    autoFocus
                  />
                ) : (
                  <p
                    className="font-medium text-sm leading-tight truncate cursor-text hover:underline"
                    title="Duplo clique para renomear"
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setEditingNameId(color.id);
                      setDraftName(color.name);
                      setTimeout(() => nameInputRef.current?.select(), 0);
                    }}
                  >
                    {color.name}
                  </p>
                )}
                <p className="text-xs text-gray-500 dark:text-gray-400">{color.faceCount} faces</p>
              </div>

              {/* Isolate button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsolatedColorId(isIsolated ? null : color.id);
                }}
                title={isIsolated ? 'Mostrar todas' : `Isolar ${color.name}`}
                className={`p-1 rounded transition flex-shrink-0 opacity-0 group-hover:opacity-100 ${
                  isIsolated ? 'opacity-100 text-blue-500' : 'text-gray-400 hover:text-blue-500'
                }`}
              >
                {isIsolated ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>

              {/* Delete button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (isIsolated) setIsolatedColorId(null);
                  removeColor(color.id);
                }}
                title={`Remover ${color.name}`}
                className="p-1 rounded text-gray-400 hover:text-red-600 transition flex-shrink-0 opacity-0 group-hover:opacity-100"
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
