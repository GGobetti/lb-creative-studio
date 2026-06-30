import { Raycaster, Mesh, Vector2, BufferGeometry, Vector3 } from 'three';

export function pickFaceAtRaycast(
  raycaster: Raycaster,
  mesh: Mesh,
  mouse: Vector2,
  camera: any
): number | null {
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(mesh);

  if (intersects.length === 0 || !intersects[0].face) return null;

  return intersects[0].face.a;
}

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

export function getAdjacentFaces(faceIndex: number, geometry: BufferGeometry): number[] {
  // TODO: V2 - implement flood-fill adjacency logic
  return [];
}
