import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** Whose login a link is made with at the bank, as Enable Banking's `psu_type`. Spending links personal logins only. */
export const BANK_USAGES = ['personal', 'business'] as const

export type BankUsage = (typeof BANK_USAGES)[number]

/** One bank approval the book keeps: the bank by its name at Enable Banking, the login, the day it runs out and when any device last got an answer. */
export interface BankLink {
  readonly id: RecordId
  readonly bank: string
  readonly usage: BankUsage
  readonly endsOn: CivilDate
  /** Epoch milliseconds, or null for a link never asked. */
  readonly fetchedAt: number | null
}

/** What names a link: one per bank and login, so two devices linking the same bank keep one link. */
export type LinkName = Pick<BankLink, 'bank' | 'usage'>

export function sameLink(one: LinkName, other: LinkName): boolean {
  return one.bank === other.bank && one.usage === other.usage
}

/** The key a link is kept by in the book. */
export function linkKey(link: LinkName): string {
  return `${link.usage} ${link.bank}`
}

/** A bank Enable Banking lists for Croatia, with the logins it takes. */
export interface ListedBank {
  readonly name: string
  readonly usages: readonly BankUsage[]
  readonly beta: boolean
}

/** The banks that take a login of the usage, in the order of the list. */
export function banksFor(listed: readonly ListedBank[], usage: BankUsage): readonly ListedBank[] {
  return listed.filter((bank) => bank.usages.includes(usage))
}

/**
 * The short names a book and a browser from before bank-link records give the two banks Kuna linked then, by each bank's
 * name at Enable Banking. A book's old link settings and a browser's old sessions are read under these until a write moves them.
 */
export const OLD_BANK_KEYS: Readonly<Record<string, string>> = { 'OTP banka': 'otp', Revolut: 'revolut' }

/** The bank's name at Enable Banking for an old short name, or null when the name is not an old one. */
export function bankOfOldKey(name: string): string | null {
  return Object.entries(OLD_BANK_KEYS).find(([, oldKey]) => oldKey === name)?.[0] ?? null
}
