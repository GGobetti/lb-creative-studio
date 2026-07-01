import * as THREE from 'three';
import { Evaluator, Brush, ADDITION, SUBTRACTION } from 'three-bvh-csg';
import type { ConnectorPoint } from '@/types/stl-splitter.types';
import { getEffectiveConnectorTransform } from './geometry-utils';

// three-bvh-csg's Evaluator hard-codes ['position', 'uv', 'normal'] as the
// attributes it reads from BOTH brushes in a boolean op (see its source:
// `this.attributes = ['position', 'uv', 'normal']`). Our part geometry only
// ever gets position + normal — CylinderGeometry (the connector tool) DOES
// include uv, so the evaluator tries to read `attributes.uv.array` off our
// part's geometry, finds `undefined`, and throws mid-operation. A dummy
// all-zero uv is enough; nothing here is ever textured.
function ensureUvAttribute(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  if (!geometry.attributes.uv) {
    const count = geometry.attributes.position.count;
    geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
  }
  return geometry;
}

function buildAlignedCylinder(
  position: THREE.Vector3,
  normal: THREE.Vector3,
  radius: number,
  height: number
): Brush {
  const geo  = new THREE.CylinderGeometry(radius, radius, height, 24, 1);
  const up   = new THREE.Vector3(0, 1, 0);
  const quat = new THREE.Quaternion().setFromUnitVectors(up, normal);

  const brush = new Brush(geo);
  brush.quaternion.copy(quat);
  brush.position.copy(position);
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

  let result = new Brush(ensureUvAttribute(partGeometry.clone()));
  result.updateMatrixWorld(true);

  for (const conn of connectors) {
    const isRelevant = role === 'pin'
      ? conn.partAColorId === partColorId
      : conn.partBColorId === partColorId;
    if (!isRelevant) continue;

    const clearance = conn.clearance ?? 0.2;
    const toolRadius = role === 'hole' ? conn.radius + clearance : conn.radius;
    const toolHeight = role === 'hole' ? conn.depth + clearance * 2 : conn.depth;

    // Centered exactly on the seam: half the cylinder overlaps this part's
    // own material (so ADDITION fuses / SUBTRACTION actually cuts
    // something), half crosses into the neighboring part's space — that's
    // the protruding pin / the socket cavity that receives it. Position and
    // axis include any manual move/rotate nudges from the editing panel.
    const { position, normal } = getEffectiveConnectorTransform(conn);
    const tool = buildAlignedCylinder(position, normal, toolRadius, toolHeight);

    console.log(`🔩 CSG ${role} connector ${conn.id}`);
    result = evaluator.evaluate(result, tool, role === 'pin' ? ADDITION : SUBTRACTION) as Brush;
    result.updateMatrixWorld(true);
  }

  return result.geometry;
}
