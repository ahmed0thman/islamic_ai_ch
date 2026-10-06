<script setup lang="ts">
import OrganizersRow from '../components/OrganizersRow.vue'
</script>

<template>
  <div class="slidev-layout hu hu-cover" dir="rtl" lang="ar">
    <OrganizersRow variant="cover" />
    <main class="hu-cover-body">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.hu-cover {
  background: linear-gradient(135deg, #0f5c4f 0%, #0a3f37 100%);
  color: #f4efe3;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding-block: 36px 40px;
  padding-inline: 56px;
  position: relative;
  overflow: hidden;
}

.hu-cover-body {
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  min-height: 0;
  width: 100%;
}
</style>
