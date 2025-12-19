import { app, BrowserWindow, globalShortcut, ipcMain } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import {
  getItemFromClipboard,
  logItemInfo,
} from "./handlers/clipboardHandler.js";
import { fetchItemHistory } from "./handlers/itemHistoryHandler.js";
import {
  getItemInfoByItemId,
  getItemInfoByName,
} from "./handlers/itemMapHandler.js";

// ESModulesでは__dirnameが使えないので定義
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// .envファイルを読み込む
const envPath = path.join(__dirname, "../../.env");
dotenv.config({ path: envPath });

let mainWindow;
let isWindowVisible = false;
let currentHotkey = "CommandOrControl+G"; // デフォルトのホットキー

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 600,
    height: 800,
    frame: false, // フレームレス
    transparent: true, // 透明化
    alwaysOnTop: true, // 常に最前面
    skipTaskbar: true, // タスクバーに表示しない
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));

  // 開発時のみ開発者ツールを開く（必要に応じてコメントアウト）
  // mainWindow.webContents.openDevTools();

  // マウスイベントを透過（クリックスルー）- デフォルトで有効
  mainWindow.setIgnoreMouseEvents(true, { forward: true });

  // ウィンドウを最初は非表示
  mainWindow.hide();

  // フォーカスが外れたら（画面外をクリックしたら）非表示
  mainWindow.on("blur", () => {
    if (isWindowVisible) {
      console.log("[Window] Lost focus, hiding window");
      mainWindow.hide();
      mainWindow.setIgnoreMouseEvents(true, { forward: true });
      isWindowVisible = false;
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

/**
 * ホットキーを登録
 * @param {string} hotkey - ホットキー文字列
 * @returns {boolean} 成功したかどうか
 */
function registerHotkey(hotkey) {
  // 既存のホットキーを解除
  globalShortcut.unregisterAll();

  const ret = globalShortcut.register(hotkey, async () => {
    console.log(`\n[Hotkey] ${hotkey} pressed!`);

    if (isWindowVisible) {
      // ウィンドウを非表示
      mainWindow.hide();
      // クリックスルーを有効化
      mainWindow.setIgnoreMouseEvents(true, { forward: true });
      isWindowVisible = false;
      console.log("[Window] Hidden");
    } else {
      // ウィンドウを表示
      mainWindow.show();
      // クリックスルーを無効化（操作可能に）
      mainWindow.setIgnoreMouseEvents(false);
      isWindowVisible = true;
      console.log("[Window] Shown");

      // レンダラープロセスにイベントを送信
      mainWindow.webContents.send("hotkey-pressed");
    }
  });

  if (ret) {
    console.log(`[OK] Hotkey ${hotkey} registered successfully`);
    currentHotkey = hotkey;
  } else {
    console.error(`[Error] Failed to register hotkey: ${hotkey}`);
  }

  return ret;
}

app.whenReady().then(() => {
  createWindow();

  // IPCハンドラー: アイテム履歴を取得
  ipcMain.handle("get-item-history", async (event, itemId, options = {}) => {
    try {
      const history = await fetchItemHistory(itemId, options);
      return { success: true, data: history };
    } catch (error) {
      console.error("[IPC Error] Failed to get item history:", error);
      return { success: false, error: error.message };
    }
  });

  // IPCハンドラー: itemIdからアイテム情報を取得
  ipcMain.handle("get-item-info", async (event, itemId) => {
    try {
      const itemInfo = getItemInfoByItemId(itemId);
      if (itemInfo) {
        return { success: true, data: itemInfo };
      } else {
        return { success: false, error: `Item not found: itemId=${itemId}` };
      }
    } catch (error) {
      console.error("[IPC Error] Failed to get item info:", error);
      return { success: false, error: error.message };
    }
  });

  // IPCハンドラー: クリップボードからアイテム情報を取得
  ipcMain.handle("get-item-from-clipboard", async (event) => {
    try {
      const result = getItemFromClipboard();
      return result;
    } catch (error) {
      console.error("[IPC Error] Failed to get item from clipboard:", error);
      return { success: false, error: error.message };
    }
  });

  // IPCハンドラー: アイテム名からアイテム情報を取得
  ipcMain.handle("get-item-info-by-name", async (event, itemName) => {
    try {
      const itemInfo = getItemInfoByName(itemName);
      if (itemInfo) {
        return { success: true, data: itemInfo };
      } else {
        return {
          success: false,
          error: `アイテムが見つかりません: ${itemName}`,
        };
      }
    } catch (error) {
      console.error("[IPC Error] Failed to get item info by name:", error);
      return { success: false, error: error.message };
    }
  });

  // IPCハンドラー: ホットキーを設定
  ipcMain.handle("set-hotkey", async (event, newHotkey) => {
    try {
      const success = registerHotkey(newHotkey);
      if (success) {
        return { success: true, hotkey: newHotkey };
      } else {
        return { success: false, error: "ホットキーの登録に失敗しました" };
      }
    } catch (error) {
      console.error("[IPC Error] Failed to set hotkey:", error);
      return { success: false, error: error.message };
    }
  });

  // IPCハンドラー: 現在のホットキーを取得
  ipcMain.handle("get-hotkey", async () => {
    return { success: true, hotkey: currentHotkey };
  });

  // IPCハンドラー: ウィンドウを閉じる
  ipcMain.handle("hide-window", async () => {
    if (mainWindow) {
      mainWindow.hide();
      // クリックスルーを有効化
      mainWindow.setIgnoreMouseEvents(true, { forward: true });
      isWindowVisible = false;
      console.log("[Window] Hidden via IPC");
    }
    return { success: true };
  });

  // グローバルホットキーを登録
  console.log(`[Hotkey] Registering ${currentHotkey}...`);
  registerHotkey(currentHotkey);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  // ホットキーを全て解除
  globalShortcut.unregisterAll();

  if (process.platform !== "darwin") {
    app.quit();
  }
});

// アプリ終了時にホットキーを解除
app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

// Set console encoding to UTF-8 on Windows
if (process.platform === "win32") {
  try {
    // Try to set UTF-8 encoding
    process.stdout.setDefaultEncoding("utf8");
  } catch (e) {
    // Ignore if not supported
  }
}

console.log("PoE Goblin started!");
