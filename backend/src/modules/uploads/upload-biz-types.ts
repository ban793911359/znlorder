export const ORDER_PRODUCT_IMAGE_BIZ_TYPE = 'order_product_image';
export const ORDER_PAYMENT_CODE_IMAGE_BIZ_TYPE = 'order_payment_code_image';

export const UPLOAD_BIZ_TYPES = [
  ORDER_PRODUCT_IMAGE_BIZ_TYPE,
  ORDER_PAYMENT_CODE_IMAGE_BIZ_TYPE,
] as const;

export type UploadImageBizType = (typeof UPLOAD_BIZ_TYPES)[number];

export function isUploadImageBizType(value: string): value is UploadImageBizType {
  return UPLOAD_BIZ_TYPES.includes(value as UploadImageBizType);
}
