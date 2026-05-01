import {
  addComponent,
  createEntity,
  createPhysics,
  createWorld,
  defineComponent,
  destroyEntity,
} from '@onlynative/game-engine';

export const world = createWorld({ capacity: 1024 });

export const Position = defineComponent(world, { x: 'f32', y: 'f32' });
export const Velocity = defineComponent(world, { x: 'f32', y: 'f32' });
export const Sprite = defineComponent(world, {
  atlas: 'u32',
  frame: 'u16',
  tint: 'u32',
});
export const Brick = defineComponent(world, { _: 'u8' });
export const Paddle = defineComponent(world, { _: 'u8' });
export const Ball = defineComponent(world, { _: 'u8' });

export const physics = createPhysics({
  world,
  position: Position,
  velocity: Velocity,
  gravity: { x: 0, y: 0 },
});

export const ATLAS_BALL = 0;
export const ATLAS_PADDLE = 1;
export const ATLAS_BRICK = 2;

export const BALL_RADIUS = 8;
export const PADDLE_WIDTH = 88;
export const PADDLE_HEIGHT = 14;
export const BRICK_W = 40;
export const BRICK_H = 16;
export const BRICK_GAP = 4;
export const BRICK_ROWS = 5;
export const BRICK_COLS = 7;
export const BRICK_TOP = 80;
export const PADDLE_BOTTOM_OFFSET = 60;
export const BALL_SPEED = 320;

const WALL = 40;

export const refs: {
  paddleId: number;
  ballId: number;
  screenW: number;
  screenH: number;
} = { paddleId: -1, ballId: -1, screenW: 0, screenH: 0 };

export function clearLevel(): void {
  for (let id = 0; id < world.nextId; id++) {
    if (world.alive[id] === 1) destroyEntity(world, id);
  }
  refs.paddleId = -1;
  refs.ballId = -1;
}

function spawnWall(cx: number, cy: number, w: number, h: number): void {
  const id = createEntity(world);
  physics.attach(id, {
    type: 'static',
    position: { x: cx, y: cy },
    shape: { kind: 'box', width: w, height: h },
    restitution: 1,
    friction: 0,
  });
}

function spawnPaddle(screenW: number, screenH: number): number {
  const id = createEntity(world);
  physics.attach(id, {
    type: 'static',
    position: { x: screenW / 2, y: screenH - PADDLE_BOTTOM_OFFSET },
    shape: { kind: 'box', width: PADDLE_WIDTH, height: PADDLE_HEIGHT },
    restitution: 1,
    friction: 0.4,
  });
  addComponent(world, id, Sprite, { atlas: ATLAS_PADDLE, frame: 0, tint: 0 });
  addComponent(world, id, Paddle, { _: 1 });
  return id;
}

function spawnBall(screenW: number, screenH: number): number {
  const id = createEntity(world);
  const angle = (-Math.PI / 2) + (Math.random() - 0.5) * (Math.PI / 3);
  physics.attach(id, {
    type: 'dynamic',
    position: { x: screenW / 2, y: screenH - PADDLE_BOTTOM_OFFSET - 40 },
    velocity: { x: Math.cos(angle) * BALL_SPEED, y: Math.sin(angle) * BALL_SPEED },
    shape: { kind: 'circle', radius: BALL_RADIUS },
    restitution: 1,
    friction: 0,
    mass: 1,
  });
  addComponent(world, id, Sprite, { atlas: ATLAS_BALL, frame: 0, tint: 0 });
  addComponent(world, id, Ball, { _: 1 });
  return id;
}

function spawnBricks(screenW: number): number {
  const totalW = BRICK_COLS * BRICK_W + (BRICK_COLS - 1) * BRICK_GAP;
  const startX = (screenW - totalW) / 2 + BRICK_W / 2;
  let count = 0;
  for (let r = 0; r < BRICK_ROWS; r++) {
    for (let c = 0; c < BRICK_COLS; c++) {
      const id = createEntity(world);
      const x = startX + c * (BRICK_W + BRICK_GAP);
      const y = BRICK_TOP + r * (BRICK_H + BRICK_GAP) + BRICK_H / 2;
      physics.attach(id, {
        type: 'static',
        position: { x, y },
        shape: { kind: 'box', width: BRICK_W, height: BRICK_H },
        restitution: 1,
        friction: 0,
      });
      addComponent(world, id, Sprite, { atlas: ATLAS_BRICK, frame: r, tint: 0 });
      addComponent(world, id, Brick, { _: 1 });
      count++;
    }
  }
  return count;
}

export interface LevelInfo {
  readonly bricksLeft: number;
  readonly paddleId: number;
  readonly ballId: number;
}

export function buildLevel(screenW: number, screenH: number): LevelInfo {
  clearLevel();
  refs.screenW = screenW;
  refs.screenH = screenH;

  spawnWall(screenW / 2, -WALL / 2, screenW + WALL * 2, WALL);
  spawnWall(-WALL / 2, screenH / 2, WALL, screenH * 2);
  spawnWall(screenW + WALL / 2, screenH / 2, WALL, screenH * 2);

  const paddleId = spawnPaddle(screenW, screenH);
  const ballId = spawnBall(screenW, screenH);
  const bricksLeft = spawnBricks(screenW);

  refs.paddleId = paddleId;
  refs.ballId = ballId;

  return { bricksLeft, paddleId, ballId };
}

export function resetBall(): void {
  if (refs.ballId < 0 || refs.paddleId < 0) return;
  const px = Position.data.x[refs.paddleId];
  const py = Position.data.y[refs.paddleId];
  Position.data.x[refs.ballId] = px;
  Position.data.y[refs.ballId] = py - 40;
  const angle = (-Math.PI / 2) + (Math.random() - 0.5) * (Math.PI / 3);
  Velocity.data.x[refs.ballId] = Math.cos(angle) * BALL_SPEED;
  Velocity.data.y[refs.ballId] = Math.sin(angle) * BALL_SPEED;
}
