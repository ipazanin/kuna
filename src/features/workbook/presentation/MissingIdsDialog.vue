<script setup lang="ts">
import { computed } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UModal from '@nuxt/ui/components/Modal.vue'
import { useToast } from '@nuxt/ui/composables/useToast'

import { usePhoneLayout } from '../../../shared/layout/viewport'
import { rowsWithoutIds } from '../infrastructure/rowIds'
import { useWorkbook } from '../application/workbookStore'
import { ID_COLUMN } from '../infrastructure/workbookTemplate'
import { rowsWithoutIdsInWords } from './rowsInWords'

/**
 * Gives every row of the tabs that carry ids, and that has none, its id in one write, after
 * listing the tabs and how many rows each, such as rows added by hand. A Google Sheet tab without
 * the id column gets it first.
 */
const open = defineModel<boolean>('open', { required: true })

const store = useWorkbook()
const toast = useToast()
const phone = usePhoneLayout()

const lacking = computed(() => (store.state.snapshot === null ? [] : rowsWithoutIds(store.state.snapshot)))
const inSheet = computed(() => store.state.choice?.source === 'google')
const rowCount = computed(() => lacking.value.reduce((sum, tab) => sum + tab.rows, 0))

function rows(count: number): string {
  return count === 1 ? '1 row' : `${count} rows`
}

async function add(): Promise<void> {
  try {
    const given = (await store.addMissingIds()).reduce((sum, tab) => sum + tab.rows, 0)
    toast.add({
      title: 'Ids added',
      description: given === 0 ? 'Every row already had an id.' : `${rows(given)} now ${given === 1 ? 'has' : 'have'} an id.`,
      icon: 'i-lucide-check',
      color: 'success',
    })
    open.value = false
  } catch (failure) {
    toast.add({ title: 'No ids added', description: failure instanceof Error ? failure.message : String(failure), icon: 'i-lucide-triangle-alert', color: 'error', duration: 10_000 })
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Give rows their ids"
    :description="lacking.length === 0 ? 'Every row has an id.' : `${rowsWithoutIdsInWords(lacking)}.`"
    :fullscreen="phone"
    :ui="{ header: 'pe-16 sm:pe-6' }"
  >
    <template #body>
      <div class="flex flex-col gap-4" data-testid="missing-ids">
        <p class="text-sm text-toned">
          A row added by hand has no id, and the app leaves it out until it gets one. Each of these rows gets a code of its own that names it wherever it moves.
        </p>
        <ul class="ids-list">
          <li v-for="tab in lacking" :key="tab.tab" class="ids-line">
            <span class="identifier min-w-0 truncate">{{ tab.tab }}</span>
            <span class="figure shrink-0 text-sm text-toned">{{ rows(tab.rows) }}</span>
          </li>
        </ul>
        <p class="text-xs text-muted">
          <template v-if="inSheet">
            A tab without an <span class="identifier">{{ ID_COLUMN }}</span> column gets one after its last column, headed <span class="identifier">{{ ID_COLUMN }}</span> in row 1.
            Each row's id goes in that column, all in one write. Nothing else in the Sheet changes.
          </template>
          <template v-else>Each row's id goes in its <span class="identifier">{{ ID_COLUMN }}</span> column, and the next export carries it. Nothing else changes.</template>
        </p>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full flex-wrap justify-end gap-2">
        <UButton label="Cancel" color="neutral" variant="ghost" @click="open = false" />
        <UButton
          :label="rowCount === 1 ? 'Add the id' : `Add ${rowCount} ids`"
          icon="i-lucide-key-round"
          :loading="store.state.writing"
          :disabled="rowCount === 0 || store.state.writing"
          data-testid="missing-ids-add"
          @click="add"
        />
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.ids-list {
  display: flex;
  flex-direction: column;
  border-block: 1px solid var(--border-default);
}

.ids-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  min-height: 2.5rem;
}

.ids-line + .ids-line {
  border-top: 1px solid var(--border-default);
}
</style>
