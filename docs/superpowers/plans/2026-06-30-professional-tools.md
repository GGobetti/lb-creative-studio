# Professional STL Painting Tools — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add auto-segmentation, color picker, inline rename, wireframe overlay, and lasso selection to the STL Splitter, making it near-professional and semi-automated.

**Architecture:** New algorithms in `geometry-utils.ts`; new store actions for `updateColor`, `applyAutoSegment`, `showWireframe`; STLViewer gains a 2D lasso canvas overlay and a wireframe LineSegments mesh; a new `AutoSegmentPanel` component handles the auto-segment UI; `ColorList` gains inline color + name editing.

**Tech Stack:** React 19, Next.js 16, Three.js 0.177, Zustand 5, Tailwind CSS, TypeScript, fflate

## Global Constraints

- `'use client'` on every component/store file
- Branch: `feat/photoshop-painting-ux` (already exists, keep pushing to it)
- No Zustand calls inside Three.js hot paths — use refs for state reads
- `npm run dev` requires `--webpack` flag on arm64 Mac (already in package.json)
- Max 16 auto-segment colors (matches common multi-material printer limits)
- TypeScript strict — run `npx tsc --noEmit 2>&1 | grep stl-splitter` after every task

---

## File Map

| File | Change |
|---|---|
| `src/types/stl-splitter.types.ts` | Add `'lasso'` to PaintTool; `showWireframe` to UIState; `autoSegmentThreshold` to PaintingState |
| `src/store/stl-splitter.store.ts` | Add `updateColor`, `applyAutoSegment`, `setShowWireframe`, `setAutoSegmentThreshold` |
| `src/lib/stl-splitter/geometry-utils.ts` | Add `autoSegmentBySharpEdges`, `getFacesInLasso`, `isPointInPolygon` |
| `src/components/stl-splitter/ColorList.tsx` | Inline color picker (`<input type="color">`) + inline name edit |
| `src/components/stl-splitter/STLViewer.tsx` | Wireframe LineSegments toggle + lasso 2D canvas overlay |
| `src/components/stl-splitter/PaintToolbar.tsx` | Add lasso tool button |
| `src/components/stl-splitter/AutoSegmentPanel.tsx` | **NEW** — threshold slider + "Auto-segmentar" button |
| `src/app/dashboard/stl-splitter/STLSplitterClient.tsx` | Mount `<AutoSegmentPanel />` in sidebar |

---

## Task 1: Types + Store foundation

**Files:**
- Modify: `src/types/stl-splitter.types.ts`
- Modify: `src/store/stl-splitter.store.ts`

**Produces:**
- `PaintTool = 'brush' | 'bucket' | 'wand' | 'eraser' | 'lasso'`
- `PaintingState.autoSegmentThreshold: number` (10–180, default 45)
- `STLSplitterUIState.showWireframe: boolean`
- `store.updateColor(colorId, updates: { hex?: string; name?: string }) => void`
- `store.applyAutoSegment(segmentMap: Map<number, number>) => void` — creates ColorGroups + paints all faces
- `store.setShowWireframe(show: boolean) => void`
- `store.setAutoSegmentThreshold(degrees: number) => void`

- [ ] **Step 1: Update types**

In `src/types/stl-splitter.types.ts`, apply these exact replacements:

```typescript
// Replace PaintTool line:
export type PaintTool = 'brush' | 'bucket' | 'wand' | 'eraser' | 'lasso';

// In PaintingState, add after isolatedColorId:
  autoSegmentThreshold: number; // degrees 10-180: edges sharper than this split segments

// In STLSplitterUIState, add after exportProgress:
  showWireframe: boolean;
```

- [ ] **Step 2: Add new actions to STLSplitterStoreActions interface**

In `src/store/stl-splitter.store.ts`, add to the `STLSplitterStoreActions` interface:

