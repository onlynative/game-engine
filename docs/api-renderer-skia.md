# Skia renderer

```ts
import { SkiaRenderer } from '@onlynative/game-engine/renderers/skia';
import type { SkiaRendererProps, SkiaSprite } from '@onlynative/game-engine/renderers/skia';
```

A single `<Canvas>` driven by a Reanimated worklet that iterates a flat snapshot of the world on the UI thread. No React reconciliation per entity, no per-frame `runOnJS` / `runOnUI` calls.

The renderer is the **only** place the engine talks to Skia. It lives behind a subpath import so consumers who use a different renderer never pull `@shopify/react-native-skia` into their bundle.

---

## `<SkiaRenderer>` props

```ts
interface SkiaRendererProps {
  readonly world: World;
  readonly position: Component<{ x: 'f32'; y: 'f32' }>;
  readonly sprite:   Component<{ atlas: 'u32'; frame: 'u16'; tint: 'u32' }>;
  readonly images:   SharedValue<ReadonlyArray<SkiaSprite>>;
}
```

### `world`

The same [`World`](./api-core.md#worlds) you pass to `<GameEngine>`.

### `position`

A component with `{ x: 'f32'; y: 'f32' }`. Each entity's `(x, y)` is the **center** of where the sprite is drawn.

The renderer doesn't care which component you call this — pass any component matching that schema. Most games use the `Position` component their physics step writes into.

### `sprite`

A component with `{ atlas: 'u32'; frame: 'u16'; tint: 'u32' }`:

- **`atlas`** — index into the `images` array. The renderer reads `images.value[atlas]` to find the texture to draw.
- **`frame`** — sprite-sheet frame index. Reserved for atlas slicing; **not yet read** by the renderer.
- **`tint`** — packed RGBA color. Reserved for tinting; **not yet read** by the renderer.

Only entities that have **both** `position` and `sprite` are drawn.

### `images`

A `SharedValue<ReadonlyArray<SkiaSprite>>`. The renderer reads `images.value[sprite.atlas[id]]` per entity inside a worklet.

```ts
interface SkiaSprite {
  readonly image: SkImage | null;
  readonly width: number;          // logical width in px
  readonly height: number;         // logical height in px
}
```

Use `useDerivedValue` to build the array from your loaded textures:

```tsx
const ballAsset  = useAsset(require('./ball.png'));
const ballImg    = useImage(ballAsset.localUri);

const paddleAsset = useAsset(require('./paddle.png'));
const paddleImg   = useImage(paddleAsset.localUri);

const images = useDerivedValue<ReadonlyArray<SkiaSprite>>(() => [
  { image: ballImg,   width: 16, height: 16 },  // atlas index 0
  { image: paddleImg, width: 64, height: 12 },  // atlas index 1
]);
```

Then on each entity, set `Sprite.atlas = 0` for a ball or `1` for a paddle.

> Slots with `image: null` (texture still loading) are silently skipped. The entity stays in the world, just invisible until the texture resolves.

---

## What the renderer draws

For each alive entity matching `position.bit | sprite.bit`:

```
canvas.drawImageRect(
  img,
  { x: 0, y: 0, width: img.width(), height: img.height() }, // src rect (full image)
  {
    x: position.x - sprite.width  * 0.5,
    y: position.y - sprite.height * 0.5,
    width:  sprite.width,
    height: sprite.height,
  },
  paint, // antialiased, no tint
);
```

So:

- **Origin is centered.** `(position.x, position.y)` is the *center* of the drawn sprite.
- **Source rect is the entire image.** Sprite-sheet slicing (`frame` field) is not implemented yet.
- **No rotation, no scale beyond width/height.** Apply scale by changing `SkiaSprite.width` / `height`. Rotation needs a future renderer change (or a different renderer).
- **No tint.** The `tint` field is reserved for when paint masking lands.

---

## How frames flow

1. **Sim step ends.** The engine fires registered `loop.onAfterStep` callbacks once per tick that produced ≥1 step.
2. **Renderer's `onAfterStep` callback runs on the JS thread.** It scans `[0, world.nextId)` and packs every drawable entity into a fresh `Float32Array(count * 3)`:
   ```
   [x0, y0, atlas0, x1, y1, atlas1, ...]
   ```
3. **Assigning `packed.value = out` triggers Reanimated to clone the array to the UI thread.**
4. **The UI-thread `useDerivedValue` worklet wakes up.** It reads `packed.value` and `images.value`, builds an `SkPicture` with one `drawImageRect` per entity.
5. **The `<Picture>` element draws the picture.**

> **Reanimated 4 does not zero-copy TypedArrays** (`react-native-worklets` clones every `ArrayBuffer` / `ArrayBufferView` in `cloneArrayBuffer` / `cloneArrayBufferView`). The renderer pushes a fresh snapshot each frame; assigning a new `SharedValue` reference is what makes Reanimated re-clone.
>
> Cost: `world.nextId * 3 * 4` bytes copied per render frame — at phase-1 entity counts (≤200), this is comfortably negligible.

---

## Performance notes

- **Single `<Canvas>`.** All entities draw into one Skia surface; no React tree per sprite.
- **Snapshot, not iteration over the live world.** The worklet never touches `World` directly — Reanimated would have to clone the entire structure on every assignment.
- **Per-frame allocation: one `Float32Array`.** Replace with a pre-allocated buffer or a circular pair of buffers if profiling says it matters; today it doesn't.
- **`drawImageRect` allocates a `SkRect` per call.** Switch to `drawAtlas` once a sprite atlas lands. Documented as a follow-up in the project's known caveats.

---

## Background color

Hardcoded to `#fafafa` today via the canvas's `backgroundColor` style. Wrap the renderer in your own `<View>` with a different background if you need control over this — the canvas' background draws under everything, so a wrapping view can show through transparency in the canvas content.

---

## Limitations / roadmap

- **Components named in props, not declared by renderer.** The renderer assumes its `position` and `sprite` props match the schemas above. There's no formal "renderer-component-API" yet — designing one is on the roadmap so renderers can declare which components they read.
- **`frame` and `tint` not yet wired.** Both fields are accepted in the schema but ignored at draw time.
- **No rotation, no per-entity scale.** Scale is per-sprite (the `SkiaSprite.width` / `height` you put in the shared array), not per-entity.
- **One canvas, one z-order.** Entities draw in entity-id order. There's no z-sort yet — add a `z: 'i16'` field to the sprite component and sort the snapshot if you need it.
