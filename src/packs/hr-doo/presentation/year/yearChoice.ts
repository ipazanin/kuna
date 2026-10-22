/** The tabs of the Year page. */
export type YearTab = 'accountant' | 'statements' | 'forecast' | 'plan' | 'pay' | 'taxes' | 'assets'

/**
 * How the page sees a year. A closed year has the accountant's lines to set our books against. A
 * year that has ended without them yet is forecast from its complete months, and its Statements tab
 * takes the first lines. An open year is the current one or the next, still to plan.
 */
export type YearView = 'closed' | 'ended' | 'open'

const TABS: Readonly<Record<YearView, readonly YearTab[]>> = {
  closed: ['accountant', 'statements', 'taxes', 'assets'],
  ended: ['forecast', 'statements', 'taxes', 'assets'],
  open: ['forecast', 'plan', 'pay', 'taxes', 'assets'],
}

export interface YearOption {
  readonly year: number
  readonly view: YearView
  readonly tabs: readonly YearTab[]
}

/**
 * The years the page offers, oldest first: every year with the accountant's lines, the year just
 * ended while the ledger reaches into it, the current year and the next one. The current year is
 * the year of the newest booking.
 */
export function yearOptions(accountantYears: readonly number[], firstLedgerYear: number, currentYear: number): YearOption[] {
  const years = new Set([...accountantYears, ...(firstLedgerYear < currentYear ? [currentYear - 1] : []), currentYear, currentYear + 1])
  return [...years]
    .sort((earlier, later) => earlier - later)
    .map((year) => {
      const view: YearView = accountantYears.includes(year) ? 'closed' : year < currentYear ? 'ended' : 'open'
      return { year, view, tabs: TABS[view] }
    })
}

/**
 * The year a link opens. Without a year it is the current one. A tab the year lacks opens the
 * latest year that has it, so a link to the accountant's tab alone opens the last closed year.
 */
export function shownYear(options: readonly YearOption[], asked: number | null, tab: string | null, currentYear: number): number {
  const askedOption = options.find((option) => option.year === asked) ?? options.find((option) => option.year === currentYear)
  if (askedOption === undefined || tab === null || askedOption.tabs.some((candidate) => candidate === tab)) {
    return askedOption?.year ?? currentYear
  }
  const holding = options.filter((option) => option.tabs.some((candidate) => candidate === tab))
  return holding.at(-1)?.year ?? askedOption.year
}
