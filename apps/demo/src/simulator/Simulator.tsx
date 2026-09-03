import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Direction, Level, MonitorEvent, MonitorState, Urgency } from '@earcon/core'
import { useMonitor } from '@earcon/react'
import { useAssignments } from '../sound-assignments'
import { SCENARIOS, type ScenarioId } from './scenarios'

interface SimConfig {
  direction: Direction
  levels: Level[]
  urgency: Urgency
  staleAfterMs: number
}

const DEFAULT_CONFIG: SimConfig = {
  direction: 'decreasing',
  levels: [
    { id: 'watch', enter: 0.1, exit: 0.12 },
    { id: 'warn', enter: 0.05, exit: 0.06 },
    { id: 'critical', enter: 0.02, exit: 0.03 },
  ],
  urgency: { mode: 'value' },
  staleAfterMs: 15_000,
}

const LEVEL_COLOR: Record<string, string> = { watch: 'var(--watch)', warn: 'var(--warn)', critical: 'var(--critical)' }
const colorOf = (level: string | null) => (level ? (LEVEL_COLOR[level] ?? 'var(--ink-muted)') : 'var(--safe)')

interface LogLine {
  t: number
  text: string
}

const describe = (e: MonitorEvent): string => {
  switch (e.type) {
    case 'enter':
      return `enter ${e.level} ← ${e.from ?? 'safe'}`
    case 'exit':
      return `exit ${e.level} → ${e.to ?? 'safe'}`
    case 'intensity':
      return `intensity ${e.value.toFixed(3)}`
    case 'ack-cleared':
      return `ack-cleared (${e.reason})`
    default:
      return e.type
  }
}

