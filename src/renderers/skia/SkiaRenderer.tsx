import {
  Canvas,
  Picture,
  Skia,
  createPicture,
  type SkImage,
  type SkPicture,
} from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { useDerivedValue, useSharedValue, type SharedValue } from 'react-native-reanimated';

import { useEngine } from '../../GameEngine';
import type { Component, World } from '../../core/types';

export interface SkiaSprite {
  readonly image: SkImage | null;
  readonly width: number;
  readonly height: number;
}

type PositionComponent = Component<{ x: 'f32'; y: 'f32' }>;
type SpriteComponent = Component<{ atlas: 'u32'; frame: 'u16'; tint: 'u32' }>;

export interface SkiaRendererProps {
  readonly world: World;
  readonly position: PositionComponent;
  readonly sprite: SpriteComponent;
  readonly images: SharedValue<ReadonlyArray<SkiaSprite>>;
}

const BACKGROUND = '#fafafa';
const EMPTY = new Float32Array(0);

export function SkiaRenderer({ world, position, sprite, images }: SkiaRendererProps) {
  const positionBit = position.bit;
  const spriteBit = sprite.bit;
  const required = positionBit | spriteBit;

  const loop = useEngine();
  const packed = useSharedValue<Float32Array>(EMPTY);

  const paint = useMemo(() => {
    const p = Skia.Paint();
    p.setAntiAlias(true);
    return p;
  }, []);

  useEffect(() => {
    return loop.onAfterStep(() => {
      const n = world.nextId;
      const alive = world.alive;
      const mask = world.mask;
      const px = position.data.x as Float32Array;
      const py = position.data.y as Float32Array;
      const atlas = sprite.data.atlas as Uint32Array;

      let count = 0;
      for (let i = 0; i < n; i++) {
        if (alive[i] === 1 && (mask[i] & required) === required) count++;
      }
      const out = new Float32Array(count * 3);
      let j = 0;
      for (let i = 0; i < n; i++) {
        if (alive[i] === 1 && (mask[i] & required) === required) {
          out[j] = px[i];
          out[j + 1] = py[i];
          out[j + 2] = atlas[i];
          j += 3;
        }
      }
      packed.value = out;
    });
  }, [loop, world, packed, position, sprite, required]);

  const picture = useDerivedValue<SkPicture>(() => {
    const arr = packed.value;
    const imgs = images.value;
    return createPicture((canvas) => {
      const len = arr.length;
      for (let k = 0; k < len; k += 3) {
        const idx = arr[k + 2] | 0;
        const slot = imgs[idx];
        if (!slot || !slot.image) continue;
        const img = slot.image;
        const w = slot.width;
        const h = slot.height;
        canvas.drawImageRect(
          img,
          { x: 0, y: 0, width: img.width(), height: img.height() },
          { x: arr[k] - w * 0.5, y: arr[k + 1] - h * 0.5, width: w, height: h },
          paint,
        );
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
