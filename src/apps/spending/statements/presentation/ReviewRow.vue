<script lang="ts">
/** What a To review row's buttons write. */
export type ReviewAction = 'file' | 'join' | 'pair' | 'link' | 'share'
</script>

<script setup lang="ts">
import { computed } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import USelectMenu from '@nuxt/ui/components/SelectMenu.vue'

import type { WaitingRow } from '../domain/reviewQueue'
import type { InstalmentOffer } from '../../links/domain/instalmentOffers'
import type { OwnerPaymentOffer } from '../../links/domain/ownerPaymentOffers'
import type { CashMovementOffer } from '../../links/domain/cashMovementOffers'
import { choiceText, instalmentText, words as linkWords } from '../../links/presentation/words'
import { words } from './words'
import { rowCaption, rowTitle } from './rowParts'
import { entryCategoryChoices, pickedFilingOf } from '../../entries/presentation/categoryChoices'
import { words as sharedCostWords } from '../../sharedCosts/presentation/words'
import type { SharedCost } from '../../workbook/domain/sharedCost'
import { entryAsked } from '../../entries/presentation/entryAsked'
import { words as entryWords } from '../../entries/presentation/words'
import ReceiptCameraButton from '../../receipts/presentation/ReceiptCameraButton.vue'
import type { Account } from '../../workbook/domain/account'
import type { Category } from '../../workbook/domain/category'
import AskChatButton from '../../../../shared/ai/presentation/AskChatButton.vue'
import { useChatElement } from '../../../../shared/ai/presentation/chatDock'
import type { AskedElement } from '../../../../shared/ai/presentation/chatDock'
import { formatAccountMoney } from '../../../../shared/money/moneyFormat'
import { EURO } from '../../../../shared/money/currencyCode'
import { absAccountMoney } from '../../../../shared/money/accountMoney'
import type { AccountMoney } from '../../../../shared/money/accountMoney'
import type { CashMovementTarget } from '../../links/domain/linkTarget'
import ListRow from '../../../../shared/ui/ListRow.vue'
import NoteLine from '../../../../shared/ui/NoteLine.vue'
import AccountMoneyText from '../../accounts/presentation/AccountMoneyText.vue'

/** One row waiting for a category: picking one files it, or a tap picks the row while rows are being selected, the chat can be asked about it or given its receipt beside the picker, and what the file offers for it sits underneath. */
const props = defineProps<{
  waiting: WaitingRow
  categories: readonly Category[]
  accounts: readonly Account[]
  /** What a rule would file this row under, offered beside joining it with what you typed. */
  ruleCategory: Category | null
  /** An instalment in Loans this row may pay, a payment in Company or a deposit or withdrawal in Investments it may be, which Link links it to. */
  offer: InstalmentOffer | OwnerPaymentOffer | CashMovementOffer | null
  takesReceipt: boolean
  /** Whether it is picked while rows are being selected, or null while its own controls file it. */
  picked: boolean | null
  /** Whether the row's write of that kind is saving, so the button that started it spins. */
  saving: (action: ReviewAction) => boolean
  /** The shared costs the row's picker offers, none for a row that cannot join one. */
  sharedCosts: readonly { readonly sharedCost: SharedCost; readonly name: string }[]
  /** The one shared cost not settled that money in may be a repayment for, or null. */
  repayment: { readonly sharedCost: SharedCost; readonly name: string } | null
}>()

const emit = defineEmits<{
  file: [category: Category]
  join: []
  pair: []
  link: []
  share: [sharedCost: SharedCost]
  receipt: [entry: AskedElement]
  pick: []
}>()

const accountOf = (id: string): Account | undefined => props.accounts.find((account) => account.id === id)

const account = computed(() => accountOf(props.waiting.row.account))
const currency = computed(() => account.value?.currency ?? EURO)
const asked = computed(() => entryAsked(props.waiting.row, account.value))
const { ask, marked } = useChatElement(asked, 'row')

const items = computed(() => entryCategoryChoices(props.categories, props.waiting.row.amount < 0 ? 'out' : 'in', null, { withTransfer: true, sharedCosts: props.sharedCosts }))

const typedLine = computed(() => {
  const match = props.waiting.maybeTyped
  if (match === null) return null
  return match.difference === 0 ? words.review.maybeApart(match.typed.date) : words.review.maybeDifferent(formatAccountMoney(absAccountMoney(match.difference), currency.value))
})

const offerLine = computed(() => {
  const offer = props.offer
  if (offer === null) return null
  if (isCashMovementOffer(offer)) return cashMovementLine(offer.target, offer.difference)
  if (offer.target.kind === 'owner-payment') {
    const payment = choiceText(offer.target)
    if (offer.difference === 0) return (offer.suggested ? linkWords.companyOffer.is : linkWords.companyOffer.mayBeAnotherDay)(payment)
    const amount = formatAccountMoney(absAccountMoney(offer.difference), currency.value)
    const more = offer.difference > 0 === props.waiting.row.amount > 0
    return linkWords.companyOffer.mayBe(payment, (more ? linkWords.companyOffer.more : linkWords.companyOffer.less)(amount))
  }
  const instalment = instalmentText(offer.target)
  if (offer.difference === 0) return (offer.suggested ? linkWords.offer.pays : linkWords.offer.mayPayAnotherDay)(instalment)
  const amount = formatAccountMoney(absAccountMoney(offer.difference), currency.value)
  return linkWords.offer.mayPay(instalment, (offer.difference < 0 ? linkWords.above : linkWords.below)(amount))
})

