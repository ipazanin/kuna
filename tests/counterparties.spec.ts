import { describe, expect, it } from 'vitest'

import { counterpartyIdentity, counterpartyLabels } from '../src/features/workbook/domain/counterpartyIdentity'
import { topCounterparties } from '../src/features/spending/domain/topCounterparties'
import { PACK_CATEGORIES } from './fixtures/hrDooCategories'
import { euros, ledger, windowOf } from './fixtures/ledger'
import { withSplit } from './fixtures/splits'

describe('counterpartyIdentity', () => {
  it('goes by IBAN when the row has one, whatever the name says', () => {
    expect(counterpartyIdentity({ counterparty: 'RELATIVE, VL. MARKO EXAMPLE', counterpartyIban: 'XX00FAKE0001' }).key).toBe('iban:XX00FAKE0001')
  })

  it('falls back to the folded name before the description mark', () => {
    expect(counterpartyIdentity({ counterparty: 'Café Šime · lunch with a client', counterpartyIban: '' })).toEqual({
      key: 'name:CAFE SIME',
      foldedName: 'CAFE SIME',
      writtenName: 'Café Šime',
      iban: '',
    })
  })

  it('goes by the merchant after the description mark when the IBAN is a card settlement account', () => {
    const settlement = new Set(['XX00FAKE0003'])
    const cardPurchase = { counterparty: 'Example Bank d.d. · TRAM TICKETS,EXAMPLE.ORG', counterpartyIban: 'XX00 FAKE 0003' }

    expect(counterpartyIdentity(cardPurchase, settlement)).toEqual({
      key: 'name:TRAM TICKETS,EXAMPLE.ORG',
      foldedName: 'TRAM TICKETS,EXAMPLE.ORG',
      writtenName: 'TRAM TICKETS,EXAMPLE.ORG',
      iban: '',
    })
    expect(counterpartyIdentity(cardPurchase).key).toBe('iban:XX00 FAKE 0003')
  })
})

describe('counterpartyLabels', () => {
  it('labels each key with its alphabetically first folded spelling', () => {
    const labels = counterpartyLabels([
      { counterparty: 'Žuta tiskara d.o.o.', counterpartyIban: 'XX00FAKE0001' },
      { counterparty: 'ZUTA TISKARA', counterpartyIban: 'XX00FAKE0001' },
      { counterparty: 'Bistro Harbour · lunch', counterpartyIban: '' },
    ])

    expect([...labels]).toEqual([
      ['iban:XX00FAKE0001', 'ZUTA TISKARA'],
      ['name:BISTRO HARBOUR', 'BISTRO HARBOUR'],
    ])
  })
})

