# PoE2Scout API Client

PoE2Scout.com の API クライアントライブラリです。

## 使用方法

```javascript
import {
  getLeagues,
  getUniqueItems,
  getCurrencyItems,
  getItemHistory,
} from "./shared/api/poe2scoutClient.js";

// リーグ一覧を取得
const leagues = await getLeagues();

// ユニークアイテムを取得
const uniqueItems = await getUniqueItems("accessory", {
  league: "Standard",
  page: 1,
  perPage: 25,
});

// 通貨アイテムを取得
const currencyItems = await getCurrencyItems("currency", {
  league: "Standard",
});

// アイテム履歴を取得
const history = await getItemHistory(123, {
  league: "Standard",
  logCount: 100,
});
```

## 利用可能な関数

### アイテム関連

- `getCategories()` - カテゴリ一覧を取得
- `getUniqueItems(category, options)` - ユニークアイテムを取得
- `getCurrencyItems(category, options)` - 通貨アイテムを取得
- `getAllItems(league)` - 全アイテムを取得
- `getItemHistory(itemId, options)` - アイテム履歴を取得
- `getLandingSplashInfo()` - ランディングスプラッシュ情報を取得
- `getCurrencyItemById(apiId, league)` - API IDで通貨アイテムを取得
- `getFilters()` - フィルターを取得

### リーグ関連

- `getLeagues()` - リーグ一覧を取得

### 通貨交換関連

- `getCurrencyExchangeSnapshot(league)` - 通貨交換スナップショットを取得
- `getCurrencyExchangeSnapshotHistory(options)` - スナップショット履歴を取得
- `getCurrencyExchangeSnapshotPairs(league)` - スナップショットペアを取得
- `getCurrencyExchangePairHistory(options)` - ペア履歴を取得

## エラーハンドリング

すべての関数は Promise を返します。エラーが発生した場合は例外がスローされます。

```javascript
try {
  const items = await getUniqueItems("accessory", { league: "Standard" });
} catch (error) {
  console.error("API request failed:", error);
}
```
