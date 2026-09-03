import { useEffect, useMemo, useRef, useState } from 'react'
import type { Bus, ContinuousSound, Engine, EngineStatus, OneShotSound } from '@earcon/core'
import { catalog, presetHint, presetRate } from '@earcon/engine-tone'

interface Props {
  engine: Engine
  status: EngineStatus
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/**
 * Spec §7.2. Every row keeps one sound instance for the page's lifetime; the LED
 * blinks at the mapped tick rate so the ear and the eye agree.
 */
export function Auditioner({ engine, status }: Props) {
  const bus = useMemo(() => engine.createBus('audition'), [engine])
  useEffect(() => () => bus.dispose(), [bus])

  const continuous = catalog.filter((p) => p.kind === 'continuous')
  const oneShot = catalog.filter((p) => p.kind === 'oneShot')
  const locked = status !== 'ready'

  return (
    <>
      <p className="rack__intro">
        28 のプリセットをその場で聴く。連続音は intensity（Level 内の切迫度、0 → 1）で速さや高さが変わる。
        単発音は遷移の瞬間に 1 回だけ鳴る。LED は実際の反復レートで点滅する。各行の薄い一文が「何を聴き取るか」。
      </p>

      <section className="section" aria-labelledby="sec-continuous">
        <div className="section__head">
          <h2 className="section__title" id="sec-continuous">
            Continuous
          </h2>
          <span className="section__sub">「近づいている」。Level に滞在している間、鳴り続ける</span>
        </div>
        {continuous.map((p) => (
          <ContinuousRow key={p.id} id={p.id} metaphor={p.metaphor} use={p.use} engine={engine} bus={bus} locked={locked} />
        ))}
      </section>

      <section className="section" aria-labelledby="sec-oneshot">
        <div className="section__head">
          <h2 className="section__title" id="sec-oneshot">
            One-shot
          </h2>
          <span className="section__sub">「起こった」。遷移のときに 1 回</span>
        </div>
        {oneShot.map((p) => (
          <OneShotRow key={p.id} id={p.id} metaphor={p.metaphor} use={p.use} engine={engine} bus={bus} locked={locked} />
        ))}
      </section>
    </>
  )
}

interface RowProps {
  id: string
  metaphor: string
  use: string
  engine: Engine
  bus: Bus
  locked: boolean
}

function ContinuousRow({ id, metaphor, use, engine, bus, locked }: RowProps) {
  const sound = useRef<ContinuousSound | null>(null)
  const [playing, setPlaying] = useState(false)
  const [intensity, setIntensity] = useState(0.3)
  const [showJson, setShowJson] = useState(false)

  useEffect(() => {
    sound.current = engine.createContinuous({ kind: 'preset', id }, bus)
    return () => {
      sound.current?.dispose()
      sound.current = null
    }
  }, [engine, bus, id])

  const rate = presetRate[id]
  const hz = rate ? lerp(rate.minHz, rate.maxHz, intensity) : 1
  const sustained = rate?.note === 'sustained'
  const ledColor = intensity < 0.4 ? 'var(--watch)' : intensity < 0.75 ? 'var(--warn)' : 'var(--critical)'

  const toggle = () => {
    const s = sound.current
    if (!s) return
    setPlaying((was) => {
      if (was) s.stop()
      else s.start(intensity)
      return !was
    })
  }

  return (
    <div className="row" data-testid={`row-${id}`}>
      <span
        className="led"
        data-on={playing}
        style={{ '--led-period': sustained ? '0s' : `${1 / hz}s`, '--led-color': ledColor } as React.CSSProperties}
        data-sustained={sustained}
        aria-hidden
      />
      <span className="row__id">{id}</span>
      <span className="row__metaphor">{metaphor}</span>
      <span className="row__use">
        {use}
        {' · '}
        <button className="link" onClick={() => setShowJson((v) => !v)}>
          JSON
        </button>
        <span className="row__hint">{presetHint[id]}</span>
      </span>
      <div className="row__controls">
        <button
          className={`btn${playing ? ' btn--armed' : ''}`}
          onClick={toggle}
          disabled={locked}
          aria-pressed={playing}
          data-testid={`toggle-${id}`}
        >
          {playing ? '停止' : '開始'}
        </button>
        <input
          className="range row__slider"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={intensity}
          aria-label={`${id} の intensity`}
          onChange={(e) => {
            const v = Number(e.target.value)
            setIntensity(v)
            sound.current?.set(v)
          }}
        />
        <span className="row__rate">
          {intensity.toFixed(2)} · {sustained ? '持続' : rate?.note ? `${hz.toFixed(1)}/s` : `${hz.toFixed(2)} Hz`}
        </span>
      </div>
      {showJson && <pre className="row__json">{JSON.stringify({ kind: 'preset', id })}</pre>}
    </div>
  )
}

function OneShotRow({ id, metaphor, use, engine, bus, locked }: RowProps) {
  const sound = useRef<OneShotSound | null>(null)
  const [transpose, setTranspose] = useState(0)
  const [flash, setFlash] = useState(0)
  const [showJson, setShowJson] = useState(false)

  useEffect(() => {
    sound.current = engine.createOneShot({ kind: 'preset', id }, bus)
    return () => {
      sound.current?.dispose()
      sound.current = null
    }
  }, [engine, bus, id])

  const play = () => {
    sound.current?.play({ transpose })
    setFlash((n) => n + 1)
  }

  return (
    <div className="row" data-testid={`row-${id}`}>
      <span key={flash} className="led" data-flash={flash > 0} style={{ '--led-color': 'var(--safe)' } as React.CSSProperties} aria-hidden />
      <span className="row__id">{id}</span>
      <span className="row__metaphor">{metaphor}</span>
      <span className="row__use">
        {use}
        {' · '}
        <button className="link" onClick={() => setShowJson((v) => !v)}>
          JSON
        </button>
        <span className="row__hint">{presetHint[id]}</span>
      </span>
      <div className="row__controls">
        <button className="btn" onClick={play} disabled={locked} data-testid={`play-${id}`}>
          再生
        </button>
        <label className="row__rate" style={{ minWidth: 0 }}>
          transpose
        </label>
        <input
          className="num"
          type="number"
          min={-12}
          max={12}
          step={1}
          value={transpose}
          aria-label={`${id} の transpose（半音）`}
          onChange={(e) => setTranspose(Math.max(-12, Math.min(12, Number(e.target.value) || 0)))}
        />
      </div>
      {showJson && <pre className="row__json">{JSON.stringify({ kind: 'preset', id })}</pre>}
    </div>
  )
}
