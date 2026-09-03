# bun からの安全な npm リリース手順（調査 2026-09-04）

**Date:** 2026-09-04  **Status:** research snapshot（実装前）

## 要約（10 行以内）

1. npm はクラシックトークンを 2025-12-09 に全失効させ、認証は granular access token（GAT、write は最長 90 日）と Trusted Publishing（OIDC）の 2 本になった [1][2]。
2. GitHub の方針は「ローカル publish は 2FA 必須、自動 publish は OIDC」。2FA バイパス GAT は 2026-07-31 に管理操作を剥奪され、2027 年 1 月に直接 publish 能力も失う [3][4][5]。
3. Trusted Publishing は GitHub Actions / GitLab / CircleCI のクラウドランナーのみ対応、self-hosted は未対応。OIDC publish は provenance を自動生成する [6]。
4. **`bun publish` は 2026-09 時点で OIDC / provenance に非対応**。issue #22423・#15601 はいずれも open で、#15601 に PR #30522 が紐づくが未リリース [7][8]。
5. したがって publish ステップだけ `bunx npm publish` を使うのが唯一の公式互換ルート。install / build / version は bun のまま [7][9]。
6. 新規パッケージの Trusted Publishing は「パッケージが存在しないと設定できない」制約が残る。npm/cli #8544 は open [10][11]。
7. よって初回だけ 90 日 GAT で手動 publish、直後に `npm trust github` を設定してトークンを破棄する二段構えが必要 [11][12]。
8. npm v12 は install 時に依存の lifecycle script を既定で実行しなくなった。bun は元から実行しない（`trustedDependencies` 方式）ので方針は一致 [13][14]。
9. 2026-07-28 から publish 時マルウェアスキャンが入り、公開まで通常 5 分・ピーク 15 分以上の遅延がある。CI のタイムアウト設計に影響 [15]。
10. `bun publish` / `bun pm pack` は `workspace:*` と `catalog:` を実バージョンへ展開するので、モノレポの公開自体は bun で問題ない [16][17]。

## 1. npm 側の現状（2025〜2026 の変更）

2025 年 9 月と 11 月の Shai-Hulud ワーム（2 波目は 738 パッケージ・25,000 リポジトリ規模、`preinstall` から巨大難読化ペイロードを実行し、GitHub の公開リポジトリへ秘密情報を排出）を受けて、npm は認証基盤を作り替えた [18][19]。

**トークン。** クラシックトークンは 2025-12-09 に恒久失効。再作成も復旧も不可 [2]。現在は GAT のみで、書き込み権限を持つものは最長 90 日 [1][2]。`npm login` は 2 時間で切れるセッショントークンを返す [2]。

**2FA。** 新規作成パッケージは既定で 2FA が有効 [2]。パッケージ設定の「Require two-factor authentication and disallow tokens」を選ぶと、GAT では一切 publish できなくなる [20]。2026-07-31 以降、bypass-2FA GAT はトークン作成・権限変更・Trusted Publishing 設定変更ができない [4]。2027 年 1 月には直接 publish も不可になり、staged publish（後述）経由のみになる予定 [3][4]。

**Trusted Publishing。** OIDC でワークフローごとの短命署名トークンを発行する仕組み。npm CLI 11.5.1 以上、Node 22.14.0 以上が必要。対応は GitHub Actions（GitHub ホストランナー）、GitLab CI（共有ランナー）、CircleCI クラウドのみで、self-hosted ランナーは未対応 [6]。2026-02-18 に `npm trust` による複数パッケージ一括設定が GA [12]。設定には npm 11.15.0 以上とアカウントレベルの 2FA が必要 [21]。

**provenance。** GitHub Actions / GitLab から Trusted Publishing で publish すると、`--provenance` を付けなくても attestation が自動生成される。公開リポジトリの公開パッケージのみが対象 [6][22]。

**staged publishing。** 2026-05-22 導入。`npm stage publish` で 2FA なしにステージし、メンテナが `npm stage approve` で 2FA 承認して初めて公開される。bypass-2FA GAT でも承認時の 2FA は回避できない [23][24]。

