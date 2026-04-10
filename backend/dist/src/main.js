"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const config_1 = require("@nestjs/config");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const app_module_1 = require("./app.module");
const all_exceptions_filter_1 = require("./common/filters/all-exceptions.filter");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    const configService = app.get(config_1.ConfigService);
    const uploadDir = configService.get('UPLOAD_DIR', 'uploads');
    (0, node_fs_1.mkdirSync)((0, node_path_1.join)(process.cwd(), uploadDir), { recursive: true });
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
    }));
    app.useGlobalFilters(new all_exceptions_filter_1.AllExceptionsFilter());
    const normalizeOrigin = (value) => value.trim().replace(/\/+$/, '');
    const configuredOrigins = configService
        .get('CORS_ORIGINS', [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://192.168.1.29:5173',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://192.168.1.29:3000',
    ].join(','))
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    const h5BaseUrl = configService.get('H5_BASE_URL', '').trim();
    const allowedOrigins = new Set([...configuredOrigins, h5BaseUrl]
        .filter(Boolean)
        .map((item) => normalizeOrigin(item)));
    app.enableCors({
        origin: (origin, callback) => {
            if (!origin || allowedOrigins.has(normalizeOrigin(origin))) {
                callback(null, true);
                return;
            }
            callback(new Error(`CORS origin not allowed: ${origin}`), false);
        },
        credentials: true,
    });
    const host = configService.get('HOST', '0.0.0.0');
    const port = Number(configService.get('PORT', '3000'));
    await app.listen(port, host);
    console.log(`Backend started at ${await app.getUrl()}`);
}
bootstrap();
