/**
 * poe2db.twから日本語名を取得してマッピングを更新
 * カテゴリ設定ベースの柔軟なパース処理
 */

import fs from "fs";
import path from "path";
import { fileURLToPath, URL } from "url";
import https from "https";
import zlib from "zlib";
import * as cheerio from "cheerio";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = "https://poe2db.tw/jp/";
const TMP_DIR = path.join(__dirname, "tmp");

// ========================================
// 抽出戦略の実装
// ========================================

/**
 * 日本語文字が含まれているかチェック
 */
function containsJapanese(text) {
  const japanesePattern = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;
  return japanesePattern.test(text);
}

/**
 * 抽出戦略の実装
 */
const EXTRACTION_STRATEGIES = {
  /**
   * 戦略1: リンクテキストから（標準）
   */
  linkText: ($, $link) => {
    const $clone = $link.clone();
    $clone.find("img").remove();
    const text = $clone.text().trim();
    return containsJapanese(text) ? text : null;
  },

  /**
   * 戦略2: リンクテキストまたはテーブルセル
   */
  linkTextOrTableCell: ($, $link) => {
    // まずリンクテキストを試行
    const $clone = $link.clone();
    $clone.find("img").remove();
    const linkText = $clone.text().trim();
    if (containsJapanese(linkText)) {
      return linkText;
    }

    // 次にテーブルセルを試行
    const $td = $link.closest("td");
    if ($td.length > 0) {
      const $tdClone = $td.clone();
      $tdClone.find("img, a").remove();
      const cellText = $tdClone.text().trim();
      if (containsJapanese(cellText)) {
        return cellText;
      }
    }

    return null;
  },

  /**
   * 戦略3: Uniqueアイテムの特殊構造
   */
  uniqueNameSpan: ($, $link) => {
    // まず<span class="uniqueName">を探す
    const $uniqueName = $link.find("span.uniqueName");
    if ($uniqueName.length > 0) {
      const text = $uniqueName.text().trim();
      if (containsJapanese(text)) {
        return text;
      }
    }

    // フォールバック: 通常のリンクテキスト
    const $clone = $link.clone();
    $clone.find("img").remove();
    const text = $clone.text().trim();
    return containsJapanese(text) ? text : null;
  },

  /**
   * 戦略4: 柔軟な抽出（複数の方法を順番に試行）
   */
  flexible: ($, $link) => {
    // 1. uniqueName
    const $uniqueName = $link.find("span.uniqueName");
    if ($uniqueName.length > 0) {
      const text = $uniqueName.text().trim();
      if (containsJapanese(text)) {
        return text;
      }
    }

    // 2. リンクテキスト
    const $clone = $link.clone();
    $clone.find("img").remove();
    const linkText = $clone.text().trim();
    if (containsJapanese(linkText)) {
      return linkText;
    }

    // 3. title属性
    const title = $link.attr("title");
    if (title && containsJapanese(title)) {
      return title.trim();
    }

    // 4. 親のテーブルセル
    const $td = $link.closest("td");
    if ($td.length > 0) {
      const $tdClone = $td.clone();
      $tdClone.find("img, a").remove();
      const cellText = $tdClone.text().trim();
      if (containsJapanese(cellText)) {
        return cellText;
      }
    }

    return null;
  },
};

// ========================================
// 設定管理
// ========================================

/**
 * デフォルト設定を返す
 */
function getDefaultConfig() {
  return {
    categories: [
      {
        path: "Stackable_Currency",
        name: "通貨",
        parserType: "standard",
        enabled: true,
      },
      {
        path: "Augment",
        name: "オーグメント",
        parserType: "augment",
        enabled: true,
      },
      {
        path: "Essence",
        name: "エッセンス",
        parserType: "standard",
        enabled: true,
      },
    ],
    parserTypes: {
      standard: {
        selectors: ["a.item_currency"],
        extractionStrategy: "linkText",
      },
      augment: {
        selectors: ["a.item_currency", "table a[href^='/jp/']", "a.whiteitem"],
        extractionStrategy: "linkTextOrTableCell",
      },
    },
  };
}

/**
 * カテゴリ設定を読み込む
 */
function loadCategoryConfig() {
  const configPath = path.join(__dirname, "category_config.json");

  try {
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      console.log(
        `📋 Loaded ${config.categories.length} categories from category_config.json`
      );

      // 有効なカテゴリのみをフィルタ
      const enabledCategories = config.categories.filter((cat) => cat.enabled);
      console.log(`   Enabled: ${enabledCategories.length} categories`);

      return config;
    } else {
      console.error(`❌ category_config.json not found at: ${configPath}`);
      console.log(`⚠️  Using default config as fallback...`);
      return getDefaultConfig();
    }
  } catch (error) {
    console.error(`❌ Error loading category_config.json:`, error);
    return getDefaultConfig();
  }
}

// ========================================
// HTTP リクエスト処理
// ========================================

/**
 * 遅延関数
 * @param {number} ms - ミリ秒
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * HTMLを取得（IP制限対策付き）
 */
