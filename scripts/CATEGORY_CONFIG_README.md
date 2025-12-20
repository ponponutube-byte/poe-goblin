# カテゴリ設定ベースのパース処理

## 概要

`fetchJapaneseNames.js` をリファクタリングし、カテゴリごとに異なるHTML構造に対応できる柔軟なパース処理を実装しました。

## ファイル構成

### 1. `scripts/category_config.json`
カテゴリとパーサーの設定を管理するJSONファイル（Git管理対象）

**構造:**
```json
{
  "categories": [
    {
      "path": "カテゴリパス",
      "name": "日本語名",
      "parserType": "パーサータイプ",
      "enabled": true/false,
      "description": "説明"
    }
  ],
  "parserTypes": {
    "パーサータイプ名": {
      "description": "説明",
      "selectors": ["CSSセレクタ"],
      "extractionStrategy": "戦略名"
    }
  }
}
```

### 2. `scripts/fetchJapaneseNames.js`
設定ベースでHTMLをパースし、日本語名マッピングを更新するスクリプト

## 実装された抽出戦略

### 1. `linkText`
標準的なリンクテキストから日本語名を抽出
- 使用カテゴリ: Stackable_Currency, Essence, Liquid_Emotions, Splinter, Catalysts

### 2. `linkTextOrTableCell`
リンクテキストまたはテーブルセル内のテキストから抽出
- 使用カテゴリ: Augment, Trial_of_the_Sekhemas, The_Trial_of_Chaos

### 3. `uniqueNameSpan`
`<span class="uniqueName">` 要素から抽出（Uniqueアイテム用）
- 使用カテゴリ: Unique_item

### 4. `flexible`
複数の方法を順番に試行（最も柔軟な戦略）
- 使用カテゴリ: The_Burning_Monolith

## 使用方法

### カテゴリの有効化/無効化

`scripts/category_config.json` で `enabled` フラグを変更：

```json
{
  "path": "Augment",
  "name": "オーグメント",
  "parserType": "augment",
  "enabled": true  // true: 有効, false: 無効
}
```

### スクリプトの実行

```bash
cd scripts
node fetchJapaneseNames.js
```

### 新しいカテゴリの追加

1. `category_config.json` の `categories` に追加：
```json
{
  "path": "New_Category",
  "name": "新カテゴリ",
  "parserType": "standard",  // または新しいパーサータイプ
  "enabled": true,
  "description": "説明"
}
```

2. 新しいパーサータイプが必要な場合、`parserTypes` に追加：
```json
"newParser": {
  "description": "新パーサーの説明",
  "selectors": ["a.new-selector"],
  "extractionStrategy": "linkText"  // または新しい戦略
}
```

3. 新しい抽出戦略が必要な場合、`fetchJapaneseNames.js` の `EXTRACTION_STRATEGIES` に追加

## 利点

### 1. 保守性の向上
- カテゴリごとに独立した設定
- 変更が他のカテゴリに影響しない

### 2. 拡張性
- 新しいカテゴリは設定ファイルに追加するだけ
- 新しいパーサータイプも簡単に追加可能

### 3. 可読性
- 各カテゴリの設定が明確
- 説明フィールドでドキュメント化

### 4. テストの容易さ
- 特定のカテゴリだけを有効にしてテスト可能
- デバッグHTML自動保存機能

## 設定されているカテゴリ

1. **Stackable_Currency** - スタック可能通貨
2. **Augment** - オーグメント
3. **Omen** - オーメン
4. **Essence** - エッセンス
5. **Liquid_Emotions** - リキッドエモーション
6. **Splinter** - スプリンター
7. **Catalysts** - カタリスト
8. **Unique_item** - ユニークアイテム
9. **Trial_of_the_Sekhemas** - セケマの試練
10. **The_Trial_of_Chaos** - カオスの試練
11. **The_Burning_Monolith** - バーニングモノリス

## デバッグ

アイテムが見つからない場合、`scripts/tmp/debug_[カテゴリパス].html` にHTMLが保存されます。
このファイルを確認して、適切なCSSセレクタを特定できます。