**publish 時スキャン。** 2026-07-28 から自動マルウェアスキャンが入り、公開まで通常 5 分程度の遅延。デュアルユース機能を持つパッケージは `contentPolicy` フィールドと `DISCLOSURE` ファイルの宣言が段階的に必須化される [15]。今回の 3 パッケージ（音の合成と React バインディング）は該当しない見込みだが、断定はできない（未確認）。

**install 既定の変更。** npm v12（2026 年 7 月）で、依存の `preinstall` / `install` / `postinstall` と暗黙の node-gyp ビルドは明示許可がない限り実行されない。`--allow-git` と `--allow-remote` の既定も `none` [13][14]。

## 2. bun publish の現状

**OIDC 非対応が決定的。** issue #22423「bun publish does not support npm OIDC authentication in GitHub Actions」は open のまま。`id-token: write` を付けても `error: missing authentication (run bunx npm login)` で落ちる [7]。`--provenance` 相当も未実装で、issue #15601 が open、PR #30522 が紐づくが 1.4 系には入っていない [8]。重複 issue #24855 は #15601 にクローズ統合された [25]。bun.com/docs 全体を grep しても provenance / OIDC / attestation の記述は存在しない（AWS Lambda ガイドの Docker `--provenance=false` を除く）[26]。

**認証は `NPM_CONFIG_TOKEN` のみ。** `bun publish` は `NPM_CONFIG_TOKEN` / `BUN_CONFIG_TOKEN` 環境変数と `.npmrc` / `bunfig.toml` を読む [17][27]。つまり bun で publish する限り、長命トークンを CI に置く旧来モデルから抜けられない。

**lifecycle script の扱い。** tarball パスを渡した `bun publish ./package.tgz` は `prepublishOnly` / `prepack` / `prepare` / `postpack` / `publish` / `postpublish` を実行しない。bun 自身がパックする場合のみ実行される [17]。`--ignore-scripts` も用意されている [17]。

**workspace / catalog の解決。** `bun publish` と `bun pm pack` は `workspace:` と `catalog:` プロトコルを剥がして実バージョンに解決する。公開 tarball に `catalog:` が残ることはない [16][17]。

**その他の関連機能（bun 1.4、2026-08-19 リリース）。** `bun audit` / `bun audit fix`、`bun pm licenses`、`bun dedupe`、`bun prune`、グローバル仮想ストア付き isolated install。`bun.lock` は GitHub / tarball 依存にも SHA-512 を記録。レジストリ資格情報はホスト単位にスコープされ、クロスオリジン送出や http へのダウングレード、verbose 出力への露出をしない [28]。

## 3. 推奨パイプライン（案。まだ実装しない）

**方針: bun で作り、npm CLI で送る。** 「bun のみ」ルールとの折り合いは「パッケージマネージャは bun 一本、publish トランスポートだけ npm CLI」と切り分けるのが妥当。理由は、OIDC 非対応の `bun publish` を使うと 90 日ごとにローテーションが必要な長命トークンを GitHub Secrets に置くことになり、それこそが Shai-Hulud が盗んだ資産だから [18][7]。

```yaml
permissions:
  contents: write
  id-token: write        # OIDC に必須 [6]
steps:
  - uses: actions/checkout@<sha>
  - uses: oven-sh/setup-bun@<sha>
  - run: bun install --frozen-lockfile
  - run: bun run build && bun test
  - run: bunx changeset version && bun install --lockfile-only
  - run: bunx npm@latest publish --workspaces --access public
```

- 全 action を SHA でピン留めする（タグは差し替え可能）。
- publish ジョブを build ジョブから分離し、publish ジョブには最小の依存だけを入れる。changesets #1802 で指摘された「install / build ステップの任意コードが `npm publish` を呼べてしまう」リスクを狭めるため [9]。
- `changesets/action` が OIDC publish に正式対応したかは**未確認**。対応が確認できるまで、version は changesets、publish は明示的な npm CLI 呼び出しに分ける構成が安全。
- self-hosted ランナーでは Trusted Publishing が動かない。GitHub ホストランナーを使うこと [6]。
- publish 後の公開反映に 5〜15 分かかる。後続の smoke test は待機かリトライを入れる [15]。

## 4. サプライチェーン衛生チェックリスト

