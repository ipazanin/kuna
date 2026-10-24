import type { CivilDate } from '../../../shared/calendar/civilDate'
import { addMoney, plainAmount, subtractMoney } from '../../../shared/money/money'
import type { Money } from '../../../shared/money/money'
import { normaliseIban } from '../../../shared/text/fold'
import { categorise } from '../../rules/domain/categorise'
import type { Verdict } from '../../rules/domain/categorise'
import type { Rule } from '../../rules/domain/rule'
import type { CategorisationContext } from '../../rules/domain/transactionFacts'
import { filedIn } from '../../owner-share/domain/ownerShare'
import type { ShareDefault } from '../../owner-share/domain/ownerShare'
import { ledgerIdOf } from '../../workbook/domain/ledgerReading'
import type { LedgerEntry } from '../../workbook/domain/ledgerReading'
import type { Transaction } from '../../workbook/domain/workbook'
import type { ImportedRow, ImportedStatement, StatementReading } from './importedStatement'

/** One entry of a statement as the dry run sees it: on the ledger already, or new with the verdict the rules give it. */
export interface DryRunRow extends ImportedRow {
  /** Null while the file gives no balances and the account's opening is not known yet. */
  readonly balance: Money | null
  readonly inLedger: boolean
  /** Null for a row already on the ledger, or one of a statement that will not be written. */
  readonly verdict: Verdict | null
}

/** An account the ledger has no row of yet, which a statement starts at its opening balance once the person agrees. */
export interface AccountStart {
  readonly account: string
  /** The balance before the statement's first entry, or null when the file gives no balances and the person types it. */
  readonly opening: Money | null
  readonly date: CivilDate
}

export interface DryRunStatement {
  readonly fileName: string
  readonly label: string
  /** Blank for a statement that could not be read. */
  readonly account: string
  readonly rows: readonly DryRunRow[]
  /** Why nothing of the statement is written, or null. */
  readonly refusal: string | null
  /** Set while the statement waits for the person to start its account. */
  readonly start: AccountStart | null
  readonly notes: readonly string[]
  readonly opening: Money | null
  readonly closing: Money | null
}

export interface ImportDryRun {
  readonly statements: readonly DryRunStatement[]
  /** The ledger entries confirming would write, one statement after another, each newest first as the tab holds them. */
  readonly added: readonly LedgerEntry[]
  readonly newRows: number
  readonly inLedger: number
}

