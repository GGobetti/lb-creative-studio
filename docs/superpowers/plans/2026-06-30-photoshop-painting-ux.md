# Photoshop-like Painting UX — STL Splitter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the STL Splitter painting tools to feel like Photoshop — circle cursor, right-click orbit, hover highlight, paint by dragging, improved magic wand (local curvature mode), eraser tool, and isolate-color mode.

**Architecture:** All visual interaction logic lives in `STLViewer.tsx` via refs (zero Zustand calls in hot paths). Store gains `eraseFaces`, `setIsolatedColorId`, `setWandMode`. `geometry-utils.ts` gets an updated `magicWandFill` supporting local-propagation mode.

**Tech Stack:** React 19, Next.js 16, Three.js 0.177, Zustand 5, Tailwind CSS, TypeScript

## Global Constraints

- `'use client'` on every component/store file
- All Three.js geometry mutations go through `geometry.attributes.color.needsUpdate = true`
- No Zustand calls inside Three.js event callbacks — read state via refs, write via the existing store actions
- Webpack flag required for arm64 Mac: `npm run dev` uses `--webpack` (already in package.json)
- Branch: `feat/photoshop-painting-ux`

---

## File Map

| File | Role |
|---|---|
| `src/types/stl-splitter.types.ts` | Add `'eraser'` to PaintTool; add `wandMode`, `isolatedColorId` to PaintingState |
| `src/store/stl-splitter.store.ts` | Add `eraseFaces`, `setIsolatedColorId`, `setWandMode` actions |
| `src/lib/stl-splitter/geometry-utils.ts` | Update `magicWandFill` to support `mode: 'local' \| 'global'` |
| `src/components/stl-splitter/STLViewer.tsx` | All interaction changes: orbit, cursor, hover, drag-paint, isolate |
| `src/components/stl-splitter/PaintToolbar.tsx` | Eraser button + wand mode toggle |
| `src/components/stl-splitter/ColorList.tsx` | Eye/isolate button per color |

---

## Task 1: Types + Store — eraser, wandMode, isolatedColorId

**Files:**
- Modify: `src/types/stl-splitter.types.ts`
- Modify: `src/store/stl-splitter.store.ts`

**Interfaces — Produces:**
- `PaintTool = 'brush' | 'bucket' | 'wand' | 'eraser'`
- `PaintingState.wandMode: 'local' | 'global'`
- `PaintingState.isolatedColorId: ColorID | null`
- `store.eraseFaces(faceIndices: FaceIndex[]) => void`
- `store.setIsolatedColorId(id: ColorID | null) => void`
- `store.setWandMode(mode: 'local' | 'global') => void`

- [ ] **Step 1: Update PaintingState in types**

Replace the PaintingState interface in `src/types/stl-splitter.types.ts`:

```typescript
export type PaintTool = 'brush' | 'bucket' | 'wand' | 'eraser';

export interface PaintingState {
  colorMap: Map<FaceIndex, ColorID>;
  colors: Map<ColorID, ColorGroup>;
  brushSize: number;
  selectedColorId: ColorID | null;
  activeTool: PaintTool;
  wandThreshold: number;
  wandMode: 'local' | 'global';
  bucketThreshold: number;
  isolatedColorId: ColorID | null;
}
```

- [ ] **Step 2: Add new actions to STLSplitterStoreActions interface**

In `src/store/stl-splitter.store.ts`, add to the `STLSplitterStoreActions` interface (after `setActiveTool`):

```typescript
eraseFaces: (faceIndices: FaceIndex[]) => void;
setWandMode: (mode: 'local' | 'global') => void;
setIsolatedColorId: (id: ColorID | null) => void;
```

- [ ] **Step 3: Update initialPaintingState**

```typescript
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
};
```

- [ ] **Step 4: Implement eraseFaces action**

Add after `undoPaint` in the store `create()` body:

```typescript
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

    console.log(`🧹 Erase: removed ${faceIndices.length} faces`);
    return {
      colorMapHistory: newHistory,
      painting: { ...state.painting, colorMap: newColorMap, colors },
    };
  });
},
```

- [ ] **Step 5: Implement setWandMode and setIsolatedColorId actions**

