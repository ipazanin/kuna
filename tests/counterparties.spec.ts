import { describe, expect, it } from 'vitest'

import { counterpartyIdentity, counterpartyLabels } from '../src/features/workbook/domain/counterpartyIdentity'
import { topCounterparties } from '../src/features/spending/domain/topCounterparties'
import { euros, ledger, windowOf } from './fixtures/ledger'

describe('counterpartyIdentity', () => {
  it('goes by IBAN when the row has one, whatever the name says', () => {
    expect(counterpartyIdentity({ counterparty: 'RELATIVE, VL. MARKO EXAMPLE', counterpartyIban: 'XX00FAKE0001' }).key).toBe('iban:XX00FAKE0001')
  })

  it('falls back to the folded name before the description mark', () => {
    expect(counterpartyIdentity({ counterparty: 'Café Šime · lunch with a client', counterpartyIban: '' })).toEqual({
      key: 'name:CAFE SIME',
      foldedName: 'CAFE SIME',
    })
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
    { date: '2026-09-09', amount: -95.49, counterparty: 'MODEL API', category: 'zzz-test' },
    { date: '2026-09-10', amount: -30, counterparty: 'Model API', category: 'ai-services' },
  ])
  const window = windowOf('2026-07-03', '2026-10-01')
  const top = topCounterparties(rows, { preset: 'l3' }, window)

  it('ranks debits by counterparty, leaving out neutral and financing but not unclassified rows', () => {
    expect(top.map((payee) => [payee.label, payee.total.amount, payee.transactionCount])).toEqual([
      ['ALEX EXAMPLE', euros(1500), 1],
      ['ZUTA TISKARA', euros(300), 2],
      ['MODEL API', euros(125.49), 2],
    ])
  })

  it('labels a group by its alphabetically first spelling, so the label does not move as rows arrive', () => {
    expect(top.find((payee) => payee.key === 'iban:XX00FAKE0001')?.label).toBe('ZUTA TISKARA')
  })

  it('gives a value for every month of the period, for the sparkline', () => {
    expect(top.find((payee) => payee.key === 'iban:XX00FAKE0001')?.monthly).toEqual([
      { month: '2026-07', amount: euros(100) },
      { month: '2026-08', amount: euros(200) },
      { month: '2026-09', amount: 0 },
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

  it('keeps to the limit', () => {
    expect(topCounterparties(rows, { preset: 'l3' }, window, 2)).toHaveLength(2)
  })
})
