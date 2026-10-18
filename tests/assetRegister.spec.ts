import { describe, expect, it } from 'vitest'

import type { Asset } from '../src/features/workbook/domain/assets'
import type { Category } from '../src/features/workbook/domain/workbook'
import { assetRegister } from '../src/packs/hr-doo/domain/assets/assetRegister'
import { PACK_CATEGORIES } from './fixtures/hrDooCategories'
import { civil, euros, ledger } from './fixtures/ledger'

const EQUIPMENT: Category = {
  slug: 'equipment',
  family: 'operating',
  bucket: 'operating',
  colour: '',
  roles: ['capital-purchase'],
  vat: 'deductible-25',
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
    sheetRow: 2,
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
})