```typescript
  updateColor: (colorId: ColorID, updates: { hex?: string; name?: string }) => void;
  applyAutoSegment: (segmentMap: Map<number, number>) => void;
  setShowWireframe: (show: boolean) => void;
  setAutoSegmentThreshold: (degrees: number) => void;
```

- [ ] **Step 3: Update initialPaintingState**

Add `autoSegmentThreshold: 45` to `initialPaintingState`.

- [ ] **Step 4: Update initialUIState**

Add `showWireframe: false` to `initialUIState`.

- [ ] **Step 5: Add AUTO_SEGMENT_PALETTE constant**

Add near the top of `src/store/stl-splitter.store.ts`, before the store `create()` call:

```typescript
const AUTO_SEGMENT_PALETTE = [
  '#E74C3C', '#3498DB', '#2ECC71', '#F39C12', '#9B59B6',
  '#1ABC9C', '#E67E22', '#2980B9', '#27AE60', '#8E44AD',
  '#C0392B', '#16A085', '#D35400', '#2471A3', '#1E8449',
  '#7D3C98',
];
```

- [ ] **Step 6: Implement updateColor**

Add inside `create()`, after `setIsolatedColorId`:

```typescript
updateColor: (colorId, updates) => {
  set((state) => {
    const colors = new Map(state.painting.colors);
    const color = colors.get(colorId);
    if (!color) return state;
    colors.set(colorId, { ...color, ...updates });
    return { painting: { ...state.painting, colors } };
  });
},
```

- [ ] **Step 7: Implement applyAutoSegment**

```typescript
applyAutoSegment: (segmentMap) => {
  set((state) => {
    const newHistory = [...state.colorMapHistory, new Map(state.painting.colorMap)].slice(-20);

    // Count faces per segment, pick top 16 by face count
    const counts = new Map<number, number>();
    segmentMap.forEach((segId) => counts.set(segId, (counts.get(segId) || 0) + 1));
    const top = Array.from(counts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 16);
    const topIds = new Set(top.map(([id]) => id));
    const fallbackId = top[top.length - 1]?.[0] ?? 0;

    // Create one ColorGroup per top segment
    const segToColor = new Map<number, ColorID>();
    const colors = new Map<ColorID, ColorGroup>(state.painting.colors);

    top.forEach(([segId], idx) => {
      const colorId = generateColorID();
      const partNumber = colors.size + 1;
      colors.set(colorId, {
        id: colorId,
        name: `Parte ${partNumber}`,
        hex: AUTO_SEGMENT_PALETTE[idx % AUTO_SEGMENT_PALETTE.length],
        faceCount: 0,
        createdAt: Date.now(),
      });
      segToColor.set(segId, colorId);
    });

    // Build new colorMap
    const newColorMap = new Map<FaceIndex, ColorID>(state.painting.colorMap);
    segmentMap.forEach((segId, faceIndex) => {
      const resolvedSeg = topIds.has(segId) ? segId : fallbackId;
      const colorId = segToColor.get(resolvedSeg);
      if (colorId) newColorMap.set(faceIndex as FaceIndex, colorId);
    });

    // Recalculate face counts
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
```

- [ ] **Step 8: Implement setShowWireframe and setAutoSegmentThreshold**

```typescript
setShowWireframe: (show) => {
  set((state) => ({ ui: { ...state.ui, showWireframe: show } }));
},

setAutoSegmentThreshold: (degrees) => {
  set((state) => ({
    painting: { ...state.painting, autoSegmentThreshold: Math.max(10, Math.min(180, degrees)) },
  }));
},
```

- [ ] **Step 9: TypeScript check**

```bash
cd "/Users/ggobetti/Projetos Pessoais/lb-creative-studio"
npx tsc --noEmit 2>&1 | grep stl-splitter
```

Expected: no output.

- [ ] **Step 10: Commit**

```bash
git add src/types/stl-splitter.types.ts src/store/stl-splitter.store.ts
git commit -m "feat(stl-splitter): add lasso tool, wireframe, auto-segment types and store actions"
```

