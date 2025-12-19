/**
 * poe2db.tw/jp/Items ページからカテゴリパスを抽出
 */

import fs from "fs";
import path from "path";
import { fileURLToPath, URL } from "url";
import https from "https";
import zlib from "zlib";
import * as cheerio from "cheerio";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ITEMS_PAGE_URL = "https://poe2db.tw/jp/Items";
const TMP_DIR = path.join(__dirname, "tmp");

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
 * HTMLからカテゴリパスを抽出
 * @param {string} html - HTML文字列
 * @returns {Array<string>} カテゴリパスの配列
 */
function parseCategoryPaths(html) {
  const paths = [];
  const $ = cheerio.load(html);

  console.log("📊 HTML解析開始...");

  // itemListクラス内のリンクを探す（これがカテゴリリスト）
  const itemListLinks = $(".itemList a");
  console.log(`   Found ${itemListLinks.length} itemList link(s)`);

  // パスを抽出（重複を避ける）
  const seenPaths = new Set();

  itemListLinks.each((index, element) => {
    const $link = $(element);
    const href = $link.attr("href");

    if (!href) {
      return;
    }

    let path = "";

    // 相対パス（例: href="Stackable_Currency"）
    if (!href.startsWith("/") && !href.startsWith("http")) {
      path = href.split("?")[0].split("#")[0].trim();
    }
    // 絶対パス（例: href="/jp/Essence"）
    else if (href.startsWith("/jp/")) {
      path = href.replace("/jp/", "").split("?")[0].split("#")[0].trim();
    }
    // その他のパスはスキップ
    else {
      return;
    }

    // 空でない、かつ既に見たパスでない場合
    if (path && !seenPaths.has(path)) {
      // 除外するパス
      const excludePatterns = [
        "",
        "Items",
        "search",
        "patreon",
        "marked",
        "passive-skill-tree",
        "atlas-skill-tree",
        "news",
        "privacy",
      ];

      // パスにスラッシュが含まれていない（サブパスでない）ことを確認
      if (
        !excludePatterns.includes(path) &&
        !path.includes("/") &&
        !path.includes("?")
      ) {
        paths.push(path);
        seenPaths.add(path);
      }
    }
  });

  console.log(`\n📊 解析結果:`);
  console.log(`   見つかったパス: ${paths.length}個`);
  console.log(`   パス一覧: ${paths.join(", ")}\n`);

  return paths.sort(); // ソートして返す
}

/**
 * Itemsページからカテゴリパスを取得
 */
async function getCategoryPaths() {
  console.log("🔧 Fetching category paths from poe2db.tw/jp/Items...\n");

  try {
    console.log(`📡 Fetching: ${ITEMS_PAGE_URL}`);
    console.log(
      `⏳ Waiting 2 seconds before request to avoid rate limiting...`
    );
    await delay(2000); // 2秒待機

    const html = await fetchHTML(ITEMS_PAGE_URL);
    console.log(`✅ HTML fetched (${html.length} bytes)\n`);

    // HTMLを解析
    console.log("🔍 Parsing HTML...");
    const paths = parseCategoryPaths(html);
    console.log(`✅ Found ${paths.length} category paths\n`);

    // tmpディレクトリが存在しない場合は作成
    if (!fs.existsSync(TMP_DIR)) {
      fs.mkdirSync(TMP_DIR, { recursive: true });
    }

    // HTMLをファイルに保存して確認
    const debugPath = path.join(TMP_DIR, "items_page_debug.html");
    fs.writeFileSync(debugPath, html, "utf-8");
    console.log(`💾 HTML saved to: ${debugPath}\n`);

    // パスをファイルに保存
    const outputPath = path.join(TMP_DIR, "category_paths.json");
    fs.writeFileSync(outputPath, JSON.stringify(paths, null, 2), "utf-8");
    console.log(`✅ Category paths saved to: ${outputPath}`);

    return paths;
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

// 実行
getCategoryPaths();
