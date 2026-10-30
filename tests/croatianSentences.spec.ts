import { afterEach, describe, expect, it, vi } from 'vitest'

import type { YearlyRate } from '../src/apps/loans/bankLoans/domain/yearlyRate'
import { BANK_LOAN_RECORDS, EXTRA_PAYMENT_RECORDS, RATE_PERIOD_RECORDS } from '../src/apps/loans/workbook/domain/loanKinds'
import { monthKey } from '../src/shared/calendar/monthKey'
import type { RecordNoun } from '../src/shared/storage/domain/recordKind'
import { storedFieldsOfValues } from '../src/shared/storage/domain/storedFields'
import { civil, euros } from './fixtures/ledger'

/** The sentences Croatian builds from a record's noun, with the language on screen pinned to Croatian. */
async function croatian(): Promise<typeof import('../src/shared/storage/presentation/words')> {
  return inCroatian(() => import('../src/shared/storage/presentation/words'))
}

/** A module as it loads with the language on screen pinned to Croatian. */
async function inCroatian<Module>(load: () => Promise<Module>): Promise<Module> {
  vi.resetModules()
  vi.doMock('../src/shared/text/language', () => ({ language: 'hr', intlLocale: 'hr-HR' }))
  return load()
}

function labels(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `${index + 1}`)
}

afterEach(() => {
  vi.doUnmock('../src/shared/text/language')
})

describe('the change sentence in Croatian', () => {
  it('agrees the participle with the noun of one named record', async () => {
    const { words } = await croatian()
    const added = (noun: RecordNoun) => words.changes([{ verb: 'add', noun, labels: ['Stambeni'] }], false)

    expect(added(BANK_LOAN_RECORDS.noun)).toBe('Dodan je kredit „Stambeni”')
    expect(added(EXTRA_PAYMENT_RECORDS.noun)).toBe('Dodana je prijevremena otplata „Stambeni”')
    expect(added(RATE_PERIOD_RECORDS.noun)).toBe('Dodano je razdoblje kamatne stope „Stambeni”')
  })

  it('counts records with the form 2, 5 and 21 take', async () => {
    const { words } = await croatian()
    const deleted = (count: number) => words.changes([{ verb: 'remove', noun: EXTRA_PAYMENT_RECORDS.noun, labels: labels(count) }], false)

    expect(deleted(2)).toBe('Obrisane su 2 prijevremene otplate')
    expect(deleted(5)).toBe('Obrisano je 5 prijevremenih otplata')
    expect(deleted(21)).toBe('Obrisana je 21 prijevremena otplata')
  })

  it('joins kinds with i and words an undo by the act', async () => {
    const { words } = await croatian()

    expect(
      words.changes(
        [
          { verb: 'add', noun: BANK_LOAN_RECORDS.noun, labels: ['Auto'] },
          { verb: 'add', noun: RATE_PERIOD_RECORDS.noun, labels: ['6,5 %'] },
        ],
        false,
      ),
    ).toBe('Dodan je kredit „Auto” i dodano je razdoblje kamatne stope „6,5 %”')
    expect(words.changes([{ verb: 'remove', noun: BANK_LOAN_RECORDS.noun, labels: ['Auto'] }], true)).toBe('Poništeno je brisanje kredita „Auto”')
    expect(words.changes([{ verb: 'change', noun: EXTRA_PAYMENT_RECORDS.noun, labels: labels(2) }], true)).toBe('Poništeno je mijenjanje 2 prijevremene otplate')
  })
})

