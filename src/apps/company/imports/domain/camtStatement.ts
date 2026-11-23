import { parseCivilDate } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { EntrySide } from '../../../../shared/categorising/domain/rule'
import { ZERO, addMoney, moneyFromAmount, negateMoney, sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { foldRuleText, normaliseIban } from '../../../../shared/text/fold'
import { StatementRefused } from './importedStatement'
import { statementTies } from '../../../../shared/money/statementTies'
import type { ImportedRow, ImportedStatement, StatementReading } from './importedStatement'
import { words } from './words'
import { camtStatementLabel } from '../../workbook/domain/rowOrigin'
import { runRecipe } from '../../../../shared/recipes/domain/runRecipe'
import type { RecipeRow } from '../../../../shared/recipes/domain/runRecipe'
import type { RecipeFileReading } from '../../../../shared/recipes/domain/recipe'
import { CAMT_RECIPE } from './camtRecipe'

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

/** A review reason the ledger stores, as the screen names it. A reason the import does not write shows as stored. */
export function reviewReasonLabel(reason: string): string {
  const known = (Object.keys(REVIEW_REASONS) as (keyof typeof REVIEW_REASONS)[]).find((key) => REVIEW_REASONS[key] === reason)
  return known === undefined ? reason : words.camt.reviewReasons[known]
}

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

/** One statement's rows as the camt recipe reads them, each entry with the transactions its details hold. */
interface StatementRows {
  readonly statement: RecipeRow
  readonly balances: readonly RecipeRow[]
  readonly summary: RecipeRow | null
  readonly entries: readonly EntryRows[]
  /** The entries the bank has not booked, which no kind of the recipe takes. */
  readonly notBooked: number
}

interface EntryRows {
  readonly entry: RecipeRow
  /** How many transactions the entry's details hold together. */
  readonly transactions: number
  /** Whether a detail counts more than one transaction in its batch. */
  readonly batched: boolean
}

function textOf(row: RecipeRow, field: string): string {
  return row.texts[field] ?? ''
}

/** How many rows of a section sit in each row of the section it is within, by that row's place. */
function byParent(rows: readonly { readonly section: string; readonly place: number | null }[], parents: ReadonlyMap<string, readonly number[]>, section: string): Map<number, number> {
  const counts = new Map<number, number>()
  for (const row of rows) {
    if (row.section !== section || row.place === null) continue
    const parent = parents.get(section)?.[row.place] ?? 0
    counts.set(parent, (counts.get(parent) ?? 0) + 1)
  }
  return counts
}

/** A document's statements as the camt recipe reads them, in the document's order, or null for a document that holds no camt.053 statement. */
function statementRowsOf(reading: RecipeFileReading): StatementRows[] | null {
  if (reading.kind === 'misfit') return null
  const run = runRecipe(CAMT_RECIPE, reading.rows)
  if (run.kind === 'misfit') return null
  const parentOf = (row: RecipeRow): number => reading.parents.get(row.section)?.[row.place] ?? 0
  const rowsUnder = (section: string): Map<number, RecipeRow[]> => {
    const under = new Map<number, RecipeRow[]>()
    for (const row of run.rows.filter((candidate) => candidate.section === section)) under.set(parentOf(row), [...(under.get(parentOf(row)) ?? []), row])
    return under
  }
  const balances = rowsUnder('balances')
  const summaries = rowsUnder('summaries')
  const entries = rowsUnder('entries')
  const details = rowsUnder('details')
  const transactions = byParent(run.rows, reading.parents, 'transactions')
  const notBooked = byParent(run.asked, reading.parents, 'entries')
  return run.rows
    .filter((row) => row.section === 'statements')
    .map((statement) => ({
      statement,
      balances: balances.get(statement.place) ?? [],
      summary: summaries.get(statement.place)?.[0] ?? null,
      entries: (entries.get(statement.place) ?? []).map((entry) => {
        const ofEntry = details.get(entry.place) ?? []
        return {
          entry,
          transactions: ofEntry.reduce((count, detail) => count + (transactions.get(detail.place) ?? 0), 0),
          batched: ofEntry.some((detail) => Number(textOf(detail, 'batch')) > 1),
        }
      }),
      notBooked: notBooked.get(statement.place) ?? 0,
    }))
}

/**
 * The statements of a camt.053 document, as `CAMT_RECIPE` read its rows: any camt.053 version reads, every amount read in cents from
 * its decimal text, booked entries only, with a note counting the rest, in booking-date order with ties kept in document order,
 * and the four checks against the statement's own balances and totals. A document may carry several Stmt, and each is read,
 * or refused, on its own. `accountsByIban` names the account of each IBAN, normalised, as the accounts tab does. A statement
 * of an IBAN it lacks is read with a blank account and offers that account, by its IBAN and currency, never filed under
 * another one. Throws `StatementRefused` for a document that holds no statement at all.
 */
export function readCamtStatements(reading: RecipeFileReading, fileName: string, accountsByIban: ReadonlyMap<string, string>): StatementReading[] {
  const statements = statementRowsOf(reading) ?? []
  if (statements.length === 0) {
    throw new StatementRefused(words.camt.notCamt(fileName))
  }
  return statements.map((statement, index) => {
    const label = statementLabelOf(statement.statement) ?? words.camt.unnamed(index + 1, fileName)
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

/** The label of a camt.053 document's first statement, which tells the bank's mail which statement it carries, without the checks a read makes. Null for a document with no statement, or one with no label. */
export function firstCamtLabel(reading: RecipeFileReading): string | null {
  const first = statementRowsOf(reading)?.[0]
  return first === undefined ? null : statementLabelOf(first.statement)
}

function readStatement(
  rows: StatementRows,
  fileName: string,
  accountsByIban: ReadonlyMap<string, string>,
): { readonly statement: ImportedStatement; readonly iban: string; readonly currency: string } {
  const statement = rows.statement
  const label = statementLabelOf(statement)
  if (label === null) {
    throw new StatementRefused(words.camt.noLabel)
  }
  const iban = normaliseIban(textOf(statement, 'iban'))
  // A statement filed under the wrong account corrupts that account's balance chain from that row down.
  if (iban === '') {
    throw new StatementRefused(words.camt.noIban)
  }
  const account = accountsByIban.get(iban) ?? ''
  const currency = textOf(statement, 'currency')
  if (currency === '') {
    throw new StatementRefused(words.camt.noCurrency)
  }
  const servicerBic = textOf(statement, 'bic') || textOf(statement, 'olderBic')
  const context: StatementContext = {
    account,
    iban,
    // ISO 20022 files the owner under Acct/Ownr. Some banks print the holder in Acct/Nm instead.
    holder: textOf(statement, 'owner') || textOf(statement, 'accountName'),
    currency,
    servicer: textOf(statement, 'servicer'),
  }
  const opening = balanceByCode(rows.balances, 'OPBD', currency)
  const closing = balanceByCode(rows.balances, 'CLBD', currency)
  const entries = inBookingOrder(rows.entries.map((entry) => entryOf(entry, context)))
  let balance = opening
  const imported: ImportedRow[] = entries.map((entry) => {
    balance = addMoney(balance, entry.row.amount)
    return { ...entry.row, balance }
  })
  const tie = statementTies({ opening, amounts: imported.map((row) => row.amount), closing })
  if (tie.kind === 'off') {
    const credits = sumMoney(entries.filter((entry) => entry.credit).map((entry) => entry.magnitude))
    const debits = sumMoney(entries.filter((entry) => !entry.credit).map((entry) => entry.magnitude))
    throw new StatementRefused(words.camt.chainOpen(opening, credits, debits, tie.reached, closing))
  }
  const notes: string[] = rows.notBooked === 0 ? [] : [words.camt.notBooked(rows.notBooked)]
  if (rows.summary === null) {
    if (BANKS_THAT_SUMMARISE.has(servicerBic)) {
      throw new StatementRefused(words.camt.summaryRequired)
    }
    notes.push(words.camt.noSummary)
  } else {
    checkSummarySide(
      rows.summary,
      'TtlDbtNtries',
      entries.filter((entry) => !entry.credit),
      'debit',
    )
    checkSummarySide(
      rows.summary,
      'TtlCdtNtries',
      entries.filter((entry) => entry.credit),
      'credit',
    )
  }
  const sequence = Number(textOf(statement, 'sequence'))
  return { statement: { fileName, source: { kind: 'camt', iban, sequence }, label, account, opening, closing, rows: imported, notes }, iban, currency }
}

/**
 * The label the app writes in the statement column, and the fetch puts in each statement's file
 * name: the statement's creation day and its legal sequence number. A display string only, since a redelivery made on
 * a later day carries another one.
 */
function statementLabelOf(statement: RecipeRow): string | null {
  const created = textOf(statement, 'created').slice(0, 10)
  const sequence = textOf(statement, 'sequence')
  return created === '' || sequence === '' ? null : camtStatementLabel(created, sequence)
}

/** Signed by the balance's own CdtDbtInd, since DBIT on a balance is an overdraft. */
function balanceByCode(balances: readonly RecipeRow[], code: string, currency: string): Money {
  const balance = balances.find((candidate) => textOf(candidate, 'code') === code)
  if (balance === undefined) {
    throw new StatementRefused(words.camt.noBalance(code))
  }
  const balanceCurrency = textOf(balance, 'currency')
  if (balanceCurrency !== currency) {
    throw new StatementRefused(words.camt.balanceCurrency(code, balanceCurrency, currency))
  }
  const amount = amountOf(textOf(balance, 'amount'), words.camt.balanceAmount(code))
  return textOf(balance, 'indicator') === 'DBIT' ? negateMoney(amount) : amount
}

function entryOf({ entry, transactions, batched }: EntryRows, context: StatementContext): CamtEntry {
  const reviewReasons: string[] = []
  // AcctSvcrRef is the bank's own key and survives redelivery. NtryRef is the fallback.
  const reference = textOf(entry, 'servicerReference') || textOf(entry, 'entryReference')
  if (reference === '') {
    reviewReasons.push(REVIEW_REASONS.noReference)
  }
  const named = reference || words.camt.noReference
  const indicator = textOf(entry, 'indicator')
  if (indicator !== 'CRDT' && indicator !== 'DBIT') {
    throw new StatementRefused(words.camt.badIndicator(named, indicator))
  }
  const credit = indicator === 'CRDT'
  // Ntry/Amt, never TxAmt: only the entry amount reconciles against the balances.
  const amountText = textOf(entry, 'amount')
  if (amountText === '') {
    throw new StatementRefused(words.camt.noAmount(named))
  }
  const entryCurrency = textOf(entry, 'currency')
  if (entryCurrency !== context.currency) {
    throw new StatementRefused(words.camt.entryCurrency(named, entryCurrency, context.currency))
  }
  // xs:boolean writes true as `true` or `1`, and the Croatian banks' camt guide writes `TRUE`.
  if (['true', '1'].includes(textOf(entry, 'reversal').toLowerCase())) {
    // Flagged, never acted on: banks disagree on which way CdtDbtInd reads on a reversal.
    reviewReasons.push(REVIEW_REASONS.reversal)
  }
  const bookingDate = dayOf(entry, 'BookgDt')
  const date = bookingDate ?? dayOf(entry, 'ValDt')
  if (date === null) {
    throw new StatementRefused(words.camt.noDate(named))
  }
  if (bookingDate === null) {
    reviewReasons.push(REVIEW_REASONS.valueDate)
  }
  // One booking for several payees carries a TxDtls per payee, or one Btch that counts them, as a Croatian payroll does. The row takes the first payee.
  if (transactions > 1 || batched) {
    reviewReasons.push(REVIEW_REASONS.batched)
  }
  const party = partyOf(entry, credit, context)
  const domain = textOf(entry, 'domain')
  const subFamily = textOf(entry, 'subFamily')
  const magnitude = amountOf(amountText, words.camt.entryAmount(named))
  return {
    credit,
    magnitude,
    row: {
      date,
      amount: credit ? magnitude : negateMoney(magnitude),
      counterparty: party.name || servicerCounterparty(context, domain, subFamily),
      counterpartyIban: party.iban,
      description: textOf(entry, 'lines') || textOf(entry, 'remittanceNote') || textOf(entry, 'entryNote'),
      reference,
      signals: {
        purpose: textOf(entry, 'purpose'),
        txDomain: domain,
        txFamily: textOf(entry, 'family'),
        txSubFamily: subFamily,
        creditorReference: textOf(entry, 'creditorReference'),
        instructedCurrency: textOf(entry, 'instructedCurrency'),
      },
      reviewReasons,
    },
  }
}

/** The booking or value day, from Dt or the day of DtTm. */
function dayOf(entry: RecipeRow, element: 'BookgDt' | 'ValDt'): CivilDate | null {
  const [day, dayTime] = element === 'BookgDt' ? ['bookedOn', 'bookedAt'] : ['valueOn', 'valueAt']
  const text = textOf(entry, day) || textOf(entry, dayTime).slice(0, 10)
  if (text === '') {
    return null
  }
  const parsed = parseCivilDate(text)
  if (parsed === null) {
    throw new StatementRefused(words.camt.notADay(element, text))
  }
  return parsed
}

/**
 * The first side that names somebody other than us: the creditor of a debit and the debtor of a
 * credit first, then the other side, for a bank that files the roles the other way round. Name and
 * IBAN always come off the same side.
 */
function partyOf(entry: RecipeRow, credit: boolean, context: StatementContext): { readonly name: string; readonly iban: string } {
  for (const role of credit ? ['Dbtr', 'Cdtr'] : ['Cdtr', 'Dbtr']) {
    const side = { name: textOf(entry, `${role}Name`) || textOf(entry, `${role}ShortName`), iban: textOf(entry, `${role}Iban`) }
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

/** Sorted across booking dates and never within one, since camt carries no balance per entry and document order is the bank's booking order. */
function inBookingOrder(entries: readonly CamtEntry[]): CamtEntry[] {
  return entries
    .map((entry, position) => ({ entry, position }))
    .sort((earlier, later) => earlier.entry.row.date.localeCompare(later.entry.row.date) || earlier.position - later.position)
    .map(({ entry }) => entry)
}

/** Per direction, since a dropped credit and a dropped debit of the same amount leave the net and the balances unchanged. */
function checkSummarySide(summary: RecipeRow, element: 'TtlDbtNtries' | 'TtlCdtNtries', entries: readonly CamtEntry[], side: EntrySide): void {
  const [count, sum] = element === 'TtlDbtNtries' ? ['debitCount', 'debitSum'] : ['creditCount', 'creditSum']
  const declaredCount = Number(textOf(summary, count) || 0)
  if (declaredCount !== entries.length) {
    throw new StatementRefused(words.camt.summaryCount(element, declaredCount, entries.length, side))
  }
  const sumText = textOf(summary, sum)
  const declaredSum = sumText === '' ? ZERO : amountOf(sumText, `${element}/Sum`)
  const summed = sumMoney(entries.map((entry) => entry.magnitude))
  if (declaredSum !== summed) {
    throw new StatementRefused(words.camt.summarySum(element, declaredSum, summed, side))
  }
}

/**
 * An unsigned amount in whole cents, read from its decimal text so no float rounding enters. A
 * localised `1.234,56` is refused, and so is a negative amount, since the direction belongs to the
 * CdtDbtInd beside it, and an amount finer than a cent, which the ledger cannot hold.
 */
function amountOf(text: string, description: string): Money {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(text)
  if (match === null) {
    throw new StatementRefused(words.camt.notANumber(description, text))
  }
  if (match[1] === '-') {
    throw new StatementRefused(words.camt.signed(description, text))
  }
  const fraction = (match[3] ?? '').padEnd(2, '0')
  if (/[1-9]/.test(fraction.slice(2))) {
    throw new StatementRefused(words.camt.finerThanACent(description, text))
  }
  return moneyFromAmount(Number(`${match[2]}.${fraction.slice(0, 2)}`))
}
