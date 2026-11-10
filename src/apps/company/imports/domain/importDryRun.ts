import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { absMoney, addMoney, subtractMoney } from '../../../../shared/money/money'
import { statementTies } from '../../../../shared/money/statementTies'
import type { Money } from '../../../../shared/money/money'
import { BOOKING_DAYS_APART, bookedTwins } from '../../../../shared/money/lookAlikeBookings'
import { normaliseIban } from '../../../../shared/text/fold'
import { categorise } from '../../../../shared/categorising/domain/categorise'
import type { Verdict } from '../../../../shared/categorising/domain/categorise'
import type { Rule } from '../../../../shared/categorising/domain/rule'
import type { CategorisationContext } from '../../../../shared/categorising/domain/transactionFacts'
import { filedIn } from '../../owner-share/domain/ownerShare'
import type { ShareDefault } from '../../owner-share/domain/ownerShare'
import { ledgerIdOf } from '../../workbook/domain/ledgerReading'
import type { LedgerEntry } from '../../workbook/domain/ledgerReading'
import { newRecordId } from '../../../../shared/storage/domain/recordId'
import type { Transaction } from '../../workbook/domain/workbook'
import { isTranscribedReference } from './importedStatement'
import type { ImportedRow, ImportedStatement, NewAccountOffer, StatementReading } from './importedStatement'
import { words } from './words'

/** One entry of a statement as the dry run sees it: on the ledger already, or new with the verdict the rules give it. */
export interface DryRunRow extends ImportedRow {
  /** Null while the file gives no balances and the account's opening is not known yet. */
  readonly balance: Money | null
  readonly inLedger: boolean
  /** Null for a row already on the ledger, or one of a statement that will not be written. */
  readonly verdict: Verdict | null
  /** The ledger row a copied entry looks like, set only on an entry that waits for the person to say whether it is another. */
  readonly like?: Transaction
  /** The row the AI copied that an entry of a file Kuna read looks like, which puts the entry on the ledger already. */
  readonly copiedTwin?: Transaction
}

/** An account the ledger has no row of yet, which a statement starts at its opening balance once the person agrees. */
export interface AccountStart {
  readonly account: string
  /** The balance before the statement's first entry, or null when the file gives no balances and the person types it. */
  readonly opening: Money | null
  readonly date: CivilDate
}

/** An account the accounts tab lacks, which a statement names by its IBAN and starts at its opening once the person names it. */
export interface NewAccountStart extends NewAccountOffer {
  readonly opening: Money | null
  /** The day of the statement's first entry. */
  readonly date: CivilDate | null
}

/** An account the import adds to the accounts tab, by the name the person gave it. */
export interface AddedAccount {
  readonly slug: string
  readonly iban: string
  readonly currency: string
}

export interface DryRunStatement {
  readonly fileName: string
  readonly label: string
  /** Blank for a statement that could not be read, or of a new account the person has not named. */
  readonly account: string
  readonly rows: readonly DryRunRow[]
  /** Why nothing of the statement is written, or null. */
  readonly refusal: string | null
  /** Set while the statement waits for the person to start its account. */
  readonly start: AccountStart | null
  /** Set for a statement of an IBAN the accounts tab lacks, named or not. */
  readonly newAccount: NewAccountStart | null
  /** What may be wrong with the statement, for the person to check. */
  readonly notes: readonly string[]
  /** What the import does that needs no check, such as the entries on the ledger already. */
  readonly facts: readonly string[]
  readonly opening: Money | null
  readonly closing: Money | null
}

export interface ImportDryRun {
  readonly statements: readonly DryRunStatement[]
  /** The ledger entries confirming would write, one statement after another, each newest first as the tab holds them. */
  readonly added: readonly LedgerEntry[]
  /** The accounts confirming would add before those entries. */
  readonly accounts: readonly AddedAccount[]
  readonly newRows: number
  readonly inLedger: number
}

/** What the ledger already knows about one account. */
interface AccountState {
  readonly rows: Transaction[]
  readonly references: Set<string>
  readonly labels: Set<string>
  latest: { readonly date: CivilDate; readonly balance: Money } | null
  lastSequence: number | null
}

