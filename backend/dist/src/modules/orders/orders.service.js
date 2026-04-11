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
var OrdersService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrdersService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const client_1 = require("@prisma/client");
const decimal_util_1 = require("../../common/utils/decimal.util");
const date_range_util_1 = require("../../common/utils/date-range.util");
const public_token_util_1 = require("../../common/utils/public-token.util");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const order_presenter_1 = require("./order-presenter");
const order_number_service_1 = require("./order-number.service");
const upload_biz_types_1 = require("../uploads/upload-biz-types");
const uploads_service_1 = require("../uploads/uploads.service");
let OrdersService = OrdersService_1 = class OrdersService {
    constructor(prisma, orderNumberService, configService, uploadsService) {
        this.prisma = prisma;
        this.orderNumberService = orderNumberService;
        this.configService = configService;
        this.uploadsService = uploadsService;
        this.logger = new common_1.Logger(OrdersService_1.name);
    }
    async listOrderDrafts(currentUser) {
        const drafts = await this.prisma.$queryRaw `
      SELECT id, title, payload, created_at, updated_at
      FROM order_drafts
      WHERE owner_id = ${currentUser.id}
      ORDER BY updated_at DESC
      LIMIT 20
    `;
        return {
            success: true,
            data: drafts.map((draft) => this.presentOrderDraftRow(draft)),
        };
    }
    async getOrderDraft(id, currentUser) {
        const drafts = await this.prisma.$queryRaw `
      SELECT id, title, payload, created_at, updated_at
      FROM order_drafts
      WHERE id = ${id} AND owner_id = ${currentUser.id}
      LIMIT 1
    `;
        const draft = drafts[0];
        if (!draft) {
            throw new common_1.NotFoundException('Order draft not found');
        }
        return {
            success: true,
            data: this.presentOrderDraftRow(draft),
        };
    }
    async saveOrderDraft(saveOrderDraftDto, currentUser) {
        const title = saveOrderDraftDto.title?.trim() || '未命名草稿';
        const payload = JSON.stringify(saveOrderDraftDto.payload ?? {});
        if (saveOrderDraftDto.id) {
            const existingDrafts = await this.prisma.$queryRaw `
        SELECT id
        FROM order_drafts
        WHERE id = ${saveOrderDraftDto.id} AND owner_id = ${currentUser.id}
        LIMIT 1
      `;
            const existingDraft = existingDrafts[0];
            if (!existingDraft) {
                throw new common_1.NotFoundException('Order draft not found');
            }
            await this.prisma.$executeRaw `
        UPDATE order_drafts
        SET title = ${title}, payload = ${payload}, updated_at = CURRENT_TIMESTAMP(3)
        WHERE id = ${saveOrderDraftDto.id} AND owner_id = ${currentUser.id}
      `;
            const updatedDrafts = await this.prisma.$queryRaw `
        SELECT id, title, payload, created_at, updated_at
        FROM order_drafts
        WHERE id = ${saveOrderDraftDto.id} AND owner_id = ${currentUser.id}
        LIMIT 1
      `;
            return {
                success: true,
                data: this.presentOrderDraftRow(updatedDrafts[0]),
            };
        }
        const draft = await this.prisma.$transaction(async (tx) => {
            await tx.$executeRaw `
        INSERT INTO order_drafts (owner_id, title, payload, created_at, updated_at)
        VALUES (${currentUser.id}, ${title}, ${payload}, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
      `;
            const drafts = await tx.$queryRaw `
        SELECT id, title, payload, created_at, updated_at
        FROM order_drafts
        WHERE id = LAST_INSERT_ID()
        LIMIT 1
      `;
            return drafts[0];
        });
        return {
            success: true,
            data: this.presentOrderDraftRow(draft),
        };
    }
    async deleteOrderDraft(id, currentUser) {
        const existingDrafts = await this.prisma.$queryRaw `
      SELECT id
      FROM order_drafts
      WHERE id = ${id} AND owner_id = ${currentUser.id}
      LIMIT 1
    `;
        const existingDraft = existingDrafts[0];
        if (!existingDraft) {
            throw new common_1.NotFoundException('Order draft not found');
        }
        await this.prisma.$executeRaw `
      DELETE FROM order_drafts
      WHERE id = ${id} AND owner_id = ${currentUser.id}
    `;
        return {
            success: true,
            data: {
                id,
                deleted: true,
            },
        };
    }
    async createOrder(createOrderDto, currentUser) {
        const receiverInfo = this.normalizeReceiverInfo({
            customerName: createOrderDto.customerName,
            customerMobile: createOrderDto.customerMobile,
            receiverName: createOrderDto.receiverName,
            receiverMobile: createOrderDto.receiverMobile,
            receiverAddress: createOrderDto.receiverAddress,
            receiverFullAddress: createOrderDto.receiverFullAddress,
            receiverProvince: createOrderDto.receiverProvince,
            receiverCity: createOrderDto.receiverCity,
            receiverDistrict: createOrderDto.receiverDistrict,
        });
        this.validateProductModelNos(createOrderDto.items);
        this.validateAmounts(createOrderDto.items, createOrderDto.totalAmount, createOrderDto.shippingFee ?? 0, createOrderDto.discountAmount ?? 0, createOrderDto.payableAmount);
        const itemImageFileIds = this.collectItemImageFileIds(createOrderDto.items);
        const paymentImageFileIds = createOrderDto.paymentImageFileIds ?? [];
        await this.ensureUploadFilesAvailable(itemImageFileIds, undefined, upload_biz_types_1.ORDER_PRODUCT_IMAGE_BIZ_TYPE);
        await this.ensureUploadFilesAvailable(paymentImageFileIds, undefined, upload_biz_types_1.ORDER_PAYMENT_CODE_IMAGE_BIZ_TYPE);
        let lastError;
        let result;
        for (let attempt = 1; attempt <= OrdersService_1.ORDER_NO_RETRY_TIMES; attempt += 1) {
            try {
                result = await this.prisma.$transaction(async (tx) => {
                    const now = new Date();
                    const customer = await tx.customer.upsert({
                        where: { mobile: createOrderDto.customerMobile },
                        update: {
                            name: createOrderDto.customerName,
                            wechatNickname: createOrderDto.wechatNickname,
                            receiverName: receiverInfo.receiverName,
                            receiverMobile: receiverInfo.receiverMobile,
                            receiverProvince: null,
                            receiverCity: null,
                            receiverDistrict: null,
                            receiverAddress: receiverInfo.receiverFullAddress,
                            lastOrderAt: now,
                        },
                        create: {
                            name: createOrderDto.customerName,
                            mobile: createOrderDto.customerMobile,
                            wechatNickname: createOrderDto.wechatNickname,
                            receiverName: receiverInfo.receiverName,
                            receiverMobile: receiverInfo.receiverMobile,
                            receiverProvince: null,
                            receiverCity: null,
                            receiverDistrict: null,
                            receiverAddress: receiverInfo.receiverFullAddress,
                            lastOrderAt: now,
                        },
                    });
                    const orderNo = await this.orderNumberService.generateNextOrderNo(tx);
                    const { rawToken, tokenHash } = (0, public_token_util_1.generatePublicToken)();
                    const clientLinkPath = `/client/orders/${orderNo}`;
                    const order = await tx.order.create({
                        data: {
                            orderNo,
                            customerId: customer.id,
                            status: client_1.OrderStatus.pending_shipment,
                            clientTokenHash: tokenHash,
                            clientLinkPath,
                            createdById: currentUser.id,
                            receiverName: receiverInfo.receiverName,
                            receiverMobile: receiverInfo.receiverMobile,
                            receiverProvince: null,
                            receiverCity: null,
                            receiverDistrict: null,
                            receiverAddress: receiverInfo.receiverFullAddress,
                            totalAmount: createOrderDto.totalAmount,
                            shippingFee: createOrderDto.shippingFee ?? 0,
                            discountAmount: createOrderDto.discountAmount ?? 0,
                            payableAmount: createOrderDto.payableAmount,
                            operatorRemark: createOrderDto.operatorRemark,
                        },
                    });
                    for (const item of createOrderDto.items) {
                        const createdItem = await tx.orderItem.create({
                            data: {
                                orderId: order.id,
                                productName: item.productName?.trim() || '',
                                productSpec: item.productSpec,
                                quantity: item.quantity,
                                unitPrice: item.unitPrice,
                                lineAmount: item.lineAmount,
                                remark: item.remark,
                            },
                        });
                        if ((item.imageFileIds ?? []).length > 0) {
                            await this.bindUploadFilesToOrder(tx, item.imageFileIds ?? [], {
                                orderId: order.id,
                                orderItemId: createdItem.id,
                            });
                        }
                    }
                    if (paymentImageFileIds.length > 0) {
                        await this.bindUploadFilesToOrder(tx, paymentImageFileIds, {
                            orderId: order.id,
                            orderItemId: null,
                        });
                    }
                    await tx.orderStatusLog.create({
                        data: {
                            orderId: order.id,
                            fromStatus: null,
                            toStatus: client_1.OrderStatus.pending_shipment,
                            action: 'create_order',
                            operatorId: currentUser.id,
                            note: 'Order created by operator',
                        },
                    });
                    return {
                        orderId: order.id,
                        orderNo,
                        status: client_1.OrderStatus.pending_shipment,
                        clientToken: rawToken,
                        clientLinkPath,
                        clientLink: this.buildClientLink(orderNo, rawToken),
                    };
                });
                break;
            }
            catch (error) {
                lastError = error;
                if (this.isOrderNoUniqueConflict(error)) {
                    this.logger.warn(`Order number unique conflict while creating order; attempt=${attempt}/${OrdersService_1.ORDER_NO_RETRY_TIMES}; ${this.describePrismaError(error)}`);
                    if (attempt < OrdersService_1.ORDER_NO_RETRY_TIMES) {
                        continue;
                    }
                }
                this.logger.error(`Failed to create order; attempt=${attempt}/${OrdersService_1.ORDER_NO_RETRY_TIMES}; ${this.describePrismaError(error)}`, error instanceof Error ? error.stack : undefined);
                throw error;
            }
        }
        if (!result) {
            throw lastError ?? new Error('Failed to create order');
        }
        return {
            success: true,
            data: result,
        };
    }
    async updateOrder(id, updateOrderDto, currentUser) {
        const existingOrder = await this.prisma.order.findUnique({
            where: { id },
            include: {
                customer: true,
                items: {
                    include: {
                        images: true,
                    },
                },
                images: true,
            },
        });
        if (!existingOrder) {
            throw new common_1.NotFoundException('Order not found');
        }
        if (existingOrder.status === client_1.OrderStatus.shipped ||
            existingOrder.status === client_1.OrderStatus.completed ||
            existingOrder.status === client_1.OrderStatus.cancelled) {
            throw new common_1.BadRequestException('Current order can no longer be edited');
        }
        const mergedItems = updateOrderDto.items ??
            existingOrder.items.map((item) => ({
                productName: item.productName,
                productSpec: item.productSpec ?? undefined,
                quantity: item.quantity,
                unitPrice: (0, decimal_util_1.toCurrencyNumber)(item.unitPrice),
                lineAmount: (0, decimal_util_1.toCurrencyNumber)(item.lineAmount),
                remark: item.remark ?? undefined,
                imageFileIds: item.images.map((image) => image.id),
            }));
        const removedPaymentImageIds = updateOrderDto.paymentImageFileIds === undefined
            ? []
            : existingOrder.images
                .filter((image) => image.bizType === upload_biz_types_1.ORDER_PAYMENT_CODE_IMAGE_BIZ_TYPE &&
                !updateOrderDto.paymentImageFileIds?.includes(image.id))
                .map((image) => image.id);
        this.validateProductModelNos(mergedItems);
        const receiverInfo = this.normalizeReceiverInfo({
            customerName: updateOrderDto.customerName ?? existingOrder.customer.name,
            customerMobile: updateOrderDto.customerMobile ?? existingOrder.customer.mobile,
            receiverName: updateOrderDto.receiverName ?? existingOrder.receiverName,
            receiverMobile: updateOrderDto.receiverMobile ?? existingOrder.receiverMobile,
            receiverAddress: updateOrderDto.receiverAddress ?? existingOrder.receiverAddress,
            receiverFullAddress: updateOrderDto.receiverFullAddress ?? existingOrder.receiverAddress,
            receiverProvince: updateOrderDto.receiverProvince ?? existingOrder.receiverProvince,
            receiverCity: updateOrderDto.receiverCity ?? existingOrder.receiverCity,
            receiverDistrict: updateOrderDto.receiverDistrict ?? existingOrder.receiverDistrict,
        });
        const mergedTotalAmount = updateOrderDto.totalAmount ?? (0, decimal_util_1.toCurrencyNumber)(existingOrder.totalAmount);
        const mergedShippingFee = updateOrderDto.shippingFee ?? (0, decimal_util_1.toCurrencyNumber)(existingOrder.shippingFee);
        const mergedDiscountAmount = updateOrderDto.discountAmount ??
            (0, decimal_util_1.toCurrencyNumber)(existingOrder.discountAmount);
        const mergedPayableAmount = updateOrderDto.payableAmount ??
            (0, decimal_util_1.toCurrencyNumber)(existingOrder.payableAmount);
        this.validateAmounts(mergedItems, mergedTotalAmount, mergedShippingFee, mergedDiscountAmount, mergedPayableAmount);
        if (updateOrderDto.items !== undefined) {
            await this.ensureUploadFilesAvailable(this.collectItemImageFileIds(updateOrderDto.items), id, upload_biz_types_1.ORDER_PRODUCT_IMAGE_BIZ_TYPE);
        }
        if (updateOrderDto.paymentImageFileIds !== undefined) {
            await this.ensureUploadFilesAvailable(updateOrderDto.paymentImageFileIds, id, upload_biz_types_1.ORDER_PAYMENT_CODE_IMAGE_BIZ_TYPE);
        }
        const updatedOrder = await this.prisma.$transaction(async (tx) => {
            const customer = await tx.customer.upsert({
                where: {
                    mobile: updateOrderDto.customerMobile ?? existingOrder.customer.mobile,
                },
                update: {
                    name: updateOrderDto.customerName ?? existingOrder.customer.name,
                    wechatNickname: updateOrderDto.wechatNickname ?? existingOrder.customer.wechatNickname,
                    receiverName: receiverInfo.receiverName,
                    receiverMobile: receiverInfo.receiverMobile,
                    receiverProvince: null,
                    receiverCity: null,
                    receiverDistrict: null,
                    receiverAddress: receiverInfo.receiverFullAddress,
                    lastOrderAt: new Date(),
                },
                create: {
                    name: updateOrderDto.customerName ?? existingOrder.customer.name,
                    mobile: updateOrderDto.customerMobile ?? existingOrder.customer.mobile,
                    wechatNickname: updateOrderDto.wechatNickname ?? existingOrder.customer.wechatNickname,
                    receiverName: receiverInfo.receiverName,
                    receiverMobile: receiverInfo.receiverMobile,
                    receiverProvince: null,
                    receiverCity: null,
                    receiverDistrict: null,
                    receiverAddress: receiverInfo.receiverFullAddress,
                    lastOrderAt: new Date(),
                },
            });
            await tx.order.update({
                where: { id },
                data: {
                    customerId: customer.id,
                    receiverName: receiverInfo.receiverName,
                    receiverMobile: receiverInfo.receiverMobile,
                    receiverProvince: null,
                    receiverCity: null,
                    receiverDistrict: null,
                    receiverAddress: receiverInfo.receiverFullAddress,
                    totalAmount: mergedTotalAmount,
                    shippingFee: mergedShippingFee,
                    discountAmount: mergedDiscountAmount,
                    payableAmount: mergedPayableAmount,
                    operatorRemark: updateOrderDto.operatorRemark ?? existingOrder.operatorRemark,
                },
            });
            if (updateOrderDto.items) {
                const existingProductImageIds = existingOrder.items.flatMap((item) => item.images.map((image) => image.id));
                if (existingProductImageIds.length > 0) {
                    await this.bindUploadFilesToOrder(tx, existingProductImageIds, {
                        orderId: null,
                        orderItemId: null,
                    });
                }
                await tx.orderItem.deleteMany({ where: { orderId: id } });
                for (const item of updateOrderDto.items) {
                    const createdItem = await tx.orderItem.create({
                        data: {
                            orderId: id,
                            productName: item.productName?.trim() || '',
                            productSpec: item.productSpec,
                            quantity: item.quantity,
                            unitPrice: item.unitPrice,
                            lineAmount: item.lineAmount,
                            remark: item.remark,
                        },
                    });
                    if ((item.imageFileIds ?? []).length > 0) {
                        await this.bindUploadFilesToOrder(tx, item.imageFileIds ?? [], {
                            orderId: id,
                            orderItemId: createdItem.id,
                        });
                    }
                }
            }
            if (updateOrderDto.paymentImageFileIds !== undefined) {
                const existingPaymentImageIds = existingOrder.images
                    .filter((image) => image.bizType === upload_biz_types_1.ORDER_PAYMENT_CODE_IMAGE_BIZ_TYPE)
                    .map((image) => image.id);
                if (existingPaymentImageIds.length > 0) {
                    await this.bindUploadFilesToOrder(tx, existingPaymentImageIds, {
                        orderId: null,
                        orderItemId: null,
                    });
                }
                if (updateOrderDto.paymentImageFileIds.length > 0) {
                    await this.bindUploadFilesToOrder(tx, updateOrderDto.paymentImageFileIds, {
                        orderId: id,
                        orderItemId: null,
                    });
                }
            }
            await tx.orderStatusLog.create({
                data: {
                    orderId: id,
                    fromStatus: existingOrder.status,
                    toStatus: existingOrder.status,
                    action: 'update_order',
                    operatorId: currentUser.id,
                    note: 'Order updated by operator',
                },
            });
            return tx.order.findUniqueOrThrow({
                where: { id },
                include: {
                    customer: true,
                    items: {
                        include: {
                            images: true,
                        },
                    },
                    images: true,
                    logs: {
                        orderBy: { createdAt: 'desc' },
                    },
                    createdBy: {
                        select: {
                            id: true,
                            username: true,
                            displayName: true,
                            role: true,
                        },
                    },
                },
            });
        });
        if (removedPaymentImageIds.length > 0) {
            await this.uploadsService.deleteFilesByIds(removedPaymentImageIds);
        }
        return {
            success: true,
            data: {
                ...(0, order_presenter_1.presentOrderBase)(updatedOrder),
                customer: {
                    id: updatedOrder.customer.id,
                    name: updatedOrder.customer.name,
                    mobile: updatedOrder.customer.mobile,
                    wechatNickname: updatedOrder.customer.wechatNickname,
                },
                operatorRemark: updatedOrder.operatorRemark,
                warehouseRemark: updatedOrder.warehouseRemark,
                createdBy: updatedOrder.createdBy,
                logs: (0, order_presenter_1.presentOrderLogs)(updatedOrder.logs),
            },
        };
    }
    async listOrders(query) {
        const timezone = this.configService.get('APP_TIMEZONE', 'Asia/Shanghai');
        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? 10;
        const skip = (page - 1) * pageSize;
        let createdAtFilter;
        if (query.todayOnly) {
            const range = (0, date_range_util_1.getTodayRange)(timezone);
            createdAtFilter = { gte: range.start, lte: range.end };
        }
        else if (query.dateFrom || query.dateTo) {
            createdAtFilter = (0, date_range_util_1.getDateRange)(timezone, query.dateFrom, query.dateTo);
        }
        const keyword = query.keyword?.trim();
        const where = {
            ...(query.status ? { status: query.status } : {}),
            ...(query.orderNo ? { orderNo: { contains: query.orderNo } } : {}),
            ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
            ...(query.mobile
                ? {
                    OR: [
                        { receiverMobile: { contains: query.mobile } },
                        { customer: { is: { mobile: { contains: query.mobile } } } },
                    ],
                }
                : {}),
            ...(keyword
                ? {
                    AND: [
                        {
                            OR: [
                                { orderNo: { contains: keyword } },
                                { receiverName: { contains: keyword } },
                                { receiverMobile: { contains: keyword } },
                                { receiverAddress: { contains: keyword } },
                                { customer: { is: { name: { contains: keyword } } } },
                                { customer: { is: { mobile: { contains: keyword } } } },
                                {
                                    items: {
                                        some: {
                                            OR: [
                                                { productName: { contains: keyword } },
                                                { productSpec: { contains: keyword } },
                                            ],
                                        },
                                    },
                                },
                            ],
                        },
                    ],
                }
                : {}),
        };
        const [total, orders] = await Promise.all([
            this.prisma.order.count({ where }),
            this.prisma.order.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { createdAt: 'desc' },
                include: {
                    customer: {
                        select: {
                            id: true,
                            name: true,
                            mobile: true,
                        },
                    },
                    items: {
                        include: {
                            images: true,
                        },
                    },
                    images: true,
                    createdBy: {
                        select: {
                            id: true,
                            username: true,
                            displayName: true,
                            role: true,
                        },
                    },
                },
            }),
        ]);
        return {
            success: true,
            data: {
                list: orders.map((order) => ({
                    ...(0, order_presenter_1.presentOrderBase)(order),
                    customer: order.customer,
                    createdBy: order.createdBy,
                })),
                pagination: {
                    page,
                    pageSize,
                    total,
                },
            },
        };
    }
    async getOrderDetail(id) {
        const order = await this.prisma.order.findUnique({
            where: { id },
            include: {
                customer: true,
                items: {
                    include: {
                        images: true,
                    },
                },
                images: true,
                logs: {
                    orderBy: { createdAt: 'desc' },
                },
                createdBy: {
                    select: {
                        id: true,
                        username: true,
                        displayName: true,
                        role: true,
                    },
                },
            },
        });
        if (!order) {
            throw new common_1.NotFoundException('Order not found');
        }
        return {
            success: true,
            data: {
                ...(0, order_presenter_1.presentOrderBase)(order),
                customer: {
                    id: order.customer.id,
                    name: order.customer.name,
                    mobile: order.customer.mobile,
                    wechatNickname: order.customer.wechatNickname,
                    note: order.customer.note,
                    lastOrderAt: order.customer.lastOrderAt,
                },
                operatorRemark: order.operatorRemark,
                warehouseRemark: order.warehouseRemark,
                clientLinkPath: order.clientLinkPath,
                createdBy: order.createdBy,
                logs: (0, order_presenter_1.presentOrderLogs)(order.logs),
            },
        };
    }
    async cancelOrder(id, cancelOrderDto, currentUser) {
        const existingOrder = await this.prisma.order.findUnique({
            where: { id },
            include: {
                customer: true,
                items: {
                    include: {
                        images: true,
                    },
                },
                images: true,
                logs: {
                    orderBy: { createdAt: 'desc' },
                },
                createdBy: {
                    select: {
                        id: true,
                        username: true,
                        displayName: true,
                        role: true,
                    },
                },
            },
        });
        if (!existingOrder) {
            throw new common_1.NotFoundException('Order not found');
        }
        if (existingOrder.status === client_1.OrderStatus.shipped ||
            existingOrder.status === client_1.OrderStatus.completed) {
            throw new common_1.BadRequestException('Shipped or completed orders cannot be cancelled');
        }
        if (existingOrder.status === client_1.OrderStatus.cancelled) {
            throw new common_1.BadRequestException('Order is already cancelled');
        }
        const cancelledOrder = await this.prisma.$transaction(async (tx) => {
            await tx.order.update({
                where: { id },
                data: {
                    status: client_1.OrderStatus.cancelled,
                },
            });
            await tx.orderStatusLog.create({
                data: {
                    orderId: id,
                    fromStatus: existingOrder.status,
                    toStatus: client_1.OrderStatus.cancelled,
                    action: 'cancel_order',
                    operatorId: currentUser.id,
                    note: cancelOrderDto.reason?.trim() || 'Order cancelled by operator',
                },
            });
            return tx.order.findUniqueOrThrow({
                where: { id },
                include: {
                    customer: true,
                    items: {
                        include: {
                            images: true,
                        },
                    },
                    images: true,
                    logs: {
                        orderBy: { createdAt: 'desc' },
                    },
                    createdBy: {
                        select: {
                            id: true,
                            username: true,
                            displayName: true,
                            role: true,
                        },
                    },
                },
            });
        });
        return {
            success: true,
            data: {
                ...(0, order_presenter_1.presentOrderBase)(cancelledOrder),
                customer: {
                    id: cancelledOrder.customer.id,
                    name: cancelledOrder.customer.name,
                    mobile: cancelledOrder.customer.mobile,
                    wechatNickname: cancelledOrder.customer.wechatNickname,
                    note: cancelledOrder.customer.note,
                    lastOrderAt: cancelledOrder.customer.lastOrderAt,
                },
                operatorRemark: cancelledOrder.operatorRemark,
                warehouseRemark: cancelledOrder.warehouseRemark,
                clientLinkPath: cancelledOrder.clientLinkPath,
                createdBy: cancelledOrder.createdBy,
                logs: (0, order_presenter_1.presentOrderLogs)(cancelledOrder.logs),
            },
        };
    }
    async getPendingShipmentOrders(query) {
        return this.getWarehouseOrders({
            ...query,
            status: client_1.OrderStatus.pending_shipment,
        });
    }
    async getWarehouseOrders(query) {
        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? 10;
        const skip = (page - 1) * pageSize;
        const warehouseStatuses = [
            client_1.OrderStatus.pending_shipment,
            client_1.OrderStatus.shipped,
        ];
        const status = query.status && warehouseStatuses.includes(query.status)
            ? query.status
            : client_1.OrderStatus.pending_shipment;
        const keyword = query.keyword?.trim();
        const where = {
            status,
            ...(query.orderNo ? { orderNo: { contains: query.orderNo } } : {}),
            ...(query.mobile ? { receiverMobile: { contains: query.mobile } } : {}),
            ...(keyword
                ? {
                    AND: [
                        {
                            OR: [
                                { orderNo: { contains: keyword } },
                                { receiverName: { contains: keyword } },
                                { receiverMobile: { contains: keyword } },
                                { receiverAddress: { contains: keyword } },
                                { customer: { is: { name: { contains: keyword } } } },
                                { customer: { is: { mobile: { contains: keyword } } } },
                                {
                                    items: {
                                        some: {
                                            OR: [
                                                { productName: { contains: keyword } },
                                                { productSpec: { contains: keyword } },
                                            ],
                                        },
                                    },
                                },
                            ],
                        },
                    ],
                }
                : {}),
        };
        const [total, orders] = await Promise.all([
            this.prisma.order.count({ where }),
            this.prisma.order.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: status === client_1.OrderStatus.shipped
                    ? { shippedAt: 'desc' }
                    : { createdAt: 'asc' },
                include: {
                    customer: {
                        select: {
                            name: true,
                            mobile: true,
                        },
                    },
                    items: true,
                    images: true,
                },
            }),
        ]);
        return {
            success: true,
            data: {
                list: orders.map((order) => ({
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
                    totalAmount: (0, decimal_util_1.toCurrencyNumber)(order.totalAmount),
                    shippingFee: (0, decimal_util_1.toCurrencyNumber)(order.shippingFee),
                    discountAmount: (0, decimal_util_1.toCurrencyNumber)(order.discountAmount),
                    payableAmount: (0, decimal_util_1.toCurrencyNumber)(order.payableAmount),
                    courierCompany: order.courierCompany,
                    trackingNo: order.trackingNo,
                    shippedAt: order.shippedAt,
                    createdAt: order.createdAt,
                    updatedAt: order.updatedAt,
                    customer: order.customer,
                    items: (0, order_presenter_1.presentOrderItems)(order.items),
                    images: (0, order_presenter_1.presentOrderImages)(order.images),
                    warehouseRemark: order.warehouseRemark ??
                        this.extractWarehouseRemark(order.operatorRemark),
                })),
                pagination: {
                    page,
                    pageSize,
                    total,
                },
            },
        };
    }
    async shipOrder(id, shipOrderDto, currentUser) {
        const existingOrder = await this.prisma.order.findUnique({
            where: { id },
            include: {
                items: {
                    include: {
                        images: true,
                    },
                },
                images: true,
            },
        });
        if (!existingOrder) {
            throw new common_1.NotFoundException('Order not found');
        }
        if (existingOrder.status !== client_1.OrderStatus.pending_shipment) {
            throw new common_1.BadRequestException('Only pending shipment orders can be shipped');
        }
        const updatedOrder = await this.prisma.$transaction(async (tx) => {
            const order = await tx.order.update({
                where: { id },
                data: {
                    courierCompany: shipOrderDto.courierCompany,
                    trackingNo: shipOrderDto.trackingNo,
                    warehouseRemark: shipOrderDto.warehouseRemark,
                    shippedAt: new Date(),
                    status: client_1.OrderStatus.shipped,
                },
                include: {
                    items: {
                        include: {
                            images: true,
                        },
                    },
                    images: true,
                },
            });
            await tx.orderStatusLog.create({
                data: {
                    orderId: id,
                    fromStatus: existingOrder.status,
                    toStatus: client_1.OrderStatus.shipped,
                    action: 'ship_order',
                    operatorId: currentUser.id,
                    note: 'Order shipped by warehouse',
                },
            });
            return order;
        });
        return {
            success: true,
            data: {
                ...(0, order_presenter_1.presentOrderBase)(updatedOrder),
                warehouseRemark: shipOrderDto.warehouseRemark ?? null,
            },
        };
    }
    async getWarehouseOrderDetail(id) {
        const order = await this.prisma.order.findUnique({
            where: { id },
            include: {
                customer: {
                    select: {
                        name: true,
                        mobile: true,
                    },
                },
                items: {
                    include: {
                        images: true,
                    },
                },
                images: true,
            },
        });
        if (!order) {
            throw new common_1.NotFoundException('Order not found');
        }
        if (order.status !== client_1.OrderStatus.pending_shipment &&
            order.status !== client_1.OrderStatus.shipped) {
            throw new common_1.BadRequestException('Only pending or shipped orders are available');
        }
        return {
            success: true,
            data: {
                ...(0, order_presenter_1.presentOrderBase)(order),
                customer: order.customer,
                warehouseRemark: order.warehouseRemark ?? this.extractWarehouseRemark(order.operatorRemark),
            },
        };
    }
    async getPublicOrderDetail(orderNo, publicOrderQueryDto) {
        const order = await this.prisma.order.findUnique({
            where: { orderNo },
            include: {
                items: {
                    include: {
                        images: true,
                    },
                },
                images: true,
            },
        });
        if (!order) {
            throw new common_1.NotFoundException('Order not found');
        }
        const tokenHash = (0, public_token_util_1.hashPublicToken)(publicOrderQueryDto.token);
        if (tokenHash !== order.clientTokenHash) {
            throw new common_1.BadRequestException('Invalid order token');
        }
        return {
            success: true,
            data: {
                ...(0, order_presenter_1.presentOrderBase)(order),
            },
        };
    }
    buildClientLink(orderNo, token) {
        const h5BaseUrl = this.configService.get('H5_BASE_URL', this.configService.get('APP_BASE_URL', 'http://localhost:5173'));
        return `${h5BaseUrl.replace(/\/$/, '')}/client/orders/${orderNo}?token=${token}`;
    }
    validateAmounts(items, totalAmount, shippingFee, discountAmount, payableAmount) {
        const computedTotal = items.reduce((sum, item) => {
            const expectedLineAmount = item.quantity * item.unitPrice;
            if (!(0, decimal_util_1.almostEqualMoney)(expectedLineAmount, item.lineAmount)) {
                throw new common_1.BadRequestException(`Invalid line amount for product ${item.productName ?? ''}`.trim());
            }
            return sum + item.lineAmount;
        }, 0);
        if (!(0, decimal_util_1.almostEqualMoney)(computedTotal, totalAmount)) {
            throw new common_1.BadRequestException('Total amount does not match item sum');
        }
        const computedPayable = totalAmount + shippingFee - discountAmount;
        if (!(0, decimal_util_1.almostEqualMoney)(computedPayable, payableAmount)) {
            throw new common_1.BadRequestException('Payable amount is incorrect');
        }
    }
    validateProductModelNos(items) {
        const invalidIndex = items.findIndex((item) => !this.extractModelNo(item.productSpec));
        if (invalidIndex >= 0) {
            throw new common_1.BadRequestException(`商品 ${invalidIndex + 1} 款号必填`);
        }
    }
    extractModelNo(productSpec) {
        return productSpec
            ?.split('|')
            .map((part) => part.trim())
            .find((part) => part.startsWith('款号:'))
            ?.replace('款号:', '')
            .trim();
    }
    collectItemImageFileIds(items) {
        return items.flatMap((item) => item.imageFileIds ?? []);
    }
    async ensureUploadFilesAvailable(imageFileIds, currentOrderId, bizType = upload_biz_types_1.ORDER_PRODUCT_IMAGE_BIZ_TYPE) {
        if (imageFileIds.length === 0) {
            return;
        }
        const uniqueIds = [...new Set(imageFileIds)];
        const files = await this.prisma.$queryRaw(client_1.Prisma.sql `
        SELECT id, order_id, biz_type, deleted_at
        FROM upload_files
        WHERE id IN (${client_1.Prisma.join(uniqueIds)})
      `);
        if (files.length !== uniqueIds.length) {
            throw new common_1.BadRequestException('Some uploaded images do not exist');
        }
        const deletedFile = files.find((file) => file.deleted_at !== null);
        if (deletedFile) {
            throw new common_1.BadRequestException('Some uploaded images are no longer available');
        }
        const invalidBizTypeFile = files.find((file) => file.biz_type !== bizType);
        if (invalidBizTypeFile) {
            throw new common_1.BadRequestException('Some uploaded images do not match the expected type');
        }
        const occupiedFile = files.find((file) => {
            if (file.order_id === null) {
                return false;
            }
            return file.order_id !== currentOrderId;
        });
        if (occupiedFile) {
            throw new common_1.BadRequestException('Some uploaded images already belong to another order');
        }
    }
    async bindUploadFilesToOrder(tx, fileIds, target) {
        if (fileIds.length === 0) {
            return;
        }
        const uniqueIds = [...new Set(fileIds)];
        await tx.$executeRaw(client_1.Prisma.sql `
        UPDATE upload_files
        SET
          order_id = ${target.orderId},
          order_item_id = ${target.orderItemId}
        WHERE id IN (${client_1.Prisma.join(uniqueIds)})
      `);
    }
    extractWarehouseRemark(operatorRemark) {
        if (!operatorRemark) {
            return null;
        }
        const normalizedRemark = operatorRemark
            .replaceAll('\\n', '\n')
            .replaceAll('`n', '\n');
        const matched = normalizedRemark
            .split('\n')
            .find((line) => line.startsWith('【仓库备注】'));
        if (!matched) {
            return null;
        }
        const value = matched.replace('【仓库备注】', '').trim();
        return value === '--' ? null : value;
    }
    isOrderNoUniqueConflict(error) {
        const code = this.getErrorCode(error);
        const target = error instanceof client_1.Prisma.PrismaClientKnownRequestError
            ? error.meta?.target
            : typeof error === 'object' && error !== null && 'meta' in error
                ? error.meta?.target
                : undefined;
        const normalizedTarget = Array.isArray(target)
            ? target.join(',')
            : target === undefined || target === null
                ? ''
                : String(target);
        return (code === 'P2002' &&
            (normalizedTarget.includes('orders_order_no_key') ||
                normalizedTarget.includes('order_no') ||
                normalizedTarget.includes('orderNo')));
    }
    describePrismaError(error) {
        const code = this.getErrorCode(error) ?? 'unknown';
        const message = error instanceof Error ? error.message : String(error);
        const target = error instanceof client_1.Prisma.PrismaClientKnownRequestError
            ? error.meta?.target
            : typeof error === 'object' && error !== null && 'meta' in error
                ? error.meta?.target
                : undefined;
        return `code=${code}; target=${JSON.stringify(target)}; message=${message}`;
    }
    getErrorCode(error) {
        return error instanceof client_1.Prisma.PrismaClientKnownRequestError
            ? error.code
            : typeof error === 'object' && error !== null && 'code' in error
                ? String(error.code)
                : undefined;
    }
    presentOrderDraftRow(draft) {
        return {
            id: Number(draft.id),
            title: draft.title,
            payload: this.parseDraftPayload(draft.payload),
            createdAt: draft.created_at,
            updatedAt: draft.updated_at,
        };
    }
    parseDraftPayload(payload) {
        if (typeof payload !== 'string') {
            return payload;
        }
        try {
            return JSON.parse(payload);
        }
        catch {
            return {};
        }
    }
    normalizeReceiverInfo(input) {
        const receiverFullAddress = input.receiverFullAddress?.trim() ||
            [
                input.receiverName,
                input.receiverMobile,
                [input.receiverProvince, input.receiverCity, input.receiverDistrict, input.receiverAddress]
                    .filter(Boolean)
                    .join(' '),
            ]
                .filter(Boolean)
                .join(' ')
                .trim();
        if (!receiverFullAddress) {
            throw new common_1.BadRequestException('Receiver full address is required');
        }
        const mobileMatch = receiverFullAddress.match(/1\d{10}/);
        const parsedMobile = mobileMatch?.[0] || input.receiverMobile?.trim() || input.customerMobile;
        const nameSource = mobileMatch?.index
            ? receiverFullAddress.slice(0, mobileMatch.index)
            : receiverFullAddress;
        const normalizedLeft = nameSource
            .replace(/收货人|收件人|联系人|姓名/g, ' ')
            .replace(/联系电话|联系手机|手机号|手机|电话/g, ' ')
            .replace(/[：:,，;；|]/g, ' ')
            .trim();
        const receiverName = input.receiverName?.trim() ||
            normalizedLeft
                .split(/\s+/)
                .filter(Boolean)
                .find((item) => !/^\d+$/.test(item)) ||
            input.customerName ||
            '收件人待确认';
        return {
            receiverName,
            receiverMobile: parsedMobile,
            receiverFullAddress,
        };
    }
};
exports.OrdersService = OrdersService;
OrdersService.ORDER_NO_RETRY_TIMES = 8;
exports.OrdersService = OrdersService = OrdersService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        order_number_service_1.OrderNumberService,
        config_1.ConfigService,
        uploads_service_1.UploadsService])
], OrdersService);
