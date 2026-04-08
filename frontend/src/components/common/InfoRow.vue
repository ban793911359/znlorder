<template>
  <div class="info-row">
    <div class="info-row__label">{{ label }}</div>
    <div class="info-row__value">
      <slot>{{ value ?? '--' }}</slot>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  label: string;
  value?: string | number | null;
}>();
</script>
