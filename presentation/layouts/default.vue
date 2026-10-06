<script setup lang="ts">
import { computed } from 'vue'
import { useSlideContext } from '@slidev/client'

const props = defineProps<{
  chip?: string
  heading?: string
  sub?: string
}>()

const { $page } = useSlideContext()
const num = computed(() => String($page.value).padStart(2, '0'))
</script>

<template>
  <div class="slidev-layout hu hu-paper" dir="rtl" lang="ar">
    <header class="hu-head">
      <div v-if="props.chip" class="hu-chip">{{ props.chip }}</div>
      <h1 v-if="props.heading" class="hu-title">{{ props.heading }}</h1>
      <p v-if="props.sub" class="hu-sub">{{ props.sub }}</p>
    </header>
    <main class="hu-body">
      <slot />
    </main>
    <footer class="hu-foot">
      <span class="hu-foot-brand">هُدًى</span>
      <img
        src="/identity/image11-trim.png"
        alt="تحدي الذكاء الاصطناعي في خدمة المحتوى الإسلامي"
        class="hu-foot-logo"
      />
      <span class="hu-foot-num">{{ num }}</span>
    </footer>
  </div>
</template>

<style scoped>
.hu-paper {
  background-color: var(--hu-paper, #faf6ee);
  color: var(--hu-ink, #17231f);
}
</style>
