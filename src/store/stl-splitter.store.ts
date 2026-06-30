'use client';

import { create } from 'zustand';
import { BufferGeometry, Box3 } from 'three';
import {
  ColorID,
  FaceIndex,
  ColorGroup,
  STLModel,
  PaintingState,
  SavedSession,
  STLSplitterUIState,
  STLSplitterState,
} from '@/types/stl-splitter.types';

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
};

/**
 * Initial state for the store
 */
const initialState: STLSplitterState = {
  model: null,
  painting: initialPaintingState,
  sessions: [],
  ui: initialUIState,
};

interface STLSplitterStoreActions {
  // Model actions
  setModel: (model: STLModel | null) => void;
  setGeometry: (geometry: BufferGeometry, filename: string) => void;

  // Painting actions
  paintFaces: (faceIndices: FaceIndex[], colorId: ColorID) => void;
  addColor: () => ColorID;
  selectColor: (colorId: ColorID | null) => void;
  removeColor: (colorId: ColorID) => void;
  setBrushSize: (size: number) => void;

  // UI actions
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  setMode: (mode: 'upload' | 'painting' | 'export') => void;
  setExportProgress: (progress: number) => void;

  // Session management (stubs for now, implemented in Task 9)
  addSession: (session: SavedSession) => void;
  loadSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => void;

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

    set({ model: newModel });
  },

  // Painting actions
  paintFaces: (faceIndices, colorId) => {
    set((state) => {
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
        painting: {
          ...state.painting,
          colorMap: newColorMap,
          colors,
        },
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

  // Session management (stubs)
  addSession: (session) => {
    set((state) => ({
      sessions: [session, ...state.sessions].slice(0, 5), // Keep only last 5 sessions
    }));
  },

  loadSession: (_sessionId) => {
    // Stub: Will be implemented in Task 9
    // Should decompress and restore colorMap and geometry
  },

  deleteSession: (sessionId) => {
    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== sessionId),
    }));
  },

  // Utility
  clearAll: () => set(initialState),
}));
