/**
 * The fields of a record that hold no figure, as its parsed record names them and as its stored cells do. A Spending row's are
 * the bank's words and marks, which spending.read.statements hashes, who filed the row, and its link, which spending.published.links
 * hashes, and so is the link of a Spending row's item. A Spending account's is where its rows come from, which spending.read.sources hashes, and so is an Investments account's,
 * with its start day, which investments.read.sources hashes. A Company ledger row's are the bank's words and marks and who flagged it, which read.workbook hashes.
 */
export const SPENDING_ROW = {
  record: new Set(['description', 'counterpartyIban', 'importKey', 'statement', 'categorisedBy', 'movedAt', 'pocket', 'cashWithdrawal', 'link']),
  cells: new Set(['description', 'counterparty_iban', 'import_key', 'statement', 'categorised_by', 'moved_at', 'pocket', 'cash_withdrawal', 'link']),
}
export const SPENDING_ITEM = { record: new Set(['link']), cells: new Set(['link']) }
export const SPENDING_ACCOUNT = { record: new Set(['rowsFrom']), cells: new Set(['rows_from']) }
export const INVESTMENT_ACCOUNT = { record: new Set(['intake']), cells: new Set(['rows_from', 'starts_on']) }
export const COMPANY_LEDGER_ROW = {
  record: new Set(['statement', 'counterpartyIban', 'description', 'flaggedBy', 'reference', 'signals']),
  cells: new Set(['statement', 'counterparty_iban', 'description', 'flagged_by', 'reference', 'purpose', 'tx_domain', 'tx_family', 'tx_sub_family', 'creditor_reference', 'instructed_currency']),
}

/** A Spending row of the file, a statement's or a held one carries an import key, a row's item what the till printed, and an account where its rows come from. */
function spendingKindOf(record) {
  if (Object.hasOwn(record, 'importKey')) return SPENDING_ROW
  if (Object.hasOwn(record, 'printed')) return SPENDING_ITEM
  if (Object.hasOwn(record, 'rowsFrom')) return SPENDING_ACCOUNT
  return null
}

/** An Investments account says how its rows come in. */
function investmentsKindOf(record) {
  return Object.hasOwn(record, 'intake') ? INVESTMENT_ACCOUNT : null
}

/** A Company ledger row carries the bank's signals. */
function companyKindOf(record) {
  return Object.hasOwn(record, 'signals') ? COMPANY_LEDGER_ROW : null
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
