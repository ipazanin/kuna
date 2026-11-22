import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { absMoney, addMoney, subtractMoney } from '../../../../shared/money/money'
import { statementTies } from '../../../../shared/money/statementTies'
import type { Money } from '../../../../shared/money/money'
import type { TwinAnswer } from '../../../../shared/money/lookAlikeBookings'
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
import { BY_HAND_SOURCES } from '../../workbook/domain/workbook'
import type { CompanyPeriod, Transaction } from '../../workbook/domain/workbook'
import { intakeRefusal, newAccountSources } from './importIntake'
import type { CamtOrigin, IntakeRefusal } from './importIntake'
import type { PaymentItem, RowPayments } from '../../workbook/domain/rowPayments'
import { copiedTwins } from './copiedTwins'
import type { CopiedTwinQuestion } from './copiedTwins'
import type { ImportedRow, ImportedStatement, NewAccountOffer, StatementReading } from './importedStatement'

/** One entry of a statement as the dry run sees it: on the ledger already, or new with the verdict the rules give it. */
export interface DryRunRow extends ImportedRow {
  /** Null while the file gives no balances and the account's opening is not known yet. */
  readonly balance: Money | null
  readonly inLedger: boolean
  /** Null for a row already on the ledger, or one of a statement that will not be written. */
  readonly verdict: Verdict | null
  /** The ledger row a copied entry looks like, set only on an entry that waits for the person to say whether it is another. */
  readonly like?: Transaction
  /** The row the AI copied that an entry of a file Kuna read looks like, which holds the entry as on the ledger until the person says to keep both. */
  readonly copiedTwin?: Transaction
  /** The row the AI copied that this entry takes the place of, whose category, share and row id it keeps. */
  readonly replaces?: Transaction
  /** The items a new entry's money becomes since part of it pays an invoice or pays back what a pack keeps, as the import proposes it. */
  readonly pays?: readonly PaymentItem[]
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

/** An account the import adds to the accounts tab, by the name the person gave it, with how its rows come in. */
export interface AddedAccount {
  readonly slug: string
  readonly iban: string
  readonly currency: string
  readonly sources: readonly CompanyPeriod[]
}

/** Why nothing of a statement is written. A reader's own refusal passes through as its reason. */
export type DryRunRefusal =
  | { readonly kind: 'unreadable'; readonly reason: string }
  | { readonly kind: 'replace-blocked'; readonly row: string; readonly day: CivilDate }
  | { readonly kind: 'imported-before'; readonly label: string; readonly noneMatch: boolean }
  | { readonly kind: 'gap' }
  | { readonly kind: 'no-reference'; readonly count: number }
  | { readonly kind: 'before-newest'; readonly first: CivilDate; readonly newest: CivilDate; readonly account: string }
  | { readonly kind: 'missing-between'; readonly account: string; readonly balance: Money; readonly day: CivilDate; readonly before: Money }
  | { readonly kind: 'part-does-not-tie'; readonly account: string; readonly left: Money; readonly rows: Money; readonly reached: Money; readonly closing: Money; readonly gap: Money }
  | IntakeRefusal

/** What may be wrong with a statement, for the person to check. A reader's own note passes through as its text. */
export type DryRunNote =
  | { readonly kind: 'reader'; readonly text: string }
  | { readonly kind: 'no-entries' }
  | { readonly kind: 'all-held' }
  | { readonly kind: 'sequence-gap'; readonly sequence: number; readonly newest: number; readonly account: string; readonly missing: number }
  | { readonly kind: 'sequence-not-after'; readonly sequence: number; readonly newest: number; readonly account: string }
  | { readonly kind: 'label-held'; readonly label: string }

/** What the import does that needs no check. */
export type DryRunFact =
  | { readonly kind: 'partly-held'; readonly held: number; readonly fresh: number }
  | { readonly kind: 'replaced-copied'; readonly count: number }
  | { readonly kind: 'works-out-balances'; readonly opening: Money; readonly account: string; readonly day: CivilDate }

/** A reader's notes as the dry run passes them on. */
function readerNotes(notes: readonly string[]): DryRunNote[] {
  return notes.map((text) => ({ kind: 'reader', text }))
}

export interface DryRunStatement {
  readonly fileName: string
  readonly label: string
  /** Blank for a statement that could not be read, or of a new account the person has not named. */
  readonly account: string
  readonly rows: readonly DryRunRow[]
  /** Why nothing of the statement is written, or null. */
  readonly refusal: DryRunRefusal | null
  /** Set while the statement waits for the person to start its account. */
  readonly start: AccountStart | null
  /** Set for a statement of an IBAN the accounts tab lacks, named or not. */
  readonly newAccount: NewAccountStart | null
  /** The entries that look like rows the AI copied, answered or not, in the statement's order. */
  readonly questions: readonly CopiedTwinQuestion[]
  /** What may be wrong with the statement, for the person to check. */
  readonly notes: readonly DryRunNote[]
  /** What the import does that needs no check, such as the entries on the ledger already. */
  readonly facts: readonly DryRunFact[]
  readonly opening: Money | null
  readonly closing: Money | null
}

export interface ImportDryRun {
  readonly statements: readonly DryRunStatement[]
  /** The ledger entries confirming would write, one statement after another, each newest first as the tab holds them. */
  readonly added: readonly LedgerEntry[]
  /** The rows the AI copied that confirming takes out, since entries of a file take their place. */
  readonly removed: readonly Transaction[]
  /** The accounts confirming would add before those entries. */
  readonly accounts: readonly AddedAccount[]
  /** The new entries whose money pays invoices or pays back what a pack keeps, each as the items it becomes, which confirming writes. */
  readonly payments: readonly RowPayments[]
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
  /** What the person said of the entries that look like rows the AI copied, by `copiedTwinKey`. */
  readonly twinAnswers: ReadonlyMap<string, TwinAnswer>
  /** Where each account's rows come from on which days, by its name. An account it lacks, such as one the import adds, is kept by hand. */
  readonly sources: ReadonlyMap<string, readonly CompanyPeriod[]>
  /** Where a camt statement comes from: the bank's statement mail, which each sync reads, or a file the person brings. */
  readonly camtOrigin: CamtOrigin
  /** What the new entries pay of the invoices and of the records a pack keeps, each entry as the items it becomes. */
  paymentsOf(added: readonly LedgerEntry[]): readonly RowPayments[]
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
 * counts as on the ledger until the person says to keep both, and then it is new. Or the person says the file's entry takes the
 * copied row's place. The ledger runs on from its newest row, so the copied rows go from the oldest such row on, each with the
 * entry it is or looks like taking its place and keeping its category, share and row id, so its split parts and links still find
 * it. A row after it the statement does not hold refuses the statement.
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
  const removed: Transaction[] = []
  const accounts = new Map<string, AddedAccount>()
  for (const reading of inBookingOrder(readings, inputs.named)) {
    if (!('statement' in reading)) {
      statements.push({
        fileName: reading.fileName,
        label: reading.label,
        account: '',
        rows: [],
        refusal: { kind: 'unreadable', reason: reading.refusal },
        start: null,
        newAccount: null,
        questions: [],
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
      removed.push(...planned.removed)
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
    const sources = newAccountSources(named, newAccount.date, inputs.camtOrigin)
    const planned = planStatement(named, stateOf(slug), { ...inputs, starts, sources: new Map([...inputs.sources, [slug, sources]]) })
    statements.push({ ...planned.statement, newAccount })
    added.push(...planned.added)
    removed.push(...planned.removed)
    if (planned.statement.refusal === null) accounts.set(slug, { slug, iban: newAccount.iban, currency: newAccount.currency, sources })
  }
  const rows = statements.flatMap((statement) => statement.rows)
  const payments = inputs.paymentsOf(added.filter((entry) => !removed.some((copied) => copied.rowId !== null && copied.rowId === entry.rowId)))
  return {
    statements: withPayments(statements, added, payments),
    added,
    removed,
    accounts: [...accounts.values()],
    payments,
    newRows: added.length,
    inLedger: rows.filter((row) => row.inLedger).length,
  }
}

/** Each new entry of the statements with the items its money becomes when it pays an invoice or pays back what a pack keeps, found by its account and reference. */
function withPayments(statements: readonly DryRunStatement[], added: readonly LedgerEntry[], payments: readonly RowPayments[]): DryRunStatement[] {
  if (payments.length === 0) return [...statements]
  const itemsOf = new Map(payments.map((payment) => [payment.row, payment.items]))
  const entryOf = new Map(added.map((entry) => [`${entry.account} ${entry.reference}`, entry]))
  return statements.map((statement) => ({
    ...statement,
    rows: statement.rows.map((row) => {
      const rowId = row.inLedger ? null : entryOf.get(`${statement.account} ${row.reference}`)?.rowId
      const pays = rowId === null || rowId === undefined ? undefined : itemsOf.get(rowId)
      return pays === undefined ? row : { ...row, pays }
    }),
  }))
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
    questions: [],
    notes: readerNotes(statement.notes),
    facts: [],
    opening: statement.opening,
    closing: statement.closing,
  }
}

/** What one statement would do: its rows, the entries it writes and the copied rows those take the place of. */
interface PlannedStatement {
  readonly statement: Omit<DryRunStatement, 'newAccount'>
  readonly added: readonly LedgerEntry[]
  readonly removed: readonly Transaction[]
}

function planStatement(statement: ImportedStatement, state: AccountState, inputs: DryRunInputs): PlannedStatement {
  const { account } = statement
  const notes = readerNotes(statement.notes)
  const facts: DryRunFact[] = []
  const twins = copiedTwins(
    statement,
    state.rows,
    statement.rows.map((row) => row.reference !== '' && state.references.has(row.reference)),
    inputs.twinAnswers,
  )
  const inLedger = [...twins.inLedger]
  const { likeOf, copiedTwinOf, twinOnLedger, questions } = twins
  const replacing = questions.flatMap((question) => (question.keep === 'file' ? [question.copied] : []))
  const oldestReplaced = replacing.reduce<Transaction | null>((oldest, copied) => (oldest === null || copied.sequence < oldest.sequence ? copied : oldest), null)
  const takenOut = oldestReplaced === null ? [] : state.rows.filter((row) => row.sequence >= oldestReplaced.sequence)
  const replacesOf = new Map(
    takenOut.flatMap((copied) => {
      const row = twinOnLedger.get(copied)
      return row === undefined ? [] : [[row, copied] as const]
    }),
  )
  for (const row of replacesOf.keys()) inLedger[statement.rows.indexOf(row)] = false
  const left = state.rows.filter((row) => !takenOut.includes(row))
  const latest = takenOut.length === 0 ? state.latest : newestOf(left)
  const held = statement.rows.map((row, index) => inLedger[index]! || likeOf.has(row))
  const firstNew = held.indexOf(false)
  const shell = { fileName: statement.fileName, label: statement.label, account, opening: statement.opening, closing: statement.closing }
  const shownRow = <Row extends ImportedRow>(row: Row, index: number) => {
    const like = likeOf.get(statement.rows[index]!)
    const copiedTwin = copiedTwinOf.get(statement.rows[index]!)
    return { ...row, inLedger: inLedger[index]!, verdict: null, ...(like === undefined ? {} : { like }), ...(copiedTwin === undefined ? {} : { copiedTwin }) }
  }
  const shown = (refusal: DryRunRefusal | null, start: AccountStart | null, opening: Money | null): Omit<DryRunStatement, 'newAccount'> => ({
    ...shell,
    rows: withBalances(statement.rows, opening).map(shownRow),
    refusal,
    start,
    questions,
    notes,
    facts,
  })
  const refused = (refusal: DryRunRefusal): PlannedStatement => ({ statement: shown(refusal, null, statement.opening), added: [], removed: [] })
  const stray = takenOut.find((row) => !twinOnLedger.has(row))
  if (stray !== undefined) return refused({ kind: 'replace-blocked', row: stray.counterparty || stray.description, day: stray.date })
  if (firstNew < 0) {
    if (likeOf.size === 0) notes.push({ kind: statement.rows.length === 0 ? 'no-entries' : 'all-held' })
    return { statement: shown(null, null, statement.opening), added: [], removed: [] }
  }
  if (statement.source.kind === 'table' && state.labels.has(statement.label)) {
    return refused({ kind: 'imported-before', label: statement.label, noneMatch: firstNew === 0 })
  }
  const fresh = statement.rows.slice(firstNew)
  if (held.slice(firstNew).some((kept) => kept)) {
    return refused({ kind: 'gap' })
  }
  const heldBefore = firstNew - likeOf.size - statement.rows.slice(0, firstNew).filter((row) => copiedTwinOf.has(row)).length
  if (heldBefore > 0) {
    facts.push({ kind: 'partly-held', held: heldBefore, fresh: fresh.length })
  }
  if (replacesOf.size > 0) facts.push({ kind: 'replaced-copied', count: replacesOf.size })
  const unidentified = fresh.filter((row) => row.reference === '')
  if (unidentified.length > 0) {
    return refused({ kind: 'no-reference', count: unidentified.length })
  }
  const first = fresh[0]!
  const intakeRefused = intakeRefusal(statement, inputs.sources.get(account) ?? BY_HAND_SOURCES, inputs.camtOrigin, fresh)
  if (intakeRefused !== null) return refused(intakeRefused)
  if (latest !== null && first.date < latest.date) {
    return refused({ kind: 'before-newest', first: first.date, newest: latest.date, account })
  }
  const before = first.balance === null ? null : subtractMoney(first.balance, first.amount)
  let opening: Money | null
  let start: AccountStart | null = null
  if (latest !== null) {
    if (before !== null && before !== latest.balance) {
      return refused(notRunningOn(statement, fresh, latest, before))
    }
    opening = latest.balance
    if (before === null) {
      facts.push({ kind: 'works-out-balances', opening, account, day: latest.date })
    }
  } else {
    start = { account, opening: before, date: first.date }
    const typed = inputs.starts.get(account)
    opening = before === null ? (typed ?? null) : typed === before ? before : null
    if (opening === null) {
      return { statement: shown(null, start, before), added: [], removed: [] }
    }
  }
  if (statement.source.kind === 'camt' && state.lastSequence !== null) {
    const { sequence } = statement.source
    if (sequence > state.lastSequence + 1) {
      notes.push({ kind: 'sequence-gap', sequence, newest: state.lastSequence, account, missing: sequence - state.lastSequence - 1 })
    } else if (sequence <= state.lastSequence) {
      notes.push({ kind: 'sequence-not-after', sequence, newest: state.lastSequence, account })
    }
  }
  if (state.labels.has(statement.label) && !isLaterPart(statement)) {
    notes.push({ kind: 'label-held', label: statement.label })
  }
  const balanced = withBalances(fresh, opening)
  const rows: DryRunRow[] = [
    ...withBalances(statement.rows.slice(0, firstNew), statement.opening).map(shownRow),
    ...balanced.map((row, index) => {
      const replaces = replacesOf.get(fresh[index]!)
      const copiedTwin = copiedTwinOf.get(fresh[index]!)
      return {
        ...row,
        inLedger: false,
        verdict:
          replaces === undefined
            ? categorise(
                { account, amount: row.amount, counterparty: row.counterparty, counterpartyIban: normaliseIban(row.counterpartyIban), description: row.description, signals: row.signals },
                inputs.rules,
                inputs.context,
              )
            : keptVerdict(replaces),
        ...(copiedTwin === undefined ? {} : { copiedTwin }),
        ...(replaces === undefined ? {} : { replaces }),
      }
    }),
  ]
  const last = balanced[balanced.length - 1]!
  state.rows.splice(0, state.rows.length, ...left)
  for (const row of takenOut) state.references.delete(row.reference)
  state.latest = { date: last.date, balance: last.balance }
  for (const row of fresh) state.references.add(row.reference)
  state.labels.add(statement.label)
  if (statement.source.kind === 'camt') state.lastSequence = Math.max(state.lastSequence ?? 0, statement.source.sequence)
  const entries = balanced.map((row, index) => {
    const { verdict, replaces } = rows[firstNew + index]!
    const entry = ledgerEntryOfImport(statement, { ...row, verdict }, inputs.categories)
    return replaces === undefined ? entry : { ...entry, flaggedBy: replaces.flaggedBy, ownerShare: replaces.ownerShare, rowId: replaces.rowId ?? entry.rowId }
  })
  return {
    statement: { ...shell, opening: statement.opening ?? opening, closing: statement.closing ?? last.balance, rows, refusal: null, start, questions, notes, facts },
    added: entries.reverse(),
    removed: takenOut,
  }
}

/** The verdict an entry keeps from the copied row it takes the place of: that row's category, settled unless it waits on review. */
function keptVerdict(copied: Transaction): Verdict {
  return { category: copied.category, flaggedBy: copied.flaggedBy === 'ai' ? 'ai' : 'rule', ruleId: null }
}

/** An account's newest row in booking order, as where the ledger leaves it, or null for none. */
function newestOf(rows: readonly Transaction[]): { readonly date: CivilDate; readonly balance: Money } | null {
  const newest = rows.reduce<Transaction | null>((found, row) => (found === null || row.sequence > found.sequence ? row : found), null)
  return newest === null ? null : { date: newest.date, balance: newest.balance }
}

/** Whether the statement is a later part of one the AI copied, whose earlier parts' rows carry its label. */
function isLaterPart(statement: ImportedStatement): boolean {
  return statement.source.kind === 'transcribed' && statement.source.part > 1
}

/**
 * Why a statement's first new entry does not start where the ledger leaves the account. A later part of a copied statement runs
 * back from its printed closing, so it does not add up with its earlier parts, and any other statement misses one before it.
 */
function notRunningOn(statement: ImportedStatement, fresh: readonly ImportedRow[], latest: { readonly date: CivilDate; readonly balance: Money }, before: Money): DryRunRefusal {
  const tie = isLaterPart(statement) && statement.closing !== null ? statementTies({ opening: latest.balance, amounts: fresh.map((row) => row.amount), closing: statement.closing }) : null
  return tie?.kind === 'off'
    ? { kind: 'part-does-not-tie', account: statement.account, left: latest.balance, rows: tie.rows, reached: tie.reached, closing: tie.statement.closing, gap: absMoney(tie.gap) }
    : { kind: 'missing-between', account: statement.account, balance: latest.balance, day: latest.date, before }
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
