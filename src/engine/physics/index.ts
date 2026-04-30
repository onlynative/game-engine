import type { Component, EntityId, System, World } from '../core';

export type Position2D = Component<{ x: 'f32'; y: 'f32' }>;
export type Velocity2D = Component<{ x: 'f32'; y: 'f32' }>;

export type BodyShape =
  | { readonly kind: 'circle'; readonly radius: number }
  | { readonly kind: 'box'; readonly width: number; readonly height: number };

export interface BodyDef {
  readonly type: 'static' | 'dynamic';
  readonly position: { readonly x: number; readonly y: number };
  readonly velocity?: { readonly x: number; readonly y: number };
  readonly shape: BodyShape;
  readonly mass?: number;
  readonly friction?: number;
  readonly restitution?: number;
}

export interface PhysicsOptions {
  readonly world: World;
  readonly position: Position2D;
  readonly velocity: Velocity2D;
  readonly gravity?: { readonly x: number; readonly y: number };
}

export interface Physics {
  readonly attach: (id: EntityId, def: BodyDef) => void;
  readonly detach: (id: EntityId) => void;
  readonly step: System;
  readonly destroy: () => void;
}

const SHAPE_CIRCLE = 0;
const SHAPE_BOX = 1;
const TYPE_STATIC = 0;
const TYPE_DYNAMIC = 1;

