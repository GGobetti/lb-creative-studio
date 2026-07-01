import { Raycaster, Mesh, Vector2, BufferGeometry, Vector3, Euler } from 'three';
import type { ColorID, ConnectorPoint } from '@/types/stl-splitter.types';

export function pickFaceAtRaycast(
  raycaster: Raycaster,
  mesh: Mesh,
  mouse: Vector2,
  camera: any
): number | null {
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(mesh);

  if (intersects.length === 0 || intersects[0].faceIndex === undefined) return null;

  return intersects[0].faceIndex;
}

// Brush: select faces within a 3D world-space radius around clicked face.
export function expandBrushSelection(
  clickedFaceIndex: number,
  brushRadiusPx: number,
  geometry: BufferGeometry,
  mesh: Mesh,
  camera: any,
  viewport: { width: number; height: number }
): number[] {
  const positions = geometry.getAttribute('position').array as Float32Array;
  const selectedFaces: Set<number> = new Set([clickedFaceIndex]);

  const brushRadius = (brushRadiusPx / 20) * 10;

  const faceStart = clickedFaceIndex * 9;
  const center = new Vector3(
    (positions[faceStart] + positions[faceStart + 3] + positions[faceStart + 6]) / 3,
    (positions[faceStart + 1] + positions[faceStart + 4] + positions[faceStart + 7]) / 3,
    (positions[faceStart + 2] + positions[faceStart + 5] + positions[faceStart + 8]) / 3
  );

  center.applyMatrix4(mesh.matrixWorld);

  const totalFaces = positions.length / 9;
  for (let i = 0; i < totalFaces; i++) {
    if (i === clickedFaceIndex) continue;

    const faceStart2 = i * 9;
    const faceCenter = new Vector3(
      (positions[faceStart2] + positions[faceStart2 + 3] + positions[faceStart2 + 6]) / 3,
      (positions[faceStart2 + 1] + positions[faceStart2 + 4] + positions[faceStart2 + 7]) / 3,
      (positions[faceStart2 + 2] + positions[faceStart2 + 5] + positions[faceStart2 + 8]) / 3
    );
    faceCenter.applyMatrix4(mesh.matrixWorld);

    if (center.distanceTo(faceCenter) < brushRadius) {
      selectedFaces.add(i);
    }
  }

  return Array.from(selectedFaces);
}

// Build edge-based adjacency map for the entire geometry.
// Returns Map<faceIndex, neighborFaceIndex[]>.
// Call once after geometry loads and cache the result.
export function buildFaceAdjacency(geometry: BufferGeometry): Map<number, number[]> {
  const positions = geometry.attributes.position.array as Float32Array;
  const totalFaces = Math.floor(positions.length / 9);

  // Edge → [faceIndex, ...] : faces that share this edge
  const edgeToFaces = new Map<string, number[]>();

  for (let fi = 0; fi < totalFaces; fi++) {
    for (let ei = 0; ei < 3; ei++) {
      const va = fi * 9 + ei * 3;
      const vb = fi * 9 + ((ei + 1) % 3) * 3;

      // Use 5-decimal precision strings to handle float32 near-duplicates
      const ka = `${positions[va].toFixed(3)},${positions[va + 1].toFixed(3)},${positions[va + 2].toFixed(3)}`;
      const kb = `${positions[vb].toFixed(3)},${positions[vb + 1].toFixed(3)},${positions[vb + 2].toFixed(3)}`;
      const edgeKey = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;

      const entry = edgeToFaces.get(edgeKey);
      if (entry) {
        entry.push(fi);
      } else {
        edgeToFaces.set(edgeKey, [fi]);
      }
    }
  }

  const adjacency = new Map<number, number[]>();
  for (const faces of edgeToFaces.values()) {
    if (faces.length < 2) continue;
    for (let i = 0; i < faces.length; i++) {
      for (let j = i + 1; j < faces.length; j++) {
        const fi = faces[i];
        const fj = faces[j];

        const ai = adjacency.get(fi);
        if (ai) ai.push(fj); else adjacency.set(fi, [fj]);

        const aj = adjacency.get(fj);
        if (aj) aj.push(fi); else adjacency.set(fj, [fi]);
      }
    }
  }

  console.log(`🗺️ Adjacency built: ${adjacency.size} faces with neighbors`);
  return adjacency;
}

