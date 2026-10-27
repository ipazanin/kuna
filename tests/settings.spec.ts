import { describe, expect, it } from 'vitest'

import {
  DEFAULT_SETTINGS,
  SETTING_DEFINITIONS,
  changedPackSettings,
  parseSettings,
  readPackSettings,
  settingCodec,
  settingsErrors,
  settingsTabEntries,
} from '../src/features/settings/domain/settings'
import type { PackSettings, SettingRow } from '../src/features/settings/domain/settings'
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
import { storedFieldOf } from '../src/features/workbook/domain/storedFields'
import { COMPANY_FACT_SETTINGS, companyFactsErrors } from '../src/packs/hr-doo/domain/companyFacts'

/** A cell of the value column, undefined for a blank one. */
type Cell = string | number | boolean | undefined

const SETTINGS = settingCodec(() => COMPANY_FACT_SETTINGS as PackSettings<unknown>)

/** The settings rows a tab of these cells holds, each value typed by its key as reading the workbook types it. */
function rows(...entries: [string, Cell][]): SettingRow[] {
  return entries.map(([key, value]) => SETTINGS.make(value === undefined ? { key: storedFieldOf(key) } : { key: storedFieldOf(key), value: storedFieldOf(value) }, null))
}

function settingProblem(key: string, reason: string) {
  return { id: recordIdOf(SETTING_RECORDS, key), label: key, reason }
}

