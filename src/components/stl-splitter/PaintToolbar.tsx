'use client';

import React, { useEffect } from 'react';
import { useSTLSplitterStore } from '@/store/stl-splitter.store';
import { PaintTool } from '@/types/stl-splitter.types';

const TOOLS: { id: PaintTool; label: string; icon: string; hint: string; key: string }[] = [
  { id: 'navigate', icon: '✋', label: 'Navegar', hint: 'Orbitar/girar livremente sem pintar (Space = temporário)',    key: 'H' },
  { id: 'brush',    icon: '🖌️', label: 'Pincel',  hint: 'Clique ou arraste para pintar — círculo mostra o raio',       key: 'B' },
  { id: 'bucket',   icon: '🪣', label: 'Balde',   hint: 'Preenchimento por região conectada a partir da face clicada', key: 'G' },
  { id: 'wand',     icon: '✨', label: 'Varinha',  hint: 'Preenche faces com ângulo de superfície similar (BFS)',       key: 'W' },
  { id: 'eraser',   icon: '🧹', label: 'Borracha', hint: 'Clique ou arraste para apagar cores de faces pintadas',      key: 'E' },
  { id: 'lasso',     icon: '🔵', label: 'Laço',     hint: 'Desenhe uma área livre para pintar todas as faces dentro',    key: 'L' },
  { id: 'connector', icon: '🔩', label: 'Conector', hint: 'Passe o mouse perto de uma junção para ver o pino em preview e clique para confirmar', key: 'C' },
];

