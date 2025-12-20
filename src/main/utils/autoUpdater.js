/**
 * 自動アップデート機能
 * electron-updater を使用してGitHub Releasesから最新版をチェック
 */

import pkg from "electron-updater";
const { autoUpdater } = pkg;
import { dialog, app } from "electron";
import log from "electron-log";

// ログ設定
log.transports.file.level = "info";
autoUpdater.logger = log;

// 自動ダウンロードを無効化（ユーザーに確認してから）
autoUpdater.autoDownload = false;

// ポータブル版かどうかを判定
const isPortable = process.env.PORTABLE_EXECUTABLE_DIR !== undefined;

/**
 * アップデート機能をセットアップ
 * @param {BrowserWindow} mainWindow - メインウィンドウ
 */
export function setupAutoUpdater(mainWindow) {
  log.info("[AutoUpdater] Setting up auto-updater");
  log.info(`[AutoUpdater] Current version: ${app.getVersion()}`);
  log.info(`[AutoUpdater] Is portable: ${isPortable}`);

  // ポータブル版の場合はGitHub APIを使用した簡易チェック
  if (isPortable) {
    log.info("[AutoUpdater] Portable version detected, using manual check");
    setupManualUpdateCheck(mainWindow);
    return;
  }

  // インストーラー版：electron-updaterを使用
  setupElectronUpdater(mainWindow);
}

/**
 * electron-updater を使用した自動アップデート（インストーラー版）
 * @param {BrowserWindow} mainWindow - メインウィンドウ
 */
function setupElectronUpdater(mainWindow) {
  // アップデートが利用可能な時
  autoUpdater.on("update-available", (info) => {
    log.info(`[AutoUpdater] Update available: ${info.version}`);

    dialog
      .showMessageBox({
        type: "info",
        title: "アップデートのお知らせ",
        message: `新しいバージョン ${info.version} が利用可能です`,
        detail: `現在のバージョン: ${app.getVersion()}\n\nダウンロードしますか？`,
        buttons: ["ダウンロード", "後で"],
        defaultId: 0,
        cancelId: 1,
      })
      .then((result) => {
        if (result.response === 0) {
          log.info("[AutoUpdater] User chose to download update");
          autoUpdater.downloadUpdate();

          // ダウンロード開始をレンダラープロセスに通知
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send("update-download-started");
          }
        } else {
          log.info("[AutoUpdater] User chose to skip update");
        }
      });
  });

  // アップデートがない時
  autoUpdater.on("update-not-available", (info) => {
    log.info("[AutoUpdater] No updates available");
    log.info(`[AutoUpdater] Current version ${info.version} is up to date`);
  });

  // ダウンロード進捗
  autoUpdater.on("download-progress", (progressObj) => {
    const percent = Math.round(progressObj.percent);
    log.info(
      `[AutoUpdater] Download progress: ${percent}% (${progressObj.transferred}/${progressObj.total})`
    );

    // メインウィンドウに進捗を送信
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("update-download-progress", {
        percent,
        transferred: progressObj.transferred,
        total: progressObj.total,
      });
    }
  });

  // ダウンロード完了
  autoUpdater.on("update-downloaded", (info) => {
    log.info(`[AutoUpdater] Update downloaded: ${info.version}`);

    dialog
      .showMessageBox({
        type: "info",
        title: "アップデート準備完了",
        message: "アップデートのダウンロードが完了しました",
        detail: `バージョン ${info.version}\n\n今すぐ再起動してアップデートを適用しますか？`,
        buttons: ["今すぐ再起動", "後で"],
        defaultId: 0,
        cancelId: 1,
      })
      .then((result) => {
        if (result.response === 0) {
          log.info("[AutoUpdater] User chose to install update now");
          // アプリを終了して新バージョンをインストール
          autoUpdater.quitAndInstall(false, true);
        } else {
          log.info("[AutoUpdater] User chose to install update later");
        }
      });
  });

  // エラー処理
  autoUpdater.on("error", (error) => {
    log.error("[AutoUpdater] Error:", error);
    // エラーは静かに処理（ユーザーには通知しない）
    // ネットワークエラーなどで毎回通知が出るのを避ける
  });

  log.info("[AutoUpdater] electron-updater setup complete");
}

