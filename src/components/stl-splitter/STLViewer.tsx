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
import { EdgesGeometry, LineSegments, LineBasicMaterial } from 'three';
import * as THREE from 'three';
import { useSTLSplitterStore } from '@/store/stl-splitter.store';
import { expandBrushSelection } from '@/lib/stl-splitter/geometry-utils';

export function STLViewer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const axesCanvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<WebGLRenderer | null>(null);
  const axesRendererRef = useRef<WebGLRenderer | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const axesSceneRef = useRef<Scene | null>(null);
  const meshRef = useRef<Mesh | null>(null);
  const axesCameraRef = useRef<THREE.PerspectiveCamera | null>(null);

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
    scene.background = new Color(0x2a2a2a);
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
      color: 0x555555,
      emissive: 0x111111,
      shininess: 50,
      flatShading: false,
      wireframe: false,
      side: THREE.DoubleSide,
    });
    const mesh = new Mesh(model.geometry, material);
    meshRef.current = mesh;
    scene.add(mesh);
    console.log('✅ Mesh added to scene');

    // Add edge visualization for better geometry visibility
    const edges = new EdgesGeometry(model.geometry, 15);
    const edgesMaterial = new LineBasicMaterial({
      color: 0xaaaaaa,
      linewidth: 2,
      fog: false,
    });
    const edgesMesh = new LineSegments(edges, edgesMaterial);
    scene.add(edgesMesh);
    console.log('✨ Edges added for better visibility');

    // Add multiple lights for better illumination
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    console.log('🌟 Ambient light added');

    const light1 = new PointLight(0xffffff, 0.8);
    light1.position.set(100, 100, 100);
    scene.add(light1);

    const light2 = new PointLight(0xffffff, 0.5);
    light2.position.set(-100, -100, 100);
    scene.add(light2);
    console.log('💡 Point lights added');

    // Setup axes helper in separate corner viewer
    if (axesCanvasRef.current && !axesRendererRef.current) {
      const axesRenderer = new WebGLRenderer({ canvas: axesCanvasRef.current, antialias: true, alpha: true });
      axesRenderer.setSize(120, 120);
      axesRenderer.setPixelRatio(window.devicePixelRatio);
      axesRendererRef.current = axesRenderer;

      const axesScene = new Scene();
      axesScene.background = null;
      axesSceneRef.current = axesScene;

      const axesCamera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
      axesCamera.position.set(50, 50, 50);
      axesCamera.lookAt(0, 0, 0);
      axesCameraRef.current = axesCamera;

      const axesHelper = new THREE.AxesHelper(60);
      axesScene.add(axesHelper);

      // Render axes once per frame
      const renderAxes = () => {
        requestAnimationFrame(renderAxes);
        axesRenderer.render(axesScene, axesCamera);
      };
      renderAxes();
      console.log('🧭 Axes helper corner added');
    }

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
      if (!meshRef.current) {
        console.log('❌ Click: no mesh');
        return;
      }

      if (!painting.selectedColorId) {
        console.log('⚠️ Click: no color selected');
        return;
      }

      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      console.log('🖱️ Click detected at:', { x: mouse.x, y: mouse.y });

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObject(meshRef.current);

      console.log('🎯 Raycast intersects:', intersects.length, intersects.length > 0 ? intersects[0] : 'none');

      if (intersects.length > 0 && intersects[0].face) {
        const faceIndex = intersects[0].face.a;
        console.log('🖌️ Face detected:', faceIndex, 'Brush size:', painting.brushSize);

        const selectedFaces = expandBrushSelection(
          faceIndex,
          painting.brushSize,
          model.geometry!,
          meshRef.current,
          camera,
          { width: renderer.domElement.clientWidth, height: renderer.domElement.clientHeight }
        );

        console.log('🎨 Painting', selectedFaces.length, 'faces with color:', painting.selectedColorId);
        paintFaces(selectedFaces, painting.selectedColorId);
      } else {
        console.log('❌ No face intersection found');
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
    <div className="relative w-full h-full">
      <div
        ref={containerRef}
        className="w-full h-full bg-gray-900 rounded-lg"
      />
      <canvas
        ref={axesCanvasRef}
        className="absolute bottom-4 left-4 border border-gray-600 rounded bg-transparent"
        style={{ width: '120px', height: '120px' }}
      />
    </div>
  );
}
