const { protocol, net } = require("electron");
const path = require("node:path");
const url = require("node:url");

function registerProtocolHandler(app) {
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
}

module.exports = {
    registerProtocolHandler
};
