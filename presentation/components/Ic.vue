<!-- Source-type icons for the product-screen key (slides 5, 6, 7).
     Drawn as SVG so they do not depend on font coverage. Colours follow
     docs/05-examples/kawthar-output.md, "مفتاح الألوان والأيقونات". Shape differs per type, so
     the meaning never rests on colour alone. -->
<script setup lang="ts">
defineProps<{ t: 'ayah' | 'hadith' | 'athar' | 'scholar' | 'link' | 'guide' }>()
</script>

<template>
  <svg v-if="t === 'ayah'" class="hu-ic hu-ic-ayah" viewBox="0 0 20 20" role="img" aria-label="آية">
    <g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round">
      <rect x="4.6" y="4.6" width="10.8" height="10.8" />
      <rect x="4.6" y="4.6" width="10.8" height="10.8" transform="rotate(45 10 10)" />
    </g>
  </svg>
  <svg v-else-if="t === 'hadith'" class="hu-ic hu-ic-hadith" viewBox="0 0 20 20" role="img" aria-label="قول النبي ﷺ">
    <path d="M10 2.2 17.8 10 10 17.8 2.2 10Z" fill="currentColor" />
  </svg>
  <svg v-else-if="t === 'athar'" class="hu-ic hu-ic-athar" viewBox="0 0 20 20" role="img" aria-label="صحابي أو تابعي">
    <path d="M10 2.6 18 16.6H2Z" fill="currentColor" />
  </svg>
  <svg v-else-if="t === 'scholar'" class="hu-ic hu-ic-scholar" viewBox="0 0 20 20" role="img" aria-label="قول عالم">
    <rect x="3" y="3" width="14" height="14" rx="1" fill="currentColor" />
  </svg>
  <svg v-else-if="t === 'link'" class="hu-ic hu-ic-link" viewBox="0 0 20 20" role="img" aria-label="ربط اجتهادي">
    <g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 7H16.5M13 3.6 16.5 7 13 10.4" />
      <path d="M17 13H3.5M7 9.6 3.5 13 7 16.4" />
    </g>
  </svg>
  <svg v-else class="hu-ic hu-ic-guide" viewBox="0 0 20 20" role="img" aria-label="هداية مستنبطة">
    <path d="M10 1.6C10.7 6.6 13.4 9.3 18.4 10 13.4 10.7 10.7 13.4 10 18.4 9.3 13.4 6.6 10.7 1.6 10 6.6 9.3 9.3 6.6 10 1.6Z" fill="currentColor" />
  </svg>
</template>
