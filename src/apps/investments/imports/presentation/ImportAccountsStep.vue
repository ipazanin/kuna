<script setup lang="ts">
import { computed } from 'vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USelect from '@nuxt/ui/components/Select.vue'

import type { AccountStep, SettledImport } from './importChoices'
import type { WorkbookImport } from './useWorkbookImport'
import { words } from './words'
import { plural } from '../../../../shared/text/translation'
import FormGrid from '../../../../shared/ui/FormGrid.vue'

/** Each account of the workbook, named as a new account or matched to one Kuna has. */
const props = defineProps<{
  workbookImport: WorkbookImport
  settled: SettledImport
}>()

/** The choice of a new account, which no record id can be, since an id names its kind. */
const NEW = 'new'

const items = computed(() => [
  { value: NEW, label: words.accounts.newAccount },
  ...(props.workbookImport.book.value?.accounts ?? []).map((account) => ({ value: account.id as string, label: account.name })),
])

function pick(step: AccountStep, value: string): void {
  const account = props.workbookImport.book.value?.accounts.find((candidate) => candidate.id === value)
  props.workbookImport.choose('accounts', step.question.account, account === undefined ? { kind: 'new', name: step.question.proposedName } : { kind: 'existing', account: account.id })
}

function name(step: AccountStep, text: string): void {
  props.workbookImport.choose('accounts', step.question.account, { kind: 'new', name: text })
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
            <USelect
              :model-value="step.choice.kind === 'new' ? NEW : step.choice.account"
              :items="items"
              class="w-full"
              data-testid="import-account-choice"
              @update:model-value="pick(step, String($event))"
            />
          </UFormField>
          <UFormField v-if="step.choice.kind === 'new'" :label="words.accounts.name" :help="words.accounts.nameHelp" :error="step.problem ?? false">
            <UInput :model-value="step.choice.name" class="w-full" data-testid="import-account-name" @update:model-value="name(step, String($event))" />
          </UFormField>
        </FormGrid>
      </li>
    </ul>
  </div>
</template>