export interface DryRunInputs {
  readonly transactions: readonly Transaction[]
  readonly rules: readonly Rule[]
  readonly context: CategorisationContext
  /** Whose default share a new row takes with the category the rules give it. */
  readonly categories: readonly ShareDefault[]
  /** The opening each account without ledger rows starts at, as the person confirmed or typed it. */
  readonly starts: ReadonlyMap<string, Money>
  /**
   * The name the person gave each new account, by its IBAN. Each is a valid account name no account
   * on the tab has, which the caller checks, and the account starts at its statement's opening.
   */
  readonly named: ReadonlyMap<string, string>
}

/**
 * What importing the statements would do, written nowhere. A row is on the ledger already when its
 * account holds its reference, so a statement another sync or an earlier import filed adds
 * nothing. Each statement's new rows must follow every row it shares with the ledger,
 * carry a reference, not predate the account's newest row, and open at the balance the ledger
 * leaves the account at. An account with no rows yet waits until the person starts it at the
 * statement's opening. A bank export whose label, its file name and hash, is on the ledger already
 * and that still has new rows is refused, since its rows' keys changed since it was imported.
 * Statements of one account are taken oldest first, each against where the one before left the
 * account, and a refused one leaves the account where it was, so a later one is refused for the
 * gap. New rows are categorised by the rules, each with its category's default share. A statement of
 * an IBAN the accounts tab lacks waits until the person names its account, which the import then
 * adds and starts at the statement's opening.
 *
 * A copied statement's references are its own, so its entries are matched against the account's ledger rows too. One of the same
 * day, amount and counterparty as a row is on the ledger. One that only looks like a row waits unless the person said to import
 * it, and it holds its place in the statement as a row on the ledger does, so the entries after it still run on from the ledger.
 * A statement Kuna read itself is matched the same way against the rows the AI copied. One that only looks like a copied row
 * counts as on the ledger when the file gives its balance, since the balances after it then show whether the ledger holds it.
 */
export function importDryRun(readings: readonly StatementReading[], inputs: DryRunInputs): ImportDryRun {
  const states = accountStates(inputs.transactions)
  const stateOf = (account: string): AccountState => {
    let state = states.get(account)
    if (state === undefined) {
      state = { rows: [], references: new Set(), labels: new Set(), latest: null, lastSequence: null }
      states.set(account, state)
    }
    return state
  }
  const statements: DryRunStatement[] = []
  const added: LedgerEntry[] = []
  const accounts = new Map<string, AddedAccount>()
  for (const reading of inBookingOrder(readings, inputs.named)) {
    if (!('statement' in reading)) {
      statements.push({
        fileName: reading.fileName,
        label: reading.label,
        account: '',
        rows: [],
        refusal: reading.refusal,
        start: null,
        newAccount: null,
        notes: [],
        facts: [],
        opening: null,
        closing: null,
      })
      continue
    }
    if (!('newAccount' in reading)) {
      const planned = planStatement(reading.statement, stateOf(reading.statement.account), inputs)
      statements.push({ ...planned.statement, newAccount: null })
      added.push(...planned.added)
      continue
    }
    const newAccount = newAccountStart(reading.statement, reading.newAccount)
    const slug = inputs.named.get(reading.newAccount.iban)
    if (slug === undefined) {
      statements.push(waitingForName(reading.statement, newAccount))
      continue
    }
    const named = { ...reading.statement, account: slug }
    const starts = new Map(inputs.starts)
    if (newAccount.opening !== null && !starts.has(slug)) starts.set(slug, newAccount.opening)
    const planned = planStatement(named, stateOf(slug), { ...inputs, starts })
    statements.push({ ...planned.statement, newAccount })
    added.push(...planned.added)
    if (planned.statement.refusal === null) accounts.set(slug, { slug, iban: newAccount.iban, currency: newAccount.currency })
  }
  const rows = statements.flatMap((statement) => statement.rows)
  return { statements, added, accounts: [...accounts.values()], newRows: added.length, inLedger: rows.filter((row) => row.inLedger).length }
}