```typescript
setWandMode: (mode) => {
  set((state) => ({ painting: { ...state.painting, wandMode: mode } }));
},

setIsolatedColorId: (id) => {
  set((state) => ({ painting: { ...state.painting, isolatedColorId: id } }));
},
```

- [ ] **Step 6: TypeScript check**

```bash
cd "/Users/ggobetti/Projetos Pessoais/lb-creative-studio"
npx tsc --noEmit 2>&1 | grep "stl-splitter"
```

Expected: no output (no errors in STL splitter files).

- [ ] **Step 7: Commit**

```bash
git add src/types/stl-splitter.types.ts src/store/stl-splitter.store.ts
git commit -m "feat(stl-splitter): add eraser tool, wandMode, isolatedColorId to types and store"
```

---

## Task 2: geometry-utils — magicWandFill local propagation mode

**Files:**
- Modify: `src/lib/stl-splitter/geometry-utils.ts`

**Interfaces — Consumes:**
- `getFaceNormal(positions, faceIndex)` — already exists in file
- `adjacency: Map<number, number[]>` — built by `buildFaceAdjacency`

**Interfaces — Produces:**
- `magicWandFill(startFace, adjacency, geometry, thresholdDegrees, mode)` — same signature + new `mode` param

- [ ] **Step 1: Update magicWandFill signature and implementation**

Replace the entire `magicWandFill` function in `src/lib/stl-splitter/geometry-utils.ts`:

```typescript
export function magicWandFill(
  startFace: number,
  adjacency: Map<number, number[]>,
  geometry: BufferGeometry,
  thresholdDegrees: number = 30,
  mode: 'local' | 'global' = 'local'
): number[] {
  const positions = geometry.attributes.position.array as Float32Array;
  const startNormal = getFaceNormal(positions, startFace);
  const cosThreshold = Math.cos((thresholdDegrees * Math.PI) / 180);

  const visited = new Set<number>([startFace]);
  // Queue stores {face, refNormal}: refNormal is what we compare each neighbor against.
  // local mode: refNormal = parent face's normal (follows curves)
  // global mode: refNormal always = startNormal (anchored to click point)
  const queue: Array<{ face: number; refNormal: Vector3 }> = [
    { face: startFace, refNormal: startNormal },
  ];

  while (queue.length > 0) {
    const { face: current, refNormal } = queue.shift()!;
    const neighbors = adjacency.get(current) || [];

    for (const neighbor of neighbors) {
      if (visited.has(neighbor)) continue;

      const neighborNormal = getFaceNormal(positions, neighbor);
      if (refNormal.dot(neighborNormal) >= cosThreshold) {
        visited.add(neighbor);
        queue.push({
          face: neighbor,
          refNormal: mode === 'local' ? neighborNormal : startNormal,
        });
      }
    }
  }

  console.log(
    `✨ Magic wand from face ${startFace} (${mode} mode, ${thresholdDegrees}°): selected ${visited.size} faces`
  );
  return Array.from(visited);
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "geometry-utils"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/lib/stl-splitter/geometry-utils.ts
git commit -m "feat(stl-splitter): add local-propagation mode to magicWandFill for curved surfaces"
```

---

## Task 3: STLViewer — Right-click orbit + custom cursor overlay

**Files:**
- Modify: `src/components/stl-splitter/STLViewer.tsx`

**Goal:** OrbitControls uses RIGHT button for orbit (left is freed for painting). A `<div>` overlay tracks the mouse with a circle sized to the brush.

- [ ] **Step 1: Add cursorRef and new refs to component**

At the top of `STLViewer()`, after the existing refs, add:

```typescript
const cursorRef = useRef<HTMLDivElement>(null);
const hoveredFaceRef = useRef<number | null>(null);
const isPaintingRef = useRef(false);
const paintedFacesInDragRef = useRef(new Set<number>());
const lastPaintTimeRef = useRef(0);
const eraseFaces = useSTLSplitterStore((state) => state.eraseFaces);
```

- [ ] **Step 2: Fix OrbitControls mouse buttons inside the scene setup useEffect**

Find the `const controls = new OrbitControls(camera, renderer.domElement);` line and add immediately after it:

```typescript
// Right-click = orbit, left is reserved for painting
controls.mouseButtons = {
  LEFT: null as unknown as THREE.MOUSE,
  MIDDLE: THREE.MOUSE.DOLLY,
  RIGHT: THREE.MOUSE.ROTATE,
};
// Prevent context menu on right-click drag
renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
// Hide default system cursor on canvas — we draw our own
renderer.domElement.style.cursor = 'none';
```

