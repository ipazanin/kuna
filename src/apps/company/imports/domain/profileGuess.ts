import { normaliseIban } from '../../../../shared/text/fold'
import type { Account } from '../../workbook/domain/workbook'
import { DATE_FORMATS } from './importProfile'
import type { DateFormat, DecimalMark, ImportProfile } from './importProfile'
import type { CellGrid, StatementCell } from './tabularStatement'
import { dateOf } from './tabularStatement'

/** Header words of Croatian and English bank exports, in the order they are tried. */
const HINTS = {
  date: [/datum knji/i, /datum izvr/i, /datum valut/i, /^datum$/i, /booking date/i, /date/i, /datum/i],
  signed: [/^iznos$/i, /amount/i, /iznos/i],
  debit: [/isplat/i, /tere[cć]enj/i, /duguje/i, /debit/i, /^out/i],
  credit: [/uplat/i, /odobrenj/i, /potra[zž]uje/i, /credit/i, /^in$/i],
  balance: [/stanje/i, /saldo/i, /balance/i],
  counterpartyIban: [/iban/i, /ra[cč]un (platitelja|primatelja)/i],
  counterparty: [/naziv/i, /primatelj/i, /platitelj/i, /counterparty/i, /partner/i, /payee/i, /name/i],
  description: [/opis/i, /svrha/i, /description/i, /details/i],
  reference: [/referenc/i, /broj transakcije/i, /transaction id/i, /reference/i],
} as const

/** What a file looks like before a profile reads it: where its header is and what it holds. */
export interface FileShape {
  /** 0-based. */
  readonly headerRow: number
  readonly headers: readonly string[]
  /** A profile with the columns, date format and decimal mark the file most likely uses. Name and account are blank. */
  readonly guess: ImportProfile
}

/**
 * The likely header row of a bank export, the first row of three or more text cells that a row
 * with a date follows, and a profile guessed from its header words and the cells below.
 */
export function fileShapeOf(grid: CellGrid): FileShape | null {
  const headerRow = grid.findIndex((row, index) => {
    const texts = row.filter((cell) => typeof cell === 'string' && cell.trim() !== '' && !/^[\d.,\s-]+$/.test(cell))
    return texts.length >= 3 && grid.slice(index + 1, index + 4).some((below) => below.some(isDateCell))
  })
  if (headerRow < 0) return null
  const headers = grid[headerRow]!.map((cell) => (cell === undefined ? '' : String(cell).trim()))
  const taken = new Set<string>()
  const pick = (hints: readonly RegExp[]): string => {
    for (const hint of hints) {
      const found = headers.find((header) => header !== '' && !taken.has(header) && hint.test(header))
      if (found !== undefined) {
        taken.add(found)
        return found
      }
    }
    return ''
  }
  const date = pick(HINTS.date)
  const debit = pick(HINTS.debit)
  const credit = pick(HINTS.credit)
  const signed = debit !== '' && credit !== '' ? '' : pick(HINTS.signed)
  const balance = pick(HINTS.balance)
  const counterpartyIban = pick(HINTS.counterpartyIban)
  const reference = pick(HINTS.reference)
  const description = pick(HINTS.description)
  const counterparty = pick(HINTS.counterparty)
  const below = grid.slice(headerRow + 1, headerRow + 30)
  const columnCells = (name: string): (StatementCell | undefined)[] => {
    const column = headers.indexOf(name)
    return column < 0 ? [] : below.map((row) => row[column])
  }
  const amountCells = [signed, debit, credit, balance].flatMap(columnCells)
  return {
    headerRow,
    headers: headers.filter((header) => header !== ''),
    guess: {
      name: '',
      account: '',
      date,
      dateFormat: dateFormatOf(columnCells(date)),
      decimal: decimalOf(amountCells),
      amount: signed !== '' || debit === '' || credit === '' ? { signed: signed || debit || credit } : { debit, credit },
      balance,
      counterparty,
      counterpartyIban,
      description,
      reference,
    },
  }
}

/** A text date in any known format, or a number in the range of date cells from 1954 to 2119. */
function isDateCell(cell: StatementCell | undefined): boolean {
  return typeof cell === 'string' ? DATE_FORMATS.some((format) => dateOf(cell, format) !== null) : typeof cell === 'number' && cell > 20_000 && cell < 80_000
}

/** The format most text dates of the column read in, `dd.mm.yyyy` when none is text. */
function dateFormatOf(cells: readonly (StatementCell | undefined)[]): DateFormat {
  const texts = cells.filter((cell): cell is string => typeof cell === 'string' && cell.trim() !== '')
  const fits = DATE_FORMATS.map((format) => ({ format, count: texts.filter((text) => dateOf(text, format) !== null).length }))
  return fits.reduce((best, fit) => (fit.count > best.count ? fit : best), { format: 'dd.mm.yyyy' as DateFormat, count: 0 }).format
}

/** A comma when text amounts end in a comma and two digits, as `1.234,56` does, else a point. */
function decimalOf(cells: readonly (StatementCell | undefined)[]): DecimalMark {
  const texts = cells.filter((cell): cell is string => typeof cell === 'string' && cell.trim() !== '')
  const comma = texts.filter((text) => /,\d{1,2}\s*[A-Za-z]*$/.test(text.trim())).length
  const point = texts.filter((text) => /\.\d{1,2}\s*[A-Za-z]*$/.test(text.trim())).length
  return point > comma ? 'point' : 'comma'
}

/** The account whose IBAN the file names in its first rows, as a bank's title lines do, or the only account there is, or blank. */
export function accountNamedIn(grid: CellGrid, accounts: readonly Pick<Account, 'slug' | 'iban'>[]): string {
  const text = normaliseIban(grid.slice(0, 40).flat().map((cell) => (cell === undefined ? '' : String(cell))).join(' '))
  const named = accounts.find((account) => account.iban !== '' && text.includes(account.iban))
  return named?.slug ?? (accounts.length === 1 ? accounts[0]!.slug : '')
}
