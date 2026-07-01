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
  getFacesInLasso,
} from '@/lib/stl-splitter/geometry-utils';

export function STLViewer() {
  const containerRef    = useRef<HTMLDivElement>(null);
  const axesCanvasRef   = useRef<HTMLCanvasElement>(null);
  const lassoCanvasRef  = useRef<HTMLCanvasElement>(null);
  const cursorRef       = useRef<HTMLDivElement>(null);
  const rendererRef     = useRef<WebGLRenderer | null>(null);
  const axesRendererRef = useRef<WebGLRenderer | null>(null);
  const sceneRef        = useRef<Scene | null>(null);
  const axesSceneRef    = useRef<Scene | null>(null);
  const meshRef         = useRef<Mesh | null>(null);
  const cameraRef       = useRef<PerspectiveCamera | null>(null);
  const axesCameraRef   = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef     = useRef<OrbitControls | null>(null);
  const wireframeMeshRef = useRef<THREE.LineSegments | null>(null);

  // Hover / drag-paint state — all refs, zero Zustand in hot paths
  const hoveredFaceRef         = useRef<number | null>(null);
  const isPaintingRef          = useRef(false);
  const paintedFacesInDragRef  = useRef(new Set<number>());
  const lastPaintTimeRef       = useRef(0);
  const lastHoverTimeRef       = useRef(0);

  const model           = useSTLSplitterStore((state) => state.model);
  const painting        = useSTLSplitterStore((state) => state.painting);
  const isolatedColorId = useSTLSplitterStore((state) => state.painting.isolatedColorId);
  const showWireframe   = useSTLSplitterStore((state) => state.ui.showWireframe);
  const setShowWireframe = useSTLSplitterStore((state) => state.setShowWireframe);
  const paintFaces      = useSTLSplitterStore((state) => state.paintFaces);
  const eraseFaces      = useSTLSplitterStore((state) => state.eraseFaces);

  // Always-fresh painting state for handlers registered once at model load
  const paintingRef = useRef(painting);
  useEffect(() => { paintingRef.current = painting; }, [painting]);

  // Adjacency graph — built once per geometry, cached
  const adjacencyRef = useRef<Map<number, number[]> | null>(null);
  useEffect(() => {
    if (!model?.geometry) { adjacencyRef.current = null; return; }
    console.log('🗺️ Building face adjacency…');
    setTimeout(() => { adjacencyRef.current = buildFaceAdjacency(model.geometry!); }, 0);
  }, [model?.geometry]);

  // ── Main Three.js scene ────────────────────────────────────────────────────
  useEffect(() => {
    console.log('📦 STLViewer useEffect. Container:', !!containerRef.current, 'Model:', !!model);
    if (!containerRef.current || !model?.geometry) {
      console.log('⚠️ Missing container or model');
      return;
    }

    const scene = new Scene();
    scene.background = new Color(0x2a2a2a);
    sceneRef.current = scene;

    const camera = new PerspectiveCamera(75, containerRef.current.clientWidth / containerRef.current.clientHeight, 0.1, 1000);
    camera.position.z = 50;
    cameraRef.current = camera;

    const renderer = new WebGLRenderer({ antialias: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.domElement.style.cursor = 'none';
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    if (!model.geometry.attributes.normal) model.geometry.computeVertexNormals();

    if (!model.geometry.attributes.color) {
      const count = model.geometry.attributes.position.count;
      model.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3).fill(0.55), 3));
    }

    const material = new MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.6, metalness: 0.05, side: THREE.DoubleSide });
    const mesh = new Mesh(model.geometry, material);
    meshRef.current = mesh;
    scene.add(mesh);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.1));
    const key = new THREE.DirectionalLight(0xffffff, 1.2); key.position.set(1, 1.5, 2); scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.6); fill.position.set(-2, -1, -1); scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, 0.4); rim.position.set(0, 2, -2); scene.add(rim);

    // Axes helper (separate corner canvas)
    if (axesCanvasRef.current && !axesRendererRef.current) {
      const ar = new WebGLRenderer({ canvas: axesCanvasRef.current, antialias: true, alpha: true });
      ar.setSize(120, 120);
      ar.setPixelRatio(window.devicePixelRatio);
      axesRendererRef.current = ar;
      const as = new Scene(); as.background = null; axesSceneRef.current = as;
      const ac = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
      ac.position.set(50, 50, 50); ac.lookAt(0, 0, 0); axesCameraRef.current = ac;
      as.add(new THREE.AxesHelper(60));
      const renderAxes = () => { requestAnimationFrame(renderAxes); ar.render(as, ac); };
      renderAxes();
    }

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controlsRef.current = controls;

    const handleContextMenu = (e: Event) => e.preventDefault();
    renderer.domElement.addEventListener('contextmenu', handleContextMenu);

    if (model.boundingBox) {
      const size   = model.boundingBox.getSize(new Vector3());
      const center = model.boundingBox.getCenter(new Vector3());
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      const fov    = camera.fov * (Math.PI / 180);
      const cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.5;

      camera.near = Math.max(maxDim / 1000, 0.01);
      camera.far  = maxDim * 50;
      camera.updateProjectionMatrix();
      camera.position.set(center.x, center.y, center.z + cameraZ);
      camera.lookAt(center);

      controls.target.copy(center);
      controls.minDistance = maxDim * 0.1;
      controls.maxDistance = maxDim * 10;
      controls.update();
      console.log('📷 Camera positioned at', camera.position);
    }

    const raycaster = new Raycaster();
    const mouse     = new Vector2();

    // ── Custom cursor overlay ──────────────────────────────────────────────
    const updateCursor = (clientX: number, clientY: number) => {
      const el = cursorRef.current;
      if (!el || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      el.style.left    = `${clientX - rect.left}px`;
      el.style.top     = `${clientY - rect.top}px`;
      el.style.display = 'block';

      const tool = paintingRef.current.activeTool;
      const size = paintingRef.current.brushSize * 2;

      if (tool === 'brush') {
        el.style.width  = `${size}px`;
        el.style.height = `${size}px`;
        el.style.border = '2px solid rgba(255,255,255,0.9)';
        el.style.boxShadow = '0 0 0 1.5px rgba(0,0,0,0.7)';
      } else if (tool === 'eraser') {
        el.style.width  = `${size}px`;
        el.style.height = `${size}px`;
        el.style.border = '2px dashed rgba(255,80,80,0.95)';
        el.style.boxShadow = '0 0 0 1.5px rgba(0,0,0,0.7)';
      } else if (tool === 'lasso') {
        el.style.display = 'none'; // lasso canvas uses crosshair
      } else {
        el.style.width  = '10px';
        el.style.height = '10px';
        el.style.border = '2px solid rgba(255,255,255,0.9)';
        el.style.boxShadow = '0 0 0 1.5px rgba(0,0,0,0.7)';
      }
    };

    // ── Hover highlight ────────────────────────────────────────────────────
    const applyHoverHighlight = (faceIndex: number | null) => {
      if (!meshRef.current || !model.geometry?.attributes.color) return;
      const colors = model.geometry.attributes.color.array as Float32Array;
      const p = paintingRef.current;

      const prev = hoveredFaceRef.current;
      if (prev !== null) {
        const cid = p.colorMap.get(prev);
        const c   = cid ? p.colors.get(cid) : null;
        for (let i = 0; i < 3; i++) {
          const vi = (prev * 3 + i) * 3;
          if (vi + 2 >= colors.length) continue;
          if (c) {
            const hex = c.hex.replace('#', '');
            colors[vi]     = parseInt(hex.substring(0, 2), 16) / 255;
            colors[vi + 1] = parseInt(hex.substring(2, 4), 16) / 255;
            colors[vi + 2] = parseInt(hex.substring(4, 6), 16) / 255;
          } else {
            const base = p.isolatedColorId ? 0.08 : 0.55;
            colors[vi] = colors[vi + 1] = colors[vi + 2] = base;
          }
        }
      }

      hoveredFaceRef.current = faceIndex;

      if (faceIndex !== null) {
        for (let i = 0; i < 3; i++) {
          const vi = (faceIndex * 3 + i) * 3;
          if (vi + 2 >= colors.length) continue;
          colors[vi] = 1.0; colors[vi + 1] = 0.95; colors[vi + 2] = 0.4;
        }
      }
      model.geometry.attributes.color.needsUpdate = true;
    };

    // ── Core paint / erase ────────────────────────────────────────────────
    const performPaint = (clientX: number, clientY: number) => {
      const now = Date.now();
      if (now - lastPaintTimeRef.current < 50) return;
      lastPaintTimeRef.current = now;

      const p    = paintingRef.current;
      const tool = p.activeTool;
      if (tool === 'lasso') return; // handled by lasso canvas
      if (tool !== 'eraser' && !p.selectedColorId) { console.log('⚠️ No color selected'); return; }
      if (!meshRef.current) return;

      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObject(meshRef.current);
      if (!hits.length || hits[0].faceIndex === undefined) return;

      const fi = hits[0].faceIndex!;
      console.log(`🖌️ Face ${fi} hit. Tool: ${tool}`);

      if ((tool === 'brush' || tool === 'eraser') && paintedFacesInDragRef.current.has(fi)) return;
      if (tool === 'brush' || tool === 'eraser') paintedFacesInDragRef.current.add(fi);

      let faces: number[];

      if (tool === 'bucket') {
        faces = adjacencyRef.current
          ? floodFillFaces(fi, adjacencyRef.current, p.colorMap, model.geometry!, p.bucketThreshold)
          : [fi];
      } else if (tool === 'wand') {
        faces = adjacencyRef.current
          ? magicWandFill(fi, adjacencyRef.current, model.geometry!, p.wandThreshold, p.wandMode)
          : [fi];
      } else {
        faces = expandBrushSelection(fi, p.brushSize, model.geometry!, meshRef.current, camera,
          { width: renderer.domElement.clientWidth, height: renderer.domElement.clientHeight });
      }

      if (tool === 'eraser') {
        console.log('🧹 Erasing', faces.length, 'faces');
        eraseFaces(faces as any);
      } else {
        console.log('🎨 Painting', faces.length, 'faces →', p.selectedColorId);
        paintFaces(faces as any, p.selectedColorId!);
      }
    };

    // ── Interaction model ──────────────────────────────────────────────────
    const HOLD_MS = 150;
    const DRAG_PX = 5;
    let holdTimer: ReturnType<typeof setTimeout> | null = null;
    let downX = 0;
    let downY = 0;

    const startHoldTimer = (clientX: number, clientY: number) => {
      downX = clientX; downY = clientY;
      holdTimer = setTimeout(() => {
        holdTimer = null;
        isPaintingRef.current = true;
        paintedFacesInDragRef.current.clear();
        if (controlsRef.current) controlsRef.current.enabled = false;
        applyHoverHighlight(null);
        performPaint(clientX, clientY);
      }, HOLD_MS);
    };

    const clearHoldTimer = () => {
      if (holdTimer !== null) { clearTimeout(holdTimer); holdTimer = null; }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if (paintingRef.current.activeTool === 'lasso') return; // lasso handled separately
      startHoldTimer(e.clientX, e.clientY);
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button !== 0) return;
      clearHoldTimer();
      isPaintingRef.current = false;
      paintedFacesInDragRef.current.clear();
      if (controlsRef.current) controlsRef.current.enabled = true;
    };

    const handleClick = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if (isPaintingRef.current) return;
      if (paintingRef.current.activeTool === 'lasso') return;
      performPaint(e.clientX, e.clientY);
    };

    const handleMouseMove = (e: MouseEvent) => {
      updateCursor(e.clientX, e.clientY);

      if (holdTimer !== null) {
        const dx = e.clientX - downX;
        const dy = e.clientY - downY;
        if (Math.sqrt(dx * dx + dy * dy) > DRAG_PX) clearHoldTimer();
      }

      if (isPaintingRef.current) {
        const tool = paintingRef.current.activeTool;
        if (tool === 'brush' || tool === 'eraser') performPaint(e.clientX, e.clientY);
        return;
      }

      const now = Date.now();
      if (now - lastHoverTimeRef.current < 33) return;
      lastHoverTimeRef.current = now;

      if (!meshRef.current) return;
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObject(meshRef.current);
      applyHoverHighlight(hits.length > 0 && hits[0].faceIndex !== undefined ? hits[0].faceIndex! : null);
    };

    const handleMouseLeave = () => {
      clearHoldTimer();
      applyHoverHighlight(null);
      if (cursorRef.current) cursorRef.current.style.display = 'none';
    };

    renderer.domElement.addEventListener('mousedown',  handleMouseDown);
    renderer.domElement.addEventListener('mouseup',    handleMouseUp);
    renderer.domElement.addEventListener('click',      handleClick);
    renderer.domElement.addEventListener('mousemove',  handleMouseMove);
    renderer.domElement.addEventListener('mouseleave', handleMouseLeave);

    let frame = 0;
    const animate = () => {
      requestAnimationFrame(animate);
      frame++;
      if (frame === 1) console.log('▶️ First frame rendered');
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('mousedown',  handleMouseDown);
      renderer.domElement.removeEventListener('mouseup',    handleMouseUp);
      renderer.domElement.removeEventListener('click',      handleClick);
      renderer.domElement.removeEventListener('mousemove',  handleMouseMove);
      renderer.domElement.removeEventListener('mouseleave', handleMouseLeave);
      renderer.domElement.removeEventListener('contextmenu', handleContextMenu);
      clearHoldTimer();
      if (wireframeMeshRef.current) { scene.remove(wireframeMeshRef.current); wireframeMeshRef.current = null; }
      if (controlsRef.current) { controlsRef.current.enabled = true; controlsRef.current = null; }
      cameraRef.current = null;
      if (containerRef.current?.contains(renderer.domElement)) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, [model?.geometry, model?.boundingBox]);

  // ── Color + isolate update effect ──────────────────────────────────────────
  useEffect(() => {
    if (!meshRef.current || !model?.geometry?.attributes.color) return;

    const colors = model.geometry.attributes.color.array as Float32Array;
    colors.fill(isolatedColorId ? 0.08 : 0.55);

    painting.colorMap.forEach((colorId, faceIndex) => {
      if (isolatedColorId && colorId !== isolatedColorId) return;
      const color = painting.colors.get(colorId);
      if (!color) return;
      const hex = color.hex.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16) / 255;
      const g = parseInt(hex.substring(2, 4), 16) / 255;
      const b = parseInt(hex.substring(4, 6), 16) / 255;
      for (let i = 0; i < 3; i++) {
        const vi = (faceIndex * 3 + i) * 3;
        if (vi + 2 < colors.length) {
          colors[vi] = r; colors[vi + 1] = g; colors[vi + 2] = b;
        }
      }
    });

    hoveredFaceRef.current = null;
    model.geometry.attributes.color.needsUpdate = true;
  }, [painting.colorMap, painting.colors, isolatedColorId, model?.geometry]);

  // ── Wireframe overlay effect ───────────────────────────────────────────────
  useEffect(() => {
    if (!sceneRef.current || !model?.geometry) return;

    if (showWireframe) {
      if (!wireframeMeshRef.current) {
        const edgesGeo = new THREE.EdgesGeometry(model.geometry, 15);
        const mat = new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.22, transparent: true });
        wireframeMeshRef.current = new THREE.LineSegments(edgesGeo, mat);
        sceneRef.current.add(wireframeMeshRef.current);
        console.log('🔲 Wireframe overlay added');
      }
      wireframeMeshRef.current.visible = true;
    } else if (wireframeMeshRef.current) {
      wireframeMeshRef.current.visible = false;
      console.log('🔲 Wireframe overlay hidden');
    }
  }, [showWireframe, model?.geometry]);

  // ── Disable OrbitControls when lasso is active ─────────────────────────────
  useEffect(() => {
    if (!controlsRef.current) return;
    controlsRef.current.enabled = painting.activeTool !== 'lasso';
    if (cursorRef.current && painting.activeTool === 'lasso') {
      cursorRef.current.style.display = 'none';
    }
  }, [painting.activeTool]);

  // ── Lasso canvas drawing + face selection ─────────────────────────────────
  useEffect(() => {
    const canvas = lassoCanvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !model?.geometry) return;

    canvas.width  = container.clientWidth;
    canvas.height = container.clientHeight;
    const ctx = canvas.getContext('2d')!;

    let drawing = false;
    let points: { x: number; y: number }[] = [];

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (points.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (const p of points) ctx.lineTo(p.x, p.y);
      ctx.strokeStyle = 'rgba(255,220,50,0.95)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,220,50,0.08)';
      ctx.fill();
    };

    const onDown = (e: MouseEvent) => {
      if (paintingRef.current.activeTool !== 'lasso') return;
      drawing = true;
      points = [{ x: e.offsetX, y: e.offsetY }];
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    const onMove = (e: MouseEvent) => {
      if (!drawing || paintingRef.current.activeTool !== 'lasso') return;
      points.push({ x: e.offsetX, y: e.offsetY });
      draw();
    };

    const onUp = () => {
      if (!drawing) return;
      drawing = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const p = paintingRef.current;
      if (points.length < 10 || !p.selectedColorId || !meshRef.current || !cameraRef.current || !model.geometry) return;

      const positions = model.geometry.attributes.position.array as Float32Array;
      const faces = getFacesInLasso(
        points, meshRef.current, cameraRef.current,
        canvas.width, canvas.height, positions
      );

      if (faces.length > 0) {
        console.log(`🔵 Lasso: painting ${faces.length} faces`);
        paintFaces(faces as any, p.selectedColorId);
      }
      points = [];
    };

    canvas.addEventListener('mousedown',  onDown);
    canvas.addEventListener('mousemove',  onMove);
    canvas.addEventListener('mouseup',    onUp);
    canvas.addEventListener('mouseleave', onUp);

    return () => {
      canvas.removeEventListener('mousedown',  onDown);
      canvas.removeEventListener('mousemove',  onMove);
      canvas.removeEventListener('mouseup',    onUp);
      canvas.removeEventListener('mouseleave', onUp);
    };
  }, [model?.geometry]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full bg-gray-900 rounded-lg" />

      {/* Circle cursor overlay */}
      <div
        ref={cursorRef}
        style={{
          position: 'absolute',
          display: 'none',
          borderRadius: '50%',
          pointerEvents: 'none',
          transform: 'translate(-50%, -50%)',
          zIndex: 20,
          transition: 'width 80ms, height 80ms',
        }}
      />

      {/* Lasso 2D drawing canvas — pointer-events active only when lasso tool selected */}
      <canvas
        ref={lassoCanvasRef}
        className="absolute inset-0 w-full h-full rounded-lg"
        style={{
          pointerEvents: painting.activeTool === 'lasso' ? 'auto' : 'none',
          cursor: 'crosshair',
          zIndex: 5,
        }}
      />

      <canvas
        ref={axesCanvasRef}
        className="absolute bottom-4 left-4 border border-gray-600 rounded"
        style={{ width: '120px', height: '120px' }}
      />

      {/* Wireframe toggle button */}
      <button
        onClick={() => setShowWireframe(!showWireframe)}
        title={showWireframe ? 'Ocultar wireframe' : 'Mostrar wireframe das arestas'}
        className={`absolute top-3 right-3 text-xs px-2.5 py-1 rounded-full border transition pointer-events-auto z-10 ${
          showWireframe
            ? 'bg-blue-600 border-blue-500 text-white'
            : 'bg-black/40 border-gray-600 text-gray-300 hover:text-white'
        }`}
      >
        {showWireframe ? '🔲 Wireframe ON' : '⬜ Wireframe'}
      </button>

      {/* Tip overlay */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 text-xs text-gray-400 bg-black/40 px-3 py-1 rounded-full pointer-events-none select-none">
        {painting.activeTool === 'lasso'
          ? 'Segure e arraste para desenhar o laço de seleção'
          : 'Arrastar = orbitar · Clique = pintar · Segurar = pintar arrastando'}
      </div>
    </div>
  );
}
