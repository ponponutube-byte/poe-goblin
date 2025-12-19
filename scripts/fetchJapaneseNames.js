/**
 * poe2db.twから日本語名を取得してマッピングを更新
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

// 処理するパスのリスト
// category_paths.jsonから自動的に読み込むか、手動で指定
let TARGET_PATHS = [];

/**
 * category_paths.jsonからパスを読み込む
 * @returns {Array<string>} パスの配列
 */
function loadCategoryPaths() {
  const categoryPathsPath = path.join(TMP_DIR, "category_paths.json");

  try {
    if (fs.existsSync(categoryPathsPath)) {
      const paths = JSON.parse(fs.readFileSync(categoryPathsPath, "utf-8"));
      console.log(
        `📋 Loaded ${paths.length} category paths from category_paths.json`
      );
      return paths;
    } else {
      console.warn(`⚠️  category_paths.json not found. Using default paths.`);
      // デフォルトのパス（カレンシー関連）
      return [
        "Stackable_Currency",
        "Augment",
        "Omen",
        "Liquid_Emotions",
        "Essence",
        "Splinter",
        "Catalysts",
      ];
    }
  } catch (error) {
    console.error(`❌ Error loading category_paths.json:`, error);
    // エラー時はデフォルトのパスを使用
    return [
      "Stackable_Currency",
      "Augment",
      "Omen",
      "Liquid_Emotions",
      "Essence",
      "Splinter",
      "Catalysts",
    ];
  }
}

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

/**
 * HTMLからアイテム情報を抽出
 * @param {string} html - HTML文字列
 * @returns {Array<{englishName: string, japaneseName: string}>} アイテム情報の配列
 */
function parseHTML(html) {
  const items = [];
  const $ = cheerio.load(html);

  console.log("📊 HTML解析開始...");

  // 複数のクラスパターンに対応
  // item_currency (StackableCurrency, Augment, Essence, Splinter, Catalysts, Liquid_Emotions)
  // whiteitem.Omen (Omen)
  // uniqueitem (Unique_item)
  const currencyLinks = $("a.item_currency, a.whiteitem.Omen, a.uniqueitem");
  console.log(`   Found ${currencyLinks.length} item link(s)`);

  if (currencyLinks.length === 0) {
    console.warn("   ⚠️  No item links found in HTML");
    // tmpディレクトリが存在しない場合は作成
    if (!fs.existsSync(TMP_DIR)) {
      fs.mkdirSync(TMP_DIR, { recursive: true });
    }
    // HTMLをファイルに保存して確認
    const debugPath = path.join(TMP_DIR, "debug_html.html");
    fs.writeFileSync(debugPath, html, "utf-8");
    console.log(`   💾 HTML saved to: ${debugPath}`);
    return items;
  }

  let processedCount = 0;
  let skippedCount = 0;
  const seen = new Set(); // 重複を避けるため
  const hrefMap = {}; // hrefごとにリンクをグループ化

  // まず、同じhrefを持つリンクをグループ化
  // hrefを正規化して比較（/jp/を除去、相対パスと絶対パスを統一）
  currencyLinks.each((index, element) => {
    const $link = $(element);
    let href = $link.attr("href");
    if (!href) {
      return;
    }

    // hrefを正規化: /jp/Brynhands_Mark -> Brynhands_Mark
    let normalizedHref = href;
    if (href.startsWith("/jp/")) {
      normalizedHref = href.replace("/jp/", "");
    }

    if (!hrefMap[normalizedHref]) {
      hrefMap[normalizedHref] = [];
    }
    hrefMap[normalizedHref].push($link);
  });

  console.log(`   Grouped into ${Object.keys(hrefMap).length} unique items`);

  // 各hrefグループから日本語名を取得
  Object.entries(hrefMap).forEach(([normalizedHref, links]) => {
    // 正規化されたhrefから英語名を抽出
    // Brynhands_Mark -> Brynhands Mark
    let englishName = normalizedHref.replace(/_/g, " ").trim();

    // 既に処理したアイテムはスキップ
    if (seen.has(englishName)) {
      skippedCount++;
      return;
    }
    seen.add(englishName);

    // 同じhrefを持つリンクの中で、テキストを含むものを探す
    let japaneseName = "";
    for (const $link of links) {
      // Uniqueアイテムの場合: <span class="uniqueName">内のテキストを取得
      const $uniqueName = $link.find("span.uniqueName");
      if ($uniqueName.length > 0) {
        japaneseName = $uniqueName.text().trim();
        if (japaneseName) {
          break;
        }
      }

      // その他の場合: 画像タグを除去してテキストのみを取得
      const $clone = $link.clone();
      $clone.find("img").remove();
      const text = $clone.text().trim();

      // 日本語文字が含まれているか確認
      const japanesePattern = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;
      if (text && japanesePattern.test(text)) {
        japaneseName = text;
        break;
      }
    }

    // 日本語名が取得できた場合、アイテムを追加
    if (japaneseName) {
      items.push({
        englishName,
        japaneseName,
      });
      processedCount++;
      if (processedCount <= 10) {
        console.log(
          `   ✅ [${processedCount}] "${englishName}" → "${japaneseName}"`
        );
      }
    } else {
      skippedCount++;
      if (processedCount + skippedCount <= 5) {
        console.log(
          `   ⚠️  No Japanese name found for "${englishName}" (${links.length} link(s))`
        );
      }
    }
  });

  console.log(`\n📊 解析結果:`);
  console.log(`   処理済み: ${processedCount}`);
  console.log(`   スキップ: ${skippedCount}`);
  console.log(`   合計: ${currencyLinks.length}リンク\n`);

  return items;
}

