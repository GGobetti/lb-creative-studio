import * as THREE from 'three';
import { SavedSession, ColorID, ColorGroup, ConnectorPoint } from '@/types/stl-splitter.types';

const STORAGE_KEY = 'splitter_sessions';
const MAX_SESSIONS = 5;

export function saveSessionToLocalStorage(session: SavedSession): void {
  try {
    const sessions = loadSessionsFromLocalStorage();
    const filtered = sessions.filter((s) => s.id !== session.id);
    filtered.push(session);
    const trimmed = filtered.slice(-MAX_SESSIONS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (error) {
    console.error('Failed to save session:', error);
  }
}

export function loadSessionsFromLocalStorage(): SavedSession[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    return JSON.parse(data) as SavedSession[];
  } catch (error) {
    console.error('Failed to load sessions:', error);
    return [];
  }
}

export function deleteSessionFromLocalStorage(sessionId: string): void {
  try {
    const sessions = loadSessionsFromLocalStorage();
    const filtered = sessions.filter((s) => s.id !== sessionId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Failed to delete session:', error);
  }
}

export function serializeColorMap(colorMap: Map<number, string>): string {
  const obj: Record<string, string> = {};
  colorMap.forEach((color, faceIndex) => {
    obj[faceIndex.toString()] = color;
  });
  return btoa(JSON.stringify(obj));
}

export function deserializeColorMap(compressed: string): Map<number, string> {
  try {
    const obj = JSON.parse(atob(compressed)) as Record<string, string>;
    const map = new Map<number, string>();
    Object.entries(obj).forEach(([key, value]) => {
      map.set(parseInt(key, 10), value);
    });
    return map;
  } catch (error) {
    console.error('Failed to deserialize color map:', error);
    return new Map();
  }
}

export function serializeGeometry(geometry: THREE.BufferGeometry): string {
  try {
    const positions = geometry.getAttribute('position');
    if (!positions) return '';

    const array = positions.array as Float32Array;
    const buffer = new ArrayBuffer(array.byteLength);
    new Float32Array(buffer).set(array);

    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  } catch (error) {
    console.error('Failed to serialize geometry:', error);
    return '';
  }
}

export function deserializeGeometry(compressed: string): THREE.BufferGeometry {
  try {
    const binary = atob(compressed);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const array = new Float32Array(bytes.buffer);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(array, 3));
    geometry.computeVertexNormals();
    return geometry;
  } catch (error) {
    console.error('Failed to deserialize geometry:', error);
    return new THREE.BufferGeometry();
  }
}

export function serializeColors(colors: Map<ColorID, ColorGroup>): string {
  try {
    return btoa(JSON.stringify(Array.from(colors.values())));
  } catch (error) {
    console.error('Failed to serialize colors:', error);
    return '';
  }
}

export function deserializeColors(compressed: string): Map<ColorID, ColorGroup> {
  try {
    if (!compressed) return new Map();
    const arr = JSON.parse(atob(compressed)) as ColorGroup[];
    return new Map(arr.map((c) => [c.id, c]));
  } catch (error) {
    console.error('Failed to deserialize colors:', error);
    return new Map();
  }
}

export function serializeConnectors(connectors: ConnectorPoint[]): string {
  try {
    return btoa(JSON.stringify(connectors));
  } catch (error) {
    console.error('Failed to serialize connectors:', error);
    return '';
  }
}

export function deserializeConnectors(compressed: string): ConnectorPoint[] {
  try {
    if (!compressed) return [];
    return JSON.parse(atob(compressed)) as ConnectorPoint[];
  } catch (error) {
    console.error('Failed to deserialize connectors:', error);
    return [];
  }
}
