import {
  addComponent,
  createEntity,
  createWorld,
  defineComponent,
  type System,
  type World,
} from '@onlynative/game-engine';
import {
  type MeshComponent,
  type MeshDef,
  type Transform3DComponent,
} from '@onlynative/game-engine/renderers/three';
import * as THREE from 'three';

export interface Scene {
  readonly world: World;
  readonly systems: ReadonlyArray<System>;
  readonly meshes: ReadonlyArray<MeshDef>;
  readonly transform: Transform3DComponent;
  readonly mesh: MeshComponent;
}

export function loadScene(): Scene {
  const world = createWorld({ capacity: 64 });
  const transform = defineComponent(world, {
    x: 'f32',
    y: 'f32',
    z: 'f32',
    rx: 'f32',
    ry: 'f32',
    rz: 'f32',
    sx: 'f32',
    sy: 'f32',
    sz: 'f32',
  });
  const mesh = defineComponent(world, { mesh: 'u32' });

  const meshes: ReadonlyArray<MeshDef> = [
    {
      geometry: new THREE.BoxGeometry(1, 1, 1),
      material: new THREE.MeshNormalMaterial(),
    },
  ];

  const cube = createEntity(world);
  addComponent(world, cube, transform, {
    x: 0,
    y: 0,
    z: 0,
    rx: 0,
    ry: 0,
    rz: 0,
    sx: 1,
    sy: 1,
    sz: 1,
  });
  addComponent(world, cube, mesh, { mesh: 0 });

  const required = transform.bit | mesh.bit;
  const rotationSystem: System = (w, ctx) => {
    const dt = ctx.time.delta;
    const rx = transform.data.rx as Float32Array;
    const ry = transform.data.ry as Float32Array;
    const alive = w.alive;
    const maskArr = w.mask;
    const n = w.nextId;
    for (let i = 0; i < n; i++) {
      if (alive[i] !== 1 || (maskArr[i] & required) !== required) continue;
      rx[i] += 0.6 * dt;
      ry[i] += 0.9 * dt;
    }
  };

  return {
    world,
    systems: [rotationSystem],
    meshes,
    transform,
    mesh,
  };
}
