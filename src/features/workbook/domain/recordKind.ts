import type { RuleTabRow } from '../../rules/domain/readRules'
import type { SettingRow } from '../../settings/domain/settings'
import type { AccountRecord } from './accountsReading'
import type { BillingItem } from './billingPlan'
import type { CategoryRecord } from './categoriesReading'
import type { ClientRow } from './clientsReading'
import type { Dismissal } from './dismissals'
import type { LedgerEntry } from './ledgerReading'
import type { SplitTabRow } from './splitsReading'
import type { Invoice } from './workbook'

/** What one record is called in a sentence, such as "an invoice" and "3 invoices". */
export interface RecordNoun {
  readonly one: string
  readonly many: string
  readonly article: 'a' | 'an'
}

/** A kind of record the workbook holds, whose records are of type `R`. Its name starts every `RecordId` of the kind. */
export interface RecordKind<R = unknown> {
  readonly name: string
  readonly noun: RecordNoun
  readonly __record?: R
}

export function recordKind<R>(name: string, one: string, many: string, article: RecordNoun['article'] = 'a'): RecordKind<R> {
  return { name, noun: { one, many, article } }
}

export const LEDGER_RECORDS = recordKind<LedgerEntry>('ledger-row', 'ledger row', 'ledger rows')
export const CATEGORY_RECORDS = recordKind<CategoryRecord>('category', 'category', 'categories')
export const ACCOUNT_RECORDS = recordKind<AccountRecord>('account', 'account', 'accounts', 'an')
export const SETTING_RECORDS = recordKind<SettingRow>('setting', 'setting', 'settings')
export const RULE_RECORDS = recordKind<RuleTabRow>('rule', 'rule', 'rules')
export const INVOICE_RECORDS = recordKind<Invoice>('invoice', 'invoice', 'invoices', 'an')
export const CLIENT_RECORDS = recordKind<ClientRow>('client-iban', 'client row', 'client rows')
export const BILLING_RECORDS = recordKind<BillingItem>('billing-item', 'plan row', 'plan rows')
export const SPLIT_PART_RECORDS = recordKind<SplitTabRow>('split-part', 'split part', 'split parts')
export const DISMISSAL_RECORDS = recordKind<Dismissal>('dismissal', 'dismissed suggestion', 'dismissed suggestions')
