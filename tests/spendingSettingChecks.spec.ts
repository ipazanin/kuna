import { describe, expect, it } from 'vitest'

import { oldLinkSettingChecks } from '../src/apps/spending/workbook/domain/bankLinkReading'
import { SPENDING_SETTING_CHECKS } from '../src/apps/spending/workbook/domain/readSpendingBook'
import { spendingSettingChecks } from '../src/apps/spending/workbook/domain/spendingSettings'
import type { SpendingSettingWords } from '../src/apps/spending/workbook/domain/spendingSettings'
import { en, hr } from '../src/apps/spending/workbook/domain/words'

function refusals(said: SpendingSettingWords, key: string, value: string): readonly string[] {
  const check = spendingSettingChecks(said).get(key) ?? oldLinkSettingChecks(said).get(key)
  if (check === undefined) throw new Error(`No check for ${key}`)
  return check(value)
}

const REASONS: readonly { key: string; value: string; en: string; hr: string }[] = [
  {
    key: 'company_roles_not_now',
    value: 'soon',
    en: 'company_roles_not_now "soon" is not a date such as 2027-05-03',
    hr: 'company_roles_not_now „soon” nije datum kao 2027-05-03',
  },
  {
    key: 'company_payments_not_now',
    value: '03.05.2027.',
    en: 'company_payments_not_now "03.05.2027." is not a date such as 2027-05-03',
    hr: 'company_payments_not_now „03.05.2027.” nije datum kao 2027-05-03',
  },
  {
    key: 'bank_link_otp',
    value: 'never',
    en: 'bank_link_otp "never" is not a date such as 2027-05-03',
    hr: 'bank_link_otp „never” nije datum kao 2027-05-03',
  },
  {
    key: 'bank_sync_fetched_revolut',
    value: '2026-11-09 07:40',
    en: 'bank_sync_fetched_revolut "2026-11-09 07:40" is not a UTC time such as 2026-11-09T07:40:00.000Z',
    hr: 'bank_sync_fetched_revolut „2026-11-09 07:40” nije UTC vrijeme kao 2026-11-09T07:40:00.000Z',
  },
  {
    key: 'loan_instalments_not_now',
    value: 'car-loan',
    en: `loan_instalments_not_now line "car-loan" is not a loan's key and a day such as fa4e0000-0000-4000-8000-000000000001 2026-10-20`,
    hr: 'loan_instalments_not_now redak „car-loan” nije ključ kredita i dan kao fa4e0000-0000-4000-8000-000000000001 2026-10-20',
  },
  {
    key: 'bank_sync_not_in_kuna',
    value: 'Revolut dollars',
    en: 'bank_sync_not_in_kuna line "Revolut dollars" is not an IBAN and a currency such as LT000000000000000001 USD',
    hr: 'bank_sync_not_in_kuna redak „Revolut dollars” nije IBAN i valuta kao LT000000000000000001 USD',
  },
  {
    key: 'bank_sync_keep_mine',
    value: 'LT000000000000000003',
    en: 'bank_sync_keep_mine line "LT000000000000000003" is not an IBAN and a currency such as LT000000000000000001 USD',
    hr: 'bank_sync_keep_mine redak „LT000000000000000003” nije IBAN i valuta kao LT000000000000000001 USD',
  },
]

describe("Spending's setting checks", () => {
  it.each(REASONS)('words a refused $key value in English', ({ key, value, en: sentence }) => {
    expect(refusals(en, key, value)).toEqual([sentence])
  })

  it.each(REASONS)('words a refused $key value in Croatian', ({ key, value, hr: sentence }) => {
    expect(refusals(hr, key, value)).toEqual([sentence])
  })

  it('refuses each bad line of a lines setting on its own and keeps the good ones', () => {
    expect(refusals(en, 'loan_instalments_not_now', 'fa4e0000-0000-4000-8000-000000000001 2026-10-20\n\nfirst\nsecond')).toEqual([
      `loan_instalments_not_now line "first" is not a loan's key and a day such as fa4e0000-0000-4000-8000-000000000001 2026-10-20`,
      `loan_instalments_not_now line "second" is not a loan's key and a day such as fa4e0000-0000-4000-8000-000000000001 2026-10-20`,
    ])
  })

  it('takes a day, a UTC time and the application id as they should read', () => {
    expect(refusals(en, 'company_roles_not_now', '2027-05-03')).toEqual([])
    expect(refusals(en, 'bank_link_revolut', '2027-05-03')).toEqual([])
    expect(refusals(en, 'bank_sync_fetched_otp', '2026-11-09T07:40:00.000Z')).toEqual([])
    expect(refusals(en, 'bank_sync_application', 'anything at all')).toEqual([])
  })

  it('checks every key Spending reads and every old link key, and no other', () => {
    expect([...SPENDING_SETTING_CHECKS.keys()].sort()).toEqual(
      [
        'bank_link_otp',
        'bank_link_revolut',
        'bank_sync_application',
        'bank_sync_fetched_otp',
        'bank_sync_fetched_revolut',
        'bank_sync_keep_mine',
        'bank_sync_not_in_kuna',
        'company_payments_not_now',
        'company_roles_not_now',
        'loan_instalments_not_now',
      ].sort(),
    )
  })
})