export function createPhysics(opts: PhysicsOptions): Physics {
  const ecsWorld = opts.world;
  const cap = ecsWorld.capacity;
  const posX = opts.position.data.x as Float32Array;
  const posY = opts.position.data.y as Float32Array;
  const velX = opts.velocity.data.x as Float32Array;
  const velY = opts.velocity.data.y as Float32Array;
  const gravityX = opts.gravity?.x ?? 0;
  const gravityY = opts.gravity?.y ?? 600;

  const bodyAlive = new Uint8Array(cap);
  const bodyType = new Uint8Array(cap);
  const bodyShape = new Uint8Array(cap);
  const halfW = new Float32Array(cap);
  const halfH = new Float32Array(cap);
  const invMass = new Float32Array(cap);
  const rest = new Float32Array(cap);
  const fric = new Float32Array(cap);

  const dynamicIds: number[] = [];
  const staticIds: number[] = [];

  function attach(id: EntityId, def: BodyDef): void {
    if (bodyAlive[id]) return;
    bodyAlive[id] = 1;
    bodyType[id] = def.type === 'dynamic' ? TYPE_DYNAMIC : TYPE_STATIC;

    if (def.shape.kind === 'circle') {
      bodyShape[id] = SHAPE_CIRCLE;
      halfW[id] = def.shape.radius;
      halfH[id] = def.shape.radius;
    } else {
      bodyShape[id] = SHAPE_BOX;
      halfW[id] = def.shape.width / 2;
      halfH[id] = def.shape.height / 2;
    }

    if (bodyType[id] === TYPE_DYNAMIC) {
      const m =
        def.mass !== undefined
          ? def.mass
          : def.shape.kind === 'circle'
            ? Math.PI * def.shape.radius * def.shape.radius
            : def.shape.width * def.shape.height;
      invMass[id] = m > 0 ? 1 / m : 0;
    } else {
      invMass[id] = 0;
    }

    rest[id] = def.restitution ?? 0;
    fric[id] = def.friction ?? 0;

    posX[id] = def.position.x;
    posY[id] = def.position.y;
    velX[id] = def.velocity?.x ?? 0;
    velY[id] = def.velocity?.y ?? 0;

    (bodyType[id] === TYPE_DYNAMIC ? dynamicIds : staticIds).push(id);
  }

  function detach(id: EntityId): void {
    if (!bodyAlive[id]) return;
    bodyAlive[id] = 0;
    const arr = bodyType[id] === TYPE_DYNAMIC ? dynamicIds : staticIds;
    const i = arr.indexOf(id);
    if (i >= 0) {
      arr[i] = arr[arr.length - 1];
      arr.length--;
    }
  }

  function reapDead(): void {
    for (let i = dynamicIds.length - 1; i >= 0; i--) {
      const id = dynamicIds[i];
      if (ecsWorld.alive[id] === 0) {
        bodyAlive[id] = 0;
        dynamicIds[i] = dynamicIds[dynamicIds.length - 1];
        dynamicIds.length--;
      }
    }
    for (let i = staticIds.length - 1; i >= 0; i--) {
      const id = staticIds[i];
      if (ecsWorld.alive[id] === 0) {
        bodyAlive[id] = 0;
        staticIds[i] = staticIds[staticIds.length - 1];
        staticIds.length--;
      }
    }
  }

  function resolveContact(a: number, b: number, nx: number, ny: number, overlap: number): void {
    const ima = invMass[a];
    const imb = invMass[b];
    const totalIM = ima + imb;
    if (totalIM === 0) return;

    const sepA = (overlap * ima) / totalIM;
    const sepB = (overlap * imb) / totalIM;
    posX[a] -= nx * sepA;
    posY[a] -= ny * sepA;
    posX[b] += nx * sepB;
    posY[b] += ny * sepB;

    const rvx = velX[b] - velX[a];
    const rvy = velY[b] - velY[a];
    const velN = rvx * nx + rvy * ny;
    if (velN > 0) return;

    const e = rest[a] < rest[b] ? rest[a] : rest[b];
    const j = (-(1 + e) * velN) / totalIM;
    velX[a] -= j * nx * ima;
    velY[a] -= j * ny * ima;
    velX[b] += j * nx * imb;
    velY[b] += j * ny * imb;

    const tx = -ny;
    const ty = nx;
    const velT = rvx * tx + rvy * ty;
    const mu = (fric[a] + fric[b]) * 0.5;
    if (mu === 0) return;
    let jt = -velT / totalIM;
    const maxJt = j * mu;
    if (jt > maxJt) jt = maxJt;
    else if (jt < -maxJt) jt = -maxJt;
    velX[a] -= jt * tx * ima;
    velY[a] -= jt * ty * ima;
    velX[b] += jt * tx * imb;
    velY[b] += jt * ty * imb;
  }

  function collideCircleCircle(a: number, b: number): void {
    const dx = posX[b] - posX[a];
    const dy = posY[b] - posY[a];
    const r = halfW[a] + halfW[b];
    const distSq = dx * dx + dy * dy;
    if (distSq >= r * r || distSq === 0) return;
    const dist = Math.sqrt(distSq);
    resolveContact(a, b, dx / dist, dy / dist, r - dist);
  }

  function collideCircleBox(c: number, box: number): void {
    const cx = posX[c];
    const cy = posY[c];
    const bx = posX[box];
    const by = posY[box];
    const hw = halfW[box];
    const hh = halfH[box];
    const r = halfW[c];

    let qx = cx;
    if (qx < bx - hw) qx = bx - hw;
    else if (qx > bx + hw) qx = bx + hw;
    let qy = cy;
    if (qy < by - hh) qy = by - hh;
    else if (qy > by + hh) qy = by + hh;

    const dx = cx - qx;
    const dy = cy - qy;
    const distSq = dx * dx + dy * dy;
    if (distSq >= r * r) return;

    let nx: number;
    let ny: number;
    let overlap: number;
    if (distSq === 0) {
      const dxb = cx - bx;
      const dyb = cy - by;
      const px = hw - Math.abs(dxb);
      const py = hh - Math.abs(dyb);
      if (px < py) {
        nx = dxb < 0 ? -1 : 1;
        ny = 0;
        overlap = px + r;
      } else {
        nx = 0;
        ny = dyb < 0 ? -1 : 1;
        overlap = py + r;
      }
    } else {
      const dist = Math.sqrt(distSq);
      nx = dx / dist;
      ny = dy / dist;
      overlap = r - dist;
    }
    resolveContact(box, c, nx, ny, overlap);
  }

  function collideBoxBox(a: number, b: number): void {
    const dx = posX[b] - posX[a];
    const px = halfW[a] + halfW[b] - Math.abs(dx);
    if (px <= 0) return;
    const dy = posY[b] - posY[a];
    const py = halfH[a] + halfH[b] - Math.abs(dy);
    if (py <= 0) return;
    let nx: number;
    let ny: number;
    let overlap: number;
    if (px < py) {
      nx = dx < 0 ? -1 : 1;
      ny = 0;
      overlap = px;
    } else {
      nx = 0;
      ny = dy < 0 ? -1 : 1;
      overlap = py;
    }
    resolveContact(a, b, nx, ny, overlap);
  }

  function collide(a: number, b: number): void {
    const sa = bodyShape[a];
    const sb = bodyShape[b];
    if (sa === SHAPE_CIRCLE && sb === SHAPE_CIRCLE) collideCircleCircle(a, b);
    else if (sa === SHAPE_CIRCLE && sb === SHAPE_BOX) collideCircleBox(a, b);
    else if (sa === SHAPE_BOX && sb === SHAPE_CIRCLE) collideCircleBox(b, a);
    else collideBoxBox(a, b);
  }

  const step: System = (_w, ctx) => {
    const dt = ctx.time.delta;
    reapDead();

    const dynN = dynamicIds.length;
    for (let i = 0; i < dynN; i++) {
      const id = dynamicIds[i];
      velX[id] += gravityX * dt;
      velY[id] += gravityY * dt;
      posX[id] += velX[id] * dt;
      posY[id] += velY[id] * dt;
    }

    const stN = staticIds.length;
    for (let i = 0; i < dynN; i++) {
      const a = dynamicIds[i];
      for (let j = 0; j < stN; j++) {
        collide(a, staticIds[j]);
      }
    }

    for (let i = 0; i < dynN; i++) {
      const a = dynamicIds[i];
      for (let j = i + 1; j < dynN; j++) {
        collide(a, dynamicIds[j]);
      }
    }
  };

  return {
    attach,
    detach,
    step,
    destroy() {
      dynamicIds.length = 0;
      staticIds.length = 0;
      bodyAlive.fill(0);
    },
  };
}
