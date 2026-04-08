<template>
  <div class="app-shell">
    <header class="topbar">
      <div>
        <div class="topbar__title">{{ title }}</div>
        <div class="topbar__subtitle">{{ authStore.user?.displayName }}</div>
      </div>
      <van-button size="small" plain type="primary" @click="logout">退出</van-button>
    </header>

    <main class="page-main">
      <router-view />
    </main>

    <van-tabbar route safe-area-inset-bottom>
      <template v-if="authStore.role === 'operator'">
        <van-tabbar-item replace to="/operator/orders/create">
          录单
        </van-tabbar-item>
        <van-tabbar-item replace to="/operator/orders">
          订单
        </van-tabbar-item>
        <van-tabbar-item replace to="/operator/today-orders">
          今日
        </van-tabbar-item>
      </template>
      <template v-else>
        <van-tabbar-item replace to="/warehouse/orders/pending">
          待发货
        </van-tabbar-item>
      </template>
    </van-tabbar>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { showSuccessToast } from 'vant';
import { useAuthStore } from '@/stores/auth';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const title = computed(() => String(route.meta.title || '微信录单 H5'));

function logout() {
  authStore.clearAuth();
  showSuccessToast('已退出登录');
  router.replace('/login');
}
</script>
