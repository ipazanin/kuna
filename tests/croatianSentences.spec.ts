import { afterEach, describe, expect, it, vi } from 'vitest'

import type { YearlyRate } from '../src/apps/loans/bankLoans/domain/yearlyRate'
import { BANK_LOAN_RECORDS, EXTRA_PAYMENT_RECORDS, RATE_PERIOD_RECORDS } from '../src/apps/loans/workbook/domain/loanKinds'
import { civilDate } from '../src/shared/calendar/civilDate'
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

describe('Company names Kuna seeds, in Croatian', () => {
  it('names every category and family new books start with', async () => {
    const { displayName } = await inCroatian(() => import('../src/apps/company/workbook/domain/displayName'))
    const { slugInWords } = await import('../src/apps/company/workbook/domain/slugInWords')
    const { emptyWorkbookTabs } = await import('../src/apps/company/workbook/infrastructure/emptyWorkbook')
    const seeded = emptyWorkbookTabs().categories.flatMap((row) => [String(row.cells.category), String(row.cells.family)])

    expect([...new Set(seeded)].filter((slug) => displayName(slug) === slugInWords(slug))).toEqual(['marketing'])
    expect(displayName('office-rent')).toBe('Najam ureda')
    expect(displayName('operating')).toBe('Poslovni rashodi')
  })

  it('keeps a label the file gives and the words of a slug Kuna never seeded', async () => {
    const { displayName, displayNamesOf } = await inCroatian(() => import('../src/apps/company/workbook/domain/displayName'))
    const names = displayNamesOf({ categories: [], accounts: [{ slug: 'travel', label: '', iban: '', currency: '' }] })

    expect(displayName('office-rent', 'Ured u Splitu')).toBe('Ured u Splitu')
    expect(displayName('ai-services')).toBe('AI services')
    expect(names.account('travel')).toBe('Travel')
  })
})

describe('Company record labels and sentences in Croatian', () => {
  it('writes a ledger row and a split part with Croatian days and amounts', async () => {
    const { words } = await inCroatian(() => import('../src/apps/company/workbook/domain/words'))

    expect(words.labels.ledgerRow(storedFieldsOfValues({ date: '2026-10-01', counterparty: 'BISTRO', amount: '-12.5', balance: '100' }))).toBe('1. 10. 2026., BISTRO, −12,50 €, saldo 100,00 €')
    expect(words.labels.splitPart(storedFieldsOfValues({ category: 'travel', amount: '-40', date: '2026-10-01' }))).toBe('travel, −40,00 €, 1. 10. 2026.')
  })

  it('counts the owner advances a filter leaves out, with the verb of one filter or two', async () => {
    const { words } = await inCroatian(() => import('../src/apps/company/transactions/presentation/words'))

    expect(words.advancesLeftOut(1, ['counterparty'])).toMatch(/^1 predujam vlasnika u ovom razdoblju nije na popisu jer ga filtar partnera izostavlja\./)
    expect(words.advancesLeftOut(2, ['account', 'review'])).toMatch(/^2 predujma vlasnika u ovom razdoblju nisu na popisu jer ih filtri računa u banci i provjere izostavljaju\./)
    expect(words.advancesLeftOut(5, ['review'])).toMatch(/^5 predujmova vlasnika u ovom razdoblju nije na popisu jer ih filtar provjere izostavlja\./)
  })

  it('says what a rules change did, renumbering included', async () => {
    const { rulesChangeInWords } = await inCroatian(() => import('../src/apps/company/rules/domain/ruleSummary'))
    const added = { rule: 'merchant-bistro', order: '150' }
    const renumbered = (id: string, from: string, to: string) => ({ id, expected: { rule: id, order: from }, fields: { rule: id, order: to } })

    expect(rulesChangeInWords({ appended: added, edited: [renumbered('a', '100', '200')], removed: null })).toBe('Dodano: merchant-bistro, i prenumerirano je 1 pravilo')
    expect(rulesChangeInWords({ appended: added, edited: [renumbered('a', '100', '200'), renumbered('b', '200', '300')], removed: null })).toBe('Dodano: merchant-bistro, i prenumerirana su 2 pravila')
    expect(rulesChangeInWords({ appended: null, edited: [], removed: added })).toBe('Obrisano: merchant-bistro')
  })

  it('ends a ruleset sentence on its date’s own full stop', async () => {
    const { words } = await inCroatian(() => import('../src/apps/company/packs/hr-doo/ruleset/presentation/words'))
    const sentences = [words.intro('28. 10. 2026.'), words.detail.checkedOn('28. 10. 2026.'), words.detail.forPeriods('2025. i 2026.'), words.watch.about('1. 9. 2026.')]

    expect(sentences.filter((sentence) => sentence.includes('..'))).toEqual([])
    expect(words.periods.twoYears(2025, 2026)).toBe('2025. i 2026.')
  })
})

