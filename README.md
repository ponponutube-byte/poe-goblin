# PoE Goblin

Path of Exile 2 の価格チェックツール（日本語対応）

## ダウンロード

[Releases](https://github.com/yourusername/poe-goblin/releases)から最新版をダウンロードしてください。

### インストール版
`PoE-Goblin-Setup-x.x.x.exe` をダウンロードして実行

### ポータブル版（推奨）
`PoE-Goblin-x.x.x-portable.exe` をダウンロードして直接実行（インストール不要）

## 使い方

1. アプリを起動
2. PoE2でアイテムにカーソルを合わせる
3. **`Ctrl+C`** でアイテムをコピー
4. **`Ctrl+G`** で価格表示ウィンドウを開く
5. **`Esc`** または画面外クリックで閉じる

### ホットキーの変更
- アプリ内の「設定」ボタンからホットキーをカスタマイズできます

### アップデート
- アプリ起動時に自動で最新版をチェックします
- 設定画面の「アップデートを確認」ボタンで手動チェックも可能
- **インストーラー版**: 新バージョンがあれば自動ダウンロード→ワンクリックでインストール
- **ポータブル版**: ダウンロードページへのリンクを表示

---

## 開発者向け

### セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

プロジェクトルートに`.env`ファイルを作成し、以下の内容を追加してください：

```env
API_EMAIL=your-email@example.com
```

このメールアドレスは、PoE2Scout APIへのリクエストのUser-Agentに含まれます。

**注意**: `.env`ファイルは`.gitignore`に含まれているため、Gitにはコミットされません。

### 3. アプリの起動

```bash
npm start
```

## 機能

- クリップボードからPoEアイテム情報を取得
- 日本語/英語クライアント対応
- アイテム履歴の取得と表示
- キャッシュ機能（5分間）
- **自動アップデート機能** ✨ NEW
  - インストーラー版: 自動ダウンロード＆インストール
  - ポータブル版: 最新版の通知とダウンロードページへの誘導

## 使い方

### アイテム情報の取得

1. PoEでアイテムを`Ctrl+C`でコピー
2. Electronアプリで`Ctrl+Shift+P`（または`F9`）を押す
3. ターミナルにアイテム情報が表示されます

### アイテム履歴の表示

1. アプリを起動
2. `F9`キーを押す
3. 高貴なオーブの過去4回の価格履歴が表示されます

## 開発

### アイテムマップの生成

```bash
# テンプレートの作成
npm run create:mapping-template

# マップの生成
npm run build:item-map
```

### 日本語名のスクレイピング

poe2db.twから日本語のアイテム名を取得してマッピングを更新する手順は、[スクレイピングガイド](docs/SCRAPING_GUIDE.md)を参照してください。

**クイックスタート:**

```bash
# 1. カテゴリパスの抽出（初回のみ）
node scripts/parseItemsPage.js

# 2. 日本語名のスクレイピング
npm run fetch:japanese-names

# 3. itemMap.jsonの再構築
npm run build:item-map
```

## ビルド（配布用実行ファイルの作成）

### 必要な準備

1. アイコン画像を `build/icon.png` に配置（512x512px推奨）
2. `.env` ファイルは含まれないので、ユーザーに作成方法を案内してください

### ビルドコマンド

```bash
# インストーラー版 + ポータブル版を両方ビルド
npm run build

# ポータブル版のみビルド
npm run build:portable
```

### 生成されるファイル

ビルド後、`dist/`フォルダに以下のファイルが生成されます：

- `PoE-Goblin-Setup-0.1.0.exe` - インストーラー版（約150MB）
- `PoE-Goblin-0.1.0-portable.exe` - ポータブル版（約150MB）

### 配布方法

#### 自動リリース（GitHub Actions）

タグをプッシュするだけで自動的にビルド＆リリースされます：

```bash
# バージョン更新
# package.json の "version" を編集

# コミット＆タグ
git add package.json
git commit -m "Bump version to 0.2.0"
git push
git tag v0.2.0
git push origin v0.2.0

# GitHub Actionsが自動実行
# → ビルド → リリース作成 → ファイルアップロード
```

詳しくは [docs/RELEASE_GUIDE.md](docs/RELEASE_GUIDE.md) を参照してください。

#### 手動リリース

GitHubのReleasesページで新しいリリースを作成：

1. GitHubのReleasesページで新しいリリースを作成
2. `dist/`フォルダ内の以下のファイルをアップロード：
   - `PoE-Goblin-Setup-x.x.x.exe`
   - `PoE-Goblin-x.x.x-portable.exe`
   - `latest.yml` ⚠️ **重要**: これがないと自動アップデートが動作しません
3. リリースノートを記載

#### Zipで配布

```
PoE-Goblin-v0.1.0.zip
├── PoE-Goblin-0.1.0-portable.exe
└── README.txt (使い方の簡単な説明)
```

### 注意事項

- 初回ビルドは時間がかかります（5-10分程度）
- ファイルサイズは約150MBになります（Electronランタイムを含むため）
- Windows Defenderが警告を出す場合があります（コード署名証明書がないため）

## ライセンス

MIT
