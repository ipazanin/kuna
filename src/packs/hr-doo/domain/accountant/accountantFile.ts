import { parseMonthKey } from '../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import type { DocumentReading } from './accountantDocument'

/** A VAT return names its month as `YYYY-MM-pdv`, a salary workbook its worked month as `YYYY-MM-salary`. */
export type AccountantDocumentKind = 'vat-return' | 'salary'

/** The mailed xlsx, or a Google Sheet someone converted it to. */
export type AccountantFileFormat = 'xlsx' | 'google-sheet'

export interface AccountantFileName {
  readonly period: MonthKey
  readonly kind: AccountantDocumentKind
}

export interface AccountantFile extends AccountantFileName {
  readonly name: string
  readonly format: AccountantFileFormat
}

/** One period's file, and any other file of the same period and kind, which should say the same. */
export interface PeriodFiling<File extends AccountantFile> {
  readonly file: File
  readonly alsoFiled: readonly File[]
}

const FILE_NAME = /^(\d{4}-\d{2})-(pdv|salary)(\.xlsx)?$/i

/** The period and kind a file's name stands for, with or without `.xlsx`, or null for any other file. */
export function accountantFileNameOf(name: string): AccountantFileName | null {
  const match = FILE_NAME.exec(name.trim())
  const period = match === null ? null : parseMonthKey(match[1] ?? '')
  if (match === null || period === null) {
    return null
  }
  return { period, kind: match[2]?.toLowerCase() === 'pdv' ? 'vat-return' : 'salary' }
}

/**
 * One file per period and kind, in period order. The mailed xlsx is read before a Google Sheet
 * converted from it, and the others are kept so a reader can check they say the same.
 */
export function filingsByPeriod<File extends AccountantFile>(files: readonly File[]): PeriodFiling<File>[] {
  const groups = new Map<string, File[]>()
  for (const file of files) {
    const key = `${file.period} ${file.kind}`
    groups.set(key, [...(groups.get(key) ?? []), file])
  }
  return [...groups.entries()]
    .sort(([earlier], [later]) => earlier.localeCompare(later))
    .map(([, group]) => {
      const [file, ...alsoFiled] = [...group].sort((first, second) => formatOrder(first.format) - formatOrder(second.format) || first.name.localeCompare(second.name))
      return { file: file!, alsoFiled }
    })
}

/** Whether two files of one period read the same, so the second changes nothing. */
export function sameReading<Document>(first: DocumentReading<Document>, second: DocumentReading<Document>): boolean {
  return JSON.stringify(first) === JSON.stringify(second)
}

function formatOrder(format: AccountantFileFormat): number {
  return format === 'xlsx' ? 0 : 1
}
