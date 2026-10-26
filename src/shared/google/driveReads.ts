import Dexie from 'dexie'
import type { EntityTable } from 'dexie'

const DATABASE_NAME = 'ledgerboard-drive-reads'

/** When sign-out last forgot the reads, as epoch milliseconds. */
let forgottenAt = 0

interface KeptRead {
  readonly name: string
  readonly read: unknown
}

type DriveReadsDatabase = Dexie & {
  reads: EntityTable<KeptRead, 'name'>
}

async function withDatabase<Result>(use: (database: DriveReadsDatabase) => Promise<Result>): Promise<Result> {
  const database = new Dexie(DATABASE_NAME) as DriveReadsDatabase
  database.version(1).stores({ reads: 'name' })
  try {
    return await use(database)
  } finally {
    database.close()
  }
}

/**
 * What a screen last read from Drive with the Drive read scope, by the name it was kept under, or
 * null when this device keeps none or cannot store it. The token itself is never kept.
 */
export async function keptDriveRead(name: string): Promise<unknown> {
  try {
    return (await withDatabase((database) => database.reads.get(name)))?.read ?? null
  } catch {
    return null
  }
}

/**
 * Keeps a read on this device until the next one replaces it or sign-out forgets it. A read that
 * started before the last sign-out is not kept. Without storage it is simply not kept.
 */
export async function keepDriveRead(name: string, read: unknown, startedAt: number): Promise<void> {
  if (startedAt <= forgottenAt) return
  try {
    await withDatabase((database) => database.reads.put({ name, read }))
  } catch {
    // Private windows and full disks refuse it, and the next open reads Drive again.
  }
}

/** Forgets every read kept from Drive, as signing out of Google does. */
export async function forgetDriveReads(): Promise<void> {
  forgottenAt = Date.now()
  try {
    await Dexie.delete(DATABASE_NAME)
  } catch {
    // No storage means nothing was kept.
  }
}
