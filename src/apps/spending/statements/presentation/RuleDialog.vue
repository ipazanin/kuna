<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USelectMenu from '@nuxt/ui/components/SelectMenu.vue'
import UTextarea from '@nuxt/ui/components/Textarea.vue'

import { changeRule, writeRulesInto } from '../application/statementWrites'
import { typedCondition, typedConditions } from '../domain/typedConditions'
import { ruleTestOf } from './ruleTest'
import { words } from './words'
import { entryCategoryChoices } from '../../entries/presentation/categoryChoices'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import { isTransferCategory } from '../../workbook/domain/category'
import type { Category } from '../../workbook/domain/category'
import { sameCondition } from '../../workbook/domain/spendingRule'
import type { RuleWithdrawal, SpendingRule } from '../../workbook/domain/spendingRule'
import { words as spendingWords } from '../../words'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import { plural } from '../../../../shared/text/translation'
import AppDialog from '../../../../shared/ui/AppDialog.vue'

/** Adds the payees and IBANs typed, one rule to a line, to a category in one write, or changes one rule. A rule into Between my accounts may spot cash taken out. */
const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  /** The rule to change, or null to add rules. */
  rule: SpendingRule | null
  /** The category new rules go in, or null to pick one. */
  category: Category | null
}>()

const store = useSpendingBooks()
const writes = useRecordWrites(store)

/** The picked category's id, blank until one is picked, since a select item never holds a blank value. */
const picked = ref('')
const typed = ref('')
const tried = ref(false)

/** What the money goes to under Between my accounts: another account, the cash account of its currency, or a cash account's id. */
const ANOTHER_ACCOUNT = 'another'
const CASH_BY_CURRENCY = 'cash'
const goesTo = ref(ANOTHER_ACCOUNT)

const book = computed(() => store.state.workbook)
const categories = computed(() => book.value?.categories ?? [])
const pickedCategory = computed(() => categories.value.find((category) => category.id === picked.value) ?? null)
const isTransfer = computed(() => pickedCategory.value !== null && isTransferCategory(pickedCategory.value))
/** The open cash accounts, and the one the rule names though closed, so changing the rule does not drop it. */
const cashAccounts = computed(() => (book.value?.accounts ?? []).filter((account) => account.kind === 'cash' && (!account.closed || account.id === props.rule?.withdrawal?.cashAccount)))
const goesToItems = computed(() => [
  { value: ANOTHER_ACCOUNT, label: words.rules.dialog.anotherAccount },
  { value: CASH_BY_CURRENCY, label: words.rules.dialog.cashByCurrency },
  ...cashAccounts.value.map((account) => ({ value: account.id, label: account.name, description: account.currency })),
])
const withdrawal = computed((): RuleWithdrawal | null =>
  !isTransfer.value || goesTo.value === ANOTHER_ACCOUNT ? null : { cashAccount: cashAccounts.value.find((account) => account.id === goesTo.value)?.id ?? null },
)
const groupOf = (category: Category): Category | null => categories.value.find((candidate) => candidate.id === category.parent) ?? null
/** A category with the group it sits under, so Transport's Fuel and Boat's Fuel read apart. */
const namedWithGroup = (category: Category): string => [category.name, groupOf(category)?.name ?? ''].filter((part) => part !== '').join(' · ')
/** The categories a rule can file into, each child with its group as its description. */
const categoryItems = computed(() =>
  entryCategoryChoices(categories.value, 'in', pickedCategory.value?.id ?? null, true).map((choices) =>
    choices.map((choice) => {
      const category = categories.value.find((candidate) => candidate.id === choice.value)
      const group = category === undefined ? null : groupOf(category)
      return group === null ? choice : { ...choice, description: group.name }
    }),
  ),
)

watch(open, (opened) => {
  if (!opened) return
  const { rule } = props
  picked.value = rule?.category ?? props.category?.id ?? ''
  typed.value = rule === null ? '' : rule.condition.column === 'counterparty_iban' ? rule.condition.iban : rule.condition.fragment
  goesTo.value = rule?.withdrawal == null ? ANOTHER_ACCOUNT : (rule.withdrawal.cashAccount ?? CASH_BY_CURRENCY)
  tried.value = false
})

/** Each line typed, with the rule that already tests it, if any. */
const lines = computed(() => {
  const rules = book.value?.rules ?? []
  return typedConditions(typed.value).map((condition) => ({ condition, held: rules.find((rule) => sameCondition(rule.condition, condition)) ?? null }))
})
const fresh = computed(() => lines.value.filter(({ held }) => held === null || held.category !== picked.value).map(({ condition }) => condition))

