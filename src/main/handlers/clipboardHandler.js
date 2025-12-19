/**
 * クリップボードハンドラー
 * PoEのアイテム情報をクリップボードから取得
 */

import { clipboard } from "electron";
import { parseItem } from "../../shared/parsers/itemParser.js";

/**
 * クリップボードからアイテム情報を取得して解析
 * @returns {Object} 解析結果
 */
export function getItemFromClipboard() {
  try {
    const clipboardText = clipboard.readText();

    if (!clipboardText) {
      return {
        success: false,
        error: "Clipboard is empty",
      };
    }

    // Parse item
    const parsed = parseItem(clipboardText);

    if (!parsed.valid) {
      return {
        success: false,
        error: parsed.error || "Failed to parse item",
        rawText: clipboardText, // Full text for debugging
      };
    }

    return {
      success: true,
      item: parsed,
    };
  } catch (error) {
    return {
      success: false,
      error: `エラー: ${error.message}`,
    };
  }
}

/**
 * アイテム情報をコンソールに出力（デバッグ用）
 * @param {Object} result - getItemFromClipboard()の結果
 */
export function logItemInfo(result) {
  if (!result.success) {
    console.error("[Error] Failed to get item:", result.error);
    if (result.rawText) {
      console.log(
        "[Debug] Clipboard content (first 200 chars):",
        result.rawText
      );
    }
    return;
  }

  const { item } = result;

  console.log("\n" + "=".repeat(50));
  console.log("PoE Item Information");
  console.log("=".repeat(50));
  console.log(`Language: ${item.language || "en"}`);
  console.log(`Rarity: ${item.rarity}`);
  console.log(`Item Name: ${item.itemName}`);
  if (item.baseType) {
    console.log(`Base Type: ${item.baseType}`);
  }
  if (item.itemClass) {
    console.log(`Item Class: ${item.itemClass}`);
  }
  console.log(`Mod Count: ${item.mods.length}`);

  if (item.mods.length > 0) {
    console.log("\nMods:");
    item.mods.forEach((mod, index) => {
      console.log(`  ${index + 1}. ${mod}`);
    });
  }

  console.log("=".repeat(50) + "\n");
}
