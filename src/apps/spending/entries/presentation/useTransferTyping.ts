import { computed } from 'vue'
import type { Ref } from 'vue'

import { words } from './words'
import { feeSide, transferAmounts } from '../domain/transfer'
import type { TransferDraft } from '../domain/transfer'
import type { Account } from '../../workbook/domain/account'
import type { Transaction } from '../../workbook/domain/transaction'
import { typedAccountAmount } from '../../../../shared/money/accountMoney'
import type { AccountMoney } from '../../../../shared/money/accountMoney'

/** What the entry dialog's fields give a transfer: both accounts, the rows already on each side, and the amounts as typed. */
export interface TransferTyping {
  readonly kind: Ref<'out' | 'in' | 'transfer'>
  readonly from: Ref<Account | null>
  readonly to: Ref<Account | null>
  readonly rowOnFrom: Ref<Transaction | null>
  readonly rowOnTo: Ref<Transaction | null>
  readonly sent: Ref<string>
  readonly arrived: Ref<string>
  readonly lessArrived: Ref<boolean>
}

/** An amount typed above zero, or null. */
export function positiveAmount(text: string): AccountMoney | null {
  const typed = typedAccountAmount(text)
  return typed === null || typed <= 0 ? null : typed
}

/**
 * The transfer the entry dialog's fields type, read through the domain's rule: whether the accounts' currencies differ, the
 * account a fee row would go on when less arrives in one currency, the draft Save writes, and why the arrived amount cannot be kept.
 */
export function useTransferTyping(typing: TransferTyping) {
  const { kind, from, to, rowOnFrom, rowOnTo, sent, arrived, lessArrived } = typing
  const isTransfer = computed(() => kind.value === 'transfer')
  const twoCurrencies = computed(() => isTransfer.value && from.value !== null && to.value !== null && from.value.currency !== to.value.currency)
  const feeOn = computed(() => {
    if (!isTransfer.value || twoCurrencies.value || from.value === null || to.value === null) return null
    const side = feeSide({ account: from.value, row: rowOnFrom.value }, { account: to.value, row: rowOnTo.value })
    return side === null ? null : side === 'to' ? to.value : from.value
  })
  const arrivedTyped = computed(() => twoCurrencies.value || (lessArrived.value && feeOn.value !== null))
  const draft = computed((): TransferDraft | null => {
    const typedSent = positiveAmount(sent.value)
    if (!isTransfer.value || from.value === null || to.value === null || typedSent === null) return null
    return {
      from: { account: from.value, row: rowOnFrom.value },
      to: { account: to.value, row: rowOnTo.value },
      sent: typedSent,
      arrived: arrivedTyped.value ? positiveAmount(arrived.value) : null,
    }
  })
  const amounts = computed(() => (draft.value === null ? null : transferAmounts(draft.value)))
  const fee = computed(() => (amounts.value === null || 'refused' in amounts.value ? null : (amounts.value.fee?.amount ?? null)))
  const arrivedError = computed(() => {
    if (arrivedTyped.value && positiveAmount(arrived.value) === null) return words.dialog.anAmount
    return amounts.value !== null && 'refused' in amounts.value && amounts.value.refused === 'arrived-above-sent' ? words.dialog.arrivedAboveSent : null
  })
  return { twoCurrencies, feeOn, draft, fee, arrivedError }
}
