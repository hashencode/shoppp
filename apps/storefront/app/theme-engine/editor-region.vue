<script setup lang="ts">
defineProps<{ enabled?: boolean; instanceId: string }>();
</script>
<template>
  <div v-if="enabled" class="storefront-editor-region" style="display: contents" :data-editor-instance="instanceId"><slot /></div>
  <slot v-else />
</template>
