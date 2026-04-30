import type {
  FrameContext,
  GameEvent,
  Pointer,
  System,
  TouchEvent,
  World,
} from './types';

export interface LoopOptions {
  readonly hz?: number;
  readonly maxCatchUpMs?: number;
}

export interface Loop {
  readonly start: () => void;
  readonly stop: () => void;
  readonly isRunning: () => boolean;
  readonly setScreen: (width: number, height: number) => void;
  readonly dispatch: (e: GameEvent) => void;
}

const now = (): number =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();

export function createLoop(
  world: World,
  getSystems: () => ReadonlyArray<System>,
  opts: LoopOptions = {},
): Loop {
  const hz = opts.hz ?? 60;
  const stepMs = 1000 / hz;
  const stepS = 1 / hz;
  const maxCatchUpMs = opts.maxCatchUpMs ?? 250;

  const ctx = {
    time: { current: 0, previous: 0, delta: stepS, alpha: 1 },
    input: { touches: [] as TouchEvent[], pointers: [] as Pointer[] },
    screen: { width: 0, height: 0 },
    events: [] as GameEvent[],
    dispatch(e: GameEvent) {
      ctx.events.push(e);
    },
  };
  const externalCtx: FrameContext = ctx;

  let running = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastWall = 0;
  let acc = 0;

  const step = (): void => {
    ctx.time.previous = ctx.time.current;
    ctx.time.current += stepS;
    ctx.events.length = 0;
    const systems = getSystems();
    for (let i = 0; i < systems.length; i++) {
      systems[i](world, externalCtx);
    }
  };

  const tick = (): void => {
    if (!running) return;
    const wall = now();
    let delta = wall - lastWall;
    lastWall = wall;
    if (delta > maxCatchUpMs) delta = stepMs;
    acc += delta;
    while (acc >= stepMs) {
      step();
      acc -= stepMs;
    }
    if (running) {
      timeoutId = setTimeout(tick, Math.max(0, stepMs - acc));
    }
  };

  return {
    start(): void {
      if (running) return;
      running = true;
      lastWall = now();
      acc = 0;
      tick();
    },
    stop(): void {
      running = false;
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    },
    isRunning: () => running,
    setScreen(width, height): void {
      ctx.screen.width = width;
      ctx.screen.height = height;
    },
    dispatch(e): void {
      ctx.events.push(e);
    },
  };
}
