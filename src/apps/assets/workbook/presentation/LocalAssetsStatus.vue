<script setup lang="ts">
import LocalFileStatus from '../../../../shared/storage/presentation/LocalFileStatus.vue'
import { useAssetsBooks } from '../application/assetsStore'
import { useAssetsExport } from './useAssetsExport'
import { words } from './words'

/** The Assets file kept in this browser, with its export. */
withDefaults(
  defineProps<{
    /** The narrow top-bar form. */
    compact?: boolean
  }>(),
  { compact: false },
)

const { state } = useAssetsBooks()
const { exporting, exportNow } = useAssetsExport()
</script>

<template>
  <LocalFileStatus :meta="state.snapshot?.meta ?? null" :label="words.exportFile" :exporting="exporting" :compact="compact" @export="exportNow" />
</template>
