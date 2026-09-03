import { createToneEngine } from '@earcon/engine-tone'

/** One engine for the whole demo (spec §7.1: every section shares it). */
export const engine = createToneEngine({ lookAhead: 0.3, masterVolumeDb: -6 })
