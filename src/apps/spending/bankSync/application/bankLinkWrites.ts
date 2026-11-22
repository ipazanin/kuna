import { sameLink } from '../../../../shared/bank-sync/domain/bankLink'
import type { BankLink, LinkName } from '../../../../shared/bank-sync/domain/bankLink'
import { SETTING_WRITES } from '../../workbook/application/settingWrites'
import { OLD_LINK_SETTING_KEYS, bankLinkId, oldLinksCount } from '../../workbook/domain/bankLinkReading'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import { BANK_LINK_RECORDS } from '../../workbook/domain/spendingKinds'
import { words } from '../domain/words'
import { parseCivilDate } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import { setSetting } from '../../../../shared/storage/application/settingWrites'
import { readEach, sameRecord } from '../../../../shared/storage/domain/recordsRead'
import type { WriteRules } from '../../../../shared/storage/domain/writeRules'

/** A link reads on its own, and Undo takes back what a write did. No other record names a link. */
export const BANK_LINK_WRITES: WriteRules<BankLink> = {
  kind: BANK_LINK_RECORDS,
  reads: [],
  undoable: true,
  read: (read) => readEach(read, () => []),
  refusals: () => [],
}

type LinkBook = Pick<SpendingBook, 'bankLinks' | 'readings'>

/**
 * Writes the links as `change` leaves them. While the old link settings still count, as `oldLinksCount` says, the same write
 * moves them onto records and clears the settings, so one Undo takes back both.
 */
function writeLinks(unit: UnitOfWork, book: LinkBook, change: (links: readonly BankLink[]) => readonly BankLink[]): void {
  const stored = book.readings.bankLinks.facts
  const moving = oldLinksCount(stored)
  const after = change(book.bankLinks)
  const writes = unit.of(BANK_LINK_WRITES)
  for (const link of after) {
    const held = stored.find((other) => other.id === link.id)
    if (held === undefined) writes.add(link)
    else if (!sameRecord(held, link)) writes.change(held, link)
  }
  stored.filter((held) => !after.some((link) => link.id === held.id)).forEach((held) => writes.remove(held))
  if (moving) OLD_LINK_SETTING_KEYS.forEach((key) => setSetting(unit, SETTING_WRITES, book.readings.settings.facts, key, ''))
}

/** The day a bank's approval runs out, from the end Enable Banking gave the session. A link made again keeps its last answer. */
export function saveLink(unit: UnitOfWork, book: LinkBook, name: LinkName, validUntil: string): void {
  const endsOn = parseCivilDate(validUntil.slice(0, 10))
  if (endsOn === null) throw new Error(words.noLinkEnd(validUntil))
  writeLinks(unit, book, (links) => {
    const held = links.find((link) => sameLink(link, name))
    const made: BankLink = { id: bankLinkId(name), bank: name.bank, usage: name.usage, endsOn, fetchedAt: held?.fetchedAt ?? null }
    return held === undefined ? [...links, made] : links.map((link) => (link === held ? made : link))
  })
}

/** The links whose approval the bank says is over end the day before, so the home card says so and the step stops asking. */
export function endLinks(unit: UnitOfWork, book: LinkBook, ended: readonly LinkName[], yesterday: CivilDate): void {
  writeLinks(unit, book, (links) => links.map((link) => (ended.some((name) => sameLink(name, link)) && link.endsOn > yesterday ? { ...link, endsOn: yesterday } : link)))
}

/** When the banks last answered, which every device sharing the file reads to leave them alone for six hours. */
export function saveFetched(unit: UnitOfWork, book: LinkBook, answered: readonly LinkName[], at: number): void {
  writeLinks(unit, book, (links) => links.map((link) => (answered.some((name) => sameLink(name, link)) ? { ...link, fetchedAt: at } : link)))
}

/** The bank's link for that login is gone, as Remove on a bank Enable Banking no longer lists leaves the book. */
export function forgetBankLink(unit: UnitOfWork, book: LinkBook, name: LinkName): void {
  writeLinks(unit, book, (links) => links.filter((link) => !sameLink(link, name)))
}

/** No bank linked, as Remove bank sync and another application leave the book. */
export function forgetBankLinks(unit: UnitOfWork, book: LinkBook): void {
  writeLinks(unit, book, () => [])
}