export function PaintToolbar() {
  const brushSize        = useSTLSplitterStore((state) => state.painting.brushSize);
  const selectedColorId  = useSTLSplitterStore((state) => state.painting.selectedColorId);
  const activeTool       = useSTLSplitterStore((state) => state.painting.activeTool);
  const wandThreshold    = useSTLSplitterStore((state) => state.painting.wandThreshold);
  const wandMode         = useSTLSplitterStore((state) => state.painting.wandMode);
  const bucketThreshold  = useSTLSplitterStore((state) => state.painting.bucketThreshold);
  const colors           = useSTLSplitterStore((state) => state.painting.colors);
  const colorMapHistory  = useSTLSplitterStore((state) => state.colorMapHistory);

  const setBrushSize       = useSTLSplitterStore((state) => state.setBrushSize);
  const addColor           = useSTLSplitterStore((state) => state.addColor);
  const setActiveTool      = useSTLSplitterStore((state) => state.setActiveTool);
  const setWandThreshold   = useSTLSplitterStore((state) => state.setWandThreshold);
  const setWandMode        = useSTLSplitterStore((state) => state.setWandMode);
  const setBucketThreshold = useSTLSplitterStore((state) => state.setBucketThreshold);
  const undoPaint          = useSTLSplitterStore((state) => state.undoPaint);

  const selectedColor = selectedColorId ? colors.get(selectedColorId) : null;
  const canUndo = colorMapHistory.length > 0;

  // Keyboard shortcuts: Ctrl+Z undo, H/B/G/W/E/L tool switch, Space = temp navigate
  useEffect(() => {
    let prevTool: PaintTool | null = null;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore shortcuts only when actually typing text — sliders (range
      // inputs) and buttons keep focus after being dragged/clicked, and if
      // we bailed out for those too, Space never got preventDefault()'d,
      // so the browser fell back to its native "scroll the page" behavior.
      const target = e.target as HTMLElement;
      const isTextEntry =
        (target instanceof HTMLInputElement && !['range', 'checkbox', 'radio', 'color', 'button'].includes(target.type)) ||
        target instanceof HTMLTextAreaElement ||
        target.isContentEditable;
      if (isTextEntry) return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        console.log('↩️ Ctrl+Z — undo');
        undoPaint();
        return;
      }

      // Space held → temporary navigate mode
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        prevTool = useSTLSplitterStore.getState().painting.activeTool;
        if (prevTool !== 'navigate') {
          setActiveTool('navigate');
          console.log('✋ Space held — navigate mode');
        }
        return;
      }

      if (e.repeat) return;

      const MAP: Record<string, PaintTool> = {
        h: 'navigate',  H: 'navigate',
        b: 'brush',     B: 'brush',
        g: 'bucket',    G: 'bucket',
        w: 'wand',      W: 'wand',
        e: 'eraser',    E: 'eraser',
        l: 'lasso',     L: 'lasso',
        c: 'connector', C: 'connector',
      };
      const tool = MAP[e.key];
      if (tool) {
        e.preventDefault();
        setActiveTool(tool);
        console.log(`🔧 Shortcut: ${e.key} → ${tool}`);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && prevTool !== null) {
        setActiveTool(prevTool);
        console.log('✋ Space released — back to', prevTool);
        prevTool = null;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup',   handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup',   handleKeyUp);
    };
  }, [undoPaint, setActiveTool]);

  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow space-y-3">

      {/* Tool selector — 4+3 grid */}
      <div className="grid grid-cols-4 gap-1">
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            title={`${tool.hint} [${tool.key}]`}
            onClick={() => {
              setActiveTool(tool.id);
              console.log('🔧 Tool selected:', tool.id);
            }}
            className={`relative flex flex-col items-center py-2 px-1 rounded-lg border-2 transition text-sm font-medium ${
              activeTool === tool.id
                ? tool.id === 'navigate'
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300'
                  : tool.id === 'eraser'
                  ? 'border-red-400 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400'
                  : 'border-blue-500 bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                : 'border-gray-200 dark:border-gray-600 hover:border-gray-400 text-gray-600 dark:text-gray-400'
            }`}
          >
            <span className="text-xl leading-none mb-0.5">{tool.icon}</span>
            <span className="text-xs leading-none">{tool.label}</span>
            <span className="absolute top-1 right-1.5 text-[9px] text-gray-400 dark:text-gray-500 font-mono leading-none">
              {tool.key}
            </span>
          </button>
        ))}
      </div>

      {/* Undo button */}
      <button
        title="Desfazer última pintura (Ctrl+Z)"
        onClick={() => { console.log('↩️ Undo clicked'); undoPaint(); }}
        disabled={!canUndo}
        className={`w-full py-1.5 rounded-lg border text-xs font-medium transition flex items-center justify-center gap-1.5 ${
          canUndo
            ? 'border-gray-300 dark:border-gray-600 hover:border-orange-400 hover:text-orange-600 dark:hover:text-orange-400 text-gray-600 dark:text-gray-300'
            : 'border-gray-100 dark:border-gray-700 text-gray-300 dark:text-gray-600 cursor-not-allowed'
        }`}
      >
        ↩️ Desfazer {canUndo && <span className="text-gray-400">({colorMapHistory.length})</span>}
      </button>

      {/* Brush size — only for brush/eraser */}
      {(activeTool === 'brush' || activeTool === 'eraser') && (
        <div>
          <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-400">
            {activeTool === 'eraser' ? 'Raio da borracha' : 'Tamanho do pincel'}: {brushSize}px
          </label>
          <input
            type="range" min="5" max="50" step="1" value={brushSize}
            onChange={(e) => setBrushSize(parseInt(e.target.value))}
            className="w-full"
          />
        </div>
      )}

      {/* Magic wand controls */}
      {activeTool === 'wand' && (
        <div className="space-y-2">
          <div>
            <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-400">
              Sensibilidade: {wandThreshold}°
              <span className="ml-1 text-gray-400">(menor = mais preciso)</span>
            </label>
            <input
              type="range" min="5" max="60" step="5" value={wandThreshold}
              onChange={(e) => {
                const v = parseInt(e.target.value);
                setWandThreshold(v);
                console.log('✨ Wand threshold:', v);
              }}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-0.5">
              <span>5° preciso</span><span>60° amplo</span>
            </div>
          </div>
          <button
            onClick={() => {
              const next = wandMode === 'local' ? 'global' : 'local';
              setWandMode(next);
              console.log('✨ Wand mode:', next);
            }}
            className="w-full py-1 px-2 rounded border text-xs font-medium transition
              border-gray-300 dark:border-gray-600 hover:border-blue-400
              text-gray-700 dark:text-gray-300 text-left"
          >
            {wandMode === 'local'
              ? '🌊 Local — segue curvas (recomendado)'
              : '📌 Global — âncora no ponto clicado'}
          </button>
        </div>
      )}

      {/* Bucket threshold */}
      {activeTool === 'bucket' && (
        <div>
          <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-400">
            Limite de ângulo: {bucketThreshold === 0 ? 'sem limite' : `${bucketThreshold}°`}
            <span className="ml-1 text-gray-400">(menor = para em curvas)</span>
          </label>
          <input
            type="range" min="0" max="90" step="10" value={bucketThreshold}
            onChange={(e) => {
              const v = parseInt(e.target.value);
              setBucketThreshold(v);
              console.log('🪣 Bucket threshold:', v);
            }}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-0.5">
            <span>0 sem limite</span><span>90° só plano</span>
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
            console.log('🖍️ Add Color. New id:', id);
          }}
          className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition text-xs font-medium whitespace-nowrap"
        >
          + Cor
        </button>
      </div>

      {/* Status hint */}
      {activeTool === 'navigate' ? (
        <div className="text-xs px-3 py-2 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
          ✋ Arraste para orbitar · Scroll para zoom · Botão direito para pan · Space = temporário
        </div>
      ) : selectedColor ? (
        <div className={`text-xs px-3 py-2 rounded ${
          activeTool === 'eraser'
            ? 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300'
            : 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300'
        }`}>
          {activeTool === 'brush'  && `🖌️ Clique ou arraste para pintar com ${selectedColor.name}`}
          {activeTool === 'bucket' && `🪣 Clique para preencher região conectada com ${selectedColor.name}`}
          {activeTool === 'wand'   && `✨ Clique numa superfície — pinta faces de ângulo similar com ${selectedColor.name}`}
          {activeTool === 'eraser' && `🧹 Clique ou arraste para apagar cores no modelo`}
          {activeTool === 'lasso'     && `🔵 Segure e arraste para desenhar o laço — pinta tudo dentro com ${selectedColor.name}`}
          {activeTool === 'connector' && `🔩 Passe o mouse perto de uma junção — o modelo fica translúcido e mostra o pino em preview`}
        </div>
      ) : activeTool !== 'eraser' ? (
        <div className="text-xs px-3 py-2 rounded bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
          ⚠️ Clique em "+ Cor" para criar uma parte e começar a pintar
        </div>
      ) : (
        <div className="text-xs px-3 py-2 rounded bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300">
          🧹 Arraste sobre faces pintadas para apagá-las
        </div>
      )}
    </div>
  );
}
