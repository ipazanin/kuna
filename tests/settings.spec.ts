import { describe, expect, it } from 'vitest'

import {
  DEFAULT_SETTINGS,
  SETTING_DEFINITIONS,
  parseSettings,
  settingsErrors,
  settingsTabEntries,
} from '../src/features/settings/domain/settings'
import type { SettingRow } from '../src/features/settings/domain/settings'
import {
  costLabelsInSentence,
  inSentence,
  lineLabel,
  presentedTransactions,
  shownLines,
} from '../src/features/settings/domain/profitAndLossLabels'
import { bucketTotals } from '../src/features/workbook/domain/bucketTotals'
import { ledger } from './fixtures/ledger'

function rows(...entries: [string, SettingRow['value']][]): SettingRow[] {
  return entries.map(([key, value], index) => ({ key, value, sheetRow: index + 2 }))
}

describe('parseSettings', () => {
  it('gives the defaults, which are how the app behaved before settings, for an empty tab', () => {
    expect(parseSettings([])).toEqual({ settings: DEFAULT_SETTINGS, problems: [] })
    expect(DEFAULT_SETTINGS).toMatchObject({ currency: 'EUR', numberLocale: 'en-GB', ownerPayModule: true })
  })

  it('reads every key, whatever the case of the key and the type of the cell', () => {
    const { settings, problems } = parseSettings(
      rows(
        ['template_version', 1],
        ['Company_Name', '  Example Studio '],
        ['currency', 'gbp'],
        ['number_locale', 'de-DE'],
        ['label_owner_pay', 'Drawings'],
        ['owner_pay_module', 'no'],
        ['review_label', 'Ana'],
      ),
    )

    expect(problems).toEqual([])
    expect(settings).toEqual({
      ...DEFAULT_SETTINGS,
      companyName: 'Example Studio',
      currency: 'GBP',
      numberLocale: 'de-DE',
      bucketLabels: { ...DEFAULT_SETTINGS.bucketLabels, 'owner-pay': 'Drawings' },
      ownerPayModule: false,
      reviewLabel: 'ana',
    })
  })

  it('falls back to the default for a value that does not hold, and says which row', () => {
    const { settings, problems } = parseSettings(
      rows(['currency', 'EURO'], ['currency', 'USD'], ['number_locale', 'not a locale!'], ['owner_pay_module', 'maybe'], ['review_label', 'ai']),
    )

    expect(settings).toEqual(DEFAULT_SETTINGS)
    expect(problems.map((problem) => problem.sheetRow)).toEqual([2, 3, 4, 5, 6])
    expect(problems[1]?.reason).toBe('"currency" is already set above')
  })

  it('refuses a currency the cents arithmetic cannot hold', () => {
    const { settings, problems } = parseSettings(rows(['currency', 'KWD']))

    expect(settings.currency).toBe('EUR')
    expect(problems[0]?.reason).toMatch(/3 decimals/)
  })

  it('keeps an unknown key out of the settings and reports it', () => {
    expect(parseSettings(rows(['theme', 'dark'])).problems).toEqual([
      { sheetRow: 2, reason: '"theme" is not a setting this app knows, so it is kept but not used' },
    ])
  })

  it('treats a blank value as the default, without a problem', () => {
    expect(parseSettings(rows(['currency', '  '], ['company_name', undefined]))).toEqual({ settings: DEFAULT_SETTINGS, problems: [] })
  })

  it('puts every bucket label back when two buckets would share one', () => {
    const { settings, problems } = parseSettings(rows(['label_taxes', 'Costs'], ['label_operating', 'costs']))

    expect(settings.bucketLabels).toEqual(DEFAULT_SETTINGS.bucketLabels)
    expect(problems).toHaveLength(1)
  })

  it('reports a newer template version and reads the rest', () => {
    const { settings, problems } = parseSettings(rows(['template_version', 2], ['currency', 'USD']))

    expect(settings).toMatchObject({ templateVersion: 1, currency: 'USD' })
    expect(problems[0]?.reason).toMatch(/version 2/)
  })

  it('reads back what it writes', () => {
    const custom = { ...DEFAULT_SETTINGS, companyName: 'Studio', currency: 'CHF', ownerPayModule: false }
    const written = settingsTabEntries(custom).map((entry, index) => ({ ...entry, sheetRow: index + 2 }))

    expect(parseSettings(written)).toEqual({ settings: custom, problems: [] })
    expect(written.map((entry) => entry.key)).toEqual(SETTING_DEFINITIONS.map((definition) => definition.key))
  })
})

