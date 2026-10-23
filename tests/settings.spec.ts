import { describe, expect, it } from 'vitest'

import {
  DEFAULT_SETTINGS,
  SETTING_DEFINITIONS,
  changedPackSettings,
  parseSettings,
  readPackSettings,
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
import { euros, ledger } from './fixtures/ledger'
import { recordIdOf } from '../src/features/workbook/domain/recordId'
import { SETTING_RECORDS } from '../src/features/workbook/domain/recordKind'
import { COMPANY_FACT_SETTINGS, companyFactsErrors } from '../src/packs/hr-doo/domain/companyFacts'

function rows(...entries: [string, SettingRow['value']][]): SettingRow[] {
  return entries.map(([key, value]) => ({ key, value }))
}

function settingProblem(key: string, reason: string) {
  return { id: recordIdOf(SETTING_RECORDS, key), label: key, reason }
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

  it('falls back to the default for a value that does not hold, and says which key', () => {
    const { settings, problems } = parseSettings(
      rows(['currency', 'EURO'], ['currency', 'USD'], ['number_locale', 'not a locale!'], ['owner_pay_module', 'maybe'], ['review_label', 'ai']),
    )

    expect(settings).toEqual(DEFAULT_SETTINGS)
    expect(problems.map((problem) => problem.label)).toEqual(['currency', 'currency', 'number_locale', 'owner_pay_module', 'review_label'])
    expect(problems.slice(0, 2).map((problem) => problem.reason)).toEqual([
      'set on more than one row, so the default is used',
      'set on more than one row, so the default is used',
    ])
  })

  it('offers no import profile whose key is set on more than one row', () => {
    const { settings, problems } = parseSettings(rows(['import_profile_bank', 'account=main; date=1; amount=2'], ['import_profile_bank', 'account=main; date=1; amount=3']))

    expect(settings.importProfiles).toEqual([])
    expect(problems.map((problem) => [problem.label, problem.reason])).toEqual([
      ['import_profile_bank', 'set on more than one row, so the profile is not offered'],
      ['import_profile_bank', 'set on more than one row, so the profile is not offered'],
    ])
  })

  it('refuses a currency the cents arithmetic cannot hold', () => {
    const { settings, problems } = parseSettings(rows(['currency', 'KWD']))

    expect(settings.currency).toBe('EUR')
    expect(problems[0]?.reason).toMatch(/3 decimals/)
  })

  it('keeps an unknown key out of the settings and reports it', () => {
    expect(parseSettings(rows(['theme', 'dark'])).problems).toEqual([
      settingProblem('theme', 'not a setting this app knows, so it is kept but not used'),
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
    const written = settingsTabEntries(custom, null)

    expect(parseSettings(written)).toEqual({ settings: custom, problems: [] })
    expect(written.map((entry) => entry.key)).toEqual(SETTING_DEFINITIONS.map((definition) => definition.key))
  })
})

describe('card_settlement_ibans', () => {
  it('reads a comma-separated list of IBANs, normalised, and writes it back the same way', () => {
    const { settings, problems } = parseSettings(rows(['card_settlement_ibans', 'xx66 fake 0000 0000 99, , XX93FAKE0000000098']))

    expect(problems).toEqual([])
    expect(settings.cardSettlementIbans).toEqual(['XX66FAKE0000000099', 'XX93FAKE0000000098'])
    expect(parseSettings(rows(...settingsTabEntries(settings, null).map(({ key, value }) => [key, value] as [string, SettingRow['value']]))).settings).toEqual(settings)
  })

  it('reports an entry that is not an IBAN, or whose check digits do not hold, and keeps the default', () => {
    const { settings, problems } = parseSettings(rows(['card_settlement_ibans', 'XX66FAKE0000000099, card account, XX00FAKE0000000098']))

    expect(settings.cardSettlementIbans).toEqual([])
    expect(problems).toEqual([settingProblem('card_settlement_ibans', '"CARDACCOUNT", "XX00FAKE0000000098" are not IBANs, so the default is used')])
    expect(settingsErrors({ ...DEFAULT_SETTINGS, cardSettlementIbans: ['NOPE'] }).cardSettlementIbans).toBe('"NOPE" is not an IBAN')
  })

  it('is empty by default and listed in the template', () => {
    expect(DEFAULT_SETTINGS.cardSettlementIbans).toEqual([])
    expect(settingsTabEntries(DEFAULT_SETTINGS, null)).toContainEqual({ key: 'card_settlement_ibans', value: '' })
  })
})

describe('company facts', () => {
  it('default to no city, no birth year, the second pillar, no dependants, the accrual return, the invoice principle and owner loans at 0%', () => {
    expect(COMPANY_FACT_SETTINGS.defaults).toEqual({
      residenceCity: '',
      birthYear: null,
      pensionPillarTwo: true,
      dependants: 0,
      companyRegistered: null,
      citReturn: 'pd',
      vatPrinciple: 'invoice',
      depreciationDoubled: false,
      ownerLoanInterest: 0,
    })
  })

  it('read every key, a registration day from a date cell or from text, and write them back the same way', () => {
    const { values, problems } = readPackSettings(
      rows(
        ['hr_residence_city', ' Zagreb '],
        ['hr_birth_year', '1990'],
        ['hr_pension_pillar_2', false],
        ['hr_dependants', 2],
        ['hr_company_registered', 45789],
        ['hr_cit_return', 'PD-NN'],
        ['hr_vat_principle', 'cash'],
        ['hr_depreciation_doubled', 'TRUE'],
        ['hr_owner_loan_interest', 0.025],
      ),
      COMPANY_FACT_SETTINGS,
    )

    expect(problems).toEqual([])
    expect(values).toEqual({
      residenceCity: 'Zagreb',
      birthYear: 1990,
      pensionPillarTwo: false,
      dependants: 2,
      companyRegistered: '2025-05-12',
      citReturn: 'pd-nn',
      vatPrinciple: 'cash',
      depreciationDoubled: true,
      ownerLoanInterest: 250,
    })
    expect(readPackSettings(rows(['hr_company_registered', '2025-05-12']), COMPANY_FACT_SETTINGS).values.companyRegistered).toBe('2025-05-12')
    const written = settingsTabEntries(DEFAULT_SETTINGS, { settings: COMPANY_FACT_SETTINGS, values })
    expect(readPackSettings(rows(...written.map(({ key, value }) => [key, value] as [string, SettingRow['value']])), COMPANY_FACT_SETTINGS).values).toEqual(values)
  })

  it('are left to the pack by the core parser, which neither reads nor reports them', () => {
    const packKeys = new Set(COMPANY_FACT_SETTINGS.definitions.map((definition) => definition.key))

    expect(parseSettings(rows(['hr_residence_city', 'Zagreb'], ['hr_birth_year', 'unknown']), packKeys)).toEqual({ settings: DEFAULT_SETTINGS, problems: [] })
    expect(parseSettings(rows(['hr_residence_city', 'Zagreb'])).problems).toEqual([settingProblem('hr_residence_city', 'not a setting this app knows, so it is kept but not used')])
  })

  it('change only the keys whose value differs, in template order', () => {
    const before = COMPANY_FACT_SETTINGS.defaults

    expect(changedPackSettings(COMPANY_FACT_SETTINGS, before, { ...before, ownerLoanInterest: 200, residenceCity: 'Zagreb' })).toEqual([
      { key: 'hr_residence_city', value: 'Zagreb' },
      { key: 'hr_owner_loan_interest', value: 0.02 },
    ])
  })

  it('fall back to the default for a value that does not hold, and say which key', () => {
    const { values, problems } = readPackSettings(
      rows(
        ['hr_birth_year', 'nineteen ninety'],
        ['hr_dependants', -1],
        ['hr_company_registered', '12.05.2025.'],
        ['hr_cit_return', 'cash'],
        ['hr_vat_principle', 'monthly'],
        ['hr_pension_pillar_2', 'perhaps'],
      ),
      COMPANY_FACT_SETTINGS,
    )

    expect(values).toEqual(COMPANY_FACT_SETTINGS.defaults)
    expect(problems).toEqual([
      settingProblem('hr_birth_year', 'use a year of birth such as 1990, so the default is used'),
      settingProblem('hr_dependants', 'use a whole number from 0 to 20, so the default is used'),
      settingProblem('hr_company_registered', '"12.05.2025." is not a date such as 2025-05-12, so the default is used'),
      settingProblem('hr_cit_return', '"cash" is neither pd nor pd-nn, so the default is used'),
      settingProblem('hr_vat_principle', '"monthly" is neither invoice nor cash, so the default is used'),
      settingProblem('hr_pension_pillar_2', '"perhaps" is neither TRUE nor FALSE, so the default is used'),
    ])
  })

  it('read the owner loan interest as a percentage cell or as a percent typed as text', () => {
    const rate = (cell: SettingRow['value']) => readPackSettings(rows(['hr_owner_loan_interest', cell]), COMPANY_FACT_SETTINGS)
    expect(rate(0.02).values.ownerLoanInterest).toBe(200)
    expect(rate('2%').values.ownerLoanInterest).toBe(200)
    expect(rate('2,5 %').values.ownerLoanInterest).toBe(250)
    expect(rate('0.0265').values.ownerLoanInterest).toBe(265)
    expect(rate(0).values.ownerLoanInterest).toBe(0)
    expect(rate(2).problems).toEqual([
      settingProblem('hr_owner_loan_interest', '2 reads as 200%. Enter the rate as a percentage cell, such as 2%, so the default is used'),
    ])
    expect(rate('two').problems[0]?.reason).toBe('"two" is not a rate such as 2%, so the default is used')
    expect(rate(-0.01).problems[0]?.reason).toBe('use a rate from 0% to 100% with at most two decimals, such as 2%, so the default is used')
    expect(rate('2.345%').problems[0]?.reason).toBe('use a rate from 0% to 100% with at most two decimals, such as 2%, so the default is used')
    expect(companyFactsErrors({ ...COMPANY_FACT_SETTINGS.defaults, ownerLoanInterest: Number.NaN }).ownerLoanInterest).toBe(
      'use a rate from 0% to 100% with at most two decimals, such as 2%',
    )
  })

  it('are listed in the template with their defaults, a blank birth year and registration day among them', () => {
    expect(settingsTabEntries(DEFAULT_SETTINGS, { settings: COMPANY_FACT_SETTINGS, values: COMPANY_FACT_SETTINGS.defaults }).filter((entry) => entry.key.startsWith('hr_'))).toEqual([
      { key: 'hr_residence_city', value: '' },
      { key: 'hr_birth_year', value: '' },
      { key: 'hr_pension_pillar_2', value: true },
      { key: 'hr_dependants', value: 0 },
      { key: 'hr_company_registered', value: '' },
      { key: 'hr_cit_return', value: 'pd' },
      { key: 'hr_vat_principle', value: 'invoice' },
      { key: 'hr_depreciation_doubled', value: false },
      { key: 'hr_owner_loan_interest', value: 0 },
    ])
  })
})

describe('billing terms', () => {
  it('default to blank, so the billing plan fills nothing until they are set', () => {
    expect(DEFAULT_SETTINGS.billing).toEqual({
      monthlyAmount: null,
      monthlyItem: '',
      subscriptionAmount: null,
      subscriptionItem: '',
      bonusAmount: null,
      bonusItem: '',
      client: '',
    })
    expect(settingsTabEntries(DEFAULT_SETTINGS, null).filter((entry) => entry.key.startsWith('billing_'))).toEqual([
      { key: 'billing_monthly_amount', value: '' },
      { key: 'billing_monthly_item', value: '' },
      { key: 'billing_subscription_amount', value: '' },
      { key: 'billing_subscription_item', value: '' },
      { key: 'billing_bonus_amount', value: '' },
      { key: 'billing_bonus_item', value: '' },
      { key: 'billing_client', value: '' },
    ])
  })

  it('read amounts in cents from a number or text, items as written and the client in lower case, and write them back the same way', () => {
    const { settings, problems } = parseSettings(
      rows(
        ['billing_monthly_amount', 5000],
        ['billing_monthly_item', ' Monthly Fee '],
        ['billing_subscription_amount', '199.99'],
        ['billing_subscription_item', 'Subscription'],
        ['billing_bonus_amount', 8000],
        ['billing_bonus_item', 'Bonus'],
        ['billing_client', 'North'],
      ),
    )

    expect(problems).toEqual([])
    expect(settings.billing).toEqual({
      monthlyAmount: 500000,
      monthlyItem: 'Monthly Fee',
      subscriptionAmount: 19999,
      subscriptionItem: 'Subscription',
      bonusAmount: 800000,
      bonusItem: 'Bonus',
      client: 'north',
    })
    expect(parseSettings(rows(...settingsTabEntries(settings, null).map(({ key, value }) => [key, value] as [string, SettingRow['value']]))).settings).toEqual(settings)
  })

  it('fall back to blank for an amount that is not above zero, and say which key', () => {
    const { settings, problems } = parseSettings(rows(['billing_monthly_amount', 'a lot'], ['billing_bonus_amount', -10], ['billing_monthly_item', 'x'.repeat(61)]))

    expect(settings.billing).toEqual(DEFAULT_SETTINGS.billing)
    expect(problems).toEqual([
      settingProblem('billing_monthly_amount', 'use an amount above zero, such as 7200, so the default is used'),
      settingProblem('billing_bonus_amount', 'use an amount above zero, such as 7200, so the default is used'),
      settingProblem('billing_monthly_item', 'an item can be at most 60 characters, so the default is used'),
    ])
  })

  it('need an item beside each amount before the editor saves them', () => {
    const errors = settingsErrors({ ...DEFAULT_SETTINGS, billing: { ...DEFAULT_SETTINGS.billing, monthlyAmount: euros(5000), bonusItem: 'Bonus', subscriptionAmount: euros(-0.01) } })

    expect(errors).toEqual({
      monthlyItem: 'name the item its rows carry on the outgoing-plan tab',
      subscriptionAmount: 'use an amount above zero, such as 7200',
      subscriptionItem: 'name the item its rows carry on the outgoing-plan tab',
    })
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
    const errors = companyFactsErrors({ ...COMPANY_FACT_SETTINGS.defaults, residenceCity: 'x'.repeat(61), birthYear: Number.NaN, dependants: 1.5 })

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
