import type { CivilDate } from '../../../../../../shared/calendar/civilDate'
import type { Money } from '../../../../../../shared/money/money'
import type { RecordId } from '../../../../../../shared/storage/domain/recordId'

/** The parts of the accountant's year-end package a `year-end` row comes from. `konto` lines are free account numbers. */
export const YEAR_END_STATEMENTS = ['pl', 'balance', 'tax', 'distribution', 'grant', 'konto'] as const

export type YearEndStatement = (typeof YEAR_END_STATEMENTS)[number]

/** What the `amount` cell of a line holds. A rate is a percentage cell, such as 10%. */
export type YearEndFigureKind = 'money' | 'date' | 'rate' | 'count'

export type YearEndFigure =
  | { readonly kind: 'money'; readonly amount: Money }
  | { readonly kind: 'date'; readonly date: CivilDate }
  | { readonly kind: 'rate'; readonly basisPoints: number }
  | { readonly kind: 'count'; readonly count: number }

/** Which side of a check a line adds to: income less expenses is profit before tax, assets are equity plus liabilities. */
type TieSide = 'income' | 'expense' | 'asset' | 'equity-or-liability'

export interface YearEndLineDefinition {
  readonly statement: Exclude<YearEndStatement, 'konto'>
  /** The stable id the app compares by. */
  readonly line: string
  readonly kind: YearEndFigureKind
  /** How the package prints it, or which form line it is. */
  readonly hint: string
  readonly tie?: TieSide
}

function lines(
  statement: YearEndLineDefinition['statement'],
  definitions: readonly (readonly [line: string, hint: string, kind?: YearEndFigureKind, tie?: TieSide])[],
): YearEndLineDefinition[] {
  return definitions.map(([line, hint, kind = 'money', tie]) => ({ statement, line, kind, hint, ...(tie === undefined ? {} : { tie }) }))
}

/** Every line id a `year-end` row may use outside `konto`, in the order the package prints them. */
export const YEAR_END_LINES: readonly YearEndLineDefinition[] = [
  ...lines('pl', [
    ['sales', 'Prihodi od prodaje', 'money', 'income'],
    ['own-use', 'Prihodi na temelju upotrebe vlastitih proizvoda, robe i usluga', 'money', 'income'],
    ['other-operating-income', 'Ostali poslovni prihodi', 'money', 'income'],
    ['financial-income', 'Financijski prihodi', 'money', 'income'],
    ['material-costs', 'Materijalni troškovi', 'money', 'expense'],
    ['personnel-costs', 'Troškovi osoblja', 'money', 'expense'],
    ['depreciation', 'Amortizacija', 'money', 'expense'],
    ['other-costs', 'Ostali troškovi', 'money', 'expense'],
    ['impairment-provisions-other', 'Vrijednosna usklađenja, rezerviranja, ostali poslovni rashodi', 'money', 'expense'],
    ['financial-expenses', 'Financijski rashodi', 'money', 'expense'],
    ['profit-before-tax', 'Dobit prije oporezivanja'],
    ['corporate-income-tax', 'Porez na dobit'],
    ['profit-after-tax', 'Dobit razdoblja'],
  ]),
  ...lines('balance', [
    ['intangible-assets', 'Dugotrajna nematerijalna imovina', 'money', 'asset'],
    ['tangible-assets', 'Dugotrajna materijalna imovina', 'money', 'asset'],
    ['financial-assets', 'Dugotrajna financijska imovina', 'money', 'asset'],
    ['inventories', 'Zalihe', 'money', 'asset'],
    ['receivables-trade', 'Potraživanja od kupaca', 'money', 'asset'],
    ['receivables-members-employees', 'Potraživanja od zaposlenika i članova poduzetnika', 'money', 'asset'],
    ['receivables-state', 'Potraživanja od države i drugih institucija', 'money', 'asset'],
    ['receivables-other', 'Ostala potraživanja', 'money', 'asset'],
    ['cash', 'Novac u banci i blagajni', 'money', 'asset'],
    ['prepaid-accrued-income', 'Plaćeni troškovi budućeg razdoblja i obračunati prihodi', 'money', 'asset'],
    ['total-assets', 'Ukupno aktiva'],
    ['share-capital', 'Temeljni (upisani) kapital', 'money', 'equity-or-liability'],
    ['reserves', 'Rezerve', 'money', 'equity-or-liability'],
    ['retained-earnings', 'Zadržana dobit ili preneseni gubitak', 'money', 'equity-or-liability'],
    ['profit-of-year', 'Dobit ili gubitak poslovne godine', 'money', 'equity-or-liability'],
    ['provisions', 'Rezerviranja', 'money', 'equity-or-liability'],
    ['long-term-liabilities', 'Dugoročne obveze', 'money', 'equity-or-liability'],
    ['payables-suppliers', 'Obveze prema dobavljačima', 'money', 'equity-or-liability'],
    ['payables-employees', 'Obveze prema zaposlenicima', 'money', 'equity-or-liability'],
    ['payables-taxes', 'Obveze za poreze, doprinose i slična davanja', 'money', 'equity-or-liability'],
    ['payables-loans', 'Obveze za zajmove', 'money', 'equity-or-liability'],
    ['accruals-deferred-income', 'Odgođeno plaćanje troškova i prihod budućeg razdoblja', 'money', 'equity-or-liability'],
  ]),
  ...lines('tax', [
    ['revenue', 'PD line 1'],
    ['expenses', 'PD line 2'],
    ['increases', 'PD line 26'],
    ['decreases', 'PD line 35'],
    ['tax-base', 'PD line 38'],
    ['rate', 'PD line 43, as a percentage', 'rate'],
    ['liability', 'PD line 53'],
    ['advances-paid', 'PD line 56'],
    ['balance-due', 'PD line 57'],
    ['refund', 'PD line 58'],
    ['monthly-advance', 'PD line 59'],
    ['months-of-operation', 'Months the tax period covers', 'count'],
    ['filed-on', 'The day the return was filed', 'date'],
    ['paid-on', 'The day the balance was paid', 'date'],
  ]),
  ...lines('distribution', [
    ['retained', 'Profit kept in the company'],
    ['dividend', 'Profit paid out'],
    ['reserves', 'Profit put to reserves'],
    ['decided-on', 'The day of the decision', 'date'],
  ]),
  ...lines('grant', [
    ['released-in-year', 'Grant income recognised in the year'],
    ['deferred-at-year-end', 'Grant still deferred at the year end'],
  ]),
]

/** One row of the `year-end` tab: a figure from the accountant's package, entered once a year. */
export interface YearEndLine {
  readonly year: number
  readonly statement: YearEndStatement
  /** A line id from `YEAR_END_LINES`, or the account number on a `konto` row. */
  readonly line: string
  /** As the package prints it. */
  readonly label: string
  readonly figure: YearEndFigure
  /** On a `konto` row, the app categories the account corresponds to. Empty on every other row. */
  readonly categories: readonly string[]
  readonly aop: string
  /** The file the figure was read from. */
  readonly source: string
  readonly note: string
  /** Held by no other row of its tab. */
  readonly id: RecordId
}

export function yearEndLineDefinition(statement: YearEndStatement, line: string): YearEndLineDefinition | null {
  return YEAR_END_LINES.find((definition) => definition.statement === statement && definition.line === line) ?? null
}