describe('card_settlement_ibans', () => {
  it('reads a comma-separated list of IBANs, normalised, and writes it back the same way', () => {
    const { settings, problems } = parseSettings(rows(['card_settlement_ibans', 'xx00 fake 0000 0000 99, , XX00FAKE0000000098']))

    expect(problems).toEqual([])
    expect(settings.cardSettlementIbans).toEqual(['XX00FAKE0000000099', 'XX00FAKE0000000098'])
    expect(parseSettings(rows(...settingsTabEntries(settings).map(({ key, value }) => [key, value] as [string, SettingRow['value']]))).settings).toEqual(settings)
  })

  it('reports an entry that is not an IBAN and keeps the default', () => {
    const { settings, problems } = parseSettings(rows(['card_settlement_ibans', 'XX00FAKE0000000099, card account']))

    expect(settings.cardSettlementIbans).toEqual([])
    expect(problems).toEqual([{ sheetRow: 2, reason: 'card_settlement_ibans: "CARDACCOUNT" is not an IBAN, so the default is used' }])
    expect(settingsErrors({ ...DEFAULT_SETTINGS, cardSettlementIbans: ['NOPE'] }).cardSettlementIbans).toBe('"NOPE" is not an IBAN')
  })

  it('is empty by default and listed in the template', () => {
    expect(DEFAULT_SETTINGS.cardSettlementIbans).toEqual([])
    expect(settingsTabEntries(DEFAULT_SETTINGS)).toContainEqual({ key: 'card_settlement_ibans', value: '' })
  })
})

describe('company facts', () => {
  it('default to no city, no birth year, the second pillar, no dependants, the accrual return and the invoice principle', () => {
    expect(DEFAULT_SETTINGS.companyFacts).toEqual({
      residenceCity: '',
      birthYear: null,
      pensionPillarTwo: true,
      dependants: 0,
      companyRegistered: null,
      citReturn: 'pd',
      vatPrinciple: 'invoice',
      depreciationDoubled: false,
    })
  })

  it('read every key, a registration day from a date cell or from text, and write them back the same way', () => {
    const { settings, problems } = parseSettings(
      rows(
        ['hr_residence_city', ' Zagreb '],
        ['hr_birth_year', '1990'],
        ['hr_pension_pillar_2', false],
        ['hr_dependants', 2],
        ['hr_company_registered', 45789],
        ['hr_cit_return', 'PD-NN'],
        ['hr_vat_principle', 'cash'],
        ['hr_depreciation_doubled', 'TRUE'],
      ),
    )

    expect(problems).toEqual([])
    expect(settings.companyFacts).toEqual({
      residenceCity: 'Zagreb',
      birthYear: 1990,
      pensionPillarTwo: false,
      dependants: 2,
      companyRegistered: '2025-05-12',
      citReturn: 'pd-nn',
      vatPrinciple: 'cash',
      depreciationDoubled: true,
    })
    expect(parseSettings(rows(['hr_company_registered', '2025-05-12'])).settings.companyFacts.companyRegistered).toBe('2025-05-12')
    expect(parseSettings(rows(...settingsTabEntries(settings).map(({ key, value }) => [key, value] as [string, SettingRow['value']]))).settings).toEqual(settings)
  })

  it('fall back to the default for a value that does not hold, and say which row', () => {
    const { settings, problems } = parseSettings(
      rows(
        ['hr_birth_year', 'nineteen ninety'],
        ['hr_dependants', -1],
        ['hr_company_registered', '12.05.2025.'],
        ['hr_cit_return', 'cash'],
        ['hr_vat_principle', 'monthly'],
        ['hr_pension_pillar_2', 'perhaps'],
      ),
    )

    expect(settings.companyFacts).toEqual(DEFAULT_SETTINGS.companyFacts)
    expect(problems).toEqual([
      { sheetRow: 2, reason: 'hr_birth_year: use a year of birth such as 1990, so the default is used' },
      { sheetRow: 3, reason: 'hr_dependants: use a whole number from 0 to 20, so the default is used' },
      { sheetRow: 4, reason: 'hr_company_registered: "12.05.2025." is not a date such as 2025-05-12, so the default is used' },
      { sheetRow: 5, reason: 'hr_cit_return: "cash" is neither pd nor pd-nn, so the default is used' },
      { sheetRow: 6, reason: 'hr_vat_principle: "monthly" is neither invoice nor cash, so the default is used' },
      { sheetRow: 7, reason: 'hr_pension_pillar_2: "perhaps" is neither TRUE nor FALSE, so the default is used' },
    ])
  })

  it('are listed in the template with their defaults, a blank birth year and registration day among them', () => {
    expect(settingsTabEntries(DEFAULT_SETTINGS).filter((entry) => entry.key.startsWith('hr_'))).toEqual([
      { key: 'hr_residence_city', value: '' },
      { key: 'hr_birth_year', value: '' },
      { key: 'hr_pension_pillar_2', value: true },
      { key: 'hr_dependants', value: 0 },
      { key: 'hr_company_registered', value: '' },
      { key: 'hr_cit_return', value: 'pd' },
      { key: 'hr_vat_principle', value: 'invoice' },
      { key: 'hr_depreciation_doubled', value: false },
    ])
  })
})

