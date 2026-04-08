<template>
  <div class="page-content">
    <section-card title="今日概览">
      <div class="stats-grid">
        <statistic-card label="今日订单总数" :value="stats.totalOrders" />
        <statistic-card label="今日成交总额" :value="formatMoney(stats.totalPayableAmount)" />
        <statistic-card label="待发货数量" :value="stats.pendingShipmentCount" />
        <statistic-card label="已发货数量" :value="stats.shippedCount" />
        <statistic-card label="已取消数量" :value="stats.cancelledCount" />
      </div>
    </section-card>

    <section-card title="筛选条件">
      <van-field
        v-model="keyword"
        label="搜索"
        placeholder="输入订单号、手机号、客户名或商品名"
      />
      <van-dropdown-menu>
        <van-dropdown-item v-model="status" :options="statusOptions" />
      </van-dropdown-menu>
      <div class="inline-actions">
        <van-button type="primary" block @click="reload">刷新今日订单</van-button>
      </div>
    </section-card>

    <section-card title="今日订单列表">
      <order-card
        v-for="order in list"
        :key="order.id"
        :order="order"
        @click="goDetail(order.id)"
      />
      <empty-state v-if="!list.length" description="今日暂无订单" />
    </section-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { getOrderList } from '@/api/orders';
import { getTodayStats, type TodayStats } from '@/api/stats';
import EmptyState from '@/components/common/EmptyState.vue';
import OrderCard from '@/components/common/OrderCard.vue';
import SectionCard from '@/components/common/SectionCard.vue';
import StatisticCard from '@/components/common/StatisticCard.vue';
import { ORDER_STATUS_OPTIONS } from '@/constants/order';
import type { OrderSummary, OrderStatus } from '@/types/order';
import { formatMoney } from '@/utils/format';

const router = useRouter();
const statusOptions = ORDER_STATUS_OPTIONS;
const keyword = ref('');
const status = ref<OrderStatus | ''>('');
const list = ref<OrderSummary[]>([]);
const stats = reactive<TodayStats>({
  totalOrders: 0,
  draftCount: 0,
  pendingShipmentCount: 0,
  shippedCount: 0,
  completedCount: 0,
  cancelledCount: 0,
  totalPayableAmount: 0,
});

onMounted(() => {
  reload();
});

async function reload() {
  const searchKey = keyword.value.trim();
  const [statsResponse, orderResponse] = await Promise.all([
    getTodayStats(),
    getOrderList({
      page: 1,
      pageSize: 50,
      todayOnly: true,
      status: status.value || undefined,
      keyword: searchKey || undefined,
    }),
  ]);

  Object.assign(stats, statsResponse.data);
  list.value = orderResponse.data.list;
}

function goDetail(id: number) {
  router.push(`/operator/orders/${id}`);
}
</script>
