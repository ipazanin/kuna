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
import { plural } from '../../../../shared/text/translation'
import { words } from './words'
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
  void writes.write(words.problems.removed, (unit) => removeSettings(unit, settingRecords.value, [key]), {
    description: words.problems.removedNote(key),
    failedTitle: words.problems.notRemoved,
  })
}

const saving = computed(() => writes.busy.value || state.writing)
</script>

<template>
  <div v-if="state.workbook" class="flex flex-col gap-6">
    <GeneralSettingsForm :settings="settings" :facts="packFacts" :saving="savingSettings || state.writing" @save="saveGeneral" />
    <component :is="card" v-for="(card, index) in pack.settingsCards" :key="index" />
    <AppCard
      :title="words.problems.title"
      :subtitle="problems.length > 0 ? words.problems.subtitle : undefined"
      collapse-id="settings.problems"
      :start-collapsed="problems.length === 0"
      :reveal="problems.length > 0"
      :summary="problems.length > 0 ? plural(words.problems.count(problems.length), problems.length) : words.problems.none"
    >
      <div class="px-4 pt-3 pb-4 sm:px-5 sm:pb-5">
        <ProblemList v-if="problems.length > 0" :problems="problems">
          <template #action="{ problem }">
            <UButton
              v-if="problem.tab === 'settings' && unreadKeys.get(problem.label) === 1"
              :label="words.problems.removeKey"
              icon="i-lucide-trash-2"
              color="neutral"
              variant="ghost"
              size="sm"
              class="self-start sm:self-auto"
              :disabled="saving"
              :aria-label="words.problems.removeKeyNamed(problem.label)"
              data-testid="remove-setting"
              @click="removeKey(problem.label)"
            />
            <p v-else-if="problem.tab === 'settings' && (unreadKeys.get(problem.label) ?? 0) > 1" class="text-xs text-muted sm:max-w-56" data-testid="setting-on-rows">
              {{ plural(words.problems.onRows(unreadKeys.get(problem.label) ?? 0), unreadKeys.get(problem.label) ?? 0) }}
            </p>
          </template>
        </ProblemList>
        <p v-else class="text-sm text-muted">{{ words.problems.allRead }}</p>
      </div>
    </AppCard>
  </div>
</template>
