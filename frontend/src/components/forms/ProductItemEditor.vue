<template>
  <div class="product-block">
    <div class="product-block__header">
      <div>商品 {{ index + 1 }}</div>
      <van-button
        v-if="removable"
        size="mini"
        plain
        type="danger"
        @click="$emit('remove')"
      >
        删除
      </van-button>
    </div>

    <van-field v-model="model.productName" label="商品名称" placeholder="请输入商品名称" />
    <van-field v-model="model.modelNo" label="款号" placeholder="请输入款号" />
    <van-field v-model="model.color" label="颜色" placeholder="请输入颜色" />
    <van-field v-model="model.size" label="尺码" placeholder="请输入尺码" />
    <image-uploader v-model="imageList" />
    <van-stepper v-model="model.quantity" min="1" integer />
    <van-field
      v-model.number="model.unitPrice"
      type="digit"
      label="商品金额"
      placeholder="请输入商品金额"
    />
    <div class="product-block__summary">小计：¥{{ lineAmount.toFixed(2) }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import ImageUploader from '@/components/upload/ImageUploader.vue';
import type { ProductFormItem } from '@/types/form';
import { computeLineAmount } from '@/utils/order';

const model = defineModel<ProductFormItem>({
  required: true,
});

defineProps<{
  index: number;
  removable?: boolean;
}>();

defineEmits<{
  remove: [];
}>();

const lineAmount = computed(() => computeLineAmount(model.value));

const imageList = computed({
  get: () => model.value.imageList,
  set: (value) => {
    model.value.imageList = value;
    model.value.imageFileIds = value
      .map((item) => item.id)
      .filter((item): item is number => typeof item === 'number');
  },
});
</script>
