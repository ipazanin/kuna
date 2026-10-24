import type { StatementCell } from '../../../../features/imports/domain/tabularStatement'
import { civilDate, serialFromCivilDate } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { FAKE_SPREADSHEET_ID } from '../../../../features/workbook/infrastructure/fake/fakeWorkbook'
import type { AccountantFolders, DriveWorkbook } from '../../application/accountantDocuments'
import type { DocumentTab } from '../../domain/accountant/accountantDocument'
import { DEFAULT_PAYROLL_FOLDER, DEFAULT_VAT_RETURNS_FOLDER } from '../../domain/companyFacts'

type Row = (StatementCell | undefined)[]

interface FakeVatReturn {
  readonly sale: { readonly number: string; readonly issued: CivilDate; readonly amount: number }
  /** Base and VAT of each local purchase. */
  readonly local: readonly (readonly [number, number])[]
  /** Base and VAT of each EU service, reverse charged. Leave out for a return without the tab. */
  readonly eu?: readonly (readonly [number, number])[]
  /** Negative, as the return states an overpayment. */
  readonly carriedForward: number
  /** One cell typed over, by tab name, row and column from 1 as a spreadsheet numbers them. */
  readonly misprint?: { readonly tab: string; readonly row: number; readonly column: number; readonly cell: StatementCell }
}

/** Cents added, so a total is what a spreadsheet's SUM shows. */
function total(amounts: readonly number[]): number {
  return Math.round(amounts.reduce((sum, amount) => sum + Math.round(amount * 100), 0)) / 100
}

const PURCHASE_HEADER: Row = ['R.b.', 'Broj računa', 'Datum', 'Dobavljač', 'PDV ID broj', 'Osnovica', 'PDV', 'Ukupno', 'Check']

function purchaseTab(name: string, code: string, lines: readonly (readonly [number, number])[]): DocumentTab {
  const base = total(lines.map(([lineBase]) => lineBase))
  const vat = total(lines.map(([, lineVat]) => lineVat))
  return {
    name,
    grid: [
      PURCHASE_HEADER,
      ...lines.map(([lineBase, lineVat], index): Row => [`${index + 1}.`, `R-${index + 1}`, serialFromCivilDate(civilDate(2026, 1, 15)), 'Example Supplier', 'HR00000000000', lineBase, lineVat, total([lineBase, lineVat]), 0]),
      [],
      [undefined, undefined, undefined, undefined, undefined, 'Osnovica', 'PDV'],
      [undefined, undefined, undefined, undefined, code, base, vat, total([base, vat])],
    ],
  }
}

/** The tabs of a made-up VAT return, laid out as the accountant's files are, which carries forward what it says. */
function vatReturnTabs(spec: FakeVatReturn): DocumentTab[] {
  const { misprint } = spec
  const tabs = filedVatReturnTabs(spec)
  return misprint === undefined
    ? tabs
    : tabs.map((tab) => (tab.name === misprint.tab ? { ...tab, grid: tab.grid.map((cells, index) => (index === misprint.row - 1 ? cells.map((old, at) => (at === misprint.column - 1 ? misprint.cell : old)) : cells)) } : tab))
}

