/**
 * Minimal in-memory stand-in for the `tone` module, for `bun test`.
 * Every node records what was done to it in `calls`; signals hold values.
 * Only the surface used by presets/engine/fromSpec is implemented.
 */

export interface Call {
  node: string
  method: string
  args: unknown[]
}

export class FakeSignal {
  calls: Call[] = []
  constructor(
    public value: number,
    private owner: string,
    private name: string,
  ) {}
  rampTo(v: number, t?: number) {
    this.calls.push({ node: this.owner, method: `${this.name}.rampTo`, args: [v, t] })
    this.value = v
  }
  setValueAtTime(v: number, t: number) {
    this.calls.push({ node: this.owner, method: `${this.name}.setValueAtTime`, args: [v, t] })
    this.value = v
  }
  linearRampTo(v: number, t?: number) {
    this.calls.push({ node: this.owner, method: `${this.name}.linearRampTo`, args: [v, t] })
    this.value = v
  }
  exponentialRampToValueAtTime(v: number, t: number) {
    this.calls.push({ node: this.owner, method: `${this.name}.exponentialRampToValueAtTime`, args: [v, t] })
    this.value = v
  }
  linearRampToValueAtTime(v: number, t: number) {
    this.calls.push({ node: this.owner, method: `${this.name}.linearRampToValueAtTime`, args: [v, t] })
    this.value = v
  }
  cancelScheduledValues(t: number) {
    this.calls.push({ node: this.owner, method: `${this.name}.cancelScheduledValues`, args: [t] })
  }
}

export class FakeNode {
  static live = new Set<FakeNode>()
  static all: FakeNode[] = []
  calls: Call[] = []
  connections: FakeNode[] = []
  disposed = false
  state: 'started' | 'stopped' = 'stopped'
  volume: FakeSignal
  frequency: FakeSignal
  gain: FakeSignal
  pan: FakeSignal
  detune: FakeSignal
  depth: FakeSignal
  amplitude: FakeSignal
  modulationIndex: FakeSignal
  kind: string
  options: unknown
  constructor(kind: string, options?: unknown) {
    this.kind = kind
    this.options = options
    this.volume = new FakeSignal(0, kind, 'volume')
    this.frequency = new FakeSignal(0, kind, 'frequency')
    this.gain = new FakeSignal(1, kind, 'gain')
    this.pan = new FakeSignal(0, kind, 'pan')
    this.detune = new FakeSignal(0, kind, 'detune')
    this.depth = new FakeSignal(0, kind, 'depth')
    this.amplitude = new FakeSignal(1, kind, 'amplitude')
    this.modulationIndex = new FakeSignal(1, kind, 'modulationIndex')
    FakeNode.live.add(this)
    FakeNode.all.push(this)
  }
  connect(dest: FakeNode) {
    this.connections.push(dest)
    this.calls.push({ node: this.kind, method: 'connect', args: [dest.kind] })
    return this
  }
  toDestination() {
    return this
  }
  start(...args: unknown[]) {
    this.state = 'started'
    this.calls.push({ node: this.kind, method: 'start', args })
    return this
  }
  stop(...args: unknown[]) {
    this.state = 'stopped'
    this.calls.push({ node: this.kind, method: 'stop', args })
    return this
  }
  triggerAttackRelease(...args: unknown[]) {
    this.calls.push({ node: this.kind, method: 'triggerAttackRelease', args })
    return this
  }
  triggerAttack(...args: unknown[]) {
    this.calls.push({ node: this.kind, method: 'triggerAttack', args })
    return this
  }
  triggerRelease(...args: unknown[]) {
    this.calls.push({ node: this.kind, method: 'triggerRelease', args })
    return this
  }
  dispose() {
    this.disposed = true
    FakeNode.live.delete(this)
    this.calls.push({ node: this.kind, method: 'dispose', args: [] })
    return this
  }
  static reset() {
    FakeNode.live.clear()
    FakeNode.all = []
  }
}

