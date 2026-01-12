const fetch = require("node-fetch").default;

/**
 * 执行HTTP请求的辅助函数
 */
const fetchApi = async (url) => {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.log(url);
        console.error("Fetch error:", error);
        throw error;
    }
};

/**
 * Book类 - 用于构建书籍相关的API URL并执行请求
 */
class Book {
    constructor(rootUrl = null) {
        this.rootUrl = rootUrl;
    }

    /**
     * 搜索书籍
     * @param {string} key - 搜索关键词
     * @param {number} [tabType=3] - 搜索类型：3=小说，2=听书，8=漫画，11=短剧，默认为3
     * @param {number} [offset=0] - 偏移量，用于分页，默认0
     * @returns {Promise<Object>} API响应结果
     */
    async search(key, tabType = null, offset = null) {
        const params = [];
        params.push(`key=${key}`);

        if (tabType !== null) {
            params.push(`tab_type=${tabType}`);
        }
        if (offset !== null) {
            params.push(`offset=${offset}`);
        }

        const queryString = params.join("&");
        const url = `${this.rootUrl}/api/search?${queryString}`;
        return await fetchApi(url);
    }

    /**
     * 获取书籍详情
     * @param {string} bookId - 书籍ID
     * @returns {Promise<Object>} API响应结果
     */
    async detail(bookId) {
        const params = [];
        params.push(`book_id=${bookId}`);
        const queryString = params.join("&");
        const url = `${this.rootUrl}/api/detail?${queryString}`;
        return await fetchApi(url);
    }

    /**
     * 获取书籍目录
     * @param {string} bookId - 书籍ID
     * @returns {Promise<Object>} API响应结果
     */
    async book(bookId) {
        const params = [];
        params.push(`book_id=${bookId}`);
        const queryString = params.join("&");
        const url = `${this.rootUrl}/api/book?${queryString}`;
        return await fetchApi(url);
    }

    /**
     * 获取简化目录
     * @param {string} bookId - 书籍ID
     * @returns {Promise<Object>} API响应结果
     */
    async directory(bookId) {
        const params = [];
        params.push(`book_id=${bookId}`);
        const queryString = params.join("&");
        const url = `${this.rootUrl}/api/directory?${queryString}`;
        return await fetchApi(url);
    }

    /**
     * 获取内容（统一接口）
     * @param {string} tab - 内容类型：小说、听书、短剧、漫画、批量、下载
     * @param {string} [itemId] - 单个章节/视频/漫画ID
     * @param {string} [itemIds] - 多个章节ID，逗号分隔
     * @param {string} [bookId] - 书籍ID
     * @param {number} [showHtml] - 漫画是否返回HTML格式（0或1）
     * @param {string} [toneId] - 有声书音色ID
     * @param {number} [asyncMode] - 漫画异步模式（0或1）
     * @returns {Promise<Object>} API响应结果
     */
    async content(tab, itemId = null, itemIds = null, bookId = null, showHtml = null, toneId = null, asyncMode = null) {
        const params = [];
        params.push(`tab=${tab}`);

        if (itemId !== null) {
            params.push(`item_id=${itemId}`);
        }
        if (itemIds !== null) {
            params.push(`item_ids=${itemIds}`);
        }
        if (bookId !== null) {
            params.push(`book_id=${bookId}`);
        }
        if (showHtml !== null) {
            params.push(`show_html=${showHtml}`);
        }
        if (toneId !== null) {
            params.push(`tone_id=${toneId}`);
        }
        if (asyncMode !== null) {
            params.push(`async=${asyncMode}`);
        }

        const queryString = params.join("&");
        const url = `${this.rootUrl}/api/content?${queryString}`;
        return await fetchApi(url);
    }

    /**
     * 获取章节（简单接口）
     * @param {string} itemId - 章节ID
     * @returns {Promise<Object>} API响应结果
     */
    async chapter(itemId) {
        const params = [];
        params.push(`item_id=${itemId}`);
        const queryString = params.join("&");
        const url = `${this.rootUrl}/api/chapter?${queryString}`;
        return await fetchApi(url);
    }

    /**
     * 获取原始内容
     * @param {string} itemId - 章节ID
     * @returns {Promise<Object>} API响应结果
     */
    async rawFull(itemId) {
        const params = [];
        params.push(`item_id=${itemId}`);
        const queryString = params.join("&");
        const url = `${this.rootUrl}/api/raw_full?${queryString}`;
        return await fetchApi(url);
    }

    /**
     * 获取评论
     * @param {string} bookId - 书籍ID
     * @param {number} [count=20] - 每页数量，默认20
     * @param {number} [offset=0] - 偏移量，默认0
     * @returns {Promise<Object>} API响应结果
     */
    async comment(bookId, count = null, offset = null) {
        const params = [];
        params.push(`book_id=${bookId}`);

        if (count !== null) {
            params.push(`count=${count}`);
        }
        if (offset !== null) {
            params.push(`offset=${offset}`);
        }

        const queryString = params.join("&");
        const url = `${this.rootUrl}/api/comment?${queryString}`;
        return await fetchApi(url);
    }
}

module.exports = Book;
