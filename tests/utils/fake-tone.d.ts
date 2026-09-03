/**
 * Minimal in-memory stand-in for the `tone` module, for `bun test`.
 * Every node records what was done to it in `calls`; signals hold values.
 * Only the surface used by presets/engine/fromSpec is implemented.
 */
export interface Call {
    node: string;
    method: string;
    args: unknown[];
}
export declare class FakeSignal {
    value: number;
    private owner;
    private name;
    calls: Call[];
    constructor(value: number, owner: string, name: string);
    rampTo(v: number, t?: number): void;
    setValueAtTime(v: number, t: number): void;
    linearRampTo(v: number, t?: number): void;
}
export declare class FakeNode {
    static live: Set<FakeNode>;
    static all: FakeNode[];
    calls: Call[];
    connections: FakeNode[];
    disposed: boolean;
    state: 'started' | 'stopped';
    volume: FakeSignal;
    frequency: FakeSignal;
    gain: FakeSignal;
    pan: FakeSignal;
    kind: string;
    options: unknown;
    constructor(kind: string, options?: unknown);
    connect(dest: FakeNode): this;
    toDestination(): this;
    start(...args: unknown[]): this;
    stop(...args: unknown[]): this;
    triggerAttackRelease(...args: unknown[]): this;
    triggerAttack(...args: unknown[]): this;
    triggerRelease(...args: unknown[]): this;
    dispose(): this;
    static reset(): void;
}
/** Clock with a controllable tick: `fire(time)` invokes the callback. */
export declare class FakeClock extends FakeNode {
    static instances: FakeClock[];
    callback: (time: number) => void;
    constructor(callback: (time: number) => void, frequency: number);
    fire(time?: number): void;
}
export declare class FakeLFO extends FakeNode {
    min: number;
    max: number;
    constructor(options?: {
        frequency?: number;
        min?: number;
        max?: number;
        type?: string;
    });
}
export declare const fakeContext: {
    lookAhead: number;
    state: AudioContextState;
    rawContext: {
        state: AudioContextState;
    };
    resumeCalls: number;
    resumeFails: boolean;
    resume(): Promise<void>;
};
export declare const fakeToneCalls: {
    start: number;
};
/** The fake module namespace. Pass to `mock.module('tone', () => fakeTone)` or as `loadTone`. */
export declare const fakeTone: {
    Gain: {
        new (gain?: number, units?: string): {
            calls: Call[];
            connections: FakeNode[];
            disposed: boolean;
            state: "started" | "stopped";
            volume: FakeSignal;
            frequency: FakeSignal;
            gain: FakeSignal;
            pan: FakeSignal;
            kind: string;
            options: unknown;
            connect(dest: FakeNode): /*elided*/ any;
            toDestination(): /*elided*/ any;
            start(...args: unknown[]): /*elided*/ any;
            stop(...args: unknown[]): /*elided*/ any;
            triggerAttackRelease(...args: unknown[]): /*elided*/ any;
            triggerAttack(...args: unknown[]): /*elided*/ any;
            triggerRelease(...args: unknown[]): /*elided*/ any;
            dispose(): /*elided*/ any;
        };
        live: Set<FakeNode>;
        all: FakeNode[];
        reset(): void;
    };
    Panner: {
        new (pan?: number): {
            calls: Call[];
            connections: FakeNode[];
            disposed: boolean;
            state: "started" | "stopped";
            volume: FakeSignal;
            frequency: FakeSignal;
            gain: FakeSignal;
            pan: FakeSignal;
            kind: string;
            options: unknown;
            connect(dest: FakeNode): /*elided*/ any;
            toDestination(): /*elided*/ any;
            start(...args: unknown[]): /*elided*/ any;
            stop(...args: unknown[]): /*elided*/ any;
            triggerAttackRelease(...args: unknown[]): /*elided*/ any;
            triggerAttack(...args: unknown[]): /*elided*/ any;
            triggerRelease(...args: unknown[]): /*elided*/ any;
            dispose(): /*elided*/ any;
        };
        live: Set<FakeNode>;
        all: FakeNode[];
        reset(): void;
    };
    Clock: typeof FakeClock;
    LFO: typeof FakeLFO;
    Oscillator: {
        new (frequency?: number, type?: string): {
            calls: Call[];
            connections: FakeNode[];
            disposed: boolean;
            state: "started" | "stopped";
            volume: FakeSignal;
            frequency: FakeSignal;
            gain: FakeSignal;
            pan: FakeSignal;
            kind: string;
            options: unknown;
            connect(dest: FakeNode): /*elided*/ any;
            toDestination(): /*elided*/ any;
            start(...args: unknown[]): /*elided*/ any;
            stop(...args: unknown[]): /*elided*/ any;
            triggerAttackRelease(...args: unknown[]): /*elided*/ any;
            triggerAttack(...args: unknown[]): /*elided*/ any;
            triggerRelease(...args: unknown[]): /*elided*/ any;
            dispose(): /*elided*/ any;
        };
        live: Set<FakeNode>;
        all: FakeNode[];
        reset(): void;
    };
    Filter: {
        new (frequency?: number | object, type?: string): {
            calls: Call[];
            connections: FakeNode[];
            disposed: boolean;
            state: "started" | "stopped";
            volume: FakeSignal;
            frequency: FakeSignal;
            gain: FakeSignal;
            pan: FakeSignal;
            kind: string;
            options: unknown;
            connect(dest: FakeNode): /*elided*/ any;
            toDestination(): /*elided*/ any;
            start(...args: unknown[]): /*elided*/ any;
            stop(...args: unknown[]): /*elided*/ any;
            triggerAttackRelease(...args: unknown[]): /*elided*/ any;
            triggerAttack(...args: unknown[]): /*elided*/ any;
            triggerRelease(...args: unknown[]): /*elided*/ any;
            dispose(): /*elided*/ any;
        };
        live: Set<FakeNode>;
        all: FakeNode[];
        reset(): void;
    };
    FeedbackDelay: {
        new (options?: unknown): {
            calls: Call[];
            connections: FakeNode[];
            disposed: boolean;
            state: "started" | "stopped";
            volume: FakeSignal;
            frequency: FakeSignal;
            gain: FakeSignal;
            pan: FakeSignal;
            kind: string;
            options: unknown;
            connect(dest: FakeNode): /*elided*/ any;
            toDestination(): /*elided*/ any;
            start(...args: unknown[]): /*elided*/ any;
            stop(...args: unknown[]): /*elided*/ any;
            triggerAttackRelease(...args: unknown[]): /*elided*/ any;
            triggerAttack(...args: unknown[]): /*elided*/ any;
            triggerRelease(...args: unknown[]): /*elided*/ any;
            dispose(): /*elided*/ any;
        };
        live: Set<FakeNode>;
        all: FakeNode[];
        reset(): void;
    };
    Synth: {
        new (options?: unknown): {
            calls: Call[];
            connections: FakeNode[];
            disposed: boolean;
            state: "started" | "stopped";
            volume: FakeSignal;
            frequency: FakeSignal;
            gain: FakeSignal;
            pan: FakeSignal;
            kind: string;
            options: unknown;
            connect(dest: FakeNode): /*elided*/ any;
            toDestination(): /*elided*/ any;
            start(...args: unknown[]): /*elided*/ any;
            stop(...args: unknown[]): /*elided*/ any;
            triggerAttackRelease(...args: unknown[]): /*elided*/ any;
            triggerAttack(...args: unknown[]): /*elided*/ any;
            triggerRelease(...args: unknown[]): /*elided*/ any;
            dispose(): /*elided*/ any;
        };
        live: Set<FakeNode>;
        all: FakeNode[];
        reset(): void;
    };
    FMSynth: {
        new (options?: unknown): {
            calls: Call[];
            connections: FakeNode[];
            disposed: boolean;
            state: "started" | "stopped";
            volume: FakeSignal;
            frequency: FakeSignal;
            gain: FakeSignal;
            pan: FakeSignal;
            kind: string;
            options: unknown;
            connect(dest: FakeNode): /*elided*/ any;
            toDestination(): /*elided*/ any;
            start(...args: unknown[]): /*elided*/ any;
            stop(...args: unknown[]): /*elided*/ any;
            triggerAttackRelease(...args: unknown[]): /*elided*/ any;
            triggerAttack(...args: unknown[]): /*elided*/ any;
            triggerRelease(...args: unknown[]): /*elided*/ any;
            dispose(): /*elided*/ any;
        };
        live: Set<FakeNode>;
        all: FakeNode[];
        reset(): void;
    };
    AMSynth: {
        new (options?: unknown): {
            calls: Call[];
            connections: FakeNode[];
            disposed: boolean;
            state: "started" | "stopped";
            volume: FakeSignal;
            frequency: FakeSignal;
            gain: FakeSignal;
            pan: FakeSignal;
            kind: string;
            options: unknown;
            connect(dest: FakeNode): /*elided*/ any;
            toDestination(): /*elided*/ any;
            start(...args: unknown[]): /*elided*/ any;
            stop(...args: unknown[]): /*elided*/ any;
            triggerAttackRelease(...args: unknown[]): /*elided*/ any;
            triggerAttack(...args: unknown[]): /*elided*/ any;
            triggerRelease(...args: unknown[]): /*elided*/ any;
            dispose(): /*elided*/ any;
        };
        live: Set<FakeNode>;
        all: FakeNode[];
        reset(): void;
    };
    NoiseSynth: {
        new (options?: unknown): {
            calls: Call[];
            connections: FakeNode[];
            disposed: boolean;
            state: "started" | "stopped";
            volume: FakeSignal;
            frequency: FakeSignal;
            gain: FakeSignal;
            pan: FakeSignal;
            kind: string;
            options: unknown;
            connect(dest: FakeNode): /*elided*/ any;
            toDestination(): /*elided*/ any;
            start(...args: unknown[]): /*elided*/ any;
            stop(...args: unknown[]): /*elided*/ any;
            triggerAttackRelease(...args: unknown[]): /*elided*/ any;
            triggerAttack(...args: unknown[]): /*elided*/ any;
            triggerRelease(...args: unknown[]): /*elided*/ any;
            dispose(): /*elided*/ any;
        };
        live: Set<FakeNode>;
        all: FakeNode[];
        reset(): void;
    };
    MembraneSynth: {
        new (options?: unknown): {
            calls: Call[];
            connections: FakeNode[];
            disposed: boolean;
            state: "started" | "stopped";
            volume: FakeSignal;
            frequency: FakeSignal;
            gain: FakeSignal;
            pan: FakeSignal;
            kind: string;
            options: unknown;
            connect(dest: FakeNode): /*elided*/ any;
            toDestination(): /*elided*/ any;
            start(...args: unknown[]): /*elided*/ any;
            stop(...args: unknown[]): /*elided*/ any;
            triggerAttackRelease(...args: unknown[]): /*elided*/ any;
            triggerAttack(...args: unknown[]): /*elided*/ any;
            triggerRelease(...args: unknown[]): /*elided*/ any;
            dispose(): /*elided*/ any;
        };
        live: Set<FakeNode>;
        all: FakeNode[];
        reset(): void;
    };
    MetalSynth: {
        new (options?: unknown): {
            calls: Call[];
            connections: FakeNode[];
            disposed: boolean;
            state: "started" | "stopped";
            volume: FakeSignal;
            frequency: FakeSignal;
            gain: FakeSignal;
            pan: FakeSignal;
            kind: string;
            options: unknown;
            connect(dest: FakeNode): /*elided*/ any;
            toDestination(): /*elided*/ any;
            start(...args: unknown[]): /*elided*/ any;
            stop(...args: unknown[]): /*elided*/ any;
            triggerAttackRelease(...args: unknown[]): /*elided*/ any;
            triggerAttack(...args: unknown[]): /*elided*/ any;
            triggerRelease(...args: unknown[]): /*elided*/ any;
            dispose(): /*elided*/ any;
        };
        live: Set<FakeNode>;
        all: FakeNode[];
        reset(): void;
    };
    PluckSynth: {
        new (options?: unknown): {
            calls: Call[];
            connections: FakeNode[];
            disposed: boolean;
            state: "started" | "stopped";
            volume: FakeSignal;
            frequency: FakeSignal;
            gain: FakeSignal;
            pan: FakeSignal;
            kind: string;
            options: unknown;
            connect(dest: FakeNode): /*elided*/ any;
            toDestination(): /*elided*/ any;
            start(...args: unknown[]): /*elided*/ any;
            stop(...args: unknown[]): /*elided*/ any;
            triggerAttackRelease(...args: unknown[]): /*elided*/ any;
            triggerAttack(...args: unknown[]): /*elided*/ any;
            triggerRelease(...args: unknown[]): /*elided*/ any;
            dispose(): /*elided*/ any;
        };
        live: Set<FakeNode>;
        all: FakeNode[];
        reset(): void;
    };
    PolySynth: {
        new (voice?: unknown, options?: unknown): {
            calls: Call[];
            connections: FakeNode[];
            disposed: boolean;
            state: "started" | "stopped";
            volume: FakeSignal;
            frequency: FakeSignal;
            gain: FakeSignal;
            pan: FakeSignal;
            kind: string;
            options: unknown;
            connect(dest: FakeNode): /*elided*/ any;
            toDestination(): /*elided*/ any;
            start(...args: unknown[]): /*elided*/ any;
            stop(...args: unknown[]): /*elided*/ any;
            triggerAttackRelease(...args: unknown[]): /*elided*/ any;
            triggerAttack(...args: unknown[]): /*elided*/ any;
            triggerRelease(...args: unknown[]): /*elided*/ any;
            dispose(): /*elided*/ any;
        };
        live: Set<FakeNode>;
        all: FakeNode[];
        reset(): void;
    };
    Frequency: (note: string | number) => {
        transpose: (n: number) => {
            toFrequency: () => number;
        };
        toFrequency: () => number;
    };
    now: () => number;
    start: () => Promise<void>;
    getContext: () => {
        lookAhead: number;
        state: AudioContextState;
        rawContext: {
            state: AudioContextState;
        };
        resumeCalls: number;
        resumeFails: boolean;
        resume(): Promise<void>;
    };
    getDestination: () => FakeNode;
};
export declare function resetFakeTone(): void;
