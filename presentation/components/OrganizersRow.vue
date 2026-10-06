<script setup lang="ts">
defineProps<{
  variant?: 'cover' | 'closing'
}>()
</script>

<template>
  <header class="hu-org-row" :class="`hu-org-row-${variant || 'cover'}`">
    <!-- Inline-start (right): Bazil logo -->
    <img
      src="/identity/image5-trim.png"
      alt="مؤسسة باذل الأهلية"
      class="hu-org-logo hu-org-bazil"
    />
    <!-- Inline-end (left): Challenge logo (+ partner logo on closing) -->
    <div class="hu-org-group">
      <img
        v-if="variant === 'closing'"
        src="/identity/image6-trim.png"
        alt="شريك"
        class="hu-org-logo hu-org-partner"
      />
      <img
        src="/identity/image2-trim.png"
        alt="تحدي الذكاء الاصطناعي في خدمة المحتوى الإسلامي"
        class="hu-org-logo hu-org-challenge"
      />
    </div>
  </header>
</template>

<style scoped>
.hu-org-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 38px;
  flex: none;
  z-index: 10;
}

.hu-org-group {
  display: flex;
  align-items: center;
  gap: 20px;
}

.hu-org-logo {
  object-fit: contain;
  display: block;
}

.hu-org-challenge {
  height: 22px;
  max-width: 280px;
}

.hu-org-partner {
  height: 26px;
  max-width: 160px;
}

.hu-org-bazil {
  height: 30px;
  max-width: 120px;
}
</style>
