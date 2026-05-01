import { GameEngine } from '@onlynative/game-engine';
import { ThreeRenderer } from '@onlynative/game-engine/renderers/three';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { loadScene } from './src/scene';

export default function App() {
  const scene = useMemo(() => loadScene(), []);
  const renderer = (
    <ThreeRenderer
      world={scene.world}
      transform={scene.transform}
      mesh={scene.mesh}
      meshes={scene.meshes}
      clearColor={0x111111}
    />
  );
  return (
    <GestureHandlerRootView style={styles.root}>
      <View style={styles.root}>
        <GameEngine world={scene.world} systems={scene.systems} renderer={renderer} />
      </View>
      <StatusBar style="light" />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
});
