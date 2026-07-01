import { BufferGeometry, Box3, Vector3 } from 'three';

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
export type PaintTool = 'brush' | 'bucket' | 'wand' | 'eraser' | 'lasso' | 'navigate' | 'connector';

export interface PaintingState {
  colorMap: Map<FaceIndex, ColorID>; // Maps face index to color ID
  colors: Map<ColorID, ColorGroup>; // All color groups
  brushSize: number; // 5-50 pixels
  selectedColorId: ColorID | null; // Currently selected color for painting
  activeTool: PaintTool;
  wandThreshold: number; // degrees 5-60, angle limit for magic wand
  wandMode: 'local' | 'global'; // local: compare to parent normal; global: compare to start normal
  bucketThreshold: number; // degrees 0-90, angle limit for flood fill (0 = unlimited)
  isolatedColorId: ColorID | null; // when set, non-isolated faces render near-black
  autoSegmentThreshold: number; // degrees 10-180: edges sharper than this split segments
}

/**
 * A connector pin placed between two painted parts.
 * partAColorId receives the protrusion (+); partBColorId receives the hole (−).
 */
export interface ConnectorPoint {
  id: string;
  position: { x: number; y: number; z: number }; // world-space position (serializable)
  normal: { x: number; y: number; z: number };   // points from B toward A
  partAColorId: ColorID; // pin side
  partBColorId: ColorID; // hole side
  radius: number; // mm
  depth: number;  // mm total length (split equally between the two parts)
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
  colorsJSON: string;         // base64 encoded ColorGroup[] (names/hex/faceCount)
  connectorsJSON: string;     // base64 encoded ConnectorPoint[]
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
  showWireframe: boolean;
}

/**
 * Complete state for the STL splitter store
 */
export interface STLSplitterState {
  model: STLModel | null;
  painting: PaintingState;
  colorMapHistory: Map<FaceIndex, ColorID>[];
  sessions: SavedSession[];
  ui: STLSplitterUIState;
  connectors: ConnectorPoint[];
  connectorRadius: number; // default radius in mm (shared setting)
}
