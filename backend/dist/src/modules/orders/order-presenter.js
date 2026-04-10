"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.presentOrderItems = presentOrderItems;
exports.presentOrderImages = presentOrderImages;
exports.presentOrderLogs = presentOrderLogs;
exports.presentOrderBase = presentOrderBase;
const decimal_util_1 = require("../../common/utils/decimal.util");
function resolveUploadFileUrl(image) {
    if (image.storageDriver === 'r2' && image.storageKey) {
        const publicBaseUrl = (process.env.UPLOAD_PUBLIC_BASE_URL ?? '').trim();
        const prefix = ((process.env.R2_BUCKET_PREFIX ?? 'order-images').trim() ||
            'order-images')
            .replace(/^['"]|['"]$/g, '')
            .replace(/^[A-Z0-9_]+\s*=\s*/i, '')
            .replace(/^=+/, '')
            .replace(/^\/+|\/+$/g, '');
        const normalizedStorageKey = image.storageKey.startsWith(`${prefix}/`)
            ? image.storageKey
            : `${prefix}/${image.storageKey.replace(/^\/+/, '')}`;
        if (publicBaseUrl) {
            return `${publicBaseUrl.replace(/\/$/, '')}/${normalizedStorageKey}`;
        }
    }
    return image.fileUrl;
}
function presentOrderItems(items) {
    return items.map((item) => ({
        id: item.id,
        productName: item.productName,
        productSpec: item.productSpec,
        quantity: item.quantity,
        unitPrice: (0, decimal_util_1.toCurrencyNumber)(item.unitPrice),
        lineAmount: (0, decimal_util_1.toCurrencyNumber)(item.lineAmount),
        remark: item.remark,
        images: presentOrderImages(item.images ?? []),
    }));
}
function presentOrderImages(images) {
    const now = Date.now();
    return images.map((image) => ({
        id: image.id,
        originalName: image.originalName,
        fileName: image.fileName,
        mimeType: image.mimeType,
        fileSize: image.fileSize,
        fileUrl: resolveUploadFileUrl(image),
        expiresAt: image.expiresAt,
        deletedAt: image.deletedAt,
        available: image.deletedAt === null && new Date(image.expiresAt).getTime() > now,
    }));
}
function presentOrderLogs(logs) {
    return logs.map((log) => ({
        id: log.id,
        fromStatus: log.fromStatus,
        toStatus: log.toStatus,
        action: log.action,
        operatorId: log.operatorId,
        note: log.note,
        createdAt: log.createdAt,
    }));
}
function presentOrderBase(order) {
    const itemList = presentOrderItems(order.items);
    const fallbackImages = presentOrderImages(order.images);
    if (fallbackImages.length > 0 && itemList.every((item) => !item.images.length) && itemList[0]) {
        itemList[0] = {
            ...itemList[0],
            images: fallbackImages,
        };
    }
    return {
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
        items: itemList,
        images: fallbackImages,
    };
}