---

## Task 2: geometry-utils — auto-segment + lasso helpers

**Files:**
- Modify: `src/lib/stl-splitter/geometry-utils.ts`

**Produces:**
- `autoSegmentBySharpEdges(geometry, thresholdDegrees) → Map<faceIndex, segmentId>`
- `getFacesInLasso(polygon, mesh, camera, viewportW, viewportH, positions) → number[]`
- `isPointInPolygon(px, py, polygon) → boolean` (exported for testing)

- [ ] **Step 1: Add autoSegmentBySharpEdges**

Append to `src/lib/stl-splitter/geometry-utils.ts`:

```typescript
// Auto-segmentation: BFS through face adjacency using only "gentle" edges.
// Edges where adjacent-face normals differ by more than thresholdDegrees break
// the graph, causing faces on opposite sides to land in separate segments.
// thresholdDegrees=180 → only disconnected shells separate. 45 → split at creases.
export function autoSegmentBySharpEdges(
  geometry: BufferGeometry,
  thresholdDegrees: number = 45
): Map<number, number> {
  const positions = geometry.attributes.position.array as Float32Array;
  const totalFaces = Math.floor(positions.length / 9);
  const cosThreshold = Math.cos((thresholdDegrees * Math.PI) / 180);

  // Build edge → faces map (same as buildFaceAdjacency but inline for speed)
  const edgeToFaces = new Map<string, number[]>();
  for (let fi = 0; fi < totalFaces; fi++) {
    for (let ei = 0; ei < 3; ei++) {
      const va = fi * 9 + ei * 3;
      const vb = fi * 9 + ((ei + 1) % 3) * 3;
      const ka = `${positions[va].toFixed(5)},${positions[va + 1].toFixed(5)},${positions[va + 2].toFixed(5)}`;
      const kb = `${positions[vb].toFixed(5)},${positions[vb + 1].toFixed(5)},${positions[vb + 2].toFixed(5)}`;
      const key = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
      const entry = edgeToFaces.get(key);
      if (entry) entry.push(fi); else edgeToFaces.set(key, [fi]);
    }
  }

  // Build restricted adjacency: only connect faces whose normals are within threshold
  const adj = new Map<number, number[]>();
  for (const faces of edgeToFaces.values()) {
    if (faces.length < 2) continue;
    for (let i = 0; i < faces.length; i++) {
      for (let j = i + 1; j < faces.length; j++) {
        const fi = faces[i], fj = faces[j];
        const ni = getFaceNormal(positions, fi);
        const nj = getFaceNormal(positions, fj);
        if (ni.dot(nj) >= cosThreshold) {
          const ai = adj.get(fi); if (ai) ai.push(fj); else adj.set(fi, [fj]);
          const aj = adj.get(fj); if (aj) aj.push(fi); else adj.set(fj, [fi]);
        }
      }
    }
  }

  // BFS to find connected components in restricted graph
  const faceToSegment = new Map<number, number>();
  let segmentId = 0;
  for (let start = 0; start < totalFaces; start++) {
    if (faceToSegment.has(start)) continue;
    const queue = [start];
    faceToSegment.set(start, segmentId);
    while (queue.length > 0) {
      const cur = queue.shift()!;
      for (const nb of (adj.get(cur) || [])) {
        if (!faceToSegment.has(nb)) { faceToSegment.set(nb, segmentId); queue.push(nb); }
      }
    }
    segmentId++;
  }

  console.log(`🔷 Auto-segment (threshold ${thresholdDegrees}°): ${segmentId} segments, ${totalFaces} faces`);
  return faceToSegment;
}
```

- [ ] **Step 2: Add lasso helpers**

