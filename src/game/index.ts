import {
  addComponent,
  createEntity,
  createWorld,
  defineComponent,
  query,
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

export function spawnDemo(count = 100, screenW = 400, screenH = 800): void {
  for (let i = 0; i < count; i++) {
    const id = createEntity(world);
    addComponent(world, id, Position, {
      x: Math.random() * screenW,
      y: Math.random() * screenH,
    });
    addComponent(world, id, Velocity, {
      x: (Math.random() - 0.5) * 60,
      y: (Math.random() - 0.5) * 60,
    });
    addComponent(world, id, Sprite, { atlas: 0, frame: 0, tint: 0xffffffff });
  }
}

export const movement: System = (w, ctx) => {
  const dt = ctx.time.delta;
  query(w, Position, Velocity).each((id) => {
    Position.data.x[id] += Velocity.data.x[id] * dt;
    Position.data.y[id] += Velocity.data.y[id] * dt;
  });
};
