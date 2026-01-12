/**
 * 文本加密/解密函数
 * 对文本中每个字符的Unicode编码与字符位置进行异或操作
 *
 * @param {string} text - 要加密/解密的文本
 * @param {number} offset - 位置偏移量（默认0）
 * @returns {string} - 处理后的文本
 */
function encrypt(text, offset = 0) {
    if (!text) return "";
    let result = "";
    for (let i = 0; i < text.length; i++) {
        const charCode = text.charCodeAt(i);
        const xorValue = (i + (offset % 256)) % 256;
        const processedCharCode = charCode ^ xorValue;
        result += String.fromCharCode(processedCharCode);
    }
    return result;
}

module.exports = {
    encrypt,
};
