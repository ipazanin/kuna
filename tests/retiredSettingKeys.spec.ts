import { describe, expect, it } from 'vitest'

import { COMPANY_RETIRED_SETTING_KEYS, SETTING_DEFINITIONS } from '../src/apps/company/settings/domain/settings'
import { INVESTMENT_RETIRED_SETTING_KEYS, INVESTMENT_SETTING_CHECKS } from '../src/apps/investments/workbook/application/settingWrites'
import { SPENDING_RETIRED_SETTING_KEYS, SPENDING_SETTING_CHECKS } from '../src/apps/spending/workbook/domain/readSpendingBook'

/** Every key each app's settings have read. A key goes in when an app first reads it and never leaves, so a key the app stops reading has to be retired. */
const KEYS_EVER_READ: Readonly<Record<string, readonly string[]>> = {
  company: [
    'template_version',
    'company_name',
    'currency',
    'number_locale',
    'label_income',
    'label_operating',
    'label_taxes',
    'label_owner_pay',
    'label_financing',
    'label_neutral',
    'owner_pay_module',
    'review_label',
    'card_settlement_ibans',
    'billing_monthly_amount',
    'billing_monthly_item',
    'billing_subscription_amount',
    'billing_subscription_item',
    'billing_bonus_amount',
    'billing_bonus_item',
    'billing_client',
    'invoice_company_name',
    'invoice_address',
    'invoice_country',
    'invoice_oib',
    'invoice_phone',
    'invoice_mail',
    'invoice_iban',
    'invoice_swift',
    'invoice_bank',
    'invoice_court_register',
    'invoice_share_capital',
    'invoice_place',
    'invoice_issue_time',
    'invoice_signatory',
    'invoice_signatory_title',
    'invoice_number_pattern',
    'invoice_folder_id',
    'invoice_file_path',
    'invoice_mail_subject',
    'invoice_mail_body',
    'invoice_reverse_charge_note',
    'statements_folder',
    'statements_sync',
    'statements_mail_from',
    'statements_mail_subject',
    'mail_since',
    'person_payees',
    'invoice_vat_id',
  ],
  investments: ['surtax_city_2023'],
  spending: [
    'bank_sync_deployment',
    'person_payees',
    'bank_sync_not_in_kuna',
    'bank_sync_keep_mine',
    'bank_link_otp',
    'bank_link_revolut',
    'bank_sync_fetched_otp',
    'bank_sync_fetched_revolut',
    'company_oib',
  ],
}

/** The keys each app reads now and the keys it retired. */
const APPS: Readonly<Record<string, { readonly read: readonly string[]; readonly retired: ReadonlySet<string> }>> = {
  company: { read: SETTING_DEFINITIONS.map((definition) => definition.key), retired: COMPANY_RETIRED_SETTING_KEYS },
  investments: { read: [...INVESTMENT_SETTING_CHECKS.keys()], retired: INVESTMENT_RETIRED_SETTING_KEYS },
  spending: { read: [...SPENDING_SETTING_CHECKS.keys()], retired: SPENDING_RETIRED_SETTING_KEYS },
}

describe("each app's retired setting keys", () => {
  it('lists every key an app reads among the keys it has ever read', () => {
    const unlisted = Object.entries(APPS).flatMap(([app, { read }]) => read.filter((key) => !(KEYS_EVER_READ[app] ?? []).includes(key)).map((key) => `${app}: ${key}`))
    expect(unlisted, 'Add each new key to KEYS_EVER_READ, where it stays once the app stops reading it').toEqual([])
  })

  it('retires every key an app has stopped reading, so an older file that holds it reads without a problem', () => {
    const dropped = Object.entries(APPS).flatMap(([app, { read, retired }]) => (KEYS_EVER_READ[app] ?? []).filter((key) => !read.includes(key) && !retired.has(key)).map((key) => `${app}: ${key}`))
    expect(dropped, 'Add each key the app no longer reads to its retired setting keys').toEqual([])
  })

  it('retires only keys an app once read and reads no more', () => {
    const wrong = Object.entries(APPS).flatMap(([app, { read, retired }]) =>
      [...retired].filter((key) => read.includes(key) || !(KEYS_EVER_READ[app] ?? []).includes(key)).map((key) => `${app}: ${key}`),
    )
    expect(wrong).toEqual([])
  })
})
