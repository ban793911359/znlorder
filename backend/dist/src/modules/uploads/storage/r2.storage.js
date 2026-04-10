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
var R2OrderImageStorage_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.R2OrderImageStorage = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let R2OrderImageStorage = R2OrderImageStorage_1 = class R2OrderImageStorage {
    constructor(configService) {
        this.configService = configService;
        this.logger = new common_1.Logger(R2OrderImageStorage_1.name);
        const accountId = this.normalizeAccountId(this.configService.get('R2_ACCOUNT_ID', ''));
        const accessKeyId = this.cleanConfigValue(this.configService.get('R2_ACCESS_KEY_ID', ''));
        const secretAccessKey = this.cleanConfigValue(this.configService.get('R2_SECRET_ACCESS_KEY', ''));
        this.bucket = this.cleanConfigValue(this.configService.get('R2_BUCKET', ''));
        this.publicBaseUrl = this.cleanConfigValue(this.configService.get('UPLOAD_PUBLIC_BASE_URL', '')).replace(/\/$/, '');
        const configuredPrefix = this.cleanConfigValue(this.configService.get('R2_BUCKET_PREFIX', 'order-images') ??
            'order-images');
        this.keyPrefix = (configuredPrefix || 'order-images').replace(/^\/+|\/+$/g, '');
        const endpoint = accountId
            ? `https://${accountId}.r2.cloudflarestorage.com`
            : '';
        this.client =
            accountId && accessKeyId && secretAccessKey
                ? new client_s3_1.S3Client({
                    region: 'auto',
                    endpoint,
                    credentials: {
                        accessKeyId,
                        secretAccessKey,
                    },
                })
                : null;
        if (this.client) {
            this.logger.log(`R2 storage configured: endpointHost=${new URL(endpoint).host}, bucket=${this.bucket || '(missing)'}, prefix=${this.keyPrefix}, publicBaseUrl=${this.publicBaseUrl || '(missing)'}`);
        }
    }
    async saveImage(input) {
        const storageKey = [this.keyPrefix, 'images', input.fileName]
            .filter(Boolean)
            .join('/');
        const client = this.ensureClient();
        await client.send(new client_s3_1.PutObjectCommand({
            Bucket: this.bucket,
            Key: storageKey,
            Body: input.buffer,
            ContentType: input.mimeType,
        }));
        return {
            storageDriver: 'r2',
            storageKey,
            fileName: input.fileName,
            fileUrl: `${this.publicBaseUrl}/${storageKey}`,
        };
    }
    async deleteObject(storageKey) {
        const client = this.ensureClient();
        await client.send(new client_s3_1.DeleteObjectCommand({
            Bucket: this.bucket,
            Key: storageKey,
        }));
    }
    async onModuleDestroy() {
        this.client?.destroy();
    }
    ensureClient() {
        if (!this.client || !this.bucket || !this.publicBaseUrl) {
            throw new common_1.InternalServerErrorException('R2 storage is enabled but required R2 environment variables are missing');
        }
        return this.client;
    }
    cleanConfigValue(value) {
        return String(value ?? '')
            .trim()
            .replace(/^['"]|['"]$/g, '')
            .replace(/^[A-Z0-9_]+\s*=\s*/i, '')
            .replace(/^=+/, '')
            .trim();
    }
    normalizeAccountId(value) {
        return this.cleanConfigValue(value)
            .replace(/^https?:\/\//i, '')
            .replace(/\.r2\.cloudflarestorage\.com\/?$/i, '')
            .replace(/^=+/, '')
            .trim();
    }
};
exports.R2OrderImageStorage = R2OrderImageStorage;
exports.R2OrderImageStorage = R2OrderImageStorage = R2OrderImageStorage_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], R2OrderImageStorage);
