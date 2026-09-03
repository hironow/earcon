# @earcon/engine-tone

Tone.js engine for earcon: 14 synthesized presets (sonar, parking sensor, Geiger
counter, heartbeat, countdown, hi-lo siren, red alert; bell, register, coin, knock,
all clear, buzzer, chime), per-monitor buses with pan and volume, and `fromSpec`,
which turns a JSON `SynthSpec` into a sound. `tone` is a peer dependency and is
imported lazily inside `unlock()`.

```ts
import { createToneEngine } from '@earcon/engine-tone'
const engine = createToneEngine({ masterVolumeDb: -6 })
button.onclick = () => engine.unlock()
```

Part of [earcon](https://github.com/hironow/earcon).
