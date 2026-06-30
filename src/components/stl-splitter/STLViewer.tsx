'use client';

import React, { useEffect, useRef } from 'react';
import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  Mesh,
  MeshPhongMaterial,
  Raycaster,
  Vector2,
  Color,
  Vector3,
  PointLight,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as THREE from 'three';
import { useSTLSplitterStore } from '@/store/stl-splitter.store';
import { expandBrushSelection } from '@/lib/stl-splitter/geometry-utils';

export function STLViewer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<WebGLRenderer | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const meshRef = useRef<Mesh | null>(null);

  const model = useSTLSplitterStore((state) => state.model);
  const painting = useSTLSplitterStore((state) => state.painting);
  const paintFaces = useSTLSplitterStore((state) => state.paintFaces);

  useEffect(() => {
    console.log('📦 STLViewer: useEffect triggered. Container:', containerRef.current, 'Model:', model);
    if (!containerRef.current || !model || !model.geometry) {
      console.log('⚠️ Missing container or model, returning');
      return;
    }

    console.log('🎨 Creating Three.js scene...');
    const scene = new Scene();
    scene.background = new Color(0xf5f5f5);
    sceneRef.current = scene;

    const camera = new PerspectiveCamera(
      75,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.z = 50;

    const renderer = new WebGLRenderer({ antialias: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    console.log('✅ Renderer created. Canvas size:', containerRef.current.clientWidth, 'x', containerRef.current.clientHeight);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    console.log('🔧 Geometry details:', {
      vertexCount: model.geometry.attributes.position.count,
      bounds: model.boundingBox,
    });

    const material = new MeshPhongMaterial({
      color: 0xcccccc,
      emissive: 0x222222,
      shininess: 200,
    });
    const mesh = new Mesh(model.geometry, material);
    meshRef.current = mesh;
    scene.add(mesh);
    console.log('✅ Mesh added to scene');

    const light = new PointLight(0xffffff, 1);
    light.position.set(50, 50, 50);
    scene.add(light);
    console.log('💡 Light added');

    if (model.boundingBox) {
      const size = model.boundingBox.getSize(new Vector3());
      const center = model.boundingBox.getCenter(new Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = camera.fov * (Math.PI / 180);
      let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
      cameraZ *= 1.25;
      camera.position.set(center.x, center.y, center.z + cameraZ);
      camera.lookAt(center);
      console.log('📷 Camera positioned:', {
        size,
        center,
        cameraPos: camera.position,
      });
    }

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    const raycaster = new Raycaster();
    const mouse = new Vector2();

    const handleClick = (event: MouseEvent) => {
      if (!meshRef.current) return;

      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObject(meshRef.current);

      if (intersects.length > 0 && intersects[0].face && painting.selectedColorId) {
        const faceIndex = intersects[0].face.a;
        const selectedFaces = expandBrushSelection(
          faceIndex,
          painting.brushSize,
          model.geometry!,
          meshRef.current,
          camera,
          { width: renderer.domElement.clientWidth, height: renderer.domElement.clientHeight }
        );

        paintFaces(selectedFaces, painting.selectedColorId);
      }
    };

    renderer.domElement.addEventListener('click', handleClick);

    let frameCount = 0;
    const animate = () => {
      requestAnimationFrame(animate);
      frameCount++;
      if (frameCount === 1) {
        console.log('▶️ Animation frame 1 rendered');
      }
      controls.update();
      renderer.render(scene, camera);
    };
    console.log('▶️ Starting animation loop');
    animate();

    const handleResize = () => {
      if (!containerRef.current) return;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('click', handleClick);
      if (containerRef.current?.contains(renderer.domElement)) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, [model?.geometry, model?.boundingBox]);

  useEffect(() => {
    if (!meshRef.current || !model || !model.geometry) return;

    const positionCount = model.geometry.attributes.position.count;

    if (!model.geometry.attributes.color) {
      const colors = new Uint8Array(positionCount * 3);
      colors.fill(200);
      model.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      (meshRef.current.material as any).vertexColors = true;
    }

    const colors = model.geometry.attributes.color.array as Uint8Array;
    colors.fill(200);

    painting.colorMap.forEach((colorId, faceIndex) => {
      const color = painting.colors.get(colorId);
      if (!color) return;

      const hex = color.hex.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);

      for (let i = 0; i < 3; i++) {
        const vertexIndex = faceIndex * 3 + i;
        if (vertexIndex * 3 + 2 < colors.length) {
          colors[vertexIndex * 3] = r;
          colors[vertexIndex * 3 + 1] = g;
          colors[vertexIndex * 3 + 2] = b;
        }
      }
    });

    model.geometry.attributes.color.needsUpdate = true;
  }, [painting.colorMap, painting.colors, model?.geometry]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-gray-100 dark:bg-gray-900 rounded-lg"
    />
  );
}
