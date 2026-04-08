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
exports.StatsService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const client_1 = require("@prisma/client");
const date_range_util_1 = require("../../common/utils/date-range.util");
const decimal_util_1 = require("../../common/utils/decimal.util");
const prisma_service_1 = require("../../database/prisma/prisma.service");
let StatsService = class StatsService {
    constructor(prisma, configService) {
        this.prisma = prisma;
        this.configService = configService;
    }
    async getTodayOrderStats() {
        const timezone = this.configService.get('APP_TIMEZONE', 'Asia/Shanghai');
        const { start, end } = (0, date_range_util_1.getTodayRange)(timezone);
        const [totalOrders, grouped, sumResult] = await Promise.all([
            this.prisma.order.count({
                where: {
                    createdAt: {
                        gte: start,
                        lte: end,
                    },
                },
            }),
            this.prisma.order.groupBy({
                by: ['status'],
                _count: {
                    status: true,
                },
                where: {
                    createdAt: {
                        gte: start,
                        lte: end,
                    },
                },
            }),
            this.prisma.order.aggregate({
                _sum: {
                    payableAmount: true,
                },
                where: {
                    createdAt: {
                        gte: start,
                        lte: end,
                    },
                },
            }),
        ]);
        const statusMap = new Map();
        grouped.forEach((item) => {
            statusMap.set(item.status, item._count.status);
        });
        return {
            success: true,
            data: {
                totalOrders,
                draftCount: statusMap.get(client_1.OrderStatus.draft) ?? 0,
                pendingShipmentCount: statusMap.get(client_1.OrderStatus.pending_shipment) ?? 0,
                shippedCount: statusMap.get(client_1.OrderStatus.shipped) ?? 0,
                completedCount: statusMap.get(client_1.OrderStatus.completed) ?? 0,
                cancelledCount: statusMap.get(client_1.OrderStatus.cancelled) ?? 0,
                totalPayableAmount: (0, decimal_util_1.toCurrencyNumber)(sumResult._sum.payableAmount ?? 0),
            },
        };
    }
};
exports.StatsService = StatsService;
exports.StatsService = StatsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService])
], StatsService);
