// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import { closedYearView } from '../src/apps/company/packs/hr-doo/presentation/yearEnd/closedYearView'
import { exampleStudio, yearEndLine } from './fixtures/exampleStudio'
import { euros } from './fixtures/ledger'

function balanceSheetCard(filedShareCapital: number) {
  const workbook = exampleStudio({ yearEndLines: [yearEndLine(2025, 'balance', 'share-capital', filedShareCapital)] })
  return closedYearView(workbook, 2025, () => null, {}).tables.find((table) => table.key === 'balance')!
}

describe('closedYearView', () => {
  it('shows the unexplained difference under the share capital on the Year balance sheet card', () => {
    // The studio's other lines leave 2,500.00, so a filed 2,620.00 leaves 120.00 they do not explain.
    const gapped = balanceSheetCard(2620).rows
    const capital = gapped.findIndex((row) => row.key === 'balance-share-capital')
    expect(gapped[capital + 1]).toMatchObject({
      key: 'balance-unexplained',
      label: 'Unexplained difference',
      accountant: { cents: 0 },
      ours: { cents: euros(-120) },
      residual: euros(-120),
      status: 'open',
    })
    expect(balanceSheetCard(2500).rows.some((row) => row.key === 'balance-unexplained')).toBe(false)
  })
})
