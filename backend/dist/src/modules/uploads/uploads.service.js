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
var UploadsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploadsService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const client_1 = require("@prisma/client");
const node_path_1 = require("node:path");
const node_crypto_1 = require("node:crypto");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const local_storage_1 = require("./storage/local.storage");
const r2_storage_1 = require("./storage/r2.storage");
let UploadsService = UploadsService_1 = class UploadsService {
    constructor(prisma, configService, localOrderImageStorage, r2OrderImageStorage) {
        this.prisma = prisma;
        this.configService = configService;
        this.localOrderImageStorage = localOrderImageStorage;
        this.r2OrderImageStorage = r2OrderImageStorage;
        this.logger = new common_1.Logger(UploadsService_1.name);
    }
    async createImageRecord(file, currentUser) {
        const storageDriver = this.configService.get('UPLOAD_STORAGE_DRIVER', 'local');
        const retentionDays = Number(this.configService.get('UPLOAD_RETENTION_DAYS', '30'));
        const fileName = this.buildStoredFileName(file.originalname);
        const storage = this.resolveStorage(storageDriver);
        const storedFile = await storage.saveImage({
            buffer: file.buffer,
            fileName,
            mimeType: file.mimetype,
        });
        this.logger.log(`stored image via ${storedFile.storageDriver}: key=${storedFile.storageKey} url=${storedFile.fileUrl}`);
        const expiresAt = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000);
        const upload = await this.prisma.uploadFile.create({
            data: {
                uploaderId: currentUser.id,
                bizType: client_1.UploadBizType.order_product_image,
                storageDriver: storedFile.storageDriver,
                storageKey: storedFile.storageKey,
                originalName: file.originalname,
                fileName: storedFile.fileName,
                mimeType: file.mimetype,
                fileSize: file.size,
                fileUrl: storedFile.fileUrl,
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
                debugVersion: 'upload-debug-v3',
                storageDriver: upload.storageDriver,
                storageKey: upload.storageKey,
                fileUrl: this.resolvePublicFileUrl({
                    storageDriver: upload.storageDriver,
                    storageKey: upload.storageKey,
                    fileUrl: upload.fileUrl,
                }),
                expiresAt: upload.expiresAt,
                available: true,
            },
        };
    }
    getStorageForDriver(storageDriver) {
        return this.resolveStorage(storageDriver);
    }
    resolveStorage(storageDriver) {
        if (storageDriver === 'r2') {
            return this.r2OrderImageStorage;
        }
        if (storageDriver === 'local') {
            return this.localOrderImageStorage;
        }
        throw new common_1.InternalServerErrorException(`Unsupported upload storage driver: ${storageDriver}`);
    }
    buildStoredFileName(originalName) {
        const suffix = `${Date.now()}-${(0, node_crypto_1.randomBytes)(6).toString('hex')}`;
        return `${suffix}${(0, node_path_1.extname)(originalName)}`;
    }
    resolvePublicFileUrl(input) {
        if (input.storageDriver === 'r2' && input.storageKey) {
            const publicBaseUrl = this.configService
                .get('UPLOAD_PUBLIC_BASE_URL', '')
                .trim();
            const prefix = (this.configService.get('R2_BUCKET_PREFIX', 'order-images') ??
                'order-images')
                .trim()
                .replace(/^['"]|['"]$/g, '')
                .replace(/^[A-Z0-9_]+\s*=\s*/i, '')
                .replace(/^=+/, '')
                .replace(/^\/+|\/+$/g, '') || 'order-images';
            const normalizedStorageKey = input.storageKey.startsWith(`${prefix}/`)
                ? input.storageKey
                : `${prefix}/${input.storageKey.replace(/^\/+/, '')}`;
            if (publicBaseUrl) {
                return `${publicBaseUrl.replace(/\/$/, '')}/${normalizedStorageKey}`;
            }
        }
        return input.fileUrl;
    }
};
exports.UploadsService = UploadsService;
exports.UploadsService = UploadsService = UploadsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService,
        local_storage_1.LocalOrderImageStorage,
        r2_storage_1.R2OrderImageStorage])
], UploadsService);
