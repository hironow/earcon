import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { selectAudible, type ArbiterPolicy, type Level, type MonitorState } from '@earcon/core'
import { useMonitor } from '@earcon/react'
import { SCENARIOS, type ScenarioId } from '../simulator/scenarios'

const N = 8
const LEVELS: Level[] = [
  { id: 'watch', enter: 0.1, exit: 0.12 },
  { id: 'warn', enter: 0.05, exit: 0.06 },
  { id: 'critical', enter: 0.02, exit: 0.03 },
]
const LEVEL_COLOR: Record<string, string> = { watch: 'var(--watch)', warn: 'var(--warn)', critical: 'var(--critical)' }
const levelIndexOf = (s: MonitorState) => (s.level === null ? -1 : LEVELS.findIndex((l) => l.id === s.level))

type Driver = ScenarioId | 'idle'

interface Props {
  policy: ArbiterPolicy
  onPolicy: (p: ArbiterPolicy) => void
}

/** Spec §7.5: eight monitors, pan spread across the stereo field, switchable arbiter policy. */
export function Wallets({ policy, onPolicy }: Props) {
  const [drivers, setDrivers] = useState<Driver[]>(() => Array.from({ length: N }, () => 'idle'))
  const [runId, setRunId] = useState(0)
  const [states, setStates] = useState<Record<string, MonitorState>>({})
  const report = useCallback((s: MonitorState) => setStates((prev) => (prev[s.id] === s ? prev : { ...prev, [s.id]: s })), [])
  const audible = useMemo(() => new Set(selectAudible(Object.values(states), levelIndexOf, policy)), [states, policy])
  const topN = policy.mode === 'top-n' ? policy.n : 2

  const preset = (ids: Driver[]) => {
    setDrivers(ids)
    setRunId((r) => r + 1)
  }

  return (
    <>
      <p className="rack__intro">
        8 本のウォレットを同時に監視する。パンは左端から右端まで等間隔。policy を切り替えて、どれが鳴るかを聴き比べる。
      </p>

      <section className="section" aria-labelledby="w-policy">
        <div className="section__head">
          <h2 className="section__title" id="w-policy">
            Policy
          </h2>
          <span className="section__sub">Arbiter: Level 降順 → intensity 降順 → id 昇順</span>
        </div>
        <div className="config">
          <div className="drivers__manual">
            <button className="btn" aria-pressed={policy.mode === 'all'} onClick={() => onPolicy({ mode: 'all' })} data-testid="policy-all">all</button>
            <button className="btn" aria-pressed={policy.mode === 'worst-only'} onClick={() => onPolicy({ mode: 'worst-only' })} data-testid="policy-worst">worst-only</button>
            <button className="btn" aria-pressed={policy.mode === 'top-n'} onClick={() => onPolicy({ mode: 'top-n', n: topN })} data-testid="policy-top">top-n</button>
            <label className="field">
              <span className="field__label">n</span>
              <input className="num" type="number" min={1} max={N} value={topN} disabled={policy.mode !== 'top-n'} onChange={(e) => onPolicy({ mode: 'top-n', n: Math.min(N, Math.max(1, Math.floor(Number(e.target.value)) || 1)) })} />
            </label>
          </div>
          <div className="drivers__manual">
            <span className="field__label">一括</span>
            <button className="btn" onClick={() => preset(Array.from({ length: N }, (_, i) => (['slow-approach', 'crash', 'whipsaw', 'stale'] as Driver[])[i % 4]!))} data-testid="run-mixed">4 シナリオを割り振って再生</button>
            <button className="btn" onClick={() => preset(Array.from({ length: N }, () => 'crash'))} data-testid="run-crash">全部 crash</button>
            <button className="btn" onClick={() => preset(Array.from({ length: N }, () => 'idle'))} data-testid="run-stop">全部停止</button>
          </div>
        </div>
      </section>

      <div className="wallets">
        {Array.from({ length: N }, (_, i) => (
          <Wallet
            key={i}
            index={i}
            driver={drivers[i]!}
            runId={runId}
            audible={audible.has(`w${i + 1}`)}
            onDriver={(d) => {
              setDrivers((prev) => prev.map((x, j) => (j === i ? d : x)))
              setRunId((r) => r + 1)
            }}
            report={report}
          />
        ))}
      </div>

      <section className="section" aria-labelledby="w-bg">
        <div className="section__head">
          <h2 className="section__title" id="w-bg">
            背景タブの手順
          </h2>
          <span className="section__sub">spec §8 M5 の手動版</span>
        </div>
        <div className="config">
          <ol className="steps">
            <li>「4 シナリオを割り振って再生」を押し、音が鳴り始めたのを確認する</li>
            <li>別のタブに切り替えて 2 分放置する（このタブは裏に回る）</li>
            <li>裏にいる間も、駐車センサーやサイレンの反復レートが崩れず鳴り続けていれば OK（Tone.Clock は Worker で動く）</li>
            <li>戻ってきたとき stale の knock が 10 秒おきに鳴っているウォレットがあれば、watchdog も裏で動いていた証拠</li>
            <li>iOS Safari では OS が AudioContext を止めるため、この手順は通らない（仕様上の制限）</li>
          </ol>
        </div>
      </section>
    </>
  )
}

