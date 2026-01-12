const { app, BrowserWindow, ipcMain, Menu, MenuItem, protocol, net, dialog, session } = require("electron");
const { autoUpdater } = require("electron-updater");
const nunjucks = require("nunjucks");
const path = require("node:path");
const url = require("node:url");
const fs = require("fs");
const ConfigManager = require("./configManager");
const Book = require("./api");
const DownloadManager = require("./downloadManager");
const ResourceManager = require("./resourceManager");

const appName = "39BookReader";
const downloadManager = new DownloadManager(appName);
const resourceManager = new ResourceManager(appName);
let mainWindow;
let configManager;
let book;
let api;

// 自动更新配置
autoUpdater.autoDownload = configManager.get("update.autoUpdate", true);
autoUpdater.autoInstallOnAppQuit = configManager.get("update.autoUpdate", true);
autoUpdater.allowPrerelease = configManager.get("update.allowPrerelease", false);

// 更新事件处理
autoUpdater.on("checking-for-update", () => {
    mainWindow?.webContents?.send("update-status", "checking");
});

autoUpdater.on("update-available", (info) => {
    mainWindow?.webContents?.send("update-available", info);
});

autoUpdater.on("update-not-available", (info) => {
    mainWindow?.webContents?.send("update-not-available", info);
});

autoUpdater.on("download-progress", (progress) => {
    mainWindow?.webContents?.send("update-progress", progress);
});

autoUpdater.on("update-downloaded", (info) => {
    mainWindow?.webContents?.send("update-downloaded", info);
});

autoUpdater.on("error", (err) => {
    mainWindow?.webContents?.send("update-error", err);
    console.error("自动更新错误:", err);
});

// 更新命令处理
ipcMain.handle("check-for-updates", () => {
    return autoUpdater.checkForUpdates();
});

ipcMain.handle("download-update", () => {
    return autoUpdater.downloadUpdate();
});

ipcMain.handle("quit-and-install", () => {
    autoUpdater.quitAndInstall();
});

{
    // 快捷键
    const menu = new Menu();
    if (process.platform === "darwin") {
        const appMenu = new MenuItem({ role: "appMenu" });
        menu.append(appMenu);
    }
    const menuItems = [
        {
            label: "Reload window",
            click: () => mainWindow.reload(),
            accelerator: "CommandOrControl+R",
        },
        {
            label: "Full screen",
            click: () => mainWindow.setFullScreen(!mainWindow.isFullScreen()),
            accelerator: "F11",
        },
    ];
    if (process.env.NODE_ENV === "development" || !app.isPackaged) {
        menuItems.push({
            label: "Open DevTools",
            click: () => mainWindow.webContents.openDevTools(),
            accelerator: "CommandOrControl+Shift+I",
        });
    }
    const submenu = Menu.buildFromTemplate(menuItems);
    menu.append(new MenuItem({ label: "Custom Menu", submenu }));
    Menu.setApplicationMenu(menu);
}

