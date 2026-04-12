import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import type { LoginResponse, UserInfo, UserRole } from '@/types/auth';
import { loadJSON, removeStorage, saveJSON } from '@/utils/storage';

const TOKEN_KEY = 'wechat-order-h5:token';
const USER_KEY = 'wechat-order-h5:user';
const SUPER_ADMIN_PORTAL_KEY = 'wechat-order-h5:super-admin-portal';
type PortalRole = 'operator' | 'warehouse';

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string>(localStorage.getItem(TOKEN_KEY) || '');
  const user = ref<UserInfo | null>(loadJSON<UserInfo>(USER_KEY));
  const activePortal = ref<PortalRole>(
    localStorage.getItem(SUPER_ADMIN_PORTAL_KEY) === 'warehouse'
      ? 'warehouse'
      : 'operator',
  );

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
    activePortal.value = 'operator';
    localStorage.removeItem(TOKEN_KEY);
    removeStorage(USER_KEY);
    removeStorage(SUPER_ADMIN_PORTAL_KEY);
  }

  function setActivePortal(portal: PortalRole) {
    activePortal.value = portal;
    localStorage.setItem(SUPER_ADMIN_PORTAL_KEY, portal);
  }

  function canAccessRole(requiredRole: string) {
    if (role.value === 'super_admin') {
      return requiredRole === 'operator' || requiredRole === 'warehouse';
    }

    return role.value === requiredRole;
  }

  function getHomePath(portalOverride?: PortalRole) {
    const targetPortal = portalOverride ?? activePortal.value;

    if (role.value === 'operator') {
      return '/operator/orders/create';
    }

    if (role.value === 'warehouse') {
      return '/warehouse/orders/pending';
    }

    if (role.value === 'super_admin') {
      return targetPortal === 'warehouse'
        ? '/warehouse/orders/pending'
        : '/operator/orders/create';
    }

    return '/login';
  }

  return {
    token,
    user,
    role,
    activePortal,
    isLoggedIn,
    setAuth,
    clearAuth,
    setActivePortal,
    canAccessRole,
    getHomePath,
  };
});
