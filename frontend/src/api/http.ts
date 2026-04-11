import axios from 'axios';
import { showFailToast } from 'vant';
import router from '@/router';
import { useAuthStore } from '@/stores/auth';

declare module 'axios' {
  interface AxiosRequestConfig {
    silent?: boolean;
  }
}

const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL
    ? `${String(import.meta.env.VITE_API_BASE_URL).replace(/\/$/, '')}/api/v1`
    : '/api/v1',
  timeout: 15000,
});

http.interceptors.request.use((config) => {
  const authStore = useAuthStore();
  if (authStore.token) {
    config.headers.Authorization = `Bearer ${authStore.token}`;
  }
  return config;
});

http.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const authStore = useAuthStore();
    const message =
      error?.response?.data?.message ||
      error?.message ||
      '请求失败，请稍后重试';

    if (error?.response?.status === 401) {
      authStore.clearAuth();
      if (router.currentRoute.value.path !== '/login') {
        router.replace('/login');
      }
    }

    if (!error?.config?.silent) {
      showFailToast(Array.isArray(message) ? message[0] : message);
    }

    return Promise.reject(error);
  },
);

export default http;
