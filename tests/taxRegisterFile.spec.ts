import { describe, expect, it } from 'vitest'

import { taxRegisterFile, taxRegisterFileName } from '../src/apps/investments/tax/infrastructure/taxRegisterFile'
import { civilDateFromSerial } from '../src/shared/calendar/civilDate'
import { readEveryTab } from '../src/shared/xlsx/sheetGrids'
import { EURO } from '../src/shared/money/currencyCode'
import { BROKER, book, instrument, trade } from './fixtures/investments'
import { EXAMPLE_RATES, exampleYear, payment } from './fixtures/taxExample'

type Grid = Awaited<ReturnType<typeof readEveryTab>>[number]['grid']

async function exampleTabs(records = exampleYear(), year = 2026): Promise<Map<string, Grid>> {
  const tabs = await readEveryTab(await taxRegisterFile(records, EXAMPLE_RATES, year))
  return new Map(tabs.map((tab) => [tab.name, tab.grid]))
}

function dayOf(cell: unknown): string {
  return civilDateFromSerial(cell as number)
}

describe('the tax register file', () => {
  it('names the file and its four sheets for the year, with Croatian headers', async () => {
    const tabs = await exampleTabs()

    expect(taxRegisterFileName(2026)).toBe('kuna-porez-2026.xlsx')
    expect([...tabs.keys()]).toEqual(['Evidencija', 'Prodaje 2026', 'Inozemni dohodak 2026', 'Sažetak'])
    expect(tabs.get('Evidencija')![0]).toEqual([
      'R.br.',
      'Finan. imovina',
      'Datum',
      'Opis trans.',
      'Iznos po jedinici',
      'Količina',
      'Ukupna vrijednost',
      'Nabavna vrijednost otuđene imovine',
      'Troškovi',
      'Dobitak/gubitak (neto)',
      'Valuta',
      'Datum namire',
      'Tečaj HNB-a',
      'Dobitak/gubitak (EUR)',
    ])
    expect(tabs.get('Prodaje 2026')![0]).toEqual([
      'Datum prodaje',
      'Datum namire',
      'Finan. imovina',
      'Količina',
      'Datum kupnje',
      'Dana u posjedu',
      'Nabavna vrijednost',
      'Prodajna vrijednost',
      'Troškovi',
      'Dobitak/gubitak (neto)',
      'Valuta',
      'Tečaj HNB-a',
      'Dobitak/gubitak (EUR)',
      'Status',
    ])
    expect(tabs.get('Inozemni dohodak 2026')![0]).toEqual([
      'Datum isplate',
      'Isplatitelj',
      'Država',
      'Vrsta',
      'Bruto',
      'Porez plaćen u inozemstvu',
      'Valuta',
      'Tečaj HNB-a',
      'Bruto (EUR)',
      'Porez plaćen u inozemstvu (EUR)',
      'Porez u RH 12% (EUR)',
      'Priznati porez (EUR)',
      'Za uplatu (EUR)',
      'Način',
    ])
  })

  it('lists every buy and sale of each instrument sold in the year from its first buy on', async () => {
    const ledger = (await exampleTabs()).get('Evidencija')!.slice(1)

    expect(ledger.map((row) => [row[0], row[1], dayOf(row[2]), row[3]])).toEqual([
      [1, 'Example World ETF', '2024-01-15', 'Kupnja'],
      [2, 'Example World ETF', '2025-06-10', 'Kupnja'],
      [3, 'Example World ETF', '2026-03-02', 'Prodaja'],
      [4, 'Example Old Share', '2023-05-02', 'Kupnja'],
      [5, 'Example Old Share', '2026-05-04', 'Prodaja'],
      [6, 'Example Dividend Co', '2026-01-12', 'Kupnja'],
      [7, 'Example Dividend Co', '2026-06-15', 'Prodaja'],
      [8, 'Example Tech', '2025-03-10', 'Kupnja'],
      [9, 'Example Tech', '2026-10-02', 'Prodaja'],
    ])
  })

  it("puts the Example Tech sale's dollars, its Monday settlement, the HNB rate 1.2 and €166.67 on its row", async () => {
    const ledger = (await exampleTabs()).get('Evidencija')!
    const sale = ledger.find((row) => row[1] === 'Example Tech' && row[3] === 'Prodaja')!

    // 10 at $120.00 is $1,200.00 against the $1,000.00 the lot cost, and $200.00 ÷ 1.2000 is €166.67.
    expect(sale.slice(4, 11)).toEqual([120, 10, 1200, 1000, 0, 200, 'USD'])
    expect([dayOf(sale[11]), sale[12], sale[13]]).toEqual(['2026-10-05', 1.2, 166.67])
  })

  it('gives one row per lot a sale closed, with its status in Croatian', async () => {
    const sales = (await exampleTabs()).get('Prodaje 2026')!.slice(1)

    expect(sales.map((row) => [row[2], row[12], row[13]])).toEqual([
      ['Example World ETF', 298.33, 'Bez poreza'],
      ['Example World ETF', 49.17, 'Oporezivo'],
      ['Example Old Share', -40, 'Stari gubitak, ne odbija se'],
      ['Example Dividend Co', -80, 'Gubitak'],
      ['Example Tech', 166.67, 'Oporezivo'],
    ])
  })

  it('routes each payment of the year', async () => {
    const income = (await exampleTabs()).get('Inozemni dohodak 2026')!.slice(1)

    expect(income.map((row) => [dayOf(row[0]), row[3], row[13]])).toEqual([
      ['2026-07-15', 'Dividenda', 'INO-DOH'],
      ['2026-08-05', 'Posudba dionica', 'JOPPD u 30 dana'],
      ['2026-09-02', 'Nagrada za preporuku', 'Nagrada za preporuku'],
      ['2026-10-16', 'Dividenda', 'JOPPD u 30 dana'],
    ])
  })

  it('gives other income no tax of its own, and stock lending an import stored as other income its kind', async () => {
    const records = exampleYear()
    const added = [payment('other', '2026-11-02', EURO, '3', 'Refund of tax withheld at source'), payment('other', '2026-11-03', EURO, '1', 'Stock yield income')]
    const income = (await exampleTabs({ ...records, income: [...records.income, ...added] })).get('Inozemni dohodak 2026')!.slice(-2)

    expect(income.map((row) => [row[3], row[13]])).toEqual([
      ['Drugi prihod', 'Nema vlastitog poreza'],
      ['Posudba dionica', 'JOPPD u 30 dana'],
    ])
  })

  it("sums up the year's JOPPD with its 16.30 tax and its 26365 mark", async () => {
    const summary = new Map((await exampleTabs()).get('Sažetak')!.map((row) => [row[0], row[1]]))

    expect(summary.get('Oznaka izvješća')).toBe('26365')
    expect([summary.get('6.1 Oznaka stjecatelja/osiguranika'), summary.get('6.2 Oznaka primitka/obveze doprinosa')]).toEqual(['1001', '1006'])
    expect([dayOf(summary.get('Razdoblje od')), dayOf(summary.get('Razdoblje do'))]).toEqual(['2026-01-01', '2026-12-31'])
    expect(['11 Primitak', '13.1 Izdatak', '13.3 Dohodak', '13.5 Porezna osnovica', '14.1 Porez na dohodak 12%', '14.2 Prirez'].map((label) => summary.get(label))).toEqual([
      215.84, 80, 135.84, 135.84, 16.3, 0,
    ])
    expect(dayOf(summary.get('Rok za JOPPD i uplatu poreza'))).toBe('2027-03-01')
    expect(summary.get('Nije uračunato jer nema tečaja HNB-a (prodaje i isplate)')).toBe(0)
    expect(summary.get('Prodaje se računaju u godinu')).toBe('Po datumu namire, ZPDoh čl. 11. st. 3.')
  })

  it('lists a sale of 30 Dec 2026 settling on 4 Jan 2027 in the 2027 register, and 2023 with its surtax left to the city', async () => {
    const etf = instrument('etf', { name: 'Example ETF' })
    const records = book({
      instruments: [etf],
      trades: [trade('buy', BROKER, etf, '2023-01-09', '20', '100', '0'), trade('sell', BROKER, etf, '2023-06-01', '10', '110', '0'), trade('sell', BROKER, etf, '2026-12-30', '10', '105', '0')],
    })

    const sold = async (year: number) =>
      (await exampleTabs(records, year))
        .get(`Prodaje ${year}`)!
        .slice(1)
        .map((row) => [dayOf(row[0]), dayOf(row[1])])
    expect([await sold(2026), await sold(2027)]).toEqual([[], [['2026-12-30', '2027-01-04']]])
    const summary = new Map((await exampleTabs(records, 2023)).get('Sažetak')!.map((row) => [row[0], row[1]]))
    expect(['Oznaka izvješća', '14.1 Porez na dohodak 10%', '14.2 Prirez'].map((label) => summary.get(label))).toEqual(['23365', 10, 'Stopa prireza vašeg grada na 14.1'])
  })
})
