# 📦 PoE Goblin リリース手順書

> **目的:** 新バージョンをGitHub Releasesで公開し、ユーザーがアップデートできるようにする
> **対象:** 手動リリース（将来的にGitHub Actionsで自動化予定）

---

## 📋 事前準備チェックリスト

リリース作業を開始する前に、以下を確認してください：

- [ ] すべての変更がコミット済み
- [ ] ローカルでアプリが正常に動作する
- [ ] `.env` ファイルが設定されている（開発用）
- [ ] `build/icon.png` が存在する
- [ ] `dist/` フォルダを削除（クリーンビルドのため）

```bash
# クリーンアップ
rm -rf dist/
# または Windows PowerShell
Remove-Item -Path "dist" -Recurse -Force -ErrorAction SilentlyContinue
```

---

## 🔢 ステップ1: バージョン番号の決定

### セマンティックバージョニング（SemVer）

```
MAJOR.MINOR.PATCH
例: 0.2.0
```

- **MAJOR (0)**: 大きな破壊的変更
- **MINOR (2)**: 新機能追加（後方互換性あり）
- **PATCH (0)**: バグ修正

### バージョン決定例

| 変更内容 | 現在 | 次のバージョン |
|---------|------|---------------|
| バグ修正のみ | 0.1.0 | 0.1.1 |
| 新機能追加（小規模） | 0.1.0 | 0.2.0 |
| 大規模リファクタリング | 0.1.0 | 1.0.0 |

**今回のバージョン:** `____________` （記入してください）

---

## ✏️ ステップ2: バージョン番号の更新

### 2-1. `package.json` を編集

```bash
# ファイルを開く
code package.json
```

以下の行を変更：

```json
{
  "version": "0.2.0"  // ← ここを新しいバージョンに変更
}
```

### 2-2. 変更を保存して確認

```bash
# 変更内容を確認
git diff package.json
```

---

## 🔨 ステップ3: アプリケーションのビルド

### 3-1. ビルド実行

```bash
npm run build
```

**実行時間:** 約5-10分（初回は長い）

### 3-2. 生成されるファイルを確認

```bash
# Windows PowerShell
dir dist\

# 以下のファイルが存在することを確認：
# ✓ PoE-Goblin-Setup-0.2.0.exe        ← インストーラー版
# ✓ PoE-Goblin-0.2.0-portable.exe     ← ポータブル版
# ✓ latest.yml                         ← アップデート情報（重要！）
# ✓ builder-debug.yml                  ← デバッグ情報（不要）
```

### 3-3. ファイルサイズの確認

```bash
# Windows PowerShell
Get-ChildItem dist\*.exe | Select-Object Name, @{Name="Size(MB)";Expression={[math]::Round($_.Length / 1MB, 2)}}
```

**期待値:** 各EXEファイルが 140-160 MB 程度

---

## 📝 ステップ4: リリースノートの準備

### 4-1. 変更内容をまとめる

以下のテンプレートを使用してリリースノートを作成：

```markdown
## 🎉 PoE Goblin v0.2.0

### ✨ 新機能
- [追加] 自動アップデート機能
- [追加] ホットキーのカスタマイズ機能

### 🐛 バグ修正
- [修正] クリップボードが空の場合のエラー
- [修正] 日本語アイテム名の検索精度向上

### 🔧 改善
- [改善] UI のレスポンス速度向上
- [改善] キャッシュ機能の最適化

### 📦 ダウンロード
- **インストーラー版:** `PoE-Goblin-Setup-0.2.0.exe` （推奨）
- **ポータブル版:** `PoE-Goblin-0.2.0-portable.exe`

### ⚠️ 注意事項
- Windows Defender が警告を表示する場合があります（コード署名なし）
- 「詳細情報」→「実行」で起動できます

---

**Full Changelog**: https://github.com/ponponutube-byte/poe-goblin/compare/v0.1.0...v0.2.0
```

このテキストを `RELEASE_NOTES.md` などに一時保存しておく。

---

## 🏷️ ステップ5: Gitコミットとタグの作成

### 5-1. 変更をコミット

```bash
# ステージング
git add package.json

# コミット（バージョン番号を含める）
git commit -m "Bump version to 0.2.0"

# リモートにプッシュ
git push origin main
```

### 5-2. Gitタグを作成

```bash
# タグ作成（アノテーション付き）
git tag -a v0.2.0 -m "Release v0.2.0"

# タグをリモートにプッシュ
git push origin v0.2.0
```

### 5-3. タグが作成されたことを確認

```bash
# ローカルタグ一覧
git tag

# リモートで確認（ブラウザで開く）
# https://github.com/ponponutube-byte/poe-goblin/tags
```

---

