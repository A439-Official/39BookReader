const fs = require("fs");
const path = require("path");
const { app } = require("electron");

class ConfigManager {
    constructor(appName) {
        this.appName = appName;
        this.author = "A439";
        this.configDir = path.join(app.getPath("appData"), this.author, this.appName);
        this.configFile = path.join(this.configDir, "config.json");
        this.defaultConfig = {};

        this.ensureConfigDirExists();
        this.config = this.loadConfig();
    }

    /**
     * 确保配置目录存在
     */
    ensureConfigDirExists() {
        if (!fs.existsSync(this.configDir)) {
            fs.mkdirSync(this.configDir, { recursive: true });
        }
    }

    /**
     * 加载配置文件，如果不存在则创建默认配置
     */
    loadConfig() {
        try {
            if (fs.existsSync(this.configFile)) {
                const configData = fs.readFileSync(this.configFile, "utf8");
                const loadedConfig = JSON.parse(configData);
                // 合并默认配置和已保存的配置
                return this.mergeConfig(this.defaultConfig, loadedConfig);
            } else {
                // 创建默认配置文件
                this.saveConfig(this.defaultConfig);
                return { ...this.defaultConfig };
            }
        } catch (error) {
            console.error("加载配置文件失败:", error);
            return { ...this.defaultConfig };
        }
    }

    /**
     * 深度合并配置对象
     */
    mergeConfig(defaultConfig, loadedConfig) {
        const result = { ...defaultConfig };

        for (const key in loadedConfig) {
            if (loadedConfig.hasOwnProperty(key)) {
                if (typeof loadedConfig[key] === "object" && loadedConfig[key] !== null && typeof result[key] === "object" && result[key] !== null) {
                    // 递归合并对象
                    result[key] = this.mergeConfig(result[key], loadedConfig[key]);
                } else {
                    result[key] = loadedConfig[key];
                }
            }
        }

        return result;
    }

    /**
     * 保存配置到文件
     */
    saveConfig(config = null) {
        try {
            const configToSave = config || this.config;
            fs.writeFileSync(this.configFile, JSON.stringify(configToSave, null, 2), "utf8");
            if (!config) {
                this.config = configToSave;
            }
            return true;
        } catch (error) {
            console.error("保存配置文件失败:", error);
            return false;
        }
    }

    /**
     * 获取配置值
     */
    get(key = null, defaultValue = null) {
        if (key === null) {
            return { ...this.config };
        }

        const keys = key.split(".");
        let value = this.config;

        for (const k of keys) {
            if (value && typeof value === "object" && k in value) {
                value = value[k];
            } else {
                return defaultValue;
            }
        }

        return value;
    }

    /**
     * 设置配置值
     */
    set(key, value) {
        const keys = key.split(".");
        let current = this.config;

        for (let i = 0; i < keys.length - 1; i++) {
            const k = keys[i];
            if (!(k in current) || typeof current[k] !== "object") {
                current[k] = {};
            }
            current = current[k];
        }

        current[keys[keys.length - 1]] = value;
        return this.saveConfig();
    }

    /**
     * 删除配置项
     */
    delete(key) {
        const keys = key.split(".");
        let current = this.config;

        for (let i = 0; i < keys.length - 1; i++) {
            const k = keys[i];
            if (!(k in current) || typeof current[k] !== "object") {
                return false;
            }
            current = current[k];
        }

        const lastKey = keys[keys.length - 1];
        if (lastKey in current) {
            delete current[lastKey];
            return this.saveConfig();
        }

        return false;
    }

    /**
     * 重置为默认配置
     */
    reset() {
        this.config = { ...this.defaultConfig };
        return this.saveConfig();
    }

    /**
     * 获取配置目录路径
     */
    getConfigDir() {
        return this.configDir;
    }

    /**
     * 获取配置文件路径
     */
    getConfigFile() {
        return this.configFile;
    }
}

module.exports = ConfigManager;
