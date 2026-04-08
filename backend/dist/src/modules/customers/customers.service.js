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
exports.CustomersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const decimal_util_1 = require("../../common/utils/decimal.util");
let CustomersService = class CustomersService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async identifyByMobile(mobile) {
        const customer = await this.prisma.customer.findUnique({
            where: { mobile },
            include: {
                orders: {
                    orderBy: { createdAt: 'desc' },
                    take: 5,
                    select: {
                        id: true,
                        orderNo: true,
                        status: true,
                        receiverName: true,
                        receiverMobile: true,
                        receiverProvince: true,
                        receiverCity: true,
                        receiverDistrict: true,
                        receiverAddress: true,
                        payableAmount: true,
                        createdAt: true,
                    },
                },
            },
        });
        if (!customer) {
            return {
                success: true,
                data: {
                    isExistingCustomer: false,
                    customer: null,
                    lastShippingInfo: null,
                    recentOrders: [],
                },
            };
        }
        return {
            success: true,
            data: {
                isExistingCustomer: true,
                customer: {
                    id: customer.id,
                    name: customer.name,
                    mobile: customer.mobile,
                    wechatNickname: customer.wechatNickname,
                    note: customer.note,
                    lastOrderAt: customer.lastOrderAt,
                },
                lastShippingInfo: {
                    receiverName: customer.receiverName,
                    receiverMobile: customer.receiverMobile,
                    receiverFullAddress: customer.receiverAddress,
                    receiverProvince: customer.receiverProvince,
                    receiverCity: customer.receiverCity,
                    receiverDistrict: customer.receiverDistrict,
                    receiverAddress: customer.receiverAddress,
                },
                recentOrders: customer.orders.map((order) => ({
                    id: order.id,
                    orderNo: order.orderNo,
                    status: order.status,
                    receiverName: order.receiverName,
                    receiverMobile: order.receiverMobile,
                    receiverFullAddress: order.receiverAddress,
                    receiverProvince: order.receiverProvince,
                    receiverCity: order.receiverCity,
                    receiverDistrict: order.receiverDistrict,
                    receiverAddress: order.receiverAddress,
                    payableAmount: (0, decimal_util_1.toCurrencyNumber)(order.payableAmount),
                    createdAt: order.createdAt,
                })),
            },
        };
    }
};
exports.CustomersService = CustomersService;
exports.CustomersService = CustomersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CustomersService);
