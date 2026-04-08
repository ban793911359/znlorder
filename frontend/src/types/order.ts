export type OrderStatus =
  | 'draft'
  | 'pending_shipment'
  | 'shipped'
  | 'completed'
  | 'cancelled';

export interface UploadedImage {
  id: number;
  fileName: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  fileUrl: string;
  expiresAt?: string | null;
  deletedAt?: string | null;
  available?: boolean;
}

export interface OrderItem {
  id?: number;
  productName: string;
  productSpec?: string | null;
  quantity: number;
  unitPrice: number;
  lineAmount: number;
  remark?: string | null;
  imageFileIds?: number[];
  images?: UploadedImage[];
}

export interface CustomerSummary {
  id: number;
  name: string;
  mobile: string;
  wechatNickname?: string | null;
  note?: string | null;
  lastOrderAt?: string | null;
}

export interface OrderSummary {
  id: number;
  orderNo: string;
  status: OrderStatus;
  receiverName: string;
  receiverMobile: string;
  receiverFullAddress?: string;
  receiverProvince?: string | null;
  receiverCity?: string | null;
  receiverDistrict?: string | null;
  receiverAddress: string;
  totalAmount: number;
  shippingFee: number;
  discountAmount: number;
  payableAmount: number;
  courierCompany?: string | null;
  trackingNo?: string | null;
  shippedAt?: string | null;
  createdAt: string;
  updatedAt?: string;
  items: OrderItem[];
  images: UploadedImage[];
  warehouseRemark?: string | null;
  customer?: CustomerSummary;
  createdBy?: {
    id: number;
    username: string;
    displayName: string;
    role: string;
  };
}

export interface OrderDetail extends OrderSummary {
  operatorRemark?: string | null;
  warehouseRemark?: string | null;
  clientLinkPath?: string;
  logs?: Array<{
    id: number;
    fromStatus?: OrderStatus | null;
    toStatus: OrderStatus;
    action: string;
    operatorId?: number | null;
    note?: string | null;
    createdAt: string;
  }>;
}

export interface CreateOrderPayload {
  customerName: string;
  customerMobile: string;
  wechatNickname?: string;
  receiverName?: string;
  receiverMobile?: string;
  receiverFullAddress?: string;
  receiverProvince?: string;
  receiverCity?: string;
  receiverDistrict?: string;
  receiverAddress: string;
  items: OrderItem[];
  totalAmount: number;
  shippingFee: number;
  discountAmount: number;
  payableAmount: number;
  operatorRemark?: string;
}

export type UpdateOrderPayload = Partial<CreateOrderPayload>;

export interface CreateOrderResponse {
  orderId: number;
  orderNo: string;
  status: OrderStatus;
  clientToken: string;
  clientLinkPath: string;
  clientLink: string;
}

export interface IdentifyCustomerResult {
  isExistingCustomer: boolean;
  customer: CustomerSummary | null;
  lastShippingInfo: {
    receiverName?: string | null;
    receiverMobile?: string | null;
    receiverFullAddress?: string | null;
    receiverProvince?: string | null;
    receiverCity?: string | null;
    receiverDistrict?: string | null;
    receiverAddress?: string | null;
  } | null;
  recentOrders: Array<{
    id: number;
    orderNo: string;
    status: OrderStatus;
    receiverName: string;
    receiverMobile: string;
    receiverFullAddress?: string | null;
    receiverProvince?: string | null;
    receiverCity?: string | null;
    receiverDistrict?: string | null;
    receiverAddress: string;
    payableAmount: number;
    createdAt: string;
  }>;
}