function fetchHTML(url, retries = 3) {
  return new Promise(async (resolve, reject) => {
    const options = {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        Connection: "keep-alive",
        "Upgrade-Insecure-Requests": "1",
      },
    };

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const html = await fetchHTMLWithOptions(url, options);
        return resolve(html);
      } catch (error) {
        if (attempt === retries) {
          return reject(error);
        }

        // リトライ前に待機（指数バックオフ）
        const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        console.log(
          `⚠️  Request failed (attempt ${attempt}/${retries}), retrying in ${waitTime}ms...`
        );
        await delay(waitTime);
      }
    }
  });
}

/**
 * オプション付きでHTMLを取得
 */
function fetchHTMLWithOptions(url, options) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const requestOptions = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: "GET",
      headers: options.headers,
    };

    const req = https.request(requestOptions, (res) => {
      // ステータスコードをチェック
      if (res.statusCode === 429) {
        // レート制限エラー
        const retryAfter = res.headers["retry-after"] || 60;
        reject(
          new Error(
            `Rate limited. Retry after ${retryAfter} seconds. Status: ${res.statusCode}`
          )
        );
        return;
      }

      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        return;
      }

      // Content-Encodingを確認して適切な解凍ストリームを選択
      const contentEncoding = res.headers["content-encoding"];
      console.log(`   Content-Encoding: ${contentEncoding || "none"}`);

      let stream = res;
      if (contentEncoding === "gzip") {
        stream = res.pipe(zlib.createGunzip());
      } else if (contentEncoding === "deflate") {
        stream = res.pipe(zlib.createInflate());
      } else if (contentEncoding === "br") {
        stream = res.pipe(zlib.createBrotliDecompress());
      }

      let data = "";

      stream.on("data", (chunk) => {
        data += chunk;
      });

      stream.on("end", () => {
        resolve(data);
      });

      stream.on("error", (err) => {
        reject(err);
      });
    });

    req.on("error", (err) => {
      reject(err);
    });

    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });

    req.end();
  });
}

// ========================================
// HTML解析処理
// ========================================

/**
 * hrefでリンクをグループ化
 */
