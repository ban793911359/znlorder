import type { CreateOrderPayload, OrderDetail, OrderItem } from '@/types/order';
import type { OrderFormModel, ProductFormItem } from '@/types/form';

export interface ParsedProductSpec {
  modelNo: string;
  color: string;
  size: string;
}

export interface ParsedOrderRemarks {
  customerRemark: string;
  internalRemark: string;
  warehouseRemark: string;
}

export interface ParsedReceiverAddress {
  receiverName: string;
  receiverMobile: string;
  receiverAddress: string;
}

export function createEmptyFormModel(): OrderFormModel {
  return {
    customerName: '',
    customerMobile: '',
    wechatNickname: '',
    receiverFullAddress: '',
    customerRemark: '',
    internalRemark: '',
    warehouseRemark: '',
    shippingFee: 0,
    discountAmount: 0,
    items: [
      {
        productName: '',
        modelNo: '',
        color: '',
        size: '',
        quantity: 1,
        unitPrice: 0,
        imageFileIds: [],
        imageList: [],
      },
    ],
  };
}

export function buildProductSpec(item: ProductFormItem) {
  return [`款号:${item.modelNo}`, `颜色:${item.color}`, `尺码:${item.size}`]
    .filter((part) => !part.endsWith(':'))
    .join(' | ');
}

