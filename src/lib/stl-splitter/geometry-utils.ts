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
// Stops at already-painted boundaries if respectBoundaries=true.
export function floodFillFaces(
  startFace: number,
  adjacency: Map<number, number[]>,
  existingColorMap?: Map<number, string>
): number[] {
  const visited = new Set<number>([startFace]);
  const queue = [startFace];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = adjacency.get(current) || [];

    for (const neighbor of neighbors) {
      if (visited.has(neighbor)) continue;
      // Stop expanding into faces already painted with a DIFFERENT color
      // (same color = ok to expand into, unpainted = always expand)
      if (existingColorMap) {
        const neighborColor = existingColorMap.get(neighbor);
        const startColor = existingColorMap.get(startFace);
        if (neighborColor && neighborColor !== startColor) continue;
      }
      visited.add(neighbor);
      queue.push(neighbor);
    }
  }

  console.log(`🪣 Flood fill from face ${startFace}: selected ${visited.size} faces`);
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

// Magic wand: flood fill but only expands to adjacent faces whose normal
// angle relative to the start face is within the given threshold (degrees).
export function magicWandFill(
  startFace: number,
  adjacency: Map<number, number[]>,
  geometry: BufferGeometry,
  thresholdDegrees: number = 30
): number[] {
  const positions = geometry.attributes.position.array as Float32Array;
  const startNormal = getFaceNormal(positions, startFace);
  const cosThreshold = Math.cos((thresholdDegrees * Math.PI) / 180);

  const visited = new Set<number>([startFace]);
  const queue = [startFace];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = adjacency.get(current) || [];

    for (const neighbor of neighbors) {
      if (visited.has(neighbor)) continue;

      const neighborNormal = getFaceNormal(positions, neighbor);
      const dot = startNormal.dot(neighborNormal);

      if (dot >= cosThreshold) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  console.log(`✨ Magic wand from face ${startFace} (threshold ${thresholdDegrees}°): selected ${visited.size} faces`);
  return Array.from(visited);
}

export function getAdjacentFaces(faceIndex: number, geometry: BufferGeometry): number[] {
  return [];
}