describe('imports, sync and mail in Croatian', () => {
  it('names the review reasons the import stores, and shows any other as stored', async () => {
    const { reviewReasonLabel } = await inCroatian(() => import('../src/apps/company/imports/domain/camtStatement'))

    expect(['no bank reference', 'reversal', 'value date used', 'batched entry', 'typed by hand'].map(reviewReasonLabel)).toEqual([
      'nema bankovne reference',
      'storno',
      'korišten datum valute',
      'skupna stavka',
      'typed by hand',
    ])
  })

  it('counts what an import and a sync wrote with the form 1, 2, 5 and 21 take', async () => {
    const { words } = await inCroatian(() => import('../src/apps/company/imports/application/words'))

    expect(words.imported([], 1)).toBe('Uvezena je 1 stavka')
    expect(words.imported([], 4)).toBe('Uvezene su 4 stavke')
    expect(words.imported(['main'], 5)).toBe('Dodan je račun main i uvezeno je 5 stavki')
    expect(words.imported(['main', 'second'], 21)).toBe('Dodani su računi main i second i uvezena je 21 stavka')
    expect(words.sync.filed(['028'], 4)).toBe('Upisan je izvod 028, 4 stavke')
    expect(words.sync.filed(['028', '029'], 5)).toBe('Upisani su izvodi 028 i 029, 5 stavki')
    expect(words.sync.filed(['1', '2', '3'], 21)).toBe('Upisana su 3 izvoda, 21 stavka')
  })

  it('writes a statement’s refusals with Croatian amounts and dates', async () => {
    const { words } = await inCroatian(() => import('../src/apps/company/imports/domain/words'))

    expect(words.dryRun.beforeNewest(civilDate(2026, 9, 1), civilDate(2026, 9, 15), 'main').replaceAll('\u00a0', ' ')).toBe(
      'Prva nova stavka ima datum 1. 9. 2026., prije 15. 9. 2026., datuma najnovije stavke računa main. Stavke se dodaju samo nakon najnovije.',
    )
    expect(words.dryRun.noReference(1)).toMatch(/^Jedna stavka nema bankovnu referencu, pa je /)
    expect(words.dryRun.noReference(3)).toMatch(/^3 stavke nemaju bankovnu referencu, pa ih /)
    expect(words.dryRun.sequenceGap(30, 27, 'main', 2)).toContain('pa u evidenciji nedostaju 2 izvoda.')
    expect(words.camt.summaryCount('TtlDbtNtries', 3, 2, 'debit')).toBe('TtlDbtNtries navodi 3 stavke, a aplikacija je pročitala 2 stavke proknjiženih terećenja.')
  })

  it('counts the mail step’s files and names the ones it could not file', async () => {
    const { words } = await inCroatian(() => import('../src/apps/company/mail/domain/words'))
    const none = { filed: 0, notFiled: 0, already: 0, corrections: 0, unchecked: 0, unmatched: 0 }

    expect(words.counts({ ...none, filed: 9, already: 4, corrections: 1, unchecked: 1, unmatched: 2 })).toBe('Spremljeno 9, već postoji 4, ispravci 1, nije uspoređeno 1, bez pravila 2')
    expect(words.counts({ ...none, already: 50 })).toBe('Ništa novo, već postoji 50')
    expect(words.notFiled(['a.pdf', 'b.xml', 'c.pdf'])).toBe('Nije spremljeno: a.pdf, b.xml i još 1.')
    expect(words.incompleteOnSettings(['sender', 'subject', 'folder'])).toBe('Uključeno je, ali u postavkama, Općenito nema pošiljatelja, predmeta ni mape')
  })
})

