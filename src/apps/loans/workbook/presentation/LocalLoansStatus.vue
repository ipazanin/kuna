<script setup lang="ts">
import LocalFileStatus from '../../../../shared/storage/presentation/LocalFileStatus.vue'
import { useLoansBooks } from '../application/loansStore'
import { useLoansExport } from './useLoansExport'
import { words } from './words'

/** The Loans file kept in this browser, with its export. */
withDefaults(
  defineProps<{
    /** The narrow top-bar form. */
    compact?: boolean
  }>(),
  { compact: false },
)

const { state } = useLoansBooks()
const { exporting, exportNow } = useLoansExport()
</script>

<template>
  <LocalFileStatus :meta="state.snapshot?.meta ?? null" :label="words.exportFile" :exporting="exporting" :compact="compact" @export="exportNow" />
</template>
