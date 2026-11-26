import { normaliseIban } from '../../../../shared/text/fold'
import { HEADER_SEARCH_ROWS } from '../../../../shared/recipes/domain/headerRow'
import { dateFrom } from '../../../../shared/recipes/domain/runRecipe'
import { DRAFT_DATE_FORMATS } from '../../../../shared/recipes/domain/tableRecipeDraft'
import type { TableRecipeDraft } from '../../../../shared/recipes/domain/tableRecipeDraft'
import type { DecimalMark } from '../../../../shared/money/decimal'
import type { Account } from '../../workbook/domain/workbook'
import type { TableCells } from '../../../../shared/recipes/domain/tableRows'

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

/** What a file looks like before a recipe reads it: its header texts and a recipe guessed from them. */
export interface FileShape {
  /** 0-based. */
  readonly headerRow: number
  readonly headers: readonly string[]
  /** A draft with the columns, day format and decimal mark the file most likely uses, every row an entry. Its name is blank. */
  readonly guess: TableRecipeDraft
}

function isDate(text: string): boolean {
  return DRAFT_DATE_FORMATS.some((format) => dateFrom(text.trim(), [format]) !== null)
}

/**
 * The likely header row of a bank export, the first row of three or more text cells that a row with a date follows, and a
 * recipe guessed from its header words and the cells below.
 */
export function fileShapeOf({ texts: cells }: TableCells): FileShape | null {
  const headerRow = cells.slice(0, HEADER_SEARCH_ROWS).findIndex((row, index) => {
    const texts = row.filter((cell) => cell.trim() !== '' && !/^[\d.,\s-]+$/.test(cell))
    return texts.length >= 3 && cells.slice(index + 1, index + 4).some((below) => below.some(isDate))
  })
  if (headerRow < 0) return null
  const headers = cells[headerRow]!.map((cell) => cell.trim())
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
  const columns = {
    balance: pick(HINTS.balance),
    counterpartyIban: pick(HINTS.counterpartyIban),
    reference: pick(HINTS.reference),
    description: pick(HINTS.description),
    counterparty: pick(HINTS.counterparty),
  }
  const below = cells.slice(headerRow + 1, headerRow + 30)
  const columnCells = (name: string): string[] => {
    const column = headers.indexOf(name)
    return column < 0 ? [] : below.map((row) => row[column] ?? '')
  }
  return {
    headerRow,
    headers: headers.filter((header) => header !== ''),
    guess: {
      name: '',
      date: { column: date, format: dateFormatOf(columnCells(date)) },
      amount: signed !== '' || debit === '' || credit === '' ? { column: signed || debit || credit } : { debit, credit },
      mark: decimalOf([signed, debit, credit, columns.balance].flatMap(columnCells)),
      columns: Object.fromEntries(Object.entries(columns).filter(([, column]) => column !== '')),
      kinds: [{ kind: 'entry', test: null }],
    },
  }
}

/** The day format most dates of the column read in, `dd.MM.yyyy` when none does. */
function dateFormatOf(cells: readonly string[]): string {
  const texts = cells.map((cell) => cell.trim()).filter((cell) => cell !== '')
  const fits = DRAFT_DATE_FORMATS.map((format) => ({ format: format as string, count: texts.filter((text) => dateFrom(text, [format]) !== null).length }))
  return fits.reduce((best, fit) => (fit.count > best.count ? fit : best), { format: 'dd.MM.yyyy', count: 0 }).format
}

/** A comma when amounts end in a comma and two digits, as `1.234,56` does, else a point, as a sheet's own number cells read. */
function decimalOf(cells: readonly string[]): DecimalMark {
  const texts = cells.map((cell) => cell.trim()).filter((cell) => cell !== '')
  const comma = texts.filter((text) => /,\d{1,2}\s*[A-Za-z]*$/.test(text)).length
  const point = texts.filter((text) => /\.\d{1,2}\s*[A-Za-z]*$/.test(text)).length
  return point > comma ? 'point' : 'comma'
}

/** The account whose IBAN the file names in its first rows, as a bank's title lines do, or the only account there is, or none. */
export function accountNamedIn<Named extends Pick<Account, 'iban'>>(cells: TableCells, accounts: readonly Named[]): Named | null {
  const text = normaliseIban(cells.texts.slice(0, HEADER_SEARCH_ROWS).flat().join(' '))
  return accounts.find((account) => account.iban !== '' && text.includes(account.iban)) ?? (accounts.length === 1 ? accounts[0]! : null)
}