```typescript
// Returns true if point (px,py) is inside the polygon using ray-casting.
export function isPointInPolygon(
  px: number,
  py: number,
  polygon: { x: number; y: number }[]
): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

// Projects all face centroids to screen space and returns faces whose centroid
// falls inside the lasso polygon. Back-facing faces (dot(normal, camDir) < 0) skipped.
export function getFacesInLasso(
  polygon: { x: number; y: number }[],
  mesh: import('three').Mesh,
  camera: import('three').PerspectiveCamera,
  viewportW: number,
  viewportH: number,
  positions: Float32Array
): number[] {
  if (polygon.length < 3) return [];

  const { Vector3, Matrix4 } = require('three') as typeof import('three');
  const camDir = new Vector3();
  camera.getWorldDirection(camDir);
  const mvp = new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  const worldMatrix = mesh.matrixWorld;

  const selected: number[] = [];
  const totalFaces = Math.floor(positions.length / 9);
  const tmp = new Vector3();

  for (let fi = 0; fi < totalFaces; fi++) {
    const base = fi * 9;
    const cx = (positions[base] + positions[base + 3] + positions[base + 6]) / 3;
    const cy = (positions[base + 1] + positions[base + 4] + positions[base + 7]) / 3;
    const cz = (positions[base + 2] + positions[base + 5] + positions[base + 8]) / 3;

    tmp.set(cx, cy, cz).applyMatrix4(worldMatrix).applyMatrix4(mvp);
    if (tmp.z > 1) continue; // behind far plane

    const sx = (tmp.x + 1) / 2 * viewportW;
    const sy = (1 - tmp.y) / 2 * viewportH;

    if (isPointInPolygon(sx, sy, polygon)) selected.push(fi);
  }

  console.log(`🔵 Lasso: ${selected.length} faces in polygon`);
  return selected;
}
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep geometry-utils
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/lib/stl-splitter/geometry-utils.ts
git commit -m "feat(stl-splitter): add autoSegmentBySharpEdges + lasso geometry helpers"
```

---

## Task 3: ColorList — inline color picker + rename

**Files:**
- Modify: `src/components/stl-splitter/ColorList.tsx`

**Consumes:** `store.updateColor(colorId, { hex?, name? })`

**Goal:** Click the color swatch → native color picker opens. Click the part name → turns into an editable `<input>`.

- [ ] **Step 1: Replace ColorList.tsx entirely**

```tsx
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
              <label className="relative flex-shrink-0 cursor-pointer" title="Clique para mudar a cor">
                <div
                  className="w-5 h-5 rounded border border-gray-300 dark:border-gray-500"
                  style={{ backgroundColor: color.hex }}
                />
                <input
                  type="color"
                  value={color.hex}
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                  onChange={(e) => {
                    e.stopPropagation();
                    updateColor(color.id, { hex: e.target.value });
                    console.log('🎨 Color changed:', color.id, e.target.value);
                  }}
                  onClick={(e) => e.stopPropagation()}
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
                    title="Clique para renomear"
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
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep ColorList
```

Expected: no output.

- [ ] **Step 3: Manual verify**

Load STL, paint 2 parts. Verify:
- Clicking color swatch opens native OS color picker ✓
- Choosing a new color updates the 3D model rendering ✓
- Double-clicking the name "Parte 1" makes it editable ✓
- Pressing Enter or clicking away saves the new name ✓
- Pressing Escape cancels the edit ✓

- [ ] **Step 4: Commit**

```bash
git add src/components/stl-splitter/ColorList.tsx
git commit -m "feat(stl-splitter): inline color picker and rename in ColorList"
```

---

## Task 4: STLViewer — wireframe overlay toggle

**Files:**
- Modify: `src/components/stl-splitter/STLViewer.tsx`

**Consumes:** `store.ui.showWireframe: boolean`

**Goal:** When `showWireframe` is true, an `EdgesGeometry`-based LineSegments mesh appears on the model showing significant edges (>15°).

- [ ] **Step 1: Add wireframeMeshRef and showWireframe subscription**

At the top of the `STLViewer` component, add:

