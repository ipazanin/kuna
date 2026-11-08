import { words as importWords } from '../../imports/presentation/words'
import { IMPORT_PROFILE_PREFIX } from '../../imports/domain/importProfile'
import { words as invoicingWords } from '../../invoicing/presentation/words'
import { words as mailWords } from '../../mail/presentation/words'
import { DEFAULT_BUCKET_LABELS, bucketLabelKey } from '../../settings/domain/settings'
import type { InvoicingField } from '../../settings/domain/settings'
import { words as settingsWords } from '../../settings/presentation/words'
import { BUCKETS } from '../../workbook/domain/bucket'

const INVOICING_FIELDS: Readonly<Record<string, InvoicingField>> = {
  invoice_company_name: 'name',
  invoice_address: 'address',
  invoice_country: 'country',
  invoice_vat_id: 'vatId',
  invoice_phone: 'phone',
  invoice_mail: 'mail',
  invoice_iban: 'iban',
  invoice_swift: 'swift',
  invoice_bank: 'bank',
  invoice_court_register: 'courtRegister',
  invoice_share_capital: 'shareCapital',
  invoice_place: 'place',
  invoice_issue_time: 'issueTime',
  invoice_signatory: 'signatory',
  invoice_signatory_title: 'signatoryTitle',
  invoice_number_pattern: 'numberPattern',
  invoice_folder_id: 'folderId',
  invoice_file_path: 'filePath',
  invoice_mail_subject: 'mailSubject',
  invoice_mail_body: 'mailBody',
  invoice_reverse_charge_note: 'reverseChargeNote',
}

/** Each core setting by the name its form shows, so a card names a setting as the screen does. */
function coreSettingNames(): Readonly<Record<string, string>> {
  const { general } = settingsWords
  const { terms } = invoicingWords
  return {
    company_name: general.companyName,
    currency: general.currency,
    number_locale: general.numberLocale,
    owner_pay_module: general.ownerPay,
    review_label: general.reviewLabel,
    card_settlement_ibans: general.cardIbans,
    statements_folder: general.statementsFolder,
    statements_sync: general.statementsSync,
    statements_mail_from: mailWords.card.senders,
    statements_mail_subject: mailWords.card.subject,
    mail_since: mailWords.card.since,
    billing_monthly_amount: terms.monthlyFee,
    billing_monthly_item: terms.item(terms.monthlyFee),
    billing_subscription_amount: terms.subscriptions,
    billing_subscription_item: terms.item(terms.subscriptions),
    billing_bonus_amount: terms.bonus,
    billing_bonus_item: terms.item(terms.bonus),
    billing_client: terms.client,
    ...Object.fromEntries(Object.entries(INVOICING_FIELDS).map(([key, field]) => [key, terms.fields[field].label])),
    ...Object.fromEntries(BUCKETS.map((bucket) => [bucketLabelKey(bucket), `${general.bucketLabels}, ${DEFAULT_BUCKET_LABELS[bucket]}`])),
  }
}

/**
 * A setting by the name its screen shows, core's or the pack's. An import profile reads as the Import tab names it. A key no
 * screen names, such as one nothing in Kuna reads, stays as the settings tab writes it, as Settings, General lists it.
 */
export function settingName(key: string, packNames: Readonly<Record<string, string>>): string {
  if (key.startsWith(IMPORT_PROFILE_PREFIX)) return `${importWords.panel.profile} ${key.slice(IMPORT_PROFILE_PREFIX.length)}`
  return coreSettingNames()[key] ?? packNames[key] ?? key
}
