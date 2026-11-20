import { isUnauthorized } from '../../../../shared/google/googleApi'
import type { WorkbookStore } from '../../../../shared/storage/application/createWorkbookStore'
import type { CompanyBooks } from '../../workbook/domain/readWorkbook'
import type { WriteReceipt } from '../../../../shared/storage/application/recordWrites'
import { WorkbookWriteRefused } from '../../../../shared/storage/application/workbookWriteRefused'
import type { DryRunStatement } from '../domain/importDryRun'
import type { StatementReading } from '../domain/importedStatement'
import { dryRunFor, writeImport } from './importStatements'
import { companyBooksOf } from '../../workbook/domain/readWorkbook'
import { words } from './words'

/** What filing a sync's statements is doing: checking them against the ledger, or filing this many rows. */
export type StatementSyncStep = { readonly kind: 'looking' } | { readonly kind: 'filing'; readonly rows: number }

/** What one sync did with the statements it read. It is held by the page and never stored. */
export interface StatementSyncOutcome {
  /** Why the statements were not filed, or null. */
  readonly problem: string | null
  /** The statements this sync read and did not file, which wait for the person on the Import tab. */
  readonly held: readonly StatementReading[]
  /** The statements this sync filed, as its dry run gave them. */
  readonly filed: readonly DryRunStatement[]
  /** The one write that filed them, or null when nothing was written. */
  readonly receipt: WriteReceipt | null
}

export const NOTHING_FILED: StatementSyncOutcome = { problem: null, held: [], filed: [], receipt: null }

export interface StatementSyncPorts {
  readonly store: Pick<WorkbookStore<CompanyBooks>, 'state' | 'sync' | 'write'>
  step(step: StatementSyncStep): void
}

/**
 * Files the statements a sync read from the bank's mail: one dry run takes them all, and one write adds every statement it
 * accepts through the ledger's write rules, as Import does. Only an account the bank's statements fill takes them, from its
 * start day. A statement it refuses, such as one of an account kept by hand or one before that day, one that waits for its
 * account to start, or one whose IBAN no account has, is held, and nothing after it is written for that account. A sync whose
 * statements the ledger holds already writes nothing. Google turning the token away throws, so the sync can ask for access.
 */
export async function fileNewStatements(readings: readonly StatementReading[], ports: StatementSyncPorts): Promise<StatementSyncOutcome> {
  if (ports.store.state.workbook === null || readings.length === 0) {
    return NOTHING_FILED
  }
  ports.step({ kind: 'looking' })
  return await fileReadings(readings, ports, true)
}

/**
 * The write of every accepted statement. When it is refused, such as for rows another device's sync
 * filed since the file was read, the file is read again and the dry run runs once more on it.
 */
async function fileReadings(readings: readonly StatementReading[], ports: StatementSyncPorts, mayRetry: boolean): Promise<StatementSyncOutcome> {
  const { store } = ports
  const books = companyBooksOf(store.state)!
  const run = dryRunFor(readings, books, new Map(), new Map(), new Map(), false, 'automation')
  const filed = run.statements.filter(isFiled)
  const kept = new Set(run.statements.filter(waitsForPerson).map(statementKey))
  const held = readings.filter((reading) => kept.has(readingKey(reading)))
  if (run.added.length === 0) {
    return { ...NOTHING_FILED, held }
  }
  ports.step({ kind: 'filing', rows: run.newRows })
  try {
    const receipt = await store.write(filedTitle(filed, run.newRows), (unit) => writeImport(unit, run, companyBooksOf(store.state)))
    return { problem: null, held, filed: receipt === null ? [] : filed, receipt }
  } catch (failure) {
    if (!(failure instanceof WorkbookWriteRefused) || !mayRetry) {
      const unwritten = new Set(filed.map(statementKey))
      return {
        problem: isUnauthorized(failure) ? words.sync.syncAgain : messageOf(failure),
        held: readings.filter((reading) => kept.has(readingKey(reading)) || unwritten.has(readingKey(reading))),
        filed: [],
        receipt: null,
      }
    }
    await store.sync()
    if (store.state.status !== 'ready' || store.state.workbook === null) {
      return { ...NOTHING_FILED, problem: store.state.error ?? messageOf(failure), held: [...readings] }
    }
    ports.step({ kind: 'looking' })
    return await fileReadings(readings, ports, false)
  }
}

/** A statement the dry run writes: nothing refused, no account to start or add, and at least one new row. */
function isFiled(statement: DryRunStatement): boolean {
  return !waitsForPerson(statement) && statement.rows.some((row) => row.verdict !== null)
}

/** A statement the person has to look at: refused, its account waits to be started, or its IBAN names an account to add. */
function waitsForPerson(statement: DryRunStatement): boolean {
  return statement.refusal !== null || statement.start !== null || statement.newAccount !== null
}

/** A held statement the ledger still lacks, as its dry run now says: refused, waiting for its account, or with rows to add. */
export function stillHeld(statement: DryRunStatement): boolean {
  return waitsForPerson(statement) || statement.rows.some((row) => !row.inLedger)
}

function statementKey(statement: Pick<DryRunStatement, 'fileName' | 'label'>): string {
  return JSON.stringify([statement.fileName, statement.label])
}

function readingKey(reading: StatementReading): string {
  return statementKey('statement' in reading ? reading.statement : reading)
}

/** "Filed statement 028, 4 rows", "Filed statements 028 and 029, 5 rows", or "Filed 3 statements, 9 rows". */
export function filedTitle(statements: readonly Pick<DryRunStatement, 'label'>[], rows: number): string {
  const numbers = statements.map((statement) => /-statement-(\d+)$/.exec(statement.label)?.[1] ?? statement.label)
  return words.sync.filed(numbers, rows)
}

function messageOf(failure: unknown): string {
  return failure instanceof Error ? failure.message : String(failure)
}
