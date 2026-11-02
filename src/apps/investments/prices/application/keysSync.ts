import type { KeysDrive } from './pricesPorts'
import { decodeKeysFile, encodeKeysFile, keysFileName, newestKeys, sameKeys } from '../domain/keysFile'
import type { KeysFileRefusal, VendorKeyChanges } from '../domain/keysFile'

export interface KeysSyncPorts {
  readonly drive: KeysDrive
  /** The vendors this Kuna keeps keys for. The file's other vendors, as a newer Kuna may keep, pass through as they are. */
  readonly vendorIds: readonly string[]
  /** This browser's keys, each with when it was last saved or removed. */
  here(): VendorKeyChanges
  /** Keeps these in this browser with their times, as the newer changes from the file. */
  keep(changes: VendorKeyChanges): void
}

/**
 * What the sync of the keys did: nothing to change, this browser's newer changes saved to the file, the file's newer
 * changes taken into this browser, whether or not some went the other way too, or a file Kuna leaves as it is.
 */
export type KeysSyncResult = { readonly kind: 'unchanged' | 'sent' | 'received' } | { readonly kind: 'refused'; readonly reason: KeysFileRefusal }

/**
 * Merges this browser's keys with the keys file of the Investments file, the newer change of each vendor winning, a
 * removal as much as a save. The file is made only once there is a key or a removal to keep in it. Of two files two
 * browsers made at once, each takes the one whose id sorts first, the other one's changes reach it on their next sync,
 * and the other file stays in the folder.
 */
export async function syncVendorKeys(ports: KeysSyncPorts, investmentsFileId: string): Promise<KeysSyncResult> {
  const name = keysFileName(investmentsFileId)
  const [fileId] = [...(await ports.drive.filesNamed(name))].sort()
  let inFile: VendorKeyChanges = {}
  if (fileId !== undefined) {
    const read = decodeKeysFile(await ports.drive.download(fileId))
    if (read.kind === 'refused') {
      return read
    }
    inFile = read.changes
  }
  const entries = Object.entries(inFile)
  const known = Object.fromEntries(entries.filter(([vendorId]) => ports.vendorIds.includes(vendorId)))
  const others = Object.fromEntries(entries.filter(([vendorId]) => !ports.vendorIds.includes(vendorId)))
  const newest = newestKeys(ports.here(), known)
  const sent = !sameKeys(newest, known)
  if (sent) {
    const text = encodeKeysFile({ ...others, ...newest })
    await (fileId === undefined ? ports.drive.createFile(name, text) : ports.drive.overwrite(fileId, text))
  }
  // Read again after the write, so a key saved or removed on the card meanwhile is newer and stays.
  const hereNow = ports.here()
  const kept = newestKeys(hereNow, newest)
  if (!sameKeys(kept, hereNow)) {
    ports.keep(kept)
    return { kind: 'received' }
  }
  return { kind: sent ? 'sent' : 'unchanged' }
}
