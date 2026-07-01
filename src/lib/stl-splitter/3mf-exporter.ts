import * as THREE from 'three';
import { BufferGeometry } from 'three';
import { zipSync, strToU8 } from 'fflate';
import { FaceIndex, ColorID, ColorGroup, ConnectorPoint } from '@/types/stl-splitter.types';
import { applyConnectorsCSG } from './connector-csg';
import { buildCappedPartGeometry, buildWholeMeshEdgeToFaces } from './geometry-utils';

// 3MF is a ZIP package — slicers like Bambu Studio / PrusaSlicer will reject
// raw XML files that are only renamed to .3mf. This exporter creates a proper
// ZIP with the required [Content_Types].xml, _rels/.rels, and 3D/3dmodel.model.
//
// If connectors are provided, CSG is applied before export:
//   - partA → ADDITION of a cylinder  (the protruding pin)
//   - partB → SUBTRACTION of a wider cylinder (the matching hole)

export interface Export3MFResult {
  blob: Blob;
  warnings: string[];
}

export async function export3MF(
  geometry: BufferGeometry,
  colorMap: Map<FaceIndex, ColorID>,
  colors: Map<ColorID, ColorGroup>,
  connectors: ConnectorPoint[] = []
): Promise<Export3MFResult> {
  const positions = geometry.getAttribute('position').array as Float32Array;
  const warnings: string[] = [];

  // Collect face indices per color
  const facesByColor = new Map<ColorID, number[]>();
  colors.forEach((color) => facesByColor.set(color.id, []));
  colorMap.forEach((colorId, faceIndex) => {
    facesByColor.get(colorId)?.push(faceIndex);
  });

  // Build per-part geometries. Each part is capped into a watertight solid
  // first (raw color-group faces are just an open shell, and CSG booleans
  // need closed volumes to actually embed pins/holes rather than float).
  const partGeometries = new Map<ColorID, Float32Array>();
  const edgeToFaces = buildWholeMeshEdgeToFaces(positions);

  for (const [colorId, faceIndices] of facesByColor.entries()) {
    if (faceIndices.length === 0) continue;

    const cappedPositions = buildCappedPartGeometry(positions, faceIndices, colorMap, colorId, edgeToFaces);
    const partName = colors.get(colorId)?.name ?? colorId;

    if (connectors.length > 0) {
      const partGeo = new THREE.BufferGeometry();
      partGeo.setAttribute('position', new THREE.BufferAttribute(cappedPositions, 3));
      partGeo.computeVertexNormals();

      try {
        // Determine role: if this part is referenced as partA in any connector → pin; partB → hole
        const asPin  = connectors.filter((c) => c.partAColorId === colorId);
        const asHole = connectors.filter((c) => c.partBColorId === colorId);

        let geo = partGeo;
        if (asPin.length > 0) {
          geo = await applyConnectorsCSG(geo, asPin, colorId, 'pin');
          console.log(`🔩 Export: applied ${asPin.length} pins to ${partName}`);
        }
        if (asHole.length > 0) {
          geo = await applyConnectorsCSG(geo, asHole, colorId, 'hole');
          console.log(`🔩 Export: applied ${asHole.length} holes to ${partName}`);
        }
        partGeometries.set(colorId, geo.getAttribute('position').array as Float32Array);
      } catch (err) {
        console.warn(`⚠️ CSG failed for ${partName}, exporting capped part without connectors:`, err);
        warnings.push(`Conector(es) da parte "${partName}" não puderam ser aplicados — peça exportada sem eles.`);
        partGeometries.set(colorId, cappedPositions);
      }
    } else {
      partGeometries.set(colorId, cappedPositions);
    }
  }

  const modelXML = buildModelXML(partGeometries, colors);

  const contentTypesXML = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmodel-xml"/>
</Types>`;

  const relsXML = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>`;

  const zip = zipSync(
    {
      '[Content_Types].xml': strToU8(contentTypesXML),
      '_rels/.rels': strToU8(relsXML),
      '3D/3dmodel.model': strToU8(modelXML),
    },
    { level: 0 }
  );

  return { blob: new Blob([zip], { type: 'application/zip' }), warnings };
}

function buildModelXML(
  partGeometries: Map<ColorID, Float32Array>,
  colors: Map<ColorID, ColorGroup>
): string {
  let objectId = 1;
  let resourcesXML = '';
  let buildXML = '';

  partGeometries.forEach((partPositions, colorId) => {
    const color = colors.get(colorId);
    const name  = color?.name ?? `Part ${objectId}`;
    const meshXML = buildMeshXML(partPositions);

    resourcesXML += `    <object id="${objectId}" type="model" name="${name}">\n`;
    resourcesXML += `      ${meshXML}\n`;
    resourcesXML += `    </object>\n`;
    buildXML += `    <item objectid="${objectId}"/>\n`;
    objectId++;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2013/12">
  <resources>
${resourcesXML}  </resources>
  <build>
${buildXML}  </build>
</model>`;
}

// Builds mesh XML from a flat Float32Array of positions (9 floats per triangle, no dedup needed pre-CSG).
function buildMeshXML(partPositions: Float32Array): string {
  const vertexMap = new Map<string, number>();
  const vertices: number[] = [];
  const triangles: string[] = [];
  const totalFaces = Math.floor(partPositions.length / 9);

  for (let fi = 0; fi < totalFaces; fi++) {
    const base = fi * 9;
    const localIndices: number[] = [];

    for (let v = 0; v < 3; v++) {
      const px = partPositions[base + v * 3];
      const py = partPositions[base + v * 3 + 1];
      const pz = partPositions[base + v * 3 + 2];
      const key = `${px.toFixed(6)},${py.toFixed(6)},${pz.toFixed(6)}`;

      if (!vertexMap.has(key)) {
        vertexMap.set(key, vertices.length / 3);
        vertices.push(px, py, pz);
      }
      localIndices.push(vertexMap.get(key)!);
    }
    triangles.push(`        <triangle v1="${localIndices[0]}" v2="${localIndices[1]}" v3="${localIndices[2]}"/>`);
  }

  let verticesXML = '      <vertices>\n';
  for (let i = 0; i < vertices.length; i += 3) {
    verticesXML += `        <vertex x="${vertices[i].toFixed(6)}" y="${vertices[i+1].toFixed(6)}" z="${vertices[i+2].toFixed(6)}"/>\n`;
  }
  verticesXML += '      </vertices>';

  return `<mesh>\n${verticesXML}\n      <triangles>\n${triangles.join('\n')}\n      </triangles>\n    </mesh>`;
}
