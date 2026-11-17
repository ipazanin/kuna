<script setup lang="ts">
import { computed } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USelectMenu from '@nuxt/ui/components/SelectMenu.vue'
import USwitch from '@nuxt/ui/components/Switch.vue'
import UTextarea from '@nuxt/ui/components/Textarea.vue'

import { inputOf } from './conditionFields'
import type { ConditionField } from './conditionFields'
import { words } from './words'
import type { Account } from '../../workbook/domain/account'
import { CONDITION_TESTS } from '../../workbook/domain/spendingRule'
import { CURRENCY_CODES } from '../../../../shared/money/currencyCode'
import MoneyInput from '../../../../shared/ui/MoneyInput.vue'

/** One condition of a rule: what it tests, the values it takes, and whether it is turned around. */
const field = defineModel<ConditionField>({ required: true })

const props = defineProps<{
  /** Its place in the rule, from 1, which a screen reader names it by. */
  place: number
  accounts: readonly Account[]
  /** Why the condition cannot be kept, shown once the person tried to save, or null. */
  error: string | null
}>()

defineEmits<{ remove: [] }>()

const testItems = CONDITION_TESTS.map((test) => ({ value: test, label: words.rules.tests[test] }))
const accountItems = computed(() => props.accounts.map((account) => ({ value: account.id as string, label: account.name })))
const currencyItems = [...CURRENCY_CODES]
const input = computed(() => inputOf(field.value.test))
const linesHelp = computed(() =>
  field.value.test.endsWith('_matches') ? words.rules.dialog.patternHelp : field.value.test === 'iban_is' ? words.rules.dialog.ibanHelp : words.rules.dialog.valuesHelp,
)
const accounts = computed({
  get: () => [...field.value.accounts] as string[],
  set: (ids: string[]) => {
    field.value.accounts = props.accounts.filter((account) => ids.includes(account.id)).map((account) => account.id)
  },
})
</script>

<template>
  <li class="flex flex-col gap-3 border-b border-default pb-3" data-testid="spending-rule-condition">
    <div class="flex items-end gap-2">
      <UFormField :label="words.rules.dialog.test" :error="input === 'none' ? (error ?? false) : false" class="min-w-0 flex-1">
        <USelectMenu v-model="field.test" :items="testItems" value-key="value" :search-input="false" class="w-full" data-testid="spending-rule-condition-test" />
      </UFormField>
      <UButton
        icon="i-lucide-x"
        color="neutral"
        variant="ghost"
        class="shrink-0 justify-center"
        :aria-label="words.rules.dialog.removeCondition(place)"
        data-testid="spending-rule-condition-remove"
        @click="$emit('remove')"
      />
    </div>
    <UFormField v-if="input === 'lines'" :label="words.rules.dialog.values" :help="linesHelp" :error="error ?? false">
      <UTextarea v-model="field.lines" :rows="2" autoresize class="w-full" data-testid="spending-rule-condition-values" />
    </UFormField>
    <UFormField v-else-if="input === 'amount'" :label="words.rules.dialog.amount" :help="words.rules.dialog.amountHelp" :error="error ?? false">
      <MoneyInput v-model="field.amount" class="w-full" data-testid="spending-rule-condition-amount" />
    </UFormField>
    <UFormField v-else-if="input === 'accounts'" :label="words.rules.dialog.accounts" :error="error ?? false">
      <USelectMenu v-model="accounts" :items="accountItems" value-key="value" multiple :search-input="false" class="w-full" data-testid="spending-rule-condition-accounts" />
    </UFormField>
    <UFormField v-else-if="input === 'currencies'" :label="words.rules.dialog.currencies" :error="error ?? false">
      <USelectMenu v-model="field.currencies" :items="currencyItems" multiple class="w-full" data-testid="spending-rule-condition-currencies" />
    </UFormField>
    <UFormField v-else-if="input === 'days'" :error="error ?? false">
      <div class="grid grid-cols-2 gap-3">
        <UFormField :label="words.rules.dialog.from">
          <UInput v-model="field.from" type="number" inputmode="numeric" min="1" max="31" class="w-full" data-testid="spending-rule-condition-from" />
        </UFormField>
        <UFormField :label="words.rules.dialog.to">
          <UInput v-model="field.to" type="number" inputmode="numeric" min="1" max="31" class="w-full" data-testid="spending-rule-condition-to" />
        </UFormField>
      </div>
    </UFormField>
    <USwitch v-model="field.not" :label="words.rules.dialog.not" :description="words.rules.dialog.notHelp" data-testid="spending-rule-condition-not" />
  </li>
</template>
