<script setup lang="ts">
import { computed, onMounted, useTemplateRef } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import type { RemovalLine } from './removalLines'
import { words } from './words'

/** What a failed delete did, first in the dialog's body and scrolled into view: what failed, then a short group of what already went. */
const props = defineProps<{
  title: string
  note: string
  lines: readonly RemovalLine[]
}>()

const root = useTemplateRef<HTMLElement>('root')
const failed = computed(() => props.lines.filter((line) => line.kind === 'failed'))
const gone = computed(() => props.lines.filter((line) => line.kind === 'gone'))

onMounted(() => root.value?.scrollIntoView({ block: 'start' }))
</script>

<template>
  <div ref="root" role="alert" class="flex scroll-mt-4 flex-col gap-3">
    <UAlert icon="i-lucide-triangle-alert" color="error" variant="subtle" :title="title" :description="note" />
    <ul v-if="failed.length > 0" class="flex flex-col gap-2 type-body">
      <li v-for="line in failed" :key="line.text" class="flex items-start gap-2">
        <UIcon name="i-lucide-circle-x" class="mt-0.5 shrink-0 text-error" />
        <span class="min-w-0">{{ line.text }}</span>
      </li>
    </ul>
    <template v-if="gone.length > 0">
      <h3 class="type-label">{{ words.deleteData.alreadyGone }}</h3>
      <ul class="flex flex-col gap-2 type-caption">
        <li v-for="line in gone" :key="line.text" class="flex items-start gap-2">
          <UIcon name="i-lucide-check" class="mt-0.5 shrink-0" />
          <span class="min-w-0">{{ line.text }}</span>
        </li>
      </ul>
    </template>
  </div>
</template>