/** Where a statement of a new account would start it: the balance before its first entry, on that entry's day. */
function newAccountStart(statement: ImportedStatement, offer: NewAccountOffer): NewAccountStart {
  const first = statement.rows[0]
  const opening = first === undefined ? statement.opening : first.balance === null ? statement.opening : subtractMoney(first.balance, first.amount)
  return { ...offer, opening, date: first?.date ?? null }
}

/** A statement of a new account before the person names it, its entries shown and nothing of it written. */
function waitingForName(statement: ImportedStatement, newAccount: NewAccountStart): DryRunStatement {
  return {
    fileName: statement.fileName,
    label: statement.label,
    account: '',
    rows: withBalances(statement.rows, statement.opening).map((row) => ({ ...row, inLedger: false, verdict: null })),
    refusal: null,
    start: null,
    newAccount,
    notes: statement.notes,
    facts: [],
    opening: statement.opening,
    closing: statement.closing,
  }
}

function planStatement(statement: ImportedStatement, state: AccountState, inputs: DryRunInputs): { readonly statement: Omit<DryRunStatement, 'newAccount'>; readonly added: readonly LedgerEntry[] } {
  const { account } = statement
  const notes = [...statement.notes]
  const facts: string[] = []
  const inLedger = statement.rows.map((row) => row.reference !== '' && state.references.has(row.reference))
  const likeOf = new Map<ImportedRow, Transaction>()
  const { source } = statement
  const hit = new Set(statement.rows.filter((_, index) => inLedger[index]).map((row) => row.reference))
  const fromOtherSource = (row: Transaction): boolean => (source.kind === 'transcribed' ? true : isTranscribedReference(row.reference))
  const others = state.rows.filter((row) => fromOtherSource(row) && !hit.has(row.reference) && row.statement !== statement.label)
  const copiedTwinOf = new Map<ImportedRow, Transaction>()
  for (const [row, twin] of bookedTwins(
    statement.rows.filter((_, index) => !inLedger[index]),
    others,
  )) {
    const index = statement.rows.indexOf(row)
    if (twin.kind === 'same') inLedger[index] = true
    else if (source.kind === 'transcribed') {
      if (source.lookAlikes === 'ask') likeOf.set(row, twin.booked)
    } else if (row.balance !== null) {
      inLedger[index] = true
      copiedTwinOf.set(row, twin.booked)
    }
  }
  if (copiedTwinOf.size > 0) facts.push(words.dryRun.matchedCopied(copiedTwinOf.size, BOOKING_DAYS_APART))
  const held = statement.rows.map((row, index) => inLedger[index]! || likeOf.has(row))
  const firstNew = held.indexOf(false)
  const shell = { fileName: statement.fileName, label: statement.label, account, opening: statement.opening, closing: statement.closing }
  const shownRow = <Row extends ImportedRow>(row: Row, index: number) => {
    const like = likeOf.get(statement.rows[index]!)
    const copiedTwin = copiedTwinOf.get(statement.rows[index]!)
    return { ...row, inLedger: inLedger[index]!, verdict: null, ...(like === undefined ? {} : { like }), ...(copiedTwin === undefined ? {} : { copiedTwin }) }
  }
  const shown = (refusal: string | null, start: AccountStart | null, opening: Money | null): Omit<DryRunStatement, 'newAccount'> => ({
    ...shell,
    rows: withBalances(statement.rows, opening).map(shownRow),
    refusal,
    start,
    notes,
    facts,
  })
  if (firstNew < 0) {
    if (likeOf.size === 0) notes.push(statement.rows.length === 0 ? words.dryRun.noEntries : words.dryRun.allHeld)
    return { statement: shown(null, null, statement.opening), added: [] }
  }
  if (statement.source.kind === 'table' && state.labels.has(statement.label)) {
    return {
      statement: shown(words.dryRun.importedBefore(statement.label, firstNew === 0), null, statement.opening),
      added: [],
    }
  }
  const fresh = statement.rows.slice(firstNew)
  if (held.slice(firstNew).some((kept) => kept)) {
    return {
      statement: shown(words.dryRun.gap, null, statement.opening),
      added: [],
    }
  }
  const heldBefore = firstNew - likeOf.size - copiedTwinOf.size
  if (heldBefore > 0) {
    facts.push(words.dryRun.partlyHeld(heldBefore, fresh.length))
  }
  const unidentified = fresh.filter((row) => row.reference === '')
  if (unidentified.length > 0) {
    return {
      statement: shown(words.dryRun.noReference(unidentified.length), null, statement.opening),
      added: [],
    }
  }
  const first = fresh[0]!
  if (state.latest !== null && first.date < state.latest.date) {
    return {
      statement: shown(words.dryRun.beforeNewest(first.date, state.latest.date, account), null, statement.opening),
      added: [],
    }
  }
  const before = first.balance === null ? null : subtractMoney(first.balance, first.amount)
  let opening: Money | null
  let start: AccountStart | null = null
  if (state.latest !== null) {
    if (before !== null && before !== state.latest.balance) {
      return { statement: shown(notRunningOn(statement, fresh, state.latest, before), null, statement.opening), added: [] }
    }
    opening = state.latest.balance
    if (before === null) {
      facts.push(words.dryRun.worksOutBalances(opening, account, state.latest.date))
    }
  } else {
    start = { account, opening: before, date: first.date }
    const typed = inputs.starts.get(account)
    opening = before === null ? (typed ?? null) : typed === before ? before : null
    if (opening === null) {
      return { statement: shown(null, start, before), added: [] }
    }
  }
  if (statement.source.kind === 'camt' && state.lastSequence !== null) {
    const { sequence } = statement.source
    if (sequence > state.lastSequence + 1) {
      notes.push(words.dryRun.sequenceGap(sequence, state.lastSequence, account, sequence - state.lastSequence - 1))
    } else if (sequence <= state.lastSequence) {
      notes.push(words.dryRun.sequenceNotAfter(sequence, state.lastSequence, account))
    }
  }
  if (state.labels.has(statement.label) && !isLaterPart(statement)) {
    notes.push(words.dryRun.labelHeld(statement.label))
  }
  const balanced = withBalances(fresh, opening)
  const rows: DryRunRow[] = [
    ...withBalances(statement.rows.slice(0, firstNew), statement.opening).map(shownRow),
    ...balanced.map((row) => ({
      ...row,
      inLedger: false,
      verdict: categorise(
        { account, amount: row.amount, counterparty: row.counterparty, counterpartyIban: normaliseIban(row.counterpartyIban), description: row.description, signals: row.signals },
        inputs.rules,
        inputs.context,
      ),
    })),
  ]
  const last = balanced[balanced.length - 1]!
  state.latest = { date: last.date, balance: last.balance }
  for (const row of fresh) state.references.add(row.reference)
  state.labels.add(statement.label)
  if (statement.source.kind === 'camt') state.lastSequence = Math.max(state.lastSequence ?? 0, statement.source.sequence)
  const entries = balanced.map((row, index) => ledgerEntryOfImport(statement, { ...row, verdict: rows[firstNew + index]!.verdict }, inputs.categories))
  return { statement: { ...shell, opening: statement.opening ?? opening, closing: statement.closing ?? last.balance, rows, refusal: null, start, notes, facts }, added: entries.reverse() }
}

