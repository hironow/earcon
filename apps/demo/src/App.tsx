import { useState, useSyncExternalStore } from 'react'
import { Auditioner } from './auditioner/Auditioner'
import { engine } from './engine'

type Tab = 'auditioner' | 'simulator' | 'designer' | 'wallets'

const TABS: Array<{ id: Tab; label: string; ready: boolean }> = [
  { id: 'auditioner', label: 'Preset Auditioner', ready: true },
  { id: 'simulator', label: 'Monitor Simulator', ready: false },
  { id: 'designer', label: 'Sound Designer', ready: false },
  { id: 'wallets', label: 'Wallets', ready: false },
]

const STATUS_LABEL: Record<string, string> = {
  locked: '未有効化',
  ready: '鳴らせる',
  suspended: '停止中',
  unavailable: 'Web Audio 非対応',
}

export function App() {
  const status = useSyncExternalStore(engine.onStatusChange, () => engine.status)
  const [tab, setTab] = useState<Tab>('auditioner')
  const [muted, setMuted] = useState(false)
  const [masterDb, setMasterDb] = useState(-6)

  return (
    <>
      <header className="rail">
        <h1 className="rail__brand">
          earcon <small>近づいている、を鳴らす</small>
        </h1>
        <div className="rail__spacer" />
        <div className="rail__group">
          <span className="chip" data-status={status} data-testid="status">
            {STATUS_LABEL[status]}
          </span>
          {status === 'locked' && (
            <button className="btn btn--primary" onClick={() => void engine.unlock()} data-testid="unlock">
              音を有効化
            </button>
          )}
          {status === 'suspended' && (
            <button className="btn btn--primary" onClick={() => void engine.resume()}>
              再開
            </button>
          )}
        </div>
        <div className="rail__group">
          <button
            className="btn"
            aria-pressed={muted}
            onClick={() => {
              const next = !muted
              setMuted(next)
              engine.setMuted(next)
            }}
          >
            {muted ? 'ミュート中' : 'ミュート'}
          </button>
        </div>
        <div className="rail__group">
          <span className="rail__label">Master</span>
          <input
            className="range"
            style={{ width: 120 }}
            type="range"
            min={-40}
            max={0}
            step={1}
            value={masterDb}
            aria-label="マスター音量 (dB)"
            onChange={(e) => {
              const db = Number(e.target.value)
              setMasterDb(db)
              engine.setMasterVolume(db)
            }}
          />
          <span className="row__rate" style={{ minWidth: 48 }}>
            {masterDb} dB
          </span>
        </div>
      </header>

      <nav className="tabs" role="tablist" aria-label="セクション">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            className="tab"
            aria-selected={tab === t.id}
            disabled={!t.ready}
            title={t.ready ? undefined : 'あとのマイルストーンで追加'}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="rack">
        {tab === 'auditioner' ? <Auditioner engine={engine} status={status} /> : <p className="placeholder">この区画はまだ空です。</p>}
      </main>
    </>
  )
}
