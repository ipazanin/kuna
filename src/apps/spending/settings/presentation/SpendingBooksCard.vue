<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue'

import { RECEIPTS_FOLDER } from '../../receipts/application/receiptPhotos'
import BooksFileCard from '../../../../shared/storage/presentation/BooksFileCard.vue'
import { SPENDING_START_ROUTE } from '../../overview/presentation/spendingLinks'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import { LOCAL_SPENDING_TITLE } from '../../workbook/presentation/spendingFile'
import { useSpendingExport } from '../../workbook/presentation/useSpendingExport'
import { spendingData } from '../../workbook/presentation/spendingData'
import { words } from './words'

/** Spending Settings: where the Spending file is, with its export and the switch to another home. */
const store = useSpendingBooks()
const { state } = store
const { exporting, exportNow } = useSpendingExport()
</script>

<template>
  <BooksFileCard
    :data="spendingData"
    :title="words.books"
    app-id="spending"
    :beside="() => ({ files: [], folders: [{ name: RECEIPTS_FOLDER, mailSource: null }], stays: [], blockedBy: [] })"
    :store="store"
    :seeded-title="{ stored: LOCAL_SPENDING_TITLE, shown: words.localTitle }"
    data-testid="spending-books-card"
  >
    <template #actions>
      <UButton icon="i-lucide-download" :label="words.export" color="neutral" variant="outline" size="sm" :loading="exporting" :disabled="exporting || state.snapshot === null" @click="exportNow" />
      <UButton :to="SPENDING_START_ROUTE" icon="i-lucide-arrow-left-right" :label="words.switchStorage" color="neutral" variant="outline" size="sm" data-testid="spending-switch-storage" />
    </template>
  </BooksFileCard>
</template>
