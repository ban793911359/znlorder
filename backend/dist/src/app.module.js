"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const serve_static_1 = require("@nestjs/serve-static");
const node_path_1 = require("node:path");
const auth_module_1 = require("./modules/auth/auth.module");
const customers_module_1 = require("./modules/customers/customers.module");
const orders_module_1 = require("./modules/orders/orders.module");
const prisma_module_1 = require("./database/prisma/prisma.module");
const request_logger_middleware_1 = require("./common/middleware/request-logger.middleware");
const health_module_1 = require("./modules/health/health.module");
const uploads_module_1 = require("./modules/uploads/uploads.module");
const stats_module_1 = require("./modules/stats/stats.module");
let AppModule = class AppModule {
    configure(consumer) {
        consumer.apply(request_logger_middleware_1.RequestLoggerMiddleware).forRoutes('*');
    }
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                envFilePath: '.env',
            }),
            serve_static_1.ServeStaticModule.forRootAsync({
                imports: [config_1.ConfigModule],
                inject: [config_1.ConfigService],
                useFactory: (configService) => [
                    {
                        rootPath: (0, node_path_1.join)(process.cwd(), configService.get('UPLOAD_DIR', 'uploads')),
                        serveRoot: '/uploads',
                    },
                ],
            }),
            prisma_module_1.PrismaModule,
            auth_module_1.AuthModule,
            customers_module_1.CustomersModule,
            orders_module_1.OrdersModule,
            uploads_module_1.UploadsModule,
            stats_module_1.StatsModule,
            health_module_1.HealthModule,
        ],
    })
], AppModule);
