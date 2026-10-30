<script setup lang="ts">
import { computed } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import AppDialog from '../../../../shared/ui/AppDialog.vue'
import { useDisplayNames } from '../../workbook/application/useDisplayNames'
import type { ShareFill } from '../domain/ownerShare'

/** Asks, before a save of the categories that sets or changes a default, whether the rows of those categories without a share take it too. */
const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  fills: readonly ShareFill[]
}>()

const emit = defineEmits<{
  /** True to fill the rows in the same write as the categories, false to save the categories alone. */
  answer: [fill: boolean]
}>()

const names = useDisplayNames()

const rowsInWords = (count: number): string => `${count} ${count === 1 ? 'row' : 'rows'}`
const total = computed(() => props.fills.reduce((sum, fill) => sum + fill.targets.length, 0))
</script>

<template>
  <AppDialog v-model:open="open" title="Fill the rows without a share?">
    <div class="flex flex-col gap-4" data-testid="share-fill">
      <ul class="flex flex-col gap-2 text-sm">
        <li v-for="fill in fills" :key="fill.category" class="grid grid-cols-[minmax(0,1fr)_auto_auto] items-baseline gap-4">
          <span class="min-w-0 truncate text-highlighted">{{ names.category(fill.category) }}</span>
          <span class="figure text-toned">{{ fill.ownerShare }}%</span>
          <span class="figure text-muted">{{ rowsInWords(fill.targets.length) }}</span>
        </li>
      </ul>
      <p class="text-sm text-toned">Rows that already have a share keep it, a share of 0 included.</p>
    </div>
    <template #end>
      <UButton label="Cancel" color="neutral" variant="ghost" @click="open = false" />
      <UButton label="Save the default only" color="neutral" variant="outline" data-testid="share-fill-skip" @click="emit('answer', false)" />
      <UButton :label="`Save and fill ${rowsInWords(total)}`" icon="i-lucide-check" data-testid="share-fill-save" @click="emit('answer', true)" />
    </template>
  </AppDialog>
</template>
