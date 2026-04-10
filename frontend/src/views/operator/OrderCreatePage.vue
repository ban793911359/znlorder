<template>
  <div class="create-order-page">
    <section-card title="云端草稿">
      <template #extra>
        <van-button size="small" plain type="primary" :loading="draftLoading" @click="loadDrafts">
          刷新
        </van-button>
      </template>

      <empty-state v-if="!drafts.length" description="暂无云端草稿，保存后可随时找回编辑" />
      <div v-else class="draft-list">
        <div v-for="draft in drafts" :key="draft.id" class="draft-card">
          <div class="draft-card__main">
            <div class="draft-card__title">{{ draft.title || '未命名草稿' }}</div>
            <div class="draft-card__time">更新时间：{{ formatDateTime(draft.updatedAt) }}</div>
          </div>
          <div class="draft-card__actions">
            <van-button size="small" type="primary" plain @click="loadDraft(draft)">
              载入
            </van-button>
            <van-button size="small" type="danger" plain @click="deleteDraft(draft)">
              删除
            </van-button>
          </div>
        </div>
      </div>
    </section-card>

    <order-form
      v-model="form"
      v-model:customer-hint="customerHint"
      :submitting="submitting"
      submit-text="正式提交"
      @save-draft="saveDraft"
      @submit="submitOrder"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { showConfirmDialog, showFailToast, showSuccessToast } from 'vant';
import {
  createOrder,
  deleteOrderDraft,
  getOrderDrafts,
  saveOrderDraft,
} from '@/api/orders';
import EmptyState from '@/components/common/EmptyState.vue';
import SectionCard from '@/components/common/SectionCard.vue';
import OrderForm from '@/components/forms/OrderForm.vue';
import { DRAFT_STORAGE_KEY } from '@/constants/order';
import type { IdentifyCustomerResult, OrderDraft } from '@/types/order';
import type { OrderFormModel } from '@/types/form';
import {
  buildClientShareText,
  buildCreatePayload,
  createEmptyFormModel,
  validateOrderFormForSubmit,
} from '@/utils/order';
import { formatDateTime } from '@/utils/format';
import { loadJSON, removeStorage, saveJSON } from '@/utils/storage';

const router = useRouter();
const submitting = ref(false);
const draftLoading = ref(false);
const customerHint = ref<IdentifyCustomerResult | null>(null);
const drafts = ref<OrderDraft[]>([]);
const currentDraftId = ref<number | null>(null);
const form = ref<OrderFormModel>(
  loadJSON<OrderFormModel>(DRAFT_STORAGE_KEY) || createEmptyFormModel(),
);

onMounted(() => {
  loadDrafts();
});

async function loadDrafts() {
  draftLoading.value = true;
  try {
    const response = await getOrderDrafts();
    drafts.value = response.data;
  } finally {
    draftLoading.value = false;
  }
}

async function saveDraft() {
  const response = await saveOrderDraft({
    id: currentDraftId.value ?? undefined,
    title: buildDraftTitle(form.value),
    payload: cloneForm(form.value),
  });

  currentDraftId.value = response.data.id;
  saveJSON(DRAFT_STORAGE_KEY, form.value);
  await loadDrafts();
  showSuccessToast('草稿已保存到云端');
}

function loadDraft(draft: OrderDraft) {
  form.value = normalizeDraftPayload(draft.payload);
  currentDraftId.value = draft.id;
  customerHint.value = null;
  saveJSON(DRAFT_STORAGE_KEY, form.value);
  showSuccessToast('云端草稿已载入');
}

async function deleteDraft(draft: OrderDraft) {
  try {
    await showConfirmDialog({
      title: '删除草稿',
      message: `确认删除「${draft.title || '未命名草稿'}」吗？`,
      confirmButtonText: '确认删除',
    });
  } catch {
    return;
  }

  await deleteOrderDraft(draft.id);
  if (currentDraftId.value === draft.id) {
    currentDraftId.value = null;
  }
  await loadDrafts();
  showSuccessToast('草稿已删除');
}

async function submitOrder() {
  const validationMessage = validateOrderFormForSubmit(form.value);
  if (validationMessage) {
    showFailToast(validationMessage);
    return;
  }

  submitting.value = true;
  try {
    const response = await createOrder(buildCreatePayload(form.value));
    if (currentDraftId.value) {
      await deleteOrderDraft(currentDraftId.value);
      currentDraftId.value = null;
      await loadDrafts();
    }
    removeStorage(DRAFT_STORAGE_KEY);
    const normalizedClientLink = buildClientLink(
      response.data.orderNo,
      response.data.clientToken,
      response.data.clientLink,
    );
    const shareText = buildClientShareText(response.data.orderNo, normalizedClientLink);
    saveJSON(`wechat-order-h5:client-link:${response.data.orderId}`, {
      clientLink: normalizedClientLink,
      clientToken: response.data.clientToken,
      orderNo: response.data.orderNo,
    });

    const copied = await copyText(shareText);
    await showConfirmDialog({
      title: '订单已提交',
      message:
        `订单号：${response.data.orderNo}\n` +
        `客户分享文案已生成。` +
        (copied
          ? '\n已自动复制“订单号 + 查看链接”，可直接发给客户。'
          : '\n本机已缓存完整客户链接，可在详情页点“复制客户分享文案”继续复制。'),
      confirmButtonText: '前往详情',
      showCancelButton: false,
    });
    showSuccessToast(copied ? '提交成功，客户分享文案已复制' : '提交成功');
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

function buildDraftTitle(value: OrderFormModel) {
  const customer = value.customerName.trim() || '未填客户';
  const modelNo =
    value.items.map((item) => item.modelNo.trim()).find(Boolean) || '未填款号';
  return `${customer} / ${modelNo}`;
}

function cloneForm(value: OrderFormModel) {
  return JSON.parse(JSON.stringify(value)) as OrderFormModel;
}

function normalizeDraftPayload(payload: unknown): OrderFormModel {
  const base = createEmptyFormModel();
  const parsed =
    payload && typeof payload === 'object'
      ? (payload as Partial<OrderFormModel>)
      : {};

  return {
    ...base,
    ...parsed,
    items:
      Array.isArray(parsed.items) && parsed.items.length > 0
        ? parsed.items.map((item) => ({
            ...base.items[0],
            ...item,
            imageFileIds: Array.isArray(item.imageFileIds)
              ? item.imageFileIds
              : [],
            imageList: Array.isArray(item.imageList) ? item.imageList : [],
          }))
        : base.items,
  };
}
</script>

<style scoped>
.create-order-page {
  padding: 12px 0 88px;
}

.draft-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.draft-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  border-radius: 12px;
  background: #f8fafc;
}

.draft-card__main {
  min-width: 0;
}

.draft-card__title {
  font-weight: 600;
  color: #1f2937;
}

.draft-card__time {
  margin-top: 4px;
  color: #6b7280;
  font-size: 12px;
}

.draft-card__actions {
  display: flex;
  flex-shrink: 0;
  gap: 8px;
}
</style>
