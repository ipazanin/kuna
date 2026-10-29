<script setup lang="ts">
import { computed } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UModal from '@nuxt/ui/components/Modal.vue'

import { usePhoneLayout } from '../../../../shared/layout/viewport'
import { useExport } from '../../workbook-files/presentation/useExport'
import { useWorkbook } from '../../workbook/application/workbookStore'
import DataSourceChoices from './DataSourceChoices.vue'

const open = defineModel<boolean>('open', { required: true })

const { state } = useWorkbook()
const { exporting, exportNow } = useExport()

const current = computed(() => state.choice?.source ?? null)
const phone = usePhoneLayout()
</script>

<template>
  <UModal
    v-model:open="open"
    title="Switch data source"
    description="Show a different workbook. The figures follow whichever you choose."
    :fullscreen="phone"
    :ui="{ content: 'sm:max-w-2xl', header: 'pe-16 sm:pe-6' }"
  >
    <template #body>
      <div class="flex flex-col gap-4">
        <UAlert
          v-if="current === 'browser'"
          icon="i-lucide-triangle-alert"
          color="warning"
          variant="subtle"
          title="The workbook in this browser is deleted when you switch"
          description="It exists only here and in the files you exported. Export it first if you want to keep your latest changes."
          :actions="[{ label: 'Export to Excel', icon: 'i-lucide-download', color: 'warning', variant: 'outline', loading: exporting, onClick: exportNow }]"
        />
        <DataSourceChoices :current="current" @chosen="open = false" />
      </div>
    </template>
  </UModal>
</template>