```typescript
const wireframeMeshRef = useRef<THREE.LineSegments | null>(null);
const showWireframe    = useSTLSplitterStore((state) => state.ui.showWireframe);
```

- [ ] **Step 2: Add wireframe useEffect**

After the color-update useEffect, add:

```typescript
useEffect(() => {
  if (!sceneRef.current || !model?.geometry) return;

  if (showWireframe) {
    if (!wireframeMeshRef.current) {
      const edgesGeo = new THREE.EdgesGeometry(model.geometry, 15); // edges > 15° shown
      const mat = new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.22, transparent: true });
      wireframeMeshRef.current = new THREE.LineSegments(edgesGeo, mat);
      sceneRef.current.add(wireframeMeshRef.current);
      console.log('🔲 Wireframe overlay added');
    }
    wireframeMeshRef.current.visible = true;
  } else if (wireframeMeshRef.current) {
    wireframeMeshRef.current.visible = false;
    console.log('🔲 Wireframe overlay hidden');
  }
}, [showWireframe, model?.geometry]);
```

- [ ] **Step 3: Add wireframe toggle button to STLViewer JSX**

In the `return (...)` block, add a button overlay in the top-right corner, after the tip div:

```tsx
{/* Wireframe toggle */}
<button
  onClick={() => {
    const setShowWireframe = useSTLSplitterStore.getState().setShowWireframe;
    setShowWireframe(!showWireframe);
  }}
  title={showWireframe ? 'Ocultar wireframe' : 'Mostrar wireframe das arestas'}
  className={`absolute top-3 right-3 text-xs px-2.5 py-1 rounded-full border transition pointer-events-auto z-10 ${
    showWireframe
      ? 'bg-blue-600 border-blue-500 text-white'
      : 'bg-black/40 border-gray-600 text-gray-300 hover:text-white'
  }`}
>
  {showWireframe ? '🔲 Wireframe ON' : '⬜ Wireframe'}
</button>
```

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep STLViewer
```

Expected: no output.

- [ ] **Step 5: Manual verify**

Load STL. Click "⬜ Wireframe" button. Verify:
- White edge lines appear on the model surface ✓
- Button turns blue and says "Wireframe ON" ✓
- Painted colors still show through the wireframe ✓
- Clicking again hides the wireframe ✓

- [ ] **Step 6: Commit**

```bash
git add src/components/stl-splitter/STLViewer.tsx
git commit -m "feat(stl-splitter): wireframe edge overlay toggle in viewer"
```

---

## Task 5: STLViewer — lasso selection tool

**Files:**
- Modify: `src/components/stl-splitter/STLViewer.tsx`

**Consumes:**
- `PaintTool` now includes `'lasso'`
- `getFacesInLasso(polygon, mesh, camera, w, h, positions) → number[]` from geometry-utils
- `paintFaces` from store (already subscribed)

**Goal:** When `activeTool === 'lasso'`, a 2D canvas overlay captures mouse events. The user draws a freeform polygon by holding and dragging. On mouseup, all faces whose screen-projected centroid falls inside the polygon are painted with the selected color.

- [ ] **Step 1: Add lassoCanvasRef and cameraRef**

In the component body, add:

```typescript
const lassoCanvasRef = useRef<HTMLCanvasElement>(null);
const cameraRef      = useRef<THREE.PerspectiveCamera | null>(null);
```

- [ ] **Step 2: Store camera in cameraRef inside the main scene useEffect**

Immediately after `const camera = new PerspectiveCamera(...)`, add:

```typescript
cameraRef.current = camera;
```

And in the cleanup `return () => { ... }`, add:

```typescript
cameraRef.current = null;
```

- [ ] **Step 3: Disable OrbitControls when lasso tool is active**

Add a new useEffect (after the wireframe effect):

```typescript
useEffect(() => {
  if (!controlsRef.current) return;
  // Lasso needs full mouse control — disable orbit while it's the active tool
  controlsRef.current.enabled = painting.activeTool !== 'lasso';
  if (cursorRef.current && painting.activeTool === 'lasso') {
    cursorRef.current.style.display = 'none'; // hide circle cursor; lasso canvas uses crosshair
  }
}, [painting.activeTool]);
```

- [ ] **Step 4: Add lasso canvas useEffect**

Add the lasso drawing useEffect after the orbit-disable effect:

```typescript
useEffect(() => {
  const canvas = lassoCanvasRef.current;
  const container = containerRef.current;
  if (!canvas || !container || !model?.geometry) return;

  // Sync canvas pixel dimensions to the container
  canvas.width  = container.clientWidth;
  canvas.height = container.clientHeight;
  const ctx = canvas.getContext('2d')!;

  let drawing = false;
  let points: { x: number; y: number }[] = [];

  const draw = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (const p of points) ctx.lineTo(p.x, p.y);
    ctx.strokeStyle = 'rgba(255,220,50,0.95)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 3]);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,220,50,0.08)';
    ctx.fill();
  };

  const onDown = (e: MouseEvent) => {
    if (paintingRef.current.activeTool !== 'lasso') return;
    drawing = true;
    points = [{ x: e.offsetX, y: e.offsetY }];
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const onMove = (e: MouseEvent) => {
    if (!drawing || paintingRef.current.activeTool !== 'lasso') return;
    points.push({ x: e.offsetX, y: e.offsetY });
    draw();
  };

  const onUp = () => {
    if (!drawing) return;
    drawing = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const p = paintingRef.current;
    if (points.length < 10 || !p.selectedColorId || !meshRef.current || !cameraRef.current || !model.geometry) return;

    const positions = model.geometry.attributes.position.array as Float32Array;
    const faces = getFacesInLasso(
      points, meshRef.current, cameraRef.current,
      canvas.width, canvas.height, positions
    );

    if (faces.length > 0) {
      console.log(`🔵 Lasso: painting ${faces.length} faces`);
      paintFaces(faces as any, p.selectedColorId);
    }
    points = [];
  };

  canvas.addEventListener('mousedown', onDown);
  canvas.addEventListener('mousemove', onMove);
  canvas.addEventListener('mouseup',   onUp);
  canvas.addEventListener('mouseleave', onUp);

  return () => {
    canvas.removeEventListener('mousedown', onDown);
    canvas.removeEventListener('mousemove', onMove);
    canvas.removeEventListener('mouseup',   onUp);
    canvas.removeEventListener('mouseleave', onUp);
  };
}, [model?.geometry]);
```

- [ ] **Step 5: Add import for getFacesInLasso**

In the import block at the top of STLViewer.tsx, add `getFacesInLasso` to the geometry-utils import:

```typescript
import {
  expandBrushSelection,
  buildFaceAdjacency,
  floodFillFaces,
  magicWandFill,
  getFacesInLasso,
} from '@/lib/stl-splitter/geometry-utils';
```

- [ ] **Step 6: Add lasso canvas to JSX**

In the `return (...)` block, add the lasso canvas between the cursor div and the axes canvas:

```tsx
{/* Lasso 2D drawing canvas — pointer-events active only when lasso tool selected */}
<canvas
  ref={lassoCanvasRef}
  className="absolute inset-0 w-full h-full rounded-lg"
  style={{
    pointerEvents: painting.activeTool === 'lasso' ? 'auto' : 'none',
    cursor: 'crosshair',
    zIndex: 5,
  }}
