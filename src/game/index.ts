import {
  addComponent,
  createEntity,
  createPhysics,
  createWorld,
  defineComponent,
  type System,
} from '../engine';

export const world = createWorld({ capacity: 1024 });

export const Position = defineComponent(world, { x: 'f32', y: 'f32' });
export const Velocity = defineComponent(world, { x: 'f32', y: 'f32' });
export const Sprite = defineComponent(world, {
  atlas: 'u32',
  frame: 'u16',
  tint: 'u32',
});

export const physics = createPhysics({
  world,
  position: Position,
  velocity: Velocity,
  gravity: { x: 0, y: 600 },
});

const WALL_THICKNESS = 20;
const BALL_RADIUS = 5;

function spawnBall(x: number, y: number, vx = 0, vy = 0): void {
  const id = createEntity(world);
  addComponent(world, id, Sprite, { atlas: 0, frame: 0, tint: 0xffffffff });
  physics.attach(id, {
    type: 'dynamic',
    position: { x, y },
    velocity: { x: vx, y: vy },
    shape: { kind: 'circle', radius: BALL_RADIUS },
    restitution: 0.4,
    friction: 0.2,
  });
}

function spawnWall(cx: number, cy: number, w: number, h: number): void {
  const id = createEntity(world);
  physics.attach(id, {
    type: 'static',
    position: { x: cx, y: cy },
    shape: { kind: 'box', width: w, height: h },
    friction: 0.3,
  });
}

export function spawnDemo(count = 40, screenW = 360, screenH = 720): void {
  spawnWall(screenW / 2, screenH, screenW, WALL_THICKNESS);
  spawnWall(0, screenH / 2, WALL_THICKNESS, screenH);
  spawnWall(screenW, screenH / 2, WALL_THICKNESS, screenH);

  for (let i = 0; i < count; i++) {
    const x = Math.random() * (screenW - 40) + 20;
    const y = Math.random() * 200 + 40;
    spawnBall(x, y);
  }
}

export const spawnOnTap: System = (_w, ctx) => {
  for (let i = 0; i < ctx.input.touches.length; i++) {
    const t = ctx.input.touches[i];
    if (t.type !== 'tap') continue;
    for (let n = 0; n < 8; n++) {
      const angle = (Math.PI * 2 * n) / 8;
      const speed = 80 + Math.random() * 60;
      spawnBall(t.x, t.y, Math.cos(angle) * speed, Math.sin(angle) * speed);
    }
  }
};
