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

export interface SkiaFrame {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface SkiaAtlas {
  readonly image: SkImage | null;
  readonly frames: ReadonlyArray<SkiaFrame>;
}

type PositionComponent = Component<{ x: 'f32'; y: 'f32' }>;
type SpriteComponent = Component<{ atlas: 'u32'; frame: 'u16'; tint: 'u32' }>;

export interface SkiaRendererProps {
  readonly world: World;
  readonly position: PositionComponent;
  readonly sprite: SpriteComponent;
  readonly atlases: SharedValue<ReadonlyArray<SkiaAtlas>>;
}

const BACKGROUND = '#fafafa';
const EMPTY = new Float32Array(0);
const STRIDE = 4;

export function SkiaRenderer({ world, position, sprite, atlases }: SkiaRendererProps) {
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
      const frame = sprite.data.frame as Uint16Array;

      let count = 0;
      for (let i = 0; i < n; i++) {
        if (alive[i] === 1 && (mask[i] & required) === required) count++;
      }
      const out = new Float32Array(count * STRIDE);
      let j = 0;
      for (let i = 0; i < n; i++) {
        if (alive[i] === 1 && (mask[i] & required) === required) {
          out[j] = px[i];
          out[j + 1] = py[i];
          out[j + 2] = atlas[i];
          out[j + 3] = frame[i];
          j += STRIDE;
        }
      }
      packed.value = out;
    });
  }, [loop, world, packed, position, sprite, required]);

  const picture = useDerivedValue<SkPicture>(() => {
    const arr = packed.value;
    const list = atlases.value;
    return createPicture((canvas) => {
      const len = arr.length;
      for (let k = 0; k < len; k += STRIDE) {
        const a = list[arr[k + 2] | 0];
        if (!a || !a.image) continue;
        const f = a.frames[arr[k + 3] | 0];
        if (!f) continue;
        canvas.drawImageRect(
          a.image,
          { x: f.x, y: f.y, width: f.width, height: f.height },
          { x: arr[k] - f.width * 0.5, y: arr[k + 1] - f.height * 0.5, width: f.width, height: f.height },
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
