<script setup lang="ts">
import NoteLine from '../../ui/NoteLine.vue'

/** What the last test of a key said, with an icon as well as the colour. */
defineProps<{
  line: string
  works: boolean
}>()
</script>

<template>
  <NoteLine size="body" :tone="works ? 'success' : 'error'" role="status" data-testid="assist-key-test-result">{{ line }}</NoteLine>
</template>