/** Clock with a controllable tick: `fire(time)` invokes the callback. */
export class FakeClock extends FakeNode {
  static instances: FakeClock[] = []
  callback: (time: number) => void
  constructor(callback: (time: number) => void, frequency: number) {
    super('Clock', { frequency })
    this.callback = callback
    this.frequency.value = frequency
    FakeClock.instances.push(this)
  }
  fire(time = 0) {
    this.callback(time)
  }
}

export class FakeLFO extends FakeNode {
  min = 0
  max = 1
  constructor(options?: { frequency?: number; min?: number; max?: number; type?: string }) {
    super('LFO', options)
    this.frequency.value = options?.frequency ?? 1
    this.min = options?.min ?? 0
    this.max = options?.max ?? 1
  }
}

const nodeClass = (kind: string) =>
  class extends FakeNode {
    constructor(options?: unknown) {
      super(kind, options)
    }
  }

export const fakeContext = {
  lookAhead: 0.1,
  state: 'running' as AudioContextState,
  rawContext: { state: 'running' as AudioContextState },
  resumeCalls: 0,
  resumeFails: false,
  async resume() {
    this.resumeCalls++
    if (this.resumeFails) throw new Error('resume failed')
    this.state = 'running'
    this.rawContext.state = 'running'
  },
}

export const fakeToneCalls = { start: 0 }

/** The fake module namespace. Pass to `mock.module('tone', () => fakeTone)` or as `loadTone`. */
export const fakeTone = {
  Gain: class extends FakeNode {
    constructor(gain?: number, units?: string) {
      super('Gain', { gain, units })
      this.gain.value = gain ?? 1
    }
  },
  Panner: class extends FakeNode {
    constructor(pan?: number) {
      super('Panner', { pan })
      this.pan.value = pan ?? 0
    }
  },
  Clock: FakeClock,
  LFO: FakeLFO,
  Oscillator: class extends FakeNode {
    constructor(frequency?: number, type?: string) {
      super('Oscillator', { frequency, type })
      this.frequency.value = frequency ?? 440
    }
  },
  Filter: class extends FakeNode {
    constructor(frequency?: number | object, type?: string) {
      super('Filter', { frequency, type })
    }
  },
  FeedbackDelay: nodeClass('FeedbackDelay'),
  Tremolo: class extends FakeNode {
    constructor(options?: { frequency?: number; depth?: number }) {
      super('Tremolo', options)
      this.frequency.value = options?.frequency ?? 10
      this.depth.value = options?.depth ?? 0.5
    }
  },
  Synth: nodeClass('Synth'),
  FMSynth: nodeClass('FMSynth'),
  AMSynth: nodeClass('AMSynth'),
  NoiseSynth: nodeClass('NoiseSynth'),
  MembraneSynth: nodeClass('MembraneSynth'),
  MetalSynth: nodeClass('MetalSynth'),
  PluckSynth: nodeClass('PluckSynth'),
  PolySynth: class extends FakeNode {
    constructor(voice?: unknown, options?: unknown) {
      super('PolySynth', { voice, options })
    }
  },
  Frequency: (note: string | number) => ({
    transpose: (n: number) => ({ toFrequency: () => (typeof note === 'number' ? note : 440) * 2 ** (n / 12) }),
    toFrequency: () => (typeof note === 'number' ? note : 440),
  }),
  now: () => 1.5,
  start: async () => {
    fakeToneCalls.start++
  },
  getContext: () => fakeContext,
  getDestination: () => destination,
}

const destination = new FakeNode('Destination')

export function resetFakeTone() {
  FakeNode.reset()
  FakeClock.instances = []
  fakeContext.lookAhead = 0.1
  fakeContext.state = 'running'
  fakeContext.rawContext.state = 'running'
  fakeContext.resumeCalls = 0
  fakeContext.resumeFails = false
  fakeToneCalls.start = 0
}
