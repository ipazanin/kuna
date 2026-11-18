<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { labelCalled, labelNameProblem } from '../../../../shared/categorising/domain/labels'
import type { Label } from '../../../../shared/categorising/domain/labels'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import USelectMenu from '@nuxt/ui/components/SelectMenu.vue'
import USwitch from '@nuxt/ui/components/Switch.vue'

import { rowsRulesWouldChange, writeRules } from '../application/statementWrites'
import type { RuleEdits } from '../application/statementWrites'
import RuleApplyDialog from './RuleApplyDialog.vue'
import { changesHeldRule } from './ruleAsk'
import type { RuleAsk } from './ruleAsk'
import { conditionField, conditionOfField } from './conditionFields'
import type { ConditionField } from './conditionFields'
import RuleConditionField from './RuleConditionField.vue'
import { words } from './words'
import { entryCategoryChoices } from '../../entries/presentation/categoryChoices'
import { addLabel } from '../../labels/application/labelWrites'
import { newLabel } from '../../labels/domain/labels'
import LabelsSelect from '../../../../shared/ui/LabelsSelect.vue'
import { loanTargets } from '../../links/application/loanRecords'
import { paidLoansIn } from '../../links/domain/linkTarget'
import { loanLinks } from '../../links/presentation/loanLinks'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import { isTransferCategory } from '../../workbook/domain/category'
import type { Category } from '../../workbook/domain/category'
import { rowLinkOf, rowLinkText } from '../../workbook/domain/rowLink'
import type { RowLink } from '../../workbook/domain/rowLink'
import { conditionProblem, ruleProblem } from '../../workbook/domain/spendingRule'
import type { RuleDraft, RuleWithdrawal, SpendingRule } from '../../workbook/domain/spendingRule'
import { words as spendingWords } from '../../words'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'

/**
 * Adds a rule or changes one: its conditions, every one of which must hold, the category it files under or none, the labels it
 * adds and whether it stops the rules after it. A rule into Between my accounts may spot cash taken out, and any other may name
 * the bank loan in Loans its rows pay, its category then holding the interest. Saving asks whether the rows already in the book
 * follow it, with how many would change.
 */
const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  /** The rule to change, or null to add one. */
  rule: SpendingRule | null
}>()

const store = useSpendingBooks()
const writes = useRecordWrites(store)

const NO_CATEGORY = 'none'
/** The picked category's id, or none for a rule that only labels, blank until one is picked, since a select item never holds a blank value. */
const picked = ref('')
const conditions = ref<ConditionField[]>([])
const labels = ref<readonly RecordId[]>([])
const created = ref<readonly Label[]>([])
const stop = ref(false)
const tried = ref(false)
/** Edits waiting for the person to say whether the rows already in the book follow them. */
const asking = ref<RuleAsk | null>(null)

/** What the money goes to under Between my accounts: another account, the cash account of its currency, or a cash account's id. */
const ANOTHER_ACCOUNT = 'another'
const CASH_BY_CURRENCY = 'cash'
const goesTo = ref(ANOTHER_ACCOUNT)
const NO_LOAN = 'none'
/** The loan the rows pay as its link reads, or none. */
const pays = ref(NO_LOAN)

const book = computed(() => store.state.workbook)
const categories = computed(() => book.value?.categories ?? [])
const accounts = computed(() => book.value?.accounts ?? [])
const labelChoices = computed(() => [...(book.value?.labels ?? []), ...created.value])
const pickedCategory = computed(() => categories.value.find((category) => category.id === picked.value) ?? null)
const isTransfer = computed(() => pickedCategory.value !== null && isTransferCategory(pickedCategory.value))
/** The open cash accounts, and the one the rule names though closed, so changing the rule does not drop it. */
const cashAccounts = computed(() => accounts.value.filter((account) => account.kind === 'cash' && (!account.closed || account.id === props.rule?.withdrawal?.cashAccount)))
const goesToItems = computed(() => [
  { value: ANOTHER_ACCOUNT, label: words.rules.dialog.anotherAccount },
  { value: CASH_BY_CURRENCY, label: words.rules.dialog.cashByCurrency },
  ...cashAccounts.value.map((account) => ({ value: account.id, label: account.name, description: account.currency })),
])
/**
 * The bank loans Loans has a plan of, and the loan the rule names though Loans no longer has it, so changing the rule does not
 * drop it. While Loans cannot be read the field is left out, and the rule keeps the loan it names.
 */
