<script setup lang="ts">
import { computed } from 'vue'
import { useSlideContext } from '@slidev/client'

// Reading-flow contract (registration-draft.md §7): one entry point (the title,
// top right, with one idea line under it), bands read top to bottom, and a thin
// sources strip at the bottom. The strip is the `sources` named slot.
const props = defineProps<{ heading?: string; sub?: string }>()
const { $page } = useSlideContext()
const num = computed(() => String($page.value).padStart(2, '0'))
</script>

<template>
  <div class="slidev-layout hu" dir="rtl" lang="ar">
    <header v-if="props.heading" class="hu-head">
      <h1 class="hu-title">{{ props.heading }}</h1>
      <p v-if="props.sub" class="hu-sub" v-html="props.sub" />
    </header>
    <main class="hu-body">
      <slot />
    </main>
    <footer class="hu-foot">
      <div class="hu-foot-src"><slot name="sources" /></div>
      <span class="hu-foot-id"><span class="hu-foot-name">هُدًى</span><span class="hu-foot-num">{{ num }}</span></span>
    </footer>
  </div>
</template>
