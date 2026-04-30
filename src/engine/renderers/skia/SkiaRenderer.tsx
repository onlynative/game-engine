import {
  Canvas,
  Picture,
  Skia,
  createPicture,
  type SkPicture,
} from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { useDerivedValue, useSharedValue } from 'react-native-reanimated';

import { useEngine } from '../../GameEngine';
import type { World } from '../../core/types';

export interface SkiaRendererProps {
  readonly world: World;
}

const SPRITE_RADIUS = 3;
const SPRITE_COLOR = '#4ad';
const BACKGROUND = '#fafafa';
const EMPTY = new Float32Array(0);

export function SkiaRenderer({ world }: SkiaRendererProps) {
  const Position = world.components[0];
  if (!Position) {
    throw new Error('SkiaRenderer expects component index 0 to be Position { x: f32, y: f32 }');
  }
  const positionBit = Position.bit;
  const radius = SPRITE_RADIUS;

  const loop = useEngine();
  const packed = useSharedValue<Float32Array>(EMPTY);

  const paint = useMemo(() => {
    const p = Skia.Paint();
    p.setColor(Skia.Color(SPRITE_COLOR));
    p.setAntiAlias(true);
    return p;
  }, []);

  useEffect(() => {
    return loop.onAfterStep(() => {
      const n = world.nextId;
      const alive = world.alive;
      const mask = world.mask;
      const px = Position.data.x as Float32Array;
      const py = Position.data.y as Float32Array;
      const bit = positionBit;

      let count = 0;
      for (let i = 0; i < n; i++) {
        if (alive[i] === 1 && (mask[i] & bit) === bit) count++;
      }
      const out = new Float32Array(count * 2);
      let j = 0;
      for (let i = 0; i < n; i++) {
        if (alive[i] === 1 && (mask[i] & bit) === bit) {
          out[j] = px[i];
          out[j + 1] = py[i];
          j += 2;
        }
      }
      packed.value = out;
    });
  }, [loop, world, packed, Position, positionBit]);

  const picture = useDerivedValue<SkPicture>(() => {
    const arr = packed.value;
    return createPicture((canvas) => {
      const len = arr.length;
      for (let k = 0; k < len; k += 2) {
        canvas.drawCircle(arr[k], arr[k + 1], radius, paint);
      }
    });
  });

  return (
    <Canvas style={styles.canvas}>
      <Picture picture={picture} />
    </Canvas>
  );
}

const styles = StyleSheet.create({
  canvas: { flex: 1, backgroundColor: BACKGROUND },
});
