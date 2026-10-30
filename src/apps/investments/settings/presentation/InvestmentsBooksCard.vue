<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue'

import BooksFileCard from '../../../../shared/storage/presentation/BooksFileCard.vue'
import { INVESTMENTS_START_ROUTE } from '../../overview/presentation/investmentLinks'
import { useInvestmentsBooks } from '../../workbook/application/investmentsStore'
import { LOCAL_INVESTMENTS_TITLE } from '../../workbook/presentation/investmentsFile'
import { useInvestmentsExport } from '../../workbook/presentation/useInvestmentsExport'
import { words } from './words'

/** Investments Settings: where the Investments file is, with its export and the switch to another home. */
const store = useInvestmentsBooks()
const { state } = store
const { exporting, exportNow } = useInvestmentsExport()
</script>

<template>
  <BooksFileCard :title="words.books" :store="store" :seeded-title="{ stored: LOCAL_INVESTMENTS_TITLE, shown: words.localTitle }" data-testid="investments-books-card">
    <template #actions>
      <UButton icon="i-lucide-download" :label="words.export" color="neutral" variant="outline" size="sm" :loading="exporting" :disabled="exporting || state.snapshot === null" @click="exportNow" />
      <UButton :to="INVESTMENTS_START_ROUTE" icon="i-lucide-arrow-left-right" :label="words.switchStorage" color="neutral" variant="outline" size="sm" data-testid="investments-switch-storage" />
    </template>
  </BooksFileCard>
</template>
