<!-- Flow arrow. Reading flow rule: arrows point LEFT between stages of a numbered
     row (which starts at the right), or DOWN in a vertical sequence. SVG paths
     are not mirrored by direction:rtl, so "l" always points left. -->
<script setup lang="ts">
defineProps<{ d?: 'l' | 'd' }>()
</script>

<template>
  <svg v-if="d === 'd'" class="hu-arr hu-arr-d" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 3.5V19.5M5.5 13 12 19.5 18.5 13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
  <svg v-else class="hu-arr hu-arr-l" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M20.5 12H4.5M11 5.5 4.5 12 11 18.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
</template>
