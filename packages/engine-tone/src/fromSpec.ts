import type { ContinuousSound, OneShotSound, SynthSpec } from '@earcon/core'
import type { SoundContext } from './presets'

/** Interprets a declarative `SynthSpec` (Sound Designer output). Lands in M4. */
export function fromSpec(spec: SynthSpec, _ctx: SoundContext): ContinuousSound | OneShotSound {
  throw new Error(`@earcon/engine-tone: SynthSpec (${spec.mode}/${spec.voice}) interpretation is not implemented yet`)
}
