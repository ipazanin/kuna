import { parseCivilDate } from '../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../shared/calendar/civilDate'
import { ZERO, addMoney, moneyFromCents, negateMoney, plainAmount, subtractMoney, sumMoney } from '../../../shared/money/money'
import type { Money } from '../../../shared/money/money'
import { normaliseIban } from '../../../shared/text/fold'
import { foldRuleText } from '../../rules/domain/transactionFacts'
import { StatementRefused } from './importedStatement'
import type { ImportedRow, ImportedStatement, StatementReading } from './importedStatement'

/**
 * Banks whose camt statements always carry TxsSummry, by the servicer's BIC. A statement from one
 * of them without it is refused, since its totals are one of the checks on the entries. From another
 * bank it is read with a note, since the summary is optional in ISO 20022.
 */
const BANKS_THAT_SUMMARISE: ReadonlySet<string> = new Set(['ESBCHR22'])

/** The reasons a row waits for a person, as the `review_reasons` column words them. */
const REVIEW_REASONS = {
  noReference: 'no bank reference',
  reversal: 'reversal',
  valueDate: 'value date used',
  batched: 'batched entry',
} as const

/** What the statement says about the account the entries are booked on. */
interface StatementContext {
  readonly account: string
  readonly iban: string
  readonly holder: string
  readonly currency: string
  readonly servicer: string
}

interface CamtEntry {
  readonly row: Omit<ImportedRow, 'balance'>
  readonly credit: boolean
  readonly magnitude: Money
}

/**
 * The statements of a camt.053 document: elements found by local name, so any camt.053 version
 * reads, every amount read in cents from its decimal text, booked entries only, in booking-date
 * order with ties kept in document order, and the four checks against the statement's own balances
 * and totals. A document may carry several Stmt, and each is read, or refused, on its own.
 * `accountsByIban` names the account of each IBAN, normalised, as the accounts tab does. A statement
 * of an IBAN it lacks is read with a blank account and offers that account, by its IBAN and
 * currency, never filed under another one. Throws `StatementRefused` for a document that holds no
 * statement at all.
 */
export function readCamtDocument(document: Document, fileName: string, accountsByIban: ReadonlyMap<string, string>): StatementReading[] {
  const root = document.documentElement
  const statements = root === null || root.localName !== 'Document' ? [] : childrenNamed(childNamed(root, 'BkToCstmrStmt'), 'Stmt')
  if (statements.length === 0) {
    throw new StatementRefused(`${fileName} is not a camt.053 statement: it carries no BkToCstmrStmt/Stmt element.`)
  }
  return statements.map((statement, index) => {
    const label = statementLabelOf(statement) ?? `statement ${index + 1} of ${fileName}`
    try {
      const read = readStatement(statement, fileName, accountsByIban)
      return read.statement.account === '' ? { statement: read.statement, newAccount: { iban: read.iban, currency: read.currency } } : { statement: read.statement }
    } catch (failure) {
      if (failure instanceof StatementRefused) {
        return { fileName, label, refusal: failure.message }
      }
      throw failure
    }
  })
}

/**
 * The label and the account of a camt.053 document's first statement, which the archived file's
 * name carries, without the checks a read makes. The account is blank for an IBAN `accountsByIban`
 * lacks. Null for a document with no statement, or one with no label.
 */
export function camtStatementHead(document: Document, accountsByIban: ReadonlyMap<string, string>): { readonly label: string; readonly account: string } | null {
  const root = document.documentElement
  const statement = root === null || root.localName !== 'Document' ? undefined : childrenNamed(childNamed(root, 'BkToCstmrStmt'), 'Stmt')[0]
  const label = statement === undefined ? null : statementLabelOf(statement)
  return statement === undefined || label === null ? null : { label, account: accountsByIban.get(normaliseIban(textAt(statement, ['Acct', 'Id', 'IBAN']))) ?? '' }
}

