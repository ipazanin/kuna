import { describe, expect, it } from 'vitest'

import { sourceHandover as companyHandover } from '../src/apps/company/settings/domain/sourceHandover'
import { handoverWords as companyWords } from '../src/apps/company/settings/presentation/sourceHandoverWords'
import { sourceHandover as investmentHandover, landingRecords } from '../src/apps/investments/imports/domain/accountIntake'
import { handoverWords as investmentWords } from '../src/apps/investments/settings/presentation/sourceHandoverWords'
import { BY_HAND_SOURCES } from '../src/apps/investments/workbook/domain/investmentAccount'
import type { InvestmentPeriod } from '../src/apps/investments/workbook/domain/investmentAccount'
import { listedRows } from '../src/shared/ui/sourceHandover'
import { civil, ledger } from './fixtures/ledger'
import { BROKER, WORLD_ETF, account, book, cashMovement, trade, unitTransfer } from './fixtures/investments'

const MAIL_FROM_2026: readonly InvestmentPeriod[] = [
  { source: 'by-hand', from: null },
  { source: 'mail', from: civil('2026-01-01') },
]
const PENSION = account('pension', 'Pension')

describe("the warning of what giving an account's days to another source takes out", () => {
  it('keeps six rows and counts the rest in one line', () => {
    const lines = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']

    expect(listedRows(lines, (count) => `And ${count} more.`)).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'And 2 more.'])
    expect(listedRows(lines.slice(0, 6), (count) => `And ${count} more.`)).toEqual(lines.slice(0, 6))
  })

  it("lists an Investments account's records that go by day, kind and euros, and names the account a transfer that goes also leaves", () => {
    const held = book({
      accounts: [BROKER, PENSION],
      instruments: [WORLD_ETF],
      trades: [trade('buy', BROKER, WORLD_ETF, '2025-12-15', '1', '100', null), trade('buy', BROKER, WORLD_ETF, '2026-02-03', '2', '50', null)],
      cashMovements: [cashMovement('deposit', BROKER, '2026-01-10', '500')],
      transfers: [unitTransfer(BROKER, PENSION, '2026-03-04', WORLD_ETF, '1')],
    })
    const handover = investmentHandover(BROKER.id, BY_HAND_SOURCES, MAIL_FROM_2026, landingRecords(held))!

    const shown = investmentWords(handover, BROKER.id, held)!

    expect(shown.title).toBe('Saving takes out 3 rows')
    expect(shown.days).toEqual(['From 1 Jan 2026 on: “By hand” gives way to “IBKR report by mail”.'])
    expect(shown.rows).toHaveLength(3)
    expect(shown.rows[0]).toMatch(/^10 Jan 2026, /)
    expect(shown.rows[1]).toMatch(/^3 Feb 2026, .*World ETF/)
    expect(shown.rows[2]).toMatch(/^4 Mar 2026, .*Pension/)
    expect(shown.notes[0]).toBe('1 of them is a transfer, which also goes from Pension.')
  })

  it('marks each Company row that goes and pays an invoice, and counts them in a note', () => {
    const rows = ledger([
      { date: '2026-09-30', amount: 100, counterparty: 'Before' },
      { date: '2026-10-02', amount: 1200, counterparty: 'Example Client' },
      { date: '2026-10-05', amount: -40, counterparty: 'Example Shop' },
    ])
    const main = { slug: 'main', sources: [{ source: 'mail' as const, from: civil('2026-09-01') }] }
    const handover = companyHandover(
      main,
      [
        { source: 'mail', from: civil('2026-09-01') },
        { source: 'by-hand', from: civil('2026-10-01') },
      ],
      rows,
    )!

    const shown = companyWords(handover, (row) => row.counterparty === 'Example Client')!

    expect(shown.days).toEqual(["From 1 Oct 2026 on: “Bank's statements” gives way to “By hand”."])
    expect(shown.rows).toEqual([expect.stringMatching(/^2 Oct 2026, Example Client, .*, pays an invoice$/), expect.stringMatching(/^5 Oct 2026, Example Shop, /)])
    expect(shown.notes[0]).toBe('1 of them pays an invoice, which shows unpaid until the new row pays it.')
  })
})
