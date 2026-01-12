const { app, BrowserWindow, protocol, net, dialog, session } = require("electron");
const { autoUpdater } = require("electron-updater");
const nunjucks = require("nunjucks");
const path = require("node:path");
const url = require("node:url");
const fs = require("fs");
const ConfigManager = require("./configManager");
const Book = require("./api");
const DownloadManager = require("./downloadManager");
const ResourceManager = require("./resourceManager");
const WindowManager = require("./main/window.js");
const IpcHandlers = require("./main/ipcHandlers");

const appName = "39BookReader";
const downloadManager = new DownloadManager(appName);
const resourceManager = new ResourceManager(appName);
const windowManager = new WindowManager();
let configManager;
let book;
let api;

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

// 初始化API
function initAPI(book) {
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

    IpcHandlers._registerApiHandlers(api);
}

// 配置模板目录
const viewsPath = path.join(__dirname, "templates");
nunjucks.configure(viewsPath, {
    autoescape: true,
});

const createWindow = () => {
    // 初始化配置管理器
    configManager = new ConfigManager(appName);

    // 自动更新配置
    autoUpdater.autoDownload = configManager.get("update.autoUpdate", true);
    autoUpdater.autoInstallOnAppQuit = configManager.get("update.autoUpdate", true);
    autoUpdater.allowPrerelease = configManager.get("update.allowPrerelease", false);

    const mainWindow = windowManager.createWindow();

    mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(nunjucks.render("index.html", {}))}`);

    return mainWindow;
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
    const mainWindow = createWindow();

    // 在创建窗口后立即初始化API handlers
    IpcHandlers.init({
        autoUpdater,
        app,
        dialog,
        windowManager,
        downloadManager,
        configManager,
        api: null, // 初始化为null，等资源加载后再设置
    });

    windowManager.getMainWindow().loadURL(
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

    let isAPIInitialized = false;
    const handleSyncComplete = () => {
        try {
            apiurl = JSON.parse(fs.readFileSync(resourceManager.getResourcePath("api.json"), "utf-8")).rootUrl;
            book = new Book(apiurl);
            downloadManager.initBookApi(book);
            initAPI(book);

            // 资源准备好后加载主界面
            windowManager.getMainWindow().loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(nunjucks.render("index.html", {}))}`);
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
                windowManager.getMainWindow().loadURL(
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

    session.defaultSession.clearCache();

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            const mainWindow = createWindow();
            windowManager.getMainWindow().loadURL(
                `data:text/html;charset=utf-8,${encodeURIComponent(
                    nunjucks.render("loading.html", {
                        message: "正在初始化资源...",
                    })
                )}`
            );
        }
    });
});

// 退出
app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});
