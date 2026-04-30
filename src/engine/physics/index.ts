import { BoxShape, CircleShape, Vec2, World as PlanckWorld, type Body } from 'planck';

import type { Component, EntityId, System, World } from '../core';

export type Position2D = Component<{ x: 'f32'; y: 'f32' }>;
export type Velocity2D = Component<{ x: 'f32'; y: 'f32' }>;

export type BodyShape =
  | { readonly kind: 'circle'; readonly radius: number }
  | { readonly kind: 'box'; readonly width: number; readonly height: number };

export interface BodyDef {
  readonly type: 'static' | 'dynamic' | 'kinematic';
  readonly position: { readonly x: number; readonly y: number };
  readonly velocity?: { readonly x: number; readonly y: number };
  readonly angle?: number;
  readonly shape: BodyShape;
  readonly density?: number;
  readonly friction?: number;
  readonly restitution?: number;
  readonly fixedRotation?: boolean;
}

export interface PhysicsOptions {
  readonly world: World;
  readonly position: Position2D;
  readonly velocity?: Velocity2D;
  readonly gravity?: { readonly x: number; readonly y: number };
  readonly pixelsPerMeter?: number;
  readonly velocityIterations?: number;
  readonly positionIterations?: number;
}

export interface Physics {
  readonly attach: (id: EntityId, def: BodyDef) => void;
  readonly detach: (id: EntityId) => void;
  readonly step: System;
  readonly destroy: () => void;
  readonly getBody: (id: EntityId) => Body | undefined;
}

export function createPhysics(opts: PhysicsOptions): Physics {
  const ecsWorld = opts.world;
  const ppm = opts.pixelsPerMeter ?? 30;
  const gravity = opts.gravity ?? { x: 0, y: 9.8 };
  const velIters = opts.velocityIterations ?? 8;
  const posIters = opts.positionIterations ?? 3;

  const pworld = PlanckWorld(Vec2(gravity.x, gravity.y));
  const bodies = new Map<EntityId, Body>();

  const px = opts.position.data.x;
  const py = opts.position.data.y;
  const vx = opts.velocity?.data.x;
  const vy = opts.velocity?.data.y;

  return {
    attach(id, def) {
      const body = pworld.createBody({
        type: def.type,
        position: Vec2(def.position.x / ppm, def.position.y / ppm),
        linearVelocity: def.velocity
          ? Vec2(def.velocity.x / ppm, def.velocity.y / ppm)
          : Vec2(0, 0),
        angle: def.angle ?? 0,
        fixedRotation: def.fixedRotation ?? false,
      });
      const shape =
        def.shape.kind === 'circle'
          ? CircleShape(def.shape.radius / ppm)
          : BoxShape(def.shape.width / ppm / 2, def.shape.height / ppm / 2);
      body.createFixture(shape, {
        density: def.density ?? 1,
        friction: def.friction ?? 0.3,
        restitution: def.restitution ?? 0,
      });
      bodies.set(id, body);
    },

    detach(id) {
      const body = bodies.get(id);
      if (body) {
        pworld.destroyBody(body);
        bodies.delete(id);
      }
    },

    step(_w, ctx) {
      pworld.step(ctx.time.delta, velIters, posIters);
      for (const [id, body] of bodies) {
        if (ecsWorld.alive[id] === 0) {
          pworld.destroyBody(body);
          bodies.delete(id);
          continue;
        }
        const pos = body.getPosition();
        px[id] = pos.x * ppm;
        py[id] = pos.y * ppm;
        if (vx && vy) {
          const vel = body.getLinearVelocity();
          vx[id] = vel.x * ppm;
          vy[id] = vel.y * ppm;
        }
      }
    },

    destroy() {
      bodies.clear();
    },

    getBody(id) {
      return bodies.get(id);
    },
  };
}
