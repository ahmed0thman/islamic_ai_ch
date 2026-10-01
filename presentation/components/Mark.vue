<!-- Comparison-table mark: full = documented, half = a narrower or different
     form, none = not found in public material. Drawn as SVG so the glyph
     does not depend on font coverage for ● ◐ —. -->
<script setup lang="ts">
defineProps<{ v: 'full' | 'half' | 'none' }>()
</script>

<template>
  <svg v-if="v === 'full'" class="hu-mark" viewBox="0 0 20 20" role="img" aria-label="موثق">
    <circle cx="10" cy="10" r="7" fill="currentColor" />
  </svg>
  <svg v-else-if="v === 'half'" class="hu-mark" viewBox="0 0 20 20" role="img" aria-label="قريب">
    <circle cx="10" cy="10" r="6.4" fill="none" stroke="currentColor" stroke-width="1.6" />
    <path d="M10 3.6 A6.4 6.4 0 0 1 10 16.4 Z" fill="currentColor" />
  </svg>
  <svg v-else class="hu-mark hu-mark-none" viewBox="0 0 20 20" role="img" aria-label="لم نجده">
    <line x1="5" y1="10" x2="15" y2="10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
  </svg>
</template>
