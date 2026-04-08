"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generatePublicToken = generatePublicToken;
exports.hashPublicToken = hashPublicToken;
const node_crypto_1 = require("node:crypto");
function generatePublicToken() {
    const rawToken = (0, node_crypto_1.randomBytes)(24).toString('hex');
    const tokenHash = hashPublicToken(rawToken);
    return {
        rawToken,
        tokenHash,
    };
}
function hashPublicToken(token) {
    return (0, node_crypto_1.createHash)('sha256').update(token).digest('hex');
}
