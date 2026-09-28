<script setup lang="ts">
import { computed } from 'vue'
import { useSlideContext } from '@slidev/client'

const props = defineProps<{ kicker?: string; heading?: string; sub?: string }>()
const { $page } = useSlideContext()
const num = computed(() => String($page.value).padStart(2, '0'))
</script>

<template>
  <div class="slidev-layout hu" dir="rtl" lang="ar">
    <header v-if="props.heading" class="hu-head">
      <div v-if="props.kicker" class="hu-kicker">{{ props.kicker }}</div>
      <h1 class="hu-title">{{ props.heading }}</h1>
      <p v-if="props.sub" class="hu-sub" v-html="props.sub" />
    </header>
    <main class="hu-body">
      <slot />
    </main>
    <footer class="hu-foot">
      <span class="hu-foot-brand"><span class="hu-foot-name">هُدًى</span><span class="hu-foot-dot">·</span>رحلة إلى هدى القرآن</span>
      <span class="hu-foot-num">{{ num }}</span>
    </footer>
  </div>
</template>
