/**
 * PoE2Scout API Client
 * https://poe2scout.com/api
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// .envファイルを読み込む
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, "../../../.env");
dotenv.config({ path: envPath });

const API_BASE_URL = "https://poe2scout.com/api";
const API_EMAIL = process.env.API_EMAIL || "";

/**
 * User-Agent文字列を生成
 * @returns {string} User-Agent文字列
 */
function getUserAgent() {
  const baseUA = "PoE-Goblin/0.1.0";
  if (API_EMAIL) {
    return `${baseUA} Email:(${API_EMAIL})`;
  }
  return baseUA;
}

/**
 * API リクエストの基本関数
 * @param {string} endpoint - APIエンドポイント
 * @param {Object} params - クエリパラメータ
 * @returns {Promise<any>} APIレスポンス
 */
async function apiRequest(endpoint, params = {}) {
  const url = new URL(`${API_BASE_URL}${endpoint}`);

  // クエリパラメータを追加
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, value.toString());
    }
  });

  try {
    const userAgent = getUserAgent();
    console.log(`[API Request] ${endpoint}`);
    console.log(`[API Request] URL: ${url.toString()}`);
    console.log(`[API Request] User-Agent: ${userAgent}`);

    const response = await fetch(url.toString(), {
      headers: {
        "User-Agent": userAgent,
      },
    });

    console.log(
      `[API Response] Status: ${response.status} ${response.statusText}`
    );
    console.log(
      `[API Response] Headers:`,
      Object.fromEntries(response.headers.entries())
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[API Error] Response body:`, errorText);
      throw new Error(
        `API request failed: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    console.log(`[API Response] Data:`, JSON.stringify(data, null, 2));
    return data;
  } catch (error) {
    console.error(`[API Error] ${endpoint}:`, error);
    throw error;
  }
}

/**
 * アイテムカテゴリを取得
 * @returns {Promise<Object>} カテゴリレスポンス
 */
export async function getCategories() {
  return apiRequest("/items/categories");
}

/**
 * ユニークアイテムを取得
 * @param {string} category - カテゴリ
 * @param {Object} options - オプション
 * @param {string} options.referenceCurrency - 基準通貨 (default: "exalted")
 * @param {string} options.search - 検索文字列
 * @param {number} options.page - ページ番号 (default: 1)
 * @param {number} options.perPage - 1ページあたりのアイテム数 (default: 25, max: 250)
 * @param {string} options.league - リーグ名 (default: "Standard")
 * @returns {Promise<Object>} ユニークアイテムレスポンス
 */
export async function getUniqueItems(category, options = {}) {
  const {
    referenceCurrency = "exalted",
    search = "",
    page = 1,
    perPage = 25,
    league = "Standard",
  } = options;

  return apiRequest(`/items/unique/${category}`, {
    referenceCurrency,
    search,
    page,
    perPage,
    league,
  });
}

/**
 * 通貨アイテムを取得
 * @param {string} category - カテゴリ
 * @param {Object} options - オプション
 * @param {string} options.referenceCurrency - 基準通貨 (default: "exalted")
 * @param {string} options.search - 検索文字列
 * @param {number} options.page - ページ番号 (default: 1)
 * @param {number} options.perPage - 1ページあたりのアイテム数 (default: 25, max: 250)
 * @param {string} options.league - リーグ名 (default: "Standard")
 * @returns {Promise<Object>} 通貨アイテムレスポンス
 */
export async function getCurrencyItems(category, options = {}) {
  const {
    referenceCurrency = "exalted",
    search = "",
    page = 1,
    perPage = 25,
    league = "Standard",
  } = options;

  return apiRequest(`/items/currency/${category}`, {
    referenceCurrency,
    search,
    page,
    perPage,
    league,
  });
}

/**
 * フィルターを取得
 * @returns {Promise<Object>} フィルターレスポンス
 */
export async function getFilters() {
  return apiRequest("/items/filters");
}

/**
 * 全アイテムを取得
 * @param {string} league - リーグ名 (必須)
 * @returns {Promise<Array>} アイテム配列
 */
export async function getAllItems(league) {
  if (!league) {
    throw new Error("League parameter is required");
  }
  return apiRequest("/items", { league });
}