## 🚀 ステップ6: GitHub Release の作成

### 6-1. GitHub Releases ページを開く

```
https://github.com/ponponutube-byte/poe-goblin/releases/new
```

### 6-2. リリース情報を入力

| 項目 | 入力内容 |
|------|---------|
| **Choose a tag** | `v0.2.0` を選択 |
| **Release title** | `PoE Goblin v0.2.0` |
| **Description** | ステップ4で作成したリリースノートを貼り付け |
| **Attach binaries** | 👇 次のステップで追加 |

### 6-3. ファイルをアップロード

以下の3つのファイルを **ドラッグ&ドロップ** でアップロード：

```
dist/PoE-Goblin-Setup-0.2.0.exe
dist/PoE-Goblin-0.2.0-portable.exe
dist/latest.yml                      ← 忘れずに！
```

**⚠️ 重要:** `latest.yml` がないと自動アップデート機能が動作しません！

### 6-4. リリースオプション

- [ ] **Set as a pre-release**: チェックしない（正式版の場合）
- [x] **Set as the latest release**: チェックする（最新版として公開）
- [ ] **Create a discussion**: オプション（コミュニティがある場合）

### 6-5. リリースを公開

**"Publish release"** ボタンをクリック

---

## ✅ ステップ7: リリース後の確認

### 7-1. リリースページの確認

```
https://github.com/ponponutube-byte/poe-goblin/releases/latest
```

以下を確認：
- [ ] バージョン番号が正しい
- [ ] 3つのファイルがダウンロード可能
- [ ] リリースノートが正しく表示される

### 7-2. `latest.yml` の内容確認

```
https://github.com/ponponutube-byte/poe-goblin/releases/download/v0.2.0/latest.yml
```

ブラウザで開いて、以下が含まれることを確認：
```yaml
version: 0.2.0
files:
  - url: PoE-Goblin-Setup-0.2.0.exe
    sha512: ...
path: PoE-Goblin-Setup-0.2.0.exe
releaseDate: '2025-...'
```

### 7-3. アップデート機能のテスト

```bash
# 前バージョンのアプリを起動して、アップデート通知が表示されるか確認
# （自動アップデート機能実装後）
```

---

## 🔄 ステップ8: 後処理

### 8-1. ローカルの dist フォルダをクリーンアップ（オプション）

```bash
# Windows PowerShell
Remove-Item -Path "dist" -Recurse -Force
```

### 8-2. 次の開発サイクルの準備

```bash
# 新しいブランチを作成（次のバージョン開発用）
git checkout -b develop

# または main ブランチで継続
git checkout main
```

---

## 📊 リリース作業チェックシート

リリース完了後、以下をチェック：

- [ ] バージョン番号が更新されている（`package.json`）
- [ ] ビルドが成功した（`dist/` に3つのファイル）
- [ ] Gitコミット＆プッシュ済み
- [ ] Gitタグ作成＆プッシュ済み（`v0.x.x`）
- [ ] GitHub Release 作成済み
- [ ] 3つのファイルをアップロード済み（**`latest.yml` を含む**）
- [ ] リリースを公開済み
- [ ] ダウンロードリンクが正常に動作する
- [ ] `latest.yml` の内容が正しい

---

## 🤖 自動化への移行メモ

将来的にGitHub Actionsで自動化する場合、以下のステップを置き換えます：

| 手動手順 | GitHub Actions での置き換え |
|---------|---------------------------|
| ステップ3: ビルド | `npm run build` をワークフロー内で実行 |
| ステップ6: Release作成 | `softprops/action-gh-release` アクションで自動化 |
| ステップ6-3: ファイルアップロード | `files:` パラメータで指定 |

**トリガー:** タグプッシュ（`git push origin v0.x.x`）で自動実行

---

## ⚠️ トラブルシューティング

### 問題: ビルドが失敗する

```bash
# 依存関係を再インストール
rm -rf node_modules package-lock.json
npm install
npm run build
```

### 問題: タグプッシュが拒否される

```bash
# タグが既に存在する場合は削除
git tag -d v0.2.0
git push origin :refs/tags/v0.2.0

# 再作成
git tag -a v0.2.0 -m "Release v0.2.0"
git push origin v0.2.0
```

### 問題: `latest.yml` が生成されない

```bash
# package.json の build 設定を確認
# "publish" 設定が必要
```

---

## 📞 参考リンク

- **リポジトリ:** https://github.com/ponponutube-byte/poe-goblin
- **リリース一覧:** https://github.com/ponponutube-byte/poe-goblin/releases
- **electron-builder ドキュメント:** https://www.electron.build/

---

**作成日:** 2025-12-20
**最終更新:** 2025-12-20
**バージョン:** 1.0
