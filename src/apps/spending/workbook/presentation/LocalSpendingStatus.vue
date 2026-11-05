<script setup lang="ts">
import LocalFileStatus from '../../../../shared/storage/presentation/LocalFileStatus.vue'
import { useSpendingBooks } from '../application/spendingStore'
import { useSpendingExport } from './useSpendingExport'
import { words } from './words'

/** The Spending file kept in this browser, with its export. */
withDefaults(
  defineProps<{
    /** The narrow top-bar form. */
    compact?: boolean
  }>(),
  { compact: false },
)

const { state } = useSpendingBooks()
const { exporting, exportNow } = useSpendingExport()
</script>

<template>
  <LocalFileStatus :meta="state.snapshot?.meta ?? null" :label="words.exportFile" :exporting="exporting" :compact="compact" @export="exportNow" />
</template>
