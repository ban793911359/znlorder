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
const upload_biz_types_1 = require("./upload-biz-types");
let UploadsService = UploadsService_1 = class UploadsService {
    constructor(prisma, configService, localOrderImageStorage, r2OrderImageStorage) {
        this.prisma = prisma;
        this.configService = configService;
        this.localOrderImageStorage = localOrderImageStorage;
        this.r2OrderImageStorage = r2OrderImageStorage;
        this.logger = new common_1.Logger(UploadsService_1.name);
    }
    async createImageRecord(file, currentUser, bizType) {
        const normalizedBizType = this.normalizeBizType(bizType);
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
        const expiresAt = normalizedBizType === upload_biz_types_1.ORDER_PAYMENT_CODE_IMAGE_BIZ_TYPE
            ? UploadsService_1.PAYMENT_IMAGE_EXPIRES_AT
            : new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000);
        const upload = await this.prisma.$transaction(async (tx) => {
            await tx.$executeRaw `
        INSERT INTO upload_files (
          uploader_id,
          biz_type,
          storage_driver,
          storage_key,
          original_name,
          file_name,
          mime_type,
          file_size,
          file_url,
          expires_at,
          created_at
        )
        VALUES (
          ${currentUser.id},
          ${normalizedBizType},
          ${storedFile.storageDriver},
          ${storedFile.storageKey},
          ${file.originalname},
          ${storedFile.fileName},
          ${file.mimetype},
          ${file.size},
          ${storedFile.fileUrl},
          ${expiresAt},
          CURRENT_TIMESTAMP(3)
        )
      `;
            const uploads = await tx.$queryRaw `
        SELECT
          id,
          biz_type,
          storage_driver,
          storage_key,
          original_name,
          file_name,
          mime_type,
          file_size,
          file_url,
          expires_at
        FROM upload_files
        WHERE id = LAST_INSERT_ID()
        LIMIT 1
      `;
            return uploads[0];
        });
        return {
            success: true,
            data: {
                id: Number(upload.id),
                fileName: upload.file_name,
                originalName: upload.original_name,
                mimeType: upload.mime_type,
                fileSize: Number(upload.file_size),
                debugVersion: 'upload-debug-v4',
                bizType: upload.biz_type,
                storageDriver: upload.storage_driver,
                storageKey: upload.storage_key,
                fileUrl: this.resolvePublicFileUrl({
                    storageDriver: upload.storage_driver,
                    storageKey: upload.storage_key,
                    fileUrl: upload.file_url,
                }),
                expiresAt: upload.expires_at,
                available: true,
            },
        };
    }
    getStorageForDriver(storageDriver) {
        return this.resolveStorage(storageDriver);
    }
    async deleteFilesByIds(fileIds) {
        if (fileIds.length === 0) {
            return;
        }
        const uniqueIds = [...new Set(fileIds)];
        const files = await this.prisma.$queryRaw(client_1.Prisma.sql `
        SELECT id, storage_driver, storage_key, file_url, file_name
        FROM upload_files
        WHERE id IN (${client_1.Prisma.join(uniqueIds)})
          AND deleted_at IS NULL
      `);
        const deletedAt = new Date();
        for (const file of files) {
            const storageKey = this.resolveStorageKeyForDeletion({
                storageKey: file.storage_key,
                fileUrl: file.file_url,
                fileName: file.file_name,
                storageDriver: file.storage_driver,
            });
            if (!storageKey) {
                this.logger.warn(`skip deleting file without storage key: id=${file.id} fileUrl=${file.file_url}`);
                continue;
            }
            try {
                await this.resolveStorage(file.storage_driver).deleteObject(storageKey);
            }
            catch (error) {
                this.logger.error(`failed to delete stored file: id=${file.id} driver=${file.storage_driver} key=${storageKey}`, error instanceof Error ? error.stack : undefined);
                throw new common_1.InternalServerErrorException('Failed to delete uploaded file');
            }
        }
        if (files.length > 0) {
            await this.prisma.$executeRaw(client_1.Prisma.sql `
          UPDATE upload_files
          SET deleted_at = ${deletedAt}
          WHERE id IN (${client_1.Prisma.join(files.map((file) => file.id))})
        `);
        }
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
    normalizeBizType(bizType) {
        if (!bizType) {
            return upload_biz_types_1.ORDER_PRODUCT_IMAGE_BIZ_TYPE;
        }
        if ((0, upload_biz_types_1.isUploadImageBizType)(bizType)) {
            return bizType;
        }
        throw new common_1.BadRequestException(`Unsupported upload biz type: ${bizType}`);
    }
    resolveStorageKeyForDeletion(file) {
        if (file.storageKey) {
            return file.storageKey;
        }
        if (file.storageDriver === 'local' && file.fileUrl.startsWith('/uploads/')) {
            return file.fileUrl.replace('/uploads/', '');
        }
        return null;
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
UploadsService.PAYMENT_IMAGE_EXPIRES_AT = new Date('2099-12-31T23:59:59.999Z');
exports.UploadsService = UploadsService = UploadsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService,
        local_storage_1.LocalOrderImageStorage,
        r2_storage_1.R2OrderImageStorage])
], UploadsService);
