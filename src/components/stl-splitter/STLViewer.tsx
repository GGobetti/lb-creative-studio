'use client';

import React, { useEffect, useRef } from 'react';
import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  Mesh,
  MeshStandardMaterial,
  Raycaster,
  Vector2,
  Color,
  Vector3,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
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

  // The click handler is registered once (inside the model-load effect below)
  // and must always read the LATEST painting state, not a stale closure from
  // whenever the model first loaded. Keep it in a ref that's updated every render.
  const paintingRef = useRef(painting);
  useEffect(() => {
    paintingRef.current = painting;
  }, [painting]);

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

    // Ensure normals exist so lighting can reveal curvature/contours
    if (!model.geometry.attributes.normal) {
      model.geometry.computeVertexNormals();
    }

    // Initialize a vertex color attribute (normalized 0-1 floats, avoids
    // the un-normalized Uint8 bug that previously blew out / hid the mesh)
    if (!model.geometry.attributes.color) {
      const positionCount = model.geometry.attributes.position.count;
      const initialColors = new Float32Array(positionCount * 3).fill(0.55);
      model.geometry.setAttribute('color', new THREE.BufferAttribute(initialColors, 3));
    }

    const material = new MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.6,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });
    const mesh = new Mesh(model.geometry, material);
    meshRef.current = mesh;
    scene.add(mesh);
    console.log('✅ Mesh added to scene');

    // Lighting tuned to reveal surface curvature on smooth/organic models
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.1);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
    keyLight.position.set(1, 1.5, 2);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.6);
    fillLight.position.set(-2, -1, -1);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 0.4);
    rimLight.position.set(0, 2, -2);
    scene.add(rimLight);
    console.log('💡 Lighting rig added (hemisphere + 3 directional)');

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

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    if (model.boundingBox) {
      const size = model.boundingBox.getSize(new Vector3());
      const center = model.boundingBox.getCenter(new Vector3());
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      const fov = camera.fov * (Math.PI / 180);
      let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
      cameraZ *= 1.5;

      // Scale near/far clip planes to the model so it isn't clipped or z-fighting
      camera.near = Math.max(maxDim / 1000, 0.01);
      camera.far = maxDim * 50;
      camera.updateProjectionMatrix();

      camera.position.set(center.x, center.y, center.z + cameraZ);
      camera.lookAt(center);

      // Orbit around the model's actual center, not world origin
      controls.target.copy(center);
      controls.minDistance = maxDim * 0.1;
      controls.maxDistance = maxDim * 10;
      controls.update();

      console.log('📷 Camera positioned:', {
        size,
        center,
        cameraPos: camera.position,
        near: camera.near,
        far: camera.far,
      });
    }

    const raycaster = new Raycaster();
    const mouse = new Vector2();

    const handleClick = (event: MouseEvent) => {
      // Always read the LATEST painting state via ref — this handler is
      // registered once when the model loads and must not use a stale closure.
      const currentPainting = paintingRef.current;

      if (!meshRef.current) {
        console.log('❌ Click: no mesh');
        return;
      }

      if (!currentPainting.selectedColorId) {
        console.log('⚠️ Click: no color selected. Add/select a color first.');
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
        console.log('🖌️ Face detected:', faceIndex, 'Brush size:', currentPainting.brushSize);

        const selectedFaces = expandBrushSelection(
          faceIndex,
          currentPainting.brushSize,
          model.geometry!,
          meshRef.current,
          camera,
          { width: renderer.domElement.clientWidth, height: renderer.domElement.clientHeight }
        );

        console.log('🎨 Painting', selectedFaces.length, 'faces with color:', currentPainting.selectedColorId);
        paintFaces(selectedFaces, currentPainting.selectedColorId);
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
    if (!model.geometry.attributes.color) return;

    // Float32, normalized 0-1 range — avoids the un-normalized Uint8 bug
    // that previously washed out / hid the mesh entirely.
    const colors = model.geometry.attributes.color.array as Float32Array;
    colors.fill(0.55);

    painting.colorMap.forEach((colorId, faceIndex) => {
      const color = painting.colors.get(colorId);
      if (!color) return;

      const hex = color.hex.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16) / 255;
      const g = parseInt(hex.substring(2, 4), 16) / 255;
      const b = parseInt(hex.substring(4, 6), 16) / 255;

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
