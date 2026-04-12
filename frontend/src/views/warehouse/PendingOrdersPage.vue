<template>
  <div class="page-content">
    <section-card title="订单状态">
      <van-tabs v-model:active="activeStatus" @change="handleStatusChange">
        <van-tab title="待发货" name="pending_shipment" />
        <van-tab title="部分发货" name="partial_shipped" />
        <van-tab title="已发货" name="shipped" />
      </van-tabs>
    </section-card>

    <section-card title="筛选">
      <van-field
        v-model="keyword"
        label="搜索"
        placeholder="输入订单号、手机号、客户名或商品名"
      />
      <div class="inline-actions">
        <van-button type="primary" block @click="reload">查询</van-button>
      </div>
    </section-card>

    <section-card :title="pageTitle" :extra="`共 ${pagination.total} 条`">
      <order-card
        v-for="order in list"
        :key="order.id"
        :order="order"
        @click="goShip(order)"
      />
      <empty-state v-if="!list.length" :description="emptyText" />
      <div v-if="hasMore" class="load-more-wrap">
        <van-button plain block @click="loadMore">加载更多</van-button>
      </div>
    </section-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { getWarehouseOrders } from '@/api/orders';
import EmptyState from '@/components/common/EmptyState.vue';
import OrderCard from '@/components/common/OrderCard.vue';
import SectionCard from '@/components/common/SectionCard.vue';
import type { OrderSummary } from '@/types/order';
import { saveJSON } from '@/utils/storage';

const router = useRouter();
const keyword = ref('');
const activeStatus = ref<'pending_shipment' | 'partial_shipped' | 'shipped'>('pending_shipment');
const list = ref<OrderSummary[]>([]);
const pagination = reactive({
  page: 1,
  pageSize: 10,
  total: 0,
});

const hasMore = computed(() => list.value.length < pagination.total);
const pageTitle = computed(() =>
  activeStatus.value === 'pending_shipment'
    ? '待发货订单'
    : activeStatus.value === 'partial_shipped'
      ? '部分发货订单'
      : '已发货订单',
);
const emptyText = computed(() =>
  activeStatus.value === 'pending_shipment'
    ? '暂无待发货订单'
    : activeStatus.value === 'partial_shipped'
      ? '暂无部分发货订单'
      : '暂无已发货订单',
);

onMounted(() => {
  reload();
});

async function fetchList(append = false) {
  const response = await getWarehouseOrders({
    page: pagination.page,
    pageSize: pagination.pageSize,
    status: activeStatus.value,
    keyword: keyword.value.trim() || undefined,
  });

  pagination.total = response.data.pagination.total;
  if (append) {
    list.value = [...list.value, ...response.data.list];
  } else {
    list.value = response.data.list;
  }
}

function reload() {
  pagination.page = 1;
  fetchList(false);
}

function handleStatusChange() {
  reload();
}

function loadMore() {
  pagination.page += 1;
  fetchList(true);
}

function goShip(order: OrderSummary) {
  saveJSON(`wechat-order-h5:warehouse-order:${order.id}`, order);
  router.push(`/warehouse/orders/${order.id}/ship`);
}
</script>
