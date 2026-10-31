<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import URadioGroup from '@nuxt/ui/components/RadioGroup.vue'
import USelectMenu from '@nuxt/ui/components/SelectMenu.vue'

import ChangeRateFields from './ChangeRateFields.vue'
import type { ChangeErrors, ChangeTexts } from './changeTexts'
import CostFields from './CostFields.vue'
import { words } from './words'
import type { YearlyRate } from '../../bankLoans/domain/yearlyRate'
import { words as bankWords } from '../../bankLoans/presentation/words'
import { EXTRA_PAYMENT_EFFECTS } from '../../workbook/domain/extraPayment'
import { words as loansWords } from '../../words'
import { plural } from '../../../../shared/text/translation'
import FormGrid from '../../../../shared/ui/FormGrid.vue'
import MoneyInput from '../../../../shared/ui/MoneyInput.vue'

/** One change of a scenario as a bordered block: its kind and what it does, opening to its fields. */
const texts = defineModel<ChangeTexts>({ required: true })
const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  tried: boolean
  errors: ChangeErrors
  /** The due dates a change can start on. */
  dueItems: readonly { readonly label: string; readonly value: string }[]
  /** What the change does in a sentence, or null while a field is wrong. */
  summary: string | null
  /** The rate in force on the change's due date, for a rate's quick fills. */
  currentRate: YearlyRate | null
  /** The instalments the old loan has left after the due date of a move. */
  leftAfter: number | null
}>()

const emit = defineEmits<{
  remove: []
}>()

const EFFECT_ITEMS = EXTRA_PAYMENT_EFFECTS.map((effect) => ({ value: effect, ...bankWords.extraDialog.effects[effect] }))
const EVERY_ITEMS = [
  { value: 'month', label: words.editor.month },
  { value: 'year', label: words.editor.year },
]

const shown = (error: string | null | undefined): string | false => (props.tried && error) || false
</script>

<template>
  <div class="rounded-lg border" :class="open ? 'border-accented' : 'border-default'" :data-change="texts.kind" data-testid="scenario-change">
    <div class="flex items-center justify-between gap-2 py-2 ps-3 pe-2">
      <button
        type="button"
        class="min-w-0 flex-1 text-start"
        :aria-expanded="open"
        :aria-label="words.editor.open(words.editor.kinds[texts.kind])"
        data-testid="scenario-change-toggle"
        @click="open = !open"
      >
        <span class="block text-sm font-medium text-highlighted">{{ words.editor.kinds[texts.kind] }}</span>
        <span class="block type-caption" :class="{ 'text-warning': summary === null && tried }">{{ summary ?? words.editor.unfinished }}</span>
      </button>
      <UButton icon="i-lucide-trash-2" color="neutral" variant="ghost" :aria-label="words.editor.remove(words.editor.kinds[texts.kind])" data-testid="scenario-change-remove" @click="emit('remove')" />
    </div>
    <FormGrid v-if="open" class="px-3 pt-1 pb-3">
      <UFormField v-if="texts.kind === 'extra-payment'" :label="words.editor.paidOn" :error="shown(errors.date)">
        <UInput v-model="texts.date" type="date" class="w-full" data-testid="scenario-change-date" />
      </UFormField>
      <UFormField
        v-else
        class="sm:col-span-2"
        :label="texts.kind === 'move' ? words.editor.on : words.editor.from"
        :error="shown(errors.due)"
        v-bind="texts.kind === 'move' ? { help: words.editor.onHelp } : {}"
      >
        <USelectMenu
          v-model="texts.due"
          :items="[...dueItems]"
          value-key="value"
          :placeholder="words.editor.chooseDue"
          :search-input="{ placeholder: words.editor.searchDue }"
          class="w-full"
          data-testid="scenario-change-due"
        />
      </UFormField>
      <UFormField v-if="texts.kind === 'regular-extra-payment'" :label="words.editor.until" :error="shown(errors.until)" :help="words.editor.untilHelp">
        <UInput v-model="texts.until" type="date" class="w-full" data-testid="scenario-change-until" />
      </UFormField>
      <UFormField v-if="texts.kind === 'extra-payment' || texts.kind === 'regular-extra-payment'" :label="words.editor.amount" :error="shown(errors.amount)">
        <MoneyInput v-model="texts.amount" :placeholder="loansWords.form.amountPlaceholder" class="w-full" data-testid="scenario-change-amount" />
      </UFormField>
      <URadioGroup
        v-if="texts.kind === 'regular-extra-payment'"
        v-model="texts.every"
        :items="EVERY_ITEMS"
        :legend="words.editor.every"
        orientation="horizontal"
        class="sm:col-span-2"
        data-testid="scenario-change-every"
      />
      <UFormField v-if="texts.kind === 'move'" :label="words.editor.lender">
        <UInput v-model="texts.lender" :placeholder="words.editor.lenderPlaceholder" class="w-full" data-testid="scenario-change-lender" />
      </UFormField>
      <ChangeRateFields v-if="texts.kind === 'rate-change' || texts.kind === 'move'" v-model="texts.rate" :tried="tried" :current="currentRate" test-prefix="scenario-change" />
      <template v-if="texts.kind === 'move'">
        <UFormField
          :label="words.editor.instalments"
          :error="shown(errors.instalments)"
          :help="leftAfter === null ? bankWords.loanDialog.instalmentsHelp : plural(words.editor.instalmentsHelp(leftAfter), leftAfter)"
        >
          <UInput v-model="texts.instalments" inputmode="numeric" class="w-full" data-testid="scenario-change-instalments" />
        </UFormField>
        <CostFields v-model="texts.costs" :tried="tried" test-prefix="scenario-change" />
      </template>
      <URadioGroup v-if="texts.kind === 'extra-payment' || texts.kind === 'regular-extra-payment'" v-model="texts.effect" :items="EFFECT_ITEMS" :legend="words.editor.effect" class="sm:col-span-2" />
    </FormGrid>
  </div>
</template>