/** Spec §7.3: one monitor, editable thresholds, manual and scenario drivers, live readout. */
export function Simulator() {
  const [draft, setDraft] = useState<SimConfig>(DEFAULT_CONFIG)
  const [applied, setApplied] = useState<{ config: SimConfig; rev: number }>({ config: DEFAULT_CONFIG, rev: 0 })
  const dirty = draft !== applied.config
  const errors = levelErrors(draft)
  const [log, setLog] = useState<LogLine[]>([])

  const onEvent = useCallback((events: MonitorEvent[], state: MonitorState) => {
    const t = state.lastSample?.t ?? 0
    setLog((prev) => [...events.map((e) => ({ t, text: describe(e) })), ...prev].slice(0, 20))
  }, [])

  const assignments = useAssignments()
  const assignKey = Object.keys(assignments).sort().join(',')
  const { state, update, acknowledge } = useMonitor({
    id: `sim-${applied.rev}${assignKey ? `-${assignKey}` : ''}`,
    sounds: assignments,
    direction: applied.config.direction,
    levels: applied.config.levels,
    urgency: applied.config.urgency,
    staleAfterMs: applied.config.staleAfterMs,
    onEvent,
  })

  // ---------------------------------------------------------------- drivers
  const [mode, setMode] = useState<'manual' | 'scenario'>('manual')
  const [value, setValue] = useState(0.15)
  const [speed, setSpeed] = useState(0)
  const [sending, setSending] = useState(false)
  const [scenario, setScenario] = useState<ScenarioId>('slow-approach')
  const [scenarioStart, setScenarioStart] = useState<number | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const valueRef = useRef(value)
  valueRef.current = value

  useEffect(() => {
    if (mode !== 'manual' || !sending) return
    const id = setInterval(() => {
      const next = Math.max(0, valueRef.current + speed * 0.1)
      setValue(next)
      update(next)
    }, 100)
    return () => clearInterval(id)
  }, [mode, sending, speed, update])

  useEffect(() => {
    if (mode !== 'scenario' || scenarioStart === null) return
    const sc = SCENARIOS.find((s) => s.id === scenario)!
    const id = setInterval(() => {
      const s = (performance.now() - scenarioStart) / 1000
      setElapsed(s)
      const v = sc.valueAt(s)
      if (v === null) return
      setValue(v)
      update(v)
    }, 100)
    return () => clearInterval(id)
  }, [mode, scenario, scenarioStart, update])

  const scenarioDef = SCENARIOS.find((s) => s.id === scenario)!
  const trackMax = useMemo(() => Math.max(0.25, ...applied.config.levels.flatMap((l) => [l.enter, l.exit])) * (applied.config.direction === 'increasing' ? 1.4 : 1.1), [applied.config.levels, applied.config.direction])

  return (
    <>
      <p className="rack__intro">
        1 本の Monitor に値を流し込み、Level 遷移・intensity・ETA を見ながら音を聴く。
        閾値は右の表で編集して「適用」で反映する（Monitor は id が変わると作り直される）。
      </p>

      <div className="sim">
        <section className="section sim__readout" aria-labelledby="sim-readout">
          <div className="section__head">
            <h2 className="section__title" id="sim-readout">
              Readout
            </h2>
            <span className="section__sub">monitor id: sim-{applied.rev}{assignKey ? ` · Designer の音: ${assignKey}` : ''}</span>
          </div>

          <Track value={value} levels={applied.config.levels} direction={applied.config.direction} max={trackMax} level={state.level} />

          <dl className="readout" data-level={state.level ?? 'safe'} style={{ '--level-color': colorOf(state.level) } as React.CSSProperties}>
            <div className="readout__cell readout__cell--level">
              <dt>Level</dt>
              <dd data-testid="sim-level">{state.level ?? 'safe'}</dd>
            </div>
            <div className="readout__cell">
              <dt>Intensity</dt>
              <dd data-testid="sim-intensity">
                {state.intensity.toFixed(3)}
                <span className="bar" aria-hidden>
                  <span className="bar__fill" style={{ width: `${state.intensity * 100}%` }} />
                </span>
              </dd>
            </div>
            <div className="readout__cell">
              <dt>ETA</dt>
              <dd>{state.eta === null ? '—' : state.eta === Infinity ? '∞' : `${state.eta.toFixed(1)} s`}</dd>
            </div>
            <div className="readout__cell">
              <dt>Velocity</dt>
              <dd>{state.velocity >= 0 ? '+' : ''}{state.velocity.toFixed(4)} /s</dd>
            </div>
            <div className="readout__cell">
              <dt>Stale</dt>
              <dd data-testid="sim-stale">{state.stale ? 'yes' : 'no'}</dd>
            </div>
            <div className="readout__cell">
              <dt>Acknowledged</dt>
              <dd>
                {state.acknowledged ? 'yes' : 'no'}{' '}
                <button className="btn" onClick={acknowledge} disabled={state.level === null || state.acknowledged} data-testid="sim-ack">
                  了解
                </button>
              </dd>
            </div>
          </dl>

          <div className="drivers">
            <div className="drivers__mode" role="tablist" aria-label="入力モード">
              <button className="btn" aria-pressed={mode === 'manual'} onClick={() => { setMode('manual'); setScenarioStart(null) }}>
                手動
              </button>
              <button className="btn" aria-pressed={mode === 'scenario'} onClick={() => { setMode('scenario'); setSending(false) }}>
                シナリオ
              </button>
            </div>

            {mode === 'manual' ? (
              <div className="drivers__manual">
                <label className="field">
                  <span className="field__label">値</span>
                  <input className="range" type="range" min={0} max={trackMax} step={0.001} value={value}
                    onChange={(e) => { const v = Number(e.target.value); setValue(v); update(v) }} data-testid="sim-value" />
                  <span className="row__rate">{value.toFixed(3)}</span>
                </label>
                <label className="field">
                  <span className="field__label">速度 /s</span>
                  <input className="range" type="range" min={-0.05} max={0.05} step={0.001} value={speed}
                    onChange={(e) => setSpeed(Number(e.target.value))} />
                  <span className="row__rate">{speed >= 0 ? '+' : ''}{speed.toFixed(3)}</span>
                </label>
                <button className={`btn${sending ? ' btn--armed' : ''}`} aria-pressed={sending} onClick={() => setSending((s) => !s)} data-testid="sim-send">
                  {sending ? '送信中 (100 ms)' : '送信開始'}
                </button>
                <button className="btn" onClick={() => setSpeed(0)}>速度 0</button>
              </div>
            ) : (
              <div className="drivers__scenario">
                <div className="scenario-list">
                  {SCENARIOS.map((s) => (
                    <button key={s.id} className="btn" aria-pressed={scenario === s.id} onClick={() => { setScenario(s.id); setScenarioStart(null) }} data-testid={`scenario-${s.id}`}>
                      {s.label}
                    </button>
                  ))}
                </div>
                <p className="scenario__desc">{scenarioDef.description}</p>
                <div className="drivers__manual">
                  <button className={`btn${scenarioStart !== null ? ' btn--armed' : ''}`} onClick={() => { setElapsed(0); setScenarioStart(performance.now()) }} data-testid="scenario-run">
                    {scenarioStart !== null ? '再生し直す' : '再生'}
                  </button>
                  <button className="btn" onClick={() => setScenarioStart(null)} disabled={scenarioStart === null}>停止</button>
                  <span className="row__rate">{scenarioStart === null ? '—' : `${Math.min(elapsed, scenarioDef.durationSec).toFixed(1)} / ${scenarioDef.durationSec} s`}</span>
                </div>
              </div>
            )}
          </div>

          <ol className="log" aria-label="直近のイベント" data-testid="sim-log">
            {log.length === 0 && <li className="log__empty">まだイベントはない。値を動かすと enter / intensity が流れる。</li>}
            {log.map((line, i) => (
              <li key={`${line.t}-${i}`}>
                <span className="log__t">{(line.t / 1000).toFixed(1)}s</span> {line.text}
              </li>
            ))}
          </ol>
        </section>

        <section className="section sim__config" aria-labelledby="sim-config">
          <div className="section__head">
            <h2 className="section__title" id="sim-config">
              Monitor
            </h2>
            <span className="section__sub">{errors.length ? '設定に誤りあり' : dirty ? '未適用の変更あり' : '適用済み'}</span>
          </div>
          <div className="config">
            <label className="field">
              <span className="field__label">direction</span>
              <select className="num" style={{ width: 130, textAlign: 'left' }} value={draft.direction}
                onChange={(e) => setDraft(withDirection(draft, e.target.value as Direction))} data-testid="sim-direction">
                <option value="decreasing">decreasing</option>
                <option value="increasing">increasing</option>
              </select>
            </label>

            <table className="levels">
              <thead>
                <tr><th>id</th><th>enter</th><th>exit</th><th /></tr>
              </thead>
              <tbody>
                {draft.levels.map((l, i) => (
                  <tr key={i}>
                    <td><input className="num" style={{ width: 90, textAlign: 'left' }} value={l.id} onChange={(e) => setDraft(editLevel(draft, i, { id: e.target.value }))} /></td>
                    <td><input className="num" type="number" step={0.001} value={l.enter} onChange={(e) => setDraft(editLevel(draft, i, { enter: Number(e.target.value) }))} /></td>
                    <td><input className="num" type="number" step={0.001} value={l.exit} onChange={(e) => setDraft(editLevel(draft, i, { exit: Number(e.target.value) }))} /></td>
                    <td><button className="link" onClick={() => setDraft({ ...draft, levels: draft.levels.filter((_, j) => j !== i) })}>削除</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="btn" onClick={() => setDraft({ ...draft, levels: [...draft.levels, { id: `level${draft.levels.length + 1}`, enter: 0.01, exit: 0.015 }] })}>
              Level を追加
            </button>

            <label className="field">
              <span className="field__label">urgency</span>
              <select className="num" style={{ width: 130, textAlign: 'left' }} value={draft.urgency.mode}
                onChange={(e) => setDraft({ ...draft, urgency: e.target.value === 'eta' ? { mode: 'eta', eventAt: 0, horizonSec: 300 } : { mode: 'value' } })}>
                <option value="value">value</option>
                <option value="eta">eta</option>
              </select>
            </label>
            {draft.urgency.mode === 'eta' && (
              <>
                <label className="field">
                  <span className="field__label">eventAt</span>
                  <input className="num" type="number" step={0.01} value={draft.urgency.eventAt}
                    onChange={(e) => setDraft({ ...draft, urgency: { ...draft.urgency, mode: 'eta', eventAt: Number(e.target.value) } })} />
                </label>
                <label className="field">
                  <span className="field__label">horizonSec</span>
                  <input className="num" type="number" step={10} value={draft.urgency.horizonSec ?? 300}
                    onChange={(e) => setDraft({ ...draft, urgency: { ...draft.urgency, mode: 'eta', eventAt: draft.urgency.mode === 'eta' ? draft.urgency.eventAt : 0, horizonSec: Number(e.target.value) } })} />
                </label>
              </>
            )}
            <label className="field">
              <span className="field__label">staleAfterMs</span>
              <input className="num" type="number" step={1000} value={draft.staleAfterMs} onChange={(e) => setDraft({ ...draft, staleAfterMs: Number(e.target.value) })} />
            </label>

            {errors.length > 0 && (
              <ul className="config__errors" data-testid="sim-errors">
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}
            <div className="config__actions">
              <button className="btn btn--primary" disabled={!dirty || errors.length > 0} onClick={() => { setApplied({ config: draft, rev: applied.rev + 1 }); setLog([]) }} data-testid="sim-apply">
                適用
              </button>
              <button className="btn" onClick={() => setDraft(DEFAULT_CONFIG)}>既定に戻す</button>
            </div>
            <p className="config__hint">
              音は Level id で決まる: watch = sonar、warn = parkingSensor、critical = hiLoSiren。他の id は無音。
            </p>
          </div>
        </section>
      </div>
    </>
  )
}

/** Same rule as createMonitor (spec §3.2): exit must be on the safe side of enter. */
function levelErrors(cfg: SimConfig): string[] {
  const sign = cfg.direction === 'decreasing' ? -1 : 1
  const errors = cfg.levels
    .filter((l) => !(sign * l.exit < sign * l.enter))
    .map((l) => `${l.id || '(id なし)'}: exit (${l.exit}) は enter (${l.enter}) より${cfg.direction === 'decreasing' ? '大きく' : '小さく'}する`)
  if (cfg.levels.length === 0) errors.push('Level が 1 つも無い')
  const ids = cfg.levels.map((l) => l.id)
  if (new Set(ids).size !== ids.length) errors.push('id が重複している')
  for (let i = 1; i < cfg.levels.length; i++) {
    if (!(sign * cfg.levels[i]!.enter > sign * cfg.levels[i - 1]!.enter)) {
      errors.push(`${cfg.levels[i]!.id}: enter は ${cfg.levels[i - 1]!.id} より危険側（${cfg.direction === 'decreasing' ? '小さく' : '大きく'}）する`)
    }
  }
  return errors
}

/**
 * Flipping the direction flips which side is safe: enter/exit swap, and the
 * thresholds are handed out in reverse so the first level (watch) keeps the
 * threshold nearest to safe.
 */
function withDirection(cfg: SimConfig, direction: Direction): SimConfig {
  if (direction === cfg.direction) return cfg
  const reversed = [...cfg.levels].reverse()
  return {
    ...cfg,
    direction,
    levels: cfg.levels.map((l, i) => ({ id: l.id, enter: reversed[i]!.exit, exit: reversed[i]!.enter })),
  }
}

function editLevel(cfg: SimConfig, i: number, patch: Partial<Level>): SimConfig {
  return { ...cfg, levels: cfg.levels.map((l, j) => (j === i ? { ...l, ...patch } : l)) }
}

/** The value track: enter (solid) and exit (dashed) ticks per level, and the current value. */
function Track({ value, levels, direction, max, level }: { value: number; levels: Level[]; direction: Direction; max: number; level: string | null }) {
  const pct = (v: number) => `${Math.min(100, Math.max(0, (v / max) * 100))}%`
  return (
    <div className="track" aria-hidden>
      <div className="track__danger" style={direction === 'decreasing' ? { left: 0, width: pct(levels[levels.length - 1]?.enter ?? 0) } : { right: 0, left: pct(levels[levels.length - 1]?.enter ?? max) }} />
      {levels.map((l) => (
        <div key={l.id} className="track__level" style={{ '--level-color': colorOf(l.id) } as React.CSSProperties}>
          <span className="track__tick track__tick--enter" style={{ left: pct(l.enter) }} title={`${l.id} enter ${l.enter}`} />
          <span className="track__tick track__tick--exit" style={{ left: pct(l.exit) }} title={`${l.id} exit ${l.exit}`} />
          <span className="track__label" style={{ left: pct((l.enter + l.exit) / 2) }}>{l.id}</span>
        </div>
      ))}
      <span className="track__value" style={{ left: pct(value), '--level-color': colorOf(level) } as React.CSSProperties} />
      <span className="track__scale">0</span>
      <span className="track__scale track__scale--max">{max.toFixed(2)}</span>
    </div>
  )
}
