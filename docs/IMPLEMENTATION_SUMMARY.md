# 自動アップデート機能 実装完了報告

## ✅ 実装完了内容

### 📦 インストール済みパッケージ
- `electron-updater@6.6.2` - 自動アップデート機能
- `electron-log@5.4.3` - ログ出力

### 📝 作成・更新ファイル

1. **docs/RELEASE_GUIDE.md** - 手動リリース手順書
2. **docs/AUTO_UPDATE_GUIDE.md** - 自動アップデート実装ガイド
3. **src/main/utils/autoUpdater.js** - アップデート処理のコアロジック
4. **src/main/main.js** - アップデート機能を統合
5. **src/preload/preload.js** - IPC APIを追加
6. **src/renderer/index.html** - 設定UIに「アップデートを確認」機能を追加
7. **.github/workflows/release.yml** - 自動リリースワークフロー
8. **package.json** - publish設定と依存関係を追加
9. **README.md** - 機能説明を更新

## 🎯 実装された機能

### 1. 起動時の自動チェック（5秒後）
- GitHub Releasesから最新バージョンをチェック
- 新バージョンがあればダイアログで通知

### 2. インストーラー版
- 自動ダウンロード＆インストール
- 進捗表示
- ワンクリックで再起動＆アップデート

### 3. ポータブル版
- GitHub APIで最新バージョンをチェック
- ダウンロードページへの誘導

### 4. 設定画面
- 現在のバージョン表示
- 「アップデートを確認」ボタン
- アップデート状態の表示

### 5. GitHub Actions
- タグプッシュで自動ビルド＆リリース
- `latest.yml`も自動アップロード

## 🚀 使用方法

### リリース手順（自動）

```bash
# 1. バージョン更新
# package.json の "version" を編集

# 2. コミット＆タグ
git add .
git commit -m "feat: 自動アップデート機能を追加"
git push
git tag v0.2.0
git push origin v0.2.0

# 3. GitHub Actionsが自動実行
# → 約10-15分後にリリース完成
```

### 手動リリース

詳細は `docs/RELEASE_GUIDE.md` を参照

## 📋 次のステップ

### テスト方法

```bash
# ローカルで動作確認
npm start

# 確認項目:
# 1. 起動5秒後にコンソールに [AutoUpdater] ログが出る
# 2. 設定画面に「アップデートを確認」ボタンがある
# 3. バージョン情報が表示される
```

### 初回リリース作成

```bash
# 現在のバージョンでビルド
npm run build

# タグを作成してプッシュ
git tag v0.1.0
git push origin v0.1.0

# GitHub Releasesで確認
# https://github.com/ponponutube-byte/poe-goblin/releases
```

## ⚠️ 重要な注意点

1. **latest.ymlの必須性**
   - ビルド時に自動生成される
   - GitHub Releaseに必ずアップロードすること
   - これがないと自動アップデートが動作しない

2. **初回リリース（v0.1.0）**
   - 自動アップデート機能は動作しない（latest.ymlが存在しないため）
   - v0.1.1以降で機能開始

3. **コード署名なし**
   - Windows Defenderが警告を表示
   - ユーザーは「詳細情報」→「実行」で起動可能

## 📚 ドキュメント

- **リリース手順**: `docs/RELEASE_GUIDE.md`
- **実装ガイド**: `docs/AUTO_UPDATE_GUIDE.md`
- **メインREADME**: `README.md`

---

実装は完了しました。npm start で動作確認を行ってください！
