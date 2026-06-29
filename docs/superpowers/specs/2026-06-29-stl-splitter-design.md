# STL Splitter Feature Design

**Date:** 2026-06-29  
**Status:** Design  
**Scope:** Standalone web tool for interactive STL mesh separation  
**Epic:** Multi-part STL management  

---

## Overview

A browser-based STL splitting tool allowing users to:
1. Upload a single STL file
2. Interactively paint mesh faces with auto-generated colors to group parts
3. Export the result as a 3MF file with multiple objects (one per color group)
4. Auto-save session history locally

**Target Users:** 3D designers, engineers who need to split monolithic models into printable parts.

**Constraints:**
- MVP: brush-based painting only (wand tool in V2)
- No backend processing — all in-browser
- Single-file upload (no batch)
- Export format: 3MF multi-object

---

## Functional Requirements

### F1: File Upload
- **Drag-drop** or file picker input
- Accept: `.stl` files (binary or ASCII)
- Validation: file size (<50MB), format check
- Error handling: invalid files show user-friendly error
- On success: geometry loaded, render in viewer, enter paint mode

### F2: 3D Viewer & Interaction
- Render STL in Three.js canvas
- **Mouse controls:** rotate (orbit), pan, zoom
- **Pick/raycast:** click on faces to detect intersection
- Visual feedback: clicked face highlights briefly
- Geometry bounds automatically fit viewport

### F3: Painting & Color Groups
- **Brush tool:** click faces to paint with active color
- **Brush size:** slider (5–50px diameter)
- **Color management:**
  - First paint auto-creates "Part 1" (random color)
  - Each subsequent color is auto-assigned ("Part 2", "Part 3", etc.)
  - User can see list of colors + face count per color
  - Can delete unused colors
- **Visual indication:** painted faces show assigned color; unpainted faces show default gray
- State: all painting tracked in Zustand store

### F4: Export to 3MF
- **Format:** 3MF (`.3mf` file, XML-based multi-object format)
- **Structure:** Each color group becomes a separate object/mesh in the output
- **Export flow:**
  1. User clicks "Export" → preview dialog shows mesh count
  2. Confirm → triggers 3MF serialization
  3. Browser downloads file as `model_split.3mf`
- **Fallback:** if 3MF export fails, offer `.obj` multi-file (zip) as alternative

### F5: Session Persistence
- **Auto-save:** every 30 seconds if changes detected
- **Storage:** localStorage with key `splitter_sessions`
- **Data stored per session:**
  - Compressed color map (face→color mapping)
  - Serialized geometry (base64)
  - Original filename
  - Timestamp
- **Retention:** max 5 sessions; oldest auto-deleted when limit reached
- **UX:** on page load, if prior session exists, show "Restore previous session?" option

### F6: Error Handling
- **Invalid STL:** show toast error, allow retry
- **Oversized files (>50MB):** warn but allow proceed
- **Corrupted session:** discard gracefully, offer fresh upload
- **Export failure:** show error, allow retry
- **Out-of-memory:** graceful degrade (disable undo, clear oldest session)

---

## Technical Architecture

### Stack
- **Frontend:** React 19 + Next.js 16 (app router)
- **State:** Zustand (stl-splitter.store.ts)
- **3D Rendering:** Three.js 0.177+
- **STL Parsing:** Three.js STLLoader
- **Export:** 3MF serialization (custom or via three-stdlib if available)
- **Styling:** Tailwind CSS (match LB-creative design system)
- **Storage:** localStorage (client-side only)

### File Structure
```
src/
├── app/dashboard/stl-splitter/
│   ├── page.tsx              (route, metadata)
│   ├── layout.tsx            (wrapper)
│   └── STLSplitterClient.tsx  (main client component)
├── components/stl-splitter/
│   ├── STLUploader.tsx        (upload + validation)
│   ├── STLViewer.tsx          (Three.js canvas)
│   ├── PaintToolbar.tsx       (brush controls, color list)
│   ├── ExportModal.tsx        (export preview/confirm)
│   └── SessionHistory.tsx     (restore previous sessions)
├── lib/stl-splitter/
│   ├── stl-parser.ts          (STL → BufferGeometry utils)
│   ├── 3mf-exporter.ts        (export logic)
│   └── geometry-utils.ts      (raycasting, face detection, painting)
└── store/
    └── stl-splitter.store.ts  (Zustand store)
```

