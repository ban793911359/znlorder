<template>
  <div class="empty-state">
    <van-empty :description="description" />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  description?: string;
}>();
</script>
