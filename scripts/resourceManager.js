const fs = require("fs");
const path = require("path");
const { app } = require("electron");
const fetch = require("node-fetch").default;
const EventEmitter = require("events");

class ResourceManager extends EventEmitter {
    constructor(appName) {
        super();
        this.appName = appName;
        this.author = "A439";
        this.baseDir = path.join(app.getPath("appData"), this.author, this.appName);
        this.resourcesDir = path.join(this.baseDir, "Resources");
        this.fileListPath = path.join(this.baseDir, ".files.json");
        this.fileListUrl = "https://raw.githubusercontent.com/A439-Official/Resources/main/39BookReader/.files.json";

        // Ensure directory exists
        this.ensureResourcesDirExists();

	        // Sync will be started manually when needed
    }

    ensureResourcesDirExists() {
        if (!fs.existsSync(this.resourcesDir)) {
            fs.mkdirSync(this.resourcesDir, { recursive: true });
        }
    }

    /**
     * Get remote file list and sync local resources
     */
    async syncResources() {
        console.log("Checking for updates to resources...");
        try {
            // Try with SSL verification first
            let response;
            try {
                response = await fetch(this.fileListUrl);
            } catch (sslError) {
                // If SSL verification fails, try without SSL verification
                console.warn("SSL verification failed!");
                const https = require("https");
                const agent = new https.Agent({
                    rejectUnauthorized: false,
                });
                response = await fetch(this.fileListUrl, { agent });
            }

            if (!response.ok) {
                console.warn(`Failed to fetch resource list: HTTP ${response.status}`);
                return;
            }

            const fileList = await response.json();
            // Save file list to local
            this.saveFileList(fileList);
            await this.ensureFilesExist(fileList);
        } catch (error) {
            console.warn("Resource synchronization failed, using local resources only:", error.message);
        }
        console.log("Resources up to date.");
    }

    /**
     * Save file list to local
     */
    saveFileList(fileList) {
        try {
            fs.writeFileSync(this.fileListPath, JSON.stringify(fileList, null, 2));
            // console.log("Saved file list to:", this.fileListPath);
        } catch (error) {
            console.warn("Failed to save file list:", error.message);
        }
    }

    /**
     * Load file list from local
     */
    loadFileList() {
        try {
            if (fs.existsSync(this.fileListPath)) {
                const data = fs.readFileSync(this.fileListPath, "utf8");
                return JSON.parse(data);
            }
        } catch (error) {
            console.warn("Failed to load file list:", error.message);
        }
        return [];
    }

    /**
     * Ensure all files in the list exist locally
     */
    async ensureFilesExist(fileList) {
        // fileList is a dictionary with file paths as keys and MD5 values as values
        for (const [filePath, md5Value] of Object.entries(fileList)) {
            if (!this.hasResource(filePath)) {
                await this.downloadResource(filePath);
            }
        }
    }

    /**
     * Download a resource from GitHub
     */
    async downloadResource(filePath) {
        try {
            const url = `https://raw.githubusercontent.com/A439-Official/Resources/main/39BookReader/${filePath}`;
            let response;

            try {
                response = await fetch(url);
            } catch (sslError) {
                // If SSL verification fails, try without SSL verification
                const https = require("https");
                const agent = new https.Agent({
                    rejectUnauthorized: false,
                });
                response = await fetch(url, { agent });
            }

            if (!response.ok) {
                console.warn(`Failed to download resource ${filePath}: HTTP ${response.status}`);
                return;
            }

            // Ensure directory exists for nested file paths
            const fullPath = this.getResourcePath(filePath);
            const dir = path.dirname(fullPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            const fileData = await response.arrayBuffer();
            fs.writeFileSync(fullPath, Buffer.from(fileData));
            console.log("Downloaded resource:", filePath, "MD5:", fileList[filePath]);
        } catch (error) {
            console.warn(`Failed to download resource ${filePath}:`, error.message);
        }
    }

    /**
     * Check if a resource exists locally
     */
    hasResource(filePath) {
        return fs.existsSync(this.getResourcePath(filePath));
    }

    /**
     * Get absolute path to resources directory
     */
    getResourcesDir() {
        return this.resourcesDir;
    }

    /**
     * Get path to a specific resource file
     */
    getResourcePath(filePath) {
        return path.join(this.resourcesDir, filePath);
    }
}

module.exports = ResourceManager;