/** Whether the statement is a later part of one the AI copied, whose earlier parts' rows carry its label. */
function isLaterPart(statement: ImportedStatement): boolean {
  return statement.source.kind === 'transcribed' && statement.source.part > 1
}

/**
 * Why a statement's first new entry does not start where the ledger leaves the account. A later part of a copied statement runs
 * back from its printed closing, so it does not add up with its earlier parts, and any other statement misses one before it.
 */
function notRunningOn(statement: ImportedStatement, fresh: readonly ImportedRow[], latest: { readonly date: CivilDate; readonly balance: Money }, before: Money): string {
  const tie = isLaterPart(statement) && statement.closing !== null ? statementTies({ opening: latest.balance, amounts: fresh.map((row) => row.amount), closing: statement.closing }) : null
  return tie?.kind === 'off'
    ? words.transcribed.partDoesNotTie(statement.account, latest.balance, tie.rows, tie.reached, tie.statement.closing, absMoney(tie.gap))
    : words.dryRun.missingBetween(statement.account, latest.balance, latest.date, before)
}

/** The ledger entry a new entry of a statement makes, filed under its verdict with the category's default share. */
function ledgerEntryOfImport(
  statement: Pick<ImportedStatement, 'account' | 'label'>,
  row: ImportedRow & { readonly balance: Money; readonly verdict: Verdict | null },
  categories: readonly ShareDefault[],
): LedgerEntry {
  const entry = {
    account: statement.account,
    date: row.date,
    statement: statement.label,
    counterparty: row.counterparty,
    counterpartyIban: row.counterpartyIban,
    description: row.description,
    amount: row.amount,
    balance: row.balance,
    category: '',
    flaggedBy: row.verdict?.flaggedBy ?? '',
    reference: row.reference,
    signals: row.signals,
    reviewReasons: row.reviewReasons,
    ownerShare: null,
    rowId: newRecordId(),
  }
  return filedIn({ ...entry, id: ledgerIdOf(entry) }, row.verdict?.category ?? '', categories)
}