- [ ] **Step 3: Add updateCursor helper inside the scene setup useEffect**

Add this function inside the scene setup `useEffect`, before the `handleClick` handler:

```typescript
const updateCursor = (e: MouseEvent) => {
  if (!cursorRef.current || !containerRef.current) return;
  const rect = containerRef.current.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const tool = paintingRef.current.activeTool;
  const size = paintingRef.current.brushSize * 2;
  const el = cursorRef.current;

  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.style.display = 'block';

  if (tool === 'brush') {
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.border = '2px solid rgba(255,255,255,0.9)';
    el.style.boxShadow = '0 0 0 1px rgba(0,0,0,0.6)';
    el.style.borderStyle = 'solid';
  } else if (tool === 'eraser') {
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.border = '2px dashed rgba(255,80,80,0.9)';
    el.style.boxShadow = '0 0 0 1px rgba(0,0,0,0.6)';
    el.style.borderStyle = 'dashed';
  } else {
    // wand / bucket — small crosshair dot
    el.style.width = '8px';
    el.style.height = '8px';
    el.style.border = '2px solid rgba(255,255,255,0.9)';
    el.style.boxShadow = '0 0 0 1px rgba(0,0,0,0.6)';
    el.style.borderStyle = 'solid';
  }
};
```

- [ ] **Step 4: Add mousemove and mouseleave cursor listeners inside the same useEffect**

After the `renderer.domElement.addEventListener('click', handleClick);` line, add:

```typescript
const handleMouseMove = (e: MouseEvent) => {
  updateCursor(e);
};
const handleMouseLeave = () => {
  if (cursorRef.current) cursorRef.current.style.display = 'none';
};

renderer.domElement.addEventListener('mousemove', handleMouseMove);
renderer.domElement.addEventListener('mouseleave', handleMouseLeave);
```

- [ ] **Step 5: Clean up new listeners in the return cleanup function**

In the existing `return () => { ... }` cleanup at the bottom of the scene setup effect, add:

```typescript
renderer.domElement.removeEventListener('mousemove', handleMouseMove);
renderer.domElement.removeEventListener('mouseleave', handleMouseLeave);
renderer.domElement.removeEventListener('contextmenu', (e) => e.preventDefault());
```

- [ ] **Step 6: Add cursor overlay div to JSX**

Replace the JSX `return` in `STLViewer`:

```tsx
return (
  <div className="relative w-full h-full">
    <div ref={containerRef} className="w-full h-full bg-gray-900 rounded-lg" />
    {/* Custom cursor overlay — positioned relative to container */}
    <div
      ref={cursorRef}
      style={{
        position: 'absolute',
        display: 'none',
        borderRadius: '50%',
        pointerEvents: 'none',
        transform: 'translate(-50%, -50%)',
        zIndex: 10,
      }}
    />
    <canvas
      ref={axesCanvasRef}
      className="absolute bottom-4 left-4 border border-gray-600 rounded bg-transparent"
      style={{ width: '120px', height: '120px' }}
    />
  </div>
);
```

