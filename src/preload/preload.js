const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  version: process.versions.electron,

  // アイテム履歴を取得
  getItemHistory: (itemId, options) =>
    ipcRenderer.invoke("get-item-history", itemId, options),

  // itemIdからアイテム情報を取得
  getItemInfo: (itemId) => ipcRenderer.invoke("get-item-info", itemId),

  // クリップボードからアイテム情報を取得
  getItemFromClipboard: () => ipcRenderer.invoke("get-item-from-clipboard"),

  // アイテム名からアイテム情報を取得
  getItemInfoByName: (itemName) =>
    ipcRenderer.invoke("get-item-info-by-name", itemName),

  // ホットキー設定
  setHotkey: (hotkey) => ipcRenderer.invoke("set-hotkey", hotkey),

  // ホットキー取得
  getHotkey: () => ipcRenderer.invoke("get-hotkey"),

  // ウィンドウを閉じる
  hideWindow: () => ipcRenderer.invoke("hide-window"),

  // ホットキー押下イベントを受信
  onHotkeyPressed: (callback) => ipcRenderer.on("hotkey-pressed", callback),
});