const loanItems = computed(() => {
  const targets = loanTargets()
  if (targets === null || typeof targets === 'string') return []
  const loans = paidLoansIn(targets)
  const named = props.rule?.link ?? null
  const kept = named === null || loans.some((loan) => rowLinkText(loan.link) === rowLinkText(named)) ? [] : [{ value: rowLinkText(named), label: words.rules.paysGone }]
  return [...loans.map((loan) => ({ value: rowLinkText(loan.link), label: loan.loanName })), ...kept]
})
const link = computed((): RowLink | null => (pickedCategory.value === null || isTransfer.value || pays.value === NO_LOAN ? null : rowLinkOf(pays.value)))
const withdrawal = computed((): RuleWithdrawal | null =>
  !isTransfer.value || goesTo.value === ANOTHER_ACCOUNT ? null : { cashAccount: cashAccounts.value.find((account) => account.id === goesTo.value)?.id ?? null },
)
const groupOf = (category: Category): Category | null => categories.value.find((candidate) => candidate.id === category.parent) ?? null
/** A category with the group it sits under, so Transport's Fuel and Boat's Fuel read apart. */
const namedWithGroup = (category: Category): string => [category.name, groupOf(category)?.name ?? ''].filter((part) => part !== '').join(' · ')
/** No category first, then the categories a rule can file into, each child with its group as its description. */
const categoryItems = computed(() => [
  [{ value: NO_CATEGORY, label: words.rules.dialog.noCategory }],
  ...entryCategoryChoices(categories.value, 'in', pickedCategory.value?.id ?? null, true).map((choices) =>
    choices.map((choice) => {
      const category = categories.value.find((candidate) => candidate.id === choice.value)
      const group = category === undefined ? null : groupOf(category)
      return group === null ? choice : { ...choice, description: group.name }
    }),
  ),
])

watch(open, (opened) => {
  if (!opened) return
  const { rule } = props
  picked.value = rule === null ? '' : (rule.category ?? NO_CATEGORY)
  conditions.value = rule === null ? [conditionField()] : rule.conditions.map(conditionField)
  labels.value = rule?.labels ?? []
  created.value = []
  stop.value = rule?.stop ?? false
  goesTo.value = rule?.withdrawal == null ? ANOTHER_ACCOUNT : (rule.withdrawal.cashAccount ?? CASH_BY_CURRENCY)
  pays.value = rule?.link == null ? NO_LOAN : rowLinkText(rule.link)
  tried.value = false
  asking.value = null
})

/** The labels with the one a typed name names: a label already there, or a new one Save adds. */
function withTyped(typed: string): void {
  const named = labelCalled(typed, labelChoices.value)
  const label = named ?? (labelNameProblem(typed, labelChoices.value, null) === null ? newLabel(typed) : null)
  if (label === null || labels.value.includes(label.id)) return
  if (named === null) created.value = [...created.value, label]
  labels.value = [...labels.value, label.id]
}

const typedConditions = computed(() => conditions.value.map(conditionOfField))
/** The rule the dialog states, or null while an amount does not read as one. */
const draft = computed((): RuleDraft | null => {
  const typed = typedConditions.value
  if (typed.some((condition) => condition === null)) return null
  return {
    conditions: typed.flatMap((condition) => (condition === null ? [] : [condition])),
    category: pickedCategory.value?.id ?? null,
    labels: labels.value,
    stop: stop.value,
    withdrawal: withdrawal.value,
    link: link.value,
  }
})

const errors = computed(() => {
  const problems = words.rules.dialog.problems
  const rule = draft.value === null ? null : ruleProblem(draft.value)
  return {
    category: picked.value === '' ? words.rules.dialog.pickCategory : rule === 'no-outcome' || rule === 'needs-category' ? problems[rule] : null,
    conditions: rule === 'no-condition' || rule === 'repeated-test' ? problems[rule] : null,
    each: typedConditions.value.map((condition) => {
      const problem = condition === null ? 'no-value' : conditionProblem(condition)
      return problem === null ? null : problems[problem]
    }),
  }
})

const failed = computed(() => errors.value.category !== null || errors.value.conditions !== null || errors.value.each.some((error) => error !== null))

