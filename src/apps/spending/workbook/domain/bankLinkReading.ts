import { BANK_LINK_RECORDS } from './spendingKinds'
import { utcTimeOf } from './spendingSettings'
import { BANK_USAGES, OLD_BANK_KEYS, linkKey } from '../../bankSync/domain/bankLink'
import type { BankLink } from '../../bankSync/domain/bankLink'
import { parseCivilDate } from '../../../../shared/calendar/civilDate'
import { filledKey } from '../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import { filledFields } from '../../../../shared/storage/domain/recordFields'
import { recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { keyedId, requiredChoice, requiredDate, requiredRead, requiredText, textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'
import { settingValue } from '../../../../shared/storage/domain/settingRows'
import type { SettingRow } from '../../../../shared/storage/domain/settingRows'

/** The id a link of the bank and login is kept under, the same on every device. */
export function bankLinkId(link: Pick<BankLink, 'bank' | 'usage'>): RecordId {
  return recordIdOf(BANK_LINK_RECORDS, linkKey(link))
}

/** A link from its fields: the bank's name at Enable Banking, the login, the day it runs out and the UTC time of the last answer, if any. */
export function bankLinkOf(fields: StoredFields, id: RecordId | null): BankLink {
  return {
    id: keyedId(id),
    bank: requiredText(fields, 'bank'),
    usage: requiredChoice(fields, 'usage', BANK_USAGES),
    endsOn: requiredDate(fields, 'ends_on'),
    fetchedAt: textOf(fields.fetched_at).trim() === '' ? null : requiredRead(fields, 'fetched_at', utcTimeOf),
  }
}

export const BANK_LINK_CODEC: RecordCodec<BankLink> = {
  kind: BANK_LINK_RECORDS,
  key: (fields) => (textOf(fields.bank).trim() === '' || textOf(fields.usage).trim() === '' ? null : filledKey(`${textOf(fields.usage).trim()} ${textOf(fields.bank).trim()}`)),
  label: (fields) => textOf(fields.bank).trim(),
  make: bankLinkOf,
  fieldsOf: (link) => filledFields({ bank: link.bank, usage: link.usage, ends_on: link.endsOn, fetched_at: link.fetchedAt === null ? null : new Date(link.fetchedAt).toISOString() }),
}

/** The setting that holds the day a bank's link ran out in a book from before bank-link records. */
export function oldLinkEndKey(oldKey: string): string {
  return `bank_link_${oldKey}`
}

/** The setting that holds when a bank last answered in a book from before bank-link records. */
export function oldLinkFetchedKey(oldKey: string): string {
  return `bank_sync_fetched_${oldKey}`
}

/** Every setting a book from before bank-link records keeps its links in. */
export const OLD_LINK_SETTING_KEYS: readonly string[] = Object.values(OLD_BANK_KEYS).flatMap((oldKey) => [oldLinkEndKey(oldKey), oldLinkFetchedKey(oldKey)])

/**
 * Whether the old link settings still say which banks are linked: while no bank-link record counts. The reader and the
 * first link write, which moves them onto records, both ask this one rule.
 */
export function oldLinksCount(links: readonly BankLink[]): boolean {
  return links.length === 0
}

/** The personal links the old settings hold, each bank with a day it runs out. */
export function oldBankLinks(settings: readonly SettingRow[]): readonly BankLink[] {
  return Object.entries(OLD_BANK_KEYS).flatMap(([bank, oldKey]) => {
    const endsOn = parseCivilDate(settingValue(settings, oldLinkEndKey(oldKey)))
    if (endsOn === null) return []
    const link = { bank, usage: 'personal' as const }
    return [{ ...link, id: bankLinkId(link), endsOn, fetchedAt: utcTimeOf(settingValue(settings, oldLinkFetchedKey(oldKey))) }]
  })
}

/** The book's links: its bank-link records, or while none counts the links its old settings hold. */
export function bankLinksOf(links: readonly BankLink[], settings: readonly SettingRow[]): readonly BankLink[] {
  return oldLinksCount(links) ? oldBankLinks(settings) : links
}
