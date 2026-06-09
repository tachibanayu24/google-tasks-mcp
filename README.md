# google-tasks-mcp

**Cloudflare Workers** 上で動く **Google Tasks** 向けの Remote MCP サーバ。
Streamable HTTP transport で、Claude の iOS / Android アプリの **Custom Connector** から直接タスクを読み書きできる。

> 個人用途・MIT License。モバイル対応 Remote MCP の構築パターンを一通り揃えた実装例として公開。姉妹プロジェクト: [fitbit-googlehealth-mcp](https://github.com/tachibanayu24/fitbit-googlehealth-mcp)。

---

## 何ができるか

15 個の MCP ツールで Google Tasks API を網羅:

### Read (5)

| Tool | やること |
|---|---|
| `list_tasklists` | タスクリスト一覧取得 |
| `get_tasklist` | 特定リストのメタデータ取得 |
| `list_tasks` | タスク一覧 (`showCompleted`/`showHidden`/`showDeleted`/期限フィルタ) |
| `list_completed` | 完了・`clear_completed` 済みタスク一覧 (`list_tasks` では見えない hidden を含む) |
| `get_task` | 単一タスクの全フィールド |

### Write (7)

| Tool | やること |
|---|---|
| `create_task` | タスク作成 (`parent` / `previous` でサブタスク化・並び順指定) |
| `update_task` | タスク部分更新 (PATCH、`status` 以外) |
| `complete_task` | 完了化 (Google が `completed` 自動セット) |
| `uncomplete_task` | 未完了に戻す (`completed` を明示的に null に) |
| `move_task` | 並び替え・サブタスク化・リスト間移動 |
| `delete_task` | 物理削除 |
| `clear_completed` | 完了タスクを `hidden=true` に (物理削除ではない) |

### TaskList CRUD (3)

| Tool | やること |
|---|---|
| `create_tasklist` | 新規タスクリスト作成 |
| `update_tasklist` | タスクリスト名変更 |
| `delete_tasklist` | タスクリスト削除 (含まれるタスクも全て消える) |

---

## 既存 OSS との比較

| | Transport | デプロイ | Tool 数 | `move` | tasklist CRUD | Claude モバイル |
|---|---|---|---|---|---|---|
| zcaceres/gtasks-mcp | stdio | ローカル | 7 | ✗ | ✗ | ✗ |
| arpitbatra123/mcp-googletasks | stdio | ローカル | 15 | ✓ | ✓ | ✗ |
| gsdv/google-tasks-mcp | Streamable HTTP | Node/HTTP | 6 | ✗ | ✗ | ◯ |
| **google-tasks-mcp (本プロジェクト)** | **Streamable HTTP** | **Cloudflare Workers** | **15** | **✓** | **✓** | **◯** |

Google Tasks API 特有の挙動 (`due` は時刻破棄 / `clear_completed` は hide / hidden と deleted の違い / assignment タスクの移動制約) は、ツールの `description` と Zod schema、`GoogleApiError` の hint で吸収している。

---

## 前提

- Google アカウント (Google Tasks を普段使いしているもの)
- Google Cloud OAuth Client: **Desktop app タイプ** (ループバック callback は自動許可なので redirect URI の事前登録は不要)
- [Google Tasks API](https://console.cloud.google.com/apis/library/tasks.googleapis.com) を同プロジェクトで有効化
- Cloudflare Workers (Free プランで十分) + `wrangler` CLI でログイン済み
- Node.js 20+ / pnpm 9+

---

## セットアップ 5 ステップ

### 1. Clone + install

```bash
git clone https://github.com/tachibanayu24/google-tasks-mcp.git
cd google-tasks-mcp
pnpm install
```

### 2. Google Cloud OAuth Client を作成

1. [Google Cloud Console](https://console.cloud.google.com/) で新規プロジェクトを作成 (または既存を選択)
2. **API とサービス → ライブラリ** で **Google Tasks API** を有効化
3. **API とサービス → OAuth 同意画面** を設定
   - User Type: **外部**
   - ⚠️ 設定後、**「アプリを公開」で公開ステータスを「本番環境 (In production)」にすること。** 「テスト (Testing)」のままだと Google が refresh_token を **7 日で失効**させ、1 週間ごとに再認可が必要になる。`auth/tasks` は sensitive scope だが Google の verification は不要 (認可時に「未確認のアプリ」警告が出るだけ)。本番ステータスで発行した refresh_token は revoke / 6 ヶ月未使用 / パスワード変更まで生き続ける。
   - (テストモードのまま試す場合のみ、テストユーザーに自分の Google アカウントを追加。ただし上記の 7 日失効に注意。)
4. **API とサービス → 認証情報** → **+ 認証情報を作成** → **OAuth クライアント ID**
   - **アプリケーションの種類**: **デスクトップ アプリ**
   - 名前は任意 (例: `google-tasks-mcp-cli`)
   - → **作成**
   - ℹ️ デスクトップ アプリ タイプではリダイレクト URI 設定欄は UI に出てこない。ループバック (`http://127.0.0.1:*` / `http://localhost:*`) は自動許可されるため事前登録は不要 ([Google 公式ドキュメント](https://developers.google.com/identity/protocols/oauth2/native-app#loopback))。
5. 発行された **クライアント ID** と **クライアント シークレット** をメモ

### 3. 初回 OAuth 認可 (ローカル 1 回だけ)

```bash
export GOOGLE_CLIENT_ID="<上記のClient ID>"
export GOOGLE_CLIENT_SECRET="<上記のClient secret>"
pnpm run setup:google-tasks
```

ブラウザが開いて Google 認可画面 → 承認すると `127.0.0.1:8787` に戻ってきて、ターミナルに `refresh_token` と次に実行すべき `wrangler` コマンド群が表示される。

### 4. Cloudflare Workers に投入

#### 4-1. `wrangler.toml` を自分用に作成

```bash
cp wrangler.toml.example wrangler.toml
# ↓ KV ID を差し込む
pnpm wrangler kv:namespace create TOKENS
# 出力された id を wrangler.toml の `id = "<your-tokens-namespace-id>"` に貼り付け
```

#### 4-2. Secrets 投入

```bash
pnpm wrangler secret put GOOGLE_CLIENT_ID
pnpm wrangler secret put GOOGLE_CLIENT_SECRET
pnpm wrangler secret put MCP_SHARED_SECRET   # `openssl rand -base64 32` で生成
```

#### 4-3. KV にトークン投入

setup CLI の stdout に出た `wrangler kv key put` コマンドをそのまま実行。**wrangler v4 では `kv key put` のデフォルトが `--local` (simulator) に変わっているので `--remote` を付け忘れると本番 KV に届かない** (秘蔵の落とし穴)。

```bash
pnpm wrangler kv key put --remote --binding=TOKENS refresh_token '1//0g...'
pnpm wrangler kv key put --remote --binding=TOKENS access_token  'ya29...'
pnpm wrangler kv key put --remote --binding=TOKENS expires_at    '1760000000'
```

確認:

```bash
pnpm wrangler kv key list --remote --binding=TOKENS
# → refresh_token / access_token / expires_at が並んでいれば OK
```

### 5. Deploy + Claude.ai に登録

```bash
pnpm run deploy   # `pnpm deploy` は pnpm のビルトインに吸われるので `run` 必須
```

→ `https://google-tasks-mcp.<your-subdomain>.workers.dev` が公開される。

Claude.ai (Web) → **Settings → Custom Connectors → Add custom connector** で以下の URL を登録:

```
https://google-tasks-mcp.<your-subdomain>.workers.dev/mcp/<MCP_SHARED_SECRETの値>
```

追加後は iOS / Android の Claude アプリからも同じ Connector が使える (モバイル側では Custom Connector の新規追加はできないため、必ず Web で先に登録すること)。

---

## アーキテクチャ

```
Claude mobile/desktop
      │
      │ Streamable HTTP
      ▼
┌────────────────────────────────────────────────────┐
│ Cloudflare Worker (google-tasks-mcp)              │
│                                                    │
│  POST /mcp/:secret                                │
│    ↓ guardMiddleware                              │
│       ├── SECRET 定時間比較                       │
│       └── CF-Connecting-IP ∈ 160.79.104.0/21      │
│    ↓ @hono/mcp StreamableHTTPTransport            │
│    ↓ McpServer (15 tools)                         │
│    ↓ GoogleTasksProvider                          │
│    ↓ GoogleTasksClient                            │
│       ├── getAccessToken (60s-before refresh)     │
│       ├── 401 → refresh → retry                   │
│       └── 429 → Retry-After sleep → retry         │
│                                                    │
│  KV: TOKENS { access_token, refresh_token,         │
│                expires_at }                        │
└────────────────────────────────────────────────────┘
      │ Bearer token
      ▼
  Google Tasks API
  https://tasks.googleapis.com/tasks/v1/
```

**特徴**:
- Worker 側は OAuth の AuthZ code flow を踏まない (CLI bootstrap 経由で事前取得した refresh_token だけを持つ)。Claude 側に OAuth プロキシを提供する必要がないため構造がシンプルで、モバイル WebView の `disallowed_useragent` ポリシー問題も回避できる。
- Secret を URL path に入れる + Anthropic outbound CIDR 限定の二層。個人用途として必要十分。

---

## セキュリティモデル

| 脅威 | 防御 |
|---|---|
| URL を知らない第三者のアクセス | `MCP_SHARED_SECRET` を URL path に置き timing-safe 比較 |
| secret 漏洩時の他 IP からのアクセス | `CF-Connecting-IP` が Anthropic outbound CIDR (`160.79.104.0/21`) に含まれるかで二層目の制限 |
| Google OAuth token の漏洩 | `wrangler kv` と `wrangler secret` (暗号化保存)。`.dev.vars` と `wrangler.toml` は `.gitignore` |
| refresh_token の revocation | `GoogleAuthError` 発生時は Claude にヒントを返して `setup:google-tasks` の再実行を促す |

---

## トラブルシュート: 認証が切れたとき

Claude から Google Tasks にアクセスできなくなった場合 (`GoogleAuthError` / refresh 失敗)、ほぼ **refresh_token の失効**。KV にトークン 3 点が揃っていても Google 側で無効化されていれば起きる。

**まず根本原因を潰す**: OAuth 同意画面の公開ステータスが「テスト (Testing)」だと refresh_token は **7 日で失効**する。[OAuth 同意画面](https://console.cloud.google.com/auth/audience) を開き、**「本番環境 (In production)」に公開**しておく (セットアップ手順 2-3 の ⚠️ 参照)。

**復旧手順** (Worker のコードは無変更なので `deploy` 不要、KV だけ差し替え):

```bash
export GOOGLE_CLIENT_ID="<Client ID>"
export GOOGLE_CLIENT_SECRET="<Client secret>"
pnpm run setup:google-tasks
# → ブラウザで承認 → 出力された `wrangler kv key put --remote` 3 本をそのまま実行
```

`client_secret` は Worker secret なので読み出せない (KV の refresh_token だけを手で直すことは不可)。必ず setup を再実行して新しいトークン一式を取り直すこと。本番ステータスで発行した refresh_token は revoke / 6 ヶ月未使用 / パスワード変更まで失効しない。

---

## ローカル開発

```bash
pnpm dev       # wrangler dev (port 8787)
pnpm test      # vitest
pnpm typecheck # tsc --noEmit
pnpm lint      # biome check
pnpm format    # biome format --write
```

MCP Inspector での動作確認:

```bash
npx @modelcontextprotocol/inspector
# URL: http://localhost:8787/mcp/dev-secret
# Headers: CF-Connecting-IP: 160.79.105.42
```

---

## 既知の落とし穴 (MCP 層で吸収済み)

| Google Tasks API 側 | どう扱うか |
|---|---|
| `due` の時刻は破棄される | `normalizeDue()` で `YYYY-MM-DD` → `YYYY-MM-DDT00:00:00.000Z` に正規化 |
| `clear_completed` は物理削除でなく hide 化 | ツール名と description で明示、`list_completed` を別ツールで提供 |
| `showCompleted=true` でも hidden は出ない | `list_completed` 内部で `showHidden=true` 固定 |
| サブタスクは 1 階層のみ | description で警告 |
| 繰り返し/割り当てタスクは移動制限 | `GoogleApiError` の 400 hint でその旨通知 |
| `update_task` の `status` と `complete_task` の責務重複 | `update_task` から `status` 引数を物理的に除外し `complete_task` / `uncomplete_task` に誘導 |

---

## Fitbit MCP との関係

姉妹プロジェクト [fitbit-googlehealth-mcp](https://github.com/tachibanayu24/fitbit-googlehealth-mcp) と同じアーキテクチャ・同じ認証パターン・同じコード規約:

- `src/auth/guard.ts` (SECRET + CIDR) は両プロジェクトで同一
- `src/lib/rate-limit.ts` (Retry-After クランプ) も同一
- Provider 層の構造 (`oauth.ts` / `client.ts` / `types.ts`) は 1:1 対応
- Setup CLI (`scripts/setup-*.ts`) のフロー (localhost callback → code → token) も同一

違いは:
- Fitbit は Basic auth + form body / Google は body に client_id + client_secret
- Fitbit は intraday 等でキャッシュ (CACHE KV) が有効 / Google Tasks は軽量なので v0 では CACHE なし
- Fitbit tokens には `user_id` がある / Google Tasks にはない

---

## License

MIT. See [LICENSE](./LICENSE).