- [ ] **Step 7: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "STLViewer"
```

Expected: no output.

- [ ] **Step 8: Manual test**

Run `npm run dev --webpack`. Load an STL. Verify:
- Right-drag rotates the model ✓
- Left click still paints (check console for face paint logs) ✓
- Custom circle cursor follows the mouse ✓
- Circle size changes when brush size slider is moved ✓
- Cursor changes to small dot when wand/bucket selected ✓
- Cursor changes to red dashed when eraser selected ✓

- [ ] **Step 9: Commit**

```bash
git add src/components/stl-splitter/STLViewer.tsx
git commit -m "feat(stl-splitter): right-click orbit, custom circle cursor overlay"
```

---

## Task 4: STLViewer — Hover highlight + paint by dragging

**Files:**
- Modify: `src/components/stl-splitter/STLViewer.tsx`

**Goal:** Face under cursor glows yellow-white on hover. Left mouse drag continues painting without releasing button.

- [ ] **Step 1: Add applyHoverHighlight helper inside scene setup useEffect**

Add this function directly inside the scene setup `useEffect`, before `handleClick`:

```typescript
const applyHoverHighlight = (faceIndex: number | null) => {
  if (!meshRef.current || !model?.geometry?.attributes.color) return;
  const colors = model.geometry.attributes.color.array as Float32Array;
  const currentPainting = paintingRef.current;

  // Restore previous hovered face's real color
  const prev = hoveredFaceRef.current;
  if (prev !== null) {
    const prevColorId = currentPainting.colorMap.get(prev);
    const prevColor = prevColorId ? currentPainting.colors.get(prevColorId) : null;
    for (let i = 0; i < 3; i++) {
      const vi = (prev * 3 + i) * 3;
      if (vi + 2 >= colors.length) continue;
      if (prevColor) {
        const hex = prevColor.hex.replace('#', '');
        colors[vi]     = parseInt(hex.substring(0, 2), 16) / 255;
        colors[vi + 1] = parseInt(hex.substring(2, 4), 16) / 255;
        colors[vi + 2] = parseInt(hex.substring(4, 6), 16) / 255;
      } else {
        colors[vi] = colors[vi + 1] = colors[vi + 2] = 0.55;
      }
    }
  }

  hoveredFaceRef.current = faceIndex;

  // Apply yellow-white highlight to new face
  if (faceIndex !== null) {
    for (let i = 0; i < 3; i++) {
      const vi = (faceIndex * 3 + i) * 3;
      if (vi + 2 >= colors.length) continue;
      colors[vi]     = 1.0;
      colors[vi + 1] = 0.95;
      colors[vi + 2] = 0.4;
    }
  }

  model.geometry.attributes.color.needsUpdate = true;
};
```

- [ ] **Step 2: Add performPaint helper inside scene setup useEffect**

Add this function after `applyHoverHighlight` (and before the old `handleClick`):

```typescript
const performPaint = (clientX: number, clientY: number) => {
  const now = Date.now();
  if (now - lastPaintTimeRef.current < 50) return; // throttle to ~20fps
  lastPaintTimeRef.current = now;

  const currentPainting = paintingRef.current;
  if (!currentPainting.selectedColorId && currentPainting.activeTool !== 'eraser') return;
  if (!meshRef.current) return;

  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(meshRef.current);

  if (!intersects.length || intersects[0].faceIndex === undefined) return;

  const faceIndex = intersects[0].faceIndex!;
  const tool = currentPainting.activeTool;

  console.log(`🖌️ Face ${faceIndex} hit. Tool: ${tool}`);

  // For brush/eraser drag — skip faces already processed in this drag stroke
  if ((tool === 'brush' || tool === 'eraser') && paintedFacesInDragRef.current.has(faceIndex)) return;
  if (tool === 'brush' || tool === 'eraser') paintedFacesInDragRef.current.add(faceIndex);

  let selectedFaces: number[];

  if (tool === 'bucket') {
    if (!adjacencyRef.current) { selectedFaces = [faceIndex]; }
    else {
      selectedFaces = floodFillFaces(
        faceIndex, adjacencyRef.current, currentPainting.colorMap,
        model.geometry!, currentPainting.bucketThreshold
      );
    }
  } else if (tool === 'wand') {
    if (!adjacencyRef.current) { selectedFaces = [faceIndex]; }
    else {
      selectedFaces = magicWandFill(
        faceIndex, adjacencyRef.current, model.geometry!,
        currentPainting.wandThreshold, currentPainting.wandMode
      );
    }
  } else {
    // brush or eraser — same spatial selection
    selectedFaces = expandBrushSelection(
      faceIndex, currentPainting.brushSize, model.geometry!,
      meshRef.current, camera,
      { width: renderer.domElement.clientWidth, height: renderer.domElement.clientHeight }
    );
  }

  if (tool === 'eraser') {
    console.log('🧹 Erasing', selectedFaces.length, 'faces');
    eraseFaces(selectedFaces as any);
  } else {
    console.log('🎨 Painting', selectedFaces.length, 'faces with color:', currentPainting.selectedColorId);
    paintFaces(selectedFaces as any, currentPainting.selectedColorId!);
  }
};
```

- [ ] **Step 3: Replace old handleClick + add mousedown/mouseup handlers**

Remove the old `handleClick` function entirely and replace with:

```typescript
const handleMouseDown = (e: MouseEvent) => {
  if (e.button !== 0) return; // only left button triggers painting
  isPaintingRef.current = true;
  paintedFacesInDragRef.current.clear();
  applyHoverHighlight(null); // clear hover before painting
  performPaint(e.clientX, e.clientY);
};