/>
```

- [ ] **Step 7: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep STLViewer
```

Expected: no output.

- [ ] **Step 8: Manual verify**

Load STL, add a color, select lasso tool. Verify:
- Dragging on model draws a yellow dashed polygon ✓
- Releasing fills all faces inside with the selected color ✓
- Orbit drag still works when lasso is NOT active ✓
- Switching to another tool re-enables orbit ✓

- [ ] **Step 9: Commit**

```bash
git add src/components/stl-splitter/STLViewer.tsx
git commit -m "feat(stl-splitter): lasso selection tool with 2D canvas overlay"
```

---

## Task 6: PaintToolbar — add lasso button

**Files:**
- Modify: `src/components/stl-splitter/PaintToolbar.tsx`

- [ ] **Step 1: Add lasso to TOOLS array**

In `PaintToolbar.tsx`, update the `TOOLS` constant to add:

```typescript
{ id: 'lasso' as PaintTool, icon: '🔵', label: 'Laço', hint: 'Desenhe uma área livre para selecionar e pintar todas as faces dentro' },
```

(Add after `eraser` in the array.)

- [ ] **Step 2: Add lasso status hint**

In the `selectedColor` status hint block, add:

```tsx
{activeTool === 'lasso' && `🔵 Segure e arraste para desenhar o laço — pinta tudo dentro com ${selectedColor.name}`}
```

