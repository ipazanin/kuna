<script setup lang="ts">
import { computed } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UModal from '@nuxt/ui/components/Modal.vue'

import { usePhoneLayout } from '../../../shared/layout/viewport'
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
const phone = usePhoneLayout()

const rowsInWords = (count: number): string => `${count} ${count === 1 ? 'row' : 'rows'}`
const total = computed(() => props.fills.reduce((sum, fill) => sum + fill.targets.length, 0))
</script>

<template>
  <UModal v-model:open="open" title="Fill the rows without a share?" :fullscreen="phone" :ui="{ header: 'pe-16 sm:pe-6', content: 'sm:max-w-lg' }">
    <template #body>
      <div class="flex flex-col gap-4" data-testid="share-fill">
        <ul class="flex flex-col gap-2 text-sm">
          <li v-for="fill in fills" :key="fill.category" class="fill-line">
            <span class="min-w-0 truncate text-highlighted">{{ names.category(fill.category) }}</span>
            <span class="figure text-toned">{{ fill.ownerShare }}%</span>
            <span class="figure text-muted">{{ rowsInWords(fill.targets.length) }}</span>
          </li>
        </ul>
        <p class="text-sm text-toned">Rows that already have a share keep it, a share of 0 included.</p>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <UButton label="Cancel" color="neutral" variant="ghost" class="justify-center" @click="open = false" />
        <UButton label="Save the default only" color="neutral" variant="outline" class="justify-center" data-testid="share-fill-skip" @click="emit('answer', false)" />
        <UButton :label="`Save and fill ${rowsInWords(total)}`" icon="i-lucide-check" class="justify-center" data-testid="share-fill-save" @click="emit('answer', true)" />
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.fill-line {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: baseline;
  gap: 1rem;
}
</style>
