/**
 * @earcon/engine-tone — トレーダー向けプリセット
 *
 * 前提:
 *   - すべて `await Tone.start()` 後（ユーザー操作内）に生成・再生すること
 *   - 連続音の intensity(0..1) は「レベル内での切迫度」。0 が最も穏やか、1 が最も切迫
 *   - ctx.out は出力先。エンジン側でウォレットごとの Panner / Gain を挟む想定
 *
 * 設計メモ:
 *   - 連続音は Tone.Transport ではなく Tone.Clock を使う。Transport の位置に依存せず、
 *     Worker クロックなので背景タブでも間隔が崩れにくい。frequency は Signal なので
 *     rampTo で滑らかにレートを変えられる（駐車センサーの「ピ、ピ、ピピピ」）
 */
import * as Tone from 'tone'
import type { ContinuousSound, OneShotSound } from '@earcon/core'
import { ticker } from './ticker'

// ---------------------------------------------------------------- contracts
// `ContinuousSound` / `OneShotSound` come from @earcon/core (spec appendix B).

export type { ContinuousSound, OneShotSound }

export interface SoundContext {
  out: Tone.InputNode
}

export interface OneShotOptions {
  transpose?: number // 半音。ウォレット識別や buy/sell の区別に
  velocity?: number
  time?: number // AudioContext 秒。省略時は now
}

export type ContinuousFactory = (ctx: SoundContext) => ContinuousSound
export type OneShotFactory = (ctx: SoundContext) => OneShotSound

// ---------------------------------------------------------------- helpers

const lerp = (a: number, b: number, t: number) => a + (b - a) * clamp01(t)
const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const semis = (note: string, n: number) =>
  Tone.Frequency(note).transpose(Math.round(n)).toFrequency()

// ================================================================ continuous
// 「近づいている」を鳴らす音。intensity で密度・高さが変わる

/** ソナー — watch 用。遠くで何かが動いている。3秒→0.7秒間隔、ピッチも少し上がる */
export const sonar: ContinuousFactory = ({ out }) => {
  const delay = new Tone.FeedbackDelay({ delayTime: 0.4, feedback: 0.45, wet: 0.45 }).connect(out)
  const synth = new Tone.FMSynth({
    harmonicity: 2,
    modulationIndex: 2.5,
    oscillator: { type: 'sine' },
    modulation: { type: 'sine' },
    envelope: { attack: 0.005, decay: 0.7, sustain: 0, release: 0.3 },
    modulationEnvelope: { attack: 0.01, decay: 0.3, sustain: 0, release: 0.2 },
    volume: -6,
  }).connect(delay)
  const t = ticker(
    (time, i) => synth.triggerAttackRelease(semis('A5', i * 5), '8n', time),
    (i) => 1 / lerp(3.0, 0.7, i),
  )
  return { ...t, dispose: () => { t.dispose(); synth.dispose(); delay.dispose() } }
}

/** 駐車センサー — warn 用。0.9秒→0.09秒間隔。ピッチ固定、速さだけで距離を伝える */
export const parkingSensor: ContinuousFactory = ({ out }) => {
  const synth = new Tone.Synth({
    oscillator: { type: 'square' },
    envelope: { attack: 0.002, decay: 0.05, sustain: 0.3, release: 0.03 },
    volume: -10,
  }).connect(out)
  const t = ticker(
    (time) => synth.triggerAttackRelease('C6', 0.045, time),
    (i) => 1 / lerp(0.9, 0.09, i),
  )
  return { ...t, dispose: () => { t.dispose(); synth.dispose() } }
}

/** ガイガーカウンター — warn の代替。確率的なクリック。密度がリスク */
export const geiger: ContinuousFactory = ({ out }) => {
  const hp = new Tone.Filter(4000, 'highpass').connect(out)
  const noise = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.012, sustain: 0, release: 0.005 },
    volume: -6,
  }).connect(hp)
  const t = ticker(
    (time, i) => {
      if (Math.random() < lerp(0.04, 0.85, i * i)) noise.triggerAttackRelease(0.01, time)
    },
    () => 40, // 抽選レートは固定、密度は確率で制御
  )
  return { ...t, dispose: () => { t.dispose(); noise.dispose(); hp.dispose() } }
}

