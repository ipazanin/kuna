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
