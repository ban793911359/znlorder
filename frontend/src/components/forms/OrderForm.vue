<template>
  <div class="page-content">
    <section-card title="客户信息">
      <van-field
        v-model="form.customerName"
        label="客户备注名"
        placeholder="微信里的客户备注名"
      />
      <van-field
        v-model="form.customerMobile"
        label="客户手机号"
        placeholder="请输入手机号"
        type="tel"
      >
        <template #button>
          <van-button size="small" type="primary" plain @click="handleIdentify">
            识别老客户
          </van-button>
        </template>
      </van-field>
      <van-field
        v-model="form.wechatNickname"
        label="微信昵称"
        placeholder="可选"
      />

      <div v-if="customerHint?.isExistingCustomer" class="customer-hint">
        <div class="customer-hint__title">
          已识别老客户
          <span>{{ customerHint.customer?.name }}</span>
        </div>
        <div class="customer-hint__text">
          最近收货信息：{{ latestAddressText || '暂无历史收货信息' }}
        </div>
        <van-button size="small" type="primary" @click="applyLastShippingInfo">
          一键带出历史收货资料
        </van-button>
      </div>
    </section-card>

    <section-card title="收货信息">
      <van-field
        v-model="form.receiverFullAddress"
        label="完整地址"
        type="textarea"
        rows="4"
        autosize
        placeholder="支持一次粘贴：姓名 + 电话 + 完整地址"
      />
      <div class="form-tip">示例：张三 13800138000 广东省深圳市南山区科技园科苑路 88 号 1201</div>
    </section-card>

    <section-card title="商品信息">
      <product-item-editor
        v-for="(item, index) in form.items"
        :key="index"
        v-model="form.items[index]"
        :index="index"
        :removable="form.items.length > 1"
        @remove="removeItem(index)"
      />
      <van-button block plain type="primary" icon="plus" @click="addItem">
        新增商品
      </van-button>
    </section-card>

    <section-card title="金额信息">
      <info-row label="商品总额">
        <span>{{ formatMoney(totalAmount) }}</span>
      </info-row>
      <van-field
        v-model.number="form.shippingFee"
        type="digit"
        label="邮费"
        placeholder="请输入邮费"
      />
      <van-field
        v-model.number="form.discountAmount"
        type="number"
        label="优惠金额"
        placeholder="请输入优惠金额"
      />
      <van-field
        v-model="discountRateText"
        type="number"
        label="折扣换算"
        placeholder="例如 9.5 表示 9.5 折"
      >
        <template #button>
          <van-button size="small" type="primary" plain @click="applyDiscountRate">
            计算优惠
          </van-button>
        </template>
      </van-field>
      <info-row label="实收金额">
        <span class="highlight-money">{{ formatMoney(payableAmount) }}</span>
      </info-row>
      <div class="payment-code-upload">
        <image-uploader
          v-model="paymentImageList"
          title="收款码"
          tip="可上传一个或多个收款码；新建订单可自动带出默认收款码"
          upload-text="上传收款码"
          biz-type="order_payment_code_image"
        />
        <div v-if="showDefaultPaymentActions" class="payment-code-actions">
          <van-button
            size="small"
            plain
            type="primary"
            :disabled="!paymentImageList.length"
            @click="$emit('save-default-payment-images')"
          >
            设为默认收款码
          </van-button>
          <van-button
            size="small"
            plain
            type="success"
            :disabled="!hasDefaultPaymentImages"
            @click="$emit('apply-default-payment-images')"
          >
            恢复默认收款码
          </van-button>
          <van-button
            size="small"
            plain
            type="danger"
            :disabled="!hasDefaultPaymentImages"
            @click="$emit('clear-default-payment-images')"
          >
            清除默认
          </van-button>
        </div>
        <div v-if="showDefaultPaymentActions" class="form-tip payment-code-tip">
          默认收款码保存在当前账号的当前浏览器中，新建订单会自动带出，提交时自动关联到本单。
        </div>
      </div>
    </section-card>

    <section-card title="备注信息">
      <van-field
        v-model="form.customerRemark"
        label="客户备注"
        type="textarea"
        rows="2"
        autosize
        placeholder="记录客户特别要求"
      />
      <van-field
        v-model="form.internalRemark"
        label="内部备注"
        type="textarea"
        rows="2"
        autosize
        placeholder="运营内部可见"
      />
      <van-field
        v-model="form.warehouseRemark"
        label="仓库备注"
        type="textarea"
        rows="2"
        autosize
        placeholder="供仓库参考"
      />
      <div class="form-tip">
        当前后端版本未单独开放“草稿状态”和“创建阶段仓库备注字段”，前端会将备注一起保存在内部备注串中。
      </div>
    </section-card>

    <div class="page-actions">
      <van-button block plain type="primary" @click="$emit('save-draft')">
        保存草稿
      </van-button>
      <van-button
        block
        type="primary"
        :loading="submitting"
        @click="$emit('submit')"
      >
        {{ submitText }}
      </van-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { showFailToast, showSuccessToast } from 'vant';