### State Management (Zustand)

**Store Structure:**
```typescript
interface STLSplitterState {
  // Model data
  model: {
    geometry: BufferGeometry | null;
    originalFile: File | null;
    boundingBox: Box3;
  };
  
  // Painting state
  painting: {
    colorMap: Map<FaceIndex, ColorID>;      // face # → color
    colors: Map<ColorID, {
      id: ColorID;
      name: string;                         // "Part 1", etc.
      hex: string;
      faceCount: number;
    }>;
    brushSize: number;                      // pixels
    selectedColorId: ColorID | null;
  };
  
  // Persistence
  history: {
    sessions: SavedSession[];               // last 5
    currentSessionId: string;
    lastAutoSave: number;                   // timestamp
  };
  
  // UI state
  ui: {
    isLoading: boolean;
    error: string | null;
    mode: 'upload' | 'painting' | 'export';
    showSessionRestore: boolean;
  };
  
  // Actions
  loadSTL(file: File): Promise<void>;
  paintFaces(faceIndices: number[], colorId: ColorID): void;
  addColor(): ColorID;
  removeColor(colorId: ColorID): void;
  selectColor(colorId: ColorID): void;
  setBrushSize(size: number): void;
  exportTo3MF(): Promise<Blob>;
  saveSession(): void;
  loadSession(sessionId: string): void;
  restoreSession(sessionId: string): void;
  clearAll(): void;
}
```

### Data Persistence Format

**localStorage key:** `splitter_sessions`

**Value (JSON array):**
```json
[
  {
    "id": "uuid-1",
    "timestamp": 1719673200000,
    "originalFileName": "model.stl",
    "colorMap": "compressed base64 JSON",
    "geometry": "base64-encoded BufferGeometry",
    "metadata": {
      "vertexCount": 45000,
      "faceCount": 15000,
      "partCount": 3
    }
  },
  ...
]
```

**Compression strategy:** JSON.stringify → gzip (via pako if needed) → base64 to avoid localStorage size issues.

---

## UI/UX Design

### Layout
**Split-view:**
- **Left panel (25%):**
  - Upload section (drag-drop zone)
  - Color list (scrollable, shows color + face count)
  - Actions: "New Project", "Export", "Clear All"
  - Session history (collapsed by default)
  
- **Right panel (75%):**
  - Three.js canvas (full height)
  - Top toolbar: brush size slider, selected color indicator
  - Bottom status: "X faces painted / Y total faces"

### Components

#### STLUploader
- Drag-drop zone with upload icon
- File input fallback
- Progress indicator during parse
- Error toast if invalid

#### STLViewer
- Three.js canvas, full-screen
- Auto-fit geometry to viewport
- Orbit controls (rotate, pan, zoom)
- Painted faces render with solid color; unpainted faces gray
- On click: face detection via raycasting, visual highlight (0.5s glow), then paint

#### PaintToolbar
- **Brush size slider** (5–50px, labeled)
- **Active color indicator** (circle showing current color + "Part N" label)
- **Color list:**
  - Each row: color dot, name, face count, delete icon
  - Click row to select color for painting
- **Add color button** (if user wants manual grouping; auto-assigns next part name)

#### ExportModal
- Preview: "Found 3 meshes from 3 colors"
- Filename input (default: `{originalName}_split.3mf`)
- "Download" button
- "Cancel" button

#### SessionHistory
- Expandable section
- List of up to 5 sessions with timestamp
- "Restore" button per session
- "Delete" button per session

### Visual Style
- Match LB-creative design (Tailwind, dark mode support)
- Color palette: use LB secondary colors for part indicators
- Icons: Lucide React (upload, trash, check, download, etc.)
- Typography: Geist (Next.js default) or existing LB font

