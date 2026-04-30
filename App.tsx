import { useEffect, useMemo } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { useImageAsTexture } from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { GameEngine } from '@onlynative/game-engine';
import { SkiaRenderer, type SkiaSprite } from '@onlynative/game-engine/renderers/skia';
import { Position, Sprite, physics, spawnDemo, spawnOnTap, world } from './src/game';

const SPRITE_SIZE = 14;

export default function App() {
  const systems = useMemo(() => [spawnOnTap, physics.step], []);
  const ballTex = useImageAsTexture(require('./assets/icon.png'));

  const images = useDerivedValue<ReadonlyArray<SkiaSprite>>(() => [
    { image: ballTex.value, width: SPRITE_SIZE, height: SPRITE_SIZE },
  ]);

  useEffect(() => {
    if (world.nextId === 0) spawnDemo(150, 360, 720);
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
          <GameEngine
            world={world}
            systems={systems}
            renderer={
              <SkiaRenderer
                world={world}
                position={Position}
                sprite={Sprite}
                images={images}
              />
            }
          />
          <StatusBar style="auto" />
        </SafeAreaView>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1, backgroundColor: '#fff' },
});
