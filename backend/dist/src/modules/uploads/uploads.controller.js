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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploadsController = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const client_1 = require("@prisma/client");
const platform_express_1 = require("@nestjs/platform-express");
const multer_1 = require("multer");
const node_crypto_1 = require("node:crypto");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const uploads_service_1 = require("./uploads.service");
const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
let UploadsController = class UploadsController {
    constructor(uploadsService, configService) {
        this.uploadsService = uploadsService;
        this.configService = configService;
    }
    async uploadImage(file, currentUser) {
        const maxUploadSizeMb = Number(this.configService.get('MAX_UPLOAD_SIZE_MB', '5'));
        if (!file) {
            throw new common_1.BadRequestException('Image file is required');
        }
        if (file.size > maxUploadSizeMb * 1024 * 1024) {
            throw new common_1.BadRequestException(`File exceeds ${maxUploadSizeMb}MB upload limit`);
        }
        return this.uploadsService.createImageRecord(file, currentUser);
    }
};
exports.UploadsController = UploadsController;
__decorate([
    (0, common_1.Post)('images'),
    (0, roles_decorator_1.Roles)(client_1.UserRole.operator),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        storage: (0, multer_1.diskStorage)({
            destination: (_request, _file, callback) => {
                const uploadDir = process.env.UPLOAD_DIR || 'uploads';
                const destination = (0, node_path_1.join)(process.cwd(), uploadDir, 'images');
                (0, node_fs_1.mkdirSync)(destination, { recursive: true });
                callback(null, destination);
            },
            filename: (_request, file, callback) => {
                const suffix = `${Date.now()}-${(0, node_crypto_1.randomBytes)(6).toString('hex')}`;
                callback(null, `${suffix}${(0, node_path_1.extname)(file.originalname)}`);
            },
        }),
        fileFilter: (_request, file, callback) => {
            if (!allowedMimeTypes.includes(file.mimetype)) {
                callback(new common_1.BadRequestException('Only jpg, png and webp images are allowed'), false);
                return;
            }
            callback(null, true);
        },
        limits: {
            fileSize: 5 * 1024 * 1024,
        },
    })),
    __param(0, (0, common_1.UploadedFile)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], UploadsController.prototype, "uploadImage", null);
exports.UploadsController = UploadsController = __decorate([
    (0, common_1.Controller)('uploads'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [uploads_service_1.UploadsService,
        config_1.ConfigService])
], UploadsController);