// 初始化API
function initAPI() {
    book = new Book(JSON.parse(fs.readFileSync(resourceManager.getResourcePath("api.json"), "utf-8")).rootUrl);
    api = {
        getBooks: () => {
            return [];
        },
        search: async (event, key, tabType = 3, offset = 0) => {
            console.log("search", key, tabType, offset);
            return await book.search(key, tabType, offset);
        },
        detail: async (event, bookId) => {
            console.log("detail", bookId);
            return await book.detail(bookId);
        },
        book: async (event, bookId) => {
            console.log("book", bookId);
            return await book.book(bookId);
        },
        directory: async (event, bookId) => {
            console.log("directory", bookId);
            return await book.directory(bookId);
        },
        content: async (event, tab, itemId, itemIds, bookId, showHtml, toneId, asyncMode) => {
            console.log("content", tab, itemId, itemIds, bookId, showHtml, toneId, asyncMode);
            return await book.content(tab, itemId, itemIds, bookId, showHtml, toneId, asyncMode);
        },
        chapter: async (event, itemId) => {
            console.log("chapter", itemId);
            return await book.chapter(itemId);
        },
        rawFull: async (event, itemId) => {
            console.log("rawFull", itemId);
            return await book.rawFull(itemId);
        },
        comment: async (event, bookId, count, offset) => {
            console.log("comment", bookId, count, offset);
            return await book.comment(bookId, count, offset);
        },
    };

    // 配置管理API
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

    // 注册API处理程序
    ipcMain.handle("api-books", api.getBooks);
    ipcMain.handle("api-search", api.search);
    ipcMain.handle("api-detail", api.detail);
    ipcMain.handle("api-book", api.book);
    ipcMain.handle("api-directory", api.directory);
    ipcMain.handle("api-content", api.content);
    ipcMain.handle("api-chapter", api.chapter);
    ipcMain.handle("api-rawFull", api.rawFull);
    ipcMain.handle("api-comment", api.comment);

    ipcMain.handle("config-get", configApi.getConfig);
    ipcMain.handle("config-set", configApi.setConfig);
    ipcMain.handle("config-delete", configApi.deleteConfig);
    ipcMain.handle("config-reset", configApi.resetConfig);
    ipcMain.handle("config-get-path", configApi.getConfigPath);
}

// 配置模板目录
const viewsPath = path.join(__dirname, "templates");
nunjucks.configure(viewsPath, {
    autoescape: true,
});

