/** Spec §7.3 scenarios. Each returns the value at elapsed seconds, or null to stop sending samples. */
export type ScenarioId = 'slow-approach' | 'crash' | 'whipsaw' | 'stale'

export interface Scenario {
  id: ScenarioId
  label: string
  description: string
  /** Seconds until the scenario is considered finished (UI only). */
  durationSec: number
  valueAt(elapsedSec: number): number | null
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'slow-approach',
    label: 'ゆっくり接近',
    description: '0.20 → 0.00 を 120 秒で線形に。Level を順に通過し、音が段階的に速く・高くなる',
    durationSec: 120,
    valueAt: (s) => Math.max(0, 0.2 - (0.2 * Math.min(s, 120)) / 120),
  },
  {
    id: 'crash',
    label: '急落',
    description: '0.15 で 10 秒静止、そのあと 3 秒で 0.01 まで。ETA モードで iEta が先に跳ね上がる',
    durationSec: 13,
    valueAt: (s) => (s < 10 ? 0.15 : s < 13 ? 0.15 - ((0.15 - 0.01) * (s - 10)) / 3 : 0.01),
  },
  {
    id: 'whipsaw',
    label: '往復',
    description: '0.11 と 0.09 を 2 秒ごとに往復。watch{enter .10, exit .12} のヒステリシスで enter/exit が出ないことを確認',
    durationSec: 20,
    valueAt: (s) => (Math.floor(s / 2) % 2 === 0 ? 0.11 : 0.09),
  },
  {
    id: 'stale',
    label: 'データ途絶',
    description: '0.06 を 3 秒送ってから更新を止める。staleAfterMs 後に knock が繰り返し鳴る',
    durationSec: 30,
    valueAt: (s) => (s < 3 ? 0.06 : null),
  },
]