export function parseReceiverFullAddress(
  receiverFullAddress: string,
  fallbackName = '',
  fallbackMobile = '',
): ParsedReceiverAddress {
  const raw = receiverFullAddress.trim();
  const normalized = raw
    .replace(/收货人|收件人|联系人|姓名/g, ' ')
    .replace(/联系电话|联系手机|手机号|手机|电话/g, ' ')
    .replace(/[：:,，;；|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const mobileMatch = normalized.match(/1\d{10}/);
  const receiverMobile = mobileMatch?.[0] || fallbackMobile;

  const beforeMobile = mobileMatch
    ? normalized.slice(0, mobileMatch.index).trim()
    : normalized;

  const receiverName =
    beforeMobile
      .split(' ')
      .map((item) => item.trim())
      .filter(Boolean)
      .find((item) => !/^\d+$/.test(item)) ||
    fallbackName ||
    '收件人待确认';

  return {
    receiverName,
    receiverMobile,
    receiverAddress: raw,
  };
}

export function parseProductSpec(productSpec?: string | null): ParsedProductSpec {
  const result: ParsedProductSpec = {
    modelNo: '',
    color: '',
    size: '',
  };

  if (!productSpec) {
    return result;
  }

  productSpec.split('|').forEach((part) => {
    const text = part.trim();
    if (text.startsWith('款号:')) {
      result.modelNo = text.replace('款号:', '').trim();
    }
    if (text.startsWith('颜色:')) {
      result.color = text.replace('颜色:', '').trim();
    }
    if (text.startsWith('尺码:')) {
      result.size = text.replace('尺码:', '').trim();
    }
  });

  return result;
}

export function serializeRemarks(input: ParsedOrderRemarks) {
  return [
    `【客户备注】${input.customerRemark || '--'}`,
    `【内部备注】${input.internalRemark || '--'}`,
    `【仓库备注】${input.warehouseRemark || '--'}`,
  ].join('\n');
}

export function parseRemarks(raw?: string | null): ParsedOrderRemarks {
  const result: ParsedOrderRemarks = {
    customerRemark: '',
    internalRemark: '',
    warehouseRemark: '',
  };

  if (!raw) {
    return result;
  }

  raw
    .replaceAll('\\n', '\n')
    .replaceAll('`n', '\n')
    .split('\n')
    .forEach((line) => {
    if (line.startsWith('【客户备注】')) {
      result.customerRemark = normalizeRemark(line.replace('【客户备注】', ''));
    }
    if (line.startsWith('【内部备注】')) {
      result.internalRemark = normalizeRemark(line.replace('【内部备注】', ''));
    }
    if (line.startsWith('【仓库备注】')) {
      result.warehouseRemark = normalizeRemark(line.replace('【仓库备注】', ''));
    }
    });

  return result;
}

function normalizeRemark(text: string) {
  const value = text.trim();
  return value === '--' ? '' : value;
}

export function computeLineAmount(item: ProductFormItem) {
  return Number(item.quantity) * Number(item.unitPrice);
}

export function computeTotalAmount(items: ProductFormItem[]) {
  return items.reduce((sum, item) => sum + computeLineAmount(item), 0);
}

export function computePayableAmount(
  totalAmount: number,
  shippingFee: number,
  discountAmount: number,
) {
  return totalAmount + shippingFee - discountAmount;
}

export function buildCreatePayload(form: OrderFormModel): CreateOrderPayload {
  const items: OrderItem[] = form.items.map((item) => ({
    productName: item.productName?.trim() || '',
    productSpec: buildProductSpec(item),
    quantity: Number(item.quantity),
    unitPrice: Number(item.unitPrice),
    lineAmount: computeLineAmount(item),
    remark: undefined,
    images: undefined,
    imageFileIds: item.imageFileIds,
  }));

  const totalAmount = computeTotalAmount(form.items);
  const parsedReceiver = parseReceiverFullAddress(
    form.receiverFullAddress,
    form.customerName,
    form.customerMobile,
  );

  return {
    customerName: form.customerName,
    customerMobile: form.customerMobile,
    wechatNickname: form.wechatNickname || undefined,
    receiverName: parsedReceiver.receiverName,
    receiverMobile: parsedReceiver.receiverMobile,
    receiverAddress: parsedReceiver.receiverAddress,
    items,
    totalAmount,
    shippingFee: Number(form.shippingFee || 0),
    discountAmount: Number(form.discountAmount || 0),
    payableAmount: computePayableAmount(
      totalAmount,
      Number(form.shippingFee || 0),
      Number(form.discountAmount || 0),
    ),
    operatorRemark: serializeRemarks({
      customerRemark: form.customerRemark,
      internalRemark: form.internalRemark,
      warehouseRemark: form.warehouseRemark,
    }),
  };
}

export function validateOrderFormForSubmit(form: OrderFormModel) {
  if (!form.customerName.trim()) {
    return '请输入客户备注名';
  }

  if (!/^1\d{10}$/.test(form.customerMobile.trim())) {
    return '请输入正确的客户手机号';
  }

  if (!form.receiverFullAddress.trim()) {
    return '请输入完整地址';
  }

  const invalidModelIndex = form.items.findIndex((item) => !item.modelNo.trim());
  if (invalidModelIndex >= 0) {
    return `商品 ${invalidModelIndex + 1} 款号必填`;
  }

  return null;
}

export function buildClientShareText(orderNo: string, clientLink: string) {
  return `订单号：${orderNo}\n查看订单：${clientLink}`;
}

export function buildFormFromOrderDetail(order: OrderDetail): OrderFormModel {
  const remarks = parseRemarks(order.operatorRemark);
  const hasItemImages = order.items.some((item) => (item.images || []).length > 0);
  const isActiveImage = (image: {
    deletedAt?: string | null;
    expiresAt?: string | null;
  }) =>
    !image.deletedAt &&
    (!image.expiresAt || new Date(image.expiresAt).getTime() > Date.now());

  return {
    customerName: order.customer?.name || '',
    customerMobile: order.customer?.mobile || '',
    wechatNickname: order.customer?.wechatNickname || '',
    receiverFullAddress:
      order.receiverFullAddress ||
      [order.receiverName, order.receiverMobile, order.receiverAddress]
        .filter(Boolean)
        .join(' '),
    customerRemark: remarks.customerRemark,
    internalRemark: remarks.internalRemark,
    warehouseRemark: remarks.warehouseRemark,
    shippingFee: order.shippingFee,
    discountAmount: order.discountAmount,
    items: order.items.map((item, index) => {
      const spec = parseProductSpec(item.productSpec);
      const itemImages =
        item.images && item.images.length > 0
          ? item.images.filter(isActiveImage)
          : !hasItemImages && index === 0
            ? order.images.filter(isActiveImage)
            : [];
      return {
        productName: item.productName || '',
        modelNo: spec.modelNo,
        color: spec.color,
        size: spec.size,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        imageFileIds: itemImages.map((image) => image.id),
        imageList: itemImages.map((image) => ({
          id: image.id,
          url: image.fileUrl,
          name: image.originalName,
        })),
      };
    }),
  };
}
