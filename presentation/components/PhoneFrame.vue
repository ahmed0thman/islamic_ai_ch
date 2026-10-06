<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  src: string
  alt?: string
  height?: string | number
  width?: string | number
}>()

const heightPx = computed(() => {
  if (!props.height) return null
  return typeof props.height === 'number' ? `${props.height}px` : props.height
})

const widthPx = computed(() => {
  if (props.width) {
    return typeof props.width === 'number' ? `${props.width}px` : props.width
  }
  if (props.height) {
    const num = typeof props.height === 'number' ? props.height : parseFloat(props.height)
    if (!isNaN(num)) {
      return `${Math.round(num * (9 / 19.5))}px`
    }
  }
  return null
})
</script>

<template>
  <div
    class="hu-phone-frame"
    :style="{
      ...(heightPx ? { height: heightPx, maxHeight: heightPx } : {}),
      ...(widthPx ? { width: widthPx, maxWidth: widthPx } : {})
    }"
  >
    <div class="hu-phone-bezel">
      <img :src="src" :alt="alt || ''" class="hu-phone-img" />
    </div>
  </div>
</template>

<style scoped>
.hu-phone-frame {
  display: inline-flex;
  position: relative;
  border-radius: 28px;
  padding: 6px;
  background: #17231f;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25);
  box-sizing: border-box;
  flex: none;
  align-self: center;
  justify-self: center;
  overflow: hidden;
}

.hu-phone-bezel {
  width: 100%;
  height: 100%;
  border-radius: 22px;
  overflow: hidden;
  background: #ffffff;
  display: flex;
}

.hu-phone-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top;
  display: block;
}
</style>
