<script setup lang="ts">
import { ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import MoneyText from '../../../shared/ui/MoneyText.vue'
import { useDisplayNames } from '../../../features/workbook/application/useDisplayNames'
import type { PrivateShareToMove } from '../../../features/workbook/domain/workbook'
import MoveShareDialog from './MoveShareDialog.vue'

/** The private shares still on the owner-advances tab, each with a way to move it to the splits tab. */
defineProps<{
  shares: readonly PrivateShareToMove[]
  /** Off while another write runs. */
  editable: boolean
}>()

const names = useDisplayNames()
const moving = ref<PrivateShareToMove | null>(null)
const dialogOpen = ref(false)

const dayFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

function openMove(share: PrivateShareToMove): void {
  moving.value = share
  dialogOpen.value = true
}
</script>

<template>
  <ul class="flex flex-col" data-testid="private-shares">
    <li v-for="share in shares" :key="share.sheetRow" class="share-row" data-testid="private-share">
      <div class="min-w-0">
        <p class="truncate text-sm text-highlighted">{{ share.description || 'Private share' }}</p>
        <p class="truncate text-xs text-muted">{{ dayFormat.format(new Date(share.date)) }}, off {{ names.category(share.category) }}, row {{ share.sheetRow }} of owner-advances</p>
      </div>
      <MoneyText :cents="share.amount" class="text-end text-sm font-medium text-highlighted" />
      <UButton
        label="Move to splits"
        icon="i-lucide-split"
        color="neutral"
        variant="outline"
        size="sm"
        class="justify-self-end"
        :disabled="!editable"
        data-testid="move-share-open"
        @click="openMove(share)"
      />
    </li>
  </ul>
  <MoveShareDialog v-if="moving" v-model:open="dialogOpen" :share="moving" />
</template>

<style scoped>
.share-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  column-gap: 0.75rem;
  padding: 0.5rem 0;
}

.share-row + .share-row {
  border-top: 1px solid var(--border-default);
}

@media (max-width: 639px) {
  .share-row {
    grid-template-columns: minmax(0, 1fr) auto;
    row-gap: 0.25rem;
  }

  .share-row > :last-child {
    grid-column: 1 / -1;
    justify-self: start;
  }
}
</style>
