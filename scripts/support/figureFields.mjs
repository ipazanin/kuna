/**
 * The fields of a record that hold no figure, as its parsed record names them and as its stored cells do. A Spending row's are
 * the bank's words and marks, which spending.read.statements hashes, who filed the row, and its link, which spending.published.links
 * hashes, and so is the link of a Spending row's item, whose labels spending.labels hashes, which of them a rule put on, and whose event spending.events hashes, whose payee spending.payees hashes, and whether a link split it off. A Spending account's are where its rows come from on which days, which spending.read.sources hashes, the cells a file from before periods kept that in, and its cards, which spending.read.cards hashes, and so is an Investments account's,
 * with its start day, which investments.read.sources hashes. A Company ledger row's are the bank's words and marks and who flagged it, which read.workbook hashes, and a Company account's are where its rows come from on which days, which read.sources hashes, and the cells a file from before periods kept that in.
 */
export const SPENDING_ROW = {
  record: new Set(['description', 'counterpartyIban', 'importKey', 'statement', 'categorisedBy', 'movedAt', 'pocket', 'cashWithdrawal', 'pending', 'link']),
  cells: new Set(['description', 'counterparty_iban', 'import_key', 'statement', 'categorised_by', 'moved_at', 'pocket', 'cash_withdrawal', 'pending', 'link']),
}
export const SPENDING_ITEM = {
  record: new Set(['link', 'labels', 'ruleLabels', 'event', 'splitByLink', 'payee']),
  cells: new Set(['link', 'labels', 'rule_labels', 'event', 'split_by_link', 'payee']),
}
export const SPENDING_ACCOUNT = { record: new Set(['sources', 'cards']), cells: new Set(['sources', 'rows_from', 'also_from', 'cards']) }
export const INVESTMENT_ACCOUNT = { record: new Set(['sources']), cells: new Set(['sources', 'rows_from', 'starts_on', 'also_from']) }
/** A Company item leaves out its labels, which company.labels hashes. Its invoice is a figure, since what an invoice is owed reads it. */
export const COMPANY_ITEM = { record: new Set(['labels']), cells: new Set(['label_ids']) }
export const COMPANY_ACCOUNT = { record: new Set(['sources']), cells: new Set(['sources', 'rows_from', 'starts_on', 'also_from']) }
/** A cost the owner paid leaves out its labels, which company.labels hashes. */
export const COMPANY_ADVANCE = { record: new Set(['labels']), cells: new Set(['label_ids']) }
export const COMPANY_LEDGER_ROW = {
  record: new Set(['statement', 'counterpartyIban', 'description', 'flaggedBy', 'reference', 'signals']),
  cells: new Set(['statement', 'counterparty_iban', 'description', 'flagged_by', 'reference', 'purpose', 'tx_domain', 'tx_family', 'tx_sub_family', 'creditor_reference', 'instructed_currency']),
}

/** A Spending row of the file, a statement's or a held one carries an import key, a row's item what the till printed, and an account where its rows come from. */
export function spendingKindOf(record) {
  if (Object.hasOwn(record, 'importKey')) return SPENDING_ROW
  if (Object.hasOwn(record, 'printed')) return SPENDING_ITEM
  if (Object.hasOwn(record, 'sources')) return SPENDING_ACCOUNT
  return null
}

/** An Investments account says how its rows come in. */
export function investmentsKindOf(record) {
  return Object.hasOwn(record, 'sources') ? INVESTMENT_ACCOUNT : null
}

/** A Company ledger row carries the bank's signals, an item the invoice it pays, an account where its rows come from, and a cost the owner paid its owner share beside a description and no account. */
export function companyKindOf(record) {
  if (Object.hasOwn(record, 'signals')) return COMPANY_LEDGER_ROW
  if (Object.hasOwn(record, 'invoice') && Object.hasOwn(record, 'row')) return COMPANY_ITEM
  if (Object.hasOwn(record, 'sources') && Object.hasOwn(record, 'iban')) return COMPANY_ACCOUNT
  if (isAdvance(record)) return COMPANY_ADVANCE
  return null
}

/** A cost the owner paid, as read or as the owner-advances tab holds it. */
function isAdvance(record) {
  return ['date', 'amount', 'description', 'category', 'ownerShare'].every((field) => Object.hasOwn(record, field)) && !Object.hasOwn(record, 'account') && !Object.hasOwn(record, 'row')
}

/** A Company group with the labels of each cost the owner paid left out, wherever it sits, since company.labels hashes them. */
export function withoutAdvanceLabels(value) {
  return figuresOf(value, (record) => (isAdvance(record) ? COMPANY_ADVANCE : null))
}

/** A value with every record in it, however deep, without its kind's fields above, and a stored record without those cells. */
function figuresOf(value, kindOf) {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map((entry) => figuresOf(entry, kindOf))
  if (value instanceof Map) return new Map([...value].map(([key, entry]) => [figuresOf(key, kindOf), figuresOf(entry, kindOf)]))
  if (value instanceof Set) return new Set([...value].map((entry) => figuresOf(entry, kindOf)))
  const stored = Object.hasOwn(value, 'record') && Object.hasOwn(value, 'fields') && value.record !== null && typeof value.record === 'object'
  const kind = kindOf(value)
  const cellsLeftOut = stored ? (kindOf(value.record)?.cells ?? null) : null
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, field]) => {
      if (kind?.record.has(key)) return []
      if (key === 'fields' && cellsLeftOut !== null) return [[key, Object.fromEntries(Object.entries(field).filter(([cell]) => !cellsLeftOut.has(cell)))]]
      return [[key, figuresOf(field, kindOf)]]
    }),
  )
}

/** A Spending group as the digest hashes it. */
export function spendingFiguresOf(value) {
  return figuresOf(value, spendingKindOf)
}

/** An Investments group as the digest hashes it. */
export function investmentsFiguresOf(value) {
  return figuresOf(value, investmentsKindOf)
}

/** Company's records as the digest hashes them. */
export function companyFiguresOf(value) {
  return figuresOf(value, companyKindOf)
}
