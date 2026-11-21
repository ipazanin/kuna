import type { Account } from './account'
import type { Label } from '../../../../shared/categorising/domain/labels'
import type { Budget } from './budget'
import type { Category } from './category'
import type { SpendingEvent } from './event'
import type { TransactionItem } from './transactionItem'
import type { HeldBankRow } from './heldBankRow'
import type { DroppedRow } from './droppedRow'
import type { Receipt } from './receipt'
import type { SavedRecipe } from './savedRecipe'
import type { Payee } from './payee'
import type { SpendingRule } from './spendingRule'
import type { Shortcut, ShortcutPart } from './shortcut'
import type { StoredLine } from './beforeItems'
import type { StoredRow } from './transaction'
import { recordKind } from '../../../../shared/storage/domain/recordKind'
import type { SettingRow } from '../../../../shared/storage/domain/settingRows'

export const ACCOUNT_RECORDS = recordKind<Account>('account', {
  en: { one: 'account', many: 'accounts', article: 'an' },
  hr: { one: 'račun', of: 'računa', few: 'računa', other: 'računa', gender: 'masculine' },
})
export const CATEGORY_RECORDS = recordKind<Category>('category', {
  en: { one: 'category', many: 'categories', article: 'a' },
  hr: { one: 'kategorija', of: 'kategorije', few: 'kategorije', other: 'kategorija', gender: 'feminine' },
})
export const LABEL_RECORDS = recordKind<Label>('label', {
  en: { one: 'label', many: 'labels', article: 'a' },
  hr: { one: 'oznaka', of: 'oznake', few: 'oznake', other: 'oznaka', gender: 'feminine' },
})
export const EVENT_RECORDS = recordKind<SpendingEvent>('event', {
  en: { one: 'event', many: 'events', article: 'an' },
  hr: { one: 'događaj', of: 'događaja', few: 'događaja', other: 'događaja', gender: 'masculine' },
})
export const TRANSACTION_RECORDS = recordKind<StoredRow>('transaction', {
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
export const SHORTCUT_RECORDS = recordKind<Shortcut>('shortcut', {
  en: { one: 'quick add', many: 'quick adds', article: 'a' },
  hr: { one: 'brzi unos', of: 'brzog unosa', few: 'brza unosa', other: 'brzih unosa', gender: 'masculine' },
})
export const SHORTCUT_PART_RECORDS = recordKind<ShortcutPart>(
  'shortcut-part',
  {
    en: { one: 'part of a quick add', many: 'parts of quick adds', article: 'a' },
    hr: { one: 'dio brzog unosa', of: 'dijela brzog unosa', few: 'dijela brzog unosa', other: 'dijelova brzog unosa', gender: 'masculine' },
  },
  { kind: SHORTCUT_RECORDS, field: 'shortcut' },
)
export const RECEIPT_RECORDS = recordKind<Receipt>('receipt', {
  en: { one: 'receipt', many: 'receipts', article: 'a' },
  hr: { one: 'fiskalni račun', of: 'fiskalnog računa', few: 'fiskalna računa', other: 'fiskalnih računa', gender: 'masculine' },
})
export const ITEM_RECORDS = recordKind<TransactionItem>(
  'item',
  {
    en: { one: 'part of an entry', many: 'parts of entries', article: 'a' },
    hr: { one: 'dio unosa', of: 'dijela unosa', few: 'dijela unosa', other: 'dijelova unosa', gender: 'masculine' },
  },
  { kind: TRANSACTION_RECORDS, field: 'transaction' },
)
/** A part of an entry as a file from before items keeps it. */
export const LINE_RECORDS = recordKind<StoredLine>('line', ITEM_RECORDS.noun, { kind: TRANSACTION_RECORDS, field: 'transaction' })
export const HELD_ROW_RECORDS = recordKind<HeldBankRow>('held-row', {
  en: { one: 'bank row on hold', many: 'bank rows on hold', article: 'a' },
  hr: { one: 'redak iz banke na čekanju', of: 'retka iz banke na čekanju', few: 'retka iz banke na čekanju', other: 'redaka iz banke na čekanju', gender: 'masculine' },
})
export const DROPPED_ROW_RECORDS = recordKind<DroppedRow>('dropped-row', {
  en: { one: 'payment the bank dropped', many: 'payments the bank dropped', article: 'a' },
  hr: { one: 'plaćanje koje je banka odbacila', of: 'plaćanja koje je banka odbacila', few: 'plaćanja koja je banka odbacila', other: 'plaćanja koja je banka odbacila', gender: 'neuter' },
})
export const RECIPE_RECORDS = recordKind<SavedRecipe>('recipe', {
  en: { one: 'recipe', many: 'recipes', article: 'a' },
  hr: { one: 'recept', of: 'recepta', few: 'recepta', other: 'recepata', gender: 'masculine' },
})
export const PAYEE_RECORDS = recordKind<Payee>('payee', {
  en: { one: 'payee', many: 'payees', article: 'a' },
  hr: { one: 'primatelj ili platitelj', of: 'primatelja ili platitelja', few: 'primatelja ili platitelja', other: 'primatelja ili platitelja', gender: 'masculine' },
})
export const SETTING_RECORDS = recordKind<SettingRow>('setting', {
  en: { one: 'setting', many: 'settings', article: 'a' },
  hr: { one: 'postavka', of: 'postavke', few: 'postavke', other: 'postavki', gender: 'feminine' },
})
