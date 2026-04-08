<template>
  <order-form
    v-model="form"
    v-model:customer-hint="customerHint"
    :submitting="submitting"
    submit-text="正式提交"
    @save-draft="saveDraft"
    @submit="submitOrder"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { showConfirmDialog, showSuccessToast } from 'vant';
import { createOrder } from '@/api/orders';
import OrderForm from '@/components/forms/OrderForm.vue';
import { DRAFT_STORAGE_KEY } from '@/constants/order';
import type { IdentifyCustomerResult } from '@/types/order';
import type { OrderFormModel } from '@/types/form';
import { buildCreatePayload, createEmptyFormModel } from '@/utils/order';
import { loadJSON, removeStorage, saveJSON } from '@/utils/storage';

const router = useRouter();
const submitting = ref(false);
const customerHint = ref<IdentifyCustomerResult | null>(null);
const form = ref<OrderFormModel>(
  loadJSON<OrderFormModel>(DRAFT_STORAGE_KEY) || createEmptyFormModel(),
);

function saveDraft() {
  saveJSON(DRAFT_STORAGE_KEY, form.value);
  showSuccessToast('草稿已保存到本地');
}

async function submitOrder() {
  submitting.value = true;
  try {
    const response = await createOrder(buildCreatePayload(form.value));
    removeStorage(DRAFT_STORAGE_KEY);
    const normalizedClientLink = buildClientLink(
      response.data.orderNo,
      response.data.clientToken,
      response.data.clientLink,
    );
    saveJSON(`wechat-order-h5:client-link:${response.data.orderId}`, {
      clientLink: normalizedClientLink,
      clientToken: response.data.clientToken,
      orderNo: response.data.orderNo,
    });

    const copied = await copyText(normalizedClientLink);
    await showConfirmDialog({
      title: '订单已提交',
      message:
        `订单号：${response.data.orderNo}\n` +
        `客户查看链接已生成。` +
        (copied
          ? '\n完整客户链接已自动复制，可直接发给客户。'
          : '\n本机已缓存完整客户链接，可在详情页点“复制客户链接”继续复制。'),
      confirmButtonText: '前往详情',
      showCancelButton: false,
    });
    showSuccessToast(copied ? '提交成功，客户链接已复制' : '提交成功');
    router.replace(`/operator/orders/${response.data.orderId}`);
  } finally {
    submitting.value = false;
  }
}

async function copyText(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);
    return copied;
  } catch {
    return false;
  }
}

function buildClientLink(orderNo: string, token: string, fallbackLink?: string) {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/client/orders/${orderNo}?token=${token}`;
  }

  return fallbackLink || `/client/orders/${orderNo}?token=${token}`;
}
</script>
