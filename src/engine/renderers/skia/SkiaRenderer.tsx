import { Canvas, Group, Rect, Text, matchFont } from '@shopify/react-native-skia';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import type { World } from '../../core/types';

export interface SkiaRendererProps {
  readonly world: World;
}

const SAMPLE_LIMIT = 200;
const SAMPLE_HZ = 30;

const fontFamily = Platform.select({ ios: 'Helvetica', default: 'sans-serif' });
const font = matchFont({ fontFamily, fontSize: 14 });

export function SkiaRenderer({ world }: SkiaRendererProps) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000 / SAMPLE_HZ);
    return () => clearInterval(id);
  }, []);

  const positions = readPositions(world, SAMPLE_LIMIT);

  return (
    <View style={styles.root}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Group>
          {positions.map(({ id, x, y }) => (
            <Rect key={id} x={x} y={y} width={6} height={6} color="#4ad" />
          ))}
        </Group>
        <Text x={12} y={24} text={`tick ${tick} · drawing ${positions.length} entities`} font={font} color="#222" />
      </Canvas>
    </View>
  );
}

function readPositions(world: World, limit: number): Array<{ id: number; x: number; y: number }> {
  const Position = world.components[0];
  if (!Position) return [];
  const x = Position.data.x as Float32Array | undefined;
  const y = Position.data.y as Float32Array | undefined;
  if (!x || !y) return [];
  const out: Array<{ id: number; x: number; y: number }> = [];
  const max = Math.min(world.nextId, limit);
  for (let i = 0; i < max; i++) {
    if (world.alive[i] === 1 && (world.mask[i] & Position.bit) === Position.bit) {
      out.push({ id: i, x: x[i], y: y[i] });
    }
  }
  return out;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fafafa' },
});
