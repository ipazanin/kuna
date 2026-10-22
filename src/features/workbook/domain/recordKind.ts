/** What one record is called in a sentence, such as "an invoice" and "3 invoices". */
export interface RecordNoun {
  readonly one: string
  readonly many: string
  readonly article: 'a' | 'an'
}

/** A kind of record the workbook holds. Its name starts every `RecordId` of the kind. */
export interface RecordKind {
  readonly name: string
  readonly noun: RecordNoun
}

function kind(name: string, one: string, many: string, article: RecordNoun['article'] = 'a'): RecordKind {
  return { name, noun: { one, many, article } }
}

export const LEDGER_RECORDS = kind('ledger-row', 'ledger row', 'ledger rows')
export const CATEGORY_RECORDS = kind('category', 'category', 'categories')
export const ACCOUNT_RECORDS = kind('account', 'account', 'accounts', 'an')
export const SETTING_RECORDS = kind('setting', 'setting', 'settings')
export const RULE_RECORDS = kind('rule', 'rule', 'rules')
export const INVOICE_RECORDS = kind('invoice', 'invoice', 'invoices', 'an')
export const CLIENT_RECORDS = kind('client-iban', 'client row', 'client rows')
export const BILLING_RECORDS = kind('billing-item', 'plan row', 'plan rows')
export const OWNER_ADVANCE_RECORDS = kind('owner-advance', 'owner advance', 'owner advances', 'an')
export const ASSET_RECORDS = kind('asset', 'asset', 'assets', 'an')
export const GRANT_RECORDS = kind('grant', 'grant', 'grants')
export const YEAR_END_RECORDS = kind('year-end-line', 'year-end line', 'year-end lines')
export const PLAN_RECORDS = kind('plan-line', 'plan row', 'plan rows')
export const SCENARIO_RECORDS = kind('scenario-component', 'scenario row', 'scenario rows')
export const SPLIT_PART_RECORDS = kind('split-part', 'split part', 'split parts')
export const DISMISSAL_RECORDS = kind('dismissal', 'dismissed suggestion', 'dismissed suggestions')
