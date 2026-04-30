import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';
import { runOnJS } from 'react-native-worklets';

import { createLoop, type Loop } from './core/loop';
import type { Renderer, System, TouchEvent, World } from './core/types';

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

  const pushTouch = useCallback((e: TouchEvent) => {
    loopRef.current?.pushTouch(e);
  }, []);

  const prevTx = useSharedValue(0);
  const prevTy = useSharedValue(0);

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .onBegin((e) => {
        'worklet';
        prevTx.value = 0;
        prevTy.value = 0;
        runOnJS(pushTouch)({ id: 0, type: 'start', x: e.x, y: e.y, t: Date.now() });
      })
      .onUpdate((e) => {
        'worklet';
        const dx = e.translationX - prevTx.value;
        const dy = e.translationY - prevTy.value;
        prevTx.value = e.translationX;
        prevTy.value = e.translationY;
        runOnJS(pushTouch)({ id: 0, type: 'move', x: e.x, y: e.y, dx, dy, t: Date.now() });
      })
      .onEnd((e) => {
        'worklet';
        runOnJS(pushTouch)({ id: 0, type: 'end', x: e.x, y: e.y, t: Date.now() });
      });

    const tap = Gesture.Tap().onEnd((e, success) => {
      'worklet';
      if (!success) return;
      runOnJS(pushTouch)({ id: 0, type: 'tap', x: e.x, y: e.y, t: Date.now() });
    });

    const longPress = Gesture.LongPress().onEnd((e, success) => {
      'worklet';
      if (!success) return;
      runOnJS(pushTouch)({ id: 0, type: 'long-press', x: e.x, y: e.y, t: Date.now() });
    });

    return Gesture.Simultaneous(pan, tap, longPress);
  }, [pushTouch, prevTx, prevTy]);

  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.root} onLayout={onLayout} collapsable={false}>
        <RendererComponent world={world} />
        {children}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