describe('invoicing and billing in Croatian', () => {
  it('lists what the invoice terms lack with i, and quotes the client a sentence names', async () => {
    const { invoiceProblems } = await inCroatian(() => import('../src/apps/company/invoicing/domain/invoiceDocument'))
    const { DEFAULT_SETTINGS } = await import('../src/apps/company/settings/domain/settings')
    const { NO_CLIENT_INVOICING } = await import('../src/apps/company/workbook/domain/workbook')
    const { moneyFromAmount } = await import('../src/shared/money/money')
    const issuer = { ...DEFAULT_SETTINGS.invoicing, name: 'Example Studio', address: 'Street 1', iban: 'HR6212345670000000001', signatory: 'Ana' }
    const client = { slug: 'north', name: 'North Ltd', ibans: [], invoicing: { ...NO_CLIENT_INVOICING, address: '1 Road', reverseCharge: false } }

    expect(invoiceProblems(issuer, client, [{ description: 'Work', amount: moneyFromAmount(100) }])).toEqual([
      'U uvjetima računa pod Računi, Klijenti nedostaje: vaš PDV ID i mjesto izdavanja.',
      'Aplikacija izrađuje račune bez PDV-a samo za klijente s prijenosom porezne obveze. Ako PDV obračunava klijent „North Ltd”, označite mu prijenos porezne obveze pod Računi, Klijenti, ili ovaj račun izradite drugdje.',
    ])
  })

  it('names a plan row with its Croatian day and amount', async () => {
    const { words } = await inCroatian(() => import('../src/apps/company/workbook/domain/words'))

    expect(words.labels.billingItem(storedFieldsOfValues({ item: 'Monthly fee', client: 'north', date: '2026-10-31', amount: '7200' }))).toBe('Monthly fee, north, 31. 10. 2026., 7.200,00 €')
  })

  it('names a tab editor’s rows in the nominative, with the adjective of the noun’s gender', async () => {
    const { words } = await inCroatian(() => import('../src/apps/company/settings/presentation/words'))
    const { CLIENT_RECORDS } = await import('../src/apps/company/workbook/domain/coreKinds')
    const { ASSET_RECORDS, GRANT_RECORDS } = await import('../src/apps/company/packs/hr-doo/domain/hrDooKinds')

    expect([CLIENT_RECORDS, ASSET_RECORDS, GRANT_RECORDS].map((kind) => words.factTab.add(kind.noun))).toEqual(['Novi klijent', 'Novo sredstvo', 'Nova potpora'])
    expect([1, 2, 5, 21].map((count) => words.factTab.count(CLIENT_RECORDS.noun, count))).toEqual(['1 klijent', '2 klijenta', '5 klijenata', '21 klijent'])
    expect(words.factTab.none(CLIENT_RECORDS.noun)).toBe('Još nema klijenata.')
  })

  it('counts days, plan rows and filled rows with the form 1, 2, 5 and 21 take', async () => {
    const receivables = await inCroatian(() => import('../src/apps/company/receivables/presentation/words'))
    const billing = await import('../src/apps/company/billingPlan/presentation/words')
    const { plural } = await import('../src/shared/text/translation')
    const counted = (forms: (count: number) => Parameters<typeof plural>[0]) => [1, 2, 5, 21].map((count) => plural(forms(count), count))

    expect([1, 2, 1.5, 21].map(receivables.words.days)).toEqual(['1 dan', '2 dana', '1,5 dana', '21 dan'])
    expect(counted(billing.words.fill.added)).toEqual(['Dodana je 1 stavka plana', 'Dodane su 2 stavke plana', 'Dodano je 5 stavki plana', 'Dodana je 21 stavka plana'])
    expect(counted(billing.words.fill.addCount)).toEqual(['Dodaj 1 stavku', 'Dodaj 2 stavke', 'Dodaj 5 stavki', 'Dodaj 21 stavku'])
  })

  it('ends a sentence on a period with one full stop, whether the period ends in a year or a word', async () => {
    const { words } = await inCroatian(() => import('../src/apps/company/receivables/presentation/words'))
    const sentences = [words.panel.daysSubtitle('listopad 2025. – rujan 2026.'), words.panel.daysSubtitle('studeni 2025. – listopad 2026., listopad dosad')]

    expect(sentences.filter((sentence) => sentence.includes('..'))).toEqual([])
    expect(sentences[1]).toMatch(/^studeni 2025\. – listopad 2026\., listopad dosad\. Svaka točka/)
  })
})