function isCashMovementOffer(offer: NonNullable<typeof props.offer>): offer is CashMovementOffer {
  return offer.target.kind === 'cash-movement'
}

/** A deposit or a withdrawal the row may be, with how much more or less arrived. */
function cashMovementLine(target: CashMovementTarget, difference: AccountMoney): string {
  const movement = (target.movement === 'deposit' ? linkWords.investmentsOffer.deposit : linkWords.investmentsOffer.withdrawal)(target.accountName, target.day)
  if (difference === 0) return linkWords.investmentsOffer.is(movement)
  return linkWords.investmentsOffer.mayBe(movement, (difference > 0 ? linkWords.investments.more : linkWords.investments.less)(formatAccountMoney(absAccountMoney(difference), currency.value)))
}

const transferLine = computed(() => {
  const pair = props.waiting.maybeTransfer
  if (pair === null) return null
  const other = pair.debit === props.waiting.row ? pair.credit : pair.debit
  return words.review.maybeTransfer(accountOf(other.account)?.name ?? '')
})

function chose(id: string | undefined): void {
  const picked = pickedFilingOf(
    id ?? '',
    props.categories,
    props.sharedCosts.map(({ sharedCost }) => sharedCost),
  )
  if (picked === null) return
  if ('sharedCost' in picked) emit('share', props.sharedCosts.find(({ sharedCost }) => sharedCost.id === picked.sharedCost)!.sharedCost)
  else
    emit(
      'file',
      props.categories.find((candidate) => candidate.id === picked.category)!,
    )
}
</script>

<template>
  <ListRow :title="rowTitle(waiting.row)" :caption="rowCaption(waiting.row, account)" :picked="picked" v-bind="marked" data-testid="spending-review-row" @pick="emit('pick')">
    <template #amount>
      <AccountMoneyText :cents="waiting.row.amount" :currency="currency" tone="flow" />
    </template>
    <template v-if="waiting.row.pending" #details>
      <NoteLine as="span" tone="muted" icon="i-lucide-clock" data-testid="spending-review-row-pending">{{ entryWords.notBookedYet }}</NoteLine>
    </template>
    <div class="flex items-center gap-2">
      <USelectMenu
        :items="items"
        value-key="value"
        :placeholder="words.review.category"
        :aria-label="words.review.pickCategory"
        class="min-w-0 flex-1 sm:w-72 sm:flex-none"
        data-testid="spending-review-category"
        @update:model-value="chose"
      />
      <AskChatButton :label="asked.label" icon-only class="shrink-0" data-testid="spending-review-row-ask" @ask="ask" />
      <ReceiptCameraButton :label="asked.label" :available="takesReceipt" testid="spending-review-row-receipt" class="shrink-0" @take="emit('receipt', asked)" />
    </div>
    <div v-if="typedLine !== null" class="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span class="min-w-0 flex-1 basis-48 type-aside" data-testid="spending-review-maybe-typed">{{ typedLine }}</span>
      <UButton color="neutral" variant="outline" :label="words.review.join" :loading="saving('join')" data-testid="spending-review-join" @click="emit('join')" />
    </div>
    <div v-if="ruleCategory !== null" class="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span class="min-w-0 flex-1 basis-48 type-aside" data-testid="spending-review-rule-says">{{ words.review.ruleSays(ruleCategory.name) }}</span>
      <UButton color="neutral" variant="outline" :label="words.review.fileAsRule" :loading="saving('file')" data-testid="spending-review-file-as-rule" @click="emit('file', ruleCategory!)" />
    </div>
    <div v-if="offerLine !== null" class="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span class="min-w-0 flex-1 basis-48 type-aside" data-testid="spending-review-offer">{{ offerLine }}</span>
      <UButton color="neutral" variant="outline" icon="i-lucide-link" :label="linkWords.link" :loading="saving('link')" data-testid="spending-review-link" @click="emit('link')" />
    </div>
    <div v-if="repayment !== null" class="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span class="min-w-0 flex-1 basis-48 type-aside" data-testid="spending-review-repayment">{{ sharedCostWords.mayRepay(repayment.name) }}</span>
      <UButton
        color="neutral"
        variant="outline"
        icon="i-lucide-users"
        :label="sharedCostWords.putIn"
        :loading="saving('share')"
        data-testid="spending-review-share"
        @click="emit('share', repayment!.sharedCost)"
      />
    </div>
    <div v-if="transferLine !== null" class="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span class="min-w-0 flex-1 basis-48 type-aside" data-testid="spending-review-maybe-transfer">{{ transferLine }}</span>
      <UButton color="neutral" variant="outline" :label="words.review.pair" :loading="saving('pair')" data-testid="spending-review-pair" @click="emit('pair')" />
    </div>
  </ListRow>
</template>
