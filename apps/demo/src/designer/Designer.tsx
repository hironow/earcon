import { useEffect, useRef, useState, type ReactNode } from 'react'
import { validateSynthSpec, type Bus, type ContinuousSound, type Engine, type EngineStatus, type OneShotSound, type SynthSpec } from '@earcon/core'
import { assignSound, useAssignments } from '../sound-assignments'
import { deleteSpec, downloadSpec, listSaved, saveSpec, type SavedSpec } from './storage'
import sonarSpec from '../../../../packages/engine-tone/specs/sonar.json'
import parkingSpec from '../../../../packages/engine-tone/specs/parkingSensor.json'
import heartbeatSpec from '../../../../packages/engine-tone/specs/heartbeat.json'
import coinSpec from '../../../../packages/engine-tone/specs/coin.json'
import chimeSpec from '../../../../packages/engine-tone/specs/chime.json'
import knockSpec from '../../../../packages/engine-tone/specs/knock.json'

interface Props {
  engine: Engine
  status: EngineStatus
}

const TWINS: Array<{ id: string; spec: SynthSpec }> = [
  { id: 'sonar', spec: sonarSpec as SynthSpec },
  { id: 'parkingSensor', spec: parkingSpec as SynthSpec },
  { id: 'heartbeat', spec: heartbeatSpec as SynthSpec },
  { id: 'coin', spec: coinSpec as SynthSpec },
  { id: 'chime', spec: chimeSpec as SynthSpec },
  { id: 'knock', spec: knockSpec as SynthSpec },
]

const VOICES: SynthSpec['voice'][] = ['synth', 'fm', 'am', 'membrane', 'metal', 'noise', 'pluck']
const OSCS: NonNullable<SynthSpec['oscillator']>[] = ['sine', 'square', 'triangle', 'sawtooth']
const LEVELS = ['watch', 'warn', 'critical']

const DEFAULT_SPEC: SynthSpec = {
  kind: 'synth',
  mode: 'continuous',
  voice: 'synth',
  oscillator: 'square',
  envelope: { attack: 0.002, decay: 0.05, sustain: 0.3, release: 0.03 },
  volume: -10,
  rate: { minHz: 1, maxHz: 8, curve: 'linear' },
  pitch: { base: 'C6', semitonesAtMax: 0 },
  pattern: [{ offset: 0, dur: 0.05 }],
  notes: [{ note: 'C6', at: 0, dur: 0.1 }],
}

