import { listInWords } from '../../workbook/domain/slug'
import type { WorkbookStore } from '../../workbook/application/createWorkbookStore'
import type { WriteReceipt } from '../../workbook/application/recordWrites'
import type { WorkbookCopy } from '../../workbook/application/workbookPorts'
import { WorkbookWriteRefused } from '../../workbook/application/workbookWriteRefused'
import type { Workbook } from '../../workbook/domain/workbook'
import type { DryRunStatement } from '../domain/importDryRun'
import type { StatementReading } from '../domain/importedStatement'
import { statementFilesToRead } from '../domain/statementFiles'
import type { StatementFile } from '../domain/statementFiles'
import { dryRunFor, statementReadings } from './importStatements'
import type { LoadedImportFile } from './importStatements'
import { LEDGER_WRITES } from './ledgerWrites'
import type { StatementFolder } from './statementFolder'

/** What the statements step of a sync is doing: looking through the folder, or filing this many rows. */
export type StatementSyncStep = { readonly kind: 'looking' } | { readonly kind: 'filing'; readonly rows: number }

/** What one sync did with the statements folder. It is held by the page and never stored. */
export interface StatementSyncOutcome {
  /** Why the folder could not be read or the statements not filed, or null. */
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
  readonly store: Pick<WorkbookStore<WorkbookCopy>, 'state' | 'sync' | 'write'>
  readonly folder: StatementFolder
  load(fileName: string, bytes: ArrayBuffer): Promise<LoadedImportFile>
  step(step: StatementSyncStep): void
}

/**
 * Files the statements of the folder the ledger lacks, after the file was read: the files whose
 * name the ledger does not hold are downloaded and read, one dry run takes them all, and one write
 * adds every statement it accepts through the ledger's write rules, as Import does. A statement it
 * refuses or that waits for its account to start is held, and nothing after it is written for that
 * account. A sync with nothing new downloads nothing and writes nothing.
 */
export async function fileNewStatements(ports: StatementSyncPorts): Promise<StatementSyncOutcome> {
  const workbook = ports.store.state.workbook
  if (workbook === null) {
    return NOTHING_FILED
  }
  ports.step({ kind: 'looking' })
  let readings: StatementReading[]
  try {
    const listing = await ports.folder.files(workbook.settings.statementsFolder)
    if (listing.kind === 'refused') {
      return { ...NOTHING_FILED, problem: listing.reason }
    }
    const toRead = statementFilesToRead(listing.files, workbook.transactions)
    if (toRead.length === 0) {
      return NOTHING_FILED
    }
    readings = (await Promise.all(toRead.map((file) => readingsOf(file, ports, workbook)))).flat()
  } catch (failure) {
    return { ...NOTHING_FILED, problem: `The statements folder could not be read: ${messageOf(failure)}` }
  }
  return await fileReadings(readings, ports, true)
}

async function readingsOf(file: StatementFile, ports: StatementSyncPorts, workbook: Workbook): Promise<StatementReading[]> {
  const bytes = await ports.folder.download(file)
  let loaded: LoadedImportFile
  try {
    loaded = await ports.load(file.name, bytes)
  } catch (failure) {
    return [{ fileName: file.name, label: file.name, refusal: messageOf(failure) }]
  }
  if (loaded.kind !== 'camt') {
    return [{ fileName: file.name, label: file.name, refusal: `${file.name} is not a camt.053 statement, so it was not read.` }]
  }
  return statementReadings(loaded, workbook, null)
}

/**
 * The write of every accepted statement. When it is refused, such as for rows another device's sync
 * filed since the file was read, the file is read again and the dry run runs once more on it.
 */
async function fileReadings(readings: readonly StatementReading[], ports: StatementSyncPorts, mayRetry: boolean): Promise<StatementSyncOutcome> {
  const { store } = ports
  const run = dryRunFor(readings, store.state.workbook!, new Map())
  const filed = run.statements.filter(isFiled)
  const kept = new Set(run.statements.filter(waitsForPerson).map(statementKey))
  const held = readings.filter((reading) => kept.has(readingKey(reading)))
  if (run.added.length === 0) {
    return { ...NOTHING_FILED, held }
  }
  ports.step({ kind: 'filing', rows: run.newRows })
  try {
    const receipt = await store.write(filedTitle(filed, run.newRows), (unit) => run.added.forEach((entry) => unit.of(LEDGER_WRITES).add(entry)))
    return { problem: null, held, filed: receipt === null ? [] : filed, receipt }
  } catch (failure) {
    if (!(failure instanceof WorkbookWriteRefused) || !mayRetry) {
      const unwritten = new Set(filed.map(statementKey))
      return { problem: messageOf(failure), held: readings.filter((reading) => kept.has(readingKey(reading)) || unwritten.has(readingKey(reading))), filed: [], receipt: null }
    }
    await store.sync()
    if (store.state.status !== 'ready' || store.state.workbook === null) {
      return { ...NOTHING_FILED, problem: store.state.error ?? messageOf(failure), held: [...readings] }
    }
    ports.step({ kind: 'looking' })
    return await fileReadings(readings, ports, false)
  }
}

/** A statement the dry run writes: nothing refused, no account to start, and at least one new row. */
function isFiled(statement: DryRunStatement): boolean {
  return statement.refusal === null && statement.start === null && statement.rows.some((row) => row.verdict !== null)
}

/** A statement the person has to look at: refused, or its account waits to be started. */
function waitsForPerson(statement: DryRunStatement): boolean {
  return statement.refusal !== null || statement.start !== null
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
  const which = numbers.length === 1 ? `statement ${numbers[0]}` : numbers.length === 2 ? `statements ${listInWords(numbers)}` : `${numbers.length} statements`
  return `Filed ${which}, ${rows === 1 ? '1 row' : `${rows} rows`}`
}

function messageOf(failure: unknown): string {
  return failure instanceof Error ? failure.message : String(failure)
}
