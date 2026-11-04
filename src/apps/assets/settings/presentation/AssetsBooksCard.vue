<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue'

import BooksFileCard from '../../../../shared/storage/presentation/BooksFileCard.vue'
import { ASSETS_START_ROUTE } from '../../overview/presentation/assetLinks'
import { useAssetsBooks } from '../../workbook/application/assetsStore'
import { LOCAL_ASSETS_TITLE } from '../../workbook/presentation/assetsFile'
import { useAssetsExport } from '../../workbook/presentation/useAssetsExport'
import { words } from './words'

/** Assets Settings: where the Assets file is, with its export and the switch to another home. */
const store = useAssetsBooks()
const { state } = store
const { exporting, exportNow } = useAssetsExport()
</script>

<template>
  <BooksFileCard :title="words.books" :store="store" :seeded-title="{ stored: LOCAL_ASSETS_TITLE, shown: words.localTitle }" data-testid="assets-books-card">
    <template #actions>
      <UButton icon="i-lucide-download" :label="words.export" color="neutral" variant="outline" size="sm" :loading="exporting" :disabled="exporting || state.snapshot === null" @click="exportNow" />
      <UButton :to="ASSETS_START_ROUTE" icon="i-lucide-arrow-left-right" :label="words.switchStorage" color="neutral" variant="outline" size="sm" data-testid="assets-switch-storage" />
    </template>
  </BooksFileCard>
</template>
