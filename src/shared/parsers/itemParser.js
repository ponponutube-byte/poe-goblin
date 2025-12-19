/**
 * Path of Exile アイテムテキストパーサー
 * PoEでCtrl+Cでコピーしたアイテム情報を解析
 */

/**
 * レアリティの種類
 */
export const RARITY = {
  NORMAL: "Normal",
  MAGIC: "Magic",
  RARE: "Rare",
  UNIQUE: "Unique",
  CURRENCY: "Currency",
  GEM: "Gem",
  DIVINATION_CARD: "Divination Card",
};

/**
 * 日本語レアリティ名のマッピング
 */
const RARITY_JP_TO_EN = {
  ノーマル: "Normal",
  マジック: "Magic",
  レア: "Rare",
  ユニーク: "Unique",
  カレンシー: "Currency",
  通貨: "Currency",
  ジェム: "Gem",
  占いカード: "Divination Card",
};

/**
 * アイテム情報を解析する
 * @param {string} itemText - PoEからコピーしたアイテムテキスト
 * @returns {Object} 解析結果
 */
export function parseItem(itemText) {
  console.log(
    "[itemParser] Parsing item text (length: " + (itemText?.length || 0) + ")"
  );

  if (!itemText || typeof itemText !== "string") {
    return {
      valid: false,
      error: "無効なアイテムテキストです",
    };
  }

  const lines = itemText.split("\n").map((line) => line.trim());
  console.log("[itemParser] Split into " + lines.length + " lines");

  // レアリティを判定（オプション）
  const rarity = detectRarity(lines);
  console.log("[itemParser] Detected rarity:", rarity || "None");

  // 言語を検出（日本語か英語か）
  const isJapanese = detectLanguage(lines);

  // アイテム名を取得
  const itemName = extractItemName(lines, rarity, isJapanese);

  // アイテム名が取得できない場合はエラー
  if (!itemName || itemName === "Unknown Item") {
    return {
      valid: false,
      error: "アイテム名を検出できませんでした",
      rawText: itemText,
    };
  }

  // ベースタイプを取得
  const baseType = extractBaseType(lines, isJapanese);

  // アイテムクラスを取得（日本語のみ）
  const itemClass = isJapanese ? extractItemClass(lines) : null;

  // Modを抽出
  const mods = extractMods(lines);

  return {
    valid: true,
    rarity: rarity || "Unknown",
    itemName,
    baseType,
    itemClass,
    mods,
    language: isJapanese ? "ja" : "en",
    rawText: itemText,
  };
}

/**
 * 言語を検出（日本語か英語か）
 * @param {string[]} lines - テキストの行配列
 * @returns {boolean} 日本語ならtrue
 */
function detectLanguage(lines) {
  // 日本語文字（ひらがな、カタカナ、漢字）が含まれているかチェック
  const japanesePattern = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;
  for (const line of lines.slice(0, 10)) {
    if (japanesePattern.test(line)) {
      return true;
    }
  }
  return false;
}

/**
 * レアリティを検出
 * @param {string[]} lines - テキストの行配列
 * @returns {string|null} レアリティ（Normal/Magic/Rare/Unique/Currency/Gem/etc）
 */
function detectRarity(lines) {
  // デバッグ: 最初の10行をログに出力
  console.log("[itemParser] Detecting rarity from lines:", lines.slice(0, 10));

  // 最初の数行で "Rarity: X" または "レアリティ: X" を探す
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const line = lines[i];

    // 英語フォーマット
    if (line.startsWith("Rarity: ")) {
      const rarity = line.replace("Rarity: ", "").trim();
      console.log("[itemParser] Found rarity (EN):", rarity);
      // 既知のレアリティにマッチするか確認
      if (Object.values(RARITY).includes(rarity)) {
        return rarity;
      }
      // 未知のレアリティでもそのまま返す
      return rarity;
    }

    // 日本語フォーマット
    if (line.startsWith("レアリティ: ")) {
      const rarityJp = line.replace("レアリティ: ", "").trim();
      console.log("[itemParser] Found rarity (JP):", rarityJp);
      const rarity = RARITY_JP_TO_EN[rarityJp];
      if (rarity) {
        return rarity;
      }
      // マッピングにない場合は日本語のまま返す
      return rarityJp;
    }
  }

  console.log("[itemParser] Rarity not found in first 10 lines");
  return null;
}

/**
 * アイテム名を抽出
 * @param {string[]} lines - テキストの行配列
 * @param {string|null} rarity - レアリティ（nullの場合もある）
 * @param {boolean} isJapanese - 日本語かどうか
 * @returns {string} アイテム名
 */
