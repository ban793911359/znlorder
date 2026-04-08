import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import type { LoginResponse, UserInfo, UserRole } from '@/types/auth';
import { loadJSON, removeStorage, saveJSON } from '@/utils/storage';

const TOKEN_KEY = 'wechat-order-h5:token';
const USER_KEY = 'wechat-order-h5:user';

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string>(localStorage.getItem(TOKEN_KEY) || '');
  const user = ref<UserInfo | null>(loadJSON<UserInfo>(USER_KEY));

  const isLoggedIn = computed(() => Boolean(token.value && user.value));
  const role = computed<UserRole | ''>(() => user.value?.role || '');

  function setAuth(payload: LoginResponse) {
    token.value = payload.accessToken;
    user.value = payload.user;
    localStorage.setItem(TOKEN_KEY, payload.accessToken);
    saveJSON(USER_KEY, payload.user);
  }

  function clearAuth() {
    token.value = '';
    user.value = null;
    localStorage.removeItem(TOKEN_KEY);
    removeStorage(USER_KEY);
  }

  function getHomePath() {
    if (role.value === 'operator') {
      return '/operator/orders/create';
    }

    if (role.value === 'warehouse') {
      return '/warehouse/orders/pending';
    }

    return '/login';
  }

  return {
    token,
    user,
    role,
    isLoggedIn,
    setAuth,
    clearAuth,
    getHomePath,
  };
});
