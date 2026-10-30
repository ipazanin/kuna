<script setup lang="ts">
import LocalFileStatus from '../../../../shared/storage/presentation/LocalFileStatus.vue'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { useExport } from './useExport'
import { words } from './words'

/** The company's books kept in this browser, with their export to Excel. */
withDefaults(
  defineProps<{
    /** The narrow top-bar form. */
    compact?: boolean
  }>(),
  { compact: false },
)

const { state } = useWorkbook()
const { exporting, exportNow } = useExport()
</script>

<template>
  <LocalFileStatus :meta="state.snapshot?.meta ?? null" :label="words.exportToExcel" :exporting="exporting" :compact="compact" @export="exportNow" />
</template>
