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
exports.UploadsService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../database/prisma/prisma.service");
let UploadsService = class UploadsService {
    constructor(prisma, configService) {
        this.prisma = prisma;
        this.configService = configService;
    }
    async createImageRecord(file, currentUser) {
        const storageDriver = this.configService.get('UPLOAD_STORAGE_DRIVER', 'local');
        const retentionDays = Number(this.configService.get('UPLOAD_RETENTION_DAYS', '30'));
        const storageKey = `images/${file.filename}`;
        const publicUrl = this.buildPublicUrl(storageKey);
        const expiresAt = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000);
        const upload = await this.prisma.uploadFile.create({
            data: {
                uploaderId: currentUser.id,
                bizType: client_1.UploadBizType.order_product_image,
                storageDriver,
                storageKey,
                originalName: file.originalname,
                fileName: file.filename,
                mimeType: file.mimetype,
                fileSize: file.size,
                fileUrl: publicUrl,
                expiresAt,
            },
        });
        return {
            success: true,
            data: {
                id: upload.id,
                fileName: upload.fileName,
                originalName: upload.originalName,
                mimeType: upload.mimeType,
                fileSize: upload.fileSize,
                fileUrl: upload.fileUrl,
                expiresAt: upload.expiresAt,
                available: true,
            },
        };
    }
    buildPublicUrl(storageKey) {
        const publicBaseUrl = this.configService.get('UPLOAD_PUBLIC_BASE_URL');
        if (publicBaseUrl) {
            return `${publicBaseUrl.replace(/\/$/, '')}/${storageKey}`;
        }
        return `/uploads/${storageKey}`;
    }
};
exports.UploadsService = UploadsService;
exports.UploadsService = UploadsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService])
], UploadsService);
