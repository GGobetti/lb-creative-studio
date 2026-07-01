import { Raycaster, Mesh, Vector2, BufferGeometry, Vector3 } from 'three';

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
