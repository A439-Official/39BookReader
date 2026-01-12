const { BrowserWindow, Menu, MenuItem } = require("electron");
const path = require("node:path");

class WindowManager {
    constructor() {
        this.mainWindow = null;
    }

    createWindow() {
        this.mainWindow = new BrowserWindow({
            width: 1280,
            height: 720,
            icon: path.join(__dirname, "../resources/icon.png"),
            frame: false,
            webPreferences: {
                preload: path.join(__dirname, "../preload.js"),
                nodeIntegration: true,
            },
        });
        
        this._initShortcuts();
        return this.mainWindow;
    }

    getMainWindow() {
        return this.mainWindow;
    }

    _initShortcuts() {
        const menu = new Menu();
        
        // 添加应用菜单(macOS)
        if (process.platform === "darwin") {
            menu.append(new MenuItem({ role: "appMenu" }));
        }

        // 菜单项配置
        const menuItems = [
            {
                label: "Reload window",
                click: () => this.mainWindow.reload(),
                accelerator: "CommandOrControl+R",
            },
            {
                label: "Full screen",
                click: () => this.mainWindow.setFullScreen(!this.mainWindow.isFullScreen()),
                accelerator: "F11",
            },
        ];

        // 开发模式下添加开发者工具菜单项
        if (process.env.NODE_ENV === "development" || !require("electron").app.isPackaged) {
            menuItems.push({
                label: "Open DevTools",
                click: () => this.mainWindow.webContents.openDevTools(),
                accelerator: "CommandOrControl+Shift+I",
            });
        }

        // 构建子菜单并添加到主菜单
        const submenu = Menu.buildFromTemplate(menuItems);
        menu.append(new MenuItem({ label: "Custom Menu", submenu }));

        // 设置应用菜单
        Menu.setApplicationMenu(menu);
    }
}

module.exports = WindowManager;
