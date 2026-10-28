import { describe, expect, it } from 'vitest'

import type { Asset } from '../src/apps/company/packs/hr-doo/domain/assets/assets'
import type { Category } from '../src/apps/company/workbook/domain/workbook'
import { assetRegister } from '../src/apps/company/packs/hr-doo/domain/assets/assetRegister'
import { hrDooWorkbook } from '../src/apps/company/packs/hr-doo/domain/hrDooPart'
import { fakeWorkbookSnapshot } from './fixtures/fakeBooks'
import { readSnapshot } from '../src/apps/company/workbook/infrastructure/spreadsheetTab'
import { sheetRowsFromValues } from '../src/apps/company/workbook/infrastructure/workbookSnapshot'
import type { CellValue, WorkbookSnapshot } from '../src/apps/company/workbook/infrastructure/workbookSnapshot'
import { serialFromCivilDate } from '../src/shared/calendar/civilDate'
import { PACK_CATEGORIES } from './fixtures/hrDooCategories'
import { civil, euros, ledger } from './fixtures/ledger'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { ASSET_RECORDS } from '../src/apps/company/packs/hr-doo/domain/hrDooKinds'
import { BUCKET_COLOUR } from '../src/apps/company/workbook/domain/categoryColour'

const EQUIPMENT: Category = {
  slug: 'equipment',
  family: 'operating',
  bucket: 'operating',
  colour: BUCKET_COLOUR,
  roles: ['capital-purchase'],
  vat: 'deductible-25',
  ownerShare: null,
}

const CATEGORIES = [...PACK_CATEGORIES, EQUIPMENT]

function asset(name: string, cost: number, bought: string, ledgerReference = ''): Asset {
  return {
    name,
    bought: civil(bought),
    inUse: civil(bought),
    costNet: euros(cost),
    group: 'computers',
    doubledRate: false,
    disposed: null,
    fundedBy: '',
    ledgerReference,
    note: '',
    id: recordIdOf(ASSET_RECORDS, 'row-2'),
  }
}

describe('assetRegister', () => {
  it('matches a ledger reference against the row reference, then inside the description', () => {
    // The fixture gives the second row the reference REF-2.
    const transactions = ledger([
      { date: '2025-07-01', amount: 20000, category: 'revenue' },
      { date: '2025-07-14', amount: -1250, category: 'equipment' },
      { date: '2025-07-15', amount: -1500, category: 'office-supplies', description: 'Order  4410-25 web shop' },
    ])
    const register = assetRegister(
      [asset('Example laptop', 1000, '2025-07-14', 'REF-2'), asset('Example monitor', 1200, '2025-07-20', 'order 4410-25')],
      transactions,
      CATEGORIES,
    )

    expect(register.assets.map((entry) => [entry.asset.name, entry.payment?.matchedBy, entry.payment?.row.amount])).toEqual([
      ['Example laptop', 'reference', euros(-1250)],
      ['Example monitor', 'description', euros(-1500)],
    ])
    expect(register.assets[0]?.payment?.drill.filters.amount).toEqual({ min: euros(-1250), max: euros(-1250) })
  })

  it('matches an asset without a reference by its cost with or without VAT, nearest the day it was bought', () => {
    // 800.00 net is 1,000.00 with VAT at the standard 25%.
    const transactions = ledger([
      { date: '2025-02-01', amount: -1000, category: 'equipment', description: 'Early order' },
      { date: '2025-05-02', amount: -1000, category: 'equipment', description: 'Laptop order' },
      { date: '2025-05-03', amount: -700, category: 'equipment', description: 'Foreign tablet' },
    ])
    const register = assetRegister([asset('Example laptop', 800, '2025-05-06'), asset('Example tablet', 700, '2025-05-03')], transactions, CATEGORIES)

    expect(register.assets.map((entry) => [entry.payment?.matchedBy, entry.payment?.row.description])).toEqual([
      ['date-and-amount', 'Laptop order'],
      ['date-and-amount', 'Foreign tablet'],
    ])
    expect(register.unmatchedPurchases.map((purchase) => purchase.row.description)).toEqual(['Early order'])
  })

  it('keeps a row claimed by reference out of the amount match', () => {
    const transactions = ledger([{ date: '2025-05-02', amount: -1000, category: 'equipment', description: 'Order 77' }])
    const register = assetRegister([asset('Example laptop', 800, '2025-05-02'), asset('Example dock', 800, '2025-05-02', 'Order 77')], transactions, CATEGORIES)

    expect(register.assets[0]?.payment).toBeNull()
    expect(register.assets[1]?.payment?.matchedBy).toBe('description')
  })

  it('reports assets with no payment and capital purchases with no asset, and ignores credits', () => {
    const transactions = ledger([
      { date: '2025-04-01', amount: -120, category: 'equipment', description: 'Headphones' },
      { date: '2025-04-03', amount: 120, category: 'equipment', description: 'Headphones returned' },
      { date: '2025-04-05', amount: -60, category: 'office-supplies', description: 'Paper' },
    ])
    const register = assetRegister([asset('Example phone', 900, '2025-04-02', 'Order 999')], transactions, CATEGORIES)

    expect(register.assets[0]?.payment).toBeNull()
    expect(register.unmatchedPurchases.map((purchase) => purchase.row.description)).toEqual(['Headphones'])
    expect(register.capitalPurchaseCategories).toEqual(['equipment'])
  })

  it('names no capital-purchase category when no category carries the role', () => {
    const transactions = ledger([{ date: '2025-05-02', amount: -1000, category: 'equipment' }])
    const register = assetRegister([asset('Example laptop', 800, '2025-05-02')], transactions, PACK_CATEGORIES)

    expect(register.capitalPurchaseCategories).toEqual([])
    expect(register.assets[0]?.payment).toBeNull()
    expect(register.unmatchedPurchases).toEqual([])
  })

  it('reports a payment found by reference that the claiming assets do not add up to, with or without VAT', () => {
    const transactions = ledger([
      { date: '2025-07-22', amount: -1100, category: 'equipment', description: 'Invoice 55/1 phone and mouse' },
      { date: '2025-07-23', amount: -900, category: 'equipment', description: 'Invoice 56/1 monitor' },
    ])
    // The phone and the mouse cost 880.00 together, which is 1,100.00 with VAT. The monitor's 760.00 is neither 900.00 nor 950.00.
    const register = assetRegister(
      [
        asset('Example phone', 800, '2025-07-22', 'Invoice 55/1'),
        asset('Example mouse', 80, '2025-07-22', 'Invoice 55/1'),
        asset('Example monitor', 760, '2025-07-23', 'Invoice 56/1'),
      ],
      transactions,
      CATEGORIES,
    )

    expect(register.mismatchedPayments.map((payment) => [payment.row.description, payment.assets.map((claiming) => claiming.name), payment.costNet])).toEqual([
      ['Invoice 56/1 monitor', ['Example monitor'], euros(760)],
    ])
    expect(register.mismatchedPayments[0]?.drill.filters.amount).toEqual({ min: euros(-900), max: euros(-900) })
  })

  it('leaves a row dated before the ruleset knows a VAT rate unclaimed, and names it on the asset that would claim it', () => {
    const transactions = ledger([
      { date: '2024-05-24', amount: -250, category: 'equipment', description: 'Order 2024-77 dock' },
      { date: '2024-06-03', amount: -375, category: 'equipment', description: 'Monitor order' },
      { date: '2025-06-03', amount: -1250, category: 'equipment', description: 'Laptop order' },
    ])
    const register = assetRegister(
      [asset('Example dock', 200, '2024-05-24', 'Order 2024-77'), asset('Example monitor', 300, '2024-06-03'), asset('Example laptop', 1000, '2025-06-03')],
      transactions,
      CATEGORIES,
    )

    expect(register.assets.map((entry) => entry.payment?.row.description ?? null)).toEqual([null, null, 'Laptop order'])
    expect(register.uncheckedClaims.map((claim) => [claim.asset.name, claim.row.date, claim.matchedBy])).toEqual([
      ['Example dock', '2024-05-24', 'description'],
      ['Example monitor', '2024-06-03', 'date-and-amount'],
    ])
    expect(register.unmatchedPurchases.map((purchase) => purchase.row.description)).toEqual(['Order 2024-77 dock', 'Monitor order'])
    expect(register.mismatchedPayments).toEqual([])
  })
})

