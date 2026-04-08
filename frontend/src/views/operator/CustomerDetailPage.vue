<template>
  <div class="page-content">
    <section-card title="客户基础信息">
      <template v-if="detail?.isExistingCustomer">
        <info-row label="客户备注名" :value="detail.customer?.name || '--'" />
        <info-row label="客户手机号" :value="detail.customer?.mobile || '--'" />
        <info-row label="微信昵称" :value="detail.customer?.wechatNickname || '--'" />
        <info-row
          label="最近收货资料"
          :value="detail.lastShippingInfo?.receiverFullAddress || detail.lastShippingInfo?.receiverAddress || '--'"
        />
      </template>
      <empty-state v-else description="未找到客户信息" />
    </section-card>

    <section-card title="历史订单">
      <div v-if="detail?.recentOrders?.length">
        <div
          v-for="order in detail.recentOrders"
          :key="order.id"
          class="history-card"
          @click="goDetail(order.id)"
        >
          <div class="history-card__header">
            <div>{{ ensureOrderNo(order.orderNo) }}</div>
            <status-tag :status="order.status" />
          </div>
          <div class="history-card__text">
            {{ order.receiverName }} / {{ order.receiverMobile }}
          </div>
          <div class="history-card__text">
            {{ order.receiverFullAddress || order.receiverAddress }}
          </div>
          <div class="history-card__text">
            {{ formatDateTime(order.createdAt) }} / {{ formatMoney(order.payableAmount) }}
          </div>
        </div>
      </div>
      <empty-state v-else description="暂无历史订单" />
    </section-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { identifyCustomer } from '@/api/customers';
import EmptyState from '@/components/common/EmptyState.vue';
import InfoRow from '@/components/common/InfoRow.vue';
import SectionCard from '@/components/common/SectionCard.vue';
import StatusTag from '@/components/common/StatusTag.vue';
import type { IdentifyCustomerResult } from '@/types/order';
import { ensureOrderNo, formatDateTime, formatMoney } from '@/utils/format';

const route = useRoute();
const router = useRouter();
const detail = ref<IdentifyCustomerResult | null>(null);

onMounted(async () => {
  const response = await identifyCustomer(String(route.params.mobile));
  detail.value = response.data;
});

function goDetail(orderId: number) {
  router.push(`/operator/orders/${orderId}`);
}
</script>