interface WalletProps {
  index: number
  driver: Driver
  runId: number
  audible: boolean
  onDriver: (d: Driver) => void
  report: (s: MonitorState) => void
}

function Wallet({ index, driver, runId, audible, onDriver, report }: WalletProps) {
  const id = `w${index + 1}`
  const pan = -1 + (2 * index) / (N - 1)
  const { state, update, acknowledge } = useMonitor({
    id,
    direction: 'decreasing',
    levels: LEVELS,
    staleAfterMs: 15_000,
    pan,
    onEvent: (_e, s) => report(s),
  })
  const [value, setValue] = useState<number | null>(null)
  const startRef = useRef(0)

  useEffect(() => {
    if (driver === 'idle') return
    const sc = SCENARIOS.find((s) => s.id === driver)!
    startRef.current = performance.now()
    const tick = setInterval(() => {
      const v = sc.valueAt((performance.now() - startRef.current) / 1000)
      if (v === null) return
      setValue(v)
      update(v)
    }, 100)
    return () => clearInterval(tick)
  }, [driver, runId, update])

  const color = state.level ? (LEVEL_COLOR[state.level] ?? 'var(--ink-muted)') : 'var(--safe)'
  return (
    <article className="wallet" data-testid={`wallet-${id}`} data-level={state.level ?? 'safe'} data-audible={audible} style={{ '--level-color': color } as React.CSSProperties}>
      <header className="wallet__head">
        <span className="row__id">{id}</span>
        <span className="row__rate">pan {pan.toFixed(2)}</span>
        <span className={`wallet__audible${audible ? ' wallet__audible--on' : ''}`} title={audible ? '鳴っている' : '鳴っていない'} aria-label={audible ? '鳴っている' : '鳴っていない'} />
      </header>
      <div className="wallet__level">{state.level ?? 'safe'}</div>
      <span className="bar" aria-hidden><span className="bar__fill" style={{ width: `${state.intensity * 100}%` }} /></span>
      <div className="wallet__meta">
        <span>{value === null ? '—' : value.toFixed(3)}</span>
        <span>{state.stale ? 'stale' : state.acknowledged ? 'acked' : ''}</span>
      </div>
      <div className="wallet__controls">
        <select className="num" style={{ width: 120, textAlign: 'left' }} value={driver} onChange={(e) => onDriver(e.target.value as Driver)} aria-label={`${id} のシナリオ`}>
          <option value="idle">停止</option>
          {SCENARIOS.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
        <button className="btn" onClick={acknowledge} disabled={state.level === null || state.acknowledged} data-testid={`ack-${id}`}>了解</button>
      </div>
    </article>
  )
}
