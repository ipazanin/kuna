<script setup lang="ts">
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USelect from '@nuxt/ui/components/Select.vue'

import type { AccountChoice, AccountStep, SettledImport } from '../domain/importChoices'
import type { WorkbookImport } from './useWorkbookImport'
import { words } from './words'
import { intakeRefusalText } from '../../holdings/application/intakeRefusals'
import { plural } from '../../../../shared/text/translation'
import DayField from '../../../../shared/ui/DayField.vue'
import FormGrid from '../../../../shared/ui/FormGrid.vue'

/** Each account of the workbook, named as a new account or matched to one Kuna has. A mailed report offers the accounts the mail fills, and a new one with its start day. */
const props = defineProps<{
  workbookImport: WorkbookImport
  settled: SettledImport
  /** Whether Next was pressed once, so a start day's message shows. */
  tried: boolean
}>()

/** The choice of a new account, which no record id can be, since an id names its kind. */
const NEW = 'new'

function itemsOf(step: AccountStep): { value: string; label: string }[] {
  return [{ value: NEW, label: words.accounts.newAccount }, ...step.offered.map((account) => ({ value: account.id as string, label: account.name }))]
}

function pick(step: AccountStep, value: string): void {
  const account = step.offered.find((candidate) => candidate.id === value)
  props.workbookImport.choose('accounts', step.question.account, account === undefined ? { kind: 'new', name: step.question.proposedName } : { kind: 'existing', account: account.id })
}

/** The new account's choice with one field as typed, keeping the other. */
function newChoice(step: AccountStep, typed: Partial<Omit<Extract<AccountChoice, { kind: 'new' }>, 'kind'>>): AccountChoice {
  const kept = step.choice.kind === 'new' ? step.choice : { kind: 'new' as const, name: step.question.proposedName }
  return { ...kept, ...(step.startsOn === null ? {} : { startsOn: step.startsOn }), ...typed, kind: 'new' }
}

function startError(step: AccountStep): string | false {
  const fault = step.startFault
  if (fault === null || !props.tried) return false
  return fault.kind === 'missing' ? words.accounts.startsOnMissing : intakeRefusalText(fault.refusal)
}

function likelyLine(step: AccountStep): string {
  const likely = step.question.likely
  const account = props.workbookImport.book.value?.accounts.find((candidate) => candidate.id === likely?.account)
  return likely === null || account === undefined ? '' : plural(words.accounts.likely(likely.rows, account.name), likely.rows)
}

function name(step: AccountStep, text: string): void {
  props.workbookImport.choose('accounts', step.question.account, newChoice(step, { name: text }))
}

function startOn(step: AccountStep, text: string): void {
  props.workbookImport.choose('accounts', step.question.account, newChoice(step, { startsOn: text }))
}
</script>

<template>
  <div class="flex flex-col gap-4" data-testid="import-accounts">
    <p class="type-body">{{ words.accounts.intro }}</p>
    <ul class="flex flex-col">
      <li v-for="step in settled.accounts" :key="step.question.account" class="flex flex-col gap-3 border-t border-default py-4" data-testid="import-account">
        <p class="flex flex-wrap items-baseline justify-between gap-x-3">
          <span class="type-label">{{ [step.question.broker, step.question.account].filter((part) => part !== '').join(' · ') }}</span>
          <span class="type-caption">{{ plural(words.accounts.rows(step.question.rows), step.question.rows) }}</span>
        </p>
        <FormGrid>
          <UFormField :label="words.accounts.kunaAccount">
            <template v-if="likelyLine(step) !== ''" #description>
              <span data-testid="import-account-likely">{{ likelyLine(step) }}</span>
            </template>
            <USelect
              :model-value="step.choice.kind === 'new' ? NEW : step.choice.account"
              :items="itemsOf(step)"
              class="w-full"
              data-testid="import-account-choice"
              @update:model-value="pick(step, String($event))"
            />
          </UFormField>
          <UFormField v-if="step.choice.kind === 'new'" :label="words.accounts.name" :help="words.accounts.nameHelp" :error="step.nameMissing && words.accounts.nameMissing">
            <UInput :model-value="step.choice.name" class="w-full" data-testid="import-account-name" @update:model-value="name(step, String($event))" />
          </UFormField>
          <UFormField v-if="step.choice.kind === 'new' && step.startsOn !== null" :label="words.accounts.startsOn" :help="words.accounts.startsOnHelp" :error="startError(step)">
            <DayField :model-value="step.startsOn" class="w-full" data-testid="import-account-starts-on" @update:model-value="startOn(step, String($event))" />
          </UFormField>
        </FormGrid>
      </li>
    </ul>
  </div>
</template>