describe('settingsErrors', () => {
  it('finds nothing wrong with the defaults', () => {
    expect(settingsErrors(DEFAULT_SETTINGS)).toEqual({})
  })

  it('names each field the editor must not save', () => {
    const errors = settingsErrors({
      ...DEFAULT_SETTINGS,
      currency: 'EU',
      numberLocale: '??',
      reviewLabel: 'rule',
      bucketLabels: { ...DEFAULT_SETTINGS.bucketLabels, taxes: 'Income', neutral: ' '.trim(), financing: 'Net' },
    })

    expect(Object.keys(errors).sort()).toEqual(['currency', 'financing', 'neutral', 'numberLocale', 'reviewLabel', 'taxes'])
  })

  it('names the company facts the editor must not save', () => {
    const errors = settingsErrors({
      ...DEFAULT_SETTINGS,
      companyFacts: { ...DEFAULT_SETTINGS.companyFacts, residenceCity: 'x'.repeat(61), birthYear: Number.NaN, dependants: 1.5 },
    })

    expect(errors).toEqual({
      residenceCity: 'a city name can be at most 60 characters',
      birthYear: 'use a year of birth such as 1990',
      dependants: 'use a whole number from 0 to 20',
    })
  })
})

describe('profit and loss labels', () => {
  const withoutOwnerPay = { ...DEFAULT_SETTINGS, ownerPayModule: false }

  it('names each line from the bucket labels', () => {
    const settings = { ...DEFAULT_SETTINGS, bucketLabels: { ...DEFAULT_SETTINGS.bucketLabels, operating: 'Running costs' } }

    expect(lineLabel(settings, 'operating')).toBe('Running costs')
    expect(lineLabel(settings, 'net')).toBe('Net')
    expect(costLabelsInSentence(settings)).toBe('running costs, taxes and owner pay')
  })

  it('hides owner pay and owner earns with the module off', () => {
    expect(shownLines(withoutOwnerPay)).toEqual(['income', 'operating', 'taxes', 'cost', 'net'])
    expect(costLabelsInSentence(withoutOwnerPay)).toBe('operating cost and taxes')
  })

  it('keeps an abbreviation as written inside a sentence', () => {
    expect(inSentence('VAT')).toBe('VAT')
    expect(inSentence('Operating cost')).toBe('operating cost')
  })

  it('counts owner-pay rows as operating cost with the module off, so costs and net stay the same', () => {
    const rows = ledger([
      { date: '2026-09-01', amount: 5000, category: 'revenue' },
      { date: '2026-09-02', amount: -300, category: 'travel' },
      { date: '2026-09-03', amount: -1100, category: 'salary-net' },
    ])

    const shown = bucketTotals(presentedTransactions(rows, withoutOwnerPay))
    const kept = bucketTotals(rows)

    expect(shown).toMatchObject({ operating: 140000, ownerPay: 0, cost: kept.cost, net: kept.net })
    expect(presentedTransactions(rows, DEFAULT_SETTINGS)).toBe(rows)
    expect(rows.map((row) => row.bucket)).toContain('owner-pay')
  })
})
