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
const order_status_constants_1 = require("./order-status.constants");
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
                            status: order_status_constants_1.ORDER_STATUS.pending_shipment,
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
                        await this.cloneUploadFilesToOrder(tx, paymentImageFileIds, {
                            orderId: order.id,
                            orderItemId: null,
                        });
                    }
                    await tx.orderStatusLog.create({
                        data: {
                            orderId: order.id,
                            fromStatus: null,
                            toStatus: order_status_constants_1.ORDER_STATUS.pending_shipment,
                            action: 'create_order',
                            operatorId: currentUser.id,
                            note: 'Order created by operator',
                        },
                    });
                    return {
                        orderId: order.id,
                        orderNo,
                        status: order_status_constants_1.ORDER_STATUS.pending_shipment,
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
        const existingOrderBase = await this.prisma.order.findUnique({
            where: { id },
            include: {
                customer: true,
                items: true,
            },
        });
        const existingOrder = existingOrderBase
            ? (await this.attachOrderMedia([existingOrderBase]))[0]
            : null;
        if (!existingOrder) {
            throw new common_1.NotFoundException('Order not found');
        }
        if (existingOrder.status === order_status_constants_1.ORDER_STATUS.partial_shipped ||
            existingOrder.status === order_status_constants_1.ORDER_STATUS.shipped ||
            existingOrder.status === order_status_constants_1.ORDER_STATUS.completed ||
            existingOrder.status === order_status_constants_1.ORDER_STATUS.cancelled) {
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
                imageFileIds: (item.images ?? []).map((image) => image.id),
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
                const existingProductImageIds = existingOrder.items.flatMap((item) => (item.images ?? []).map((image) => image.id));
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
                const existingPaymentImageIdSet = new Set(existingPaymentImageIds);
                const newPaymentImageIds = [
                    ...new Set(updateOrderDto.paymentImageFileIds),
                ].filter((imageId) => !existingPaymentImageIdSet.has(imageId));
                if (newPaymentImageIds.length > 0) {
                    await this.cloneUploadFilesToOrder(tx, newPaymentImageIds, {
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
            const order = await tx.order.findUniqueOrThrow({
                where: { id },
                include: {
                    customer: true,
                    items: true,
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
            return (await this.attachOrderMedia([order]))[0];
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
        const useRawStatusQuery = query.status === order_status_constants_1.ORDER_STATUS.partial_shipped;
        const { total, orderIds } = useRawStatusQuery
            ? await this.queryOrderIdsWithRawFilters({
                page,
                pageSize,
                orderBy: 'created_desc',
                statusMode: {
                    type: 'eq',
                    values: [order_status_constants_1.ORDER_STATUS.pending_shipment],
                },
                latestShipmentStatus: order_status_constants_1.SHIPMENT_STATUS.partial_shipped,
                orderNo: query.orderNo,
                mobile: query.mobile,
                keyword,
                createdAtFilter,
            })
            : await (async () => {
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
                const [count, records] = await Promise.all([
                    this.prisma.order.count({ where }),
                    this.prisma.order.findMany({
                        where,
                        skip,
                        take: pageSize,
                        orderBy: { createdAt: 'desc' },
                        select: { id: true },
                    }),
                ]);
                return {
                    total: count,
                    orderIds: records.map((record) => record.id),
                };
            })();
        const orders = orderIds.length
            ? await this.prisma.order.findMany({
                where: {
                    id: {
                        in: orderIds,
                    },
                },
                include: {
                    customer: {
                        select: {
                            id: true,
                            name: true,
                            mobile: true,
                        },
                    },
                    items: true,
                    createdBy: {
                        select: {
                            id: true,
                            username: true,
                            displayName: true,
                            role: true,
                        },
                    },
                },
            })
            : [];
        const orderedOrders = this.sortRecordsByIds(orders, orderIds);
        const ordersWithMedia = await this.attachOrderMedia(orderedOrders);
        return {
            success: true,
            data: {
                list: ordersWithMedia.map((order) => ({
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
        const orderBase = await this.prisma.order.findUnique({
            where: { id },
            include: {
                customer: true,
                items: true,
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
        const order = orderBase ? (await this.attachOrderMedia([orderBase]))[0] : null;
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
        const existingOrderBase = await this.prisma.order.findUnique({
            where: { id },
            include: {
                customer: true,
                items: true,
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
        const existingOrder = existingOrderBase
            ? (await this.attachOrderMedia([existingOrderBase]))[0]
            : null;
        if (!existingOrder) {
            throw new common_1.NotFoundException('Order not found');
        }
        if (existingOrder.status === order_status_constants_1.ORDER_STATUS.partial_shipped ||
            existingOrder.status === order_status_constants_1.ORDER_STATUS.shipped ||
            existingOrder.status === order_status_constants_1.ORDER_STATUS.completed) {
            throw new common_1.BadRequestException('Shipped or completed orders cannot be cancelled');
        }
        if (existingOrder.status === order_status_constants_1.ORDER_STATUS.cancelled) {
            throw new common_1.BadRequestException('Order is already cancelled');
        }
        const cancelledOrder = await this.prisma.$transaction(async (tx) => {
            await tx.order.update({
                where: { id },
                data: {
                    status: order_status_constants_1.ORDER_STATUS.cancelled,
                },
            });
            await tx.orderStatusLog.create({
                data: {
                    orderId: id,
                    fromStatus: existingOrder.status,
                    toStatus: order_status_constants_1.ORDER_STATUS.cancelled,
                    action: 'cancel_order',
                    operatorId: currentUser.id,
                    note: cancelOrderDto.reason?.trim() || 'Order cancelled by operator',
                },
            });
            const order = await tx.order.findUniqueOrThrow({
                where: { id },
                include: {
                    customer: true,
                    items: true,
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
            return (await this.attachOrderMedia([order]))[0];
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
            status: order_status_constants_1.ORDER_STATUS.pending_shipment,
        });
    }
    async getWarehouseOrders(query) {
        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? 10;
        const skip = (page - 1) * pageSize;
        const warehouseStatuses = [
            order_status_constants_1.ORDER_STATUS.pending_shipment,
            order_status_constants_1.ORDER_STATUS.partial_shipped,
            order_status_constants_1.ORDER_STATUS.shipped,
        ];
        const status = query.status && warehouseStatuses.includes(query.status)
            ? query.status
            : order_status_constants_1.ORDER_STATUS.pending_shipment;
        const keyword = query.keyword?.trim();
        const { total, orderIds } = await this.queryOrderIdsWithRawFilters({
            page,
            pageSize,
            orderBy: status === order_status_constants_1.ORDER_STATUS.shipped ? 'shipped_desc' : 'created_asc',
            statusMode: status === order_status_constants_1.ORDER_STATUS.pending_shipment
                ? {
                    type: 'eq',
                    values: [order_status_constants_1.ORDER_STATUS.pending_shipment],
                }
                : {
                    type: 'eq',
                    values: [status],
                },
            orderNo: query.orderNo,
            mobile: query.mobile,
            keyword,
        });
        const orders = orderIds.length
            ? await this.prisma.order.findMany({
                where: {
                    id: {
                        in: orderIds,
                    },
                },
                include: {
                    customer: {
                        select: {
                            name: true,
                            mobile: true,
                        },
                    },
                    items: true,
                },
            })
            : [];
        const orderedOrders = this.sortRecordsByIds(orders, orderIds);
        const ordersWithMedia = await this.attachOrderMedia(orderedOrders);
        return {
            success: true,
            data: {
                list: ordersWithMedia.map((order) => ({
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
                    shipments: order.shipments,
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
        const existingOrderBase = await this.prisma.order.findUnique({
            where: { id },
            include: {
                items: true,
            },
        });
        const existingOrder = existingOrderBase
            ? (await this.attachOrderMedia([existingOrderBase]))[0]
            : null;
        if (!existingOrder) {
            throw new common_1.NotFoundException('Order not found');
        }
        if (existingOrder.status !== order_status_constants_1.ORDER_STATUS.pending_shipment &&
            existingOrder.status !== order_status_constants_1.ORDER_STATUS.partial_shipped) {
            throw new common_1.BadRequestException('Only pending or partial shipment orders can be shipped');
        }
        const isPartialShipment = shipOrderDto.isPartialShipment === true;
        const isFullyShipped = shipOrderDto.isFullyShipped === true;
        if (isPartialShipment === isFullyShipped) {
            throw new common_1.BadRequestException('请选择部分发货或已全部发货其中一项');
        }
        const shipmentRemark = shipOrderDto.shipmentRemark?.trim() || null;
        if (isPartialShipment && !shipmentRemark) {
            throw new common_1.BadRequestException('部分发货时请填写未发货备注信息');
        }
        const updatedOrder = await this.prisma.$transaction(async (tx) => {
            const shippedAt = new Date();
            const nextStatus = isFullyShipped
                ? order_status_constants_1.ORDER_STATUS.shipped
                : order_status_constants_1.ORDER_STATUS.pending_shipment;
            const shipmentStatus = isFullyShipped
                ? order_status_constants_1.SHIPMENT_STATUS.shipped
                : order_status_constants_1.SHIPMENT_STATUS.partial_shipped;
            const nextSequenceNo = (existingOrder.shipments?.length ?? 0) + 1;
            await tx.$executeRaw(client_1.Prisma.sql `
          UPDATE orders
          SET
            courier_company = ${shipOrderDto.courierCompany},
            tracking_no = ${shipOrderDto.trackingNo},
            warehouse_remark = ${shipmentRemark},
            shipped_at = ${shippedAt},
            status = ${nextStatus}
          WHERE id = ${id}
        `);
            await tx.$executeRaw(client_1.Prisma.sql `
          INSERT INTO order_shipments (
            order_id,
            sequence_no,
            shipment_status,
            courier_company,
            tracking_no,
            shipment_remark,
            operator_id,
            shipped_at,
            created_at,
            updated_at
          ) VALUES (
            ${id},
            ${nextSequenceNo},
            ${shipmentStatus},
            ${shipOrderDto.courierCompany},
            ${shipOrderDto.trackingNo},
            ${shipmentRemark},
            ${currentUser.id},
            ${shippedAt},
            CURRENT_TIMESTAMP(3),
            CURRENT_TIMESTAMP(3)
          )
        `);
            await tx.$executeRaw(client_1.Prisma.sql `
          INSERT INTO order_status_logs (
            order_id,
            from_status,
            to_status,
            action,
            operator_id,
            note,
            created_at
          ) VALUES (
            ${id},
            ${existingOrder.status},
            ${nextStatus},
            ${'ship_order'},
            ${currentUser.id},
            ${isFullyShipped
                ? 'Order fully shipped by warehouse'
                : `Order partially shipped by warehouse${shipmentRemark ? `: ${shipmentRemark}` : ''}`},
            CURRENT_TIMESTAMP(3)
          )
        `);
            return {
                ...existingOrder,
                status: nextStatus,
                courierCompany: shipOrderDto.courierCompany,
                trackingNo: shipOrderDto.trackingNo,
                warehouseRemark: shipmentRemark,
                shippedAt,
                shipments: [
                    ...(existingOrder.shipments ?? []),
                    {
                        id: Date.now(),
                        sequenceNo: nextSequenceNo,
                        shipmentStatus,
                        courierCompany: shipOrderDto.courierCompany,
                        trackingNo: shipOrderDto.trackingNo,
                        shipmentRemark,
                        operatorId: currentUser.id,
                        shippedAt,
                        createdAt: shippedAt,
                        updatedAt: shippedAt,
                    },
                ],
            };
        });
        return {
            success: true,
            data: {
                ...(0, order_presenter_1.presentOrderBase)(updatedOrder),
                warehouseRemark: updatedOrder.warehouseRemark ?? null,
            },
        };
    }
    async getWarehouseOrderDetail(id) {
        const orderBase = await this.prisma.order.findUnique({
            where: { id },
            include: {
                customer: {
                    select: {
                        name: true,
                        mobile: true,
                    },
                },
                items: true,
            },
        });
        const order = orderBase ? (await this.attachOrderMedia([orderBase]))[0] : null;
        if (!order) {
            throw new common_1.NotFoundException('Order not found');
        }
        if (order.status !== order_status_constants_1.ORDER_STATUS.pending_shipment &&
            order.status !== order_status_constants_1.ORDER_STATUS.partial_shipped &&
            order.status !== order_status_constants_1.ORDER_STATUS.shipped) {
            throw new common_1.BadRequestException('Only pending, partial or shipped orders are available');
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
        const orderBase = await this.prisma.order.findUnique({
            where: { orderNo },
            include: {
                items: true,
            },
        });
        const order = orderBase ? (await this.attachOrderMedia([orderBase]))[0] : null;
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
        if (bizType === upload_biz_types_1.ORDER_PAYMENT_CODE_IMAGE_BIZ_TYPE) {
            return;
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
    async loadOrderImagesMap(orderIds) {
        const uniqueOrderIds = [...new Set(orderIds)].filter((id) => Number.isFinite(id));
        const imageMap = new Map();
        if (uniqueOrderIds.length === 0) {
            return imageMap;
        }
        const rows = await this.prisma.$queryRaw(client_1.Prisma.sql `
        SELECT
          id,
          order_id,
          order_item_id,
          biz_type,
          storage_driver,
          storage_key,
          original_name,
          file_name,
          mime_type,
          file_size,
          file_url,
          expires_at,
          deleted_at
        FROM upload_files
        WHERE order_id IN (${client_1.Prisma.join(uniqueOrderIds)})
        ORDER BY id ASC
      `);
        for (const row of rows) {
            if (row.order_id === null) {
                continue;
            }
            const list = imageMap.get(row.order_id) ?? [];
            list.push({
                id: row.id,
                orderId: row.order_id,
                orderItemId: row.order_item_id,
                bizType: row.biz_type,
                storageDriver: row.storage_driver,
                storageKey: row.storage_key,
                originalName: row.original_name,
                fileName: row.file_name,
                mimeType: row.mime_type,
                fileSize: Number(row.file_size),
                fileUrl: row.file_url,
                expiresAt: row.expires_at,
                deletedAt: row.deleted_at,
            });
            imageMap.set(row.order_id, list);
        }
        return imageMap;
    }
    async loadOrderShipmentsMap(orderIds) {
        const uniqueOrderIds = [...new Set(orderIds)].filter((id) => Number.isFinite(id));
        const shipmentMap = new Map();
        if (uniqueOrderIds.length === 0) {
            return shipmentMap;
        }
        const rows = await this.prisma.$queryRaw(client_1.Prisma.sql `
        SELECT
          id,
          order_id,
          sequence_no,
          shipment_status,
          courier_company,
          tracking_no,
          shipment_remark,
          operator_id,
          shipped_at,
          created_at,
          updated_at
        FROM order_shipments
        WHERE order_id IN (${client_1.Prisma.join(uniqueOrderIds)})
        ORDER BY order_id ASC, sequence_no ASC, shipped_at ASC
      `);
        for (const row of rows) {
            const list = shipmentMap.get(row.order_id) ?? [];
            list.push({
                id: row.id,
                sequenceNo: row.sequence_no,
                shipmentStatus: row.shipment_status === order_status_constants_1.SHIPMENT_STATUS.partial_shipped
                    ? order_status_constants_1.SHIPMENT_STATUS.partial_shipped
                    : order_status_constants_1.SHIPMENT_STATUS.shipped,
                courierCompany: row.courier_company,
                trackingNo: row.tracking_no,
                shipmentRemark: row.shipment_remark,
                operatorId: row.operator_id,
                shippedAt: row.shipped_at,
                createdAt: row.created_at,
                updatedAt: row.updated_at,
            });
            shipmentMap.set(row.order_id, list);
        }
        return shipmentMap;
    }
    async attachOrderMedia(orders) {
        const imageMap = await this.loadOrderImagesMap(orders.map((order) => order.id));
        const shipmentMap = await this.loadOrderShipmentsMap(orders.map((order) => order.id));
        return orders.map((order) => {
            const orderImages = imageMap.get(order.id) ?? [];
            const itemImageMap = new Map();
            for (const image of orderImages) {
                if (image.orderItemId === null || image.orderItemId === undefined) {
                    continue;
                }
                const itemImages = itemImageMap.get(image.orderItemId) ?? [];
                itemImages.push(image);
                itemImageMap.set(image.orderItemId, itemImages);
            }
            return {
                ...order,
                images: orderImages,
                shipments: shipmentMap.get(order.id) ?? [],
                items: order.items.map((item) => ({
                    ...item,
                    images: itemImageMap.get(item.id) ?? [],
                })),
            };
        });
    }
    async cloneUploadFilesToOrder(tx, fileIds, target) {
        if (fileIds.length === 0) {
            return;
        }
        const uniqueIds = [...new Set(fileIds)];
        await tx.$executeRaw(client_1.Prisma.sql `
        INSERT INTO upload_files (
          order_id,
          order_item_id,
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
          deleted_at,
          created_at
        )
        SELECT
          ${target.orderId},
          ${target.orderItemId},
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
          NULL,
          CURRENT_TIMESTAMP(3)
        FROM upload_files
        WHERE id IN (${client_1.Prisma.join(uniqueIds)})
          AND deleted_at IS NULL
      `);
    }
    async queryOrderIdsWithRawFilters(input) {
        const skip = (input.page - 1) * input.pageSize;
        const conditions = [];
        if (input.statusMode.type === 'eq') {
            conditions.push(client_1.Prisma.sql `o.status = ${input.statusMode.values[0]}`);
        }
        else {
            conditions.push(client_1.Prisma.sql `o.status IN (${client_1.Prisma.join(input.statusMode.values)})`);
        }
        if (input.orderNo?.trim()) {
            conditions.push(client_1.Prisma.sql `o.order_no LIKE CONCAT('%', ${input.orderNo.trim()}, '%')`);
        }
        if (input.mobile?.trim()) {
            const mobile = input.mobile.trim();
            conditions.push(client_1.Prisma.sql `(
          o.receiver_mobile LIKE CONCAT('%', ${mobile}, '%')
          OR c.mobile LIKE CONCAT('%', ${mobile}, '%')
        )`);
        }
        if (input.keyword?.trim()) {
            const keyword = input.keyword.trim();
            conditions.push(client_1.Prisma.sql `(
          o.order_no LIKE CONCAT('%', ${keyword}, '%')
          OR o.receiver_name LIKE CONCAT('%', ${keyword}, '%')
          OR o.receiver_mobile LIKE CONCAT('%', ${keyword}, '%')
          OR o.receiver_address LIKE CONCAT('%', ${keyword}, '%')
          OR c.name LIKE CONCAT('%', ${keyword}, '%')
          OR c.mobile LIKE CONCAT('%', ${keyword}, '%')
          OR EXISTS (
            SELECT 1
            FROM order_items oi
            WHERE oi.order_id = o.id
              AND (
                oi.product_name LIKE CONCAT('%', ${keyword}, '%')
                OR oi.product_spec LIKE CONCAT('%', ${keyword}, '%')
              )
          )
        )`);
        }
        if (input.createdAtFilter?.gte) {
            conditions.push(client_1.Prisma.sql `o.created_at >= ${input.createdAtFilter.gte}`);
        }
        if (input.createdAtFilter?.lte) {
            conditions.push(client_1.Prisma.sql `o.created_at <= ${input.createdAtFilter.lte}`);
        }
        if (input.latestShipmentStatus) {
            conditions.push(client_1.Prisma.sql `EXISTS (
          SELECT 1
          FROM order_shipments os
          WHERE os.order_id = o.id
            AND os.shipment_status = ${input.latestShipmentStatus}
            AND os.sequence_no = (
              SELECT MAX(os2.sequence_no)
              FROM order_shipments os2
              WHERE os2.order_id = o.id
            )
        )`);
        }
        const whereSql = conditions.length > 0
            ? client_1.Prisma.sql `WHERE ${client_1.Prisma.join(conditions, ' AND ')}`
            : client_1.Prisma.empty;
        const orderBySql = input.orderBy === 'created_asc'
            ? client_1.Prisma.sql `ORDER BY o.created_at ASC`
            : input.orderBy === 'shipped_desc'
                ? client_1.Prisma.sql `ORDER BY o.shipped_at DESC, o.updated_at DESC`
                : client_1.Prisma.sql `ORDER BY o.created_at DESC`;
        const [countRows, idRows] = await Promise.all([
            this.prisma.$queryRaw(client_1.Prisma.sql `
          SELECT COUNT(DISTINCT o.id) AS total
          FROM orders o
          LEFT JOIN customers c ON c.id = o.customer_id
          ${whereSql}
        `),
            this.prisma.$queryRaw(client_1.Prisma.sql `
          SELECT o.id
          FROM orders o
          LEFT JOIN customers c ON c.id = o.customer_id
          ${whereSql}
          ${orderBySql}
          LIMIT ${input.pageSize} OFFSET ${skip}
        `),
        ]);
        return {
            total: Number(countRows[0]?.total ?? 0),
            orderIds: idRows.map((row) => row.id),
        };
    }
    sortRecordsByIds(records, ids) {
        const orderIndex = new Map(ids.map((id, index) => [id, index]));
        return [...records].sort((left, right) => (orderIndex.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
            (orderIndex.get(right.id) ?? Number.MAX_SAFE_INTEGER));
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
