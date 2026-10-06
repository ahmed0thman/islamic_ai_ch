<script setup lang="ts">
import OrganizersRow from '../components/OrganizersRow.vue'
import RingMotif from '../components/RingMotif.vue'
</script>

<template>
  <div class="slidev-layout hu hu-closing" dir="rtl" lang="ar">
    <div class="hu-closing-bg-motif">
      <RingMotif />
    </div>
    <OrganizersRow variant="closing" />
    <main class="hu-closing-body">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.hu-closing {
  background: linear-gradient(135deg, #0f5c4f 0%, #0a3f37 100%);
  color: #f4efe3;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding-block: 36px 44px;
  padding-inline: 56px;
  position: relative;
  overflow: hidden;
}

.hu-closing-bg-motif {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 680px;
  height: 680px;
  pointer-events: none;
  z-index: 1;
}

.hu-closing-body {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 0;
  width: 100%;
  position: relative;
  z-index: 2;
  text-align: center;
}
</style>
