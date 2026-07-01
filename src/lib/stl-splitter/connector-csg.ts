import * as THREE from 'three';
import { Evaluator, Brush, ADDITION, SUBTRACTION } from 'three-bvh-csg';
import type { ConnectorPoint } from '@/types/stl-splitter.types';

function buildAlignedCylinder(
  position: { x: number; y: number; z: number },
  normal: { x: number; y: number; z: number },
  radius: number,
  height: number
): Brush {
  const geo  = new THREE.CylinderGeometry(radius, radius, height, 24, 1);
  const norm = new THREE.Vector3(normal.x, normal.y, normal.z).normalize();
  const up   = new THREE.Vector3(0, 1, 0);
  const quat = new THREE.Quaternion().setFromUnitVectors(up, norm);

  const brush = new Brush(geo);
  brush.quaternion.copy(quat);
  brush.position.set(position.x, position.y, position.z);
  brush.updateMatrixWorld(true);
  return brush;
}

export async function applyConnectorsCSG(
  partGeometry: THREE.BufferGeometry,
  connectors: ConnectorPoint[],
  partColorId: string,
  role: 'pin' | 'hole'
): Promise<THREE.BufferGeometry> {
  if (connectors.length === 0) return partGeometry;

  const evaluator = new Evaluator();
  evaluator.useGroups = false;

  let result = new Brush(partGeometry.clone());
  result.updateMatrixWorld(true);

  for (const conn of connectors) {
    const isRelevant = role === 'pin'
      ? conn.partAColorId === partColorId
      : conn.partBColorId === partColorId;
    if (!isRelevant) continue;

    const toolRadius = role === 'hole' ? conn.radius + 0.2 : conn.radius;
    const toolHeight = role === 'hole' ? conn.depth + 0.4 : conn.depth;

    // Centered exactly on the seam (conn.position): half the cylinder
    // overlaps this part's own material (so ADDITION fuses / SUBTRACTION
    // actually cuts something), half crosses into the neighboring part's
    // space — that's the protruding pin / the socket cavity that receives it.
    const tool = buildAlignedCylinder(conn.position, conn.normal, toolRadius, toolHeight);

    console.log(`🔩 CSG ${role} connector ${conn.id}`);
    result = evaluator.evaluate(result, tool, role === 'pin' ? ADDITION : SUBTRACTION) as Brush;
    result.updateMatrixWorld(true);
  }

  return result.geometry;
}
