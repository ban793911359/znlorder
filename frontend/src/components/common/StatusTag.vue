<template>
  <van-tag :type="tagType" round>{{ text }}</van-tag>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { ORDER_STATUS_TEXT } from '@/constants/order';
import type { OrderStatus } from '@/types/order';

const props = defineProps<{
  status: OrderStatus;
}>();

const text = computed(() => ORDER_STATUS_TEXT[props.status] || props.status);

const tagType = computed(() => {
  const map: Record<OrderStatus, 'primary' | 'success' | 'warning' | 'danger' | 'default'> = {
    draft: 'default',
    pending_shipment: 'warning',
    partial_shipped: 'primary',
    shipped: 'primary',
    completed: 'success',
    cancelled: 'danger',
  };

  return map[props.status];
});
</script>