describe('a workbook with a capital purchase dated before the ruleset', () => {
  /** The fake workbook with an asset whose ledger reference finds a bank row of 2024. */
  function withEarlyPurchase(): WorkbookSnapshot {
    const snapshot = fakeWorkbookSnapshot('2026-10-16T08:00:00.000Z')
    const day = serialFromCivilDate(civil('2024-05-24'))
    const ledgerRow: CellValue[] = [day, 'legacy', '2024-05-24-statement-000', 'Dock Shop', '', 'Card purchase, dock', -250, 0, 'equipment', 'human', 'FAKE-REF-EARLY']
    const assetRow: CellValue[] = ['Example dock', day, '', 200, 'equipment', '', '', '', 'Card purchase, dock', '', '00000000-0000-4000-8000-0000000000aa']
    const rowsAfter = (rows: WorkbookSnapshot['ledger'], added: CellValue[], header: readonly string[]) => [
      ...rows,
      ...sheetRowsFromValues([[...header], added]).map((row) => ({ ...row, sheetRow: rows.length + 2 })),
    ]
    return {
      ...snapshot,
      ledger: rowsAfter(snapshot.ledger, ledgerRow, ['date', 'account', 'statement', 'counterparty', 'counterparty_iban', 'description', 'amount', 'balance', 'category', 'flagged_by', 'reference']),
      assets: rowsAfter(snapshot.assets, assetRow, ['asset', 'bought', 'in_use', 'cost_net', 'group', 'doubled', 'disposed', 'funded_by', 'ledger_reference', 'note', 'id']),
    }
  }

  it('reads, with a problem on the asset that names the day and the missing VAT rate', () => {
    const workbook = hrDooWorkbook(readSnapshot(withEarlyPurchase()).workbook)

    expect(workbook.assets.map((asset) => asset.name)).toContain('Example dock')
    expect(workbook.problems.filter((problem) => problem.tab === 'assets').map((problem) => [problem.label, problem.reason])).toEqual([
      [
        'Example dock',
        'its ledger_reference finds the bank row of 2024-05-24, but the app has no standard VAT rate for that day to check the amount against, so the row is left unclaimed',
      ],
    ])
  })
})
