<template>
  <div class="order-card" @click="$emit('click')">
    <div class="order-card__header">
      <div class="order-card__no">{{ ensureOrderNo(order.orderNo) }}</div>
      <status-tag :status="order.status" />
    </div>
    <div class="order-card__meta">
      <div>{{ order.customer?.name || order.receiverName }}</div>
      <div>{{ order.receiverMobile }}</div>
    </div>
    <div class="order-card__meta">
      <div>{{ order.items[0]?.productName || '未填写商品' }}</div>
      <div>{{ formatMoney(order.payableAmount) }}</div>
    </div>
    <div class="order-card__address">
      {{ order.receiverFullAddress || formatAddress([order.receiverProvince, order.receiverCity, order.receiverDistrict, order.receiverAddress]) }}
    </div>
    <div v-if="order.status === 'partial_shipped' || order.status === 'shipped'" class="order-card__footer">
      {{ order.courierCompany || '--' }} / {{ order.trackingNo || '--' }}
    </div>
    <div class="order-card__footer">{{ formatDateTime(order.createdAt) }}</div>
    <div v-if="order.shippedAt" class="order-card__footer">发货时间：{{ formatDateTime(order.shippedAt) }}</div>
  </div>
</template>

<script setup lang="ts">
import StatusTag from './StatusTag.vue';
import { formatAddress, formatDateTime, formatMoney, ensureOrderNo } from '@/utils/format';
import type { OrderSummary } from '@/types/order';

defineProps<{
  order: OrderSummary;
}>();

defineEmits<{
  click: [];
}>();
</script>