// Bucket (flood fill): BFS from startFace expanding through connected edges.
// angleThresholdDegrees: if > 0, stops expanding when neighbor normal deviates
// more than this angle from the start face's normal (0 = unlimited fill).
export function floodFillFaces(
  startFace: number,
  adjacency: Map<number, number[]>,
  existingColorMap?: Map<number, string>,
  geometry?: BufferGeometry,
  angleThresholdDegrees: number = 0
): number[] {
  const positions = geometry?.attributes.position.array as Float32Array | undefined;
  const startNormal = positions ? getFaceNormal(positions, startFace) : null;
  const cosThreshold = (angleThresholdDegrees > 0 && startNormal)
    ? Math.cos((angleThresholdDegrees * Math.PI) / 180)
    : -Infinity;

  const visited = new Set<number>([startFace]);
  const queue = [startFace];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = adjacency.get(current) || [];

    for (const neighbor of neighbors) {
      if (visited.has(neighbor)) continue;
      // Stop expanding into faces already painted with a DIFFERENT color
      if (existingColorMap) {
        const neighborColor = existingColorMap.get(neighbor);
        const startColor = existingColorMap.get(startFace);
        if (neighborColor && neighborColor !== startColor) continue;
      }
      // Angle threshold: don't cross sharp creases
      if (startNormal && positions && cosThreshold > -Infinity) {
        const neighborNormal = getFaceNormal(positions, neighbor);
        if (startNormal.dot(neighborNormal) < cosThreshold) continue;
      }
      visited.add(neighbor);
      queue.push(neighbor);
    }
  }

  console.log(`🪣 Flood fill from face ${startFace} (angle limit: ${angleThresholdDegrees}°): selected ${visited.size} faces`);
  return Array.from(visited);
}

function getFaceNormal(positions: Float32Array, faceIndex: number): Vector3 {
  const base = faceIndex * 9;
  const v0 = new Vector3(positions[base], positions[base + 1], positions[base + 2]);
  const v1 = new Vector3(positions[base + 3], positions[base + 4], positions[base + 5]);
  const v2 = new Vector3(positions[base + 6], positions[base + 7], positions[base + 8]);

  const edge1 = new Vector3().subVectors(v1, v0);
  const edge2 = new Vector3().subVectors(v2, v0);
  return new Vector3().crossVectors(edge1, edge2).normalize();
}

// Magic wand: BFS expanding to adjacent faces within a normal-angle threshold.
// mode='local'  → each step compares neighbor vs its parent (follows curves)
// mode='global' → all steps compare vs the start face (anchored, more predictable)
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
  // Queue stores {face, refNormal}: what we compare each neighbor against.
  // local  → propagate neighbor's own normal so the expansion follows curvature
  // global → always compare against the original start face normal
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

  console.log(`✨ Magic wand from face ${startFace} (${mode} mode, ${thresholdDegrees}°): selected ${visited.size} faces`);
  return Array.from(visited);
}

export function getAdjacentFaces(faceIndex: number, geometry: BufferGeometry): number[] {
  return [];
}

