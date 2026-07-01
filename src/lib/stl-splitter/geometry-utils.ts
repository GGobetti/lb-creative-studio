import { Raycaster, Mesh, Vector2, BufferGeometry, Vector3, Matrix4 } from 'three';
import type { ColorID } from '@/types/stl-splitter.types';

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
      const ka = `${positions[va].toFixed(5)},${positions[va + 1].toFixed(5)},${positions[va + 2].toFixed(5)}`;
      const kb = `${positions[vb].toFixed(5)},${positions[vb + 1].toFixed(5)},${positions[vb + 2].toFixed(5)}`;
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

// ── Connector helpers ─────────────────────────────────────────────────────────

export function getFaceCentroid(positions: Float32Array, faceIndex: number): Vector3 {
  const base = faceIndex * 9;
  return new Vector3(
    (positions[base] + positions[base + 3] + positions[base + 6]) / 3,
    (positions[base + 1] + positions[base + 4] + positions[base + 7]) / 3,
    (positions[base + 2] + positions[base + 5] + positions[base + 8]) / 3
  );
}

// Finds the midpoint of the edge shared between two adjacent faces.
export function getSharedEdgeMidpoint(
  positions: Float32Array,
  faceA: number,
  faceB: number
): Vector3 | null {
  const keyAt = (base: number) =>
    `${positions[base].toFixed(5)},${positions[base + 1].toFixed(5)},${positions[base + 2].toFixed(5)}`;
  const edgesOf = (fi: number) => {
    const base = fi * 9;
    return [[base, base + 3], [base + 3, base + 6], [base + 6, base]].map(([a, b]) => ({
      a, b, ka: keyAt(a), kb: keyAt(b),
    }));
  };

  for (const ea of edgesOf(faceA)) {
    for (const eb of edgesOf(faceB)) {
      if ((ea.ka === eb.ka && ea.kb === eb.kb) || (ea.ka === eb.kb && ea.kb === eb.ka)) {
        return new Vector3(
          (positions[ea.a] + positions[ea.b]) / 2,
          (positions[ea.a + 1] + positions[ea.b + 1]) / 2,
          (positions[ea.a + 2] + positions[ea.b + 2]) / 2
        );
      }
    }
  }
  return null;
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
      const ka = `${positions[va].toFixed(4)},${positions[va+1].toFixed(4)},${positions[va+2].toFixed(4)}`;
      const kb = `${positions[vb].toFixed(4)},${positions[vb+1].toFixed(4)},${positions[vb+2].toFixed(4)}`;
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
export function findNearestBoundary(
  startFace: number,
  hitPoint: Vector3,
  positions: Float32Array,
  colorMap: Map<number, ColorID>,
  adjacency: Map<number, number[]>,
  maxFaces: number = 600
): BoundaryEdgeInfo | null {
  const startColor = colorMap.get(startFace);
  if (!startColor) return null;

  const visited = new Set<number>([startFace]);
  const queue = [startFace];
  let best: BoundaryEdgeInfo | null = null;
  let bestDist = Infinity;
  let processed = 0;

  while (queue.length > 0 && processed < maxFaces) {
    const current = queue.shift()!;
    processed++;
    const neighbors = adjacency.get(current) || [];

    for (const nb of neighbors) {
      const nbColor = colorMap.get(nb);

      if (nbColor && nbColor !== startColor) {
        const mid = getSharedEdgeMidpoint(positions, current, nb) ?? getFaceCentroid(positions, current);
        const dist = mid.distanceTo(hitPoint);
        if (dist < bestDist) {
          const centroidA = getFaceCentroid(positions, current);
          const centroidB = getFaceCentroid(positions, nb);
          const gap = centroidA.distanceTo(centroidB);
          const normal = gap > 1e-6
            ? new Vector3().subVectors(centroidA, centroidB).divideScalar(gap)
            : getFaceNormal(positions, current);
          best = { midpoint: mid, normal, colorA: startColor, colorB: nbColor, gap };
          bestDist = dist;
        }
        continue; // don't cross into different-colored territory
      }

      if (!visited.has(nb)) {
        visited.add(nb);
        queue.push(nb);
      }
    }
  }

  return best;
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
      const ka = `${positions[va].toFixed(5)},${positions[va + 1].toFixed(5)},${positions[va + 2].toFixed(5)}`;
      const kb = `${positions[vb].toFixed(5)},${positions[vb + 1].toFixed(5)},${positions[vb + 2].toFixed(5)}`;
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
      const ka = `${positions[va].toFixed(5)},${positions[va + 1].toFixed(5)},${positions[va + 2].toFixed(5)}`;
      const kb = `${positions[vb].toFixed(5)},${positions[vb + 1].toFixed(5)},${positions[vb + 2].toFixed(5)}`;
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
function capLoops(loops: Vector3[][]): number[] {
  const tris: number[] = [];
  for (const loop of loops) {
    const centroid = new Vector3();
    for (const v of loop) centroid.add(v);
    centroid.divideScalar(loop.length);

    for (let i = 0; i < loop.length; i++) {
      const a = loop[i];
      const b = loop[(i + 1) % loop.length];
      tris.push(a.x, a.y, a.z, b.x, b.y, b.z, centroid.x, centroid.y, centroid.z);
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
  return ensureOutwardWinding(combined);
}
