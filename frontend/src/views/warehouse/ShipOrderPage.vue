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
        <div class="detail-block__title">{{ item.productName || item.productSpec || '未填写商品名称' }}</div>
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

    <section-card title="已发货记录">
      <template v-if="order.shipments?.length">
        <div v-for="shipment in order.shipments" :key="shipment.id" class="detail-block">
          <div class="detail-block__title">
            第 {{ shipment.sequenceNo }} 次发货 / {{ shipment.shipmentStatus === 'partial_shipped' ? '部分发货' : '已全部发货' }}
          </div>
          <info-row label="快递公司" :value="shipment.courierCompany" />
          <info-row label="运单号" :value="shipment.trackingNo" />
          <info-row
            :label="shipment.shipmentStatus === 'partial_shipped' ? '未发货备注' : '发货备注'"
            :value="shipment.shipmentRemark || '--'"
          />
          <info-row label="发货时间" :value="formatDateTime(shipment.shippedAt)" />
        </div>
      </template>
      <template v-else>
        <info-row label="发货记录" value="暂无发货记录" />
      </template>
    </section-card>

    <section-card title="本次发货">
      <template v-if="order.status === 'pending_shipment' || order.status === 'partial_shipped'">
        <van-field v-model="form.courierCompany" label="快递公司" placeholder="请输入快递公司" />
        <van-field v-model="form.trackingNo" label="运单号" placeholder="请输入运单号" />
        <div class="shipment-choice">
          <van-checkbox :model-value="form.isPartialShipment" @click="setShipmentType('partial')">
            部分发货
          </van-checkbox>
          <van-checkbox :model-value="form.isFullyShipped" @click="setShipmentType('full')">
            已全部发货
          </van-checkbox>
        </div>
        <van-field
          v-model="form.shipmentRemark"
          label="备注信息"
          type="textarea"
          rows="2"
          autosize
          :placeholder="form.isPartialShipment ? '请填写未发货备注信息' : '可填写本次发货备注'"
        />
        <div class="shipment-tip">
          部分发货时必须填写未发货备注；已全部发货时备注可选。
        </div>
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
import { useRoute } from 'vue-router';
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
import { loadJSON, saveJSON } from '@/utils/storage';

const route = useRoute();
const order = ref<OrderSummary | null>(null);
const submitting = ref(false);
const form = reactive({
  courierCompany: '',
  trackingNo: '',
  shipmentRemark: '',
  isPartialShipment: false,
  isFullyShipped: false,
});

onMounted(async () => {
  const orderId = Number(route.params.id);
  order.value = loadJSON<OrderSummary>(`wechat-order-h5:warehouse-order:${orderId}`);

  await loadOrderDetail(orderId);
});

function setShipmentType(type: 'partial' | 'full') {
  if (type === 'partial') {
    form.isPartialShipment = !form.isPartialShipment;
    form.isFullyShipped = false;
    return;
  }

  form.isFullyShipped = !form.isFullyShipped;
  form.isPartialShipment = false;
}

async function loadOrderDetail(orderId: number) {
  const response = await getWarehouseOrderDetail(orderId);
  order.value = response.data;
  saveJSON(`wechat-order-h5:warehouse-order:${orderId}`, response.data);
  resetForm();
}

function resetForm() {
  form.courierCompany = '';
  form.trackingNo = '';
  form.shipmentRemark = '';
  form.isPartialShipment = false;
  form.isFullyShipped = false;
}

async function submitShip() {
  if (!order.value) {
    return;
  }

  if (!form.courierCompany || !form.trackingNo) {
    showFailToast('请填写快递公司和运单号');
    return;
  }

  if (form.isPartialShipment === form.isFullyShipped) {
    showFailToast('请选择部分发货或已全部发货其中一项');
    return;
  }

  if (form.isPartialShipment && !form.shipmentRemark.trim()) {
    showFailToast('部分发货时请填写未发货备注信息');
    return;
  }

  submitting.value = true;
  try {
    const response = await shipOrder(order.value.id, {
      courierCompany: form.courierCompany,
      trackingNo: form.trackingNo,
      shipmentRemark: form.shipmentRemark.trim() || undefined,
      isPartialShipment: form.isPartialShipment,
      isFullyShipped: form.isFullyShipped,
    });
    order.value = response.data;
    saveJSON(`wechat-order-h5:warehouse-order:${order.value.id}`, response.data);
    resetForm();
    showSuccessToast(
      response.data.status === 'shipped' ? '订单已全部发货' : '已记录部分发货，可继续填写下次发货信息',
    );
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.shipment-choice {
  display: flex;
  gap: 16px;
  padding: 12px 16px 4px;
}

.shipment-tip {
  padding: 0 16px 12px;
  color: var(--van-text-color-2);
  font-size: 12px;
  line-height: 1.5;
}
</style>
