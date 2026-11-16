<script setup lang="ts">
import { computed, ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import USelectMenu from '@nuxt/ui/components/SelectMenu.vue'

import { linkEntry, unlinkEntry } from '../../entries/application/entryWrites'
import { loanTargets } from '../application/loanTargets'
import type { ShownTarget } from '../application/loanTargets'
import { beyondPlan, linkFiling, wholeLoanKindOf } from '../domain/instalmentSplit'
import { targetsFor } from '../domain/linkTarget'
import type { InformalLoanTarget } from '../domain/linkTarget'
import { LINK_TONE, useLinkLines } from './linkLine'
import { choiceText, words } from './words'
import { fixedCategoryIn, loanInterestCategoryIn } from '../../categories/domain/starterCategories'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import type { Category } from '../../workbook/domain/category'
import { isSplit, linkOfItems } from '../../workbook/domain/rowItems'
import { rowLinkText } from '../../workbook/domain/rowLink'
import type { Transaction } from '../../workbook/domain/transaction'
import type { TransactionItem } from '../../workbook/domain/transactionItem'
import { words as spendingWords } from '../../words'
import { absAccountMoney } from '../../../../shared/money/accountMoney'
import type { AccountMoney } from '../../../../shared/money/accountMoney'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import { formatAccountMoney, formatMoney } from '../../../../shared/money/moneyFormat'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import NoteLine from '../../../../shared/ui/NoteLine.vue'
import { language } from '../../../../shared/text/language'

/** A saved entry's link to a record in Loans: the record it names with Remove, or a picker of records to link it to with Add to Loans. */
const props = defineProps<{
  entry: Transaction
  /** The entry's items as the file holds them. */
  lines: readonly TransactionItem[]
  /** The currency of the entry's account, which the link compares with Loans' plan in. */
  currency: CurrencyCode
  /** True when a receipt split the entry. */
  receipt: boolean
  categories: readonly Category[]
  /** False for a transfer's leg or while the dialog edits a transfer, which links to nothing. */
  linkable: boolean
  /** True while the dialog holds changes not saved yet, which linking or leaving for Loans would lose. */
  edited: boolean
}>()

const emit = defineEmits<{
  /** The link was added or taken off, so the dialog closes. */
  done: []
  /** Add to Loans was picked, with the informal loans a movement can be added to. */
  addToLoans: [loans: readonly (ShownTarget & InformalLoanTarget)[]]
}>()

const store = useSpendingBooks()
const writes = useRecordWrites(store)

const linkLineOf = useLinkLines()
const heldLink = computed(() => linkOfItems(props.lines))
const split = computed(() => isSplit(props.lines))
const entryLink = computed(() => {
  const link = heldLink.value
  return link === null ? null : linkLineOf.value(link, { amount: props.entry.amount, currency: props.currency })
})

const loans = computed(() => loanTargets())
/** The records of Loans the entry can be linked to, none while it has a link or Loans is not open. */
const openTargets = computed((): readonly ShownTarget[] => {
  const held = loans.value
  return !props.linkable || heldLink.value !== null || held === null || typeof held === 'string' ? [] : held
})
const linkTargets = computed(() => targetsFor(props.entry, props.currency, openTargets.value))
const informalLoans = computed(() => openTargets.value.filter((target): target is ShownTarget & InformalLoanTarget => target.kind === 'informal-loan'))

/** What the picker says under each record: an instalment's share, or a movement's or extra payment's amount. */
function choiceDetail(target: (typeof linkTargets.value)[number]): string {
  if (target.kind === 'instalment') return target.interim ? words.interimShare(formatMoney(target.yourShare)) : formatMoney(target.yourShare)
  return target.kind === 'informal-loan' ? target.counterparty : formatMoney(target.amount)
}
const linkItems = computed(() => linkTargets.value.map((target) => ({ label: choiceText(target), value: rowLinkText(target.link), description: choiceDetail(target) })))
const pickedLink = ref('')
const pickedTarget = computed(() => linkTargets.value.find((target) => rowLinkText(target.link) === pickedLink.value) ?? null)

/** What linking the picked record does to the entry's money, said before the person links it. */
const linkNote = computed(() => {
  const target = pickedTarget.value
  if (target === null) return ''
  if (props.edited) return words.saveFirst
  const filing = linkFiling({ row: props.entry, items: props.lines }, target, { currency: props.currency, receipt: props.receipt, categories: props.categories })
  if (!filing.split && filing.why === 'principal')
    return [words.filesWhole(fixedCategoryIn(props.categories, wholeLoanKindOf(target), language).category.name), ...(split.value ? [words.replacesParts] : [])].join(' ')
  if (!filing.split) return words.whole[filing.why]
  const money = (amount: AccountMoney): string => formatAccountMoney(absAccountMoney(amount), props.currency)
  const category = props.categories.find((candidate) => candidate.id === filing.category)?.name ?? loanInterestCategoryIn(props.categories, language).category.name
  const beyond = beyondPlan(target, props.entry, props.currency) ?? 0
  const differs = beyond === 0 ? null : (beyond > 0 ? words.paidMore : words.paidLess)(money(beyond), category)
  return [words.splits(money(filing.interest), money(filing.principal)), differs, split.value ? words.replacesParts : null].filter((sentence): sentence is string => sentence !== null).join(' ')
})

/** Links the entry to the picked record in Loans, which splits an instalment off into interest and principal, with Undo. */
async function addLink(): Promise<void> {
  const records = store.state.records
  const target = pickedTarget.value
  if (records === null || target === null) return
  const place = { currency: props.currency, categories: props.categories, language, notes: words.notes }
  if (await writes.write(words.linked, (unit) => linkEntry(unit, records, props.entry, target, place), { key: 'link', failedTitle: spendingWords.form.notSaved })) emit('done')
}

/** Takes the entry's link off, with Undo. The entry keeps its category and its parts. */
async function removeLink(): Promise<void> {
  const records = store.state.records
  if (records === null) return
  if (await writes.write(words.removed, (unit) => unlinkEntry(unit, records, props.entry), { key: 'remove-link', failedTitle: spendingWords.form.notSaved })) emit('done')
}
</script>

<template>
  <UFormField v-if="entryLink !== null" :label="words.label" class="sm:col-span-2" data-testid="spending-entry-link">
    <div class="flex flex-col items-start gap-1">
      <NoteLine as="span" size="body" :tone="LINK_TONE[entryLink.look]" :icon="entryLink.icon">{{ entryLink.text }}</NoteLine>
      <div class="flex flex-wrap gap-2">
        <UButton v-if="entryLink.to !== null" :to="entryLink.to" :label="words.open" color="neutral" variant="link" :disabled="edited" class="px-0" data-testid="spending-entry-link-open" />
        <UButton
          :label="words.remove"
          icon="i-lucide-unlink"
          color="neutral"
          variant="ghost"
          :loading="writes.saving('remove-link')"
          :disabled="writes.busy.value || writes.refused.value"
          data-testid="spending-entry-link-remove"
          @click="removeLink"
        />
      </div>
    </div>
  </UFormField>
  <UFormField v-else-if="linkItems.length > 0 || informalLoans.length > 0" :label="words.pickLabel" class="sm:col-span-2" data-testid="spending-entry-link-pick">
    <div class="flex flex-col items-start gap-2">
      <USelectMenu v-if="linkItems.length > 0" v-model="pickedLink" :items="linkItems" value-key="value" :placeholder="words.pick" class="w-full" data-testid="spending-entry-link-target" />
      <div class="flex flex-wrap gap-2">
        <UButton
          v-if="linkItems.length > 0"
          :label="words.link"
          icon="i-lucide-link"
          color="neutral"
          variant="outline"
          :loading="writes.saving('link')"
          :disabled="pickedTarget === null || edited || writes.busy.value || writes.refused.value"
          data-testid="spending-entry-link-add"
          @click="addLink"
        />
        <UButton
          v-if="informalLoans.length > 0"
          :label="words.add.open"
          icon="i-lucide-plus"
          color="neutral"
          variant="ghost"
          :disabled="edited || writes.refused.value"
          data-testid="spending-entry-add-to-loans"
          @click="emit('addToLoans', informalLoans)"
        />
      </div>
      <p v-if="linkNote !== ''" class="type-caption" data-testid="spending-entry-link-note">{{ linkNote }}</p>
    </div>
  </UFormField>
</template>
