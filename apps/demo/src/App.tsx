import { useState } from 'react'
import { NotifierProvider, UnlockGate, useToneNotifier } from '@earcon/react'
import { Auditioner } from './auditioner/Auditioner'
import { engine } from './engine'
import { Simulator } from './simulator/Simulator'

type Tab = 'auditioner' | 'simulator' | 'designer' | 'wallets'

const TABS: Array<{ id: Tab; label: string; ready: boolean }> = [
  { id: 'auditioner', label: 'Preset Auditioner', ready: true },
  { id: 'simulator', label: 'Monitor Simulator', ready: true },
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
  return (
    <NotifierProvider engine={engine} policy={{ mode: 'worst-only' }}>
      <Shell />
    </NotifierProvider>
  )
}

function Shell() {
  const notifier = useToneNotifier()
  const [tab, setTab] = useState<Tab>('auditioner')
  const [masterDb, setMasterDb] = useState(-6)

  return (
    <>
      <header className="rail">
        <h1 className="rail__brand">
          earcon <small>近づいている、を鳴らす</small>
        </h1>
        <div className="rail__spacer" />
        <div className="rail__group">
          <span className="chip" data-status={notifier.status} data-testid="status">
            {STATUS_LABEL[notifier.status]}
          </span>
          <UnlockGate>
            {({ status, unlock, resume }) =>
              status === 'locked' ? (
                <button className="btn btn--primary" onClick={() => void unlock()} data-testid="unlock">
                  音を有効化
                </button>
              ) : status === 'suspended' ? (
                <button className="btn btn--primary" onClick={() => void resume()}>
                  再開
                </button>
              ) : null
            }
          </UnlockGate>
        </div>
        <div className="rail__group">
          <button className="btn" aria-pressed={notifier.muted} onClick={() => notifier.setMuted(!notifier.muted)}>
            {notifier.muted ? 'ミュート中' : 'ミュート'}
          </button>
          <button className="btn" onClick={notifier.acknowledgeAll} title="鳴っている Monitor をすべて了解にする">
            全部了解
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
              notifier.setMasterVolume(db)
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
            data-testid={`tab-${t.id}`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="rack">
        {tab === 'auditioner' && <Auditioner engine={engine} status={notifier.status} />}
        {tab === 'simulator' && <Simulator />}
        {(tab === 'designer' || tab === 'wallets') && <p className="placeholder">この区画はまだ空です。</p>}
      </main>
    </>
  )
}