describe('topCounterparties', () => {
  const rows = ledger([
    { date: '2026-07-03', amount: -100, counterparty: 'Žuta Tiskara d.o.o.', iban: 'XX00FAKE0001', category: 'equipment' },
    { date: '2026-08-03', amount: -200, counterparty: 'ZUTA TISKARA', iban: 'XX00FAKE0001', category: 'equipment' },
    { date: '2026-08-05', amount: -1500, counterparty: 'Alex Example', iban: 'XX00FAKE0020', category: 'salary-net' },
    { date: '2026-08-06', amount: -800, counterparty: 'Alex Example', iban: 'XX00FAKE0020', category: 'reimbursement-to-owner' },
    { date: '2026-08-07', amount: 500, counterparty: 'Alex Example', iban: 'XX00FAKE0020', category: 'owner-loan-repaid' },
    { date: '2026-08-08', amount: -5000, counterparty: 'Own savings', iban: 'XX00FAKE0099', category: 'internal-transfer' },
    { date: '2026-09-09', amount: -87.36, counterparty: 'MODEL API', category: 'zzz-test' },
    { date: '2026-09-10', amount: -30, counterparty: 'Model API', category: 'ai-services' },
  ])
  const window = windowOf('2026-07-03', '2026-10-01')
  const top = topCounterparties(rows, { preset: 'l3' }, window)

  it('ranks debits by counterparty, leaving out neutral and financing but not unclassified rows', () => {
    expect(top.map((payee) => [payee.label, payee.total.amount, payee.transactionCount])).toEqual([
      ['Alex Example', euros(1500), 1],
      ['ZUTA TISKARA', euros(300), 2],
      ['Model API', euros(117.36), 2],
    ])
  })

  it('labels a group by the spelling its rows use most, as written, and of equals the alphabetically first', () => {
    expect(top.find((payee) => payee.key === 'iban:XX00FAKE0001')?.label).toBe('ZUTA TISKARA')
    const often = ledger([
      { date: '2026-07-03', amount: -10, counterparty: 'Pixel Studio d.o.o.', iban: 'XX00FAKE0002' },
      { date: '2026-08-03', amount: -10, counterparty: 'Pixel Studio', iban: 'XX00FAKE0002' },
      { date: '2026-09-03', amount: -10, counterparty: '  Pixel   Studio · design work', iban: 'XX00FAKE0002' },
    ])
    expect(topCounterparties(often, { preset: 'l3' }, window)[0]?.label).toBe('Pixel Studio')
  })

  it('draws the 12 months up to the end of the period, whatever its length', () => {
    const strip = top.find((payee) => payee.key === 'iban:XX00FAKE0001')?.strip ?? []
    expect(strip).toHaveLength(12)
    expect(strip.slice(-3)).toEqual([
      { month: '2026-07', amount: euros(100) },
      { month: '2026-08', amount: euros(200) },
      { month: '2026-09', amount: 0 },
    ])
    expect(strip[0]?.month).toBe('2025-10')
  })

  it('tags a payee paid in most months as monthly and one paid once as one-off', () => {
    const rows = ledger([
      { date: '2026-01-05', amount: -50, counterparty: 'Rent', iban: 'XX00FAKE0030' },
      { date: '2026-02-05', amount: -50, counterparty: 'Rent', iban: 'XX00FAKE0030' },
      { date: '2026-03-05', amount: -50, counterparty: 'Rent', iban: 'XX00FAKE0030' },
      { date: '2026-04-05', amount: -50, counterparty: 'Rent', iban: 'XX00FAKE0030' },
      { date: '2026-04-09', amount: -900, counterparty: 'Laptop Store', iban: 'XX00FAKE0031' },
      { date: '2026-04-10', amount: -20, counterparty: 'Cafe', iban: 'XX00FAKE0032' },
      { date: '2026-02-10', amount: -20, counterparty: 'Cafe', iban: 'XX00FAKE0032' },
      { date: '2026-05-01', amount: 1, counterparty: 'Bank' },
    ])
    // The ledger covers January to April in full: four strip months, paid in all four by Rent.
    const rhythms = topCounterparties(rows, { preset: 'all' }, windowOf('2026-01-01', '2026-05-01')).map((payee) => [payee.label, payee.rhythm])

    expect(rhythms).toEqual([
      ['Laptop Store', 'one-off'],
      ['Rent', 'monthly'],
      ['Cafe', null],
    ])
  })

  it('counts a split row as one payment, still one-off, and once under each category its parts take', () => {
    const rows = withSplit(
      ledger([{ date: '2026-04-09', amount: -120, counterparty: 'Office Shop', iban: 'XX00FAKE0033', category: 'office-supplies' }]),
      { date: '2026-04-09', amount: -120 },
      [
        [-80, 'office-supplies'],
        [-30, 'travel'],
        [-10, 'office-supplies'],
      ],
      PACK_CATEGORIES,
    )
    const [shop] = topCounterparties(rows, { preset: 'all' }, windowOf('2026-01-01', '2026-05-01'))

    expect([shop?.transactionCount, shop?.rhythm]).toEqual([1, 'one-off'])
    expect(shop?.categories.map((part) => [part.category, part.amount.amount, part.transactionCount])).toEqual([
      ['office-supplies', euros(90), 1],
      ['travel', euros(30), 1],
    ])
  })

  it('drills to the same debits it ranked', () => {
    expect(top[0].total.drill.filters).toEqual({
      period: { preset: 'l3' },
      counterparties: ['iban:XX00FAKE0020'],
      buckets: ['income', 'operating', 'taxes', 'owner-pay', 'unclassified'],
      amount: { min: null, max: -1 },
    })
  })

  it('splits each payee by category, largest first, each part drilling to its own debits', () => {
    const owner = ledger([
      { date: '2026-08-05', amount: -1500, counterparty: 'Alex Example', iban: 'XX00FAKE0020', category: 'salary-net' },
      { date: '2026-08-06', amount: -700, counterparty: 'Alex Example', iban: 'XX00FAKE0020', category: 'owner-loan-out' },
      { date: '2026-09-05', amount: -1500, counterparty: 'Alex Example', iban: 'XX00FAKE0020', category: 'salary-net' },
      { date: '2026-09-07', amount: -40, counterparty: 'Alex Example', iban: 'XX00FAKE0020', category: 'zzz-test' },
    ])
    const [alex] = topCounterparties(owner, { preset: 'l3' }, window)

    expect(alex?.categories.map((part) => [part.category, part.bucket, part.amount.amount, part.transactionCount])).toEqual([
      ['salary-net', 'owner-pay', euros(3000), 2],
      ['owner-loan-out', 'owner-pay', euros(700), 1],
      ['zzz-test', 'unclassified', euros(40), 1],
    ])
    expect(alex?.categories[1]?.amount.drill.filters).toEqual({
      period: { preset: 'l3' },
      counterparties: ['iban:XX00FAKE0020'],
      categories: ['owner-loan-out'],
      amount: { min: null, max: -1 },
    })
  })

  it('keeps to the limit', () => {
    expect(topCounterparties(rows, { preset: 'l3' }, window, 2)).toHaveLength(2)
  })
})
