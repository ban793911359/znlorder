<template>
  <van-config-provider :theme-vars="themeVars">
    <router-view />
  </van-config-provider>
</template>

<script setup lang="ts">
const themeVars = {
  primaryColor: '#1f6feb',
  successColor: '#16a34a',
  warningColor: '#f59e0b',
  dangerColor: '#dc2626',
  textColor: '#1f2937',
  textColor2: '#4b5563',
  background2: '#f7f8fa',
  borderColor: '#e5e7eb',
};
</script>
