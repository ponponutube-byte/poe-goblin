import { app, BrowserWindow, globalShortcut, ipcMain, screen, Tray, Menu, nativeImage } from "electron";
import { exec } from "child_process";
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
let tray = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 600,
    height: 800,
    frame: false, // フレームレス
    transparent: true, // 透明化
    alwaysOnTop: true, // 常に最前面
    skipTaskbar: true, // タスクバーに表示しない
    resizable: false,
    focusable: false, // ゲームからフォーカスを奪わない
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // ウィンドウ作成後に最高レベルで最前面設定
  mainWindow.setAlwaysOnTop(true, 'screen-saver');

  // すべてのワークスペース（仮想デスクトップ）で表示
  mainWindow.setVisibleOnAllWorkspaces(true);

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

  // 閉じるボタンでトレイに格納（終了しない）
  mainWindow.on("close", (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      mainWindow.setIgnoreMouseEvents(true, { forward: true });
      isWindowVisible = false;
      console.log("[Window] Hidden to tray");

      // 初回のみ通知を表示
      if (tray && !app.hasShownTrayNotification) {
        tray.displayBalloon({
          title: "PoE Goblin",
          content: `システムトレイに最小化しました。\n${currentHotkey} で価格チェックできます。`,
        });
        app.hasShownTrayNotification = true;
      }
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

/**
 * PowerShell を使って Ctrl+C をシミュレート
 * @returns {Promise<void>}
 */
function simulateCtrlC() {
  return new Promise((resolve, reject) => {
    const cmd = 'powershell -command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait(\'^c\')"';

    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.error('[Error] Failed to simulate Ctrl+C:', error);
        reject(error);
      } else {
        console.log('[OK] Ctrl+C simulated successfully');
        resolve();
      }
    });
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
      try {
        // 1. Ctrl+C をシミュレート（ウィンドウ表示前に実行）
        console.log("[Hotkey] Simulating Ctrl+C...");
        await simulateCtrlC();

        // 2. クリップボード更新を待つ（150-200ms）
        await new Promise(r => setTimeout(r, 150));
        console.log("[Hotkey] Clipboard should be updated");

        // 3. ウィンドウを表示
        mainWindow.show();
        mainWindow.setAlwaysOnTop(true, 'screen-saver'); // 最前面を再設定
        // クリックスルーを無効化（操作可能に）
        mainWindow.setIgnoreMouseEvents(false);
        isWindowVisible = true;
        console.log("[Window] Shown");

        // 4. レンダラープロセスにイベントを送信
        mainWindow.webContents.send("hotkey-pressed");
      } catch (error) {
        console.error("[Error] Failed to process hotkey:", error);
        // エラー時もウィンドウを表示してエラーメッセージを出せるようにする
        mainWindow.show();
        mainWindow.setAlwaysOnTop(true, 'screen-saver');
        mainWindow.setIgnoreMouseEvents(false);
        isWindowVisible = true;
        mainWindow.webContents.send("hotkey-pressed");
      }
    }
  });

  if (ret) {
    console.log(`[OK] Hotkey ${hotkey} registered successfully`);
    currentHotkey = hotkey;
    updateTrayMenu(); // トレイメニューを更新
  } else {
    console.error(`[Error] Failed to register hotkey: ${hotkey}`);
  }

  return ret;
}

/**
 * システムトレイを作成
 */
function createTray() {
  // アイコン画像のパス
  const iconPath = path.join(__dirname, "../../build/icon.png");

  let trayIcon;
  try {
    trayIcon = nativeImage.createFromPath(iconPath);
    // Windows では 16x16 にリサイズ
    if (process.platform === "win32") {
      trayIcon = trayIcon.resize({ width: 16, height: 16 });
    }
  } catch (e) {
    console.error("[Tray] Failed to load icon:", e);
    // フォールバック: 空のアイコン
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);
  tray.setToolTip("PoE Goblin - 価格チェックツール");

  updateTrayMenu();

  // トレイアイコンをクリックでウィンドウ表示/非表示
  tray.on("click", () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
        mainWindow.setIgnoreMouseEvents(true, { forward: true });
        isWindowVisible = false;
      } else {
        mainWindow.show();
        mainWindow.setAlwaysOnTop(true, 'screen-saver');
        mainWindow.setIgnoreMouseEvents(false);
        isWindowVisible = true;
      }
    }
  });

  console.log("[Tray] System tray created");
}

/**
 * トレイメニューを更新
 */
function updateTrayMenu() {
  if (!tray) return;

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "ウィンドウを表示",
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.setAlwaysOnTop(true, 'screen-saver');
          mainWindow.setIgnoreMouseEvents(false);
          isWindowVisible = true;
        }
      },
    },
    {
      label: `ホットキー: ${currentHotkey}`,
      enabled: false, // 表示のみ、クリック不可
    },
    { type: "separator" },
    {
      label: "終了",
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
}

app.whenReady().then(() => {
  createWindow();
  createTray(); // システムトレイを作成

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

// 完全終了の準備
app.on("before-quit", () => {
  app.isQuitting = true;
});

app.on("window-all-closed", () => {
  // トレイに常駐するため、ウィンドウが閉じてもアプリは終了しない
  // 終了は tray のメニューから行う
  // Macの場合は通常の挙動を維持
  if (process.platform === "darwin") {
    globalShortcut.unregisterAll();
    app.quit();
  }
  // Windows/Linuxでは何もしない（トレイに常駐）
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
