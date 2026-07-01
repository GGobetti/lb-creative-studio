import * as THREE from 'three';
import { Evaluator, Brush, ADDITION, SUBTRACTION } from 'three-bvh-csg';
import type { ConnectorPoint } from '@/types/stl-splitter.types';

function buildAlignedCylinder(
  position: { x: number; y: number; z: number },
  normal: { x: number; y: number; z: number },
  radius: number,
  height: number,
  offsetAlongNormal: number
): Brush {
  const geo  = new THREE.CylinderGeometry(radius, radius, height, 24, 1);
  const norm = new THREE.Vector3(normal.x, normal.y, normal.z).normalize();
  const up   = new THREE.Vector3(0, 1, 0);
  const quat = new THREE.Quaternion().setFromUnitVectors(up, norm);

  const center = new THREE.Vector3(position.x, position.y, position.z)
    .addScaledVector(norm, offsetAlongNormal);

  const brush = new Brush(geo);
  brush.quaternion.copy(quat);
  brush.position.copy(center);
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
    const isPinPart  = conn.partAColorId === partColorId;
    const isHolePart = conn.partBColorId === partColorId;
    if (!isPinPart && !isHolePart) continue;

    const halfDepth  = conn.depth / 2;
    const toolRadius = role === 'hole' ? conn.radius + 0.2 : conn.radius;
    const offset     = isPinPart ? halfDepth : -halfDepth;
    const toolHeight = conn.depth + (role === 'hole' ? 0.4 : 0);

    const tool = buildAlignedCylinder(conn.position, conn.normal, toolRadius, toolHeight, offset);

    console.log(`🔩 CSG ${role} connector ${conn.id}`);
    result = evaluator.evaluate(result, tool, role === 'pin' ? ADDITION : SUBTRACTION) as Brush;
    result.updateMatrixWorld(true);
  }

  return result.geometry;
}