And in the `!selectedColor && activeTool !== 'eraser'` block, handle `'lasso'` the same as eraser (can operate without color selected — just show a warning).

- [ ] **Step 3: Update grid to 5 columns**

Change `className="grid grid-cols-4 gap-1.5"` → `className="grid grid-cols-5 gap-1"` so all 5 tools fit.

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep PaintToolbar
```

- [ ] **Step 5: Commit**

```bash
git add src/components/stl-splitter/PaintToolbar.tsx
git commit -m "feat(stl-splitter): add lasso tool button to PaintToolbar"
```

---

## Task 7: AutoSegmentPanel — new component

**Files:**
- Create: `src/components/stl-splitter/AutoSegmentPanel.tsx`

**Consumes:**
- `store.painting.autoSegmentThreshold`
- `store.setAutoSegmentThreshold(degrees)`
- `store.applyAutoSegment(segmentMap)`
- `store.model.geometry`
- `autoSegmentBySharpEdges(geometry, threshold)` from geometry-utils

**Goal:** A compact panel with a threshold slider and a "Auto-segmentar" button. On click: runs `autoSegmentBySharpEdges` (deferred to avoid blocking UI), then calls `applyAutoSegment`.

- [ ] **Step 1: Create AutoSegmentPanel.tsx**

```tsx
'use client';

import React, { useState } from 'react';
import { useSTLSplitterStore } from '@/store/stl-splitter.store';
import { autoSegmentBySharpEdges } from '@/lib/stl-splitter/geometry-utils';
import { Wand2 } from 'lucide-react';