/** What the ledger already knows about one account. */
interface AccountState {
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
 * gap. New rows are categorised by the rules, each with its category's default share.
 */
export function importDryRun(readings: readonly StatementReading[], inputs: DryRunInputs): ImportDryRun {
  const states = accountStates(inputs.transactions)
  const stateOf = (account: string): AccountState => {
    let state = states.get(account)
    if (state === undefined) {
      state = { references: new Set(), labels: new Set(), latest: null, lastSequence: null }
      states.set(account, state)
    }
    return state
  }
  const statements: DryRunStatement[] = []
  const added: LedgerEntry[] = []
  for (const reading of inBookingOrder(readings)) {
    if (!('statement' in reading)) {
      statements.push({ fileName: reading.fileName, label: reading.label, account: '', rows: [], refusal: reading.refusal, start: null, notes: [], opening: null, closing: null })
      continue
    }
    const planned = planStatement(reading.statement, stateOf(reading.statement.account), inputs)
    statements.push(planned.statement)
    added.push(...planned.added)
  }
  const rows = statements.flatMap((statement) => statement.rows)
  return { statements, added, newRows: added.length, inLedger: rows.filter((row) => row.inLedger).length }
}

function planStatement(statement: ImportedStatement, state: AccountState, inputs: DryRunInputs): { readonly statement: DryRunStatement; readonly added: readonly LedgerEntry[] } {
  const { account } = statement
  const notes = [...statement.notes]
  const inLedger = statement.rows.map((row) => row.reference !== '' && state.references.has(row.reference))
  const firstNew = inLedger.indexOf(false)
  const shell = { fileName: statement.fileName, label: statement.label, account, opening: statement.opening, closing: statement.closing }
  const shown = (refusal: string | null, start: AccountStart | null, opening: Money | null): DryRunStatement => ({
    ...shell,
    rows: withBalances(statement.rows, opening).map((row, index) => ({ ...row, inLedger: inLedger[index]!, verdict: null })),
    refusal,
    start,
    notes,
  })
  if (firstNew < 0) {
    notes.push(statement.rows.length === 0 ? 'The statement has no booked entries, so importing it writes nothing.' : 'Every entry is on the ledger already, so importing it writes nothing.')
    return { statement: shown(null, null, statement.opening), added: [] }
  }
  if (statement.source.kind === 'table' && state.labels.has(statement.label)) {
    return {
      statement: shown(
        `Rows of ${statement.label} are on the ledger already, so this file was imported before, and ${firstNew === 0 ? 'none' : 'only some'} of its entries match them now, such as after a change to its profile. Nothing of it is written.`,
        null,
        statement.opening,
      ),
      added: [],
    }
  }
  const fresh = statement.rows.slice(firstNew)
  if (inLedger.slice(firstNew).some((held) => held)) {
    return { statement: shown('Rows the ledger lacks sit between rows it already holds, so the statement does not continue where the ledger leaves the account. Nothing of it is written.', null, statement.opening), added: [] }
  }
  if (firstNew > 0) {
    notes.push(`${firstNew} of its ${statement.rows.length} entries are on the ledger already. The other ${fresh.length} follow them.`)
  }
  const unidentified = fresh.filter((row) => row.reference === '')
  if (unidentified.length > 0) {
    return {
      statement: shown(
        `${unidentified.length === 1 ? 'An entry carries' : `${unidentified.length} entries carry`} no bank reference, so a second import could not tell ${unidentified.length === 1 ? 'it' : 'them'} from others. The whole statement is refused.`,
        null,
        statement.opening,
      ),
      added: [],
    }
  }
  const first = fresh[0]!
  if (state.latest !== null && first.date < state.latest.date) {
    return { statement: shown(`Its first new entry is dated ${first.date}, before ${state.latest.date}, the newest row of ${account}. Rows are only added after the newest one.`, null, statement.opening), added: [] }
  }
  const before = first.balance === null ? null : subtractMoney(first.balance, first.amount)
  let opening: Money | null
  let start: AccountStart | null = null
  if (state.latest !== null) {
    if (before !== null && before !== state.latest.balance) {
      return {
        statement: shown(
          `The ledger ends ${account} at ${plainAmount(state.latest.balance)} on ${state.latest.date}, but this statement's first new entry starts from ${plainAmount(before)}, so a statement between the two is missing. Import that one first.`,
          null,
          statement.opening,
        ),
        added: [],
      }
    }
    opening = state.latest.balance
    if (before === null) {
      notes.push(`The file gives no balances, so they are worked out from ${plainAmount(opening)}, where the ledger leaves ${account} on ${state.latest.date}.`)
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
      notes.push(`It is statement ${sequence}, and the newest on the ledger for ${account} is ${state.lastSequence}, so ${sequence - state.lastSequence - 1 === 1 ? 'one statement is' : `${sequence - state.lastSequence - 1} statements are`} not on the ledger. The balances still join, so ${sequence - state.lastSequence - 1 === 1 ? 'it' : 'they'} may have held no entries.`)
    } else if (sequence <= state.lastSequence) {
      notes.push(`It is statement ${sequence}, which is not after ${state.lastSequence}, the newest on the ledger for ${account}.`)
    }
  }
  if (state.labels.has(statement.label)) {
    notes.push(`Rows of ${statement.label} are on the ledger already.`)
  }
  const balanced = withBalances(fresh, opening)
  const rows: DryRunRow[] = [
    ...withBalances(statement.rows.slice(0, firstNew), statement.opening).map((row) => ({ ...row, inLedger: true, verdict: null })),
    ...balanced.map((row) => ({
      ...row,
      inLedger: false,
      verdict: categorise({ account, amount: row.amount, counterparty: row.counterparty, counterpartyIban: normaliseIban(row.counterpartyIban), description: row.description, signals: row.signals }, inputs.rules, inputs.context),
    })),
  ]
  const last = balanced[balanced.length - 1]!
  state.latest = { date: last.date, balance: last.balance }
  for (const row of fresh) state.references.add(row.reference)
  state.labels.add(statement.label)
  if (statement.source.kind === 'camt') state.lastSequence = Math.max(state.lastSequence ?? 0, statement.source.sequence)
  const entries = balanced.map((row, index) => ledgerEntryOfImport(statement, { ...row, verdict: rows[firstNew + index]!.verdict }, inputs.categories))
  return { statement: { ...shell, opening: statement.opening ?? opening, closing: statement.closing ?? last.balance, rows, refusal: null, start, notes }, added: entries.reverse() }
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

/** Statements that were read, by account, then by their first entry's day, then by camt sequence. Refused files stay where they are. */
function inBookingOrder(readings: readonly StatementReading[]): StatementReading[] {
  const keyOf = (reading: StatementReading): [string, string, number] =>
    'statement' in reading
      ? [reading.statement.account, reading.statement.rows[0]?.date ?? '', reading.statement.source.kind === 'camt' ? reading.statement.source.sequence : 0]
      : ['', '', 0]
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
      state = { references: new Set(), labels: new Set(), latest: { date: transaction.date, balance: transaction.balance }, lastSequence: null }
      states.set(transaction.account, state)
    }
    if (transaction.reference !== '') state.references.add(transaction.reference)
    if (transaction.statement !== '') state.labels.add(transaction.statement)
    const sequence = /-statement-(\d+)$/.exec(transaction.statement)?.[1]
    if (sequence !== undefined) state.lastSequence = Math.max(state.lastSequence ?? 0, Number(sequence))
  }
  return states
}

