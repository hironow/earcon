/**
 * Preset ids and metadata. No Tone import: safe to use before `unlock()`
 * (settings UI, docs, synchronous `{ kind: 'preset', id }` validation).
 */

/** Monitor のレベル → 既定プリセット。JSON 設定からは id で参照する */
export const defaultLevelSounds = {
  watch: 'sonar',
  warn: 'parkingSensor',
  critical: 'hiLoSiren',
  stale: 'knock',
  exitDanger: 'allClear',
} as const

/** 設定 UI・ドキュメント用のカタログ */
export const catalog = [
  { id: 'sonar', kind: 'continuous', metaphor: 'ソナー', use: '遠い危険。監視レベル' },
  { id: 'parkingSensor', kind: 'continuous', metaphor: '駐車センサー', use: '接近中。警告レベル' },
  { id: 'geiger', kind: 'continuous', metaphor: 'ガイガーカウンター', use: '不確実な危険の密度' },
  { id: 'heartbeat', kind: 'continuous', metaphor: '心拍モニター', use: 'ポジションの健康度' },
  { id: 'countdown', kind: 'continuous', metaphor: 'カウントダウン', use: '時間ベースの締切' },
  { id: 'hiLoSiren', kind: 'continuous', metaphor: 'サイレン', use: '清算目前。危機レベル' },
  { id: 'redAlert', kind: 'continuous', metaphor: 'レッドアラート', use: '危機レベルの代替' },
  { id: 'bell', kind: 'oneShot', metaphor: '取引所のベル', use: 'セッション・節目' },
  { id: 'register', kind: 'oneShot', metaphor: 'レジ', use: '利確・入金' },
  { id: 'coin', kind: 'oneShot', metaphor: 'コイン', use: '小さな約定' },
  { id: 'knock', kind: 'oneShot', metaphor: 'ノック', use: 'データ途絶（stale）' },
  { id: 'allClear', kind: 'oneShot', metaphor: 'オールクリア', use: '危険域から離脱' },
  { id: 'buzzer', kind: 'oneShot', metaphor: 'ブザー', use: '拒否・エラー' },
  { id: 'chime', kind: 'oneShot', metaphor: 'チャイム', use: '情報通知' },
] as const

export type PresetKind = (typeof catalog)[number]['kind']
export type PresetId = (typeof catalog)[number]['id']

/** Tick-rate range (Hz) of each continuous preset at intensity 0 → 1, for UI. */
export const presetRate: Record<string, { minHz: number; maxHz: number; note?: string }> = {
  sonar: { minHz: 1 / 3, maxHz: 1 / 0.7 },
  parkingSensor: { minHz: 1 / 0.9, maxHz: 1 / 0.09 },
  geiger: { minHz: 40 * 0.04, maxHz: 40 * 0.85, note: 'stochastic density' },
  heartbeat: { minHz: 55 / 60, maxHz: 170 / 60 },
  countdown: { minHz: 1, maxHz: 1 },
  hiLoSiren: { minHz: 1.6, maxHz: 4 },
  redAlert: { minHz: 1.2, maxHz: 3.5, note: 'sweep rate' },
}

export const presetIds = {
  continuous: catalog.filter((p) => p.kind === 'continuous').map((p) => p.id),
  oneShot: catalog.filter((p) => p.kind === 'oneShot').map((p) => p.id),
}