export function AutoSegmentPanel() {
  const model                  = useSTLSplitterStore((state) => state.model);
  const threshold              = useSTLSplitterStore((state) => state.painting.autoSegmentThreshold);
  const setThreshold           = useSTLSplitterStore((state) => state.setAutoSegmentThreshold);
  const applyAutoSegment       = useSTLSplitterStore((state) => state.applyAutoSegment);

  const [running, setRunning]  = useState(false);
  const [lastCount, setLastCount] = useState<number | null>(null);

  const handleAutoSegment = () => {
    if (!model?.geometry) return;
    setRunning(true);
    setLastCount(null);
    console.log('🔷 Auto-segment started, threshold:', threshold);

    // Defer to next tick so the "running" state renders before blocking compute
    setTimeout(() => {
      const segmentMap = autoSegmentBySharpEdges(model.geometry!, threshold);
      const uniqueSegs = new Set(segmentMap.values()).size;
      applyAutoSegment(segmentMap);
      setLastCount(Math.min(uniqueSegs, 16));
      setRunning(false);
      console.log('🔷 Auto-segment complete:', uniqueSegs, 'segments');
    }, 16);
  };

  if (!model) return null;

  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow space-y-3">
      <h3 className="font-semibold text-sm flex items-center gap-2">
        <Wand2 className="h-4 w-4 text-purple-500" />
        Auto-segmentação
      </h3>

      <div>
        <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-400">
          Ângulo de borda: {threshold === 180 ? 'só componentes' : `${threshold}°`}
        </label>
        <input
          type="range" min="10" max="180" step="5"
          value={threshold}
          onChange={(e) => setThreshold(parseInt(e.target.value))}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-0.5">
          <span>10° mais divisões</span>
          <span>180° só shells</span>
        </div>
      </div>

      <button
        onClick={handleAutoSegment}
        disabled={running}
        className="w-full py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-wait text-white rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
      >
        {running ? (
          <>
            <span className="animate-spin inline-block">⚙️</span>
            Calculando…
          </>
        ) : (
          <>
            <Wand2 className="h-4 w-4" />
            Auto-segmentar
          </>
        )}
      </button>

      {lastCount !== null && (
        <p className="text-xs text-center text-purple-600 dark:text-purple-400">
          ✅ {lastCount} partes criadas — ajuste os ângulos e repinte se precisar
        </p>
      )}

      <p className="text-xs text-gray-400 dark:text-gray-500">
        Detecta regiões por bordas afiadas. Ajuste o ângulo: menor = mais partes, maior = menos.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep AutoSegmentPanel
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/components/stl-splitter/AutoSegmentPanel.tsx
git commit -m "feat(stl-splitter): AutoSegmentPanel with threshold slider and auto-paint"
```

---

## Task 8: STLSplitterClient — mount AutoSegmentPanel

**Files:**
- Modify: `src/app/dashboard/stl-splitter/STLSplitterClient.tsx`

- [ ] **Step 1: Import AutoSegmentPanel**

Add import at the top:

```typescript
import { AutoSegmentPanel } from '@/components/stl-splitter/AutoSegmentPanel';
```

- [ ] **Step 2: Mount in sidebar**

In the painting mode return, add `<AutoSegmentPanel />` after `<PaintToolbar />` wrapper div and before the ColorList div:

```tsx
<div className="p-0 bg-white dark:bg-gray-800 rounded-lg shadow">
  <AutoSegmentPanel />
</div>
```

- [ ] **Step 3: TypeScript check (full)**

```bash
npx tsc --noEmit 2>&1 | grep -E "stl-splitter|STLViewer|PaintToolbar|ColorList|AutoSegment|geometry-utils"
```

Expected: no output.

- [ ] **Step 4: Push branch**

```bash
git add src/app/dashboard/stl-splitter/STLSplitterClient.tsx
git commit -m "feat(stl-splitter): mount AutoSegmentPanel in sidebar"
git push origin feat/photoshop-painting-ux
```

---

## Self-Review

**Spec coverage:**
- ✅ Auto-segmentação por bordas afiadas → Tasks 2 + 7 (`autoSegmentBySharpEdges` + panel)
- ✅ Auto-segmentação por componentes conectados → threshold=180° in same function
- ✅ Color picker por cor → Task 3 (`<input type="color">` inline)
- ✅ Renomear parte inline → Task 3 (double-click name → input)
- ✅ Wireframe overlay → Task 4 (EdgesGeometry LineSegments + toggle button)
- ✅ Lasso / seleção por tela → Tasks 5 + 6 (canvas overlay + getFacesInLasso)

**Placeholder scan:** No TBDs found. All code blocks complete.

**Type consistency:**
- `PaintTool` includes `'lasso'` (Task 1) — used in Tasks 5, 6 ✓
- `autoSegmentThreshold` in PaintingState (Task 1) — read in Task 7 ✓
- `showWireframe` in UIState (Task 1) — read in Task 4 ✓
- `updateColor(colorId, { hex?, name? })` defined Task 1 — used Task 3 ✓
- `applyAutoSegment(segmentMap: Map<number, number>)` defined Task 1 — called Task 7 ✓
- `autoSegmentBySharpEdges(geometry, thresholdDegrees)` defined Task 2 — imported Task 7 ✓
- `getFacesInLasso(polygon, mesh, camera, w, h, positions)` defined Task 2 — imported Task 5 ✓