/** Spec §7.4: a form-based SynthSpec editor with live preview, JSON panel, localStorage, export. */
export function Designer({ engine, status }: Props) {
  const [spec, setSpec] = useState<SynthSpec>(DEFAULT_SPEC)
  const [name, setName] = useState('my-sound')
  const [saved, setSaved] = useState<SavedSpec[]>([])
  const [jsonText, setJsonText] = useState('')
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [intensity, setIntensity] = useState(0.3)
  const [playing, setPlaying] = useState(false)
  const [rev, setRev] = useState(0) // bump to rebuild the preview sound
  const assignments = useAssignments()
  const locked = status !== 'ready'
  const narrow = useNarrow()

  useEffect(() => setSaved(listSaved()), [])
  useEffect(() => setJsonText(JSON.stringify(spec, null, 2)), [spec])

  // ---------------------------------------------------------------- preview sound
  const bus = useRef<Bus | null>(null)
  const sound = useRef<ContinuousSound | OneShotSound | null>(null)
  useEffect(() => {
    bus.current = engine.createBus('designer')
    return () => {
      bus.current?.dispose()
      bus.current = null
    }
  }, [engine])
  const specErrors = validateSynthSpec(spec)
  useEffect(() => {
    sound.current?.dispose()
    sound.current = null
    setPlaying(false)
    if (!bus.current || specErrors.length) return
    try {
      sound.current = spec.mode === 'continuous' ? engine.createContinuous(spec, bus.current) : engine.createOneShot(spec, bus.current)
      setJsonError(null)
    } catch (e) {
      setJsonError((e as Error).message)
    }
    return () => {
      sound.current?.dispose()
      sound.current = null
    }
  }, [engine, spec, rev])

  const patch = (p: Partial<SynthSpec>) => setSpec((s) => ({ ...s, ...p }))
  const setEnv = (k: keyof SynthSpec['envelope'], v: number) => patch({ envelope: { ...spec.envelope, [k]: v } })

  const togglePreview = () => {
    const s = sound.current as ContinuousSound | null
    if (!s) return
    setPlaying((was) => {
      if (was) s.stop()
      else s.start(intensity)
      return !was
    })
  }

  const loadJson = () => {
    let parsed: unknown
    try {
      parsed = JSON.parse(jsonText)
    } catch (e) {
      setJsonError(`JSON として読めない: ${(e as Error).message}`)
      return
    }
    const errors = validateSynthSpec(parsed)
    if (errors.length) {
      setJsonError(errors.join('\n'))
      return
    }
    setSpec(parsed as SynthSpec)
    setJsonError(null)
  }

  const cleanName = name.trim().replace(/[\\/:*?"<>|]/g, '-').slice(0, 40)
  const nameError = cleanName.length === 0 ? '名前を入れる（空白だけは不可）' : null

  return (
    <>
      <p className="rack__intro">
        <code>SynthSpec</code>（JSON で書ける音の宣言）をフォームで組み、その場で聴く。保存はこのブラウザの localStorage。
        できた音は右下から Simulator の Level に割り当てられる。
      </p>

      <div className="designer">
        <section className="section" aria-labelledby="dz-form">
          <div className="section__head">
            <h2 className="section__title" id="dz-form">
              Spec
            </h2>
            <span className="section__sub">
              下敷き:{' '}
              {narrow ? (
                <select className="num" style={{ width: 150, textAlign: 'left' }} value="" aria-label="下敷きを読み込む"
                  onChange={(e) => { const t = TWINS.find((x) => x.id === e.target.value); if (t) setSpec(t.spec) }}>
                  <option value="">選ぶ…</option>
                  {TWINS.map((t) => (
                    <option key={t.id} value={t.id}>{t.id}</option>
                  ))}
                </select>
              ) : (
                TWINS.map((t) => (
                  <button key={t.id} className="link" onClick={() => setSpec(t.spec)} data-testid={`twin-${t.id}`}>
                    {t.id}
                  </button>
                )).reduce<React.ReactNode[]>((acc, el, i) => (i ? [...acc, ' · ', el] : [el]), [])
              )}
            </span>
          </div>
          <div className="config">
            <div className="drivers__mode" role="tablist" aria-label="mode">
              <button className="btn" aria-pressed={spec.mode === 'continuous'} onClick={() => patch({ mode: 'continuous' })}>
                continuous
              </button>
              <button className="btn" aria-pressed={spec.mode === 'oneShot'} onClick={() => patch({ mode: 'oneShot' })}>
                oneShot
              </button>
            </div>

            <label className="field">
              <span className="field__label">voice</span>
              <select className="num" style={{ width: 130, textAlign: 'left' }} value={spec.voice} onChange={(e) => patch({ voice: e.target.value as SynthSpec['voice'] })} data-testid="dz-voice">
                {VOICES.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field__label">oscillator</span>
              <select className="num" style={{ width: 130, textAlign: 'left' }} value={spec.oscillator ?? ''} onChange={(e) => patch({ oscillator: (e.target.value || undefined) as SynthSpec['oscillator'] })}>
                <option value="">(既定)</option>
                {OSCS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </label>

            <Fold title="envelope (s)" defaultOpen={!narrow}>
              {(['attack', 'decay', 'sustain', 'release'] as const).map((k) => (
                <label key={k} className="field">
                  <span className="field__label">{k}</span>
                  <input className="num" type="number" step={0.001} min={0} value={spec.envelope[k]} onChange={(e) => setEnv(k, Number(e.target.value))} />
                </label>
              ))}
            </Fold>

            <label className="field">
              <span className="field__label">volume dB</span>
              <input className="num" type="number" step={1} value={spec.volume} onChange={(e) => patch({ volume: Number(e.target.value) })} />
            </label>

            <Fold title="fx" defaultOpen={!narrow}>
              <label className="field">
                <span className="field__label">filter</span>
                <select className="num" style={{ width: 100, textAlign: 'left' }} value={spec.fx?.filter?.type ?? ''}
                  onChange={(e) => patch({ fx: { ...spec.fx, filter: e.target.value ? { type: e.target.value as 'lowpass' | 'highpass', freq: spec.fx?.filter?.freq ?? 2000 } : undefined } })}>
                  <option value="">なし</option>
                  <option value="lowpass">lowpass</option>
                  <option value="highpass">highpass</option>
                </select>
                {spec.fx?.filter && (
                  <input className="num" type="number" step={100} value={spec.fx.filter.freq} aria-label="filter freq"
                    onChange={(e) => patch({ fx: { ...spec.fx, filter: { ...spec.fx!.filter!, freq: Number(e.target.value) } } })} />
                )}
              </label>
              <label className="field">
                <span className="field__label">delay</span>
                <button type="button" className="btn" aria-pressed={!!spec.fx?.delay}
                  onClick={() => patch({ fx: { ...spec.fx, delay: spec.fx?.delay ? undefined : { time: 0.3, feedback: 0.4, wet: 0.3 } } })}>
                  {spec.fx?.delay ? 'あり' : 'なし'}
                </button>
                {spec.fx?.delay && (
                  <>
                    {(['time', 'feedback', 'wet'] as const).map((k) => (
                      <input key={k} className="num" type="number" step={0.05} min={0} max={1} value={spec.fx!.delay![k]} aria-label={`delay ${k}`} title={k}
                        onChange={(e) => patch({ fx: { ...spec.fx, delay: { ...spec.fx!.delay!, [k]: Number(e.target.value) } } })} />
                    ))}
                  </>
                )}
              </label>
            </Fold>

            {spec.mode === 'continuous' ? (
              <>
                <Fold title="rate (Hz at intensity 0 → 1)" defaultOpen={!narrow}>
                  <label className="field">
                    <span className="field__label">min</span>
                    <input className="num" type="number" step={0.1} min={0.05} value={spec.rate?.minHz ?? 1} onChange={(e) => patch({ rate: { ...(spec.rate ?? { minHz: 1, maxHz: 1 }), minHz: Number(e.target.value) } })} />
                  </label>
                  <label className="field">
                    <span className="field__label">max</span>
                    <input className="num" type="number" step={0.1} min={0.05} value={spec.rate?.maxHz ?? 1} onChange={(e) => patch({ rate: { ...(spec.rate ?? { minHz: 1, maxHz: 1 }), maxHz: Number(e.target.value) } })} />
                  </label>
                  <label className="field">
                    <span className="field__label">curve</span>
                    <select className="num" style={{ width: 100, textAlign: 'left' }} value={spec.rate?.curve ?? 'linear'} onChange={(e) => patch({ rate: { ...(spec.rate ?? { minHz: 1, maxHz: 1 }), curve: e.target.value as 'linear' | 'exp' } })}>
                      <option value="linear">linear</option>
                      <option value="exp">exp</option>
                    </select>
                  </label>
                </Fold>
                <Fold title="pitch" defaultOpen={!narrow}>
                  <label className="field">
                    <span className="field__label">base</span>
                    <input className="num" style={{ textAlign: 'left' }} value={spec.pitch?.base ?? 'C5'} onChange={(e) => patch({ pitch: { ...(spec.pitch ?? { base: 'C5', semitonesAtMax: 0 }), base: e.target.value } })} />
                  </label>
                  <label className="field">
                    <span className="field__label">semitones@1</span>
                    <input className="num" type="number" step={1} value={spec.pitch?.semitonesAtMax ?? 0} onChange={(e) => patch({ pitch: { ...(spec.pitch ?? { base: 'C5', semitonesAtMax: 0 }), semitonesAtMax: Number(e.target.value) } })} />
                  </label>
                </Fold>
                <RowTable
                  title="pattern（1 tick 内のヒット）"
                  columns={['offset', 'note', 'dur']}
                  rows={(spec.pattern ?? []).map((p) => [p.offset, p.note ?? '', p.dur])}
                  onChange={(rows) => patch({ pattern: rows.map(([offset, note, dur]) => ({ offset: Number(offset), ...(note ? { note: String(note) } : {}), dur: Number(dur) })) })}
                  blank={[0, '', 0.1]}
                />
              </>
            ) : (
              <RowTable
                title="notes"
                columns={['note', 'at', 'dur']}
                rows={(spec.notes ?? []).map((n) => [n.note, n.at, n.dur])}
                onChange={(rows) => patch({ notes: rows.map(([note, at, dur]) => ({ note: String(note), at: Number(at), dur: Number(dur) })) })}
                blank={['C5', 0, 0.1]}
              />
            )}
          </div>
        </section>

        <div className="designer__side">
          <FoldSection id="dz-preview" title="Preview" sub={spec.mode} narrow={narrow} defaultOpen>
            <div className="config">
              {spec.mode === 'continuous' ? (
                <div className="drivers__manual">
                  <button className={`btn${playing ? ' btn--armed' : ''}`} aria-pressed={playing} disabled={locked || specErrors.length > 0} onClick={togglePreview} data-testid="dz-toggle">
                    {playing ? '停止' : '開始'}
                  </button>
                  <label className="field">
                    <span className="field__label">intensity</span>
                    <input className="range" type="range" min={0} max={1} step={0.01} value={intensity}
                      onChange={(e) => { const v = Number(e.target.value); setIntensity(v); (sound.current as ContinuousSound | null)?.set(v) }} />
                    <span className="row__rate">{intensity.toFixed(2)}</span>
                  </label>
                </div>
              ) : (
                <button className="btn" disabled={locked || specErrors.length > 0} onClick={() => (sound.current as OneShotSound | null)?.play()} data-testid="dz-play">
                  再生
                </button>
              )}
              <button className="link" onClick={() => setRev((r) => r + 1)}>音を作り直す</button>
              {specErrors.length > 0 && (
                <ul className="config__errors" data-testid="dz-spec-errors">
                  {specErrors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              )}
            </div>
          </FoldSection>

          <FoldSection id="dz-json" title="JSON" sub="編集して「読み込む」で反映" narrow={narrow} defaultOpen={false}>
            <div className="config">
              <textarea className="json" value={jsonText} onChange={(e) => setJsonText(e.target.value)} spellCheck={false} data-testid="dz-json" />
              {jsonError && <pre className="config__errors" style={{ whiteSpace: 'pre-wrap', paddingLeft: 0, listStyle: 'none' }} data-testid="dz-json-error">{jsonError}</pre>}
              <div className="config__actions">
                <button className="btn" onClick={loadJson}>読み込む</button>
                <button className="btn" onClick={() => void navigator.clipboard?.writeText(jsonText)}>コピー</button>
              </div>
            </div>
          </FoldSection>

          <FoldSection id="dz-save" title="Save" sub={`localStorage · ${saved.length} 件`} narrow={narrow} defaultOpen={false}>
            <div className="config">
              <label className="field">
                <span className="field__label">name</span>
                <input className="num" style={{ width: 160, textAlign: 'left' }} value={name} onChange={(e) => setName(e.target.value)} data-testid="dz-name" />
              </label>
              {nameError && <p className="config__errors" style={{ paddingLeft: 0, listStyle: 'none' }}>{nameError}</p>}
              <div className="config__actions">
                <button className="btn btn--primary" disabled={!!nameError || specErrors.length > 0} onClick={() => setSaved(saveSpec(cleanName, spec))} data-testid="dz-save">保存</button>
                <button className="btn" style={{ textTransform: 'none' }} disabled={!!nameError || specErrors.length > 0} onClick={() => downloadSpec(cleanName, spec)}>specs/{cleanName || 'sound'}.json を書き出す</button>
              </div>
              {saved.length > 0 && (
                <ul className="saved" data-testid="dz-saved">
                  {saved.map((s) => (
                    <li key={s.name}>
                      <button className="link" onClick={() => { setSpec(s.spec); setName(s.name) }}>{s.name}</button>
                      <span className="row__rate">{s.spec.mode}</span>
                      <button className="link" onClick={() => setSaved(deleteSpec(s.name))}>削除</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </FoldSection>

          <FoldSection id="dz-assign" title="Assign" sub="Simulator の Level に割り当てる" narrow={narrow} defaultOpen>
            <div className="config">
              <div className="config__actions">
                {LEVELS.map((l) => (
                  <button key={l} className="btn" disabled={spec.mode !== 'continuous' || specErrors.length > 0} onClick={() => assignSound(l, spec)} data-testid={`assign-${l}`}>
                    → {l}
                  </button>
                ))}
              </div>
              <ul className="saved">
                {LEVELS.map((l) => (
                  <li key={l}>
                    <span className="row__id">{l}</span>
                    <span className="row__rate">{assignments[l] ? `synth/${(assignments[l] as SynthSpec).voice}` : 'プリセット'}</span>
                    {assignments[l] && <button className="link" onClick={() => assignSound(l, null)}>戻す</button>}
                  </li>
                ))}
              </ul>
              <p className="config__hint">連続音（continuous）だけ割り当てられる。割り当てた瞬間に Simulator の Monitor が作り直される。</p>
            </div>
          </FoldSection>
        </div>
      </div>
    </>
  )
}

function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 540px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 540px)')
    const on = () => setNarrow(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return narrow
}

/** A section whose head becomes a toggle on phones; always open on wider screens. */
function FoldSection({ id, title, sub, narrow, defaultOpen, children }: { id: string; title: string; sub?: ReactNode; narrow: boolean; defaultOpen: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  useEffect(() => setOpen(defaultOpen), [defaultOpen])
  const expanded = !narrow || open
  return (
    <section className="section" aria-labelledby={id}>
      {narrow ? (
        <button type="button" className="section__head section__head--toggle" aria-expanded={expanded} onClick={() => setOpen((o) => !o)}>
          <h2 className="section__title" id={id}>{title}</h2>
          <span className="section__sub">{sub}</span>
          <span className="section__chevron" aria-hidden>{expanded ? '▾' : '▸'}</span>
        </button>
      ) : (
        <div className="section__head">
          <h2 className="section__title" id={id}>{title}</h2>
          <span className="section__sub">{sub}</span>
        </div>
      )}
      {expanded && children}
    </section>
  )
}

/** A fieldset that folds on phones (open by default on wider screens). */
function Fold({ title, children, defaultOpen }: { title: string; children: ReactNode; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  useEffect(() => setOpen(defaultOpen), [defaultOpen])
  return (
    <details className="fieldset" open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary className="field__label">{title}</summary>
      {children}
    </details>
  )
}

type Cell = string | number

function RowTable({ title, columns, rows, onChange, blank }: { title: string; columns: string[]; rows: Cell[][]; onChange: (rows: Cell[][]) => void; blank: Cell[] }) {
  const edit = (r: number, c: number, v: Cell) => onChange(rows.map((row, i) => (i === r ? row.map((cell, j) => (j === c ? v : cell)) : row)))
  return (
    <fieldset className="fieldset">
      <legend className="field__label">{title}</legend>
      <div className="levels-scroll">
      <table className="levels">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c}>{c}</th>
            ))}
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => (
                <td key={c}>
                  <input className="num" style={{ width: 80, textAlign: typeof blank[c] === 'number' ? 'right' : 'left' }} type={typeof blank[c] === 'number' ? 'number' : 'text'} step={0.01} value={cell}
                    onChange={(e) => edit(r, c, typeof blank[c] === 'number' ? Number(e.target.value) : e.target.value)} />
                </td>
              ))}
              <td><button className="link" onClick={() => onChange(rows.filter((_, i) => i !== r))}>削除</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      <button className="btn" onClick={() => onChange([...rows, [...blank]])}>行を追加</button>
    </fieldset>
  )
}
