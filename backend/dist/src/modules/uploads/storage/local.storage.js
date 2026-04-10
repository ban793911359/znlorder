"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalOrderImageStorage = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const promises_1 = require("node:fs/promises");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
let LocalOrderImageStorage = class LocalOrderImageStorage {
    constructor(configService) {
        this.configService = configService;
    }
    async saveImage(input) {
        const uploadDir = this.configService.get('UPLOAD_DIR', 'uploads');
        const storageKey = `images/${input.fileName}`;
        const absolutePath = (0, node_path_1.join)(process.cwd(), uploadDir, storageKey);
        await (0, promises_1.mkdir)((0, node_path_1.join)(process.cwd(), uploadDir, 'images'), { recursive: true });
        await (0, promises_1.writeFile)(absolutePath, input.buffer);
        return {
            storageDriver: 'local',
            storageKey,
            fileName: input.fileName,
            fileUrl: this.buildPublicUrl(storageKey),
        };
    }
    async deleteObject(storageKey) {
        const uploadDir = this.configService.get('UPLOAD_DIR', 'uploads');
        const absolutePath = (0, node_path_1.join)(process.cwd(), uploadDir, storageKey);
        if ((0, node_fs_1.existsSync)(absolutePath)) {
            await (0, promises_1.unlink)(absolutePath);
        }
    }
    buildPublicUrl(storageKey) {
        const publicBaseUrl = this.configService.get('UPLOAD_PUBLIC_BASE_URL');
        if (publicBaseUrl) {
            return `${publicBaseUrl.replace(/\/$/, '')}/${storageKey}`;
        }
        return `/uploads/${storageKey}`;
    }
};
exports.LocalOrderImageStorage = LocalOrderImageStorage;
exports.LocalOrderImageStorage = LocalOrderImageStorage = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], LocalOrderImageStorage);
