/**
 * items.jsonから日本語名をキーとしたマップを作成
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 日本語名のマッピングファイルを読み込む
 * 形式: { "英語名": "日本語名" }
 */
function loadJapaneseNameMapping() {
  const mappingPath = path.join(
    __dirname,
    "../src/data/items/japaneseNameMapping.json"
  );

  if (fs.existsSync(mappingPath)) {
    const mapping = JSON.parse(fs.readFileSync(mappingPath, "utf-8"));
    console.log(
      `📖 Loaded Japanese name mapping: ${Object.keys(mapping).length} entries`
    );
    return mapping;
  }

  console.warn("⚠️  Japanese name mapping file not found.");
  console.warn(`   Expected path: ${mappingPath}`);
  console.warn(
    "   Run 'npm run create:mapping-template' to create a template."
  );
  return {};
}

/**
 * items.jsonからマップを構築
 */
function buildItemMap() {
  console.log("🔧 Building item map...\n");

  // items.jsonを読み込む
  const itemsPath = path.join(__dirname, "../items.json");
  if (!fs.existsSync(itemsPath)) {
    console.error(`❌ items.json not found at: ${itemsPath}`);
    process.exit(1);
  }

  const items = JSON.parse(fs.readFileSync(itemsPath, "utf-8"));
  console.log(`📦 Loaded ${items.length} items from items.json`);

  // 日本語名のマッピングを読み込む
  const japaneseMapping = loadJapaneseNameMapping();

  // 日本語名をキーとしたマップ
  const japaneseNameMap = {};

  // 英語名をキーとしたマップ（デバッグ・検証用）
  const englishNameMap = {};

  let mappedCount = 0;
  let unmappedCount = 0;

  items.forEach((item) => {
    // name または text のどちらかが存在する
    const englishName = item.name || item.text;

    if (!englishName) {
      console.warn(
        `⚠️  Item without name or text found: itemId=${item.itemId}`
      );
      return;
    }

    const itemData = {
      englishName: englishName,
      itemId: item.itemId,
      type: item.type || "",
      categoryApiId: item.categoryApiId || "",
      iconUrl: item.iconUrl || "",
    };

    // 英語名をキーとしたマップ（デバッグ用）
    // 同じ名前のアイテムが複数ある場合は、最初のものを保持
    if (!englishNameMap[englishName]) {
      englishNameMap[englishName] = itemData;
    }

    // 日本語名のマッピングがある場合、日本語名をキーとして追加
    const japaneseName = japaneseMapping[englishName];
    if (japaneseName && japaneseName.trim() !== "") {
      japaneseNameMap[japaneseName] = itemData;
      mappedCount++;
    } else {
      unmappedCount++;
    }
  });

  // 出力ディレクトリを確認・作成
  const outputDir = path.join(__dirname, "../src/data/items");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 日本語名マップを保存
  const outputPath = path.join(outputDir, "itemMap.json");
  fs.writeFileSync(
    outputPath,
    JSON.stringify(japaneseNameMap, null, 2),
    "utf-8"
  );

  console.log(`\n✅ Japanese name map created: ${outputPath}`);
  console.log(`📊 Statistics:`);
  console.log(`   Total items: ${items.length}`);
  console.log(`   Mapped (Japanese): ${mappedCount}`);
  console.log(`   Unmapped: ${unmappedCount}`);

  // 英語名マップも保存（デバッグ用）
  const englishMapPath = path.join(outputDir, "englishNameMap.json");
  fs.writeFileSync(
    englishMapPath,
    JSON.stringify(englishNameMap, null, 2),
    "utf-8"
  );

  console.log(`✅ English name map created: ${englishMapPath}`);
  console.log(
    `\n💡 Tip: To add more Japanese mappings, edit src/data/items/japaneseNameMapping.json`
  );
}

// 実行
buildItemMap();