function extractItemName(lines, rarity, isJapanese) {
  console.log("[itemParser] Extracting item name, isJapanese:", isJapanese);

  if (isJapanese) {
    // 日本語フォーマット: "レアリティ: X" または "アイテムクラス: X" の後にアイテム名
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // レアリティ行またはアイテムクラス行を見つける
      if (
        line.startsWith("レアリティ: ") ||
        line.startsWith("アイテムクラス: ")
      ) {
        console.log("[itemParser] Found header at line", i, ":", line);

        // 次の数行を確認
        for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
          const nextLine = lines[j];

          // スキップする行
          if (
            nextLine.startsWith("アイテムクラス: ") ||
            nextLine.startsWith("レアリティ: ") ||
            nextLine === "" ||
            nextLine === "--------" ||
            nextLine === "---"
          ) {
            continue;
          }

          // 最初の有効な行がアイテム名
          if (nextLine) {
            console.log("[itemParser] Found item name:", nextLine);
            return nextLine;
          }
        }
      }
    }
  } else {
    // 英語フォーマット: "Rarity: X" または "Item Class: X" の次の行がアイテム名
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.startsWith("Rarity: ") || line.startsWith("Item Class: ")) {
        console.log("[itemParser] Found header at line", i, ":", line);

        // 次の行を確認
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1];
          if (
            nextLine !== "" &&
            !nextLine.startsWith("Item Class: ") &&
            !nextLine.startsWith("Rarity: ")
          ) {
            console.log("[itemParser] Found item name:", nextLine);
            return nextLine;
          }
        }
      }
    }
  }

  console.log("[itemParser] Item name not found");
  return "Unknown Item";
}

/**
 * ベースタイプを抽出
 * @param {string[]} lines - テキストの行配列
 * @param {boolean} isJapanese - 日本語かどうか
 * @returns {string|null} ベースタイプ
 */
function extractBaseType(lines, isJapanese) {
  // アイテム名を見つけて、その次の行がベースタイプ
  let itemNameIndex = -1;

  // まずアイテム名の位置を特定
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 区切り線が見つかったら終了
    if (line === "--------" || line === "---") {
      break;
    }

    // レアリティ行の後、アイテムクラス行をスキップして、最初の有効な行がアイテム名
    if (i > 0) {
      const prevLine = lines[i - 1];
      if (
        prevLine.startsWith("Rarity: ") ||
        prevLine.startsWith("レアリティ: ")
      ) {
        if (line !== "" && !line.startsWith("アイテムクラス: ")) {
          itemNameIndex = i;
          break;
        }
      }
    }

    // アイテムクラス行の後もチェック（日本語フォーマット）
    if (i > 0 && lines[i - 1].startsWith("アイテムクラス: ")) {
      if (line !== "" && line !== "--------" && line !== "---") {
        itemNameIndex = i;
        break;
      }
    }
  }

  // アイテム名の次の行がベースタイプ
  if (itemNameIndex >= 0 && itemNameIndex + 1 < lines.length) {
    const baseTypeLine = lines[itemNameIndex + 1];
    // 区切り線でないことを確認
    if (
      baseTypeLine !== "" &&
      baseTypeLine !== "--------" &&
      baseTypeLine !== "---"
    ) {
      return baseTypeLine;
    }
  }

  return null;
}

/**
 * アイテムクラスを抽出（日本語のみ）
 * @param {string[]} lines - テキストの行配列
 * @returns {string|null} アイテムクラス
 */
function extractItemClass(lines) {
  for (const line of lines) {
    if (line.startsWith("アイテムクラス: ")) {
      return line.replace("アイテムクラス: ", "").trim();
    }
  }
  return null;
}

/**
 * Mod（接辞）を抽出
 * @param {string[]} lines - テキストの行配列
 * @returns {string[]} Modの配列
 */
function extractMods(lines) {
  const mods = [];
  let inModSection = false;

  for (const line of lines) {
    // "---" で区切られた部分がModセクション
    if (line === "---" || line === "--------") {
      inModSection = true;
      continue;
    }

    // Modセクション内で、空行でない行をModとして追加
    if (inModSection && line !== "") {
      // 色情報などを除去（例: "#c8c8c8" のようなタグ）
      const cleanMod = line.replace(/#[0-9a-fA-F]{6}/g, "").trim();
      if (cleanMod) {
        mods.push(cleanMod);
      }
    }
  }

  return mods;
}
