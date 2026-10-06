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
  <div class="slidev-layout hu hu-dark" dir="rtl" lang="ar">
    <header class="hu-head">
      <div v-if="props.chip" class="hu-chip hu-chip-dark">{{ props.chip }}</div>
      <h1 v-if="props.heading" class="hu-title hu-title-dark">{{ props.heading }}</h1>
      <p v-if="props.sub" class="hu-sub hu-sub-dark">{{ props.sub }}</p>
    </header>
    <main class="hu-body">
      <slot />
    </main>
    <footer class="hu-foot hu-foot-dark">
      <span class="hu-foot-brand hu-foot-brand-dark">هُدًى</span>
      <img
        src="/identity/image2-trim.png"
        alt="تحدي الذكاء الاصطناعي في خدمة المحتوى الإسلامي"
        class="hu-foot-logo hu-foot-logo-dark"
      />
      <span class="hu-foot-num hu-foot-num-dark">{{ num }}</span>
    </footer>
  </div>
</template>

<style scoped>
.hu-dark {
  background: linear-gradient(135deg, #0f5c4f 0%, #0a3f37 100%);
  color: #f4efe3;
}
</style>