/** 心拍モニター — ポジションの「生存」を示す。55→170 bpm。清算されたら flatline に切替える想定 */
export const heartbeat: ContinuousFactory = ({ out }) => {
  const drum = new Tone.MembraneSynth({
    pitchDecay: 0.03,
    octaves: 4,
    envelope: { attack: 0.001, decay: 0.25, sustain: 0, release: 0.1 },
    volume: -4,
  }).connect(out)
  const bpm = (i: number) => lerp(55, 170, i)
  const t = ticker(
    (time, i) => {
      const period = 60 / bpm(i)
      drum.triggerAttackRelease('A1', 0.12, time) // lub
      drum.triggerAttackRelease('G1', 0.1, time + Math.min(0.16, period * 0.3)) // dub
    },
    (i) => bpm(i) / 60,
  )
  return { ...t, dispose: () => { t.dispose(); drum.dispose() } }
}

/** カウントダウン — 時間ベース（funding まで、TWAP 完了まで）。常に 1Hz、終盤でピッチ上昇＋ダブルビープ */
export const countdown: ContinuousFactory = ({ out }) => {
  const synth = new Tone.Synth({
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.003, decay: 0.08, sustain: 0.2, release: 0.05 },
    volume: -6,
  }).connect(out)
  const t = ticker(
    (time, i) => {
      const note = i < 0.7 ? 'C5' : i < 0.9 ? 'E5' : 'G5'
      synth.triggerAttackRelease(note, 0.08, time)
      if (i >= 0.9) synth.triggerAttackRelease(note, 0.08, time + 0.15)
    },
    () => 1,
  )
  return { ...t, dispose: () => { t.dispose(); synth.dispose() } }
}

/** ハイロー・サイレン — critical 用。二音交互。intensity で切替が速くなる */
export const hiLoSiren: ContinuousFactory = ({ out }) => {
  const lp = new Tone.Filter(1800, 'lowpass').connect(out)
  const osc = new Tone.Oscillator(440, 'sawtooth').connect(lp)
  osc.volume.value = -12
  let hi = false
  const t = ticker(
    (time, i) => {
      hi = !hi
      osc.frequency.setValueAtTime(semis(hi ? 'D5' : 'A4', i * 3), time)
    },
    (i) => lerp(1.6, 4, i),
  )
  return {
    start(i) {
      if (osc.state !== 'started') osc.start()
      t.start(i)
    },
    set: t.set,
    stop() {
      t.stop()
      osc.stop()
    },
    dispose() {
      t.dispose()
      osc.dispose()
      lp.dispose()
    },
  }
}

/** レッドアラート — critical の代替。上昇スイープの繰り返し。最も切迫感が強い */
export const redAlert: ContinuousFactory = ({ out }) => {
  const lp = new Tone.Filter(2500, 'lowpass').connect(out)
  const osc = new Tone.Oscillator(600, 'sawtooth').connect(lp)
  osc.volume.value = -14
  const lfo = new Tone.LFO({ frequency: 1.5, min: 500, max: 900, type: 'sawtooth' })
  lfo.connect(osc.frequency)
  const set = (i: number) => {
    lfo.frequency.rampTo(lerp(1.2, 3.5, i), 0.2)
    lfo.max = lerp(900, 1400, i)
  }
  return {
    start(i) {
      set(i)
      if (osc.state !== 'started') {
        osc.start()
        lfo.start()
      }
    },
    set,
    stop() {
      osc.stop()
      lfo.stop()
    },
    dispose() {
      lfo.dispose()
      osc.dispose()
      lp.dispose()
    },
  }
}

// ================================================================ one-shot
// 「起こった」「切り替わった」を1回で伝える音

/** 取引所のベル — 単打で長い余韻。セッション開始・大口約定など「節目」 */
export const bell: OneShotFactory = ({ out }) => {
  const synth = new Tone.FMSynth({
    harmonicity: 3.01,
    modulationIndex: 14,
    oscillator: { type: 'sine' },
    modulation: { type: 'sine' },
    envelope: { attack: 0.001, decay: 2.2, sustain: 0, release: 1.5 },
    modulationEnvelope: { attack: 0.001, decay: 0.9, sustain: 0, release: 0.5 },
    volume: -6,
  }).connect(out)
  return {
    play({ transpose = 0, velocity = 0.9, time = Tone.now() }: OneShotOptions = {}) {
      synth.triggerAttackRelease(semis('E5', transpose), 2.0, time, velocity)
    },
    dispose: () => synth.dispose(),
  }
}

