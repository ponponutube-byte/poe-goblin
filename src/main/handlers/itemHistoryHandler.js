/**
 * アイテム履歴ハンドラー
 * API呼び出しとキャッシュ管理
 */

import { getItemHistory } from "../../shared/api/poe2scoutClient.js";

// キャッシュ管理
const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5分

/**
 * キャッシュキーを生成
 * @param {number} itemId - アイテムID
 * @param {string} league - リーグ名
 * @returns {string} キャッシュキー
 */
function getCacheKey(itemId, league) {
  return `${itemId}_${league}`;
}

/**
 * キャッシュからデータを取得
 * @param {number} itemId - アイテムID
 * @param {string} league - リーグ名
 * @returns {Object|null} キャッシュデータ
 */
function getCachedData(itemId, league) {
  const key = getCacheKey(itemId, league);
  const cached = cache.get(key);

  if (!cached) {
    return null;
  }

  // キャッシュの有効期限をチェック
  const now = Date.now();
  if (now - cached.timestamp > CACHE_DURATION) {
    cache.delete(key);
    return null;
  }

  return cached.data;
}

/**
 * データをキャッシュに保存
 * @param {number} itemId - アイテムID
 * @param {string} league - リーグ名
 * @param {Object} data - キャッシュするデータ
 */
function setCachedData(itemId, league, data) {
  const key = getCacheKey(itemId, league);
  cache.set(key, {
    data,
    timestamp: Date.now(),
  });
}

/**
 * アイテム履歴を取得（キャッシュ付き）
 * @param {number} itemId - アイテムID
 * @param {Object} options - オプション
 * @param {string} options.league - リーグ名 (default: "Standard")
 * @param {number} options.logCount - ログ数 (default: 4)
 * @param {string} options.referenceCurrency - 基準通貨 (default: "exalted")
 * @returns {Promise<Object>} 履歴データ
 */
export async function fetchItemHistory(itemId, options = {}) {
  const {
    league = "Standard",
    logCount = 4,
    referenceCurrency = "exalted",
  } = options;

  // キャッシュをチェック
  const cached = getCachedData(itemId, league);
  if (cached) {
    console.log(
      `[Cache] Using cached data for itemId=${itemId}, league=${league}`
    );
    return {
      ...cached,
      cached: true,
    };
  }

  try {
    console.log(
      `[API] Fetching history for itemId=${itemId}, league=${league}`
    );
    const history = await getItemHistory(itemId, {
      league,
      logCount,
      referenceCurrency,
    });

    // APIレスポンスの構造を統一（price_history -> priceLogs）
    // APIは price_history を返すが、コード内では priceLogs として扱う
    const normalizedHistory = {
      ...history,
      priceLogs: history.price_history || history.priceLogs || [],
      hasMore: history.has_more !== undefined ? history.has_more : history.hasMore,
    };

    // キャッシュに保存
    setCachedData(itemId, league, normalizedHistory);

    return {
      ...normalizedHistory,
      cached: false,
    };
  } catch (error) {
    console.error(`[Error] Failed to fetch item history:`, error);
    throw error;
  }
}

/**
 * キャッシュをクリア
 */
export function clearCache() {
  cache.clear();
  console.log("[Cache] Cache cleared");
}