import { identifyCustomer } from '@/api/customers';
import InfoRow from '@/components/common/InfoRow.vue';
import SectionCard from '@/components/common/SectionCard.vue';
import ImageUploader from '@/components/upload/ImageUploader.vue';
import ProductItemEditor from './ProductItemEditor.vue';
import type { IdentifyCustomerResult } from '@/types/order';
import type { OrderFormModel } from '@/types/form';
import { computePayableAmount, computeTotalAmount } from '@/utils/order';
import { formatMoney } from '@/utils/format';

const props = defineProps<{
  submitting?: boolean;
  submitText?: string;
  showDefaultPaymentActions?: boolean;
  hasDefaultPaymentImages?: boolean;
}>();

const form = defineModel<OrderFormModel>({
  required: true,
});

const customerHint = defineModel<IdentifyCustomerResult | null>('customerHint', {
  default: null,
});

const discountRateText = ref('');

const totalAmount = computed(() => computeTotalAmount(form.value.items));
const payableAmount = computed(() =>
  computePayableAmount(
    totalAmount.value,
    Number(form.value.shippingFee || 0),
    Number(form.value.discountAmount || 0),
  ),
);

const paymentImageList = computed({
  get: () => form.value.paymentImageList,
  set: (value) => {
    form.value.paymentImageList = value;
    form.value.paymentImageFileIds = value
      .map((item) => item.id)
      .filter((item): item is number => typeof item === 'number');
  },
});

const latestAddressText = computed(() =>
  customerHint.value?.lastShippingInfo?.receiverFullAddress ||
    customerHint.value?.lastShippingInfo?.receiverAddress ||
    '',
);

const emit = defineEmits<{
  submit: [];
  'save-draft': [];
  'save-default-payment-images': [];
  'apply-default-payment-images': [];
  'clear-default-payment-images': [];
}>();

function addItem() {
  form.value.items.push({
    productName: '',
    modelNo: '',
    color: '',
    size: '',
    quantity: 1,
    unitPrice: 0,
    imageFileIds: [],
    imageList: [],
  });
}

function removeItem(index: number) {
  form.value.items.splice(index, 1);
}

async function handleIdentify() {
  if (!/^1\d{10}$/.test(form.value.customerMobile)) {
    showFailToast('请先输入正确手机号');
    return;
  }

  const response = await identifyCustomer(form.value.customerMobile);
  customerHint.value = response.data;
}

function applyLastShippingInfo() {
  const shippingInfo = customerHint.value?.lastShippingInfo;
  if (!shippingInfo) {
    return;
  }

  form.value.receiverFullAddress =
    shippingInfo.receiverFullAddress ||
    [shippingInfo.receiverName, shippingInfo.receiverMobile, shippingInfo.receiverAddress]
      .filter(Boolean)
      .join(' ');
}

function applyDiscountRate() {
  const rate = Number(discountRateText.value);

  if (!Number.isFinite(rate) || rate <= 0 || rate > 10) {
    showFailToast('请输入 0-10 之间的折扣，例如 9.5');
    return;
  }

  const discountAmount = totalAmount.value * (10 - rate) / 10;
  form.value.discountAmount = Number(discountAmount.toFixed(2));
  showSuccessToast(`已按 ${rate} 折计算优惠`);
}
</script>

<style scoped>
.payment-code-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.payment-code-tip {
  margin-top: 8px;
}
</style>
