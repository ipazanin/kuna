<script setup lang="ts">
import { computed } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import AppCard from '../../../../shared/ui/AppCard.vue'
import { NO_RECORDS, recordsOf } from '../../../../shared/storage/domain/recordsRead'
import ProblemList from '../../workbook-files/presentation/ProblemList.vue'
import { installedPack, shownPack } from '../../packs/packContribution'
import { presentedWorkbook } from '../../transactions/application/presentedWorkbook'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import { removeSettings } from '../application/settingWrites'
import { unreadSettingKeys } from '../domain/settings'
import GeneralSettingsForm from './GeneralSettingsForm.vue'
import { rowsInWords } from './settingsCounts'
import { useSettingsSave } from './useSettingsSave'

const { state } = useWorkbook()
const { settings, facts: packFacts, saving: savingSettings, saveGeneral } = useSettingsSave()
const pack = computed(() => shownPack(settings.value))
const writes = useRecordWrites(useWorkbook())

/** The reader's problems and the splits the figures leave out, such as one of a row an asset claims. */
const problems = computed(() => (state.workbook === null ? [] : presentedWorkbook(state.workbook).problems))

const settingRecords = computed(() => state.records?.settings ?? NO_RECORDS)
/** The keys the settings tab holds that no setting reads, unknown keys and import profiles, with how many rows hold each. */
const unreadKeys = computed(() => unreadSettingKeys(recordsOf(settingRecords.value), installedPack().workbook?.settings ?? null))

function removeKey(key: string): void {
  void writes.write('Setting removed', (unit) => removeSettings(unit, settingRecords.value, [key]), {
    description: `${key} is off the settings tab. Settings keep no Undo.`,
    failedTitle: 'Not removed',
  })
}

const saving = computed(() => writes.busy.value || state.writing)
</script>

<template>
  <div v-if="state.workbook" class="flex flex-col gap-6">
    <GeneralSettingsForm :settings="settings" :facts="packFacts" :saving="savingSettings || state.writing" @save="saveGeneral" />
    <component :is="card" v-for="(card, index) in pack.settingsCards" :key="index" />
    <AppCard
      title="Rows the app could not use as written"
      :subtitle="problems.length > 0 ? 'Each is left out, or read with its default, until it is fixed in the workbook.' : undefined"
      collapse-id="settings.problems"
      :start-collapsed="problems.length === 0"
      :reveal="problems.length > 0"
      :summary="problems.length > 0 ? rowsInWords(problems.length, 'row', 'rows') : 'None, every row reads as written'"
    >
      <div class="px-4 pt-3 pb-4 sm:px-5 sm:pb-5">
        <ProblemList v-if="problems.length > 0" :problems="problems">
          <template #action="{ problem }">
            <UButton
              v-if="problem.tab === 'settings' && unreadKeys.get(problem.label) === 1"
              label="Remove the key"
              icon="i-lucide-trash-2"
              color="neutral"
              variant="ghost"
              size="sm"
              class="self-start sm:self-auto"
              :disabled="saving"
              :aria-label="`Remove ${problem.label} from the settings tab`"
              data-testid="remove-setting"
              @click="removeKey(problem.label)"
            />
            <p v-else-if="problem.tab === 'settings' && (unreadKeys.get(problem.label) ?? 0) > 1" class="text-xs text-muted sm:max-w-56" data-testid="setting-on-rows">
              Set on {{ unreadKeys.get(problem.label) }} rows. Keep one in the workbook, then remove it here.
            </p>
          </template>
        </ProblemList>
        <p v-else class="text-sm text-muted">Every row of the workbook reads as written.</p>
      </div>
    </AppCard>
  </div>
</template>
