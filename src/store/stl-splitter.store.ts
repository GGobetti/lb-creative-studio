'use client';

import { create } from 'zustand';
import { BufferGeometry, Box3 } from 'three';
import {
  ColorID,
  FaceIndex,
  ColorGroup,
  ConnectorPoint,
  PaintTool,
  STLModel,
  PaintingState,
  SavedSession,
  STLSplitterUIState,
  STLSplitterState,
} from '@/types/stl-splitter.types';
import {
  saveSessionToLocalStorage,
  loadSessionsFromLocalStorage,
  deleteSessionFromLocalStorage,
  deserializeColorMap,
  deserializeGeometry,
  deserializeColors,
  deserializeConnectors,
} from '@/lib/stl-splitter/session-storage';

const AUTO_SEGMENT_PALETTE = [
  '#E74C3C', '#3498DB', '#2ECC71', '#F39C12', '#9B59B6',
  '#1ABC9C', '#E67E22', '#2980B9', '#27AE60', '#8E44AD',
  '#C0392B', '#16A085', '#D35400', '#2471A3', '#1E8449',
  '#7D3C98',
];

/**
 * Helper to create a branded ColorID
 */
function generateColorID(): ColorID {
  return (`color-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` as unknown) as ColorID;
}

/**
 * Generate a random color in HSL format and convert to hex
 * Hue: 0-360, Saturation: 75-100%, Lightness: 50-70%
 */
function generateRandomColor(): string {
  const hue = Math.floor(Math.random() * 360);
  const saturation = Math.floor(Math.random() * 25) + 75; // 75-100%
  const lightness = Math.floor(Math.random() * 20) + 50; // 50-70%

  return hslToHex(hue, saturation, lightness);
}

/**
 * Convert HSL to Hex color format
 */
