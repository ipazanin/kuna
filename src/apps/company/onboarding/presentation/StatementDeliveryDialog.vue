<script setup lang="ts">
import { computed, ref } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import URadioGroup from '@nuxt/ui/components/RadioGroup.vue'
import USelect from '@nuxt/ui/components/Select.vue'

import { parseCivilDate, today } from '../../../../shared/calendar/civilDate'
import { withGoogleAccess } from '../../../../shared/google/withGoogleAccess'
import { NO_RECORDS } from '../../../../shared/storage/domain/recordsRead'
import AppDialog from '../../../../shared/ui/AppDialog.vue'
import DayField from '../../../../shared/ui/DayField.vue'
import FormGrid from '../../../../shared/ui/FormGrid.vue'
import { BANK_PRESETS } from '../../mail/domain/bankPresets'
import { setSettings } from '../../settings/application/settingWrites'
import { words as settingsWords } from '../../settings/presentation/words'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { firstMailDay, folderDeliveryRows, mailDeliveryRows, MAIL_STATEMENTS_FOLDER, OTHER_BANK, statementMailProblems } from '../domain/statementsChoice'
import type { StatementMail } from '../domain/statementsChoice'
import { words } from './words'

/**
 * How statements reach the books once the first one is in, by mail or from a Drive folder. Saving writes the settings and makes the folder
 * mail goes into. The tap that opens this asks Google for the books file, and the next sync asks for what the settings need.
 */
const open = defineModel<boolean>('open', { required: true })
const store = useWorkbook()
const text = words.delivery

type Delivery = 'mail' | 'folder'
const CHOICES: { label: string; description: string; value: Delivery }[] = [
  { label: text.mail, description: text.mailNote, value: 'mail' },
  { label: text.folder, description: text.folderNote, value: 'folder' },
]
const BANKS = [...BANK_PRESETS.map((preset) => ({ label: preset.name, value: preset.id })), { label: text.anotherBank, value: OTHER_BANK }]

const delivery = ref<Delivery>('mail')
const mail = ref<StatementMail>({ bank: BANK_PRESETS[0]!.id, from: '', subject: '', since: null })
const saving = ref(false)
const failure = ref<string | null>(null)

const preset = computed(() => BANK_PRESETS.find((candidate) => candidate.id === mail.value.bank) ?? null)
const problems = computed(() => (delivery.value === 'mail' ? statementMailProblems(mail.value) : {}))
const ready = computed(() => problems.value.from === undefined && problems.value.subject === undefined)
const since = computed(() => mail.value.since ?? firstMailDay(today()))

function chooseMail(changes: Partial<StatementMail>): void {
  mail.value = { ...mail.value, ...changes }
}

async function rowsOfChoice(): Promise<readonly { readonly key: string; readonly value: string }[] | null> {
  if (delivery.value === 'mail') {
    await withGoogleAccess(['drive.file'], () => store.folderBesideFile(MAIL_STATEMENTS_FOLDER))
    return mailDeliveryRows(mail.value, today())
  }
  const chosen = await withGoogleAccess(['drive.readonly'], () => store.pickDriveFolder(text.pickerTitle))
  if (chosen === null) return null
  if (chosen.path === null) throw new Error(text.noDriveRead)
  return folderDeliveryRows(chosen.path)
}

async function save(): Promise<void> {
  saving.value = true
  failure.value = null
  try {
    const rows = await rowsOfChoice()
    if (rows !== null) {
      await store.write(settingsWords.saved, (unit) => setSettings(unit, store.state.records?.settings ?? NO_RECORDS, rows))
      open.value = false
    }
  } catch (refused) {
    failure.value = refused instanceof Error ? refused.message : String(refused)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <AppDialog v-model:open="open" :title="text.title" :description="text.description" :dismissible="!saving">
    <div class="flex flex-col gap-4" data-testid="statement-delivery">
      <URadioGroup v-model="delivery" :items="CHOICES" :legend="text.title" :ui="{ legend: 'sr-only', fieldset: 'gap-3' }" data-testid="statement-delivery-choice" />
      <FormGrid v-if="delivery === 'mail'" data-testid="statement-delivery-mail">
        <UFormField :label="text.bank" :help="preset ? text.bankMail(preset.senders, preset.subject) : text.typeBelow">
          <USelect :model-value="mail.bank" :items="BANKS" class="w-full" data-testid="statement-delivery-bank" @update:model-value="chooseMail({ bank: String($event) })" />
        </UFormField>
        <UFormField :label="text.since" :help="text.sinceHelp">
          <DayField :model-value="since" class="w-full" data-testid="statement-delivery-since" @update:model-value="chooseMail({ since: parseCivilDate($event) })" />
        </UFormField>
        <template v-if="mail.bank === OTHER_BANK">
          <UFormField :label="text.from" :error="problems.from ?? false" class="sm:col-span-2">
            <UInput
              :model-value="mail.from"
              inputmode="email"
              autocapitalize="off"
              :spellcheck="false"
              placeholder="statements@bank.example"
              class="w-full"
              data-testid="statement-delivery-from"
              @update:model-value="chooseMail({ from: String($event) })"
            />
          </UFormField>
          <UFormField :label="text.subject" :help="text.subjectHelp" :error="problems.subject ?? false" class="sm:col-span-2">
            <UInput
              :model-value="mail.subject"
              :placeholder="text.subjectPlaceholder"
              class="w-full"
              data-testid="statement-delivery-subject"
              @update:model-value="chooseMail({ subject: String($event) })"
            />
          </UFormField>
        </template>
      </FormGrid>
      <UAlert v-if="failure" icon="i-lucide-triangle-alert" color="error" variant="subtle" :title="text.failed" :description="failure" data-testid="statement-delivery-failed" />
    </div>
    <template #end>
      <UButton :label="text.cancel" color="neutral" variant="ghost" :disabled="saving" @click="open = false" />
      <UButton :label="delivery === 'mail' ? text.saveMail : text.chooseFolder" :loading="saving" :disabled="!ready" data-testid="statement-delivery-save" @click="save" />
    </template>
  </AppDialog>
</template>