- `bun install --frozen-lockfile` を CI の既定にする [29]。
- `bunfig.toml` に `[install] minimumReleaseAge = 604800`（7 日）を設定。新規公開直後の汚染版を掴まない [30][31]。`minimumReleaseAgeExcludes` で自前パッケージだけ除外。
- `trustedDependencies` は空のまま維持する。bun は既定で依存の lifecycle script を実行しない [32]。bun 1.4 では既定の信頼リストが npm レジストリ由来のパッケージにのみ適用される [28]。
- `bun audit` を `just check` に組み込む。`--audit-level=high` で閾値を切る [33]。
- `[install.security] scanner` に Socket 等のスキャナを設定する選択肢がある [34]。導入是非は要判断。
- Dependabot / Renovate は、cooldown（最小リリース経過日数）を設定し、GitHub Actions の SHA ピンも更新対象に含める。具体の推奨値は**未確認**。
- `bun pm pkg` で `repository` フィールドを正しく設定する。provenance の検証はリポジトリとの一致に依存する [22]。

## 5. 初回リリースの手順（案）

ブートストラップ問題は 2026-09 時点で未解消。npm の UI と `npm trust` はどちらも既存パッケージを前提とする [10][21][11]。

1. npmjs.com で `@earcon` org を作成し、アカウントの 2FA を有効化する（`npm trust` の前提）[21]。
2. `bun pm pack --dry-run` で 3 パッケージ全ての tarball 内容を確認する。`files` を絞り、`src/`・テスト・設定が入っていないことを目視する [35]。
3. 90 日 GAT を「write、対象パッケージのみ」で発行し、**ローカルから** `npm publish --access public --provenance` で `0.1.0` を 3 本 publish する。スコープ付きパッケージは既定で restricted なので `--access public` が必須 [17][22]。
4. 直後に各パッケージへ `npm trust github --allow-publish`（ワークフローファイル名とリポジトリを指定）を設定する [21]。
5. GAT を revoke し、GitHub Secrets からも消す [11]。
6. パッケージ設定を「Require two-factor authentication and disallow tokens」に切り替える [20][6]。
7. 以降のリリースは 3 節のワークフローに委ねる。`0.1.x` 系で API を固め、公開 API が安定した時点で `1.0.0` に上げる。fixed グループなので 3 パッケージのバージョンは常に揃う。

**typosquat 対策。** npm 公式が「似た名前のパッケージを防衛的に予約せよ」と推奨している一次情報は**見つからなかった**。スコープ `@earcon` を org として押さえれば `@earcon/*` 配下は保護される。無スコープの `earcon` 系の予約は公式推奨ではないので、発注者の判断事項とする。

## 6. 未確認事項・要判断事項（発注者に聞くべきこと）

1. **publish に npm CLI を使うことの承認。** AGENTS.md の「bun only」に対する明示的な例外を認めるか。認めない場合、長命 GAT を 90 日ごとに回す運用を受け入れることになる。
2. `changesets/action` の OIDC 対応状況。未確認。実装着手前に changesets のリリースノートを再確認すること。
3. `bun publish --provenance`（PR #30522）のマージ・リリース時期。未確認。リリースされれば publish も bun に戻せる。
4. `[install.security] scanner` の導入是非とコスト。
5. Dependabot / Renovate の cooldown 推奨値。公式一次情報を未確認。
6. GitHub リポジトリを public にするか。provenance の自動生成は公開リポジトリの公開パッケージのみが対象 [6]。
7. 無スコープ名の防衛的予約を行うか。

## 検証メモ（team-lead による一次情報の再確認、2026-09-04）

- [7] bun #22423 は open、メンテナのコメントも紐づく PR もなし（再確認済み）。
- [6] Trusted Publishing の対応プロバイダ（GitHub Actions / GitLab / CircleCI のクラウドのみ）、npm CLI 11.5.1 以上、self-hosted 非対応、provenance 自動生成、`npm trust` コマンドの存在を docs.npmjs.com で再確認。
- [2] クラシックトークンの恒久失効 2025-12-09、`npm login` の 2 時間セッションを再確認。[1] write 権限 GAT の最長 90 日を再確認。
- [13] npm v12 で依存の `preinstall` / `install` / `postinstall` と暗黙の node-gyp ビルドが明示許可なしに実行されないことを再確認。なお `npm install` のオプション解説にある `ignore-scripts`（既定 false）は従来オプションで、v12 の許可リスト機構とは別。両者を混同しないこと。
- 未検証のまま: [11]（二次情報の gist）、[19]（二次情報）。結論には影響しない。