describe('settings and onboarding in Croatian', () => {
  it('shows the bucket labels Kuna wrote in Croatian and writes them back as stored', async () => {
    const { DEFAULT_SETTINGS, parseSettings, settingsTabEntries } = await inCroatian(() => import('../src/apps/company/settings/domain/settings'))
    const read = parseSettings([
      { key: 'label_operating', value: 'Operating cost' },
      { key: 'label_income', value: 'Sales' },
    ]).settings
    const written = new Map(settingsTabEntries(read, null).map((entry) => [entry.key, entry.value]))

    expect(DEFAULT_SETTINGS.bucketLabels.operating).toBe('Poslovni rashodi')
    expect(read.bucketLabels.operating).toBe('Poslovni rashodi')
    expect(read.bucketLabels.income).toBe('Sales')
    expect(written.get('label_operating')).toBe('Operating cost')
    expect(written.get('label_income')).toBe('Sales')
    expect(written.get('label_taxes')).toBe('Taxes')
  })

  it('refuses a bucket label that names a derived line in Croatian', async () => {
    const { DEFAULT_SETTINGS, settingsErrors } = await inCroatian(() => import('../src/apps/company/settings/domain/settings'))

    expect(settingsErrors({ ...DEFAULT_SETTINGS, bucketLabels: { ...DEFAULT_SETTINGS.bucketLabels, neutral: 'Neto' } }).neutral).toBe('„Neto” već je naziv drugog retka')
  })

  it('lists the costs with the Croatian conjunction', async () => {
    const { costLabelsInSentence } = await inCroatian(() => import('../src/apps/company/settings/domain/profitAndLossLabels'))
    const { DEFAULT_SETTINGS } = await import('../src/apps/company/settings/domain/settings')

    expect(costLabelsInSentence({ ...DEFAULT_SETTINGS, ownerPayModule: true })).toBe('poslovni rashodi, porezi i isplate vlasniku')
  })

  it('counts what new books hold and what a move to Drive took, with the form 1, 2, 5 and 21 take', async () => {
    const onboarding = await inCroatian(() => import('../src/apps/company/onboarding/presentation/words'))
    const books = await import('../src/apps/company/workbook/presentation/words')
    const { plural } = await import('../src/shared/text/translation')

    expect(onboarding.words.made.holds(1, 21)).toBe('Sadrži 1 transakciju i ukupno 21 zapis.')
    expect(onboarding.words.made.holds(5, 2)).toBe('Sadrži 5 transakcija i ukupno 2 zapisa.')
    expect([1, 2, 5, 21].map((count) => plural(books.words.keep.moved(count), count))).toEqual([
      'Premješten je 1 zapis',
      'Premještena su 2 zapisa',
      'Premješteno je 5 zapisa',
      'Premješten je 21 zapis',
    ])
  })

  it('sums up the company facts with a Croatian day, rate and one full stop', async () => {
    const { words } = await inCroatian(() => import('../src/apps/company/packs/hr-doo/presentation/words'))

    expect(words.facts.summary(civilDate(2025, 5, 12), 250)).toBe('Registrirana 12.\u00a05.\u00a02025. Pozajmice vlasniku nose 2,5\u00a0%.')
    expect(words.facts.summary(null, 0)).toBe('Dan registracije nije postavljen. Pozajmice vlasniku nose 0\u00a0%.')
  })
})