function filedVatReturnTabs(spec: FakeVatReturn): DocumentTab[] {
  const local = purchaseTab('Lokalni U', 'III.3.', spec.local)
  const eu = spec.eu === undefined ? null : purchaseTab('EU usluge U', 'II.10./III.10.', spec.eu)
  const localBase = total(spec.local.map(([base]) => base))
  const localVat = total(spec.local.map(([, vat]) => vat))
  const euBase = total((spec.eu ?? []).map(([base]) => base))
  const euVat = total((spec.eu ?? []).map(([, vat]) => vat))
  const difference = total([euVat, -euVat, -localVat])
  return [
    {
      name: 'Rekapitulacija',
      grid: [
        ['Vrsta isporuke', 'Osnovica', 'PDV'],
        ['Izlazne isporuke'],
        ['Obavljene usluge u TZ', spec.sale.amount],
        ...(eu === null ? [] : [['EU - usluge', euBase, euVat]]),
        ['Ukupno', total([spec.sale.amount, euBase]), euVat],
        ['Ulazne isporuke'],
        ['Lokalne isporuke', localBase, localVat],
        ...(eu === null ? [] : [['EU - usluge', euBase, euVat]]),
        ['Ukupno', total([localBase, euBase]), total([localVat, euVat])],
        ['Razlika PDV-a', undefined, difference],
        ['Pretplata iz prethodnih razdoblja', undefined, total([spec.carriedForward, -difference])],
        ['Pretplata za prijenos u buduća razdoblja', undefined, spec.carriedForward],
      ],
    },
    { name: 'Izlazni>>', grid: [] },
    {
      name: 'Treće zemlje usluge I',
      grid: [
        ['R.b.', 'Broj računa', 'Datum', 'Kupac', 'Porezni broj', 'Iznos'],
        ['1.', spec.sale.number, serialFromCivilDate(spec.sale.issued), 'Northwind Analytics Ltd', 'GB000000000', spec.sale.amount],
        [],
        [undefined, undefined, undefined, undefined, undefined, 'Iznos'],
        [undefined, undefined, undefined, undefined, 'I.5.', spec.sale.amount],
      ],
    },
    { name: 'Ulazni>>', grid: [] },
    local,
    ...(eu === null ? [] : [eu]),
  ]
}

interface FakeSalary {
  /** The title, which names the worked month and the payout date. */
  readonly title: string
  readonly incomeTax: number
  readonly net: number
  readonly commuting: number
  readonly stateTake: number
}

/**
 * A made-up salary workbook at the 2026 director floor for an owner living in Zagreb, in pillar II,
 * with a meal allowance and a commuting refund beside it. The figures above the income tax are the
 * payroll engine's.
 */
function salaryTabs(spec: FakeSalary): DocumentTab[] {
  const paidToEmployee = total([spec.net, 100, spec.commuting])
  return [
    {
      name: 'Obračun plaće_Alex Example',
      grid: [
        [spec.title],
        ['Stavka', 'Iznos', 'Napomena'],
        ['Bruto plaća II', 1509.2],
        ['Zdravstveno osiguranje', 213.75],
        ['Bruto plaća I', 1295.45, 'Minimalna osnovica za direktora'],
        ['Mirovinsko (I. stup)', 193.98, 'Uz olakšicu za niske plaće'],
        ['Mirovinsko (II. stup)', 64.77],
        ['Dohodak', 1036.7],
        ['Osobni odbitak', 600],
        ['Oporezivi dio dohotka', 436.7],
        ['Porez na dohodak', spec.incomeTax, 'Grad Zagreb - 23,00%'],
        ['Neto plaća', spec.net],
        ['Neoporezive isplate'],
        ['Prehrana', 100],
        ['Naknada za prijevoz', spec.commuting],
        [],
        ['Ukupni trošak', total([1509.2, 100, spec.commuting])],
        ['  - Država', spec.stateTake, 'Doprinosi i porez'],
        ['- Alex Example', paidToEmployee, 'Na račun'],
      ],
    },
  ]
}

/** The engine's figures for a month at the 2026 floor. */
const AT_THE_FLOOR = { incomeTax: 100.44, net: 936.26, commuting: 63.74, stateTake: 572.94 }

interface FakeFile extends DriveWorkbook {
  readonly folder: 'vat-returns' | 'payroll'
  readonly tabs: DocumentTab[]
}

/**
 * The fake build's accountant folders at the default paths, against the fake ledger. On Year 2026,
 * Taxes: the April and June returns close on the books, July carries forward 12.40 less than the
 * books, August's local purchases do not add up to their total row, and September's sales line has
 * two digits swapped. May has no return. The June salary closes on the bank but its income tax is
 * below the ruleset's, July's follows the ruleset but the bank paid the state less, and August's
 * title names July. July's VAT return and salary are Google Sheets.
 */
