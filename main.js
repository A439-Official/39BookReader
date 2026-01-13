const { app, BrowserWindow, dialog, session } = require("electron");
const nunjucks = require("nunjucks");
const path = require("node:path");
const { autoUpdater, setupAutoUpdater, checkForUpdates } = require("./scripts/autoUpdater.js");
const { registerProtocolHandler } = require("./scripts/protocolHandler.js");
const fs = require("fs");
const ConfigManager = require("./scripts/configManager.js");
const Book = require("./scripts/api.js");
const DownloadManager = require("./scripts/downloadManager.js");
const ResourceManager = require("./scripts/resourceManager.js");
const WindowManager = require("./scripts/window.js");
const IpcHandlers = require("./scripts/ipcHandlers.js");

const appName = "39BookReader";
const downloadManager = new DownloadManager(appName);
const resourceManager = new ResourceManager(appName);
const windowManager = new WindowManager();
let configManager;
let book;
let api;

// 配置模板目录
const viewsPath = path.join(__dirname, "templates");
nunjucks.configure(viewsPath, {
    autoescape: true,
});

const createWindow = () => {
    // 初始化配置管理器
    configManager = new ConfigManager(appName);

    // 设置自动更新
    setupAutoUpdater(windowManager, configManager);

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
    checkForUpdates();
    // 注册协议处理器
    registerProtocolHandler(app);

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

    const handleSyncComplete = () => {
        try {
            apiurl = JSON.parse(fs.readFileSync(resourceManager.getResourcePath("api.json"), "utf-8")).rootUrl;
            book = new Book(apiurl);
            downloadManager.initBookApi(book);
            api = IpcHandlers.initAPI(book);
            IpcHandlers._registerApiHandlers(api);

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
