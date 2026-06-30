import { BufferGeometry } from 'three';
import { FaceIndex, ColorID, ColorGroup } from '@/types/stl-splitter.types';

export function export3MF(
  geometry: BufferGeometry,
  colorMap: Map<FaceIndex, ColorID>,
  colors: Map<ColorID, ColorGroup>
): Blob {
  const positions = geometry.getAttribute('position').array as Float32Array;

  const facesByColor = new Map<ColorID, number[]>();

  colors.forEach((color) => {
    facesByColor.set(color.id, []);
  });

  colorMap.forEach((colorId, faceIndex) => {
    const faces = facesByColor.get(colorId) || [];
    faces.push(faceIndex);
    facesByColor.set(colorId, faces);
  });

  const xml = buildXML_3MF(positions, facesByColor, colors);

  return new Blob([xml], { type: 'application/vnd.ms-package.3dmodel+xml' });
}

function buildXML_3MF(
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
    const { meshXML } = buildMeshXML(positions, faceIndices);

    resourcesXML += `
    <object id="${objectId}" type="model">
      ${meshXML}
    </object>`;

    buildXML += `
    <item objectid="${objectId}" path="/3D/Components/${color?.name.replace(/\s+/g, '_') || 'Part_' + objectId}" />`;

    objectId++;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<model xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2013/12">
  <resources>
${resourcesXML}
  </resources>
  <build>
${buildXML}
  </build>
</model>`;

  return xml;
}

function buildMeshXML(
  allPositions: Float32Array,
  faceIndices: number[]
): { meshXML: string; vertexMap: Map<number, number> } {
  const vertices: number[] = [];
  const vertexMap = new Map<number, number>();
  let newVertexIndex = 0;
  const triangles: string[] = [];

  faceIndices.forEach((faceIndex) => {
    const faceStart = faceIndex * 9;
    const v1 = faceStart / 3;
    const v2 = v1 + 1;
    const v3 = v1 + 2;

    if (!vertexMap.has(v1)) {
      vertexMap.set(v1, newVertexIndex);
      vertices.push(
        allPositions[faceStart],
        allPositions[faceStart + 1],
        allPositions[faceStart + 2]
      );
      newVertexIndex++;
    }

    if (!vertexMap.has(v2)) {
      vertexMap.set(v2, newVertexIndex);
      vertices.push(
        allPositions[faceStart + 3],
        allPositions[faceStart + 4],
        allPositions[faceStart + 5]
      );
      newVertexIndex++;
    }

    if (!vertexMap.has(v3)) {
      vertexMap.set(v3, newVertexIndex);
      vertices.push(
        allPositions[faceStart + 6],
        allPositions[faceStart + 7],
        allPositions[faceStart + 8]
      );
      newVertexIndex++;
    }

    const i1 = vertexMap.get(v1)!;
    const i2 = vertexMap.get(v2)!;
    const i3 = vertexMap.get(v3)!;

    triangles.push(`      <triangle v1="${i1}" v2="${i2}" v3="${i3}" />`);
  });

  let verticesXML = '    <vertices>\n';
  for (let i = 0; i < vertices.length; i += 3) {
    verticesXML += `      <vertex x="${vertices[i].toFixed(6)}" y="${vertices[i + 1].toFixed(6)}" z="${vertices[i + 2].toFixed(6)}" />\n`;
  }
  verticesXML += '    </vertices>\n';

  const meshXML = `<mesh>
${verticesXML}    <triangles>
${triangles.join('\n')}
    </triangles>
  </mesh>`;

  return { meshXML, vertexMap };
}

export function exportOBJMultipart(
  geometry: BufferGeometry,
  colorMap: Map<FaceIndex, ColorID>,
  colors: Map<ColorID, ColorGroup>
): Blob {
  // TODO: V2 - implement OBJ export with material groups
  return new Blob();
}
