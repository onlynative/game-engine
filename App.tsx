import { useEffect, useMemo } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { GameEngine } from './src/engine';
import { SkiaRenderer } from './src/engine/renderers/skia';
import { movement, spawnDemo, spawnOnTap, world } from './src/game';

export default function App() {
  const systems = useMemo(() => [spawnOnTap, movement], []);

  useEffect(() => {
    if (world.nextId === 0) spawnDemo(150, 360, 720);
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
          <GameEngine world={world} systems={systems} renderer={SkiaRenderer} />
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
