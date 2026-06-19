// src/lib/stl-exporter.ts
// Wraps Three.js STLExporter (examples/jsm) for use in Next.js client components.
// Only importable on the client (uses Blob/URL APIs).

import * as THREE from 'three'

// Inline STLExporter implementation to avoid relying on examples/jsm path issues
// Based on three/examples/jsm/exporters/STLExporter.js (MIT)

export class STLExporter {
  parse(scene: THREE.Object3D, options: { binary?: boolean } = {}): string | DataView {
    const binary = options.binary !== undefined ? options.binary : false

    const objects: { mesh: THREE.Mesh; matrixWorld: THREE.Matrix4 }[] = []
    let triangles = 0

    scene.traverse((object) => {
      if ((object as THREE.Mesh).isMesh) {
        const mesh = object as THREE.Mesh
        let geometry = mesh.geometry
        if (!geometry.isBufferGeometry) return
        geometry = geometry.toNonIndexed()
        triangles += geometry.getAttribute('position').count / 3
        objects.push({ mesh, matrixWorld: mesh.matrixWorld })
      }
    })

    if (binary) {
      const bufferLength = triangles * 2 + triangles * 3 * 4 * 4 + 80 + 4
      const arrayBuffer = new ArrayBuffer(bufferLength)
      const output = new DataView(arrayBuffer)
      let offset = 80

      output.setUint32(offset, triangles, true)
      offset += 4

      const normalMatrix = new THREE.Matrix3()
      const vA = new THREE.Vector3()
      const vB = new THREE.Vector3()
      const vC = new THREE.Vector3()
      const cb = new THREE.Vector3()
      const ab = new THREE.Vector3()

      for (const { mesh, matrixWorld } of objects) {
        const geometry = (mesh.geometry as THREE.BufferGeometry).toNonIndexed()
        normalMatrix.getNormalMatrix(matrixWorld)
        const position = geometry.getAttribute('position') as THREE.BufferAttribute

        for (let i = 0; i < position.count; i += 3) {
          vA.fromBufferAttribute(position, i).applyMatrix4(matrixWorld)
          vB.fromBufferAttribute(position, i + 1).applyMatrix4(matrixWorld)
          vC.fromBufferAttribute(position, i + 2).applyMatrix4(matrixWorld)

          cb.subVectors(vC, vB)
          ab.subVectors(vA, vB)
          cb.cross(ab).normalize()

          output.setFloat32(offset, cb.x, true); offset += 4
          output.setFloat32(offset, cb.y, true); offset += 4
          output.setFloat32(offset, cb.z, true); offset += 4

          output.setFloat32(offset, vA.x, true); offset += 4
          output.setFloat32(offset, vA.y, true); offset += 4
          output.setFloat32(offset, vA.z, true); offset += 4

          output.setFloat32(offset, vB.x, true); offset += 4
          output.setFloat32(offset, vB.y, true); offset += 4
          output.setFloat32(offset, vB.z, true); offset += 4

          output.setFloat32(offset, vC.x, true); offset += 4
          output.setFloat32(offset, vC.y, true); offset += 4
          output.setFloat32(offset, vC.z, true); offset += 4

          output.setUint16(offset, 0, true); offset += 2
        }
      }
      return output
    }

    // ASCII
    let output = 'solid exported\n'
    const normalMatrix = new THREE.Matrix3()
    const vA = new THREE.Vector3()
    const vB = new THREE.Vector3()
    const vC = new THREE.Vector3()
    const cb = new THREE.Vector3()
    const ab = new THREE.Vector3()

    for (const { mesh, matrixWorld } of objects) {
      const geometry = (mesh.geometry as THREE.BufferGeometry).toNonIndexed()
      normalMatrix.getNormalMatrix(matrixWorld)
      const position = geometry.getAttribute('position') as THREE.BufferAttribute

      for (let i = 0; i < position.count; i += 3) {
        vA.fromBufferAttribute(position, i).applyMatrix4(matrixWorld)
        vB.fromBufferAttribute(position, i + 1).applyMatrix4(matrixWorld)
        vC.fromBufferAttribute(position, i + 2).applyMatrix4(matrixWorld)

        cb.subVectors(vC, vB)
        ab.subVectors(vA, vB)
        cb.cross(ab).normalize()

        output += `facet normal ${cb.x} ${cb.y} ${cb.z}\n`
        output += '\touter loop\n'
        output += `\t\tvertex ${vA.x} ${vA.y} ${vA.z}\n`
        output += `\t\tvertex ${vB.x} ${vB.y} ${vB.z}\n`
        output += `\t\tvertex ${vC.x} ${vC.y} ${vC.z}\n`
        output += '\tendloop\n'
        output += 'endfacet\n'
      }
    }

    output += 'endsolid exported\n'
    return output
  }
}

/** Triggers browser download of a geometry as a binary STL file */
export function downloadSTL(
  geometry: THREE.BufferGeometry,
  filename: string = 'lb-studio-export.stl',
): void {
  const mesh = new THREE.Mesh(geometry)
  const scene = new THREE.Scene()
  scene.add(mesh)

  const exporter = new STLExporter()
  const result = exporter.parse(scene, { binary: true }) as DataView

  const blob = new Blob([result.buffer as ArrayBuffer], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
