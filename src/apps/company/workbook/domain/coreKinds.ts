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

export const LEDGER_RECORDS = recordKind<LedgerEntry>('ledger-row', {
  en: { one: 'ledger row', many: 'ledger rows', article: 'a' },
  hr: { one: 'stavka evidencije', of: 'stavke evidencije', few: 'stavke evidencije', other: 'stavki evidencije', gender: 'feminine' },
})
export const CATEGORY_RECORDS = recordKind<CategoryRecord>('category', {
  en: { one: 'category', many: 'categories', article: 'a' },
  hr: { one: 'kategorija', of: 'kategorije', few: 'kategorije', other: 'kategorija', gender: 'feminine' },
})
export const ACCOUNT_RECORDS = recordKind<AccountRecord>('account', {
  en: { one: 'account', many: 'accounts', article: 'an' },
  hr: { one: 'račun u banci', of: 'računa u banci', few: 'računa u banci', other: 'računa u banci', gender: 'masculine' },
})
export const SETTING_RECORDS = recordKind<SettingRow>('setting', {
  en: { one: 'setting', many: 'settings', article: 'a' },
  hr: { one: 'postavka', of: 'postavke', few: 'postavke', other: 'postavki', gender: 'feminine' },
})
export const RULE_RECORDS = recordKind<RuleTabRow>('rule', {
  en: { one: 'rule', many: 'rules', article: 'a' },
  hr: { one: 'pravilo', of: 'pravila', few: 'pravila', other: 'pravila', gender: 'neuter' },
})
export const INVOICE_RECORDS = recordKind<Invoice>('invoice', {
  en: { one: 'invoice', many: 'invoices', article: 'an' },
  hr: { one: 'račun', of: 'računa', few: 'računa', other: 'računa', gender: 'masculine' },
})
export const CLIENT_RECORDS = recordKind<ClientRecord>('client', {
  en: { one: 'client', many: 'clients', article: 'a' },
  hr: { one: 'klijent', of: 'klijenta', few: 'klijenta', other: 'klijenata', gender: 'masculine' },
})
export const BILLING_RECORDS = recordKind<BillingItem>('billing-item', {
  en: { one: 'plan row', many: 'plan rows', article: 'a' },
  hr: { one: 'stavka plana', of: 'stavke plana', few: 'stavke plana', other: 'stavki plana', gender: 'feminine' },
})
export const SPLIT_PART_RECORDS = recordKind<SplitTabRow>('split-part', {
  en: { one: 'split part', many: 'split parts', article: 'a' },
  hr: { one: 'dio podjele', of: 'dijela podjele', few: 'dijela podjele', other: 'dijelova podjele', gender: 'masculine' },
})
export const DISMISSAL_RECORDS = recordKind<Dismissal>('dismissal', {
  en: { one: 'dismissed suggestion', many: 'dismissed suggestions', article: 'a' },
  hr: { one: 'odbačeni prijedlog', of: 'odbačenog prijedloga', few: 'odbačena prijedloga', other: 'odbačenih prijedloga', gender: 'masculine' },
})