describe('overview and analysis in Croatian', () => {
  it('says how long the cash lasts in months, then in years', async () => {
    const { runwayInWords } = await inCroatian(() => import('../src/apps/company/overview/domain/headline'))

    expect([0.4, 1.2, 2.4, 7.6, 24.6].map(runwayInWords)).toEqual(['manje od mjesec dana', 'oko mjesec dana', 'oko 2 mjeseca', 'oko 8 mjeseci', 'oko 2 godine'])
  })

  it('counts what waits for you with the form 1, 2, 5 and 21 take', async () => {
    const overview = await inCroatian(() => import('../src/apps/company/overview/presentation/words'))
    const pack = await import('../src/apps/company/packs/hr-doo/presentation/words')
    const { plural } = await import('../src/shared/text/translation')
    const counted = (forms: (count: number) => Parameters<typeof plural>[0]) => [1, 2, 5, 21].map((count) => plural(forms(count), count))

    expect(counted(overview.words.waiting.toReview)).toEqual([
      '1 stavka čeka provjeru kategorije',
      '2 stavke čekaju provjeru kategorije',
      '5 stavki čeka provjeru kategorije',
      '21 stavka čeka provjeru kategorije',
    ])
    expect(counted(overview.words.waiting.notFiled)).toEqual(['1 izvod nije upisan', '2 izvoda nisu upisana', '5 izvoda nije upisano', '21 izvod nije upisan'])
    expect(counted((count) => pack.words.waiting.taxOverdue(count, '100,00 €'))).toEqual([
      '1 uplata poreza na dobit kasni, a duguje se još 100,00 €',
      '2 uplate poreza na dobit kasne, a duguje se još 100,00 €',
      '5 uplata poreza na dobit kasni, a duguje se još 100,00 €',
      '21 uplata poreza na dobit kasni, a duguje se još 100,00 €',
    ])
  })

  it('writes the runway with the form a decimal takes', async () => {
    const { words } = await inCroatian(() => import('../src/apps/company/overview/presentation/words'))
    const { plural } = await import('../src/shared/text/translation')

    expect([7.4, 7, 12.5].map((months) => plural(words.tiles.months(String(months).replace('.', ',')), months))).toEqual(['7,4 mjeseca', '7 mjeseci', '12,5 mjeseci'])
  })

  it('ends a sentence on a month or a period with one full stop', async () => {
    const trends = await inCroatian(() => import('../src/apps/company/trends/presentation/words'))
    const compare = await import('../src/apps/company/period-review/presentation/words')
    const cash = await import('../src/apps/company/cash/presentation/words')
    const sentences = [
      trends.words.cumulativeDescription('1.000,00 €', 'listopad 2026.'),
      trends.words.rollingDescription('listopad 2026.', '1,00 €', null),
      trends.words.profitAndLoss.running('listopad 2026.'),
      compare.words.coverage.sameMonths('2026. broji samo siječanj – rujan 2026.', '2025.'),
      compare.words.coverage.noChange('Evidencija nema nijedan cijeli mjesec razdoblja Q3 2025.'),
      cash.words.atTheEnd('rujan 2026.', '5,00 €'),
    ]

    expect(sentences.filter((sentence) => sentence.includes('..'))).toEqual([])
    expect(sentences[2]).toBe('Listopad 2026. još traje i ne ulazi ni u jedan prosjek.')
    expect(compare.words.period.quarter(3, 2026)).toBe('Q3 2026.')
  })
})

