<script setup lang="ts">
import LocalFileStatus from '../../../../shared/storage/presentation/LocalFileStatus.vue'
import { useInvestmentsBooks } from '../application/investmentsStore'
import { useInvestmentsExport } from './useInvestmentsExport'
import { words } from './words'

/** The Investments file kept in this browser, with its export. */
withDefaults(
  defineProps<{
    /** The narrow top-bar form. */
    compact?: boolean
  }>(),
  { compact: false },
)

const { state } = useInvestmentsBooks()
const { exporting, exportNow } = useInvestmentsExport()
</script>

<template>
  <LocalFileStatus :meta="state.snapshot?.meta ?? null" :label="words.exportFile" :exporting="exporting" :compact="compact" @export="exportNow" />
</template>
