import type { RecordsRead } from '../../../../shared/storage/domain/recordsRead'

export function rowsInWords(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`
}

/** The rows of a kind as the books hold them, the refused ones among them. */
export function storedCount(read: RecordsRead<unknown>): number {
  return read.records.length + read.refused.length
}
