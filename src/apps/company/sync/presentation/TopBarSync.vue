<script setup lang="ts">
import LocalWorkbookStatus from '../../workbook-files/presentation/LocalWorkbookStatus.vue'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { useFindDriveFile } from '../../workbook/presentation/useFindDriveFile'
import SyncStatus from './SyncStatus.vue'
import { useSync } from './useSync'

/** The top bar's control: the export reminder for books kept in this browser, and the sync for books on Drive. */
withDefaults(
  defineProps<{
    /** The narrow top-bar form. */
    compact?: boolean
  }>(),
  { compact: false },
)

const { state } = useWorkbook()
const sync = useSync()
const { findDriveFile } = useFindDriveFile()
</script>

<template>
  <LocalWorkbookStatus v-if="state.choice?.source === 'browser'" :compact="compact" />
  <SyncStatus
    v-else
    :control="sync.control.value"
    :run="sync.run.value"
    :compact="compact"
    @sync="sync.sync"
    @allow="sync.allowAccess"
    @find="findDriveFile('find')"
  />
</template>
