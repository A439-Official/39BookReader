const { contextBridge, ipcRenderer } = require("electron");
const path = require("path");

contextBridge.exposeInMainWorld("version", () => ipcRenderer.invoke("version"));

contextBridge.exposeInMainWorld("versions", {
    node: () => process.versions.node,
    chrome: () => process.versions.chrome,
    electron: () => process.versions.electron,
});

contextBridge.exposeInMainWorld("resources", {
    getPath: (relativePath) => path.join(__dirname, relativePath),
    getFileURL: (filePath) => {
        return `getfile:///${filePath.replace(/\\/g, "/")}`;
    },
});

contextBridge.exposeInMainWorld("api", {
    books: () => ipcRenderer.invoke("api-books"),
    search: ({ key, tabType = 3, offset = 0 }) => ipcRenderer.invoke("api-search", key, tabType, offset),
    quit: () => ipcRenderer.invoke("quit-app"),
    openFilePicker: (options) => ipcRenderer.invoke("open-file-picker", options),
});

contextBridge.exposeInMainWorld("navigate", {
    to: (url) => ipcRenderer.send("navigate", url),
});

// 配置管理 API
contextBridge.exposeInMainWorld("config", {
    get: (key = null, defaultValue = null) => ipcRenderer.invoke("config-get", key, defaultValue),
    set: (key, value) => ipcRenderer.invoke("config-set", key, value),
    delete: (key) => ipcRenderer.invoke("config-delete", key),
    reset: () => ipcRenderer.invoke("config-reset"),
    getPath: () => ipcRenderer.invoke("config-get-path"),
});

// 下载管理 API
contextBridge.exposeInMainWorld("download", {
    downloadBook: (bookId, skipDownloadedChapters = true) => ipcRenderer.invoke("download-book", bookId, skipDownloadedChapters),
    getDownloads: () => ipcRenderer.invoke("download-get-all"),
    getDownload: (bookId) => ipcRenderer.invoke("download-get", bookId),
    getDownloadDir: () => ipcRenderer.invoke("download-get-dir"),
});

// 小说管理 API
contextBridge.exposeInMainWorld("books", {
    getBooks: () => ipcRenderer.invoke("get-books"),
    getBookInfo: (bookId) => ipcRenderer.invoke("get-book-info", bookId),
    getChapter: (bookId, chapterId) => ipcRenderer.invoke("get-chapter", bookId, chapterId),
});
