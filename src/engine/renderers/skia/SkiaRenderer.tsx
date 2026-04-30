import {
  Canvas,
  Picture,
  Skia,
   createPicture,
  type SkPicture,
} from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import {
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
} from 'react-native-reanimated';

import type { World } from '../../core/types';

export interface SkiaRendererProps {
  readonly world: World;
}

const SPRITE_SIZE = 6;
const SPRITE_COLOR = '#4ad';
const BACKGROUND = '#fafafa';

export function SkiaRenderer({ world }: SkiaRendererProps) {
  const Position = world.components[0];
  if (!Position) {
    throw new Error('SkiaRenderer expects component index 0 to be Position { x: f32, y: f32 }');
  }

  const posX = useSharedValue(Position.data.x as Float32Array);
  const posY = useSharedValue(Position.data.y as Float32Array);
  const alive = useSharedValue(world.alive);
  const mask = useSharedValue(world.mask);
  const capacity = world.capacity;
  const positionBit = Position.bit;
  const size = SPRITE_SIZE;

  const paint = useMemo(() => {
    const p = Skia.Paint();
    p.setColor(Skia.Color(SPRITE_COLOR));
    return p;
  }, []);

  const renderTick = useSharedValue(0);
  useFrameCallback(() => {
    renderTick.value = renderTick.value + 1;
  });

  const picture = useDerivedValue<SkPicture>(() => {
    renderTick.value;
    const x = posX.value;
    const y = posY.value;
    const a = alive.value;
    const m = mask.value;

    return createPicture((canvas) => {
      for (let id = 0; id < capacity; id++) {
        if (a[id] === 1 && (m[id] & positionBit) === positionBit) {
          canvas.drawRect(Skia.XYWHRect(x[id], y[id], size, size), paint);
        }
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
