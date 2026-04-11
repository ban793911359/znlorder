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
      :show-default-payment-actions="true"
      :has-default-payment-images="defaultPaymentImages.length > 0"
      submit-text="正式提交"
      @save-default-payment-images="saveDefaultPaymentImages"
      @apply-default-payment-images="applyDefaultPaymentImages"
      @clear-default-payment-images="clearDefaultPaymentImages"
      @save-draft="saveDraft"
      @submit="submitOrder"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { showConfirmDialog, showFailToast, showSuccessToast } from 'vant';
import { uploadImage } from '@/api/uploads';
import {
  createOrder,
  deleteOrderDraft,
  getOrderDrafts,
  saveOrderDraft,
} from '@/api/orders';
import EmptyState from '@/components/common/EmptyState.vue';
import SectionCard from '@/components/common/SectionCard.vue';
import OrderForm from '@/components/forms/OrderForm.vue';
import { DRAFT_STORAGE_KEY, getDefaultPaymentImagesStorageKey } from '@/constants/order';
import { useAuthStore } from '@/stores/auth';
import type { IdentifyCustomerResult, OrderDraft } from '@/types/order';
import type { OrderFormModel, UploadPreviewItem } from '@/types/form';
import {
  buildClientShareText,
  buildCreatePayload,
  createEmptyFormModel,
  validateOrderFormForSubmit,
} from '@/utils/order';
import { formatDateTime } from '@/utils/format';
import { loadJSON, removeStorage, saveJSON } from '@/utils/storage';

const router = useRouter();
const authStore = useAuthStore();
const submitting = ref(false);
const draftLoading = ref(false);
const customerHint = ref<IdentifyCustomerResult | null>(null);
const drafts = ref<OrderDraft[]>([]);
const currentDraftId = ref<number | null>(null);
const defaultPaymentImages = ref<UploadPreviewItem[]>(loadDefaultPaymentImages());
const form = ref<OrderFormModel>(
  withDefaultPaymentImages(
    loadJSON<OrderFormModel>(DRAFT_STORAGE_KEY) || createEmptyFormModel(),
  ),
);

onMounted(() => {
  loadDrafts();
});

async function loadDrafts() {
  draftLoading.value = true;
  try {
    const response = await getOrderDrafts();
    drafts.value = response.data;
  } catch {
    drafts.value = [];
  } finally {
    draftLoading.value = false;
  }
}

async function saveDraft() {
  saveJSON(DRAFT_STORAGE_KEY, form.value);

  try {
    const response = await saveOrderDraft({
      id: currentDraftId.value ?? undefined,
      title: buildDraftTitle(form.value),
      payload: cloneForm(form.value),
    });

    currentDraftId.value = response.data.id;
    await loadDrafts();
    showSuccessToast('草稿已保存到云端');
  } catch {
    showFailToast('云端草稿暂不可用，已先保存到本地');
  }
}

function loadDraft(draft: OrderDraft) {
  form.value = withDefaultPaymentImages(normalizeDraftPayload(draft.payload));
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

  try {
    await deleteOrderDraft(draft.id);
    if (currentDraftId.value === draft.id) {
      currentDraftId.value = null;
    }
    await loadDrafts();
    showSuccessToast('草稿已删除');
  } catch {
    showFailToast('云端草稿删除失败，请稍后重试');
  }
}

async function submitOrder() {
  const validationMessage = validateOrderFormForSubmit(form.value);
  if (validationMessage) {
    showFailToast(validationMessage);
    return;
  }

  submitting.value = true;
  try {
    await ensurePaymentImagesUploaded();
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

function saveDefaultPaymentImages() {
  const serializableImages = form.value.paymentImageList
    .map((item) => ({
      name: item.name,
      url: item.dataUrl || (item.url.startsWith('data:') ? item.url : ''),
      dataUrl: item.dataUrl || (item.url.startsWith('data:') ? item.url : ''),
      status: 'done' as const,
      message: '默认收款码',
    }))
    .filter((item) => item.dataUrl);

  if (!serializableImages.length) {
    showFailToast('请先上传收款码，再设置默认');
    return;
  }

  defaultPaymentImages.value = serializableImages;
  saveJSON(getDefaultPaymentImagesStorageKey(authStore.user?.id), serializableImages);
  showSuccessToast('默认收款码已保存，下次新建订单会自动带出');
}

function applyDefaultPaymentImages() {
  if (!defaultPaymentImages.value.length) {
    showFailToast('当前没有默认收款码');
    return;
  }

  form.value.paymentImageList = cloneUploadPreviewList(defaultPaymentImages.value);
  form.value.paymentImageFileIds = [];
  saveJSON(DRAFT_STORAGE_KEY, form.value);
  showSuccessToast('已恢复默认收款码');
}

function clearDefaultPaymentImages() {
  defaultPaymentImages.value = [];
  removeStorage(getDefaultPaymentImagesStorageKey(authStore.user?.id));
  showSuccessToast('默认收款码已清除');
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
    paymentImageFileIds: Array.isArray(parsed.paymentImageFileIds)
      ? parsed.paymentImageFileIds
      : [],
    paymentImageList: Array.isArray(parsed.paymentImageList)
      ? parsed.paymentImageList
      : [],
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

function loadDefaultPaymentImages() {
  return (
    loadJSON<UploadPreviewItem[]>(
      getDefaultPaymentImagesStorageKey(authStore.user?.id),
    ) || []
  ).map((item) => ({
    ...item,
    id: undefined,
    tempId: undefined,
    status: 'done' as const,
    message: item.message || '默认收款码',
  }));
}

function withDefaultPaymentImages(value: OrderFormModel) {
  if (value.paymentImageList.length > 0 || defaultPaymentImages.value.length === 0) {
    return value;
  }

  return {
    ...value,
    paymentImageFileIds: [],
    paymentImageList: cloneUploadPreviewList(defaultPaymentImages.value),
  };
}

function cloneUploadPreviewList(value: UploadPreviewItem[]) {
  return value.map((item) => ({
    ...item,
    id: undefined,
    tempId: undefined,
    localUrl: undefined,
    status: 'done' as const,
    message: item.message || '默认收款码',
  }));
}

async function ensurePaymentImagesUploaded() {
  const nextList: UploadPreviewItem[] = [];

  for (const item of form.value.paymentImageList) {
    if (typeof item.id === 'number') {
      nextList.push(item);
      continue;
    }

    const dataUrl = item.dataUrl || (item.url.startsWith('data:') ? item.url : '');
    if (!dataUrl) {
      throw new Error('默认收款码缺少可上传数据，请重新上传后再提交');
    }

    const file = await dataUrlToFile(dataUrl, item.name || 'payment-code.jpg');
    const response = await uploadImage(file, 'order_payment_code_image');
    nextList.push({
      ...item,
      id: response.data.id,
      url: response.data.fileUrl,
      dataUrl,
      status: 'done' as const,
      message: '已作为默认收款码自动带出',
    });
  }

  form.value.paymentImageList = nextList;
  form.value.paymentImageFileIds = nextList
    .map((item) => item.id)
    .filter((item): item is number => typeof item === 'number');
}

async function dataUrlToFile(dataUrl: string, fileName: string) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return new File([blob], fileName, { type: blob.type || 'image/jpeg' });
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
