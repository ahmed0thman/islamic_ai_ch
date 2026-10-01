<!-- Claim marker: small icon(s) for the source type(s), then a raised number, placed
     right after the claim (docs/05-examples/kawthar-output.md design). `i` lists the types in the
     key's order. Badge «لا يثبت» / «خلاف معتبر» sits next to the marker in the body;
     «ثابت» never appears in the body, only in the side panel. -->
<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  i: string
  n: number | string
  badge?: 'no' | 'khilaf'
  on?: boolean
}>()
const icons = computed(() => props.i.split(','))
</script>

<template>
  <span class="hu-mk" :class="{ 'hu-mk-on': on }"><Ic v-for="t in icons" :key="t" :t="t as any" /><sup class="hu-mk-n">{{ n }}</sup></span><span v-if="badge === 'no'" class="hu-badge hu-badge-no">لا يثبت</span><span v-else-if="badge === 'khilaf'" class="hu-badge hu-badge-khilaf">خلاف معتبر</span>
</template>