/**
 * 単一のパスからアイテムを取得
 * @param {string} path - パス（例: "Stackable_Currency"）
 * @returns {Promise<Array<{englishName: string, japaneseName: string}>>} アイテム情報の配列
 */
async function fetchItemsFromPath(path) {
  const url = `${BASE_URL}${path}`;
  console.log(`\n📡 Fetching: ${url}`);
  console.log(`⏳ Waiting 2 seconds before request to avoid rate limiting...`);
  await delay(2000); // 2秒待機

  const html = await fetchHTML(url);
  console.log(`✅ HTML fetched (${html.length} bytes)`);

  // HTMLを解析
  console.log(`🔍 Parsing HTML for ${path}...`);
  const items = parseHTML(html);
  console.log(`✅ Found ${items.length} items from ${path}`);

  return items;
}

/**
 * マッピングを更新
 */
async function updateMapping() {
  // カテゴリパスを読み込む
  TARGET_PATHS = loadCategoryPaths();

  console.log("🔧 Fetching Japanese names from poe2db.tw...\n");
  console.log(
    `📋 Processing ${TARGET_PATHS.length} paths: ${TARGET_PATHS.join(", ")}\n`
  );

  try {
    // 既存のマッピングを読み込む
    const mappingPath = path.join(
      __dirname,
      "../src/data/items/japaneseNameMapping.json"
    );
    const existingMapping = JSON.parse(fs.readFileSync(mappingPath, "utf-8"));

    // 全パスからアイテムを取得
    const allItems = [];
    let totalUpdatedCount = 0;
    let totalNewCount = 0;

    for (let i = 0; i < TARGET_PATHS.length; i++) {
      const path = TARGET_PATHS[i];
      try {
        const items = await fetchItemsFromPath(path);
        allItems.push(...items);

        // パス間で待機（最後のパス以外）
        if (i < TARGET_PATHS.length - 1) {
          console.log(`\n⏳ Waiting 2 seconds before next path...`);
          await delay(2000);
        }
      } catch (error) {
        console.error(`❌ Error fetching ${path}:`, error);
        console.log(`⚠️  Continuing with next path...`);
      }
    }

    console.log(`\n📊 Total items found: ${allItems.length}`);

    if (allItems.length === 0) {
      console.warn("⚠️  No items found from any path.");
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

    console.log(`📊 Unique items after deduplication: ${uniqueItems.length}\n`);

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

    console.log(`✅ Mapping updated:`);
    console.log(`   Updated: ${totalUpdatedCount}`);
    console.log(`   New: ${totalNewCount}`);
    console.log(
      `   Total items in mapping: ${Object.keys(existingMapping).length}`
    );
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

// 実行
updateMapping();