const FAKE_FILES: readonly FakeFile[] = [
  vatFile('2026-04-pdv.xlsx', 'xlsx', { sale: { number: '5-1-26', issued: civilDate(2026, 4, 30), amount: 7109.87 }, local: [[120, 30]], carriedForward: -2859.41 }),
  vatFile('2026-06-pdv.xlsx', 'xlsx', {
    sale: { number: '7-1-26', issued: civilDate(2026, 6, 30), amount: 7478.75 },
    local: [
      [120, 30],
      [11.2, 2.8],
    ],
    eu: [[60, 15]],
    carriedForward: -3246.16,
  }),
  vatFile('2026-07-pdv', 'google-sheet', { sale: { number: '8-1-26', issued: civilDate(2026, 7, 31), amount: 7494.05 }, local: [[120, 30]], carriedForward: -3267.14 }),
  vatFile('2026-08-pdv.xlsx', 'xlsx', {
    sale: { number: '9-1-26', issued: civilDate(2026, 8, 31), amount: 8006.73 },
    local: [[120, 30]],
    carriedForward: -3320.49,
    misprint: { tab: 'Lokalni U', row: 5, column: 7, cell: 31 },
  }),
  vatFile('2026-09-pdv.xlsx', 'xlsx', { sale: { number: '10-1-26', issued: civilDate(2026, 9, 30), amount: 6835.16 }, local: [[120, 30]], carriedForward: -3613.26 }),
  salaryFile('2026-06-salary.xlsx', 'xlsx', { title: 'Plaća 6/26 - datum isplate 12.7.2026', incomeTax: 81.7, net: 955, commuting: 45, stateTake: 554.2 }),
  salaryFile('2026-07-salary', 'google-sheet', { title: 'Plaća 7/26 - datum isplate 12.8.2026', ...AT_THE_FLOOR }),
  salaryFile('2026-08-salary.xlsx', 'xlsx', { title: 'Plaća 7/26 - datum isplate 12.9.2026', ...AT_THE_FLOOR }),
]

/** The fake workbook's id leads every file id, so a production bundle that holds these files fails its check. */
function vatFile(name: string, format: DriveWorkbook['format'], spec: FakeVatReturn): FakeFile {
  return { id: `${FAKE_SPREADSHEET_ID}/${name}`, name, format, version: '1', folder: 'vat-returns', tabs: vatReturnTabs(spec) }
}

function salaryFile(name: string, format: DriveWorkbook['format'], spec: FakeSalary): FakeFile {
  return { id: `${FAKE_SPREADSHEET_ID}/${name}`, name, format, version: '1', folder: 'payroll', tabs: salaryTabs(spec) }
}

export function fakeAccountantFolders(): AccountantFolders {
  const folderAt = (path: readonly string[]): FakeFile['folder'] | null =>
    path.join('/') === DEFAULT_VAT_RETURNS_FOLDER.join('/') ? 'vat-returns' : path.join('/') === DEFAULT_PAYROLL_FOLDER.join('/') ? 'payroll' : null
  return {
    async files(path) {
      const folder = folderAt(path)
      return folder === null
        ? { kind: 'refused', reason: `The fake Drive holds the accountant's files only in ${DEFAULT_VAT_RETURNS_FOLDER.join('/')} and ${DEFAULT_PAYROLL_FOLDER.join('/')}, not in ${path.join('/')}` }
        : { kind: 'listed', files: FAKE_FILES.filter((file) => file.folder === folder).map(({ id, name, format, version }) => ({ id, name, format, version })) }
    },

    async tabs(file) {
      const found = FAKE_FILES.find((candidate) => candidate.id === file.id)
      if (found === undefined) throw new Error(`The fake Drive holds no file ${file.name}.`)
      return found.tabs
    },
  }
}
