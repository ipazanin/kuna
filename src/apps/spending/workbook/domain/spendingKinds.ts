import type { Account } from './account'
import type { Budget } from './budget'
import type { Category } from './category'
import type { SpendingRule } from './spendingRule'
import type { SettingRow } from './spendingSettings'
import type { Transaction } from './transaction'
import { recordKind } from '../../../../shared/storage/domain/recordKind'

export const ACCOUNT_RECORDS = recordKind<Account>('account', {
  en: { one: 'account', many: 'accounts', article: 'an' },
  hr: { one: 'račun', of: 'računa', few: 'računa', other: 'računa', gender: 'masculine' },
})
export const CATEGORY_RECORDS = recordKind<Category>('category', {
  en: { one: 'category', many: 'categories', article: 'a' },
  hr: { one: 'kategorija', of: 'kategorije', few: 'kategorije', other: 'kategorija', gender: 'feminine' },
})
export const TRANSACTION_RECORDS = recordKind<Transaction>('transaction', {
  en: { one: 'entry', many: 'entries', article: 'an' },
  hr: { one: 'unos', of: 'unosa', few: 'unosa', other: 'unosa', gender: 'masculine' },
})
export const BUDGET_RECORDS = recordKind<Budget>('budget', {
  en: { one: 'limit', many: 'limits', article: 'a' },
  hr: { one: 'ograničenje', of: 'ograničenja', few: 'ograničenja', other: 'ograničenja', gender: 'neuter' },
})
export const RULE_RECORDS = recordKind<SpendingRule>('rule', {
  en: { one: 'rule', many: 'rules', article: 'a' },
  hr: { one: 'pravilo', of: 'pravila', few: 'pravila', other: 'pravila', gender: 'neuter' },
})
export const SETTING_RECORDS = recordKind<SettingRow>('setting', {
  en: { one: 'setting', many: 'settings', article: 'a' },
  hr: { one: 'postavka', of: 'postavke', few: 'postavke', other: 'postavki', gender: 'feminine' },
})
