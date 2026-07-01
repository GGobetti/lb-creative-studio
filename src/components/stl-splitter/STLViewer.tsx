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
import {
  expandBrushSelection,
  buildFaceAdjacency,
  floodFillFaces,
  magicWandFill,
} from '@/lib/stl-splitter/geometry-utils';

export function STLViewer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const axesCanvasRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<WebGLRenderer | null>(null);
  const axesRendererRef = useRef<WebGLRenderer | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const axesSceneRef = useRef<Scene | null>(null);
  const meshRef = useRef<Mesh | null>(null);
  const axesCameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  // Hover / drag painting state — all via refs, zero Zustand in hot paths
  const hoveredFaceRef = useRef<number | null>(null);
  const isPaintingRef = useRef(false);
  const paintedFacesInDragRef = useRef(new Set<number>());
  const lastPaintTimeRef = useRef(0);

  const model = useSTLSplitterStore((state) => state.model);
  const painting = useSTLSplitterStore((state) => state.painting);
  const isolatedColorId = useSTLSplitterStore((state) => state.painting.isolatedColorId);
  const paintFaces = useSTLSplitterStore((state) => state.paintFaces);
  const eraseFaces = useSTLSplitterStore((state) => state.eraseFaces);

  // Always-fresh painting state for click/drag handlers registered once at model load
  const paintingRef = useRef(painting);
  useEffect(() => {
    paintingRef.current = painting;
  }, [painting]);

  // Adjacency is expensive — compute once per geometry
  const adjacencyRef = useRef<Map<number, number[]> | null>(null);
  useEffect(() => {
    if (!model?.geometry) { adjacencyRef.current = null; return; }
    console.log('🗺️ Building face adjacency…');
    setTimeout(() => {
      adjacencyRef.current = buildFaceAdjacency(model.geometry!);
    }, 0);
  }, [model?.geometry]);

  // ── Main Three.js scene ────────────────────────────────────────────────────
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
    // Hide system cursor — we draw our own circle overlay
    renderer.domElement.style.cursor = 'none';
    console.log('✅ Renderer created. Canvas size:', containerRef.current.clientWidth, 'x', containerRef.current.clientHeight);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    console.log('🔧 Geometry details:', {
      vertexCount: model.geometry.attributes.position.count,
      bounds: model.boundingBox,
    });

    if (!model.geometry.attributes.normal) {
      model.geometry.computeVertexNormals();
    }

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
    console.log('💡 Lighting rig added');

    // ── Axes helper corner ─────────────────────────────────────────────────
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

      const renderAxes = () => {
        requestAnimationFrame(renderAxes);
        axesRenderer.render(axesScene, axesCamera);
      };
      renderAxes();
      console.log('🧭 Axes helper corner added');
    }

    // ── OrbitControls: RIGHT=orbit, LEFT freed for painting ───────────────
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.mouseButtons = {
      LEFT: null as unknown as THREE.MOUSE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE,
    };

    // Suppress right-click context menu so right-drag orbits cleanly
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    renderer.domElement.addEventListener('contextmenu', handleContextMenu);

    if (model.boundingBox) {
      const size = model.boundingBox.getSize(new Vector3());
      const center = model.boundingBox.getCenter(new Vector3());
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      const fov = camera.fov * (Math.PI / 180);
      let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
      cameraZ *= 1.5;

      camera.near = Math.max(maxDim / 1000, 0.01);
      camera.far = maxDim * 50;
      camera.updateProjectionMatrix();

      camera.position.set(center.x, center.y, center.z + cameraZ);
      camera.lookAt(center);

      controls.target.copy(center);
      controls.minDistance = maxDim * 0.1;
      controls.maxDistance = maxDim * 10;
      controls.update();

      console.log('📷 Camera positioned:', { size, center, cameraPos: camera.position, near: camera.near, far: camera.far });
    }

    const raycaster = new Raycaster();
    const mouse = new Vector2();

    // ── Custom cursor overlay ─────────────────────────────────────────────
    const updateCursor = (e: MouseEvent) => {
      if (!cursorRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const tool = paintingRef.current.activeTool;
      const size = paintingRef.current.brushSize * 2;
      const el = cursorRef.current;

      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      el.style.display = 'block';

      if (tool === 'brush') {
        el.style.width = `${size}px`;
        el.style.height = `${size}px`;
        el.style.border = '2px solid rgba(255,255,255,0.9)';
        el.style.borderStyle = 'solid';
        el.style.boxShadow = '0 0 0 1px rgba(0,0,0,0.6)';
      } else if (tool === 'eraser') {
        el.style.width = `${size}px`;
        el.style.height = `${size}px`;
        el.style.border = '2px dashed rgba(255,80,80,0.95)';
        el.style.borderStyle = 'dashed';
        el.style.boxShadow = '0 0 0 1px rgba(0,0,0,0.6)';
      } else {
        // wand / bucket — small crosshair dot
        el.style.width = '10px';
        el.style.height = '10px';
        el.style.border = '2px solid rgba(255,255,255,0.9)';
        el.style.borderStyle = 'solid';
        el.style.boxShadow = '0 0 0 1px rgba(0,0,0,0.6)';
      }
    };

    // ── Hover highlight — direct color buffer manipulation, no store calls ─
    const applyHoverHighlight = (faceIndex: number | null) => {
      if (!meshRef.current || !model?.geometry?.attributes.color) return;
      const colors = model.geometry.attributes.color.array as Float32Array;
      const currentPainting = paintingRef.current;

      // Restore previous hovered face's actual color
      const prev = hoveredFaceRef.current;
      if (prev !== null) {
        const prevColorId = currentPainting.colorMap.get(prev);
        const prevColor = prevColorId ? currentPainting.colors.get(prevColorId) : null;
        for (let i = 0; i < 3; i++) {
          const vi = (prev * 3 + i) * 3;
          if (vi + 2 >= colors.length) continue;
          if (prevColor) {
            const hex = prevColor.hex.replace('#', '');
            colors[vi]     = parseInt(hex.substring(0, 2), 16) / 255;
            colors[vi + 1] = parseInt(hex.substring(2, 4), 16) / 255;
            colors[vi + 2] = parseInt(hex.substring(4, 6), 16) / 255;
          } else {
            const base = currentPainting.isolatedColorId ? 0.08 : 0.55;
            colors[vi] = colors[vi + 1] = colors[vi + 2] = base;
          }
        }
      }

      hoveredFaceRef.current = faceIndex;

      // Paint yellow-white glow on newly hovered face
      if (faceIndex !== null) {
        for (let i = 0; i < 3; i++) {
          const vi = (faceIndex * 3 + i) * 3;
          if (vi + 2 >= colors.length) continue;
          colors[vi]     = 1.0;
          colors[vi + 1] = 0.95;
          colors[vi + 2] = 0.4;
        }
      }

      model.geometry.attributes.color.needsUpdate = true;
    };

    // ── Core paint/erase logic (shared by click and drag) ─────────────────
    const performPaint = (clientX: number, clientY: number) => {
      const now = Date.now();
      if (now - lastPaintTimeRef.current < 50) return; // throttle ~20fps
      lastPaintTimeRef.current = now;

      const currentPainting = paintingRef.current;
      const tool = currentPainting.activeTool;

      if (tool !== 'eraser' && !currentPainting.selectedColorId) {
        console.log('⚠️ No color selected');
        return;
      }
      if (!meshRef.current) return;

      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObject(meshRef.current);

      if (!intersects.length || intersects[0].faceIndex === undefined) return;

      const faceIndex = intersects[0].faceIndex!;
      console.log(`🖌️ Face ${faceIndex} hit. Tool: ${tool}`);

      // For brush/eraser during drag — skip already-processed faces this stroke
      if ((tool === 'brush' || tool === 'eraser') && paintedFacesInDragRef.current.has(faceIndex)) return;
      if (tool === 'brush' || tool === 'eraser') paintedFacesInDragRef.current.add(faceIndex);

      let selectedFaces: number[];

      if (tool === 'bucket') {
        if (!adjacencyRef.current) {
          console.log('⏳ Adjacency not ready, falling back to single face');
          selectedFaces = [faceIndex];
        } else {
          selectedFaces = floodFillFaces(
            faceIndex, adjacencyRef.current, currentPainting.colorMap,
            model.geometry!, currentPainting.bucketThreshold
          );
        }
      } else if (tool === 'wand') {
        if (!adjacencyRef.current) {
          console.log('⏳ Adjacency not ready, falling back to single face');
          selectedFaces = [faceIndex];
        } else {
          selectedFaces = magicWandFill(
            faceIndex, adjacencyRef.current, model.geometry!,
            currentPainting.wandThreshold, currentPainting.wandMode
          );
        }
      } else {
        // brush or eraser — spatial radius selection
        selectedFaces = expandBrushSelection(
          faceIndex, currentPainting.brushSize, model.geometry!,
          meshRef.current, camera,
          { width: renderer.domElement.clientWidth, height: renderer.domElement.clientHeight }
        );
      }

      if (tool === 'eraser') {
        console.log('🧹 Erasing', selectedFaces.length, 'faces');
        eraseFaces(selectedFaces as any);
      } else {
        console.log('🎨 Painting', selectedFaces.length, 'faces with color:', currentPainting.selectedColorId);
        paintFaces(selectedFaces as any, currentPainting.selectedColorId!);
      }
    };

    // ── Mouse event handlers ──────────────────────────────────────────────
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return; // left button only
      isPaintingRef.current = true;
      paintedFacesInDragRef.current.clear();
      applyHoverHighlight(null); // clear hover glow before painting
      performPaint(e.clientX, e.clientY);
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button !== 0) return;
      isPaintingRef.current = false;
      paintedFacesInDragRef.current.clear();
    };

    const handleMouseMove = (e: MouseEvent) => {
      updateCursor(e);

      if (isPaintingRef.current) {
        const tool = paintingRef.current.activeTool;
        // Bucket/wand paint only on initial click, not on drag
        if (tool === 'brush' || tool === 'eraser') {
          performPaint(e.clientX, e.clientY);
        }
        return; // skip hover highlight while actively painting
      }

      // Hover highlight when idle
      if (!meshRef.current) return;
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObject(meshRef.current);
      const hovered = hits.length > 0 && hits[0].faceIndex !== undefined ? hits[0].faceIndex! : null;
      applyHoverHighlight(hovered);
    };

    const handleMouseLeave = () => {
      applyHoverHighlight(null);
      if (cursorRef.current) cursorRef.current.style.display = 'none';
    };

    renderer.domElement.addEventListener('mousedown', handleMouseDown);
    renderer.domElement.addEventListener('mouseup', handleMouseUp);
    renderer.domElement.addEventListener('mousemove', handleMouseMove);
    renderer.domElement.addEventListener('mouseleave', handleMouseLeave);

    // ── Render loop ───────────────────────────────────────────────────────
    let frameCount = 0;
    const animate = () => {
      requestAnimationFrame(animate);
      frameCount++;
      if (frameCount === 1) console.log('▶️ Animation frame 1 rendered');
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
      renderer.domElement.removeEventListener('mousedown', handleMouseDown);
      renderer.domElement.removeEventListener('mouseup', handleMouseUp);
      renderer.domElement.removeEventListener('mousemove', handleMouseMove);
      renderer.domElement.removeEventListener('mouseleave', handleMouseLeave);
      renderer.domElement.removeEventListener('contextmenu', handleContextMenu);
      if (containerRef.current?.contains(renderer.domElement)) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, [model?.geometry, model?.boundingBox]);

  // ── Color update effect (also handles isolate mode) ───────────────────────
  useEffect(() => {
    if (!meshRef.current || !model || !model.geometry) return;
    if (!model.geometry.attributes.color) return;

    const colors = model.geometry.attributes.color.array as Float32Array;
    // Base: near-black for non-isolated faces when isolating; gray otherwise
    const base = isolatedColorId ? 0.08 : 0.55;
    colors.fill(base);

    painting.colorMap.forEach((colorId, faceIndex) => {
      // Skip non-isolated faces when isolate mode is active
      if (isolatedColorId && colorId !== isolatedColorId) return;

      const color = painting.colors.get(colorId);
      if (!color) return;

      const hex = color.hex.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16) / 255;
      const g = parseInt(hex.substring(2, 4), 16) / 255;
      const b = parseInt(hex.substring(4, 6), 16) / 255;

      for (let i = 0; i < 3; i++) {
        const vertexIndex = faceIndex * 3 + i;
        if (vertexIndex * 3 + 2 < colors.length) {
          colors[vertexIndex * 3]     = r;
          colors[vertexIndex * 3 + 1] = g;
          colors[vertexIndex * 3 + 2] = b;
        }
      }
    });

    // Clear any stale hover state after a full repaint
    hoveredFaceRef.current = null;

    model.geometry.attributes.color.needsUpdate = true;
  }, [painting.colorMap, painting.colors, isolatedColorId, model?.geometry]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full bg-gray-900 rounded-lg" />

      {/* Custom cursor overlay — circle for brush, small dot for wand/bucket, red dashed for eraser */}
      <div
        ref={cursorRef}
        style={{
          position: 'absolute',
          display: 'none',
          borderRadius: '50%',
          pointerEvents: 'none',
          transform: 'translate(-50%, -50%)',
          zIndex: 10,
        }}
      />

      <canvas
        ref={axesCanvasRef}
        className="absolute bottom-4 left-4 border border-gray-600 rounded bg-transparent"
        style={{ width: '120px', height: '120px' }}
      />
    </div>
  );
}