/** レジ（チャリーン）— 利確・入金。引き出しのノイズ＋金属2音 */
export const register: OneShotFactory = ({ out }) => {
  const drawer = new Tone.NoiseSynth({
    noise: { type: 'pink' },
    envelope: { attack: 0.005, decay: 0.12, sustain: 0, release: 0.05 },
    volume: -12,
  }).connect(out)
  const ching = new Tone.MetalSynth({
    harmonicity: 5.1,
    modulationIndex: 20,
    resonance: 4000,
    octaves: 1.2,
    envelope: { attack: 0.001, decay: 0.6, release: 0.2 },
    volume: -14,
  }).connect(out)
  return {
    play({ transpose = 0, time = Tone.now() }: OneShotOptions = {}) {
      drawer.triggerAttackRelease(0.1, time)
      ching.triggerAttackRelease(semis('C6', transpose), 0.4, time + 0.09)
      ching.triggerAttackRelease(semis('E6', transpose), 0.5, time + 0.17)
    },
    dispose() {
      drawer.dispose()
      ching.dispose()
    },
  }
}

/** コイン — 小さな約定・小さな利益。上昇2音 */
export const coin: OneShotFactory = ({ out }) => {
  const synth = new Tone.Synth({
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.002, decay: 0.15, sustain: 0.15, release: 0.2 },
    volume: -8,
  }).connect(out)
  return {
    play({ transpose = 0, time = Tone.now() }: OneShotOptions = {}) {
      synth.triggerAttackRelease(semis('C6', transpose), 0.07, time)
      synth.triggerAttackRelease(semis('G6', transpose), 0.25, time + 0.08)
    },
    dispose: () => synth.dispose(),
  }
}

/** ノック — stale 専用。データが途絶えた。他のどの音とも似せない低い2打 */
export const knock: OneShotFactory = ({ out }) => {
  const drum = new Tone.MembraneSynth({
    pitchDecay: 0.02,
    octaves: 2,
    envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.05 },
    volume: -4,
  }).connect(out)
  return {
    play({ time = Tone.now() }: OneShotOptions = {}) {
      drum.triggerAttackRelease('E2', 0.1, time)
      drum.triggerAttackRelease('E2', 0.1, time + 0.18)
    },
    dispose: () => drum.dispose(),
  }
}

/** オールクリア — 危険レベルから抜けた。長三和音の上昇アルペジオ */
export const allClear: OneShotFactory = ({ out }) => {
  const synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'sine' },
    envelope: { attack: 0.01, decay: 0.4, sustain: 0.1, release: 0.6 },
  }).connect(out)
  synth.volume.value = -10
  return {
    play({ transpose = 0, time = Tone.now() }: OneShotOptions = {}) {
      ;['C5', 'E5', 'G5'].forEach((n, k) =>
        synth.triggerAttackRelease(semis(n, transpose), 0.5, time + k * 0.09),
      )
    },
    dispose: () => synth.dispose(),
  }
}

/** ブザー — 注文拒否・エラー。低い矩形波 */
export const buzzer: OneShotFactory = ({ out }) => {
  const synth = new Tone.Synth({
    oscillator: { type: 'square' },
    envelope: { attack: 0.005, decay: 0.05, sustain: 0.8, release: 0.05 },
    volume: -14,
  }).connect(out)
  return {
    play({ time = Tone.now() }: OneShotOptions = {}) {
      synth.triggerAttackRelease('A2', 0.25, time)
    },
    dispose: () => synth.dispose(),
  }
}

/** チャイム（ピンポン）— 情報通知。緊急性なし */
export const chime: OneShotFactory = ({ out }) => {
  const synth = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.005, decay: 0.6, sustain: 0, release: 0.4 },
    volume: -8,
  }).connect(out)
  return {
    play({ transpose = 0, time = Tone.now() }: OneShotOptions = {}) {
      synth.triggerAttackRelease(semis('E5', transpose), 0.4, time)
      synth.triggerAttackRelease(semis('C5', transpose), 0.6, time + 0.35)
    },
    dispose: () => synth.dispose(),
  }
}

// ================================================================ registry

export const continuous = {
  sonar,
  parkingSensor,
  geiger,
  heartbeat,
  countdown,
  hiLoSiren,
  redAlert,
} satisfies Record<string, ContinuousFactory>

export const oneShot = {
  bell,
  register,
  coin,
  knock,
  allClear,
  buzzer,
  chime,
} satisfies Record<string, OneShotFactory>

export type ContinuousPresetId = keyof typeof continuous
export type OneShotPresetId = keyof typeof oneShot

export { catalog, defaultLevelSounds } from './catalog'
export { fromSpec } from './fromSpec'