function noteOf(held: SpendingRule | null): string | null {
  if (held === null) return null
  if (held.category === picked.value) return words.rules.dialog.already
  return words.rules.dialog.moves(categories.value.find((category) => category.id === held.category)?.name ?? '')
}

/** The condition the rule being changed is to test. */
const changed = computed(() => typedCondition(typed.value))

function linesError(): string | null {
  if (props.rule !== null ? changed.value === null : lines.value.length === 0) return words.rules.dialog.aLine
  return props.rule === null && fresh.value.length === 0 ? words.rules.dialog.nothingNew : null
}

const errors = computed(() => ({ category: pickedCategory.value === null ? words.rules.dialog.pickCategory : null, lines: linesError() }))

async function save(): Promise<void> {
  tried.value = true
  const current = book.value
  const category = pickedCategory.value
  if (current === null || category === null || errors.value.lines !== null) return
  const { rule } = props
  const condition = changed.value
  const conditions = fresh.value
  const written =
    rule === null
      ? await writes.write(plural(words.rules.dialog.saved(conditions.length), conditions.length), (unit) => writeRulesInto(unit, current, conditions, category.id, withdrawal.value), {
          failedTitle: spendingWords.form.notSaved,
        })
      : condition !== null &&
        (await writes.write(words.rules.dialog.changed, (unit) => changeRule(unit, current, rule, condition, category.id, withdrawal.value), { failedTitle: spendingWords.form.notSaved }))
  if (written) open.value = false
}
</script>

<template>
  <AppDialog v-model:open="open" changes :title="rule === null ? words.rules.dialog.addTitle : words.rules.dialog.editTitle" :description="rule === null ? words.rules.dialog.description : undefined">
    <form id="spending-rule-dialog" class="flex flex-col gap-4" data-testid="spending-rule-dialog" @submit.prevent="save">
      <UFormField :label="words.rules.dialog.category" :error="(tried && errors.category) || false">
        <USelectMenu v-model="picked" :items="categoryItems" value-key="value" :placeholder="words.rules.dialog.pickCategory" class="w-full" data-testid="spending-rule-dialog-category">
          <template v-if="pickedCategory !== null" #default>
            <span class="truncate">{{ namedWithGroup(pickedCategory) }}</span>
          </template>
        </USelectMenu>
      </UFormField>
      <UFormField v-if="isTransfer" :label="words.rules.dialog.goesTo" :help="words.rules.dialog.goesToHelp">
        <USelectMenu v-model="goesTo" :items="goesToItems" value-key="value" :search-input="false" class="w-full" data-testid="spending-rule-dialog-goes-to" />
      </UFormField>
      <UFormField v-if="rule !== null" :label="words.rules.dialog.line" :help="words.rules.dialog.lineHelp" :error="(tried && errors.lines) || false">
        <UInput v-model="typed" class="w-full" data-testid="spending-rule-dialog-line" />
      </UFormField>
      <template v-else>
        <UFormField :label="words.rules.dialog.lines" :help="words.rules.dialog.linesHelp" :error="(tried && errors.lines) || false">
          <UTextarea v-model="typed" :rows="4" autoresize class="w-full" data-testid="spending-rule-dialog-lines" />
        </UFormField>
        <div v-if="lines.length > 0" class="flex flex-col gap-1">
          <p id="spending-rule-dialog-read-as" class="type-label">{{ words.rules.dialog.readAs }}</p>
          <ul class="flex flex-col gap-1" aria-labelledby="spending-rule-dialog-read-as" data-testid="spending-rule-dialog-read">
            <li v-for="{ condition, held } in lines" :key="ruleTestOf(condition)" class="flex flex-col" data-testid="spending-rule-dialog-read-line">
              <span class="break-words text-sm text-highlighted">{{ ruleTestOf(condition) }}</span>
              <span v-if="noteOf(held) !== null" class="break-words type-caption">{{ noteOf(held) }}</span>
            </li>
          </ul>
        </div>
      </template>
    </form>
    <template #end>
      <UButton :label="spendingWords.form.cancel" color="neutral" variant="ghost" data-testid="spending-rule-dialog-cancel" @click="open = false" />
      <UButton
        type="submit"
        form="spending-rule-dialog"
        :label="rule === null && fresh.length > 0 ? plural(words.rules.dialog.save(fresh.length), fresh.length) : words.rules.dialog.saveChange"
        icon="i-lucide-save"
        :loading="writes.saving('save')"
        :disabled="writes.refused.value"
        data-testid="spending-rule-dialog-save"
      />
    </template>
  </AppDialog>
</template>