/** Saves at once when no row already in the book would change, and otherwise asks whether they follow the rule. */
async function save(): Promise<void> {
  tried.value = true
  const current = book.value
  const ruled = draft.value
  if (current === null || ruled === null || failed.value) return
  const { rule } = props
  const edits: RuleEdits = rule === null ? { adding: [ruled] } : { changing: [{ rule, draft: ruled }] }
  const added = created.value.filter((label) => labels.value.includes(label.id))
  const alongside = (unit: UnitOfWork): void => added.forEach((label) => addLabel(unit, label))
  const written = rule === null && !changesHeldRule(current.rules, edits) ? words.rules.dialog.saved : words.rules.dialog.changed
  if (rowsRulesWouldChange(current, edits, loanLinks()) > 0) {
    asking.value = { edits, choice: 'apply', title: words.rules.apply.title, written, alongside }
    return
  }
  const saved = await writes.write(
    written,
    (unit) => {
      alongside(unit)
      writeRules(unit, current, edits, loanLinks())
    },
    { failedTitle: spendingWords.form.notSaved },
  )
  if (saved) open.value = false
}

function removeCondition(place: number): void {
  conditions.value = conditions.value.filter((_, at) => at !== place)
}
</script>

<template>
  <RuleApplyDialog
    v-model:open="open"
    :asked="asking"
    :title="rule === null ? words.rules.dialog.addTitle : words.rules.dialog.editTitle"
    :description="words.rules.dialog.description"
    back
    @back="asking = null"
  >
    <form id="spending-rule-dialog" class="flex flex-col gap-4" data-testid="spending-rule-dialog" @submit.prevent="save">
      <section class="flex flex-col gap-2" aria-labelledby="spending-rule-dialog-conditions">
        <p id="spending-rule-dialog-conditions" class="type-card-title">{{ words.rules.dialog.conditions }}</p>
        <ol class="flex flex-col gap-3">
          <RuleConditionField
            v-for="(field, place) in conditions"
            :key="field.key"
            v-model="conditions[place]!"
            :place="place + 1"
            :accounts="accounts"
            :error="tried ? (errors.each[place] ?? null) : null"
            @remove="removeCondition(place)"
          />
        </ol>
        <p v-if="tried && errors.conditions !== null" class="text-sm text-error" data-testid="spending-rule-dialog-conditions-error">{{ errors.conditions }}</p>
        <UButton
          :label="words.rules.dialog.addCondition"
          icon="i-lucide-plus"
          color="neutral"
          variant="outline"
          class="self-start"
          data-testid="spending-rule-dialog-add-condition"
          @click="conditions = [...conditions, conditionField()]"
        />
      </section>
      <UFormField :label="link === null ? words.rules.dialog.category : words.rules.dialog.interestUnder" :error="(tried && errors.category) || false">
        <USelectMenu v-model="picked" :items="categoryItems" value-key="value" :placeholder="words.rules.dialog.pickCategory" class="w-full" data-testid="spending-rule-dialog-category">
          <template v-if="pickedCategory !== null" #default>
            <span class="truncate">{{ namedWithGroup(pickedCategory) }}</span>
          </template>
        </USelectMenu>
      </UFormField>
      <UFormField v-if="isTransfer" :label="words.rules.dialog.goesTo" :help="words.rules.dialog.goesToHelp">
        <USelectMenu v-model="goesTo" :items="goesToItems" value-key="value" :search-input="false" class="w-full" data-testid="spending-rule-dialog-goes-to" />
      </UFormField>
      <UFormField v-if="loanItems.length > 0 && pickedCategory !== null && !isTransfer" :label="words.rules.dialog.pays" :help="link === null ? '' : words.rules.dialog.paysHelp">
        <USelectMenu
          v-model="pays"
          :items="[{ value: NO_LOAN, label: words.rules.dialog.noLoan }, ...loanItems]"
          value-key="value"
          :search-input="false"
          class="w-full"
          data-testid="spending-rule-dialog-pays"
        />
      </UFormField>
      <UFormField :label="words.rules.dialog.labels" :help="words.rules.dialog.labelsHelp">
        <LabelsSelect v-model="labels" :labels="labelChoices" :name="words.rules.dialog.labels" class="w-full" @create="withTyped" />
      </UFormField>
      <USwitch v-model="stop" :label="words.rules.dialog.stop" :description="words.rules.dialog.stopHelp" data-testid="spending-rule-dialog-stop" />
    </form>
    <template #end>
      <UButton :label="spendingWords.form.cancel" color="neutral" variant="ghost" data-testid="spending-rule-dialog-cancel" @click="open = false" />
      <UButton
        type="submit"
        form="spending-rule-dialog"
        :label="words.rules.dialog.save"
        icon="i-lucide-save"
        :loading="writes.saving('save')"
        :disabled="writes.refused.value"
        data-testid="spending-rule-dialog-save"
      />
    </template>
  </RuleApplyDialog>
</template>
