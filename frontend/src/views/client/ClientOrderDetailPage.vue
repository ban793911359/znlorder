<template>
  <div class="client-page">
    <div class="client-card" v-if="detail">
      <div class="client-card__title">订单查看</div>
      <div class="client-card__order-no">{{ ensureOrderNo(detail.orderNo) }}</div>
      <div class="client-card__status">
        <status-tag :status="detail.status" />
      </div>

      <section-card title="商品信息">
        <div v-for="item in detail.items" :key="item.id" class="detail-block">
          <div class="detail-block__title">{{ item.productName }}</div>
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
                <div class="image-expired-card__desc">仅保留订单信息</div>
              </div>
            </template>
          </div>
          <div class="detail-block__desc">{{ item.productSpec || '--' }}</div>
          <div class="detail-block__desc">
            数量：{{ item.quantity }} / 金额：{{ formatMoney(item.lineAmount) }}
          </div>
        </div>
      </section-card>

      <section-card title="收货与金额">
        <info-row label="完整地址" :value="formatReceiverFullAddress(detail)" />
        <info-row label="实收金额" :value="formatMoney(detail.payableAmount)" />
      </section-card>

      <section-card title="物流信息">
        <info-row label="快递公司" :value="detail.courierCompany || '--'" />
        <info-row label="运单号" :value="detail.trackingNo || '--'" />
        <info-row label="发货时间" :value="formatDateTime(detail.shippedAt)" />
      </section-card>
    </div>

    <div class="client-card" v-else>
      <div class="client-card__title">订单查看</div>
      <div class="form-tip">请输入正确链接访问本次订单。</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { getPublicOrder } from '@/api/orders';
import InfoRow from '@/components/common/InfoRow.vue';
import SectionCard from '@/components/common/SectionCard.vue';
import StatusTag from '@/components/common/StatusTag.vue';
import type { OrderDetail } from '@/types/order';
import {
  ensureOrderNo,
  formatDateTime,
  formatMoney,
  formatReceiverFullAddress,
  isImageAvailable,
  resolveMediaUrl,
} from '@/utils/format';

const route = useRoute();
const detail = ref<OrderDetail | null>(null);

onMounted(async () => {
  const token = String(route.query.token || '');
  if (!token) {
    return;
  }

  const response = await getPublicOrder(String(route.params.orderNo), token);
  detail.value = response.data;
});
</script>