/**
 * GitHub API を使用した手動アップデートチェック（ポータブル版）
 * @param {BrowserWindow} mainWindow - メインウィンドウ
 */
async function setupManualUpdateCheck(mainWindow) {
  try {
    const result = await checkForUpdatesManual();

    if (result.hasUpdate) {
      log.info(
        `[AutoUpdater] Manual check: Update available ${result.version}`
      );

      dialog
        .showMessageBox({
          type: "info",
          title: "アップデートのお知らせ",
          message: `新しいバージョン ${result.version} が利用可能です`,
          detail: `現在のバージョン: ${app.getVersion()}\n\nダウンロードページを開きますか？`,
          buttons: ["ダウンロードページを開く", "後で"],
          defaultId: 0,
          cancelId: 1,
        })
        .then(async (dialogResult) => {
          if (dialogResult.response === 0) {
            log.info("[AutoUpdater] Opening download page");
            const { shell } = await import("electron");
            shell.openExternal(result.downloadUrl);
          }
        });
    } else {
      log.info("[AutoUpdater] Manual check: No updates available");
    }
  } catch (error) {
    log.error("[AutoUpdater] Manual check error:", error);
    // エラーは静かに処理
  }
}

/**
 * GitHub API を使用して最新バージョンをチェック
 * @returns {Promise<Object>} アップデート情報
 */
async function checkForUpdatesManual() {
  const response = await fetch(
    "https://api.github.com/repos/ponponutube-byte/poe-goblin/releases/latest"
  );

  if (!response.ok) {
    throw new Error(`GitHub API request failed: ${response.status}`);
  }

  const release = await response.json();
  const latestVersion = release.tag_name.replace("v", "");
  const currentVersion = app.getVersion();

  log.info(
    `[AutoUpdater] Manual check: Current=${currentVersion}, Latest=${latestVersion}`
  );

  // バージョン比較（簡易版）
  const hasUpdate = compareVersions(latestVersion, currentVersion) > 0;

  if (hasUpdate) {
    // ポータブル版のダウンロードURLを取得
    const portableAsset = release.assets.find((a) =>
      a.name.includes("portable")
    );

    return {
      hasUpdate: true,
      version: latestVersion,
      downloadUrl:
        portableAsset?.browser_download_url || release.html_url,
    };
  }

  return { hasUpdate: false };
}

/**
 * バージョン番号を比較
 * @param {string} v1 - バージョン1
 * @param {string} v2 - バージョン2
 * @returns {number} v1 > v2 なら正の数、v1 < v2 なら負の数、v1 === v2 なら0
 */
function compareVersions(v1, v2) {
  const parts1 = v1.split(".").map(Number);
  const parts2 = v2.split(".").map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const part1 = parts1[i] || 0;
    const part2 = parts2[i] || 0;

    if (part1 > part2) return 1;
    if (part1 < part2) return -1;
  }

  return 0;
}

/**
 * アップデートを手動でチェック（IPC経由で呼び出される）
 * @returns {Promise<Object>} チェック結果
 */
export async function checkForUpdatesManually() {
  log.info("[AutoUpdater] Manual update check triggered");

  if (isPortable) {
    try {
      const result = await checkForUpdatesManual();
      return {
        success: true,
        hasUpdate: result.hasUpdate,
        version: result.version,
        isPortable: true,
      };
    } catch (error) {
      log.error("[AutoUpdater] Manual check error:", error);
      return {
        success: false,
        error: error.message,
        isPortable: true,
      };
    }
  } else {
    try {
      const result = await autoUpdater.checkForUpdates();
      return {
        success: true,
        hasUpdate: result?.updateInfo?.version !== app.getVersion(),
        version: result?.updateInfo?.version,
        isPortable: false,
      };
    } catch (error) {
      log.error("[AutoUpdater] Check error:", error);
      return {
        success: false,
        error: error.message,
        isPortable: false,
      };
    }
  }
}

/**
 * アップデートチェックを実行
 */
export function checkForUpdates() {
  log.info("[AutoUpdater] Checking for updates...");

  if (isPortable) {
    // ポータブル版は何もしない（setupManualUpdateCheckで処理済み）
    log.info("[AutoUpdater] Portable version, skipping auto-check");
  } else {
    autoUpdater.checkForUpdates().catch((error) => {
      log.error("[AutoUpdater] Check error:", error);
    });
  }
}