function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - ((((h / 60) % 2) - 1) % 2));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;

  if (h >= 0 && h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (h >= 60 && h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (h >= 120 && h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (h >= 180 && h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (h >= 240 && h < 300) {
    r = x;
    g = 0;
    b = c;
  } else if (h >= 300 && h < 360) {
    r = c;
    g = 0;
    b = x;
  }

  // Convert to 0-255 range and to hex
  const toHex = (val: number) => {
    const hex = Math.round((val + m) * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Initial painting state
 */
const initialPaintingState: PaintingState = {
  colorMap: new Map<FaceIndex, ColorID>(),
  colors: new Map<ColorID, ColorGroup>(),
  brushSize: 5,
  selectedColorId: null,
  activeTool: 'brush',
  wandThreshold: 15,
  wandMode: 'local',
  bucketThreshold: 60,
  isolatedColorId: null,
  autoSegmentThreshold: 45,
};

/**
 * Initial UI state
 */
const initialUIState: STLSplitterUIState = {
  isLoading: false,
  error: null,
  mode: 'upload',
  showSessionRestore: false,
  exportProgress: 0,
  showWireframe: false,
};

/**
 * Initial state for the store
 */
const initialState: STLSplitterState = {
  model: null,
  painting: initialPaintingState,
  colorMapHistory: [],
  sessions: typeof window !== 'undefined' ? loadSessionsFromLocalStorage() : [],
  ui: initialUIState,
  connectors: [],
  connectorRadius: 1.5,
};

interface STLSplitterStoreActions {
  // Model actions
  setModel: (model: STLModel | null) => void;
  setGeometry: (geometry: BufferGeometry, filename: string) => void;

  // Painting actions
  paintFaces: (faceIndices: FaceIndex[], colorId: ColorID) => void;
  eraseFaces: (faceIndices: FaceIndex[]) => void;
  undoPaint: () => void;
  addColor: () => ColorID;
  selectColor: (colorId: ColorID | null) => void;
  removeColor: (colorId: ColorID) => void;
  setBrushSize: (size: number) => void;
  setActiveTool: (tool: PaintTool) => void;
  setWandThreshold: (degrees: number) => void;
  setWandMode: (mode: 'local' | 'global') => void;
  setBucketThreshold: (degrees: number) => void;
  setIsolatedColorId: (id: ColorID | null) => void;
  updateColor: (colorId: ColorID, updates: { hex?: string; name?: string }) => void;
  applyAutoSegment: (segmentMap: Map<number, number>) => void;
  setShowWireframe: (show: boolean) => void;
  setAutoSegmentThreshold: (degrees: number) => void;

  // UI actions
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  setMode: (mode: 'upload' | 'painting' | 'export') => void;
  setExportProgress: (progress: number) => void;

  // Session management (stubs for now, implemented in Task 9)
  addSession: (session: SavedSession) => void;
  loadSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => void;

  // Connector actions
  addConnector: (connector: Omit<ConnectorPoint, 'id'>) => void;
  removeConnector: (id: string) => void;
  clearConnectors: () => void;
  setConnectorRadius: (radius: number) => void;

  // Utility
  clearAll: () => void;
}

type STLSplitterStore = STLSplitterState & STLSplitterStoreActions;

/**
 * Zustand store for the STL splitter
 */
export const useSTLSplitterStore = create<STLSplitterStore>((set, get) => ({
  ...initialState,

  // Model actions
  setModel: (model) => set({ model }),

  setGeometry: (geometry, filename) => {
    geometry.computeBoundingBox();
    const boundingBox = geometry.boundingBox || new Box3();

    const positions = geometry.attributes.position;
    const vertexCount = positions.count;

    // Calculate face count (assuming triangles, so it's count / 3)
    // For indexed geometry, use index length; for non-indexed, use position count / 3
    const faceCount = geometry.index
      ? geometry.index.count / 3
      : positions.count / 3;

    const newModel: STLModel = {
      geometry,
      originalFile: filename,
      boundingBox,
      vertexCount,
      faceCount: Math.floor(faceCount),
    };

    set({ model: newModel, ui: { ...initialUIState, mode: 'painting' } });
  },

  // Painting actions
  paintFaces: (faceIndices, colorId) => {
    set((state) => {
      // Snapshot current colorMap for undo (keep last 20)
      const newHistory = [...state.colorMapHistory, new Map(state.painting.colorMap)].slice(-20);

      const newColorMap = new Map(state.painting.colorMap);

      for (const faceIndex of faceIndices) {
        newColorMap.set(faceIndex, colorId);
      }

      // Update the face count for the color group
      const colors = new Map(state.painting.colors);
      const colorGroup = colors.get(colorId);
      if (colorGroup) {
        const updatedGroup: ColorGroup = {
          ...colorGroup,
          faceCount: newColorMap.values().toArray().filter((id) => id === colorId).length,
        };
        colors.set(colorId, updatedGroup);
      }

      return {
        colorMapHistory: newHistory,
        painting: {
          ...state.painting,
          colorMap: newColorMap,
          colors,
        },
      };
    });
  },

  eraseFaces: (faceIndices) => {
    set((state) => {
      const newHistory = [...state.colorMapHistory, new Map(state.painting.colorMap)].slice(-20);
      const newColorMap = new Map(state.painting.colorMap);
      const colorFaceDiff = new Map<ColorID, number>();

      for (const fi of faceIndices) {
        const colorId = newColorMap.get(fi as FaceIndex);
        if (colorId) {
          colorFaceDiff.set(colorId, (colorFaceDiff.get(colorId) || 0) + 1);
          newColorMap.delete(fi as FaceIndex);
        }
      }

      const colors = new Map(state.painting.colors);
      colorFaceDiff.forEach((removed, colorId) => {
        const color = colors.get(colorId);
        if (color) {
          colors.set(colorId, { ...color, faceCount: Math.max(0, color.faceCount - removed) });
        }
      });

      console.log(`🧹 Erase: removed color from ${faceIndices.length} faces`);
      return {
        colorMapHistory: newHistory,
        painting: { ...state.painting, colorMap: newColorMap, colors },
      };
    });
  },

  undoPaint: () => {
    set((state) => {
      if (state.colorMapHistory.length === 0) {
        console.log('↩️ Undo: nothing to undo');
        return state;
      }
      const history = [...state.colorMapHistory];
      const prevColorMap = history.pop()!;
      console.log(`↩️ Undo: restoring colorMap with ${prevColorMap.size} entries`);
      return {
        colorMapHistory: history,
        painting: { ...state.painting, colorMap: prevColorMap },
      };
    });
  },

  addColor: () => {
    const colorId = generateColorID();
    const hex = generateRandomColor();

    set((state) => {
      const colors = new Map(state.painting.colors);
      const partNumber = colors.size + 1;

      const newColorGroup: ColorGroup = {
        id: colorId,
        name: `Part ${partNumber}`,
        hex,
        faceCount: 0,
        createdAt: Date.now(),
      };

      colors.set(colorId, newColorGroup);

      return {
        painting: {
          ...state.painting,
          colors,
          selectedColorId: colorId,
        },
      };
    });

    return colorId;
  },

  selectColor: (colorId) => {
    set((state) => ({
      painting: {
        ...state.painting,
        selectedColorId: colorId,
      },
    }));
  },

  removeColor: (colorId) => {
    set((state) => {
      const colors = new Map(state.painting.colors);
      colors.delete(colorId);

      // Remove all faces associated with this color from colorMap
      const newColorMap = new Map(state.painting.colorMap);
      for (const [faceIndex, associatedColorId] of newColorMap.entries()) {
        if (associatedColorId === colorId) {
          newColorMap.delete(faceIndex);
        }
      }

      // Clear selection if it was the removed color
      const selectedColorId =
        state.painting.selectedColorId === colorId
          ? null
          : state.painting.selectedColorId;

      return {
        painting: {
          ...state.painting,
          colors,
          colorMap: newColorMap,
          selectedColorId,
        },
      };
    });
  },

  setBrushSize: (size) => {
    const clampedSize = Math.max(5, Math.min(50, size));
    set((state) => ({
      painting: {
        ...state.painting,
        brushSize: clampedSize,
      },
    }));
  },

  setActiveTool: (tool) => {
    set((state) => ({
      painting: {
        ...state.painting,
        activeTool: tool,
      },
    }));
  },

  setWandThreshold: (degrees) => {
    set((state) => ({
      painting: { ...state.painting, wandThreshold: Math.max(5, Math.min(60, degrees)) },
    }));
  },

  setWandMode: (mode) => {
    set((state) => ({ painting: { ...state.painting, wandMode: mode } }));
  },

  setBucketThreshold: (degrees) => {
    set((state) => ({
      painting: { ...state.painting, bucketThreshold: Math.max(0, Math.min(90, degrees)) },
    }));
  },

  setIsolatedColorId: (id) => {
    set((state) => ({ painting: { ...state.painting, isolatedColorId: id } }));
  },

  updateColor: (colorId, updates) => {
    set((state) => {
      const colors = new Map(state.painting.colors);
      const color = colors.get(colorId);
      if (!color) return state;
      colors.set(colorId, { ...color, ...updates });
      return { painting: { ...state.painting, colors } };
    });
  },

  applyAutoSegment: (segmentMap) => {
    set((state) => {
      const newHistory = [...state.colorMapHistory, new Map(state.painting.colorMap)].slice(-20);

      const counts = new Map<number, number>();
      segmentMap.forEach((segId) => counts.set(segId, (counts.get(segId) || 0) + 1));
      const top = Array.from(counts.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, 16);
      const topIds = new Set(top.map(([id]) => id));
      const fallbackId = top[top.length - 1]?.[0] ?? 0;

      const segToColor = new Map<number, ColorID>();
      const colors = new Map<ColorID, ColorGroup>();

      top.forEach(([segId], idx) => {
        const colorId = generateColorID();
        colors.set(colorId, {
          id: colorId,
          name: `Parte ${idx + 1}`,
          hex: AUTO_SEGMENT_PALETTE[idx % AUTO_SEGMENT_PALETTE.length],
          faceCount: 0,
          createdAt: Date.now(),
        });
        segToColor.set(segId, colorId);
      });

      const newColorMap = new Map<FaceIndex, ColorID>();
      segmentMap.forEach((segId, faceIndex) => {
        const resolvedSeg = topIds.has(segId) ? segId : fallbackId;
        const colorId = segToColor.get(resolvedSeg);
        if (colorId) newColorMap.set(faceIndex as FaceIndex, colorId);
      });

      colors.forEach((color, colorId) => {
        const count = Array.from(newColorMap.values()).filter((id) => id === colorId).length;
        colors.set(colorId, { ...color, faceCount: count });
      });

      console.log(`🔷 Auto-segment applied: ${top.length} parts, ${newColorMap.size} faces painted`);
      return {
        colorMapHistory: newHistory,
        painting: { ...state.painting, colors, colorMap: newColorMap, selectedColorId: null },
      };
    });
  },

  setShowWireframe: (show) => {
    set((state) => ({ ui: { ...state.ui, showWireframe: show } }));
  },

  setAutoSegmentThreshold: (degrees) => {
    set((state) => ({
      painting: { ...state.painting, autoSegmentThreshold: Math.max(10, Math.min(180, degrees)) },
    }));
  },

  // UI actions
  setLoading: (isLoading) => {
    set((state) => ({
      ui: {
        ...state.ui,
        isLoading,
      },
    }));
  },

  setError: (error) => {
    set((state) => ({
      ui: {
        ...state.ui,
        error,
      },
    }));
  },

  setMode: (mode) => {
    set((state) => ({
      ui: {
        ...state.ui,
        mode,
      },
    }));
  },

  setExportProgress: (progress) => {
    const clampedProgress = Math.max(0, Math.min(100, progress));
    set((state) => ({
      ui: {
        ...state.ui,
        exportProgress: clampedProgress,
      },
    }));
  },

  // Session management — persisted to localStorage
  addSession: (session) => {
    saveSessionToLocalStorage(session);
    set((state) => {
      const filtered = state.sessions.filter((s) => s.id !== session.id);
      return { sessions: [...filtered, session].slice(-5) }; // Keep only last 5 sessions
    });
  },

  loadSession: (sessionId) => {
    const session = get().sessions.find((s) => s.id === sessionId);
    if (!session) {
      console.warn('⚠️ loadSession: session not found', sessionId);
      return;
    }

    const geometry = deserializeGeometry(session.geometryCompressed);
    geometry.computeBoundingBox();
    const boundingBox = geometry.boundingBox || new Box3();

    const newModel: STLModel = {
      geometry,
      originalFile: session.originalFileName,
      boundingBox,
      vertexCount: geometry.attributes.position.count,
      faceCount: session.metadata.faceCount,
    };

    set({
      model: newModel,
      connectors: deserializeConnectors(session.connectorsJSON),
      colorMapHistory: [],
      painting: {
        ...initialPaintingState,
        colorMap: deserializeColorMap(session.colorMapCompressed) as Map<FaceIndex, ColorID>,
        colors: deserializeColors(session.colorsJSON),
      },
      ui: { ...initialUIState, mode: 'painting' },
    });
    console.log(`📂 Session restored: ${session.originalFileName}`);
  },

  deleteSession: (sessionId) => {
    deleteSessionFromLocalStorage(sessionId);
    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== sessionId),
    }));
  },

  // Connector actions
  addConnector: (connector) => {
    const id = `conn-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    set((state) => ({ connectors: [...state.connectors, { ...connector, id }] }));
    console.log('🔩 Connector added:', id);
  },

  removeConnector: (id) => {
    set((state) => ({ connectors: state.connectors.filter((c) => c.id !== id) }));
    console.log('🗑️ Connector removed:', id);
  },

  clearConnectors: () => {
    set({ connectors: [] });
    console.log('🗑️ All connectors cleared');
  },

  setConnectorRadius: (radius) => {
    set({ connectorRadius: Math.max(0.5, Math.min(5, radius)) });
  },

  // Utility
  clearAll: () => set(initialState),
}));
