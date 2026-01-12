const fs = require("fs");
const path = require("path");
const { app } = require("electron");
const Book = require("./api");
const { encrypt } = require("./utils");

/**
 * 下载管理器
 */
class DownloadManager {
    constructor(appName = "39BookReader") {
        this.appName = appName;
        this.author = "A439";
        this.downloadDir = path.join(app.getPath("appData"), this.author, this.appName, "books");
        this.ensureDownloadDirExists();
        this.downloads = new Map(); // bookId -> download task
        this.bookApi = null;
        this.initialized = false;
    }

    /**
     * 初始化Book API
     */
    initBookApi(apiConfig) {
        this.bookApi = new Book(apiConfig);
        this.initialized = true;
    }

    /**
     * 检查是否已初始化
     */
    ensureInitialized() {
        if (!this.initialized) {
            throw new Error("DownloadManager not initialized - call initBookApi() first");
        }
    }

    /**
     * 确保下载目录存在
     */
    ensureDownloadDirExists() {
        if (!fs.existsSync(this.downloadDir)) {
            fs.mkdirSync(this.downloadDir, { recursive: true });
        }
    }

    /**
     * 开始下载小说
     * @param {string} bookId - 小说ID
     * @returns {Object} 下载任务信息
     */
    async downloadBook(bookId, skipDownloadedChapters = true) {
        this.ensureInitialized();
        
        // 检查是否已经在下载
        if (this.downloads.has(bookId)) {
            const task = this.downloads.get(bookId);
            if (task.status === "downloading") {
                return {
                    success: false,
                    message: "小说已在下载中",
                    task: this._formatTask(task),
                };
            }
        }

        // 创建新的下载任务
        const task = {
            bookId,
            status: "downloading",
            progress: 0,
            totalChapters: 0,
            downloadedChapters: 0,
            bookInfo: null,
            chapters: [],
            error: null,
            downloadPath: null,
            skipDownloadedChapters,
        };

        this.downloads.set(bookId, task);

        // 开始下载（异步）
        this._startDownload(bookId).catch((error) => {
            console.error(`下载小说 ${bookId} 失败:`, error);
            const failedTask = this.downloads.get(bookId);
            if (failedTask) {
                failedTask.status = "failed";
                failedTask.error = error.message;
            }
        });

        return {
            success: true,
            message: "下载任务已开始",
            task: this._formatTask(task),
        };
    }

    /**
     * 内部方法：开始下载
     */
    async _startDownload(bookId) {
        const task = this.downloads.get(bookId);
        if (!task) return;

        try {
            // 1. 获取小说详情
            const info_data = await this.bookApi.detail(bookId);

            // 2. 获取小说目录
            const directory = await this.bookApi.directory(bookId);

            // 处理目录数据
            task.chapters = directory.data.lists;

            task.bookInfo = {
                book_id: info_data.data.data.book_id,
                book_name: info_data.data.data.book_name,
                original_book_name: info_data.data.data.original_book_name,
                author: info_data.data.data.author,
                abstract: info_data.data.data.abstract,
                score: info_data.data.data.score,
                word_number: info_data.data.data.word_number,
                category: info_data.data.data.category,
                pure_category_tags: info_data.data.data.pure_category_tags,
                thumb_url: info_data.data.data.thumb_url,
                creation_status: info_data.data.data.creation_status,
                chapter_list: task.chapters,
            };

            if (task.chapters.length === 0) {
                throw new Error("未找到章节信息");
            }

            // 3. 创建小说下载目录
            const bookDownloadDir = path.join(this.downloadDir, bookId);

            if (!fs.existsSync(bookDownloadDir)) {
                fs.mkdirSync(bookDownloadDir, { recursive: true });
            }

            task.downloadPath = bookDownloadDir;

            // 4. 保存小说信息
            const bookInfoFile = path.join(bookDownloadDir, "info.json");
            fs.writeFileSync(bookInfoFile, JSON.stringify(task.bookInfo, null, 4), "utf8");

            // 5. 下载每个章节
            for (let i = 0; i < task.chapters.length; i++) {
                const chapter = task.chapters[i];
                const chapterFile = path.join(bookDownloadDir, `${chapter.item_id}.json`);

                // 检查章节是否已下载且需要跳过
                if (task.skipDownloadedChapters && fs.existsSync(chapterFile)) {
                    // 跳过已下载章节但更新进度
                    task.downloadedChapters = i + 1;
                    task.progress = Math.round(((i + 1) / task.chapters.length) * 100);
                    continue;
                }

                let retryCount = 0;
                const maxRetries = 3;
                let lastError = null;
                
                while (retryCount < maxRetries) {
                    try {
                        // 获取章节内容
                        const content_data = await this.bookApi.content("小说", chapter.item_id);

                        // 保存章节内容
                        const content = encrypt(content_data.data.content, chapter.item_id.slice(-8));
                        fs.writeFileSync(
                            chapterFile,
                            JSON.stringify(
                                {
                                    title: chapter.title,
                                    content: content,
                                },
                                null,
                                4
                            ),
                            "utf8"
                        );

                        // 更新进度
                        task.downloadedChapters = i + 1;
                        task.progress = Math.round(((i + 1) / task.chapters.length) * 100);
                        break; // 成功则退出重试循环
                    } catch (error) {
                        lastError = error;
                        retryCount++;
                        console.error(`下载章节 ${i + 1} 失败 (尝试 ${retryCount}/${maxRetries}):`, error);
                        
                        if (retryCount < maxRetries) {
                            // 等待1秒后重试
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        }
                    }
                }
                
                if (retryCount === maxRetries && lastError) {
                    console.error(`下载章节 ${i + 1} 最终失败:`, lastError);
                    // 继续下载下一个章节
                }
            }

            // 6. 完成下载
            task.status = "completed";
            task.progress = 100;

            console.log(`小说 ${bookId} 下载完成`);
        } catch (error) {
            console.error(`下载小说 ${bookId} 失败:`, error);
            task.status = "failed";
            task.error = error.message;
        }
    }

