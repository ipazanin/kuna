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
      localSales: { base: euros(0), vat: euros(0) },
      localPurchases: { base: euros(0), vat: euros(0) },
      euGoods: { base: euros(0), vat: euros(0) },
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

  it('reads sales in Croatia from Lokalni I, whose VAT the company owes', () => {
    const spec: VatReturnSpec = { sales: [SALE], localSales: [{ base: 200, vat: 50 }], local: [{ base: 80, vat: 20 }], broughtForward: -150 }
    expect(vatReturnTabs(spec)[0]!.grid).toHaveLength(11)
    const vatReturn = returnOf(spec)
    expect(vatReturn.localSales).toEqual({ base: euros(200), vat: euros(50) })
    // 50.00 owed on the sales less 20.00 deducted on the purchases leaves 30.00 to pay, which the 150.00 overpayment brought forward covers.
    expect([vatReturn.outputVat, vatReturn.inputVat, vatReturn.difference, vatReturn.carriedForward]).toEqual([euros(50), euros(20), euros(30), euros(-120)])
  })

  it('reads goods bought from the EU from Dobra EU, reverse charged on both sides', () => {
    const spec: VatReturnSpec = { sales: [SALE], local: [{ base: 80, vat: 20 }], euGoods: [{ base: 12, vat: 3 }, { base: 4, vat: 1 }], broughtForward: -150 }
    expect(vatReturnTabs(spec)[0]!.grid).toHaveLength(12)
    const vatReturn = returnOf(spec)
    expect(vatReturn.euGoods).toEqual({ base: euros(16), vat: euros(4) })
    expect([vatReturn.outputVat, vatReturn.inputVat, vatReturn.difference, vatReturn.carriedForward]).toEqual([euros(4), euros(24), euros(-20), euros(-170)])
  })

  it('reads third-country services under the older wording, Primljene usluge - TZ and Porezni broj', () => {
    const spec: VatReturnSpec = { sales: [SALE], local: [{ base: 80, vat: 20 }], thirdCountry: [{ base: 8, vat: 2 }], olderThirdCountryWording: true, broughtForward: -150 }
    const vatReturn = returnOf(spec)
    expect(vatReturn.thirdCountryServices).toEqual({ base: euros(8), vat: euros(2) })
    expect([vatReturn.outputVat, vatReturn.inputVat, vatReturn.carriedForward]).toEqual([euros(2), euros(22), euros(-170)])
  })

  it('refuses a third-country services tab with neither tax number header, naming both', () => {
    const tabs = withCell(vatReturnTabs({ sales: [SALE], local: [], thirdCountry: [{ base: 8, vat: 2 }], broughtForward: -150 }), 'Treće zemlje usluge U', 1, 5, 'OIB')
    expect(refusalOf(tabs)).toEqual({
      tab: 'Treće zemlje usluge U',
      row: 1,
      reason: 'the header is not R.b., Broj računa, Datum, Dobavljač, PDV ID broj or Porezni broj, Osnovica, PDV, Ukupno',
    })
  })

  it('refuses a summary line for sales in Croatia that disagrees with Lokalni I', () => {
    const tabs = vatReturnTabs({ sales: [SALE], localSales: [{ base: 200, vat: 50 }], local: [], broughtForward: -150 })
    // Row 4 is Lokalne isporuke under Izlazne isporuke, column C its VAT.
    expect(refusalOf(withCell(tabs, 'Rekapitulacija', 4, 3, 51))).toEqual({ tab: 'Rekapitulacija', row: 4, reason: 'the VAT of Lokalne isporuke differs from the total of Lokalni I' })
  })

  it('refuses a summary line for EU goods without the Dobra EU tab behind it', () => {
    const tabs = vatReturnTabs({ sales: [SALE], local: [], euGoods: [{ base: 12, vat: 3 }], broughtForward: -150 }).filter((tab) => tab.name !== 'Dobra EU')
    expect(refusalOf(tabs)).toEqual({ tab: 'Rekapitulacija', row: 4, reason: 'Stjecanje dobra iz EU has no Dobra EU tab behind it' })
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
