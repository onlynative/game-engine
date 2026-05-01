import { useEffect, useMemo } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { Skia, type SkImage } from '@shopify/react-native-skia';
import { useSharedValue } from 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { GameEngine } from '@onlynative/game-engine';
import { SkiaRenderer, type SkiaSprite } from '@onlynative/game-engine/renderers/skia';

import { HUD } from './src/HUD';
import {
  BALL_RADIUS,
  BRICK_H,
  BRICK_W,
  PADDLE_HEIGHT,
  PADDLE_WIDTH,
  Position,
  Sprite,
  physics,
  world,
} from './src/game';
import {
  ballBounds,
  ballBrickCollision,
  ballSpeedClamp,
  inputHandler,
  paddleControl,
} from './src/game/systems';

const BRICK_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6'];

function makeCircleTexture(radius: number, color: string): SkImage | null {
  const size = radius * 2;
  const surface = Skia.Surface.Make(size, size);
  if (!surface) return null;
  const canvas = surface.getCanvas();
  const paint = Skia.Paint();
  paint.setColor(Skia.Color(color));
  paint.setAntiAlias(true);
  canvas.drawCircle(radius, radius, radius - 0.5, paint);
  return surface.makeImageSnapshot();
}

function makeRoundedRectTexture(
  width: number,
  height: number,
  color: string,
  radius = 4,
): SkImage | null {
  const surface = Skia.Surface.Make(width, height);
  if (!surface) return null;
  const canvas = surface.getCanvas();
  const paint = Skia.Paint();
  paint.setColor(Skia.Color(color));
  paint.setAntiAlias(true);
  const rrect = Skia.RRectXY(Skia.XYWHRect(0, 0, width, height), radius, radius);
  canvas.drawRRect(rrect, paint);
  return surface.makeImageSnapshot();
}

function buildSprites(): ReadonlyArray<SkiaSprite> {
  const ball = makeCircleTexture(BALL_RADIUS, '#111827');
  const paddle = makeRoundedRectTexture(PADDLE_WIDTH, PADDLE_HEIGHT, '#1f2937', 6);
  const bricks = BRICK_COLORS.map((c) => makeRoundedRectTexture(BRICK_W, BRICK_H, c, 3));
  return [
    { image: ball, width: BALL_RADIUS * 2, height: BALL_RADIUS * 2 },
    { image: paddle, width: PADDLE_WIDTH, height: PADDLE_HEIGHT },
    ...bricks.map((img) => ({ image: img, width: BRICK_W, height: BRICK_H })),
  ];
}

export default function App() {
  const systems = useMemo(
    () => [inputHandler, paddleControl, physics.step, ballSpeedClamp, ballBrickCollision, ballBounds],
    [],
  );

  const images = useSharedValue<ReadonlyArray<SkiaSprite>>([]);

  useEffect(() => {
    images.value = buildSprites();
  }, [images]);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
          <GameEngine
            world={world}
            systems={systems}
            renderer={
              <SkiaRenderer world={world} position={Position} sprite={Sprite} images={images} />
            }
          >
            <HUD />
          </GameEngine>
          <StatusBar style="auto" />
        </SafeAreaView>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1, backgroundColor: '#fafafa' },
});
