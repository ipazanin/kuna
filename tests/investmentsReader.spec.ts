import { describe, expect, it } from 'vitest'

import { investmentsReader } from '../src/apps/investments/assistant/investmentsReader'
import type { InvestmentsReading } from '../src/apps/investments/assistant/investmentsReader'
import { HOLDING_ROUTE } from '../src/apps/investments/holdings/presentation/holdingLinks'
import type { PortfolioSources } from '../src/apps/investments/holdings/domain/holding'
import { portfolioFigures } from '../src/apps/investments/holdings/domain/portfolioFigures'
import { incomeByYear } from '../src/apps/investments/income/domain/incomeHistory'
import { capitalGainsYear } from '../src/apps/investments/tax/domain/taxYear'
import * as investmentKinds from '../src/apps/investments/workbook/domain/investmentKinds'
import { MAIL_READER_RECORDS } from '../src/apps/investments/workbook/domain/investmentKinds'
import type { ReportFigure } from '../src/shared/app/assistantReader'
import { WORKED_PRICES, WORKED_RATES, workedPortfolio } from './fixtures/investments'
import { civil } from './fixtures/ledger'

const SOURCES: PortfolioSources = { book: workedPortfolio(), prices: WORKED_PRICES, rates: WORKED_RATES, today: civil('2026-10-29') }

function readingOf(taxShown: boolean, sources: PortfolioSources | null = SOURCES): InvestmentsReading {
  return { status: () => 'open', book: () => sources?.book ?? null, sources: () => sources, taxShown: () => taxShown }
}

function figure(figures: readonly ReportFigure[], label: string): ReportFigure | undefined {
  return figures.find((entry) => entry.label === label)
}

function centsOf(entry: ReportFigure | undefined): number | null {
  return entry !== undefined && 'cents' in entry ? entry.cents : null
}

describe('the Investments reader', () => {
  const reader = investmentsReader(readingOf(true))

  it('reads every kind but the mail reader, which holds a mailbox’s senders', () => {
    const kinds = Object.values(investmentKinds).map((kind) => kind.name)
    expect(reader.kinds.map((kind) => kind.name).sort()).toEqual(kinds.filter((name) => name !== MAIL_READER_RECORDS.name).sort())
  })

  it('hands every decimal over as text with its currency, so no row holds a number the chat cannot write', () => {
    const rows = reader.kinds.flatMap((kind) => kind.rows())
    expect(() => JSON.stringify(rows)).not.toThrow()
    const trade = reader.kinds.find((kind) => kind.name === 'trade')!.rows()[1]!
    const fields = Object.fromEntries(trade.fields.map((field) => [field.name, 'value' in field ? field.value : 'id' in field ? field.id : null]))
    expect(fields).toMatchObject({ quantity: '20', price: '50 USD', fees: '1 USD', rate: '1.05 USD per EUR' })
    expect(trade.fields.map((field) => field.name)).not.toContain('importKey')
  })

  it("links an instrument to its holding's page", () => {
    expect(reader.kinds.find((kind) => kind.name === 'instrument')!.page).toBe(HOLDING_ROUTE)
  })

  it('reports the portfolio and its holdings with the figures the Overview and Holdings screens show', () => {
    const screen = portfolioFigures(SOURCES)
    const portfolio = reader.reports.find((report) => report.id === 'portfolio')!.figures(null)
    expect(centsOf(figure(portfolio, 'value'))).toBe(screen.value)
    expect(centsOf(figure(portfolio, 'total gain'))).toBe(screen.totalGain)
    expect(centsOf(figure(portfolio, 'realised gain'))).toBe(screen.realised)
    const holdings = reader.reports.find((report) => report.id === 'holdings')!.figures(null)
    const etf = screen.holdings.find((holding) => holding.instrument.name === 'World ETF')!
    expect(centsOf(figure(holdings, 'World ETF: value'))).toBe(etf.valuation!.value)
    expect(centsOf(figure(holdings, 'World ETF: cost'))).toBe(etf.cost)
  })

  it('counts a past day from the records up to it, and gives nothing for a day after the figures', () => {
    const report = reader.reports.find((report) => report.id === 'portfolio')!
    expect(centsOf(figure(report.figures('2025-01-02'), 'put in, deposits less withdrawals'))).toBe(300000)
    expect(report.figures('2026-11-30')).toEqual([])
    expect(() => report.figures('soon')).toThrow(RangeError)
  })

  it("reports a year's income as the Income tab adds it up", () => {
    const income = reader.reports.find((report) => report.id === 'income')!.figures('2025-06')
    const year = incomeByYear(SOURCES.book, SOURCES.today).find((entry) => entry.year === 2025)!
    expect(centsOf(figure(income, 'all income: received'))).toBe(year.total.received)
    expect(reader.reports.find((report) => report.id === 'income')!.figures('2024-06')).toEqual([])
  })

  it('reports tax only once the owner confirms the file holds every buy, as the Tax screen waits for that', () => {
    const tax = reader.reports.find((report) => report.id === 'tax')!.figures('2026-02')
    expect(centsOf(figure(tax, 'gains on lots held under two years'))).toBe(capitalGainsYear(SOURCES.book, SOURCES.rates, 2026).taxableGains)
    const hidden = investmentsReader(readingOf(false)).reports.find((report) => report.id === 'tax')!
    expect(hidden.figures('2026-02')).toEqual([])
  })

  it('reads no rows and no figures while the file or its prices are not read yet', () => {
    const empty = investmentsReader(readingOf(true, null))
    expect(empty.kinds.flatMap((kind) => kind.rows())).toEqual([])
    expect(empty.reports.flatMap((report) => report.figures(null))).toEqual([])
  })
})