---

## Export Format: 3MF

**3MF Structure (XML):**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<model xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2013/12">
  <resources>
    <object id="1" type="model">
      <mesh>
        <vertices>
          <vertex x="0.0" y="0.0" z="0.0" />
          ...
        </vertices>
        <triangles>
          <triangle v1="0" v2="1" v3="2" />
          ...
        </triangles>
      </mesh>
    </object>
    <object id="2" type="model">
      <!-- Part 2 geometry -->
    </object>
  </resources>
  <build>
    <item objectid="1" path="/3D/Textures/0_uuid" />
    <item objectid="2" path="/3D/Textures/1_uuid" />
  </build>
</model>
```

**Implementation:**
- Iterate over color groups in store
- For each group, extract faces with that color
- Create vertex + triangle arrays for that mesh
- Serialize to 3MF XML
- Package as `.3mf` (ZIP with XML + metadata)

**Fallback (if 3MF fails):** export as OBJ + MTL (multi-file ZIP)

---

## Roadmap

### V1 (MVP — Current Scope)
- ✅ Upload STL (binary + ASCII)
- ✅ Render in Three.js viewer
- ✅ Brush painting with auto-colors
- ✅ Export to 3MF
- ✅ Local session history
- ✅ Error handling

### V2 (Next Phase)
- 🔧 Magic wand tool (flood-fill by connectivity)
- 🔧 Undo/Redo stack
- 🔧 3D preview before export
- 🔧 Color picker (user chooses colors manually)
- 🔧 Mesh statistics panel (vertex/face/size info)

### V3 (Future)
- 💡 Save projects to portfolio (DB persistence)
- 💡 Edge smoothing/decimation before export
- 💡 Merge parts (combine multiple colors)
- 💡 Printability validation (FDM/SLA checks)
- 💡 Batch operations (upload multiple STLs)
- 💡 Share split model (via link)

---

## Error Scenarios & Mitigation

| Scenario | Mitigation |
|----------|-----------|
| Upload >50MB | Warn user, allow proceed (monitor memory) |
| Invalid/corrupted STL | Show error, suggest re-upload |
| Paint while parsing | Disable UI until load complete |
| Export fails | Catch error, show toast, allow retry |
| localStorage full | Trim oldest session, retry save |
| Session corrupted | Discard, offer fresh start |
| WebGL not supported | Show friendly error, offer fallback (static viewer) |

---

## Testing Strategy

### Unit Tests
- Geometry utils (raycasting, face detection)
- 3MF export (serialization correctness)
- Store actions (mutations)

### Integration Tests
- Upload → Render → Paint → Export flow
- Session save/restore
- Error recovery

### Manual Testing
- Multi-browser (Chrome, Firefox, Safari)
- Different STL sizes (small, medium, large)
- Edge cases: single-face mesh, very high-poly models

---

## Success Criteria

- ✅ STL upload works reliably
- ✅ Painting feels responsive (<100ms per click)
- ✅ Exported 3MF opens in Cura/Prusaslicer
- ✅ Session history works (5 sessions saved/restored)
- ✅ No console errors in normal workflow
- ✅ Mobile-friendly (responsive canvas)

---

## Future Considerations

- **Performance:** if poly count >1M, consider LOD or geometry decimation
- **Mobile:** touch painting could be tricky; may need simplification for V2
- **Accessibility:** ensure keyboard shortcuts for paint tools
- **Analytics:** track which features users use (V2)

---

## Appendix: Dependencies

**New packages needed:**
- `three`: already in package.json ✓
- `three-stdlib`: for 3MF exporter (verify/add)
- `pako`: for gzip compression (optional, if localStorage size is concern)
- `uuid`: already likely in project (for session IDs)

**Remove/deprecate:** none

---

**Design Status:** Ready for implementation planning.  
**Next Step:** Invoke `writing-plans` skill to generate detailed implementation roadmap.
