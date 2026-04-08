<template>
  <div class="page-content" v-if="order">
    <section-card title="订单信息">
      <info-row label="订单号" :value="ensureOrderNo(order.orderNo)" />
      <info-row label="订单状态">
        <status-tag :status="order.status" />
      </info-row>
    </section-card>

    <section-card title="商品信息">
      <div v-for="item in order.items" :key="item.id" class="detail-block">
        <div class="detail-block__title">{{ item.productName }}</div>
        <div v-if="item.images?.length" class="image-grid warehouse-image-grid">
          <template v-for="image in item.images" :key="image.id">
            <img
              v-if="isImageAvailable(image)"
              :src="resolveMediaUrl(image.fileUrl)"
              class="image-grid__item"
              alt="商品图"
            />
            <div v-else class="image-expired-card">
              <div class="image-expired-card__title">图片已过期</div>
              <div class="image-expired-card__desc">不影响发货回查</div>
            </div>
          </template>
        </div>
        <div class="detail-block__desc">
          款号：{{ parseProductSpec(item.productSpec).modelNo || '--' }}
        </div>
        <div class="detail-block__desc">
          颜色：{{ parseProductSpec(item.productSpec).color || '--' }}
        </div>
        <div class="detail-block__desc">
          尺码：{{ parseProductSpec(item.productSpec).size || '--' }}
        </div>
        <div class="detail-block__desc">数量：{{ item.quantity }}</div>
      </div>
    </section-card>

    <section-card title="收货信息">
      <info-row label="完整地址" :value="formatReceiverFullAddress(order)" />
    </section-card>

    <section-card title="仓库备注">
      <info-row label="仓库备注" :value="order.warehouseRemark || '--'" />
    </section-card>

    <section-card title="发货信息">
      <template v-if="order.status === 'pending_shipment'">
        <van-field v-model="form.courierCompany" label="快递公司" placeholder="请输入快递公司" />
        <van-field v-model="form.trackingNo" label="运单号" placeholder="请输入运单号" />
        <van-field
          v-model="form.warehouseRemark"
          label="补充备注"
          type="textarea"
          rows="2"
          autosize
          placeholder="可补充发货备注"
        />
        <div class="page-actions">
          <van-button block type="primary" :loading="submitting" @click="submitShip">
            确认发货
          </van-button>
        </div>
      </template>
      <template v-else>
        <info-row label="快递公司" :value="order.courierCompany || '--'" />
        <info-row label="运单号" :value="order.trackingNo || '--'" />
        <info-row label="发货时间" :value="formatDateTime(order.shippedAt)" />
      </template>
    </section-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { showFailToast, showSuccessToast } from 'vant';
import { getWarehouseOrderDetail, shipOrder } from '@/api/orders';
import InfoRow from '@/components/common/InfoRow.vue';
import SectionCard from '@/components/common/SectionCard.vue';
import StatusTag from '@/components/common/StatusTag.vue';
import type { OrderSummary } from '@/types/order';
import {
  ensureOrderNo,
  formatDateTime,
  formatReceiverFullAddress,
  isImageAvailable,
  resolveMediaUrl,
} from '@/utils/format';
import { parseProductSpec } from '@/utils/order';
import { loadJSON } from '@/utils/storage';

const route = useRoute();
const router = useRouter();
const order = ref<OrderSummary | null>(null);
const submitting = ref(false);
const form = reactive({
  courierCompany: '',
  trackingNo: '',
  warehouseRemark: '',
});

onMounted(async () => {
  const orderId = Number(route.params.id);
  order.value = loadJSON<OrderSummary>(`wechat-order-h5:warehouse-order:${orderId}`);

  if (!order.value) {
    const response = await getWarehouseOrderDetail(orderId);
    order.value = response.data;
  }

  if (order.value) {
    form.courierCompany = order.value.courierCompany || '';
    form.trackingNo = order.value.trackingNo || '';
    form.warehouseRemark = order.value.warehouseRemark || '';
  }
});

async function submitShip() {
  if (!order.value) {
    return;
  }

  if (!form.courierCompany || !form.trackingNo) {
    showFailToast('请填写快递公司和运单号');
    return;
  }

  submitting.value = true;
  try {
    await shipOrder(order.value.id, form);
    showSuccessToast('已确认发货');
    router.replace('/warehouse/orders/pending');
  } finally {
    submitting.value = false;
  }
}
</script>