function readStatement(statement: Element, fileName: string, accountsByIban: ReadonlyMap<string, string>): { readonly statement: ImportedStatement; readonly iban: string; readonly currency: string } {
  const label = statementLabelOf(statement)
  if (label === null) {
    throw new StatementRefused('The statement carries no CreDtTm or no LglSeqNb, so it cannot be named.')
  }
  const iban = normaliseIban(textAt(statement, ['Acct', 'Id', 'IBAN']))
  // A statement filed under the wrong account corrupts that account's balance chain from that row down.
  if (iban === '') {
    throw new StatementRefused('The statement names no Acct/Id/IBAN, so the app cannot tell whose account it is.')
  }
  const account = accountsByIban.get(iban) ?? ''
  const currency = textAt(statement, ['Acct', 'Ccy'])
  if (currency === '') {
    throw new StatementRefused('The statement states no Acct/Ccy, so no entry can be checked against it.')
  }
  const servicerBic = textAt(statement, ['Acct', 'Svcr', 'FinInstnId', 'BICFI']) || textAt(statement, ['Acct', 'Svcr', 'FinInstnId', 'BIC'])
  const context: StatementContext = {
    account,
    iban,
    // ISO 20022 files the owner under Acct/Ownr. Some banks print the holder in Acct/Nm instead.
    holder: textAt(statement, ['Acct', 'Ownr', 'Nm']) || textAt(statement, ['Acct', 'Nm']),
    currency,
    servicer: textAt(statement, ['Acct', 'Svcr', 'FinInstnId', 'Nm']),
  }
  const opening = balanceByCode(statement, 'OPBD', currency)
  const closing = balanceByCode(statement, 'CLBD', currency)
  const entries = inBookingOrder(
    childrenNamed(statement, 'Ntry')
      .filter((entry) => textAt(entry, ['Sts', 'Cd']) === 'BOOK' || textAt(entry, ['Sts']) === 'BOOK')
      .map((entry) => entryOf(entry, context)),
  )
  let balance = opening
  const rows: ImportedRow[] = entries.map((entry) => {
    balance = addMoney(balance, entry.row.amount)
    return { ...entry.row, balance }
  })
  const credits = sumMoney(entries.filter((entry) => entry.credit).map((entry) => entry.magnitude))
  const debits = sumMoney(entries.filter((entry) => !entry.credit).map((entry) => entry.magnitude))
  const expected = subtractMoney(addMoney(opening, credits), debits)
  if (expected !== closing) {
    throw new StatementRefused(
      `The balance chain does not close: opening ${plainAmount(opening)} plus credits ${plainAmount(credits)} less debits ${plainAmount(debits)} is ${plainAmount(expected)}, but CLBD reports ${plainAmount(closing)}.`,
    )
  }
  const notes: string[] = []
  const summary = childNamed(statement, 'TxsSummry')
  if (summary === null) {
    if (BANKS_THAT_SUMMARISE.has(servicerBic)) {
      throw new StatementRefused('The statement carries no TxsSummry, which this bank always sends, so its entries cannot be counted against the totals the bank reports.')
    }
    notes.push('The statement carries no TxsSummry, so its entries are checked against its balances only, not against counts and totals from the bank.')
  } else {
    checkSummarySide(summary, 'TtlDbtNtries', entries.filter((entry) => !entry.credit), 'debit')
    checkSummarySide(summary, 'TtlCdtNtries', entries.filter((entry) => entry.credit), 'credit')
  }
  const sequence = Number(textAt(statement, ['LglSeqNb']))
  return { statement: { fileName, source: { kind: 'camt', iban, sequence }, label, account, opening, closing, rows, notes }, iban, currency }
}

/**
 * The label the app writes in the statement column, and the fetch puts in each statement's file
 * name: the statement's creation day and its legal sequence number. A display string only, since a redelivery made on
 * a later day carries another one.
 */
function statementLabelOf(statement: Element): string | null {
  const created = textAt(statement, ['CreDtTm']).slice(0, 10)
  const sequence = textAt(statement, ['LglSeqNb'])
  return created === '' || sequence === '' ? null : `${created}-statement-${sequence.padStart(3, '0')}`
}

/** Signed by the balance's own CdtDbtInd, since DBIT on a balance is an overdraft. */
function balanceByCode(statement: Element, code: string, currency: string): Money {
  const balance = childrenNamed(statement, 'Bal').find((candidate) => textAt(candidate, ['Tp', 'CdOrPrtry', 'Cd']) === code)
  if (balance === undefined) {
    throw new StatementRefused(`The statement carries no ${code} balance, so its chain cannot be closed.`)
  }
  const amountElement = childNamed(balance, 'Amt')
  const balanceCurrency = amountElement?.getAttribute('Ccy')?.trim() ?? ''
  if (balanceCurrency !== currency) {
    throw new StatementRefused(`The ${code} balance is in "${balanceCurrency}" but the account is in ${currency}.`)
  }
  const amount = amountOf(amountElement, `the ${code} balance`)
  return textAt(balance, ['CdtDbtInd']) === 'DBIT' ? negateMoney(amount) : amount
}

