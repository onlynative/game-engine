import { useEffect, useRef, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { createLoop, type Loop } from './core/loop';
import type { Renderer, System, World } from './core/types';

export interface GameEngineProps {
  readonly world: World;
  readonly systems: ReadonlyArray<System>;
  readonly renderer: Renderer;
  readonly running?: boolean;
  readonly hz?: number;
  readonly children?: ReactNode;
}

export function GameEngine({
  world,
  systems,
  renderer: RendererComponent,
  running = true,
  hz = 60,
  children,
}: GameEngineProps) {
  const systemsRef = useRef(systems);
  systemsRef.current = systems;

  const loopRef = useRef<Loop | null>(null);

  useEffect(() => {
    const loop = createLoop(world, () => systemsRef.current, { hz });
    loopRef.current = loop;
    if (running) loop.start();
    return () => {
      loop.stop();
      loopRef.current = null;
    };
  }, [world, hz]);

  useEffect(() => {
    const loop = loopRef.current;
    if (!loop) return;
    if (running && !loop.isRunning()) loop.start();
    else if (!running && loop.isRunning()) loop.stop();
  }, [running]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    loopRef.current?.setScreen(width, height);
  };

  return (
    <View style={styles.root} onLayout={onLayout}>
      <RendererComponent world={world} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
