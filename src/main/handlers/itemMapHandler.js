/**
 * アイテムマップハンドラー
 * itemMap.jsonからアイテム情報を取得
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let itemMapCache = null;

/**
 * itemMap.jsonを読み込む
 * @returns {Object} アイテムマップ
 */
function loadItemMap() {
  if (itemMapCache) {
    return itemMapCache;
  }

  const itemMapPath = path.join(
    __dirname,
    "../../data/items/itemMap.json"
  );

  try {
    const data = fs.readFileSync(itemMapPath, "utf-8");
    itemMapCache = JSON.parse(data);
    return itemMapCache;
  } catch (error) {
    console.error("[Error] Failed to load itemMap.json:", error);
    return {};
  }
}

/**
 * itemIdからアイテム情報を取得
 * @param {number} itemId - アイテムID
 * @returns {Object|null} アイテム情報（iconUrl, englishName, type, categoryApiIdなど）
 */
export function getItemInfoByItemId(itemId) {
  const itemMap = loadItemMap();

  // itemMap.jsonは日本語名をキーとしているので、全エントリを走査
  for (const [japaneseName, itemInfo] of Object.entries(itemMap)) {
    if (itemInfo.itemId === itemId) {
      return {
        ...itemInfo,
        japaneseName,
      };
    }
  }

  return null;
}

/**
 * 日本語名からアイテム情報を取得
 * @param {string} japaneseName - 日本語名
 * @returns {Object|null} アイテム情報
 */
export function getItemInfoByJapaneseName(japaneseName) {
  const itemMap = loadItemMap();
  const itemInfo = itemMap[japaneseName];

  if (itemInfo) {
    return {
      ...itemInfo,
      japaneseName,
    };
  }

  return null;
}

/**
 * englishNameMap.jsonを読み込む
 * @returns {Object} 英語名マップ
 */
function loadEnglishNameMap() {
  const englishMapPath = path.join(
    __dirname,
    "../../data/items/englishNameMap.json"
  );

  try {
    const data = fs.readFileSync(englishMapPath, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    console.error("[Error] Failed to load englishNameMap.json:", error);
    return {};
  }
}

/**
 * 英語名からアイテム情報を取得
 * @param {string} englishName - 英語名
 * @returns {Object|null} アイテム情報
 */
export function getItemInfoByEnglishName(englishName) {
  const englishMap = loadEnglishNameMap();
  const itemInfo = englishMap[englishName];

  if (itemInfo) {
    return {
      ...itemInfo,
      englishName,
    };
  }

  return null;
}

/**
 * アイテム名から情報を取得（言語を自動判定）
 * @param {string} itemName - アイテム名
 * @returns {Object|null} アイテム情報
 */
export function getItemInfoByName(itemName) {
  // まず日本語マップで検索
  let itemInfo = getItemInfoByJapaneseName(itemName);

  if (itemInfo) {
    return {
      ...itemInfo,
      matchedName: itemName,
      matchedLanguage: 'ja'
    };
  }

  // 次に英語マップで検索
  itemInfo = getItemInfoByEnglishName(itemName);

  if (itemInfo) {
    return {
      ...itemInfo,
      matchedName: itemName,
      matchedLanguage: 'en'
    };
  }

  return null;
}
