const { ipcMain } = require("electron");
const nunjucks = require("nunjucks");

/**
 * IPC Handlers 模块
 * 集中管理所有IPC事件处理程序
 */

class IpcHandlers {
    /**
     * 初始化IPC处理程序
     * @param {Object} dependencies - 依赖对象
     * @param {Object} dependencies.autoUpdater - 自动更新器
     * @param {Object} dependencies.app - Electron app实例
     * @param {Object} dependencies.dialog - Electron dialog模块
     * @param {Object} dependencies.windowManager - 窗口管理器
     * @param {Object} dependencies.downloadManager - 下载管理器
     * @param {Object} dependencies.configManager - 配置管理器
     * @param {Object} dependencies.api - API对象
     */
    static init(dependencies) {
        const { autoUpdater, app, dialog, windowManager, downloadManager, configManager, api } = dependencies;

        // 更新相关handlers
        this._registerUpdateHandlers(autoUpdater);

        // API相关handlers
        if (api) {
            this._registerApiHandlers(api);
        }

        // 配置相关handlers
        if (configManager) {
            this._registerConfigHandlers(configManager);
        }

        // 应用控制handlers
        this._registerAppHandlers(app, dialog, windowManager);

        // 导航handler
        this._registerNavigationHandler(windowManager, downloadManager);

        // 下载管理handlers
        if (downloadManager) {
            this._registerDownloadHandlers(downloadManager);
        }
    }

    /**
     * 注册更新相关handlers
     * @param {Object} autoUpdater - 自动更新器
     */
    static _registerUpdateHandlers(autoUpdater) {
        const updateHandlers = {
            "check-for-updates": () => autoUpdater.checkForUpdates(),
            "download-update": () => autoUpdater.downloadUpdate(),
            "quit-and-install": () => autoUpdater.quitAndInstall(),
        };

        this._registerHandlers(updateHandlers);
    }

    /**
     * 注册API相关handlers
     * @param {Object} api - API对象
     */
    static _registerApiHandlers(api) {
        const apiHandlers = {
            "api-search": api.search,
            "api-detail": api.detail,
            "api-book": api.book,
            "api-directory": api.directory,
            "api-content": api.content,
            "api-chapter": api.chapter,
            "api-rawFull": api.rawFull,
            "api-comment": api.comment,
        };

        this._registerHandlers(apiHandlers);
    }

    /**
     * 注册配置相关handlers
     * @param {Object} configManager - 配置管理器
     */
    static _registerConfigHandlers(configManager) {
        const configApi = {
            getConfig: (event, key = null, defaultValue = null) => {
                return configManager.get(key, defaultValue);
            },
            setConfig: (event, key, value) => {
                return configManager.set(key, value);
            },
            deleteConfig: (event, key) => {
                return configManager.delete(key);
            },
            resetConfig: () => {
                return configManager.reset();
            },
            getConfigPath: () => {
                return {
                    dir: configManager.getConfigDir(),
                    file: configManager.getConfigFile(),
                };
            },
        };

        const configHandlers = {
            "config-get": configApi.getConfig,
            "config-set": configApi.setConfig,
            "config-delete": configApi.deleteConfig,
            "config-reset": configApi.resetConfig,
            "config-get-path": configApi.getConfigPath,
        };

        this._registerHandlers(configHandlers);
    }

    /**
     * 注册应用控制handlers
     * @param {Object} app - Electron app实例
     * @param {Object} dialog - Electron dialog模块
     * @param {Object} windowManager - 窗口管理器
     */
    static _registerAppHandlers(app, dialog, windowManager) {
        const appHandlers = {
            "quit-app": () => app.quit(),
            "open-file-picker": async (event, options) => {
                const { canceled, filePaths } = await dialog.showOpenDialog(windowManager.getMainWindow(), options);
                if (canceled) {
                    return [];
                }
                return filePaths;
            },
            version: () => app.getVersion(),
        };

        this._registerHandlers(appHandlers);
    }

    /**
     * 注册导航handler
     * @param {Object} windowManager - 窗口管理器
     * @param {Object} downloadManager - 下载管理器
     */
    static _registerNavigationHandler(windowManager, downloadManager) {
        ipcMain.on("navigate", (event, path) => {
            console.log("navigate", path);
            if (path.startsWith("/book/")) {
                const bookId = path.slice("/book/".length);
                if (downloadManager.getBookInfo(bookId)) {
                    windowManager.getMainWindow().loadURL(
                        `data:text/html;charset=utf-8,${encodeURIComponent(
                            nunjucks.render("book.html", {
                                bookId: bookId,
                                book: downloadManager.getBookInfo(bookId),
                            })
                        )}`
                    );
                }
            } else if (path.startsWith("/chapter/")) {
                const [bookId, chapterId] = path.slice("/chapter/".length).split("/");
                if (downloadManager.getBookInfo(bookId) && downloadManager.getChapter(bookId, chapterId)) {
                    windowManager.getMainWindow().loadURL(
                        `data:text/html;charset=utf-8,${encodeURIComponent(
                            nunjucks.render("chapter.html", {
                                bookId: bookId,
                                chapterId: chapterId,
                                chapter: downloadManager.getChapter(bookId, chapterId),
                            })
                        )}`
                    );
                } else {
                    windowManager.getMainWindow().loadURL(
                        `data:text/html;charset=utf-8,${encodeURIComponent(
                            nunjucks.render("book.html", {
                                bookId: bookId,
                                book: downloadManager.getBookInfo(bookId),
                            })
                        )}`
                    );
                }
            } else {
                windowManager.getMainWindow().loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(nunjucks.render(path, {}))}`);
            }
        });
    }

    /**
     * 注册下载管理handlers
     * @param {Object} downloadManager - 下载管理器
     */
    static _registerDownloadHandlers(downloadManager) {
        const downloadHandlers = {
            "download-book": async (event, bookId, skipDownloadedChapters = true) => {
                try {
                    return await downloadManager.downloadBook(bookId, skipDownloadedChapters);
                } catch (error) {
                    console.error("下载启动失败:", error);
                    return { success: false, error: error.message };
                }
            },
            "download-get-all": () => downloadManager.getDownloads(),
            "download-get": (event, bookId) => downloadManager.getDownload(bookId),
            "download-get-dir": () => downloadManager.getDownloadDir(),
            "get-books": () => downloadManager.getDownloadedBookIds(),
            "get-book-info": (event, bookId) => downloadManager.getBookInfo(bookId),
            "get-chapter": (event, bookId, chapterId) => downloadManager.getChapter(bookId, chapterId),
        };

        this._registerHandlers(downloadHandlers);
    }

    /**
     * 批量注册handlers
     * @param {Object} handlers - 处理器对象，键为通道名，值为处理函数
     */
    static _registerHandlers(handlers) {
        Object.entries(handlers).forEach(([channel, handler]) => {
            ipcMain.handle(channel, handler);
        });
    }
}

module.exports = IpcHandlers;