function entryOf(entry: Element, context: StatementContext): CamtEntry {
  const reviewReasons: string[] = []
  // AcctSvcrRef is the bank's own key and survives redelivery. NtryRef is the fallback.
  const reference = textAt(entry, ['AcctSvcrRef']) || textAt(entry, ['NtryRef'])
  if (reference === '') {
    reviewReasons.push(REVIEW_REASONS.noReference)
  }
  const named = reference || '(no reference)'
  const indicator = textAt(entry, ['CdtDbtInd'])
  if (indicator !== 'CRDT' && indicator !== 'DBIT') {
    throw new StatementRefused(`Entry ${named} carries CdtDbtInd "${indicator}", which is neither CRDT nor DBIT.`)
  }
  const credit = indicator === 'CRDT'
  // Ntry/Amt, never TxAmt: only the entry amount reconciles against the balances.
  const amountElement = childNamed(entry, 'Amt')
  if (amountElement === null) {
    throw new StatementRefused(`Entry ${named} carries no Amt.`)
  }
  const entryCurrency = amountElement.getAttribute('Ccy')?.trim() ?? ''
  if (entryCurrency !== context.currency) {
    throw new StatementRefused(`Entry ${named} is in ${entryCurrency || 'no currency'} but the account is in ${context.currency}.`)
  }
  if (textAt(entry, ['RvslInd']) === 'true') {
    // Flagged, never acted on: banks disagree on which way CdtDbtInd reads on a reversal.
    reviewReasons.push(REVIEW_REASONS.reversal)
  }
  const bookingDate = dayOf(entry, 'BookgDt')
  const date = bookingDate ?? dayOf(entry, 'ValDt')
  if (date === null) {
    throw new StatementRefused(`Entry ${named} carries neither a booking nor a value date.`)
  }
  if (bookingDate === null) {
    reviewReasons.push(REVIEW_REASONS.valueDate)
  }
  // One booking for several payees carries a TxDtls per payee. The row takes the first payee.
  const legs = childrenNamed(entry, 'NtryDtls').reduce((count, details) => count + childrenNamed(details, 'TxDtls').length, 0)
  if (legs > 1) {
    reviewReasons.push(REVIEW_REASONS.batched)
  }
  const party = partyOf(entry, credit, context)
  const domain = textAt(entry, ['BkTxCd', 'Domn', 'Cd'])
  const family = textAt(entry, ['BkTxCd', 'Domn', 'Fmly', 'Cd'])
  const subFamily = textAt(entry, ['BkTxCd', 'Domn', 'Fmly', 'SubFmlyCd'])
  const magnitude = amountOf(amountElement, `the amount on entry ${named}`)
  const details = ['NtryDtls', 'TxDtls']
  return {
    credit,
    magnitude,
    row: {
      date,
      amount: credit ? magnitude : negateMoney(magnitude),
      counterparty: party.name || servicerCounterparty(context, domain, subFamily),
      counterpartyIban: party.iban,
      description: descriptionOf(entry),
      reference,
      signals: {
        purpose: textAt(entry, [...details, 'Purp', 'Cd']),
        txDomain: domain,
        txFamily: family,
        txSubFamily: subFamily,
        creditorReference: textAt(entry, [...details, 'RmtInf', 'Strd', 'CdtrRefInf', 'Ref']),
        instructedCurrency: elementAt(entry, [...details, 'AmtDtls', 'InstdAmt', 'Amt'])?.getAttribute('Ccy')?.trim() ?? '',
      },
      reviewReasons,
    },
  }
}

/** The booking or value day, from Dt or the day of DtTm. */
function dayOf(entry: Element, element: 'BookgDt' | 'ValDt'): CivilDate | null {
  const text = textAt(entry, [element, 'Dt']) || textAt(entry, [element, 'DtTm']).slice(0, 10)
  if (text === '') {
    return null
  }
  const day = parseCivilDate(text)
  if (day === null) {
    throw new StatementRefused(`An entry's ${element} is "${text}", which is not a day.`)
  }
  return day
}

/**
 * The first side that names somebody other than us: the creditor of a debit and the debtor of a
 * credit first, then the other side, for a bank that files the roles the other way round. Name and
 * IBAN always come off the same side.
 */
function partyOf(entry: Element, credit: boolean, context: StatementContext): { readonly name: string; readonly iban: string } {
  const parties = elementAt(entry, ['NtryDtls', 'TxDtls', 'RltdPties'])
  if (parties === null) {
    return { name: '', iban: '' }
  }
  for (const role of credit ? ['Dbtr', 'Cdtr'] : ['Cdtr', 'Dbtr']) {
    const side = { name: textAt(parties, [role, 'Pty', 'Nm']) || textAt(parties, [role, 'Nm']), iban: textAt(parties, [`${role}Acct`, 'Id', 'IBAN']) }
    if ((side.name !== '' || side.iban !== '') && !isOwnSide(side, context)) {
      return side
    }
  }
  return { name: '', iban: '' }
}

