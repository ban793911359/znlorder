<template>
  <div class="page-content" v-if="detail">
    <section-card title="订单头信息">
      <info-row label="订单号" :value="ensureOrderNo(detail.orderNo)" />
      <info-row label="订单状态">
        <status-tag :status="detail.status" />
      </info-row>
      <info-row label="创建时间" :value="formatDateTime(detail.createdAt)" />
      <info-row label="客户姓名" :value="detail.customer?.name" />
      <info-row label="客户手机" :value="detail.customer?.mobile" />
      <info-row label="客户查看链接" :value="clientLinkText" />
      <div class="inline-actions">
        <van-button
          plain
          type="success"
          size="small"
          :disabled="!savedClientLink?.clientLink"
          @click="copyClientLink"
        >
          复制客户分享文案
        </van-button>
        <van-button plain type="primary" size="small" @click="toCustomerPage">
          查看客户详情
        </van-button>
        <van-button plain type="warning" size="small" @click="editing = true">
          编辑订单
        </van-button>
        <van-button
          plain
          type="danger"
          size="small"
          :disabled="!canCancel"
          @click="cancelCurrentOrder"
        >
          作废订单
        </van-button>
      </div>
    </section-card>

    <section-card title="商品明细">
      <div v-for="item in detail.items" :key="item.id" class="detail-block">
        <div class="detail-block__title">{{ item.productName || item.productSpec || '未填写商品名称' }}</div>
        <div v-if="item.images?.length" class="image-grid order-item-image-grid">
          <template v-for="image in item.images" :key="image.id">
            <img
              v-if="isImageAvailable(image)"
              :src="resolveMediaUrl(image.fileUrl)"
              class="image-grid__item"
              alt="商品图"
            />
            <div v-else class="image-expired-card">
              <div class="image-expired-card__title">图片已过期</div>
              <div class="image-expired-card__desc">订单数据仍保留</div>
            </div>
          </template>
        </div>
        <empty-state v-else description="该商品暂无图片" />
        <div class="detail-block__desc">{{ item.productSpec || '--' }}</div>
        <div class="detail-block__desc">
          数量：{{ item.quantity }} / 单价：{{ formatMoney(item.unitPrice) }} / 小计：{{ formatMoney(item.lineAmount) }}
        </div>
      </div>
    </section-card>

    <section-card title="收货与金额">
      <info-row label="完整地址" :value="receiverFullAddressText" />
      <info-row label="商品总额" :value="formatMoney(detail.totalAmount)" />
      <info-row label="邮费" :value="formatMoney(detail.shippingFee)" />
      <info-row label="优惠金额" :value="formatMoney(detail.discountAmount)" />
      <info-row label="实收金额" :value="formatMoney(detail.payableAmount)" />
    </section-card>

    <section-card title="备注与物流">
      <info-row label="客户备注" :value="remarks.customerRemark || '--'" />
      <info-row label="内部备注" :value="remarks.internalRemark || '--'" />
      <info-row label="仓库备注" :value="remarks.warehouseRemark || detail.warehouseRemark || '--'" />
      <info-row label="快递公司" :value="detail.courierCompany || '--'" />
      <info-row label="运单号" :value="detail.trackingNo || '--'" />
      <info-row label="发货时间" :value="formatDateTime(detail.shippedAt)" />
    </section-card>

    <section-card title="状态日志">
      <div v-for="log in detail.logs || []" :key="log.id" class="timeline-row">
        <div class="timeline-row__time">{{ formatDateTime(log.createdAt) }}</div>
        <div class="timeline-row__text">{{ log.action }} / {{ log.note || '--' }}</div>
      </div>
      <empty-state v-if="!detail.logs?.length" description="暂无日志" />
    </section-card>

    <van-popup v-model:show="editing" position="bottom" round :style="{ height: '92%' }">
      <div class="popup-page">
        <div class="popup-page__title">编辑订单</div>
        <order-form
          v-if="editForm"
          v-model="editForm"
          v-model:customer-hint="customerHint"
          :submitting="saving"
          submit-text="保存修改"
          @save-draft="saveEditDraft"
          @submit="submitEdit"
        />
      </div>
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { showConfirmDialog, showFailToast, showSuccessToast } from 'vant';
import { cancelOrder, getOrderDetail, updateOrder } from '@/api/orders';
import EmptyState from '@/components/common/EmptyState.vue';
import InfoRow from '@/components/common/InfoRow.vue';
import SectionCard from '@/components/common/SectionCard.vue';
import StatusTag from '@/components/common/StatusTag.vue';
import OrderForm from '@/components/forms/OrderForm.vue';
import type { IdentifyCustomerResult, OrderDetail } from '@/types/order';
import type { OrderFormModel } from '@/types/form';
import {
  formatDateTime,
  formatMoney,
  ensureOrderNo,
  formatReceiverFullAddress,
  isImageAvailable,
  resolveMediaUrl,
} from '@/utils/format';
import {
  buildClientShareText,
  buildCreatePayload,
  buildFormFromOrderDetail,
  parseRemarks,
  validateOrderFormForSubmit,
} from '@/utils/order';
import { loadJSON, saveJSON } from '@/utils/storage';