/** Each row with its balance: the file's own, or worked out from `from` when the file gives none. */
function withBalances<Row extends ImportedRow>(rows: readonly Row[], from: Money): (Row & { readonly balance: Money })[]
function withBalances<Row extends ImportedRow>(rows: readonly Row[], from: Money | null): (Row & { readonly balance: Money | null })[]
function withBalances<Row extends ImportedRow>(rows: readonly Row[], from: Money | null): (Row & { readonly balance: Money | null })[] {
  let running = from
  return rows.map((row) => {
    running = row.balance ?? (running === null ? null : addMoney(running, row.amount))
    return { ...row, balance: running }
  })
}

/** Statements that were read, by account, a new one by the name it was given or else its IBAN, then by their first entry's day, then by camt sequence. Refused files stay where they are. */
function inBookingOrder(readings: readonly StatementReading[], named: ReadonlyMap<string, string>): StatementReading[] {
  const accountOf = (reading: StatementReading & { readonly statement: ImportedStatement }): string =>
    'newAccount' in reading ? (named.get(reading.newAccount.iban) ?? reading.newAccount.iban) : reading.statement.account
  const keyOf = (reading: StatementReading): [string, string, number] =>
    'statement' in reading ? [accountOf(reading), reading.statement.rows[0]?.date ?? '', reading.statement.source.kind === 'camt' ? reading.statement.source.sequence : 0] : ['', '', 0]
  return readings
    .map((reading, position) => ({ reading, position, key: keyOf(reading) }))
    .sort((left, right) => left.key[0].localeCompare(right.key[0]) || left.key[1].localeCompare(right.key[1]) || left.key[2] - right.key[2] || left.position - right.position)
    .map(({ reading }) => reading)
}

/** Where each account stands on the ledger: its newest row, its references, its statement labels and its newest camt sequence. */
function accountStates(transactions: readonly Transaction[]): Map<string, AccountState> {
  const states = new Map<string, AccountState>()
  const newestFirst = [...transactions].sort((left, right) => right.date.localeCompare(left.date) || right.sequence - left.sequence)
  for (const transaction of newestFirst) {
    let state = states.get(transaction.account)
    if (state === undefined) {
      state = { rows: [], references: new Set(), labels: new Set(), latest: { date: transaction.date, balance: transaction.balance }, lastSequence: null }
      states.set(transaction.account, state)
    }
    state.rows.push(transaction)
    if (transaction.reference !== '') state.references.add(transaction.reference)
    if (transaction.statement !== '') state.labels.add(transaction.statement)
    const sequence = /-statement-(\d+)$/.exec(transaction.statement)?.[1]
    if (sequence !== undefined) state.lastSequence = Math.max(state.lastSequence ?? 0, Number(sequence))
  }
  return states
}
