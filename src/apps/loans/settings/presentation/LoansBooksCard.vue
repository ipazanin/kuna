<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue'

import BooksFileCard from '../../../../shared/storage/presentation/BooksFileCard.vue'
import { LOANS_START_ROUTE } from '../../onboarding/presentation/useLoansStart'
import { useLoansBooks } from '../../workbook/application/loansStore'
import { useLoansExport } from '../../workbook/presentation/useLoansExport'

/** Loans Settings: where the Loans file is, with its export and the switch to another home. */
const store = useLoansBooks()
const { state } = store
const { exporting, exportNow } = useLoansExport()
</script>

<template>
  <BooksFileCard title="Loans books" :store="store" data-testid="loans-books-card">
    <template #actions>
      <UButton icon="i-lucide-download" label="Export" color="neutral" variant="outline" size="sm" :loading="exporting" :disabled="exporting || state.snapshot === null" @click="exportNow" />
      <UButton :to="LOANS_START_ROUTE" icon="i-lucide-arrow-left-right" label="Switch storage" color="neutral" variant="outline" size="sm" data-testid="loans-switch-storage" />
    </template>
  </BooksFileCard>
</template>
