<script setup lang="ts">
import { computed } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'

import AppDialog from '../../../../shared/ui/AppDialog.vue'
import { useExport } from '../../workbook-files/presentation/useExport'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { words as fileWords } from '../../workbook-files/presentation/words'
import DataSourceChoices from './DataSourceChoices.vue'
import { words } from './words'

const open = defineModel<boolean>('open', { required: true })

const { state } = useWorkbook()
const { exporting, exportNow } = useExport()

const current = computed(() => state.choice?.source ?? null)
</script>

<template>
  <AppDialog v-model:open="open" width="2xl" :title="words.switchTitle" :description="words.switchDescription">
    <div class="flex flex-col gap-4">
      <UAlert
        v-if="current === 'browser'"
        icon="i-lucide-triangle-alert"
        color="warning"
        variant="subtle"
        :title="words.deletedOnSwitch"
        :description="words.deletedOnSwitchDescription"
        :actions="[{ label: fileWords.exportToExcel, icon: 'i-lucide-download', color: 'warning', variant: 'outline', loading: exporting, onClick: exportNow }]"
      />
      <DataSourceChoices :current="current" @chosen="open = false" />
    </div>
  </AppDialog>
</template>