/**
 * アイテム履歴を取得
 * @param {number} itemId - アイテムID
 * @param {Object} options - オプション
 * @param {string} options.league - リーグ名 (必須)
 * @param {number} options.logCount - ログ数 (必須)
 * @param {string} options.endTime - 終了時刻 (ISO 8601形式)
 * @param {string} options.referenceCurrency - 基準通貨 (default: "exalted")
 * @returns {Promise<Object>} 履歴レスポンス
 */
export async function getItemHistory(itemId, options = {}) {
  const { league, logCount, endTime, referenceCurrency = "exalted" } = options;

  if (!league) {
    throw new Error("League parameter is required");
  }
  if (logCount === undefined) {
    throw new Error("LogCount parameter is required");
  }

  return apiRequest(`/items/${itemId}/history`, {
    league,
    logCount,
    endTime,
    referenceCurrency,
  });
}

/**
 * ランディングスプラッシュ情報を取得
 * @returns {Promise<Object>} ランディングスプラッシュ情報
 */
export async function getLandingSplashInfo() {
  return apiRequest("/items/landingSplashInfo");
}

/**
 * API IDで通貨アイテムを取得
 * @param {string} apiId - API ID
 * @param {string} league - リーグ名 (必須)
 * @returns {Promise<Object>} 通貨アイテムレスポンス
 */
export async function getCurrencyItemById(apiId, league) {
  if (!league) {
    throw new Error("League parameter is required");
  }
  return apiRequest(`/items/currencyById/${apiId}`, { league });
}

/**
 * リーグ一覧を取得
 * @returns {Promise<Array>} リーグ配列
 */
export async function getLeagues() {
  return apiRequest("/leagues");
}

/**
 * 通貨交換スナップショットを取得
 * @param {string} league - リーグ名 (必須)
 * @returns {Promise<Object>} スナップショットレスポンス
 */
export async function getCurrencyExchangeSnapshot(league) {
  if (!league) {
    throw new Error("League parameter is required");
  }
  return apiRequest("/currencyExchangeSnapshot", { league });
}

/**
 * 通貨交換スナップショット履歴を取得
 * @param {Object} options - オプション
 * @param {string} options.league - リーグ名 (必須)
 * @param {number} options.limit - 制限数 (必須)
 * @param {number|null} options.endTime - 終了時刻 (エポック秒)
 * @returns {Promise<Object>} 履歴レスポンス
 */
export async function getCurrencyExchangeSnapshotHistory(options = {}) {
  const { league, limit, endTime } = options;

  if (!league) {
    throw new Error("League parameter is required");
  }
  if (limit === undefined) {
    throw new Error("Limit parameter is required");
  }

  return apiRequest("/currencyExchange/SnapshotHistory", {
    league,
    limit,
    endTime,
  });
}

/**
 * 通貨交換スナップショットペアを取得
 * @param {string} league - リーグ名 (必須)
 * @returns {Promise<Array>} ペア配列
 */
export async function getCurrencyExchangeSnapshotPairs(league) {
  if (!league) {
    throw new Error("League parameter is required");
  }
  return apiRequest("/currencyExchange/SnapshotPairs", { league });
}

/**
 * 通貨交換ペア履歴を取得
 * @param {Object} options - オプション
 * @param {string} options.league - リーグ名 (必須)
 * @param {number} options.currencyOneItemId - 通貨1のアイテムID (必須)
 * @param {number} options.currencyTwoItemId - 通貨2のアイテムID (必須)
 * @param {number} options.limit - 制限数 (必須)
 * @param {number|null} options.endTime - 終了時刻 (エポック秒)
 * @returns {Promise<Object>} ペア履歴レスポンス
 */
export async function getCurrencyExchangePairHistory(options = {}) {
  const { league, currencyOneItemId, currencyTwoItemId, limit, endTime } =
    options;

  if (!league) {
    throw new Error("League parameter is required");
  }
  if (currencyOneItemId === undefined) {
    throw new Error("CurrencyOneItemId parameter is required");
  }
  if (currencyTwoItemId === undefined) {
    throw new Error("CurrencyTwoItemId parameter is required");
  }
  if (limit === undefined) {
    throw new Error("Limit parameter is required");
  }

  return apiRequest("/currencyExchange/PairHistory", {
    league,
    currencyOneItemId,
    currencyTwoItemId,
    limit,
    endTime,
  });
}
