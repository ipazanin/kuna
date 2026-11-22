<script setup lang="ts">
import { computed, ref } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USelect from '@nuxt/ui/components/Select.vue'

import { parseCivilDate, today } from '../../../../shared/calendar/civilDate'
import { NO_RECORDS } from '../../../../shared/storage/domain/recordsRead'
import AppDialog from '../../../../shared/ui/AppDialog.vue'
import DayField from '../../../../shared/ui/DayField.vue'
import FormGrid from '../../../../shared/ui/FormGrid.vue'
import { BANK_PRESETS } from '../../mail/domain/bankPresets'
import { setSettings } from '../../settings/application/settingWrites'
import { words as settingsWords } from '../../settings/presentation/words'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { ACCOUNT_WRITES } from '../../settings/application/namedRecordWrites'
import { installedPack } from '../../packs/packContribution'
import { accountsTheStatementsFill, firstMailDay, mailDeliveryRows, OTHER_BANK, statementMailProblems } from '../domain/statementsChoice'
import type { StatementMail, StatementMailProblem } from '../domain/statementsChoice'
import { words as mailWords } from '../../../../shared/mail/domain/words'
import { words } from './words'

/**
 * How later statements reach the books once the first one is in: from the bank's mail, which each sync reads into the ledger.
 * Saving writes the settings, and the next sync asks Google for Gmail read.
 */
const open = defineModel<boolean>('open', { required: true })
const store = useWorkbook()
const fileRefused = computed(() => store.savedByNewerApp())
const text = words.delivery

const BANKS = [...BANK_PRESETS.map((preset) => ({ label: preset.name, value: preset.id })), { label: text.anotherBank, value: OTHER_BANK }]

const mail = ref<StatementMail>({ bank: BANK_PRESETS[0]!.id, from: '', subject: '', since: null })
const saving = ref(false)
const failure = ref<string | null>(null)

const preset = computed(() => BANK_PRESETS.find((candidate) => candidate.id === mail.value.bank) ?? null)
const problems = computed(() => statementMailProblems(mail.value))
const ready = computed(() => problems.value.from === undefined && problems.value.subject === undefined)

/** A field's problem in words, or false for none, as a form field's error takes it. */
function problemText(problem: StatementMailProblem | undefined, missing: string): string | false {
  if (problem === undefined) return false
  return problem === 'missing' ? missing : mailWords.searchFault(problem)
}
const since = computed(() => mail.value.since ?? firstMailDay(today()))

function chooseMail(changes: Partial<StatementMail>): void {
  mail.value = { ...mail.value, ...changes }
}

async function save(): Promise<void> {
  saving.value = true
  failure.value = null
  try {
    const rows = mailDeliveryRows(mail.value)
    const filled = accountsTheStatementsFill(store.state.workbook?.accounts ?? [], store.state.workbook?.transactions ?? [], since.value, installedPack().firstOpenDay(today()))
    const accounts = store.state.records?.accounts.records ?? []
    await store.write(settingsWords.saved, (unit) => {
      setSettings(unit, store.state.records?.settings ?? NO_RECORDS, rows)
      for (const { slug, sources } of filled) {
        const before = accounts.find((stored) => stored.record.slug === slug)?.record
        if (before !== undefined) unit.of(ACCOUNT_WRITES).change(before, { ...before, sources })
      }
    })
    open.value = false
  } catch (refused) {
    failure.value = refused instanceof Error ? refused.message : String(refused)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <AppDialog v-model:open="open" changes :title="text.title" :description="text.description" :dismissible="!saving">
    <div class="flex flex-col gap-4" data-testid="statement-delivery">
      <p class="type-body">{{ text.mailNote }}</p>
      <FormGrid data-testid="statement-delivery-mail">
        <UFormField :label="text.bank" :help="preset ? text.bankMail(preset.senders, preset.subject) : text.typeBelow">
          <USelect :model-value="mail.bank" :items="BANKS" class="w-full" data-testid="statement-delivery-bank" @update:model-value="chooseMail({ bank: String($event) })" />
        </UFormField>
        <UFormField :label="text.since" :help="text.sinceHelp">
          <DayField :model-value="since" class="w-full" data-testid="statement-delivery-since" @update:model-value="chooseMail({ since: parseCivilDate($event) })" />
        </UFormField>
        <template v-if="mail.bank === OTHER_BANK">
          <UFormField :label="text.from" :error="problemText(problems.from, text.typeSender)" class="sm:col-span-2">
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
          <UFormField :label="text.subject" :help="text.subjectHelp" :error="problemText(problems.subject, text.typeSubject)" class="sm:col-span-2">
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
      <UButton :label="text.saveMail" :loading="saving" :disabled="!ready || fileRefused" data-testid="statement-delivery-save" @click="save" />
    </template>
  </AppDialog>
</template>
