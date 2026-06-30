import { BufferGeometry, BufferAttribute } from 'three';

export interface ParseSTLResult {
  geometry: BufferGeometry;
  vertexCount: number;
  faceCount: number;
}

export function validateSTLFile(file: File): { valid: boolean; error?: string } {
  if (!file.name.toLowerCase().endsWith('.stl')) {
    return { valid: false, error: 'File must be .stl format' };
  }

  const maxSize = 50 * 1024 * 1024;
  if (file.size > maxSize) {
    return { valid: false, error: `File too large. Max 50MB, got ${(file.size / 1024 / 1024).toFixed(1)}MB` };
  }

  if (file.size < 84) {
    return { valid: false, error: 'File too small. Invalid STL file' };
  }

  return { valid: true };
}

export async function parseSTL(file: File): Promise<ParseSTLResult> {
  const validation = validateSTLFile(file);
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid STL file');
  }

  const arrayBuffer = await file.arrayBuffer();

  try {
    const geometry = parseSTLBinary(new DataView(arrayBuffer));
    if (geometry) {
      const vertexCount = geometry.attributes.position.count;
      const faceCount = vertexCount / 3;
      return { geometry, vertexCount, faceCount };
    }
  } catch (e) {
    // Fall through to ASCII
  }

  try {
    const text = new TextDecoder().decode(arrayBuffer);
    const geometry = parseSTLASCII(text);
    const vertexCount = geometry.attributes.position.count;
    const faceCount = vertexCount / 3;
    return { geometry, vertexCount, faceCount };
  } catch (e) {
    throw new Error('Could not parse STL file. Ensure it is valid binary or ASCII STL');
  }
}

function parseSTLBinary(dataView: DataView): BufferGeometry | null {
  const triangles = dataView.getUint32(80, true);

  if (triangles === 0) return null;

  const vertices: number[] = [];
  let offset = 84;

  for (let i = 0; i < triangles; i++) {
    offset += 12; // Skip normal

    for (let j = 0; j < 3; j++) {
      vertices.push(dataView.getFloat32(offset, true));
      offset += 4;
      vertices.push(dataView.getFloat32(offset, true));
      offset += 4;
      vertices.push(dataView.getFloat32(offset, true));
      offset += 4;
    }

    offset += 2; // Skip attribute
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(vertices), 3));
  geometry.computeVertexNormals();
  return geometry;
}

function parseSTLASCII(text: string): BufferGeometry {
  const vertices: number[] = [];
  const vertexPattern = /vertex\s+([-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?)\s+([-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?)\s+([-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?)/g;

  let match;
  while ((match = vertexPattern.exec(text)) !== null) {
    vertices.push(parseFloat(match[1]), parseFloat(match[3]), parseFloat(match[5]));
  }

  if (vertices.length === 0) {
    throw new Error('No vertices found in ASCII STL');
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(vertices), 3));
  geometry.computeVertexNormals();
  return geometry;
}
