const { autoUpdater } = require("electron-updater");

function setupAutoUpdater(windowManager, configManager) {
    // 更新事件处理
    autoUpdater.on("checking-for-update", () => {
        windowManager.getMainWindow()?.webContents?.send("update-status", "checking");
    });

    autoUpdater.on("update-available", (info) => {
        windowManager.getMainWindow()?.webContents?.send("update-available", info);
    });

    autoUpdater.on("update-not-available", (info) => {
        windowManager.getMainWindow()?.webContents?.send("update-not-available", info);
    });

    autoUpdater.on("download-progress", (progress) => {
        windowManager.getMainWindow()?.webContents?.send("update-progress", progress);
    });

    autoUpdater.on("update-downloaded", (info) => {
        windowManager.getMainWindow()?.webContents?.send("update-downloaded", info);
    });

    autoUpdater.on("error", (err) => {
        windowManager.getMainWindow()?.webContents?.send("update-error", err);
        console.error("自动更新错误:", err);
    });

    // 自动更新配置
    autoUpdater.autoDownload = configManager.get("update.autoUpdate", true);
    autoUpdater.autoInstallOnAppQuit = configManager.get("update.autoUpdate", true);
    autoUpdater.allowPrerelease = configManager.get("update.allowPrerelease", false);
}

function checkForUpdates() {
    autoUpdater.checkForUpdatesAndNotify();
}

module.exports = {
    autoUpdater,
    setupAutoUpdater,
    checkForUpdates,
};