    /**
     * 格式化任务信息
     */
    _formatTask(task) {
        return {
            bookId: task.bookId,
            status: task.status,
            progress: task.progress,
            totalChapters: task.chapters.length,
            downloadedChapters: task.downloadedChapters,
            bookTitle: task.bookInfo?.book_name || `小说 ${task.bookId}`,
            error: task.error,
            downloadPath: task.downloadPath,
        };
    }

    /**
     * 获取所有下载任务
     * @returns {Array} 下载任务列表
     */
    getDownloads() {
        const downloads = [];
        for (const task of this.downloads.values()) {
            downloads.push(this._formatTask(task));
        }
        return downloads;
    }

    /**
     * 获取特定小说的下载任务
     * @param {string} bookId - 小说ID
     */
    getDownload(bookId) {
        const task = this.downloads.get(bookId);
        return task ? this._formatTask(task) : null;
    }

    /**
     * 获取下载目录路径
     */
    getDownloadDir() {
        return this.downloadDir;
    }

    /**
     * 获取已下载的小说ID列表
     * @returns {Array<string>} 已下载的小说ID数组
     */
    getDownloadedBookIds() {
        const bookIds = [];
        try {
            if (!fs.existsSync(this.downloadDir)) {
                return bookIds;
            }
            const folders = fs.readdirSync(this.downloadDir);
            for (const folder of folders) {
                const bookDir = path.join(this.downloadDir, folder);
                if (!fs.statSync(bookDir).isDirectory()) {
                    continue;
                }
                if (fs.existsSync(path.join(bookDir, "info.json"))) {
                    bookIds.push(folder);
                }
            }
        } catch (error) {
            console.error("获取已下载小说ID列表失败:", error);
        }
        return bookIds;
    }

    /**
     * 获取已下载小说的信息
     * @param {string} bookId - 小说ID
     * @returns {Object|null} 小说信息，如果不存在则返回null
     */
    getBookInfo(bookId) {
        try {
            const bookDir = path.join(this.downloadDir, bookId);
            const infoFile = path.join(bookDir, "info.json");
            if (!fs.existsSync(bookDir) || !fs.existsSync(infoFile)) {
                return null;
            }
            return JSON.parse(fs.readFileSync(infoFile, "utf8"));
        } catch (error) {
            console.error(`获取小说 ${bookId} 信息失败:`, error);
            return null;
        }
    }

    /**
     * 获取指定小说的指定章节内容
     * @param {string} bookId - 小说ID
     * @param {string} chapterId - 章节ID
     * @param {boolean} decryptContent - 是否解密章节内容（默认true）
     * @returns {Object|null} 章节信息，如果不存在则返回null
     */
    getChapter(bookId, chapterId) {
        try {
            const bookDir = path.join(this.downloadDir, bookId);
            const chapterFile = path.join(bookDir, `${chapterId}.json`);
            if (!fs.existsSync(bookDir) || !fs.existsSync(chapterFile)) {
                return null;
            }
            const chapterData = fs.readFileSync(chapterFile, "utf8");
            let chapter = JSON.parse(chapterData);
            chapter.content = encrypt(chapter.content, chapterId.slice(-8));
            let prevChapterId = null;
            let nextChapterId = null;
            const infoFile = path.join(bookDir, "info.json");
            if (fs.existsSync(infoFile)) {
                const bookInfo = JSON.parse(fs.readFileSync(infoFile, "utf8"));
                if (bookInfo.chapter_list && Array.isArray(bookInfo.chapter_list)) {
                    const chapters = bookInfo.chapter_list;
                    const currentIndex = chapters.findIndex((ch) => ch.item_id === chapterId);
                    if (currentIndex !== -1) {
                        if (currentIndex > 0) {
                            prevChapterId = chapters[currentIndex - 1].item_id;
                        }
                        if (currentIndex < chapters.length - 1) {
                            nextChapterId = chapters[currentIndex + 1].item_id;
                        }
                    }
                }
            }
            chapter.prev = prevChapterId;
            chapter.next = nextChapterId;
            return chapter;
        } catch (error) {
            console.error(`获取小说 ${bookId} 章节 ${chapterId} 失败:`, error);
            return null;
        }
    }
}

module.exports = DownloadManager;
