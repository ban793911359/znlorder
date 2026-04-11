export interface ProductFormItem {
  productName: string;
  modelNo: string;
  color: string;
  size: string;
  quantity: number;
  unitPrice: number;
  imageFileIds: number[];
  imageList: Array<{
    id?: number;
    tempId?: string;
    url: string;
    name: string;
    status?: 'uploading' | 'done' | 'failed';
    message?: string;
    localUrl?: string;
    dataUrl?: string;
    originalSize?: number;
    compressedSize?: number;
  }>;
}

export type UploadPreviewItem = ProductFormItem['imageList'][number];

export interface OrderFormModel {
  customerName: string;
  customerMobile: string;
  wechatNickname: string;
  receiverFullAddress: string;
  customerRemark: string;
  internalRemark: string;
  warehouseRemark: string;
  shippingFee: number;
  discountAmount: number;
  paymentImageFileIds: number[];
  paymentImageList: UploadPreviewItem[];
  items: ProductFormItem[];
}
