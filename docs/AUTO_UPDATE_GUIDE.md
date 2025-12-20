# 自動アップデート機能 実装ガイド

## 📋 概要

PoE Goblinに自動アップデート機能を実装しました。この機能により、ユーザーは常に最新バージョンを簡単に入手できます。

## ✨ 実装された機能

### 1. 起動時の自動チェック
- アプリ起動から5秒後に自動的に最新バージョンをチェック
- GitHub Releasesから`latest.yml`を取得

### 2. インストーラー版の自動アップデート
- `electron-updater`を使用
- 新バージョン検出 → ダウンロード → インストール の流れが全自動
- ユーザーは「ダウンロード」と「再起動」ボタンをクリックするだけ

### 3. ポータブル版の対応
- GitHub APIを使用して最新バージョンをチェック
- 新バージョンがあればダウンロードページへのリンクを表示
- 自動インストールは不可（ポータブル版の性質上）

### 4. 設定画面のUI
- 現在のバージョン表示
- 「アップデートを確認」ボタン
- アップデート状態の表示（確認中、最新、利用可能）

### 5. GitHub Actions連携
- タグをプッシュすると自動的にビルド＆リリース
- `latest.yml`も自動でアップロード

## 📁 実装ファイル

```
poe-goblin/
├── .github/
│   └── workflows/
│       └── release.yml                    # 自動リリースワークフロー
├── docs/
│   ├── RELEASE_GUIDE.md                   # 手動リリース手順書
│   └── AUTO_UPDATE_GUIDE.md               # このファイル
├── src/
│   ├── main/
│   │   ├── main.js                        # アップデート機能を統合
│   │   └── utils/
│   │       └── autoUpdater.js             # アップデート処理のコア
│   ├── preload/
│   │   └── preload.js                     # IPC API追加
│   └── renderer/
│       └── index.html                     # 設定UIに追加
├── package.json                           # publish設定、依存関係追加
└── README.md                              # 機能説明追加
```

## 🔧 技術仕様

### 使用パッケージ

```json
{
  "electron-updater": "^6.6.2",
  "electron-log": "^5.4.3"
}
```

### package.json の publish 設定

```json
{
  "build": {
    "publish": [
      {
        "provider": "github",
        "owner": "ponponutube-byte",
        "repo": "poe-goblin"
      }
    ]
  }
}
```

### IPC API

#### Main → Renderer

| イベント | データ | 説明 |
|---------|--------|------|
| `update-download-started` | なし | ダウンロード開始 |
| `update-download-progress` | `{percent, transferred, total}` | ダウンロード進捗 |

#### Renderer → Main

| ハンドラー | 戻り値 | 説明 |
|-----------|--------|------|
| `check-for-updates-manual` | `{success, hasUpdate, version, isPortable}` | 手動アップデートチェック |
| `get-app-version` | `{success, version}` | 現在のバージョン取得 |

## 🔄 動作フロー

### インストーラー版

```
アプリ起動
   ↓
5秒待機
   ↓
autoUpdater.checkForUpdates()
   ↓
GitHub Releases の latest.yml をチェック
   ↓
┌─────────────┴─────────────┐
│                           │
新バージョンあり          最新
│                           │
ダイアログ表示              ログ出力のみ
「ダウンロード」「後で」
│
ダウンロード
│
ダイアログ表示
「今すぐ再起動」「後で」
│
autoUpdater.quitAndInstall()
│
アプリ終了 → インストール → 再起動
```

### ポータブル版

```
アプリ起動
   ↓
5秒待機
   ↓
GitHub API で最新リリースをチェック
   ↓
┌─────────────┴─────────────┐
│                           │
新バージョンあり          最新
│                           │
ダイアログ表示              ログ出力のみ
「ダウンロードページを開く」
│
shell.openExternal(url)
```

## 🚀 リリース方法

### 自動リリース（推奨）

```bash
# 1. バージョン更新
code package.json  # "version": "0.2.0" に変更

# 2. コミット＆プッシュ
git add package.json
git commit -m "Bump version to 0.2.0"
git push

# 3. タグ作成＆プッシュ
git tag v0.2.0
git push origin v0.2.0

# 4. GitHub Actionsが自動実行
# → ビルド完了まで約10-15分
# → https://github.com/ponponutube-byte/poe-goblin/releases で確認
```

