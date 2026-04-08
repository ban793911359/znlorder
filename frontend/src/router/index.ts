import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { showToast } from 'vant';
import { useAuthStore } from '@/stores/auth';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/login',
  },
  {
    path: '/login',
    name: 'login',
    meta: { public: true, title: '登录' },
    component: () => import('@/views/LoginPage.vue'),
  },
  {
    path: '/operator',
    component: () => import('@/layouts/InternalLayout.vue'),
    meta: { requiresAuth: true, role: 'operator' },
    children: [
      {
        path: 'orders/create',
        name: 'operator-order-create',
        meta: { title: '新建订单' },
        component: () => import('@/views/operator/OrderCreatePage.vue'),
      },
      {
        path: 'orders',
        name: 'operator-order-list',
        meta: { title: '订单列表' },
        component: () => import('@/views/operator/OrderListPage.vue'),
      },
      {
        path: 'orders/:id',
        name: 'operator-order-detail',
        meta: { title: '订单详情' },
        component: () => import('@/views/operator/OrderDetailPage.vue'),
      },
      {
        path: 'today-orders',
        name: 'operator-today-orders',
        meta: { title: '今日订单后台表' },
        component: () => import('@/views/operator/TodayOrdersPage.vue'),
      },
      {
        path: 'customers/:mobile',
        name: 'operator-customer-detail',
        meta: { title: '客户详情' },
        component: () => import('@/views/operator/CustomerDetailPage.vue'),
      },
    ],
  },
  {
    path: '/warehouse',
    component: () => import('@/layouts/InternalLayout.vue'),
    meta: { requiresAuth: true, role: 'warehouse' },
    children: [
      {
        path: 'orders/pending',
        name: 'warehouse-order-list',
        meta: { title: '待发货订单' },
        component: () => import('@/views/warehouse/PendingOrdersPage.vue'),
      },
      {
        path: 'orders/:id/ship',
        name: 'warehouse-ship',
        meta: { title: '确认发货' },
        component: () => import('@/views/warehouse/ShipOrderPage.vue'),
      },
    ],
  },
  {
    path: '/client/orders/:orderNo',
    name: 'client-order-detail',
    meta: { public: true, title: '订单查看' },
    component: () => import('@/views/client/ClientOrderDetailPage.vue'),
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to) => {
  document.title = `${String(to.meta.title || '微信录单 H5')}`;

  if (to.meta.public) {
    return true;
  }

  const authStore = useAuthStore();
  if (!authStore.isLoggedIn) {
    return '/login';
  }

  const requiredRole = to.meta.role as string | undefined;
  if (requiredRole && authStore.role !== requiredRole) {
    showToast('当前账号无权访问该页面');
    return authStore.getHomePath();
  }

  return true;
});

export default router;
