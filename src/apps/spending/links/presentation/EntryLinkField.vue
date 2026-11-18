<script setup lang="ts">
import { computed, ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import USelectMenu from '@nuxt/ui/components/SelectMenu.vue'

import { linkEntry, unlinkEntry } from '../../entries/application/entryWrites'
import { allTargets } from '../application/linkTargets'
import type { ShownTarget } from '../application/linkTargets'
import { categoryOfHome } from '../domain/companyPaymentFiling'
import type { CompanyPaymentSplit } from '../domain/companyPaymentFiling'
import { beyondPlan, linkFiling, wholeLoanKindOf } from '../domain/instalmentSplit'
import { targetsFor } from '../domain/linkTarget'
import type { InformalLoanTarget } from '../domain/linkTarget'
import { LINK_TONE, useLinkLines } from './linkLine'
import { choiceText, words } from './words'
import { fixedCategoryIn, loanInterestCategoryIn } from '../../categories/domain/starterCategories'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import type { Category } from '../../workbook/domain/category'
import { isSplit, linksOfItems } from '../../workbook/domain/rowItems'
import { rowLinkText } from '../../workbook/domain/rowLink'
import type { RowLink } from '../../workbook/domain/rowLink'
import type { Transaction } from '../../workbook/domain/transaction'
import type { TransactionItem } from '../../workbook/domain/transactionItem'
import { words as spendingWords } from '../../words'
import { absAccountMoney, sumAccountMoney } from '../../../../shared/money/accountMoney'
import type { AccountMoney } from '../../../../shared/money/accountMoney'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import { formatAccountMoney, formatMoney } from '../../../../shared/money/moneyFormat'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import NoteLine from '../../../../shared/ui/NoteLine.vue'
import { language } from '../../../../shared/text/language'
import { listInWords } from '../../../../shared/text/listInWords'

/** A saved entry's links to records in other apps: each record its parts name with Remove, or a picker of Loans' records and Company's payments to link it to, with Add to Loans. */
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
const split = computed(() => isSplit(props.lines))
/** Each record the entry's parts link to, read against the money of the parts that link to it. */
const entryLinks = computed(() =>
  linksOfItems(props.lines).map(({ link, items }) => ({
    link,
    key: rowLinkText(link),
    line: linkLineOf.value(link, { amount: sumAccountMoney(items.map((item) => item.amount)), currency: props.currency }),
  })),
)

const apps = computed(() => allTargets())
/** The kinds of app set up that the picker names. */
const pickSources = computed(() => [...new Set(apps.value.filter(({ targets }) => targets !== null).map(({ source }) => source))])
/** The records the entry can be linked to in each app that is open, none while it has a link. */
const openTargets = computed((): readonly ShownTarget[] =>
  !props.linkable || entryLinks.value.length > 0 ? [] : apps.value.flatMap(({ targets }) => (targets === null || typeof targets === 'string' ? [] : targets)),
)
/** The entry's account as the file holds it, whose IBAN tells which payments with your company it can be. */
const account = computed(() => ({ currency: props.currency, iban: store.state.workbook?.accounts.find((held) => held.id === props.entry.account)?.iban ?? '' }))
const linkTargets = computed(() => targetsFor(props.entry, account.value, openTargets.value))
const informalLoans = computed(() => openTargets.value.filter((target): target is ShownTarget & InformalLoanTarget => target.kind === 'informal-loan'))

/** What the picker says under each record: an instalment's share, or a movement's or extra payment's amount. */
function choiceDetail(target: (typeof linkTargets.value)[number]): string {
  if (target.kind === 'instalment') return target.interim ? words.interimShare(formatMoney(target.yourShare)) : formatMoney(target.yourShare)
  return target.kind === 'informal-loan' ? target.counterparty : formatMoney(target.amount)
}

/** Where linking to a payment with your company files each of the entry's parts, and how the entry differs from the payment. */
function paymentNote(filing: CompanyPaymentSplit): string {
  const money = (amount: AccountMoney): string => formatAccountMoney(absAccountMoney(amount), props.currency)
  const nameOf = (id: string | null): string | null => (id === null ? null : (props.categories.find((category) => category.id === id)?.name ?? null))
  const parts = filing.parts.map(({ home, amount }) => {
    const name = home === null ? null : home === 'difference' ? nameOf(filing.rowCategory) : categoryOfHome(home, props.categories, { language }).category.name
    return name === null ? words.company.waits(money(amount)) : words.company.under(money(amount), name)
  })
  const difference = filing.parts.find((part) => part.home === 'difference')?.amount ?? 0
  const differs = difference === 0 ? null : (difference > 0 === props.entry.amount > 0 ? words.company.more : words.company.less)(money(difference))
  return [words.company.files(listInWords(parts)), differs, split.value ? words.replacesParts : null].filter((sentence): sentence is string => sentence !== null).join(' ')
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
  if (filing.split === 'payment') return paymentNote(filing)
  if (target.kind === 'owner-payment') return filing.split ? '' : words.whole[filing.why]
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

/** Takes the link off the entry's parts that carry it, with Undo. The entry keeps its category and its parts. */
async function removeLink(link: RowLink): Promise<void> {
  const records = store.state.records
  if (records === null) return
  if (await writes.write(words.removed, (unit) => unlinkEntry(unit, records, props.entry, link), { key: `remove-link-${rowLinkText(link)}`, failedTitle: spendingWords.form.notSaved })) emit('done')
}
</script>

<template>
  <template v-if="entryLinks.length > 0">
    <UFormField v-for="{ key, link, line } in entryLinks" :key="key" :label="words.label" class="sm:col-span-2" data-testid="spending-entry-link">
      <div class="flex flex-col items-start gap-1">
        <NoteLine as="span" size="body" :tone="LINK_TONE[line.look]" :icon="line.icon">{{ line.text }}</NoteLine>
        <div class="flex flex-wrap gap-2">
          <UButton
            v-if="line.to !== null"
            :to="line.to"
            :label="line.source === 'company' ? words.company.open : words.open"
            color="neutral"
            variant="link"
            :disabled="edited"
            class="px-0"
            data-testid="spending-entry-link-open"
          />
          <UButton
            :label="words.remove"
            icon="i-lucide-unlink"
            color="neutral"
            variant="ghost"
            :loading="writes.saving(`remove-link-${key}`)"
            :disabled="writes.busy.value || writes.refused.value"
            data-testid="spending-entry-link-remove"
            @click="removeLink(link)"
          />
        </div>
      </div>
    </UFormField>
  </template>
  <UFormField v-else-if="linkItems.length > 0 || informalLoans.length > 0" :label="words.pickLabel" class="sm:col-span-2" data-testid="spending-entry-link-pick">
    <div class="flex flex-col items-start gap-2">
      <USelectMenu
        v-if="linkItems.length > 0"
        v-model="pickedLink"
        :items="linkItems"
        value-key="value"
        :placeholder="words.pick(pickSources)"
        class="w-full"
        data-testid="spending-entry-link-target"
      />
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