// Auto-segmentation: BFS through face adjacency using only "gentle" edges.
// Edges where adjacent-face normals differ by more than thresholdDegrees break
// the graph, splitting those faces into separate segments.
// thresholdDegrees=180 → only disconnected shells separate.  45 → split at creases.
export function autoSegmentBySharpEdges(
  geometry: BufferGeometry,
  thresholdDegrees: number = 45
): Map<number, number> {
  const positions = geometry.attributes.position.array as Float32Array;
  const totalFaces = Math.floor(positions.length / 9);
  const cosThreshold = Math.cos((thresholdDegrees * Math.PI) / 180);

  // Build edge → faces map
  const edgeToFaces = new Map<string, number[]>();
  for (let fi = 0; fi < totalFaces; fi++) {
    for (let ei = 0; ei < 3; ei++) {
      const va = fi * 9 + ei * 3;
      const vb = fi * 9 + ((ei + 1) % 3) * 3;
      const ka = `${positions[va].toFixed(3)},${positions[va + 1].toFixed(3)},${positions[va + 2].toFixed(3)}`;
      const kb = `${positions[vb].toFixed(3)},${positions[vb + 1].toFixed(3)},${positions[vb + 2].toFixed(3)}`;
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

// ── Connector helpers ─────────────────────────────────────────────────────────

export function getFaceCentroid(positions: Float32Array, faceIndex: number): Vector3 {
  const base = faceIndex * 9;
  return new Vector3(
    (positions[base] + positions[base + 3] + positions[base + 6]) / 3,
    (positions[base + 1] + positions[base + 4] + positions[base + 7]) / 3,
    (positions[base + 2] + positions[base + 5] + positions[base + 8]) / 3
  );
}

export interface BoundaryEdgeInfo {
  midpoint: Vector3;
  normal: Vector3;       // tangential direction across the seam, from faceB's centroid toward faceA's
  colorA: ColorID;       // face that will receive the pin
  colorB: ColorID;       // face that will receive the hole
  gap: number;            // distance between the two face centroids (used to size embed depth)
}

// Finds all shared edges between faces of different colors.
// Returns one entry per adjacent pair of differently-colored faces.
export function findColorBoundaryEdges(
  colorMap: Map<number, ColorID>,
  geometry: BufferGeometry
): BoundaryEdgeInfo[] {
  const positions = geometry.attributes.position.array as Float32Array;
  const edgeToFaces = new Map<string, number[]>();

  const totalFaces = Math.floor(positions.length / 9);
  for (let fi = 0; fi < totalFaces; fi++) {
    for (let ei = 0; ei < 3; ei++) {
      const va = fi * 9 + ei * 3;
      const vb = fi * 9 + ((ei + 1) % 3) * 3;
      const ka = `${positions[va].toFixed(3)},${positions[va+1].toFixed(3)},${positions[va+2].toFixed(3)}`;
      const kb = `${positions[vb].toFixed(3)},${positions[vb+1].toFixed(3)},${positions[vb+2].toFixed(3)}`;
      const key = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
      const entry = edgeToFaces.get(key);
      if (entry) entry.push(fi); else edgeToFaces.set(key, [fi]);
    }
  }

  const edges: BoundaryEdgeInfo[] = [];
  for (const [key, faces] of edgeToFaces.entries()) {
    if (faces.length < 2) continue;
    for (let i = 0; i < faces.length; i++) {
      for (let j = i + 1; j < faces.length; j++) {
        const fA = faces[i], fB = faces[j];
        const cA = colorMap.get(fA), cB = colorMap.get(fB);
        if (!cA || !cB || cA === cB) continue;

        // Midpoint: average of the two shared edge vertices
        const parts = key.split('|');
        const [ax, ay, az] = parts[0].split(',').map(Number);
        const [bx, by, bz] = parts[1].split(',').map(Number);
        const midpoint = new Vector3((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);

        // Tangential direction across the seam (NOT the surface normal — that
        // points straight out of the model, which is why connectors used to
        // look like isolated pins instead of bridging the two parts).
        const centroidA = getFaceCentroid(positions, fA);
        const centroidB = getFaceCentroid(positions, fB);
        const gap = centroidA.distanceTo(centroidB);
        const normal = gap > 1e-6
          ? new Vector3().subVectors(centroidA, centroidB).divideScalar(gap)
          : getFaceNormal(positions, fA);

        edges.push({ midpoint, normal, colorA: cA, colorB: cB, gap });
      }
    }
  }

  return edges;
}

// Finds the closest color-boundary seam to a clicked point, searching outward
// from the clicked face through same-colored territory (BFS, capped at
// maxFaces). Lets the user click anywhere near a joint — not just the exact
// boundary pixel — and still land a physically correct connector: manual
// placement no longer requires hitting a razor-thin seam precisely.
// Minimal binary min-heap, keyed by a numeric priority. Used by
// findNearestBoundary to expand faces in true nearest-to-farthest order —
// a plain BFS explores in graph-hop order, which on a densely tessellated
// mesh can burn its whole search budget fanning out in irrelevant
// directions before ever reaching a boundary that's geometrically close.
class MinHeap<T> {
  private items: { key: number; value: T }[] = [];

  push(key: number, value: T): void {
    this.items.push({ key, value });
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.items[parent].key <= this.items[i].key) break;
      [this.items[parent], this.items[i]] = [this.items[i], this.items[parent]];
      i = parent;
    }
  }

  pop(): T | undefined {
    if (this.items.length === 0) return undefined;
    const top = this.items[0];
    const last = this.items.pop()!;
    if (this.items.length > 0) {
      this.items[0] = last;
      let i = 0;
      const n = this.items.length;
      for (;;) {
        const l = i * 2 + 1, r = i * 2 + 2;
        let smallest = i;
        if (l < n && this.items[l].key < this.items[smallest].key) smallest = l;
        if (r < n && this.items[r].key < this.items[smallest].key) smallest = r;
        if (smallest === i) break;
        [this.items[smallest], this.items[i]] = [this.items[i], this.items[smallest]];
        i = smallest;
      }
    }
    return top.value;
  }

  peekKey(): number | undefined {
    return this.items[0]?.key;
  }

  get size(): number {
    return this.items.length;
  }
}

export function findNearestBoundary(
  startFace: number,
  hitPoint: Vector3,
  positions: Float32Array,
  colorMap: Map<number, ColorID>,
  adjacency: Map<number, number[]>,
  maxFaces: number = 60000
): BoundaryEdgeInfo | null {
  // Deliberately does NOT require the hovered face itself to be painted, nor
  // does it require two DIFFERENTLY colored faces to be directly adjacent —
  // real paint jobs almost always leave a sliver of unpainted triangles
  // right at a seam. Expands nearest-face-first (not breadth-first) so a
  // boundary that's geometrically close is found quickly even through a
  // densely tessellated mesh, and stops as soon as nothing closer than the
  // two nearest colors found so far remains to explore.
  const visited = new Set<number>();
  const heap = new MinHeap<number>();
  heap.push(0, startFace);

  const closestByColor = new Map<ColorID, { point: Vector3; dist: number; face: number }>();
  let processed = 0;

  while (heap.size > 0 && processed < maxFaces) {
    if (closestByColor.size >= 2) {
      const [, second] = Array.from(closestByColor.values()).sort((a, b) => a.dist - b.dist);
      const nextKey = heap.peekKey();
      if (nextKey !== undefined && nextKey >= second.dist) break;
    }

    const current = heap.pop()!;
    if (visited.has(current)) continue;
    visited.add(current);
    processed++;

    const color = colorMap.get(current);
    if (color) {
      const point = getFaceCentroid(positions, current);
      const dist = point.distanceTo(hitPoint);
      const existing = closestByColor.get(color);
      if (!existing || dist < existing.dist) {
        closestByColor.set(color, { point, dist, face: current });
      }
    }

    for (const nb of (adjacency.get(current) || [])) {
      if (!visited.has(nb)) {
        heap.push(getFaceCentroid(positions, nb).distanceTo(hitPoint), nb);
      }
    }
  }

  const entries = Array.from(closestByColor.entries()).sort((a, b) => a[1].dist - b[1].dist);
  if (entries.length < 2) return null;

  const [colorA, infoA] = entries[0];
  const [colorB, infoB] = entries[1];

  const gap = infoA.point.distanceTo(infoB.point);
  const midpoint = infoA.point.clone().add(infoB.point).multiplyScalar(0.5);
  const normal = gap > 1e-6
    ? new Vector3().subVectors(infoA.point, infoB.point).divideScalar(gap)
    : getFaceNormal(positions, infoA.face);

  return { midpoint, normal, colorA, colorB, gap };
}

// Samples connector positions along boundary edges, spacing them by `minSpacingMm`.
// Returns deduplicated positions (no two connectors closer than minSpacingMm).
export function sampleConnectorPositions(
  edges: BoundaryEdgeInfo[],
  minSpacingMm: number
): BoundaryEdgeInfo[] {
  // Group by the specific (colorA, colorB) seam first. A connector's job is
  // to pin two SPECIFIC parts together, so its spacing budget must not be
  // eaten by an unrelated seam that happens to sit nearby in 3D space (e.g.
  // a claw boundary crowding out the crest-to-body boundary, leaving the
  // crest with a connector only wherever a stray point survived).
  const groups = new Map<string, BoundaryEdgeInfo[]>();
  for (const edge of edges) {
    const key = [edge.colorA, edge.colorB].sort().join('|');
    const arr = groups.get(key);
    if (arr) arr.push(edge); else groups.set(key, [edge]);
  }

  const result: BoundaryEdgeInfo[] = [];
  for (const group of groups.values()) {
    result.push(...sampleAlongSeam(group, minSpacingMm));
  }

  console.log(`🔩 Sampled ${result.length} connector positions from ${edges.length} boundary edges across ${groups.size} seam(s)`);
  return result;
}

// Spreads points evenly along a single seam instead of taking whatever order
// the mesh's face scan happens to hand them in (which tends to bunch
// connectors near an arbitrary corner/tip rather than along the seam).
function sampleAlongSeam(group: BoundaryEdgeInfo[], minSpacingMm: number): BoundaryEdgeInfo[] {
  if (group.length === 0) return [];

  const centroid = new Vector3();
  for (const e of group) centroid.add(e.midpoint);
  centroid.divideScalar(group.length);

  // Crude principal axis: direction toward the point farthest from centroid.
  // Good enough to sort an elongated seam end-to-end instead of by scan order.
  let axis = new Vector3(1, 0, 0);
  let maxSpread = -Infinity;
  for (const e of group) {
    const d = e.midpoint.clone().sub(centroid);
    const spread = d.lengthSq();
    if (spread > maxSpread) { maxSpread = spread; axis = spread > 1e-10 ? d.normalize() : axis; }
  }

  const sorted = [...group].sort(
    (a, b) => a.midpoint.clone().sub(centroid).dot(axis) - b.midpoint.clone().sub(centroid).dot(axis)
  );

  const result: BoundaryEdgeInfo[] = [];
  for (const edge of sorted) {
    const tooClose = result.some((p) => p.midpoint.distanceTo(edge.midpoint) < minSpacingMm);
    if (!tooClose) result.push(edge);
  }
  return result;
}

// Returns true if point (px, py) is inside the polygon using ray-casting.
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
// falls inside the lasso polygon.
export function getFacesInLasso(
  polygon: { x: number; y: number }[],
  mesh: Mesh,
  camera: any,
  viewportW: number,
  viewportH: number,
  positions: Float32Array
): number[] {
  if (polygon.length < 3) return [];

  const mvpMatrix = camera.projectionMatrix.clone().multiply(camera.matrixWorldInverse);
  const worldMatrix = mesh.matrixWorld;
  const selected: number[] = [];
  const totalFaces = Math.floor(positions.length / 9);
  const tmp = new Vector3();

  for (let fi = 0; fi < totalFaces; fi++) {
    const base = fi * 9;
    const cx = (positions[base] + positions[base + 3] + positions[base + 6]) / 3;
    const cy = (positions[base + 1] + positions[base + 4] + positions[base + 7]) / 3;
    const cz = (positions[base + 2] + positions[base + 5] + positions[base + 8]) / 3;

    tmp.set(cx, cy, cz).applyMatrix4(worldMatrix).applyMatrix4(mvpMatrix);
    if (tmp.z > 1) continue;

    const sx = ((tmp.x + 1) / 2) * viewportW;
    const sy = ((1 - tmp.y) / 2) * viewportH;

    if (isPointInPolygon(sx, sy, polygon)) selected.push(fi);
  }

  console.log(`🔵 Lasso: ${selected.length} faces in polygon`);
  return selected;
}

// ── Solid capping for export ──────────────────────────────────────────────
//
// Each color group is exported as just its own triangles, which leaves an
// open shell wherever it was cut from a neighboring color (no "lid"). CSG
// booleans (used for connector pins/holes) need closed volumes to behave
// correctly, so before export every part gets its boundary loop(s) fan-
// triangulated shut.

// Builds an edge -> [faceIndex, ...] map for the whole mesh. Shared by
// findColorBoundaryEdges-style lookups and by the capping routine below.
export function buildWholeMeshEdgeToFaces(positions: Float32Array): Map<string, number[]> {
  const totalFaces = Math.floor(positions.length / 9);
  const edgeToFaces = new Map<string, number[]>();
  for (let fi = 0; fi < totalFaces; fi++) {
    for (let ei = 0; ei < 3; ei++) {
      const va = fi * 9 + ei * 3;
      const vb = fi * 9 + ((ei + 1) % 3) * 3;
      const ka = `${positions[va].toFixed(3)},${positions[va + 1].toFixed(3)},${positions[va + 2].toFixed(3)}`;
      const kb = `${positions[vb].toFixed(3)},${positions[vb + 1].toFixed(3)},${positions[vb + 2].toFixed(3)}`;
      const key = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
      const entry = edgeToFaces.get(key);
      if (entry) entry.push(fi); else edgeToFaces.set(key, [fi]);
    }
  }
  return edgeToFaces;
}

// Finds closed boundary loop(s) around a color group by chaining directed
// boundary edges, each kept in the winding direction of its owning triangle
// so that fan-capping them preserves outward-facing normals.
function findBoundaryLoops(
  positions: Float32Array,
  faceIndices: number[],
  colorMap: Map<number, ColorID>,
  thisColor: ColorID,
  edgeToFaces: Map<string, number[]>
): Vector3[][] {
  const directedByStart = new Map<string, { toKey: string; from: Vector3 }>();

  for (const fi of faceIndices) {
    for (let ei = 0; ei < 3; ei++) {
      const va = fi * 9 + ei * 3;
      const vb = fi * 9 + ((ei + 1) % 3) * 3;
      const ka = `${positions[va].toFixed(3)},${positions[va + 1].toFixed(3)},${positions[va + 2].toFixed(3)}`;
      const kb = `${positions[vb].toFixed(3)},${positions[vb + 1].toFixed(3)},${positions[vb + 2].toFixed(3)}`;
      const undirectedKey = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
      const facesOnEdge = edgeToFaces.get(undirectedKey) || [fi];
      const otherFace = facesOnEdge.find((f) => f !== fi);
      const otherColor = otherFace !== undefined ? colorMap.get(otherFace) : undefined;
      const isBoundary = otherFace === undefined || otherColor !== thisColor;
      if (!isBoundary) continue;

      directedByStart.set(ka, {
        toKey: kb,
        from: new Vector3(positions[va], positions[va + 1], positions[va + 2]),
      });
    }
  }

  const loops: Vector3[][] = [];
  const visited = new Set<string>();
  for (const startKey of directedByStart.keys()) {
    if (visited.has(startKey)) continue;
    const loop: Vector3[] = [];
    let curKey = startKey;
    let guard = 0;
    while (directedByStart.has(curKey) && !visited.has(curKey) && guard < 200000) {
      visited.add(curKey);
      const edge = directedByStart.get(curKey)!;
      loop.push(edge.from);
      curKey = edge.toKey;
      guard++;
      if (curKey === startKey) break;
    }
    if (loop.length >= 3) loops.push(loop);
  }

  return loops;
}

// Fan-triangulates each boundary loop from its centroid, producing cap
// triangles that close the part into a (near-)watertight solid.
// Newell's method: normal of a possibly-non-planar closed polygon. Works
// for any simple loop, not just convex/planar ones.
function computePolygonNormal(loop: Vector3[]): Vector3 {
  const normal = new Vector3();
  for (let i = 0; i < loop.length; i++) {
    const curr = loop[i];
    const next = loop[(i + 1) % loop.length];
    normal.x += (curr.y - next.y) * (curr.z + next.z);
    normal.y += (curr.z - next.z) * (curr.x + next.x);
    normal.z += (curr.x - next.x) * (curr.y + next.y);
  }
  return normal.lengthSq() > 1e-12 ? normal.normalize() : new Vector3(0, 0, 1);
}

function pointInTriangle2D(
  p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }
): boolean {
  const sign = (p1: { x: number; y: number }, p2: { x: number; y: number }, p3: { x: number; y: number }) =>
    (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
  const d1 = sign(p, a, b), d2 = sign(p, b, c), d3 = sign(p, c, a);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

// Ear-clipping triangulation of a simple (non-self-intersecting) 2D
// polygon. Returns triangles as index triples into `points`, or an empty
// array if it can't fully resolve the polygon (caller falls back to a
// centroid fan in that case).
function triangulatePolygon2D(points: { x: number; y: number }[]): [number, number, number][] {
  const n = points.length;
  if (n < 3) return [];

  const signedArea = (idx: number[]) => {
    let area = 0;
    for (let i = 0; i < idx.length; i++) {
      const a = points[idx[i]];
      const b = points[idx[(i + 1) % idx.length]];
      area += a.x * b.y - b.x * a.y;
    }
    return area / 2;
  };

  const remaining = Array.from({ length: n }, (_, i) => i);
  if (signedArea(remaining) < 0) remaining.reverse(); // normalize to CCW

  const triangles: [number, number, number][] = [];
  let guard = 0;
  while (remaining.length > 3 && guard < n * n + 10) {
    guard++;
    let earFound = false;

    for (let i = 0; i < remaining.length; i++) {
      const iPrev = remaining[(i - 1 + remaining.length) % remaining.length];
      const iCurr = remaining[i];
      const iNext = remaining[(i + 1) % remaining.length];
      const a = points[iPrev], b = points[iCurr], c = points[iNext];

      const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
      if (cross <= 1e-12) continue; // reflex vertex, not a valid ear tip

      let containsOther = false;
      for (const idx of remaining) {
        if (idx === iPrev || idx === iCurr || idx === iNext) continue;
        if (pointInTriangle2D(points[idx], a, b, c)) { containsOther = true; break; }
      }
      if (containsOther) continue;

      triangles.push([iPrev, iCurr, iNext]);
      remaining.splice(i, 1);
      earFound = true;
      break;
    }

    if (!earFound) return []; // degenerate/self-intersecting — let caller fall back
  }

  if (remaining.length === 3) triangles.push([remaining[0], remaining[1], remaining[2]]);
  return triangles;
}

// Closes each boundary loop with real triangles instead of a naive fan from
// the centroid — a fan self-intersects (and confuses CSG downstream) on any
// concave loop, which is common for organic shapes like horns or claws.
// Projects the loop onto its best-fit plane (Newell's method) and runs
// 2D ear-clipping, falling back to a centroid fan only if that fails.
function capLoops(loops: Vector3[][]): number[] {
  const tris: number[] = [];

  for (const loop of loops) {
    if (loop.length < 3) continue;

    if (loop.length === 3) {
      const [a, b, c] = loop;
      tris.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
      continue;
    }

    const normal = computePolygonNormal(loop);
    const arbitrary = Math.abs(normal.x) < 0.9 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0);
    const u = new Vector3().crossVectors(normal, arbitrary).normalize();
    const v = new Vector3().crossVectors(normal, u).normalize();
    const origin = loop[0];

    const points2D = loop.map((p) => {
      const d = p.clone().sub(origin);
      return { x: d.dot(u), y: d.dot(v) };
    });

    const triIndices = triangulatePolygon2D(points2D);

    if (triIndices.length > 0) {
      for (const [i0, i1, i2] of triIndices) {
        const a = loop[i0], b = loop[i1], c = loop[i2];
        tris.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
      }
    } else {
      // Fallback: centroid fan (better than leaving the loop unclosed)
      const centroid = new Vector3();
      for (const p of loop) centroid.add(p);
      centroid.divideScalar(loop.length);
      for (let i = 0; i < loop.length; i++) {
        const a = loop[i];
        const b = loop[(i + 1) % loop.length];
        tris.push(a.x, a.y, a.z, b.x, b.y, b.z, centroid.x, centroid.y, centroid.z);
      }
    }
  }

  return tris;
}

// Flips triangle winding for the whole geometry if the signed volume comes
// out negative, so the exported solid always ends up with outward-facing
// normals regardless of which way the caps happened to wind.
function ensureOutwardWinding(flat: Float32Array): Float32Array {
  const totalFaces = Math.floor(flat.length / 9);
  let volume6 = 0;
  for (let fi = 0; fi < totalFaces; fi++) {
    const b = fi * 9;
    const v0x = flat[b], v0y = flat[b + 1], v0z = flat[b + 2];
    const v1x = flat[b + 3], v1y = flat[b + 4], v1z = flat[b + 5];
    const v2x = flat[b + 6], v2y = flat[b + 7], v2z = flat[b + 8];
    volume6 += v0x * (v1y * v2z - v1z * v2y)
             - v0y * (v1x * v2z - v1z * v2x)
             + v0z * (v1x * v2y - v1y * v2x);
  }
  if (volume6 >= 0) return flat;

  const flipped = flat.slice();
  for (let fi = 0; fi < totalFaces; fi++) {
    const b = fi * 9;
    for (let k = 0; k < 3; k++) {
      const tmp = flipped[b + 3 + k];
      flipped[b + 3 + k] = flipped[b + 6 + k];
      flipped[b + 6 + k] = tmp;
    }
  }
  return flipped;
}

// Builds a (near-)watertight solid for one color group: the group's own
// faces plus fan-triangulated caps closing every boundary loop. Needed so
// CSG connectors (which require closed volumes) actually embed pins/holes
// instead of floating on an open shell.
// Snaps every coordinate to the SAME 3-decimal grid used for the adjacency
// string-keys elsewhere in this file. Two vertices that our matching logic
// treats as "the same point" should actually BE numerically identical —
// otherwise the geometry has micro-cracks (e.g. 1.000006 vs 0.999994) that
// look fine visually but can trip up CSG's BVH-based boolean evaluation.
// 1-micron precision is far below any 3D printer's real resolution, so this
// is invisible to the final print.
function quantizeVertices(flat: Float32Array, precision = 1000): Float32Array {
  const out = new Float32Array(flat.length);
  for (let i = 0; i < flat.length; i++) {
    out[i] = Math.round(flat[i] * precision) / precision;
  }
  return out;
}

// Drops triangles with (near-)zero area — a common CSG failure trigger,
// and also a possible side effect of quantizeVertices collapsing a very
// thin sliver triangle's three corners together.
function removeDegenerateTriangles(flat: Float32Array, minAreaSq = 1e-12): Float32Array {
  const totalFaces = Math.floor(flat.length / 9);
  const kept: number[] = [];
  for (let fi = 0; fi < totalFaces; fi++) {
    const b = fi * 9;
    const ax = flat[b], ay = flat[b + 1], az = flat[b + 2];
    const bx = flat[b + 3], by = flat[b + 4], bz = flat[b + 5];
    const cx = flat[b + 6], cy = flat[b + 7], cz = flat[b + 8];
    const e1x = bx - ax, e1y = by - ay, e1z = bz - az;
    const e2x = cx - ax, e2y = cy - ay, e2z = cz - az;
    const crossX = e1y * e2z - e1z * e2y;
    const crossY = e1z * e2x - e1x * e2z;
    const crossZ = e1x * e2y - e1y * e2x;
    const areaSq = crossX * crossX + crossY * crossY + crossZ * crossZ;
    if (areaSq > minAreaSq) kept.push(ax, ay, az, bx, by, bz, cx, cy, cz);
  }
  return new Float32Array(kept);
}

export function buildCappedPartGeometry(
  positions: Float32Array,
  faceIndices: number[],
  colorMap: Map<number, ColorID>,
  colorId: ColorID,
  edgeToFaces?: Map<string, number[]>
): Float32Array {
  const wholeEdgeToFaces = edgeToFaces ?? buildWholeMeshEdgeToFaces(positions);
  const own = new Float32Array(faceIndices.length * 9);
  faceIndices.forEach((fi, i) => own.set(positions.slice(fi * 9, fi * 9 + 9), i * 9));

  const loops = findBoundaryLoops(positions, faceIndices, colorMap, colorId, wholeEdgeToFaces);
  const caps = capLoops(loops);

  const combined = new Float32Array(own.length + caps.length);
  combined.set(own, 0);
  combined.set(caps, own.length);

  console.log(`🧊 Capped part ${colorId}: ${faceIndices.length} faces + ${loops.length} loop(s) → ${caps.length / 9} cap triangles`);
  const wound = ensureOutwardWinding(combined);
  return removeDegenerateTriangles(quantizeVertices(wound));
}

// Resolves a connector's final placement: the auto-computed (snap) position
// and axis, adjusted by the manual position/rotation nudges from the editing
// panel. Used consistently by both the 3D preview and the CSG export so they
// never disagree.
export function getEffectiveConnectorTransform(conn: ConnectorPoint): { position: Vector3; normal: Vector3 } {
  const position = new Vector3(conn.position.x, conn.position.y, conn.position.z).add(
    new Vector3(conn.positionOffset.x, conn.positionOffset.y, conn.positionOffset.z)
  );

  const euler = new Euler(
    (conn.rotationDeg.x * Math.PI) / 180,
    (conn.rotationDeg.y * Math.PI) / 180,
    (conn.rotationDeg.z * Math.PI) / 180,
    'XYZ'
  );
  const normal = new Vector3(conn.normal.x, conn.normal.y, conn.normal.z).applyEuler(euler).normalize();

  return { position, normal };
}

// Finds triangles the paint tools left unpainted but that are fully enclosed
// by a single color (e.g. bucket/wand stopping short at a local crease,
// leaving a stray island inside a leg). Returns which color should adopt
// each such face. Ambiguous gaps (bordered by more than one color, or not
// bordered by any painted face at all) are left untouched.
export function fillEnclosedGaps(
  geometry: BufferGeometry,
  colorMap: Map<number, ColorID>
): Map<number, ColorID> {
  const positions = geometry.attributes.position.array as Float32Array;
  const totalFaces = Math.floor(positions.length / 9);
  const adjacency = buildFaceAdjacency(geometry);

  const fills = new Map<number, ColorID>();
  const visited = new Set<number>();

  for (let fi = 0; fi < totalFaces; fi++) {
    if (colorMap.has(fi) || visited.has(fi)) continue;

    const component: number[] = [];
    const borderingColors = new Set<ColorID>();
    const queue = [fi];
    visited.add(fi);

    while (queue.length > 0) {
      const current = queue.shift()!;
      component.push(current);
      for (const nb of (adjacency.get(current) || [])) {
        const nbColor = colorMap.get(nb);
        if (nbColor) {
          borderingColors.add(nbColor);
        } else if (!visited.has(nb)) {
          visited.add(nb);
          queue.push(nb);
        }
      }
    }

    if (borderingColors.size === 1) {
      const [color] = borderingColors;
      for (const cf of component) fills.set(cf, color);
    }
  }

  console.log(`🩹 fillEnclosedGaps: ${fills.size} stray faces filled from enclosed gaps`);
  return fills;
}
