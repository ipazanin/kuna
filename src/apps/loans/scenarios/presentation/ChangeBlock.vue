<script setup lang="ts">
import { computed } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import URadioGroup from '@nuxt/ui/components/RadioGroup.vue'
import USelectMenu from '@nuxt/ui/components/SelectMenu.vue'

import ChangeRateFields from './ChangeRateFields.vue'
import CostFields from './CostFields.vue'
import FoldBlock from '../../bankLoans/presentation/FoldBlock.vue'
import { words } from './words'
import type { ChangeErrors } from './words'
import type { ChangeTexts } from '../domain/changeTexts'
import type { YearlyRate } from '../../bankLoans/domain/yearlyRate'
import { useLoanWords } from '../../bankLoans/presentation/useLoanWords'
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

const loanWords = useLoanWords()
const effectItems = computed(() => EXTRA_PAYMENT_EFFECTS.map((effect) => ({ value: effect, ...loanWords.value.extraDialog.effects[effect] })))
const EVERY_ITEMS = [
  { value: 'month', label: words.editor.month },
  { value: 'year', label: words.editor.year },
]

const shown = (error: string | null | undefined): string | false => (props.tried && error) || false
</script>

<template>
  <FoldBlock
    v-model:open="open"
    :title="words.editor.kinds[texts.kind]"
    :caption="summary ?? words.editor.unfinished"
    :warning="summary === null && tried"
    toggle-test-id="scenario-change-toggle"
    :data-change="texts.kind"
    data-testid="scenario-change"
  >
    <template #actions>
      <UButton icon="i-lucide-trash-2" color="neutral" variant="ghost" :aria-label="words.editor.remove(words.editor.kinds[texts.kind])" data-testid="scenario-change-remove" @click="emit('remove')" />
    </template>
    <FormGrid>
      <UFormField v-if="texts.kind === 'extra-payment'" :label="words.editor.paidOn" :error="shown(errors.date)">
        <UInput v-model="texts.date" type="date" class="w-full" data-testid="scenario-change-date" />
      </UFormField>
      <UFormField
        v-else
        class="sm:col-span-2"
        :label="texts.kind === 'move' ? loanWords.changeFields.on : loanWords.ratePeriodDialog.from"
        :error="shown(errors.due)"
        v-bind="texts.kind === 'move' ? { help: loanWords.changeFields.onHelp } : {}"
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
      <UFormField v-if="texts.kind === 'term-change'" :label="loanWords.changeFields.instalmentsLeft" :error="shown(errors.instalments)">
        <UInput v-model="texts.instalments" inputmode="numeric" class="w-full" data-testid="scenario-change-instalments" />
      </UFormField>
      <template v-if="texts.kind === 'move'">
        <UFormField
          :label="loanWords.changeFields.instalments"
          :error="shown(errors.instalments)"
          :help="leftAfter === null ? loanWords.loanDialog.instalmentsHelp : plural(loanWords.changeFields.instalmentsHelp(leftAfter), leftAfter)"
        >
          <UInput v-model="texts.instalments" inputmode="numeric" class="w-full" data-testid="scenario-change-instalments" />
        </UFormField>
        <CostFields v-model="texts.costs" :tried="tried" test-prefix="scenario-change" />
      </template>
      <URadioGroup v-if="texts.kind === 'extra-payment' || texts.kind === 'regular-extra-payment'" v-model="texts.effect" :items="effectItems" :legend="words.editor.effect" class="sm:col-span-2" />
    </FormGrid>
  </FoldBlock>
</template>