function groupLinksByHref($, links) {
  const hrefMap = {};

  links.each((index, element) => {
    const $link = $(element);
    let href = $link.attr("href");
    if (!href) {
      return;
    }

    // hrefを正規化: /jp/Brynhands_Mark -> Brynhands_Mark
    let normalizedHref = href.replace(/^\/jp\//, "");

    if (!hrefMap[normalizedHref]) {
      hrefMap[normalizedHref] = [];
    }
    hrefMap[normalizedHref].push($link);
  });

  return hrefMap;
}

/**
 * デバッグ用HTMLを保存
 */
function saveDebugHTML(html, categoryPath) {
  if (!fs.existsSync(TMP_DIR)) {
    fs.mkdirSync(TMP_DIR, { recursive: true });
  }
  const debugPath = path.join(TMP_DIR, `debug_${categoryPath}.html`);
  fs.writeFileSync(debugPath, html, "utf-8");
  console.log(`   💾 HTML saved to: ${debugPath}`);
}

/**
 * HTMLからアイテム情報を抽出（設定ベース）
 * @param {string} html - HTML文字列
 * @param {Object} category - カテゴリ設定
 * @param {Object} parserConfig - パーサー設定
 * @returns {Array<{englishName: string, japaneseName: string}>} アイテム情報の配列
 */
function parseHTML(html, category, parserConfig) {
  const items = [];
  const $ = cheerio.load(html);

  console.log(`📊 HTML解析開始...`);
  console.log(`   カテゴリ: ${category.name} (${category.path})`);
  console.log(`   パーサータイプ: ${category.parserType}`);
  console.log(`   説明: ${parserConfig.description}`);

  // セレクタでリンクを検索
  const selectors = parserConfig.selectors.join(", ");
  const currencyLinks = $(selectors);
  console.log(`   Found ${currencyLinks.length} item link(s)`);

  if (currencyLinks.length === 0) {
    console.warn(`   ⚠️  No item links found`);
    saveDebugHTML(html, category.path);
    return items;
  }

  // 抽出戦略を取得
  const extractStrategy =
    EXTRACTION_STRATEGIES[parserConfig.extractionStrategy];
  if (!extractStrategy) {
    console.error(
      `   ❌ Unknown extraction strategy: ${parserConfig.extractionStrategy}`
    );
    return items;
  }

  // hrefでグループ化
  const hrefMap = groupLinksByHref($, currencyLinks);
  console.log(`   Grouped into ${Object.keys(hrefMap).length} unique items`);

  // 各アイテムを処理
  let processedCount = 0;
  let skippedCount = 0;

  Object.entries(hrefMap).forEach(([normalizedHref, links]) => {
    const englishName = normalizedHref.replace(/_/g, " ").trim();

    let japaneseName = null;
    for (const $link of links) {
      japaneseName = extractStrategy($, $link);
      if (japaneseName) break;
    }

    if (japaneseName) {
      items.push({
        englishName,
        japaneseName,
        parserType: category.parserType, // デバッグ用
      });
      processedCount++;
      if (processedCount <= 5) {
        console.log(
          `   ✅ [${processedCount}] "${englishName}" → "${japaneseName}"`
        );
      }
    } else {
      skippedCount++;
      if (skippedCount <= 3) {
        console.log(`   ⚠️  No Japanese name found for "${englishName}"`);
      }
    }
  });

  if (processedCount > 5) {
    console.log(`   ... and ${processedCount - 5} more items processed`);
  }
  if (skippedCount > 3) {
    console.log(`   ... and ${skippedCount - 3} more items skipped`);
  }

  console.log(
    `\n📊 解析結果 (${category.name}): ${processedCount}/${
      Object.keys(hrefMap).length
    } items\n`
  );

  return items;
}

// ========================================
// メイン処理
// ========================================

/**
 * 単一のカテゴリからアイテムを取得
 */
async function fetchItemsFromCategory(category, parserConfig) {
  const url = `${BASE_URL}${category.path}`;
  console.log(`\n${"=".repeat(70)}`);
  console.log(`📡 Fetching: ${url}`);
  console.log(`⏳ Waiting 2 seconds before request to avoid rate limiting...`);
  await delay(2000);

  const html = await fetchHTML(url);
  console.log(`✅ HTML fetched (${html.length} bytes)`);

  // パース処理
  console.log(`🔍 Parsing HTML for ${category.name}...`);
  const items = parseHTML(html, category, parserConfig);
  console.log(`✅ Found ${items.length} items from ${category.name}`);

  return items;
}

/**
 * マッピングを更新
 */
async function updateMapping() {
  // カテゴリ設定を読み込む
  const config = loadCategoryConfig();
  const enabledCategories = config.categories.filter((cat) => cat.enabled);

  console.log("\n" + "=".repeat(70));
  console.log("🔧 Fetching Japanese names from poe2db.tw...");
  console.log("=".repeat(70));
  console.log(`📋 Processing ${enabledCategories.length} categories:`);
  enabledCategories.forEach((cat, index) => {
    console.log(
      `   ${index + 1}. ${cat.name} (${cat.path}) - ${cat.parserType}`
    );
  });
  console.log("=".repeat(70) + "\n");

  try {
    // 既存のマッピングを読み込む
    const mappingPath = path.join(
      __dirname,
      "../src/data/items/japaneseNameMapping.json"
    );
    const existingMapping = JSON.parse(fs.readFileSync(mappingPath, "utf-8"));

    // 全カテゴリからアイテムを取得
    const allItems = [];
    let totalUpdatedCount = 0;
    let totalNewCount = 0;

    for (let i = 0; i < enabledCategories.length; i++) {
      const category = enabledCategories[i];
      try {
        const parserConfig = config.parserTypes[category.parserType];
        if (!parserConfig) {
          console.error(
            `❌ Unknown parser type: ${category.parserType} for ${category.path}`
          );
          continue;
        }

        const items = await fetchItemsFromCategory(category, parserConfig);
        allItems.push(...items);

        // カテゴリ間で待機（最後のカテゴリ以外）
        if (i < enabledCategories.length - 1) {
          console.log(`\n⏳ Waiting 2 seconds before next category...`);
          await delay(2000);
        }
      } catch (error) {
        console.error(`❌ Error fetching ${category.path}:`, error.message);
        console.log(`⚠️  Continuing with next category...`);
      }
    }

    console.log(`\n${"=".repeat(70)}`);
    console.log(`📊 Total items found: ${allItems.length}`);

    if (allItems.length === 0) {
      console.warn("⚠️  No items found from any category.");
      return;
    }

    // 重複を除去（同じ英語名のアイテムは最初のもののみを使用）
    const uniqueItems = [];
    const seenNames = new Set();

    allItems.forEach((item) => {
      if (!seenNames.has(item.englishName)) {
        seenNames.add(item.englishName);
        uniqueItems.push(item);
      }
    });

    console.log(`📊 Unique items after deduplication: ${uniqueItems.length}`);

    // マッピングを更新
    uniqueItems.forEach((item) => {
      if (existingMapping[item.englishName] !== undefined) {
        // 既存のエントリがある場合、空でない場合のみ更新
        if (
          !existingMapping[item.englishName] ||
          existingMapping[item.englishName].trim() === ""
        ) {
          existingMapping[item.englishName] = item.japaneseName;
          totalUpdatedCount++;
        }
      } else {
        // 新しいエントリを追加
        existingMapping[item.englishName] = item.japaneseName;
        totalNewCount++;
      }
    });

    // ファイルに保存
    fs.writeFileSync(
      mappingPath,
      JSON.stringify(existingMapping, null, 2),
      "utf-8"
    );

    console.log(`\n${"=".repeat(70)}`);
    console.log(`✅ Mapping updated successfully!`);
    console.log(`   Updated: ${totalUpdatedCount}`);
    console.log(`   New: ${totalNewCount}`);
    console.log(
      `   Total items in mapping: ${Object.keys(existingMapping).length}`
    );
    console.log("=".repeat(70) + "\n");
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

// 実行
updateMapping();
