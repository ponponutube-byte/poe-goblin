/**
 * 日本語名マッピングのテンプレートを作成
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 日本語名マッピングのテンプレートを作成
 */
function createMappingTemplate() {
  console.log("🔧 Creating Japanese name mapping template...\n");

  // items.jsonを読み込む
  const itemsPath = path.join(__dirname, "../items.json");
  if (!fs.existsSync(itemsPath)) {
    console.error(`❌ items.json not found at: ${itemsPath}`);
    process.exit(1);
  }

  const items = JSON.parse(fs.readFileSync(itemsPath, "utf-8"));
  console.log(`📦 Loaded ${items.length} items from items.json`);

  // テンプレートオブジェクトを作成
  const template = {};

  items.forEach((item) => {
    // name または text のどちらかが存在する
    const itemName = item.name || item.text;

    if (!itemName || itemName === "undefined") {
      console.warn(
        `⚠️  Item without valid name or text found: itemId=${item.itemId}`
      );
      return;
    }

    // 英語名をキーとして、空文字列を値として設定
    // ユーザーが日本語名を手動で追加できるように
    template[itemName] = "";
  });

  // 出力ディレクトリを確認・作成
  const outputDir = path.join(__dirname, "../src/data/items");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // テンプレートファイルを保存
  const templatePath = path.join(outputDir, "japaneseNameMapping.json");

  // 既存のファイルがある場合は確認
  if (fs.existsSync(templatePath)) {
    console.warn(`⚠️  File already exists: ${templatePath}`);
    console.warn("   Existing mappings will be preserved.");

    // 既存のマッピングを読み込む
    const existing = JSON.parse(fs.readFileSync(templatePath, "utf-8"));

    // undefinedエントリを削除
    if ("undefined" in existing) {
      delete existing["undefined"];
    }

    // 新しいアイテムを追加（既存のマッピングは保持）
    Object.keys(template).forEach((englishName) => {
      if (!(englishName in existing)) {
        existing[englishName] = "";
      }
    });

    // 既存のマッピングを保持して保存
    fs.writeFileSync(templatePath, JSON.stringify(existing, null, 2), "utf-8");

    const existingMapped = Object.values(existing).filter(
      (v) => v && v.trim() !== ""
    ).length;
    console.log(`✅ Template updated: ${templatePath}`);
    console.log(`📝 Total items: ${Object.keys(existing).length}`);
    console.log(`📝 Already mapped: ${existingMapped}`);
    console.log(
      `📝 Need mapping: ${Object.keys(existing).length - existingMapped}`
    );
  } else {
    fs.writeFileSync(templatePath, JSON.stringify(template, null, 2), "utf-8");

    console.log(`✅ Template created: ${templatePath}`);
    console.log(`📝 Total items: ${Object.keys(template).length}`);
    console.log(`📝 Please fill in Japanese names for each item`);
  }

  console.log(`\n💡 Example format:`);
  console.log(`   "Eye of Chayula": "チャユラの目"`);
  console.log(`   "The Anvil": "アンヴィル"`);
}

// 実行
createMappingTemplate();
