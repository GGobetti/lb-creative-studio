import { BufferGeometry, Box3 } from 'three';

/**
 * Branded string type for ColorID to prevent mixing with other ID types
 */
export type ColorID = string & { readonly __brand: 'ColorID' };

/**
 * Face index in the geometry - points to a specific triangle face
 */
export type FaceIndex = number;

/**
 * Represents a color group/part for the STL splitter
 */
export interface ColorGroup {
  id: ColorID;
  name: string; // "Part 1", "Part 2", etc.
  hex: string; // Color in hex format (e.g., "#ff0000")
  faceCount: number; // Number of faces in this color group
  createdAt: number; // Unix timestamp in milliseconds
}

/**
 * Represents the 3D model loaded from STL file
 */
export interface STLModel {
  geometry: BufferGeometry;
  originalFile: string; // Original filename
  boundingBox: Box3;
  vertexCount: number;
  faceCount: number;
}

/**
 * Represents the painting state - which faces are assigned to which colors
 */
export type PaintTool = 'brush' | 'bucket' | 'wand';

export interface PaintingState {
  colorMap: Map<FaceIndex, ColorID>; // Maps face index to color ID
  colors: Map<ColorID, ColorGroup>; // All color groups
  brushSize: number; // 5-50 pixels
  selectedColorId: ColorID | null; // Currently selected color for painting
  activeTool: PaintTool;
  wandThreshold: number; // degrees 5-60, angle limit for magic wand
  bucketThreshold: number; // degrees 0-90, angle limit for flood fill (0 = unlimited)
}

/**
 * Represents a saved painting session
 */
export interface SavedSession {
  id: string; // UUID
  timestamp: number; // When the session was saved
  originalFileName: string;
  colorMapCompressed: string; // base64 encoded compressed colorMap
  geometryCompressed: string; // base64 encoded compressed geometry
  metadata: {
    vertexCount: number;
    faceCount: number;
    colorGroupCount: number;
  };
}

/**
 * UI state for the STL splitter
 */
export interface STLSplitterUIState {
  isLoading: boolean;
  error: string | null;
  mode: 'upload' | 'painting' | 'export';
  showSessionRestore: boolean;
  exportProgress: number; // 0-100
}

/**
 * Complete state for the STL splitter store
 */
export interface STLSplitterState {
  // Model state
  model: STLModel | null;

  // Painting state
  painting: PaintingState;

  // Undo history (snapshots of colorMap before each paint operation)
  colorMapHistory: Map<FaceIndex, ColorID>[];

  // History/Sessions
  sessions: SavedSession[];

  // UI state
  ui: STLSplitterUIState;
}
