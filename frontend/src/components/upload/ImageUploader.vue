<template>
  <div class="image-uploader">
    <div class="image-uploader__header">
      <div class="image-uploader__title">{{ title }}</div>
      <div class="image-uploader__tip">
        {{ tip }}
      </div>
    </div>

    <van-uploader
      :file-list="fileList"
      :after-read="handleAfterRead"
      multiple
      :max-count="maxCount"
      accept="image/*"
      preview-size="88"
      :upload-text="uploadText"
      @delete="handleDelete"
    />

    <div v-if="modelValue.length" class="image-uploader__preview-list">
      <div
        v-for="item in modelValue"
        :key="String(item.id ?? item.tempId)"
        class="image-uploader__preview-card"
      >
        <img
          :src="resolveMediaUrl(item.url)"
          :alt="item.name"
          class="image-uploader__preview-image"
        />
        <div class="image-uploader__preview-name">{{ item.name }}</div>
        <div class="image-uploader__preview-status">
          {{ resolveStatusText(item) }}
        </div>
        <van-button
          size="mini"
          plain
          type="danger"
          class="image-uploader__preview-delete"
          @click="removePreview(item)"
        >
          删除
        </van-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount } from 'vue';
import { closeToast, showFailToast, showLoadingToast, showSuccessToast } from 'vant';
import { uploadImage } from '@/api/uploads';
import { resolveMediaUrl } from '@/utils/format';
import { compressImageFile } from '@/utils/image';

type UploadedPreview = {
  id?: number;
  tempId?: string;
  url: string;
  name: string;
  status?: 'uploading' | 'done' | 'failed';
  message?: string;
  localUrl?: string;
  dataUrl?: string;
  originalSize?: number;
  compressedSize?: number;
};

const props = withDefaults(defineProps<{
  modelValue: UploadedPreview[];
  title?: string;
  tip?: string;
  maxCount?: number;
  uploadText?: string;
  bizType?: 'order_product_image' | 'order_payment_code_image';
}>(), {
  title: '商品图片',
  tip: '支持拍照/相册，上传前自动压缩，目标 100KB 以内',
  maxCount: 9,
  uploadText: '拍照或上传',
  bizType: 'order_product_image',
});

const emit = defineEmits<{
  'update:modelValue': [value: UploadedPreview[]];
}>();

const fileList = computed(() =>
  props.modelValue.map((item) => ({
    url: resolveMediaUrl(item.url),
    name: item.name,
    id: item.id ?? item.tempId,
    status:
      item.status === 'uploading'
        ? 'uploading'
        : item.status === 'failed'
          ? 'failed'
          : 'done',
    message: item.message,
  })),
);

onBeforeUnmount(() => {
  props.modelValue.forEach((item) => {
    if (item.localUrl) {
      URL.revokeObjectURL(item.localUrl);
    }
  });
});

async function handleAfterRead(
  file: { file?: File } | Array<{ file?: File }>,
) {
  const list = Array.isArray(file) ? file : [file];

  for (const current of list) {
    if (!current.file) {
      continue;
    }

    const tempId = buildTempId();
    const localUrl = URL.createObjectURL(current.file);
    appendPreview({
      tempId,
      url: localUrl,
      localUrl,
      name: current.file.name,
      status: 'uploading',
      message: '准备压缩...',
    });

    showLoadingToast({
      message: '图片处理中...',
      duration: 0,
      forbidClick: true,
    });

    try {
      const compressed = await compressImageFile(current.file);
      const dataUrl = await readFileAsDataUrl(compressed.file);
      patchPreview(tempId, {
        dataUrl,
        message: compressed.targetMet
          ? `已压缩 ${formatSize(compressed.compressedSize)}`
          : `压缩后 ${formatSize(compressed.compressedSize)}`,
      });

      const response = await uploadImage(compressed.file, props.bizType);
      URL.revokeObjectURL(localUrl);
      patchPreview(tempId, {
        id: response.data.id,
        url: response.data.fileUrl,
        name: current.file.name,
        status: 'done',
        localUrl: undefined,
        dataUrl,
        message: compressed.targetMet
          ? `已上传 ${formatSize(compressed.compressedSize)}`
          : `已上传 ${formatSize(compressed.compressedSize)}，仍大于 100KB`,
      });
      showSuccessToast('图片上传成功');
    } catch (error) {
      patchPreview(tempId, {
        status: 'failed',
        message: '上传失败，请重试或删除',
      });
      showFailToast(
        error instanceof Error ? error.message : '图片上传失败，请稍后重试',
      );
    } finally {
      closeToast();
    }
  }
}

function handleDelete(file: { id?: number | string; url?: string }) {
  const current = props.modelValue.find(
    (item) => String(item.id ?? item.tempId) === String(file.id),
  );

  if (current?.localUrl) {
    URL.revokeObjectURL(current.localUrl);
  }

  emit(
    'update:modelValue',
    props.modelValue.filter(
      (item) => String(item.id ?? item.tempId) !== String(file.id),
    ),
  );
}

function removePreview(item: UploadedPreview) {
  handleDelete({
    id: item.id ?? item.tempId,
    url: item.url,
  });
}

function appendPreview(preview: UploadedPreview) {
  emit('update:modelValue', [...props.modelValue, preview]);
}

function patchPreview(tempId: string, patch: Partial<UploadedPreview>) {
  emit(
    'update:modelValue',
    props.modelValue.map((item) =>
      item.tempId === tempId ? { ...item, ...patch } : item,
    ),
  );
}

function buildTempId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatSize(size: number) {
  if (size < 1024) {
    return `${size}B`;
  }

  return `${(size / 1024).toFixed(1)}KB`;
}

function resolveStatusText(item: UploadedPreview) {
  if (item.message) {
    return item.message;
  }

  if (item.status === 'uploading') {
    return '上传中...';
  }

  if (item.status === 'failed') {
    return '上传失败';
  }

  return '已上传';
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('读取图片失败'));
    reader.readAsDataURL(file);
  });
}
</script>
