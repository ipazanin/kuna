import { describe, expect, it } from 'vitest'

import type { DocumentTab } from '../src/packs/hr-doo/domain/accountant/accountantDocument'
import { readVatReturn } from '../src/packs/hr-doo/domain/accountant/vatReturnReading'
import type { VatReturnSpec } from './fixtures/accountantWorkbooks'
import { month, vatReturnTabs, withCell } from './fixtures/accountantWorkbooks'
import { civil, euros } from './fixtures/ledger'

const SALE = { number: '3-2-26', issued: '2026-03-31', amount: 4000 }

function read(tabs: readonly DocumentTab[]) {
  return readVatReturn(month('2026-03'), tabs)
}

function refusalOf(tabs: readonly DocumentTab[]) {
  const reading = read(tabs)
  if (!('refusal' in reading)) throw new Error('the return was read')
  return reading.refusal
}

function returnOf(spec: VatReturnSpec) {
  const reading = read(vatReturnTabs(spec))
  if ('refusal' in reading) throw new Error(`refused: ${reading.refusal.reason}`)
  return reading.document
}

describe('readVatReturn', () => {
  it('reads the 10-row shape with sales outside the EU and no local purchase', () => {
    const tabs = vatReturnTabs({ sales: [SALE], local: [], broughtForward: -150 })
    expect(tabs[0]!.grid).toHaveLength(10)
    expect(returnOf({ sales: [SALE], local: [], broughtForward: -150 })).toEqual({
      period: month('2026-03'),
      salesOutsideEu: [{ invoiceNumber: '3-2-26', issued: civil('2026-03-31'), amount: euros(4000) }],
      localPurchases: { base: euros(0), vat: euros(0) },
      euServices: { base: euros(0), vat: euros(0) },
      thirdCountryServices: { base: euros(0), vat: euros(0) },
      outputVat: euros(0),
      inputVat: euros(0),
      difference: euros(0),
      broughtForward: euros(-150),
      carriedForward: euros(-150),
    })
  })

  it('reads the 12-row shape with EU services on both sides and line numbers as numbers', () => {
    const spec: VatReturnSpec = { sales: [SALE], local: [{ base: 80, vat: 20 }, { base: 40.4, vat: 10.1 }], eu: [{ base: 16, vat: 4 }], broughtForward: -150, lineNumbers: 'number' }
    expect(vatReturnTabs(spec)[0]!.grid).toHaveLength(12)
    const vatReturn = returnOf(spec)
    expect(vatReturn.localPurchases).toEqual({ base: euros(120.4), vat: euros(30.1) })
    expect(vatReturn.euServices).toEqual({ base: euros(16), vat: euros(4) })
    // Output VAT is the reverse charge alone. Input adds it to the local 30.10, so the difference is -30.10.
    expect([vatReturn.outputVat, vatReturn.inputVat, vatReturn.difference, vatReturn.carriedForward]).toEqual([euros(4), euros(34.1), euros(-30.1), euros(-180.1)])
  })

  it('reads the 14-row shape with third-country services too and line numbers as text', () => {
    const spec: VatReturnSpec = { sales: [SALE], local: [{ base: 80, vat: 20 }], eu: [{ base: 16, vat: 4 }], thirdCountry: [{ base: 8, vat: 2 }], broughtForward: -150, lineNumbers: 'text' }
    expect(vatReturnTabs(spec)[0]!.grid).toHaveLength(14)
    const vatReturn = returnOf(spec)
    expect(vatReturn.thirdCountryServices).toEqual({ base: euros(8), vat: euros(2) })
    expect([vatReturn.outputVat, vatReturn.inputVat, vatReturn.carriedForward]).toEqual([euros(6), euros(26), euros(-170)])
  })

  it('reads a tab name written with combining accents as the same tab', () => {
    const tabs = vatReturnTabs({ sales: [SALE], local: [], broughtForward: -150 }).map((tab) => ({ ...tab, name: tab.name.normalize('NFD') }))
    expect('document' in read(tabs)).toBe(true)
  })

  it('refuses a tab it does not know, so a new kind of supply fails loudly', () => {
    const tabs = [...vatReturnTabs({ sales: [SALE], local: [], broughtForward: -150 }), { name: 'EU dobra U', grid: [['R.b.']] }]
    expect(refusalOf(tabs)).toEqual({ tab: 'EU dobra U', row: null, reason: 'a tab this reader does not know' })
  })

  it('refuses a return whose summary lacks a label', () => {
    const tabs = vatReturnTabs({ sales: [SALE], local: [], broughtForward: -150 })
    const summary = tabs[0]!
    const without = [{ ...summary, grid: summary.grid.filter((row) => row[0] !== 'Pretplata za prijenos u buduća razdoblja') }, ...tabs.slice(1)]
    expect(refusalOf(without)).toEqual({ tab: 'Rekapitulacija', row: null, reason: 'no Pretplata za prijenos u buduća razdoblja line in the closing lines' })
  })

  it('refuses a summary line that disagrees with its detail tab, naming the row', () => {
    const tabs = vatReturnTabs({ sales: [SALE], local: [{ base: 80, vat: 20 }], eu: [{ base: 16, vat: 4 }], broughtForward: -150 })
    // Row 7 is Lokalne isporuke in the 12-row shape, column C its VAT.
    expect(refusalOf(withCell(tabs, 'Rekapitulacija', 7, 3, 21))).toEqual({ tab: 'Rekapitulacija', row: 7, reason: 'the VAT of Lokalne isporuke differs from the total of Lokalni U' })
  })

  it('refuses a detail tab whose lines do not add up to its total row', () => {
    const tabs = vatReturnTabs({ sales: [SALE], local: [{ base: 80, vat: 20 }], broughtForward: -150 })
    expect(refusalOf(withCell(tabs, 'Lokalni U', 2, 6, 81))).toEqual({ tab: 'Lokalni U', row: 5, reason: 'the lines do not add up to the total row' })
  })

  it('refuses a detail tab the summary has no line for', () => {
    const tabs = vatReturnTabs({ sales: [SALE], local: [], eu: [{ base: 16, vat: 4 }], broughtForward: -150 })
    const summary = tabs[0]!
    const without = [{ ...summary, grid: summary.grid.filter((row, index) => !(row[0] === 'EU - usluge' && index < 5)) }, ...tabs.slice(1)]
    expect(refusalOf(without).reason).toBe('Izlazne isporuke has no line for the EU usluge U tab')
  })

  it('refuses a sales line without a date', () => {
    const tabs = vatReturnTabs({ sales: [SALE], local: [], broughtForward: -150 })
    expect(refusalOf(withCell(tabs, 'Treće zemlje usluge I', 2, 3, '31.3.2026'))).toEqual({ tab: 'Treće zemlje usluge I', row: 2, reason: 'Datum is not a date' })
  })

  it('refuses a separator tab that holds cells', () => {
    const tabs = withCell(vatReturnTabs({ sales: [SALE], local: [], broughtForward: -150 }), 'Ulazni>>', 1, 1, 'note')
    expect(refusalOf(tabs)).toEqual({ tab: 'Ulazni>>', row: null, reason: 'a separator tab holds cells' })
  })
})
