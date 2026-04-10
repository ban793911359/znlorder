import http from './http';
import type { ApiResponse } from '@/types/common';
import type { UploadedImage } from '@/types/order';

export function uploadImage(
  file: File,
  bizType: 'order_product_image' | 'order_payment_code_image' = 'order_product_image',
) {
  const formData = new FormData();
  formData.append('file', file);

  return http.post<never, ApiResponse<UploadedImage>>('/uploads/images', formData, {
    params: { bizType },
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
}
