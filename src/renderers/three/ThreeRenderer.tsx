import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
// Deep-import to avoid pulling in expo-three's index barrel, which re-exports
// loaders from `three/examples/jsm/loaders/<Name>` (extensionless). Modern
// three.js's `exports` field rejects those paths, and Metro logs a warning per
// loader. We only need `Renderer`, so bypass the barrel.
import Renderer from 'expo-three/build/Renderer';
import { useCallback, useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import * as THREE from 'three';

import type { Component, EntityId, World } from '../../core/types';

export type Transform3DComponent = Component<{
  x: 'f32';
  y: 'f32';
  z: 'f32';
  rx: 'f32';
  ry: 'f32';
  rz: 'f32';
  sx: 'f32';
  sy: 'f32';
  sz: 'f32';
}>;

export type MeshComponent = Component<{ mesh: 'u32' }>;

export interface MeshDef {
  readonly geometry: THREE.BufferGeometry;
  readonly material: THREE.Material | THREE.Material[];
}

export interface ThreeRendererProps {
  readonly world: World;
  readonly transform: Transform3DComponent;
  readonly mesh: MeshComponent;
  readonly meshes: ReadonlyArray<MeshDef>;
  readonly setupScene?: (scene: THREE.Scene, camera: THREE.PerspectiveCamera) => void;
  readonly clearColor?: number | string;
}

interface LiveMesh {
  obj: THREE.Mesh;
  meshIdx: number;
}

export function ThreeRenderer(props: ThreeRendererProps) {
  // Capture the latest props in a ref so the GL callback (which only fires
  // once on context creation) sees current values without re-running.
  const propsRef = useRef(props);
  propsRef.current = props;

  const cleanupRef = useRef<(() => void) | null>(null);

  const onContextCreate = useCallback((gl: ExpoWebGLRenderingContext) => {
    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;
    const initial = propsRef.current;
    const clearColor = initial.clearColor ?? 0x000000;

    const renderer = new Renderer({ gl, width, height });
    renderer.setClearColor(new THREE.Color(clearColor as THREE.ColorRepresentation));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);
    initial.setupScene?.(scene, camera);

    const live = new Map<EntityId, LiveMesh>();
    let rafId = 0;
    let stopped = false;

    const tick = () => {
      if (stopped) return;
      rafId = requestAnimationFrame(tick);

      const p = propsRef.current;
      const w = p.world;
      const t = p.transform;
      const m = p.mesh;
      const mList = p.meshes;
      const required = t.bit | m.bit;
      const n = w.nextId;
      const alive = w.alive;
      const maskArr = w.mask;
      const tx = t.data.x as Float32Array;
      const ty = t.data.y as Float32Array;
      const tz = t.data.z as Float32Array;
      const rx = t.data.rx as Float32Array;
      const ry = t.data.ry as Float32Array;
      const rz = t.data.rz as Float32Array;
      const sx = t.data.sx as Float32Array;
      const sy = t.data.sy as Float32Array;
      const sz = t.data.sz as Float32Array;
      const meshIdx = m.data.mesh as Uint32Array;

      for (let i = 0; i < n; i++) {
        if (alive[i] !== 1 || (maskArr[i] & required) !== required) continue;
        const idx = meshIdx[i];
        const def = mList[idx];
        let entry = live.get(i);
        if (!def) {
          if (entry) {
            scene.remove(entry.obj);
            live.delete(i);
          }
          continue;
        }
        if (!entry) {
          const obj = new THREE.Mesh(def.geometry, def.material);
          scene.add(obj);
          entry = { obj, meshIdx: idx };
          live.set(i, entry);
        } else if (entry.meshIdx !== idx) {
          entry.obj.geometry = def.geometry;
          entry.obj.material = def.material;
          entry.meshIdx = idx;
        }
        entry.obj.position.set(tx[i], ty[i], tz[i]);
        entry.obj.rotation.set(rx[i], ry[i], rz[i]);
        entry.obj.scale.set(sx[i], sy[i], sz[i]);
      }

      // Sweep entries whose entity is no longer eligible. Iterating Map keys
      // while deleting is safe in JS.
      live.forEach((entry, id) => {
        if (alive[id] !== 1 || (maskArr[id] & required) !== required) {
          scene.remove(entry.obj);
          live.delete(id);
        }
      });

      renderer.render(scene, camera);
      gl.endFrameEXP();
    };

    rafId = requestAnimationFrame(tick);

    cleanupRef.current = () => {
      stopped = true;
      if (rafId !== 0) cancelAnimationFrame(rafId);
      live.forEach(({ obj }) => scene.remove(obj));
      live.clear();
      renderer.dispose();
    };
  }, []);

  useEffect(() => {
    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, []);

  return <GLView style={styles.canvas} onContextCreate={onContextCreate} />;
}

const styles = StyleSheet.create({
  canvas: { flex: 1 },
});
