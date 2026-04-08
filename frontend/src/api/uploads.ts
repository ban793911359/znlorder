import http from './http';
import type { ApiResponse } from '@/types/common';
import type { UploadedImage } from '@/types/order';

export function uploadImage(file: File) {
  const formData = new FormData();
  formData.append('file', file);

  return http.post<never, ApiResponse<UploadedImage>>('/uploads/images', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
}