describe('record labels in Croatian', () => {
  it('writes days, amounts, rates and movement kinds the Croatian way', async () => {
    const { words } = await inCroatian(() => import('../src/apps/loans/workbook/domain/words'))

    expect(words.labels.movement(storedFieldsOfValues({ date: '2026-10-01', kind: 'repaid', amount: '250' }))).toBe('1.\u00a010.\u00a02026., vraćeno, 250,00\u00a0€')
    expect(words.labels.movement(storedFieldsOfValues({ date: '2026-10-01', kind: 'borrowed-in-kind', amount: '250' }))).toBe('1.\u00a010.\u00a02026., posuđeno u naravi, 250,00\u00a0€')
    expect(words.labels.ratePeriod(storedFieldsOfValues({ rate: '2.5', from: '2023-07-20' }))).toBe('2,5\u00a0% od 20.\u00a07.\u00a02023.')
    expect(words.labels.extraPayment(storedFieldsOfValues({ date: '2027-03-01', amount: '5000' }))).toBe('1.\u00a03.\u00a02027., 5.000,00\u00a0€')
    expect(words.labels.lateInstalment(storedFieldsOfValues({ due: '2024-12-20', paid: '2025-01-07' }))).toBe('dospijeće 20.\u00a012.\u00a02024., plaćeno 7.\u00a01.\u00a02025.')
  })

  it('keeps text it cannot read as the file holds it, and names a blank record', async () => {
    const { words } = await inCroatian(() => import('../src/apps/loans/workbook/domain/words'))

    expect(words.labels.movement(storedFieldsOfValues({ date: 'soon', kind: 'lent', amount: 'lots' }))).toBe('soon, lent, lots')
    expect(words.labels.ratePeriod(storedFieldsOfValues({ rate: '3.18%' }))).toBe('3.18%')
    expect(words.labels.extraPayment(storedFieldsOfValues({}))).toBe('bez naziva')
  })
})

describe('full stops in Croatian', () => {
  it('ends a sentence on a date with the date’s own full stop', async () => {
    const balances = await inCroatian(() => import('../src/apps/loans/balances/presentation/words'))
    const months = await import('../src/shared/calendar/monthLabel')
    const writes = await import('../src/shared/storage/application/words')
    const sentences = [
      balances.words.description(months.monthLabel(monthKey(2023, 3)), months.monthLabel(monthKey(2048, 3)), months.monthLabel(monthKey(2026, 10)), '154.274,21 €') +
        balances.words.planDescription('0,00 €', months.monthLabel(monthKey(2048, 3))),
      writes.words.refusals.problem(EXTRA_PAYMENT_RECORDS.noun, '1. 3. 2027., 5.000,00 €', 'datum 1. 3. 2027. je prije isplate kredita „Auto” 1. 5. 2027.'),
      writes.words.refusals.leftOut(EXTRA_PAYMENT_RECORDS.noun, '1. 3. 2027., 5.000,00 €', 'polje amount je prazno'),
    ]

    expect(sentences.filter((sentence) => sentence.includes('..'))).toEqual([])
    expect(sentences[0]).toContain('ožujak\u00a02048. Na kraju mjeseca (listopad\u00a02026.) dug iznosi')
    expect(sentences[1]).toMatch(/1\. 5\. 2027\.$/)
    expect(sentences[2]).toMatch(/prazno\.$/)
  })

  it('ends a scenario sentence on a date with the date’s own full stop', async () => {
    const view = await inCroatian(() => import('../src/apps/loans/scenarios/presentation/scenariosView'))
    const comparison = await import('../src/apps/loans/scenarios/presentation/scenarioComparison')
    const scenarios = await import('../src/apps/loans/scenarios/presentation/words')
    const { dayLabel } = await import('../src/shared/calendar/dayLabel')
    const { monthLabel } = await import('../src/shared/calendar/monthLabel')
    const move = {
      kind: 'move',
      on: civil('2027-01-20'),
      lender: 'Jadranska banka',
      rate: 29_000 as YearlyRate,
      rateType: 'fixed',
      instalments: 240,
      costs: { upfront: euros(1500), monthly: euros(0), yearly: euros(0) },
    } as const
    const sentences = [
      view.changeSummary(move, { month: monthKey(2030, 1), months: 36 }),
      comparison.refusalText({ refused: 'rate-shares-day', date: civil('2027-01-20') }),
      comparison.refusalText({ refused: 'no-first-rate', firstInstalment: civil('2023-04-20') }),
      scenarios.words.charts.owedEntry('B', '5.000,00 € iduće proljeće', monthLabel(monthKey(2048, 3))),
      scenarios.words.table.subsidy(dayLabel(civil('2029-03-20')), '1.200,00 €'),
      scenarios.words.summary.stands(`3,1 % fiksna, zatim 2,9 % fiksna od ${dayLabel(civil('2028-04-20'))}`),
    ]

    expect(sentences.filter((sentence) => sentence.includes('..'))).toEqual([])
    expect(sentences[0]).toMatch(/Troškovi se vrate do 31\. 1\. 2030\.$/)
    expect(sentences[4]).toContain('do 20. 3. 2029. Do prijevremene otplate')
    expect(sentences[5]).toMatch(/20\. 4\. 2028\.$/)
  })
})