const route = useRoute();
const router = useRouter();

const detail = ref<OrderDetail | null>(null);
const editing = ref(false);
const saving = ref(false);
const customerHint = ref<IdentifyCustomerResult | null>(null);
const editForm = ref<OrderFormModel | null>(null);
const savedClientLink = ref<{ clientLink: string; clientToken: string; orderNo: string } | null>(null);

const remarks = computed(() => parseRemarks(detail.value?.operatorRemark));
const canCancel = computed(() =>
  detail.value?.status === 'draft' || detail.value?.status === 'pending_shipment',
);
const clientLinkText = computed(() => {
  const normalized = getNormalizedClientLink();
  if (normalized) {
    return `订单号：${detail.value?.orderNo || savedClientLink.value?.orderNo}`;
  }

  if (detail.value?.clientLinkPath) {
    return '完整链接仅在创建该订单的设备缓存；当前可确认本单已生成独立访问路径';
  }

  return '当前无可展示的客户链接';
});
const receiverFullAddressText = computed(() =>
  detail.value
    ? formatReceiverFullAddress(detail.value)
    : '--',
);

onMounted(() => {
  loadDetail();
});

async function loadDetail() {
  const response = await getOrderDetail(Number(route.params.id));
  detail.value = response.data;
  editForm.value = buildFormFromOrderDetail(response.data);
  savedClientLink.value = loadJSON(`wechat-order-h5:client-link:${route.params.id}`);
}

function toCustomerPage() {
  if (!detail.value?.customer?.mobile) {
    showFailToast('缺少客户手机号');
    return;
  }
  router.push(`/operator/customers/${detail.value.customer.mobile}`);
}

async function cancelCurrentOrder() {
  if (!detail.value || !canCancel.value) {
    showFailToast('当前订单状态不支持作废');
    return;
  }

  try {
    await showConfirmDialog({
      title: '确认作废',
      message: `确认将订单 ${detail.value.orderNo} 作废吗？`,
      confirmButtonText: '确认作废',
    });

    await cancelOrder(detail.value.id, {
      reason: '运营端手动作废',
    });
    showSuccessToast('订单已作废');
    await loadDetail();
  } catch {
    // User cancelled the dialog; keep the current page state.
  }
}

async function copyClientLink() {
  const clientLink = getNormalizedClientLink();
  const orderNo = detail.value?.orderNo || savedClientLink.value?.orderNo;
  if (!clientLink || !orderNo) {
    showFailToast('当前设备没有保存该订单的完整客户链接');
    return;
  }

  const shareText = buildClientShareText(orderNo, clientLink);
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(shareText);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = shareText;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }

    showSuccessToast('客户分享文案已复制');
  } catch {
    showFailToast('复制失败，请手动复制');
  }
}

function getNormalizedClientLink() {
  if (!savedClientLink.value?.orderNo || !savedClientLink.value?.clientToken) {
    return savedClientLink.value?.clientLink || '';
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/client/orders/${savedClientLink.value.orderNo}?token=${savedClientLink.value.clientToken}`;
  }

  return savedClientLink.value.clientLink || '';
}

function saveEditDraft() {
  if (!editForm.value) {
    return;
  }
  saveJSON(`wechat-order-h5:edit-order:${route.params.id}`, editForm.value);
  showSuccessToast('编辑草稿已保存到本地');
}

async function submitEdit() {
  if (!editForm.value) {
    return;
  }

  saving.value = true;
  try {
    const validationMessage = validateOrderFormForSubmit(editForm.value);
    if (validationMessage) {
      showFailToast(validationMessage);
      return;
    }

    await updateOrder(Number(route.params.id), buildCreatePayload(editForm.value));
    showSuccessToast('订单已更新');
    editing.value = false;
    await loadDetail();
  } finally {
    saving.value = false;
  }
}
</script>