describe('the hr-doo screens in Croatian', () => {
  it('writes a rate the Croatian way, with its decimal comma and a space before the sign', async () => {
    const { percentText } = await inCroatian(() => import('../src/apps/company/packs/hr-doo/domain/payroll/payrollArithmetic'))

    expect([2150, 1000, 250].map((rate) => percentText(rate as Parameters<typeof percentText>[0]))).toEqual(['21,5 %', '10 %', '2,5 %'])
  })

  it('lowers a label inside a sentence but keeps a first word in capitals', async () => {
    const { uncapitalised } = await import('../src/shared/text/capitalised')

    expect(['Bruto plaća', 'II. mirovinski stup', 'I. stup', 'PDV po stopi', 'Pension, pillar II'].map(uncapitalised)).toEqual([
      'bruto plaća',
      'II. mirovinski stup',
      'I. stup',
      'PDV po stopi',
      'pension, pillar II',
    ])
  })

  it('names the corporate tax payments, the switched scenario and the starting scenarios in Croatian', async () => {
    const cit = await inCroatian(() => import('../src/apps/company/packs/hr-doo/domain/cit/words'))
    const scenarios = await import('../src/apps/company/packs/hr-doo/domain/scenarios/words')
    const pay = await import('../src/apps/company/packs/hr-doo/presentation/payScenarios/words')
    const accrual = await import('../src/apps/company/packs/hr-doo/domain/accrual/words')
    const advance = cit.words.schedule.advanceFor('veljača 2027.')

    expect(cit.words.schedule.due(advance)).toBe('Predujam za mjesec veljača 2027., dospijeva')
    expect(cit.words.schedule.paid(advance)).toBe('Predujam za mjesec veljača 2027., plaćeno')
    expect(accrual.words.rowOn('Porezna uprava')).toBe('Porezna uprava,')
    expect(scenarios.words.switched('Najniža plaća', 'Samo član uprave')).toBe('Najniža plaća, a zatim Samo član uprave')
    expect([2, 4].map((count) => pay.words.startingDialog.addedDescription(count, 2027))).toEqual(['2 scenarija za 2027.', '4 scenarija za 2027.'])
  })

  it('shows a starting scenario Kuna wrote by its Croatian name and keeps a typed label', async () => {
    const { scenarioName } = await inCroatian(() => import('../src/apps/company/packs/hr-doo/domain/scenarios/startingScenarios'))

    expect(scenarioName({ slug: 'floor-salary-2027', label: 'Floor salary all year' })).toBe('Najniža plaća cijelu godinu')
    expect(scenarioName({ slug: 'floor-extras', label: 'Floor salary, tax-free items and rent' })).toBe('Najniža plaća, neoporezivi primici i najam')
    expect(scenarioName({ slug: 'early-exit', label: 'Salary stops in June' })).toBe('Salary stops in June')
    expect(scenarioName({ slug: 'early-exit', label: '' })).toBe('early-exit')
  })

  it('counts working days and months with the form 1, 2 and 5 take', async () => {
    const payroll = await inCroatian(() => import('../src/apps/company/packs/hr-doo/domain/payroll/words'))
    const taxes = await import('../src/apps/company/packs/hr-doo/presentation/taxes/words')
    const cit = await import('../src/apps/company/packs/hr-doo/domain/cit/words')

    expect([21, 22, 20].map((workingDays) => payroll.words.month.grossFor(10, workingDays))).toEqual([
      'Bruto plaća za 10 od 21 radnog dana',
      'Bruto plaća za 10 od 22 radna dana',
      'Bruto plaća za 10 od 20 radnih dana',
    ])
    expect([21, 22, 25].map((elapsed) => taxes.words.cadenceOf(null, 20, elapsed, 0))).toEqual(['plaćeno 20 od 21 mjeseca', 'plaćeno 20 od 22 mjeseca', 'plaćeno 20 od 25 mjeseci'])
    expect([1, 3, 12].map((months) => cit.words.liability.monthlyAdvance(months))).toEqual([
      'Redak 59 obrasca PD, obveza podijeljena na 1 mjesec razdoblja',
      'Redak 59 obrasca PD, obveza podijeljena na 3 mjeseca razdoblja',
      'Redak 59 obrasca PD, obveza podijeljena na 12 mjeseci razdoblja',
    ])
  })

  it('counts the years of the members decision with the form 1, 2 and 5 take', async () => {
    const { words } = await inCroatian(() => import('../src/apps/company/packs/hr-doo/domain/yearEnd/words'))

    expect([1, 2, 5].map((years) => words.openItems.decision('20 %', years))).toEqual([
      'Odluka članova za nabave iznad 20 % temeljnog kapitala u prvoj godini',
      'Odluka članova za nabave iznad 20 % temeljnog kapitala u prve 2 godine',
      'Odluka članova za nabave iznad 20 % temeljnog kapitala u prvih 5 godina',
    ])
  })
})