describe('parseSettings', () => {
  it('gives the defaults, which are how the app behaved before settings, for an empty tab', () => {
    expect(parseSettings([])).toEqual({ settings: DEFAULT_SETTINGS, problems: [] })
    expect(DEFAULT_SETTINGS).toMatchObject({ currency: 'EUR', numberLocale: 'en-GB', ownerPayModule: false })
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
    expect(parseSettings(rows(...settingsTabEntries(settings, null).map(({ key, value }) => [key, value] as [string, Cell]))).settings).toEqual(settings)
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

describe('statements_folder', () => {
  it('reads a path from My Drive as folder names, without blank ones, and writes it back with slashes', () => {
    const { settings, problems } = parseSettings(rows(['statements_folder', ' /finance / bank statements//erste/ ']))

    expect(problems).toEqual([])
    expect(settings.statementsFolder).toEqual(['finance', 'bank statements', 'erste'])
    expect(settingsTabEntries(settings, null)).toContainEqual({ key: 'statements_folder', value: 'finance/bank statements/erste' })
    expect(parseSettings(rows(...settingsTabEntries(settings, null).map(({ key, value }) => [key, value] as [string, Cell]))).settings).toEqual(settings)
  })

  it('reads a path from the folder of the books file after ./, as onboarding writes it for statements from mail', () => {
    const { settings, problems } = parseSettings(rows(['statements_folder', './statements']))

    expect(problems).toEqual([])
    expect(settings.statementsFolder).toEqual(['.', 'statements'])
    expect(settingsTabEntries(settings, null)).toContainEqual({ key: 'statements_folder', value: './statements' })
  })

  it('reports a path that names no folder, or holds . after its start, and keeps the default', () => {
    for (const [value, reason] of [
      [' / ', '"/" names no folder'],
      ['./', '"./" names no folder'],
      ['finance/./statements', '"finance/./statements" holds . after its start, where it names no folder'],
    ] as const) {
      const { settings, problems } = parseSettings(rows(['statements_folder', value]))

      expect(settings.statementsFolder).toEqual(DEFAULT_SETTINGS.statementsFolder)
      expect(problems).toEqual([settingProblem('statements_folder', `${reason}, so the default is used`)])
    }
  })

  it('names no folder by default, so statements come in through Import, and is listed blank in the template', () => {
    expect(DEFAULT_SETTINGS.statementsFolder).toEqual([])
    expect(parseSettings(rows(['statements_folder', ' '])).settings.statementsFolder).toEqual([])
    expect(settingsTabEntries(DEFAULT_SETTINGS, null)).toContainEqual({ key: 'statements_folder', value: '' })
  })

  it('files statements on sync by default, and a FALSE switch leaves them to Import', () => {
    expect(DEFAULT_SETTINGS.statementsSync).toBe(true)
    expect(parseSettings(rows(['statements_sync', false])).settings.statementsSync).toBe(false)
    expect(settingsTabEntries(DEFAULT_SETTINGS, null)).toContainEqual({ key: 'statements_sync', value: 'TRUE' })
  })

  it('may be left blank when typed in the app', () => {
    expect(settingsErrors({ ...DEFAULT_SETTINGS, statementsFolder: [] })).toEqual({})
  })
})

describe('the mail keys', () => {
  it('read no bank mail and the start of this year by default, all listed blank in the template', () => {
    expect(DEFAULT_SETTINGS).toMatchObject({ statementsMailFrom: [], statementsMailSubject: '', mailSince: null })
    expect(settingsTabEntries(DEFAULT_SETTINGS, null).filter((entry) => ['statements_mail_from', 'statements_mail_subject', 'mail_since'].includes(entry.key))).toEqual([
      { key: 'statements_mail_from', value: '' },
      { key: 'statements_mail_subject', value: '' },
      { key: 'mail_since', value: '' },
    ])
  })

  it('read the senders as lower-case addresses, the subject trimmed and the day from a date cell or text, and write them back the same way', () => {
    const { settings, problems } = parseSettings(rows(['statements_mail_from', 'Statements@Bank.example.com, notices@bank.example.com'], ['statements_mail_subject', ' Izvadak '], ['mail_since', 45658]))

    expect(problems).toEqual([])
    expect(settings).toMatchObject({ statementsMailFrom: ['statements@bank.example.com', 'notices@bank.example.com'], statementsMailSubject: 'Izvadak', mailSince: '2025-01-01' })
    expect(parseSettings(rows(...settingsTabEntries(settings, null).map(({ key, value }) => [key, value] as [string, Cell]))).settings).toEqual(settings)
  })

  it('fall back for an address that is not one, a subject with a double quote and a day that is not one, and say which key', () => {
    const { settings, problems } = parseSettings(rows(['statements_mail_from', 'bank'], ['statements_mail_subject', '"Izvadak"'], ['mail_since', '1.1.2025.']))

    expect(settings).toMatchObject({ statementsMailFrom: [], statementsMailSubject: '', mailSince: null })
    expect(problems).toEqual([
      settingProblem('statements_mail_from', '"bank" is not a mail address, so the default is used'),
      settingProblem('statements_mail_subject', 'a subject cannot hold a double quote, which would end the phrase Gmail searches for, so the default is used'),
      settingProblem('mail_since', '"1.1.2025." is not a date such as 2026-01-01, so the default is used'),
    ])
  })

  it('need a subject with a sender when typed in the app, so other mail from the bank is left alone', () => {
    expect(settingsErrors({ ...DEFAULT_SETTINGS, statementsMailFrom: ['statements@bank.example.com'] })).toEqual({
      statementsMailSubject: 'name the words before the statement number in the subject, so other mail from the bank is left alone',
    })
    expect(settingsErrors({ ...DEFAULT_SETTINGS, statementsMailFrom: ['statements@bank.example.com'], statementsMailSubject: 'Izvadak' })).toEqual({})
  })
})

describe('company facts', () => {
  it('default to no registration day, the accrual return, the invoice principle, owner loans at 0%, no accountant folders and their read on sync, and no accountant mail', () => {
    expect(COMPANY_FACT_SETTINGS.defaults).toEqual({
      companyRegistered: null,
      citReturn: 'pd',
      vatPrinciple: 'invoice',
      depreciationDoubled: false,
      ownerLoanInterest: 0,
      vatReturnsFolder: [],
      payrollFolder: [],
      accountantSync: true,
      accountantMailFrom: [],
      payrollMailSubject: '',
      vatMailSubject: '',
      invoicesMailSubject: '',
      incomingInvoicesFolder: [],
    })
  })

  it('read every key, a registration day from a date cell or from text, and write them back the same way', () => {
    const { values, problems } = readPackSettings(
      rows(
        ['hr_company_registered', 45789],
        ['hr_cit_return', 'PD-NN'],
        ['hr_vat_principle', 'cash'],
        ['hr_depreciation_doubled', 'TRUE'],
        ['hr_owner_loan_interest', 0.025],
        ['hr_vat_returns_folder', ' finance / vat '],
        ['hr_payroll_folder', 'finance/payroll/'],
        ['hr_accountant_sync', false],
        ['hr_accountant_mail_from', 'Office@Accountant.example.com, desk@accountant.example.com'],
        ['hr_payroll_mail_subject', ' Plaća za '],
        ['hr_vat_mail_subject', 'PDV za'],
        ['hr_invoices_mail_subject', 'Račun za'],
        ['hr_incoming_invoices_folder', 'finance/incoming-invoices'],
      ),
      COMPANY_FACT_SETTINGS,
    )

    expect(problems).toEqual([])
    expect(values).toEqual({
      companyRegistered: '2025-05-12',
      citReturn: 'pd-nn',
      vatPrinciple: 'cash',
      depreciationDoubled: true,
      ownerLoanInterest: 250,
      vatReturnsFolder: ['finance', 'vat'],
      payrollFolder: ['finance', 'payroll'],
      accountantSync: false,
      accountantMailFrom: ['office@accountant.example.com', 'desk@accountant.example.com'],
      payrollMailSubject: 'Plaća za',
      vatMailSubject: 'PDV za',
      invoicesMailSubject: 'Račun za',
      incomingInvoicesFolder: ['finance', 'incoming-invoices'],
    })
    expect(readPackSettings(rows(['hr_company_registered', '2025-05-12']), COMPANY_FACT_SETTINGS).values.companyRegistered).toBe('2025-05-12')
    const written = settingsTabEntries(DEFAULT_SETTINGS, { settings: COMPANY_FACT_SETTINGS, values })
    expect(readPackSettings(rows(...written.map(({ key, value }) => [key, value] as [string, Cell])), COMPANY_FACT_SETTINGS).values).toEqual(values)
  })

  it('are stored typed by their key: a date cell as its day, a flag the app wrote as a flag, and anything else as text', () => {
    expect(rows(['hr_company_registered', 45789], ['hr_depreciation_doubled', false], ['hr_owner_loan_interest', 0.02])).toEqual([
      { key: 'hr_company_registered', value: '2025-05-12' },
      { key: 'hr_depreciation_doubled', value: 'FALSE' },
      { key: 'hr_owner_loan_interest', value: '0.02' },
    ])
    expect(SETTINGS.fieldsOf({ key: 'hr_depreciation_doubled', value: 'TRUE' })).toEqual({ key: 'hr_depreciation_doubled', value: true })
    expect(SETTINGS.fieldsOf({ key: 'hr_depreciation_doubled', value: 'yes' })).toEqual({ key: 'hr_depreciation_doubled', value: 'yes' })
    expect(SETTINGS.fieldsOf({ key: 'company_name', value: 'TRUE' })).toEqual({ key: 'company_name', value: 'TRUE' })
    expect(SETTINGS.fieldsOf({ key: 'hr_company_registered', value: '' })).toEqual({ key: 'hr_company_registered' })
  })

  it('are left to the pack by the core parser, which neither reads nor reports them', () => {
    const packKeys = new Set(COMPANY_FACT_SETTINGS.definitions.map((definition) => definition.key))

    expect(parseSettings(rows(['hr_cit_return', 'pd'], ['hr_company_registered', 'unknown']), packKeys)).toEqual({ settings: DEFAULT_SETTINGS, problems: [] })
    expect(parseSettings(rows(['hr_cit_return', 'pd'])).problems).toEqual([settingProblem('hr_cit_return', 'not a setting this app knows, so it is kept but not used')])
  })

  it('report the owner keys that the director row on the employees tab holds as keys the app does not know', () => {
    const packKeys = new Set(COMPANY_FACT_SETTINGS.definitions.map((definition) => definition.key))

    expect(parseSettings(rows(['hr_residence_city', 'Zagreb'], ['hr_birth_year', 1990], ['hr_pension_pillar_2', true], ['hr_dependants', 0]), packKeys).problems.map((problem) => problem.label)).toEqual([
      'hr_residence_city',
      'hr_birth_year',
      'hr_pension_pillar_2',
      'hr_dependants',
    ])
  })

  it('turn the accountant read on or off by its switch, on by default', () => {
    expect(COMPANY_FACT_SETTINGS.defaults.accountantSync).toBe(true)
    expect(readPackSettings(rows(['hr_accountant_sync', false]), COMPANY_FACT_SETTINGS).values.accountantSync).toBe(false)
    expect(readPackSettings(rows(['hr_accountant_sync', 'maybe']), COMPANY_FACT_SETTINGS).problems).toEqual([settingProblem('hr_accountant_sync', '"maybe" is neither TRUE nor FALSE, so the default is used')])
  })

  it('change only the keys whose value differs, in template order', () => {
    const before = COMPANY_FACT_SETTINGS.defaults

    expect(changedPackSettings(COMPANY_FACT_SETTINGS, before, { ...before, ownerLoanInterest: 200, citReturn: 'pd-nn' })).toEqual([
      { key: 'hr_cit_return', value: 'pd-nn' },
      { key: 'hr_owner_loan_interest', value: '0.02' },
    ])
  })

  it('fall back to the default for a value that does not hold, and say which key', () => {
    const { values, problems } = readPackSettings(
      rows(
        ['hr_company_registered', '12.05.2025.'],
        ['hr_cit_return', 'cash'],
        ['hr_vat_principle', 'monthly'],
        ['hr_depreciation_doubled', 'perhaps'],
        ['hr_payroll_folder', ' / '],
      ),
      COMPANY_FACT_SETTINGS,
    )

    expect(values).toEqual(COMPANY_FACT_SETTINGS.defaults)
    expect(problems).toEqual([
      settingProblem('hr_company_registered', '"12.05.2025." is not a date such as 2025-05-12, so the default is used'),
      settingProblem('hr_cit_return', '"cash" is neither pd nor pd-nn, so the default is used'),
      settingProblem('hr_vat_principle', '"monthly" is neither invoice nor cash, so the default is used'),
      settingProblem('hr_depreciation_doubled', '"perhaps" is neither TRUE nor FALSE, so the default is used'),
      settingProblem('hr_payroll_folder', '"/" names no folder, so the default is used'),
    ])
    expect(companyFactsErrors({ ...COMPANY_FACT_SETTINGS.defaults, vatReturnsFolder: [] })).toEqual({})
  })

  it('read the owner loan interest as a percentage cell or as a percent typed as text', () => {
    const rate = (cell: Cell) => readPackSettings(rows(['hr_owner_loan_interest', cell]), COMPANY_FACT_SETTINGS)
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

  it('are listed in the template with their defaults, a blank registration day among them', () => {
    expect(settingsTabEntries(DEFAULT_SETTINGS, { settings: COMPANY_FACT_SETTINGS, values: COMPANY_FACT_SETTINGS.defaults }).filter((entry) => entry.key.startsWith('hr_'))).toEqual([
      { key: 'hr_company_registered', value: '' },
      { key: 'hr_cit_return', value: 'pd' },
      { key: 'hr_vat_principle', value: 'invoice' },
      { key: 'hr_depreciation_doubled', value: 'FALSE' },
      { key: 'hr_owner_loan_interest', value: '0' },
      { key: 'hr_vat_returns_folder', value: '' },
      { key: 'hr_payroll_folder', value: '' },
      { key: 'hr_accountant_sync', value: 'TRUE' },
      { key: 'hr_accountant_mail_from', value: '' },
      { key: 'hr_payroll_mail_subject', value: '' },
      { key: 'hr_vat_mail_subject', value: '' },
      { key: 'hr_invoices_mail_subject', value: '' },
      { key: 'hr_incoming_invoices_folder', value: '' },
    ])
  })

  it('refuse an accountant address that is not one and a subject with a double quote, in the tab and in the app', () => {
    const { values, problems } = readPackSettings(rows(['hr_accountant_mail_from', 'accountant.example.com'], ['hr_vat_mail_subject', 'PDV "za"']), COMPANY_FACT_SETTINGS)

    expect(values).toEqual(COMPANY_FACT_SETTINGS.defaults)
    expect(problems).toEqual([
      settingProblem('hr_accountant_mail_from', '"accountant.example.com" is not a mail address, so the default is used'),
      settingProblem('hr_vat_mail_subject', 'a subject cannot hold a double quote, which would end the phrase Gmail searches for, so the default is used'),
    ])
    expect(companyFactsErrors({ ...COMPANY_FACT_SETTINGS.defaults, accountantMailFrom: ['accountant'], payrollMailSubject: 'Plaća "za"' })).toEqual({
      accountantMailFrom: '"accountant" is not a mail address',
      payrollMailSubject: 'a subject cannot hold a double quote, which would end the phrase Gmail searches for',
    })
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
    expect(parseSettings(rows(...settingsTabEntries(settings, null).map(({ key, value }) => [key, value] as [string, Cell]))).settings).toEqual(settings)
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
    const errors = companyFactsErrors({ ...COMPANY_FACT_SETTINGS.defaults, ownerLoanInterest: 1.5, payrollFolder: [] })

    expect(errors).toEqual({ ownerLoanInterest: 'use a rate from 0% to 100% with at most two decimals, such as 2%' })
  })
})

describe('profit and loss labels', () => {
  const withoutOwnerPay = DEFAULT_SETTINGS
  const withOwnerPay = { ...DEFAULT_SETTINGS, ownerPayModule: true }

  it('names each line from the bucket labels', () => {
    const settings = { ...withOwnerPay, bucketLabels: { ...DEFAULT_SETTINGS.bucketLabels, operating: 'Running costs' } }

    expect(lineLabel(settings, 'operating')).toBe('Running costs')
    expect(lineLabel(settings, 'net')).toBe('Net')
    expect(costLabelsInSentence(settings)).toBe('running costs, taxes and owner pay')
  })

  it('hides owner pay and owner earns with the module off, as by default', () => {
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
    expect(presentedTransactions(rows, withOwnerPay)).toBe(rows)
    expect(rows.map((row) => row.bucket)).toContain('owner-pay')
  })
})