const handleMouseUp = (e: MouseEvent) => {
  if (e.button !== 0) return;
  isPaintingRef.current = false;
  paintedFacesInDragRef.current.clear();
};
```

- [ ] **Step 4: Update handleMouseMove to do hover raycasting + drag painting**

Replace the `handleMouseMove` function from Task 3 (which only called `updateCursor`) with this expanded version:

```typescript
const handleMouseMove = (e: MouseEvent) => {
  updateCursor(e);

  // Drag painting (brush/eraser only during drag)
  if (isPaintingRef.current) {
    const tool = paintingRef.current.activeTool;
    if (tool === 'brush' || tool === 'eraser') {
      performPaint(e.clientX, e.clientY);
    }
    return; // skip hover highlight while actively painting
  }

  // Hover highlight (only when not dragging)
  if (!meshRef.current) return;
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(meshRef.current);
  const hoveredFace = intersects.length > 0 && intersects[0].faceIndex !== undefined
    ? intersects[0].faceIndex!
    : null;
  applyHoverHighlight(hoveredFace);
};
```

- [ ] **Step 5: Replace old click listener registration with mousedown/mouseup**

Find `renderer.domElement.addEventListener('click', handleClick);` and replace with:

```typescript
renderer.domElement.addEventListener('mousedown', handleMouseDown);
renderer.domElement.addEventListener('mouseup', handleMouseUp);
```

- [ ] **Step 6: Update cleanup to remove new listeners**

In the `return () => { ... }` block:

```typescript
renderer.domElement.removeEventListener('mousedown', handleMouseDown);
renderer.domElement.removeEventListener('mouseup', handleMouseUp);
renderer.domElement.removeEventListener('mousemove', handleMouseMove);
renderer.domElement.removeEventListener('mouseleave', handleMouseLeave);
```

Remove the old `renderer.domElement.removeEventListener('click', handleClick);` line.

- [ ] **Step 7: Add eraseFaces to the existing store subscriptions at top of component**

Add after `const paintFaces = ...`:

```typescript
const eraseFaces = useSTLSplitterStore((state) => state.eraseFaces);
```

And add `eraseFaces` to the `paintingRef` scope by ensuring it's referenced correctly (it's a stable Zustand ref so no stale closure issue — use directly).

- [ ] **Step 8: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "STLViewer"
```

Expected: no output.

- [ ] **Step 9: Manual test**

Load an STL. Add a color. Verify:
- Hovering over the model shows yellow-white face highlight ✓
- Single click paints ✓
- Holding left mouse and dragging paints continuously ✓
- Changing to eraser and dragging removes color from painted faces ✓
- Hover restores correct color after unpainting ✓

- [ ] **Step 10: Commit**

```bash
git add src/components/stl-splitter/STLViewer.tsx
git commit -m "feat(stl-splitter): hover highlight + paint on drag + eraser interaction"
```

---

## Task 5: STLViewer — Isolate color mode in paint effect

**Files:**
- Modify: `src/components/stl-splitter/STLViewer.tsx`

**Goal:** When `painting.isolatedColorId` is set, non-isolated faces render near-black so only the isolated part is visible.

- [ ] **Step 1: Subscribe to isolatedColorId in the component**

At the top of `STLViewer()`, add:

```typescript
const isolatedColorId = useSTLSplitterStore((state) => state.painting.isolatedColorId);
```

- [ ] **Step 2: Update the color update useEffect to respect isolatedColorId**

Replace the existing color update `useEffect` entirely:

```typescript
useEffect(() => {
  if (!meshRef.current || !model || !model.geometry) return;
  if (!model.geometry.attributes.color) return;

  const colors = model.geometry.attributes.color.array as Float32Array;
  // Base: dim gray normally; near-black for non-isolated faces when isolating
  const base = isolatedColorId ? 0.08 : 0.55;
  colors.fill(base);

  painting.colorMap.forEach((colorId, faceIndex) => {
    // Skip non-isolated faces when a color is isolated
    if (isolatedColorId && colorId !== isolatedColorId) return;

    const color = painting.colors.get(colorId);
    if (!color) return;

    const hex = color.hex.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;

    for (let i = 0; i < 3; i++) {
      const vertexIndex = faceIndex * 3 + i;
      if (vertexIndex * 3 + 2 < colors.length) {
        colors[vertexIndex * 3]     = r;
        colors[vertexIndex * 3 + 1] = g;
        colors[vertexIndex * 3 + 2] = b;
      }
    }
  });

  // Clear any stale hover after repaint
  hoveredFaceRef.current = null;

  model.geometry.attributes.color.needsUpdate = true;
}, [painting.colorMap, painting.colors, isolatedColorId, model?.geometry]);
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "STLViewer"
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/components/stl-splitter/STLViewer.tsx
git commit -m "feat(stl-splitter): isolate color mode dims non-selected parts"
```

---

## Task 6: PaintToolbar — Eraser button + wand mode toggle

**Files:**
- Modify: `src/components/stl-splitter/PaintToolbar.tsx`

**Goal:** Add eraser (🧹) as a 4th tool button. Add local/global toggle for wand (only shown when wand is active).

- [ ] **Step 1: Add eraser to TOOLS array**

Replace the TOOLS constant:

```typescript
const TOOLS: { id: PaintTool; label: string; icon: string; hint: string }[] = [
  { id: 'brush',  icon: '🖌️', label: 'Pincel',  hint: 'Clique e arraste para pintar faces dentro do raio' },
  { id: 'bucket', icon: '🪣', label: 'Balde',   hint: 'Preenchimento por região conectada' },
  { id: 'wand',   icon: '✨', label: 'Varinha',  hint: 'Preenche faces com ângulo de superfície similar' },
  { id: 'eraser', icon: '🧹', label: 'Borracha', hint: 'Apaga a cor de faces pintadas (clique e arraste)' },
];
```

- [ ] **Step 2: Subscribe to new store state and actions**

In the component body, add after `setBucketThreshold`:

```typescript
const wandMode        = useSTLSplitterStore((state) => state.painting.wandMode);
const setWandMode     = useSTLSplitterStore((state) => state.setWandMode);
```

- [ ] **Step 3: Add wand mode toggle after wandThreshold slider**

Inside the `{activeTool === 'wand' && (...)}` block, after the threshold slider div, add:

```tsx
<div className="flex items-center gap-2 mt-2">
  <span className="text-xs text-gray-500 dark:text-gray-400">Modo:</span>
  <button
    onClick={() => {
      const next = wandMode === 'local' ? 'global' : 'local';
      setWandMode(next);
      console.log('✨ Wand mode:', next);
    }}
    className="flex-1 py-1 px-2 rounded border text-xs font-medium transition
      border-gray-300 dark:border-gray-600 hover:border-blue-400
      text-gray-700 dark:text-gray-300"
  >
    {wandMode === 'local' ? '🌊 Local (segue curvas)' : '📌 Global (âncora no clique)'}
  </button>
</div>
```

- [ ] **Step 4: Update status hint to include eraser**

Add eraser hint inside the selectedColor conditional:

```tsx
{activeTool === 'eraser' && `🧹 Clique ou arraste para apagar cores de ${selectedColor.name}`}
```

(Add this after the wand line, inside the same green div block.)

- [ ] **Step 5: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "PaintToolbar"
```

Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add src/components/stl-splitter/PaintToolbar.tsx
git commit -m "feat(stl-splitter): eraser tool button + wand local/global mode toggle in toolbar"
```

---

## Task 7: ColorList — Isolate/unisolate button per color

**Files:**
- Modify: `src/components/stl-splitter/ColorList.tsx`

**Goal:** Each color row gets a 👁️ button. Clicking it isolates that color (all others dim). Clicking again unisolates.

- [ ] **Step 1: Subscribe to isolatedColorId and setIsolatedColorId**

In the component body, add:

```typescript
const isolatedColorId    = useSTLSplitterStore((state) => state.painting.isolatedColorId);
const setIsolatedColorId = useSTLSplitterStore((state) => state.setIsolatedColorId);
```

- [ ] **Step 2: Add Eye icon import**

Update the lucide-react import:

```typescript
import { Trash2, Eye, EyeOff } from 'lucide-react';
```

- [ ] **Step 3: Add isolate button to each color row**

