<template>
  <div class="page-content">
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
        <van-button type="primary" block @click="reload">查询</van-button>
      </div>
    </section-card>

    <section-card title="全部订单" :extra="`共 ${pagination.total} 条`">
      <div v-if="list.length">
        <order-card
          v-for="order in filteredList"
          :key="order.id"
          :order="order"
          @click="goDetail(order.id)"
        />
      </div>
      <empty-state v-else description="暂无订单" />
      <div v-if="hasMore" class="load-more-wrap">
        <van-button plain block @click="loadMore">加载更多</van-button>
      </div>
    </section-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import EmptyState from '@/components/common/EmptyState.vue';
import OrderCard from '@/components/common/OrderCard.vue';
import SectionCard from '@/components/common/SectionCard.vue';
import { ORDER_STATUS_OPTIONS } from '@/constants/order';
import { getOrderList } from '@/api/orders';
import type { OrderSummary, OrderStatus } from '@/types/order';

const router = useRouter();

const list = ref<OrderSummary[]>([]);
const keyword = ref('');
const status = ref<OrderStatus | ''>('');
const loading = ref(false);
const pagination = reactive({
  page: 1,
  pageSize: 10,
  total: 0,
});

const statusOptions = ORDER_STATUS_OPTIONS;

const hasMore = computed(() => list.value.length < pagination.total);
const filteredList = computed(() => {
  return list.value;
});

onMounted(() => {
  reload();
});

async function fetchOrders(append = false) {
  loading.value = true;
  try {
    const searchKey = keyword.value.trim();
    const response = await getOrderList({
      page: pagination.page,
      pageSize: pagination.pageSize,
      status: status.value || undefined,
      keyword: searchKey || undefined,
    });

    pagination.total = response.data.pagination.total;
    if (append) {
      list.value = [...list.value, ...response.data.list];
    } else {
      list.value = response.data.list;
    }
  } finally {
    loading.value = false;
  }
}

function reload() {
  pagination.page = 1;
  fetchOrders(false);
}

function loadMore() {
  if (loading.value || !hasMore.value) {
    return;
  }

  pagination.page += 1;
  fetchOrders(true);
}

function goDetail(id: number) {
  router.push(`/operator/orders/${id}`);
}
</script>
