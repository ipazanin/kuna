import type { RuleTabRow } from '../../rules/domain/readRules'
import type { SettingRow } from '../../settings/domain/settings'
import type { AccountRecord } from './accountsReading'
import type { BillingItem } from './billingPlan'
import type { CategoryRecord } from './categoriesReading'
import type { ClientRecord } from './clientsReading'
import type { Dismissal } from './dismissals'
import type { LedgerEntry } from './ledgerReading'
import { recordKind } from '../../../../shared/storage/domain/recordKind'
import type { SplitTabRow } from './splitsReading'
import type { Invoice } from './workbook'

export const LEDGER_RECORDS = recordKind<LedgerEntry>('ledger-row', 'ledger row', 'ledger rows')
export const CATEGORY_RECORDS = recordKind<CategoryRecord>('category', 'category', 'categories')
export const ACCOUNT_RECORDS = recordKind<AccountRecord>('account', 'account', 'accounts', 'an')
export const SETTING_RECORDS = recordKind<SettingRow>('setting', 'setting', 'settings')
export const RULE_RECORDS = recordKind<RuleTabRow>('rule', 'rule', 'rules')
export const INVOICE_RECORDS = recordKind<Invoice>('invoice', 'invoice', 'invoices', 'an')
export const CLIENT_RECORDS = recordKind<ClientRecord>('client', 'client', 'clients')
export const BILLING_RECORDS = recordKind<BillingItem>('billing-item', 'plan row', 'plan rows')
export const SPLIT_PART_RECORDS = recordKind<SplitTabRow>('split-part', 'split part', 'split parts')
export const DISMISSAL_RECORDS = recordKind<Dismissal>('dismissal', 'dismissed suggestion', 'dismissed suggestions')
