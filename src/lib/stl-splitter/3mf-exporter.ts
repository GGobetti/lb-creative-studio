import { BufferGeometry } from 'three';
import { zipSync, strToU8 } from 'fflate';
import { FaceIndex, ColorID, ColorGroup } from '@/types/stl-splitter.types';

// 3MF is a ZIP package — slicers like Bambu Studio / PrusaSlicer will reject
// raw XML files that are only renamed to .3mf. This exporter creates a proper
// ZIP with the required [Content_Types].xml, _rels/.rels, and 3D/3dmodel.model.

export function export3MF(
  geometry: BufferGeometry,
  colorMap: Map<FaceIndex, ColorID>,
  colors: Map<ColorID, ColorGroup>
): Blob {
  const positions = geometry.getAttribute('position').array as Float32Array;

  const facesByColor = new Map<ColorID, number[]>();
  colors.forEach((color) => facesByColor.set(color.id, []));
  colorMap.forEach((colorId, faceIndex) => {
    facesByColor.get(colorId)?.push(faceIndex);
  });

  const modelXML = buildModelXML(positions, facesByColor, colors);

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
    { level: 0 } // no compression — faster and slicers don't care
  );

  return new Blob([zip], { type: 'application/zip' });
}

function buildModelXML(
  positions: Float32Array,
  facesByColor: Map<ColorID, number[]>,
  colors: Map<ColorID, ColorGroup>
): string {
  let objectId = 1;
  let resourcesXML = '';
  let buildXML = '';

  facesByColor.forEach((faceIndices, colorId) => {
    if (faceIndices.length === 0) return;

    const color = colors.get(colorId);
    const name = color?.name ?? `Part ${objectId}`;
    const meshXML = buildMeshXML(positions, faceIndices);

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

function buildMeshXML(allPositions: Float32Array, faceIndices: number[]): string {
  const vertices: number[] = [];
  // Re-map global vertex keys to local indices (deduplicates shared vertices)
  const vertexMap = new Map<string, number>();
  const triangles: string[] = [];

  for (const faceIndex of faceIndices) {
    const base = faceIndex * 9;
    const localIndices: number[] = [];

    for (let v = 0; v < 3; v++) {
      const px = allPositions[base + v * 3];
      const py = allPositions[base + v * 3 + 1];
      const pz = allPositions[base + v * 3 + 2];
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
    verticesXML += `        <vertex x="${vertices[i].toFixed(6)}" y="${vertices[i + 1].toFixed(6)}" z="${vertices[i + 2].toFixed(6)}"/>\n`;
  }
  verticesXML += '      </vertices>';

  return `<mesh>\n${verticesXML}\n      <triangles>\n${triangles.join('\n')}\n      </triangles>\n    </mesh>`;
}