Inside the `Array.from(colors.values()).map(...)` block, add the isolate button between the color info div and the delete button:

```tsx
<button
  onClick={(e) => {
    e.stopPropagation();
    const newId = isolatedColorId === color.id ? null : color.id;
    console.log('👁️ Isolate toggled:', newId);
    setIsolatedColorId(newId);
  }}
  title={isolatedColorId === color.id ? 'Mostrar todas' : `Isolar ${color.name}`}
  className={`p-1 transition ${
    isolatedColorId === color.id
      ? 'text-blue-500 hover:text-blue-700'
      : 'text-gray-400 hover:text-blue-500'
  }`}
>
  {isolatedColorId === color.id ? (
    <EyeOff className="h-4 w-4" />
  ) : (
    <Eye className="h-4 w-4" />
  )}
</button>
```

- [ ] **Step 4: Add a global "Show All" banner when isolated**

Before the `<div className="space-y-2 ...">` opening tag, add:

```tsx
{isolatedColorId && (
  <div className="px-4 pt-3 pb-1 flex items-center justify-between">
    <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">Modo isolado ativo</span>
    <button
      onClick={() => setIsolatedColorId(null)}
      className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 underline"
    >
      Mostrar todas
    </button>
  </div>
)}
```

- [ ] **Step 5: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "ColorList"
```

Expected: no output.

- [ ] **Step 6: Manual test**

Load STL, paint 2+ colors. Verify:
- 👁️ icon appears next to each color ✓
- Clicking isolates that color (others go very dark) ✓
- Clicking again restores all colors ✓
- "Mostrar todas" banner appears and works ✓

- [ ] **Step 7: Commit**

```bash
git add src/components/stl-splitter/ColorList.tsx
git commit -m "feat(stl-splitter): isolate-color eye button in ColorList"
```

---

## Task 8: Final push + PR

- [ ] **Step 1: Full TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -E "stl-splitter|STLViewer|PaintToolbar|ColorList|geometry-utils"
```

Expected: no output.

- [ ] **Step 2: Push branch**

```bash
git push origin feat/photoshop-painting-ux
```

- [ ] **Step 3: Open PR on GitHub**

```bash
gh pr create \
  --title "feat: Photoshop-like painting UX for STL Splitter" \
  --body "$(cat <<'EOF'
## Summary
- Right-click orbits, left-click/drag paints — no more mode conflicts
- Custom circle cursor overlay sized to brush radius (dashed red for eraser)
- Face hover highlight (yellow-white glow) shows which face will be painted
- Paint by dragging — hold left mouse and sweep to paint/erase continuously
- Magic wand local propagation mode: follows surface curvature on organic models
- Eraser tool (🧹) with drag support
- Isolate-color mode: dim all other parts, focus on one color at a time

## Test plan
- [ ] Load an STL, right-drag to rotate, confirm left click paints
- [ ] Hover over model — yellow highlight follows face under cursor
- [ ] Hold left mouse, drag — brush paints continuously
- [ ] Select eraser, drag over painted area — colors removed
- [ ] Select wand in local mode on a cylinder — follows the curve
- [ ] Click 👁️ on a color — others dim; click again to restore
- [ ] Export 3MF with multiple parts — verify file opens in Bambu Studio

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ Right-click orbit / left-click paint → Task 3 Step 2
- ✅ Circle cursor → Tasks 3 Steps 3-6
- ✅ Hover highlight → Task 4 Steps 1, 4
- ✅ Paint on drag → Task 4 Steps 2-6
- ✅ Magic wand local mode → Task 2
- ✅ Eraser tool → Tasks 1, 4 Step 2, 6
- ✅ Isolate color → Tasks 1, 5, 7
- ✅ Wand mode toggle in UI → Task 6 Step 3

**Type consistency:**
- `PaintTool` updated with `'eraser'` in Task 1, consumed in Tasks 4 and 6 ✓
- `wandMode: 'local' | 'global'` defined in Task 1, used in `magicWandFill` Task 2 and store Task 6 ✓
- `isolatedColorId: ColorID | null` defined in Task 1, read in Tasks 5 and 7 ✓
- `eraseFaces(faceIndices: FaceIndex[])` defined in Task 1, called in Task 4 Step 2 ✓

**Placeholder scan:** No TBDs found. All code blocks are complete.