/** The IBAN decides wherever the side states one. A side without one is ours when it carries the holder's name. */
function isOwnSide(side: { readonly name: string; readonly iban: string }, context: StatementContext): boolean {
  if (side.iban !== '') {
    return normaliseIban(side.iban) === context.iban
  }
  return context.holder !== '' && foldRuleText(side.name) === foldRuleText(context.holder)
}

/**
 * A fee or an account-management entry names no party, since the other side is the bank, so the
 * row takes the servicer's name. COMM and CHRG are ISO 20022 sub-family codes, so they are read
 * there.
 */
function servicerCounterparty(context: StatementContext, domain: string, subFamily: string): string {
  return domain === 'ACMT' || subFamily === 'COMM' || subFamily === 'CHRG' ? context.servicer : ''
}

/** The payer's own text first, its lines joined, then the structured remittance's text, then the bank's own wording. */
function descriptionOf(entry: Element): string {
  const remittance = elementAt(entry, ['NtryDtls', 'TxDtls', 'RmtInf'])
  if (remittance !== null) {
    const unstructured = childrenNamed(remittance, 'Ustrd')
      .map((line) => (line.textContent ?? '').trim())
      .filter((line) => line !== '')
      .join(' ')
    if (unstructured !== '') {
      return unstructured
    }
    const structured = textAt(remittance, ['Strd', 'AddtlRmtInf'])
    if (structured !== '') {
      return structured
    }
  }
  return textAt(entry, ['AddtlNtryInf'])
}

/** Sorted across booking dates and never within one, since camt carries no balance per entry and document order is the bank's booking order. */
function inBookingOrder(entries: readonly CamtEntry[]): CamtEntry[] {
  return entries
    .map((entry, position) => ({ entry, position }))
    .sort((earlier, later) => earlier.entry.row.date.localeCompare(later.entry.row.date) || earlier.position - later.position)
    .map(({ entry }) => entry)
}

/** Per direction, since a dropped credit and a dropped debit of the same amount leave the net and the balances unchanged. */
function checkSummarySide(summary: Element, element: 'TtlDbtNtries' | 'TtlCdtNtries', entries: readonly CamtEntry[], side: string): void {
  const declaredCount = Number(textAt(summary, [element, 'NbOfNtries']) || 0)
  if (declaredCount !== entries.length) {
    throw new StatementRefused(`${element} reports ${declaredCount} entries but ${entries.length} booked ${side} entries were read.`)
  }
  const sumElement = elementAt(summary, [element, 'Sum'])
  const declaredSum = sumElement === null ? ZERO : amountOf(sumElement, `${element}/Sum`)
  const summed = sumMoney(entries.map((entry) => entry.magnitude))
  if (declaredSum !== summed) {
    throw new StatementRefused(`${element} reports ${plainAmount(declaredSum)} but the booked ${side} entries sum to ${plainAmount(summed)}.`)
  }
}

/**
 * An unsigned amount in whole cents, read from its decimal text so no float rounding enters. A
 * localised `1.234,56` is refused, and so is a negative amount, since the direction belongs to the
 * CdtDbtInd beside it, and an amount finer than a cent, which the ledger cannot hold.
 */
function amountOf(element: Element | null, description: string): Money {
  const text = element?.textContent?.trim() ?? ''
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(text)
  if (match === null) {
    throw new StatementRefused(`${capitalised(description)} is "${text}", which is not a number.`)
  }
  if (match[1] === '-') {
    throw new StatementRefused(`${capitalised(description)} is "${text}", but a camt amount is unsigned and its direction is carried by the CdtDbtInd beside it.`)
  }
  const fraction = (match[3] ?? '').padEnd(2, '0')
  if (/[1-9]/.test(fraction.slice(2))) {
    throw new StatementRefused(`${capitalised(description)} is "${text}", which is finer than a cent.`)
  }
  return moneyFromCents(Number(match[2]) * 100 + Number(fraction.slice(0, 2)))
}

function childrenNamed(element: Element | null, name: string): Element[] {
  return element === null ? [] : [...element.children].filter((child) => child.localName === name)
}

function childNamed(element: Element | null, name: string): Element | null {
  return childrenNamed(element, name)[0] ?? null
}

function elementAt(element: Element, path: readonly string[]): Element | null {
  return path.reduce<Element | null>((current, name) => childNamed(current, name), element)
}

function textAt(element: Element, path: readonly string[]): string {
  return elementAt(element, path)?.textContent?.trim() ?? ''
}

function capitalised(text: string): string {
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`
}
