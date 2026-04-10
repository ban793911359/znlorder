import { Order, OrderItem, OrderStatusLog, UploadFile } from '@prisma/client';
import { toCurrencyNumber } from '../../common/utils/decimal.util';

function resolveUploadFileUrl(image: UploadFile) {
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

export function presentOrderItems(
  items: Array<OrderItem & { images?: UploadFile[] }>,
) {
  return items.map((item) => ({
    id: item.id,
    productName: item.productName,
    productSpec: item.productSpec,
    quantity: item.quantity,
    unitPrice: toCurrencyNumber(item.unitPrice),
    lineAmount: toCurrencyNumber(item.lineAmount),
    remark: item.remark,
    images: presentOrderImages(item.images ?? []),
  }));
}

export function presentOrderImages(images: UploadFile[]) {
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
    available:
      image.deletedAt === null && new Date(image.expiresAt).getTime() > now,
  }));
}

export function presentOrderLogs(logs: OrderStatusLog[]) {
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

export function presentOrderBase(
  order: Order & {
    items: Array<OrderItem & { images?: UploadFile[] }>;
    images: UploadFile[];
  },
) {
  const itemList = presentOrderItems(order.items);
  const fallbackImages = presentOrderImages(
    order.images.filter(
      (image) =>
        image.bizType === 'order_product_image' && image.orderItemId === null,
    ),
  );
  const paymentImages = presentOrderImages(
    order.images.filter((image) => image.bizType === 'order_payment_code_image'),
  );

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
    totalAmount: toCurrencyNumber(order.totalAmount),
    shippingFee: toCurrencyNumber(order.shippingFee),
    discountAmount: toCurrencyNumber(order.discountAmount),
    payableAmount: toCurrencyNumber(order.payableAmount),
    courierCompany: order.courierCompany,
    trackingNo: order.trackingNo,
    shippedAt: order.shippedAt,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    items: itemList,
    images: fallbackImages,
    paymentImages,
  };
}
