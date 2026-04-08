<template>
  <section class="section-card">
    <div v-if="title || extra" class="section-card__header">
      <div class="section-card__title">{{ title }}</div>
      <div class="section-card__extra">
        <slot name="extra">{{ extra }}</slot>
      </div>
    </div>
    <slot />
  </section>
</template>

<script setup lang="ts">
defineProps<{
  title?: string;
  extra?: string;
}>();
</script>