const createWindow = () => {
    // 初始化配置管理器
    configManager = new ConfigManager(appName);

    mainWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        icon: path.join(__dirname, "./resources/icon.png"),
        frame: false,
        webPreferences: {
            preload: path.join(__dirname, "./preload.js"),
            nodeIntegration: true,
        },
    });

    mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(nunjucks.render("index.html", {}))}`);
};

// 启动
app.whenReady().then(() => {
    // 检查更新
    if (!app.isPackaged) {
        autoUpdater.updateConfigPath = path.join(__dirname, "dev-app-update.yml");
    }
    autoUpdater.checkForUpdatesAndNotify();
    // 注册自定义协议以安全（真的吗）地提供本地文件
    protocol.handle("getfile", (request) => {
        let filePath = decodeURIComponent(request.url.slice("getfile:///".length));
        filePath = filePath.replace(/\//g, path.sep);

        // 安全检查
        const notallowed = ["C:\\Windows\\", "/Windows/", "C:\\Program Files\\", "/Program Files/"];

        for (let i = 0; i < notallowed.length; i++) {
            if (filePath.startsWith(notallowed[i])) {
                return new Response("Access denied", { status: 403 });
            }
        }
        if (!path.isAbsolute(filePath)) {
            if (app.isPackaged) {
                filePath = path.join(process.resourcesPath, filePath);
            } else {
                filePath = path.join(app.getAppPath(), filePath);
            }
        }
        try {
            const resolvedPath = path.resolve(filePath);
            return net.fetch(url.pathToFileURL(resolvedPath).toString());
        } catch (error) {
            console.error(`Failed to fetch file: ${filePath}`, error);
            return new Response("File not found", { status: 404 });
        }
    });

    // 先创建窗口显示加载界面
    createWindow();
    mainWindow.loadURL(
        `data:text/html;charset=utf-8,${encodeURIComponent(
            nunjucks.render("loading.html", {
                message: "正在初始化资源...",
            })
        )}`
    );

    // 在后台同步资源
    let retryCount = 0;
    const maxRetries = 3;
    const retryDelay = 2000; // 2秒

    const handleSyncComplete = () => {
        try {
            const apiConfig = JSON.parse(fs.readFileSync(resourceManager.getResourcePath("api.json"), "utf-8"));
            downloadManager.initBookApi(apiConfig.rootUrl);
            initAPI();

            // 资源准备好后加载主界面
            mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(nunjucks.render("index.html", {}))}`);
        } catch (error) {
            console.error("资源初始化失败:", error);
            if (retryCount < maxRetries) {
                retryCount++;
                console.log(`将在 ${retryDelay / 1000} 秒后重试 (${retryCount}/${maxRetries})`);
                setTimeout(() => {
                    // 重新触发资源同步
                    resourceManager
                        .syncResources()
                        .then(() => resourceManager.emit("syncComplete"))
                        .catch((err) => {
                            console.error("资源同步失败:", err);
                            handleSyncComplete();
                        });
                }, retryDelay);
            } else {
                console.error("资源初始化失败，已达到最大重试次数");
                mainWindow.loadURL(
                    `data:text/html;charset=utf-8,${encodeURIComponent(
                        nunjucks.render("loading.html", {
                            message: "资源加载失败，请检查网络连接后重启应用",
                        })
                    )}`
                );
            }
        }
    };

    // 监听资源同步完成事件
    resourceManager.on("syncComplete", handleSyncComplete);

    // 检查是否有本地缓存的资源可用
    if (fs.existsSync(resourceManager.getResourcePath(".files.json"))) {
        // 有缓存则先快速加载界面
        mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(nunjucks.render("index.html", {}))}`);
    }

    ipcMain.handle("quit-app", () => {
        app.quit();
    });
    ipcMain.handle("open-file-picker", async (event, options) => {
        const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, options);
        if (canceled) {
            return [];
        }
        return filePaths;
    });
    ipcMain.handle("version", () => {
        return app.getVersion();
    });

    // 导航
    ipcMain.on("navigate", (event, path) => {
        console.log("navigate", path);
        if (path.startsWith("/book/")) {
            if (downloadManager.getBookInfo(path.slice("/book/".length))) {
                mainWindow.loadURL(
                    `data:text/html;charset=utf-8,${encodeURIComponent(
                        nunjucks.render("book.html", {
                            bookId: path.slice("/book/".length),
                            book: downloadManager.getBookInfo(path.slice("/book/".length)),
                        })
                    )}`
                );
            }
        } else if (path.startsWith("/chapter/")) {
            const [bookId, chapterId] = path.slice("/chapter/".length).split("/");
            if (downloadManager.getBookInfo(bookId) && downloadManager.getChapter(bookId, chapterId)) {
                mainWindow.loadURL(
                    `data:text/html;charset=utf-8,${encodeURIComponent(
                        nunjucks.render("chapter.html", {
                            bookId: bookId,
                            chapterId: chapterId,
                            chapter: downloadManager.getChapter(bookId, chapterId),
                        })
                    )}`
                );
            } else {
                mainWindow.loadURL(
                    `data:text/html;charset=utf-8,${encodeURIComponent(
                        nunjucks.render("book.html", {
                            bookId: bookId,
                            book: downloadManager.getBookInfo(bookId),
                        })
                    )}`
                );
            }
        } else {
            mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(nunjucks.render(path, {}))}`);
        }
    });

    // 下载管理 API
    ipcMain.handle("download-book", async (event, bookId, skipDownloadedChapters = true) => {
        try {
            return await downloadManager.downloadBook(bookId, skipDownloadedChapters);
        } catch (error) {
            console.error("下载启动失败:", error);
            return { success: false, error: error.message };
        }
    });
    ipcMain.handle("download-get-all", () => downloadManager.getDownloads());
    ipcMain.handle("download-get", (event, bookId) => downloadManager.getDownload(bookId));
    ipcMain.handle("download-get-dir", () => downloadManager.getDownloadDir());
    ipcMain.handle("get-books", () => downloadManager.getDownloadedBookIds());
    ipcMain.handle("get-book-info", (event, bookId) => downloadManager.getBookInfo(bookId));
    ipcMain.handle("get-chapter", (event, bookId, chapterId) => downloadManager.getChapter(bookId, chapterId));

    session.defaultSession.clearCache();

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// 退出
app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});
