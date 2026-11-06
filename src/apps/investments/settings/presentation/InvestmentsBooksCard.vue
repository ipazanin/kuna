<script setup lang="ts">
import { ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import { PRICES_FILE_NAME } from '../../prices/domain/pricesFile'
import BooksFileCard from '../../../../shared/storage/presentation/BooksFileCard.vue'
import { INVESTMENTS_START_ROUTE } from '../../overview/presentation/investmentLinks'
import { useInvestmentsBooks } from '../../workbook/application/investmentsStore'
import { LOCAL_INVESTMENTS_TITLE } from '../../workbook/domain/investmentsBooks'
import { useInvestmentsExport } from '../../workbook/presentation/useInvestmentsExport'
import RemoveFileDialog from './RemoveFileDialog.vue'
import { words } from './words'

/**
 * Investments Settings: where the Investments file is, with its export, the switch to another home and its removal.
 * A file already in the bin or gone offers no removal.
 */
const store = useInvestmentsBooks()
const { state } = store
const { exporting, exportNow } = useInvestmentsExport()
const removing = ref(false)
</script>

<template>
  <BooksFileCard
    :title="words.books"
    app-id="investments"
    :beside="() => ({ files: [PRICES_FILE_NAME], folders: [], stays: [], blockedBy: [] })"
    :store="store"
    :seeded-title="{ stored: LOCAL_INVESTMENTS_TITLE, shown: words.localTitle }"
    data-testid="investments-books-card"
  >
    <template #actions>
      <UButton icon="i-lucide-download" :label="words.export" color="neutral" variant="outline" size="sm" :loading="exporting" :disabled="exporting || state.snapshot === null" @click="exportNow" />
      <UButton :to="INVESTMENTS_START_ROUTE" icon="i-lucide-arrow-left-right" :label="words.switchStorage" color="neutral" variant="outline" size="sm" data-testid="investments-switch-storage" />
      <UButton
        v-if="state.choice && !state.missing"
        icon="i-lucide-trash-2"
        :label="words.removal.open"
        color="error"
        variant="ghost"
        size="sm"
        data-testid="investments-remove"
        @click="removing = true"
      />
    </template>
  </BooksFileCard>
  <RemoveFileDialog v-model:open="removing" />
</template>