## 出典（URL、確認日、一次/二次の別）

すべて 2026-09-04 確認。

| # | URL | 種別 |
|---|---|---|
| 1 | https://github.blog/changelog/2025-11-05-npm-security-update-classic-token-creation-disabled-and-granular-token-changes/ | 一次 |
| 2 | https://github.blog/changelog/2025-12-09-npm-classic-tokens-revoked-session-based-auth-and-cli-token-management-now-available/ | 一次 |
| 3 | https://github.blog/changelog/2026-07-08-npm-install-time-security-and-gat-bypass2fa-deprecation/ | 一次 |
| 4 | https://github.blog/changelog/2026-07-31-restricting-npm-bypass-2fa-granular-access-tokens/ | 一次 |
| 5 | https://github.blog/security/supply-chain-security/our-plan-for-a-more-secure-npm-supply-chain/ | 一次 |
| 6 | https://docs.npmjs.com/trusted-publishers/ | 一次 |
| 7 | https://github.com/oven-sh/bun/issues/22423 | 一次 |
| 8 | https://github.com/oven-sh/bun/issues/15601 | 一次 |
| 9 | https://github.com/changesets/changesets/issues/1802 | 一次 |
| 10 | https://github.com/npm/cli/issues/8544 | 一次 |
| 11 | https://gist.github.com/kettanaito/debde3cabfae4f68d37cf0f8f3a6a666 | 二次 |
| 12 | https://github.blog/changelog/2026-02-18-npm-bulk-trusted-publishing-config-and-script-security-now-generally-available/ | 一次 |
| 13 | https://github.blog/changelog/2026-06-09-upcoming-breaking-changes-for-npm-v12/ | 一次 |
| 14 | https://docs.npmjs.com/cli/v12/commands/npm-publish/ | 一次 |
| 15 | https://github.blog/changelog/2026-07-28-npm-publish-time-malware-scanning-and-dual-use-metadata/ | 一次 |
| 16 | https://bun.com/docs/pm/catalogs#publishing | 一次 |
| 17 | https://bun.com/docs/pm/cli/publish | 一次 |
| 18 | https://github.blog/security/supply-chain-security/strengthening-supply-chain-security-preparing-for-the-next-malware-campaign/ | 一次 |
| 19 | https://github.com/harekrishnarai/software-supply-chain-monitor/blob/main/attacks/2025-late-shai-hulud-worm.md | 二次 |
| 20 | https://docs.npmjs.com/requiring-2fa-for-package-publishing-and-settings-modification/ | 一次 |
| 21 | https://docs.npmjs.com/cli/v11/commands/npm-trust/ | 一次 |
| 22 | https://docs.npmjs.com/generating-provenance-statements/ | 一次 |
| 23 | https://docs.npmjs.com/staged-publishing/ | 一次 |
| 24 | https://github.blog/changelog/2026-05-22-staged-publishing-and-new-install-time-controls-for-npm/ | 一次 |
| 25 | https://github.com/oven-sh/bun/issues/24855 | 一次 |
| 26 | https://bun.com/docs（全文 grep。provenance / OIDC の記載なし） | 一次 |
| 27 | https://bun.com/docs/pm/npmrc | 一次 |
| 28 | https://bun.com/blog/bun-v1.4 | 一次 |
| 29 | https://bun.com/docs/pm/cli/install | 一次 |
| 30 | https://bun.com/docs/pm/cli/install#minimum-release-age | 一次 |
| 31 | https://bun.com/docs/runtime/bunfig | 一次 |
| 32 | https://bun.com/docs/pm/lifecycle#trusteddependencies | 一次 |
| 33 | https://bun.com/docs/pm/cli/audit | 一次 |
| 34 | https://bun.com/docs/pm/security-scanner-api | 一次 |
| 35 | https://bun.com/docs/pm/cli/pm | 一次 |