### 手動リリース

詳細は [docs/RELEASE_GUIDE.md](RELEASE_GUIDE.md) を参照してください。

## ⚠️ 注意事項

### 1. latest.yml の重要性

`latest.yml`がないと自動アップデート機能が動作しません。必ず以下を確認：

- [ ] `npm run build` で `dist/latest.yml` が生成される
- [ ] GitHub Release に `latest.yml` をアップロード
- [ ] `latest.yml` の内容が正しい（バージョン、SHA512ハッシュ）

### 2. 初回リリース（v0.1.0）では動作しない

理由: `latest.yml` が存在しないため

対応: v0.1.1 以降で動作開始

### 3. コード署名なし

影響: Windows Defender が警告を表示

対応案:
- README に説明を記載（実装済み）
- 将来的にコード署名証明書を取得（年間$300-500程度）

### 4. GitHub API レート制限

制限: 認証なしで60回/時間

対応:
- 起動時チェックのみ（頻繁なチェックはしない）
- エラー時は静かに失敗（ユーザーに通知しない）

## 🧪 テスト方法

### ローカルテスト

```bash
# アプリを起動
npm start

# 確認項目:
# 1. 起動から5秒後にコンソールに "[AutoUpdater] ..." のログが出る
# 2. 設定画面に「アップデートを確認」ボタンが表示される
# 3. ボタンを押すとチェックが実行される
```

### リリース後のテスト

1. 旧バージョン（v0.1.0）のアプリをインストール
2. 新バージョン（v0.2.0）をGitHub Releasesで公開
3. 旧バージョンを起動
4. 5秒後にアップデート通知が表示されるか確認

## 📊 ログの確認

### ログファイルの場所

```
Windows:
%USERPROFILE%\AppData\Roaming\PoE Goblin\logs\main.log
```

### ログの内容例

```
[2025-12-20 10:00:00.123] [info] [AutoUpdater] Setting up auto-updater
[2025-12-20 10:00:00.124] [info] [AutoUpdater] Current version: 0.1.0
[2025-12-20 10:00:00.125] [info] [AutoUpdater] Is portable: false
[2025-12-20 10:00:05.200] [info] [AutoUpdater] Checking for updates...
[2025-12-20 10:00:06.500] [info] [AutoUpdater] Update available: 0.2.0
```

## 🔧 トラブルシューティング

### 問題: アップデート通知が表示されない

原因の可能性:
1. `latest.yml` がGitHub Releasesにアップロードされていない
2. ネットワークエラー
3. GitHub APIのレート制限

確認方法:
```bash
# latest.yml が存在するか確認
curl -I https://github.com/ponponutube-byte/poe-goblin/releases/download/v0.2.0/latest.yml

# ログを確認
type "%USERPROFILE%\AppData\Roaming\PoE Goblin\logs\main.log"
```

### 問題: ダウンロードが始まらない

原因: `autoDownload: false` に設定されている

対応: ユーザーが「ダウンロード」ボタンをクリックする必要がある

### 問題: インストールが失敗する

原因の可能性:
1. ファイルが破損している（SHA512ハッシュ不一致）
2. 管理者権限が必要
3. ウイルス対策ソフトがブロックしている

## 📝 今後の改善案

### 短期（Phase 1）
- [ ] ベータチャネルの対応
- [ ] リリースノートの自動表示
- [ ] ダウンロード進捗バーのUI改善

### 中期（Phase 2）
- [ ] 自動アップデートのON/OFF設定
- [ ] アップデートチェック頻度の設定
- [ ] 差分アップデート（パッチ形式）

### 長期（Phase 3）
- [ ] コード署名証明書の取得
- [ ] 複数のリリースチャネル（Stable/Beta/Dev）
- [ ] ロールバック機能

## 📞 参考リンク

- **electron-updater ドキュメント**: https://www.electron.build/auto-update
- **GitHub Actions ドキュメント**: https://docs.github.com/actions
- **セマンティックバージョニング**: https://semver.org/lang/ja/

---

**作成日:** 2025-12-20
**最終更新:** 2025-12-20
**バージョン:** 1.0
