import { homeOfCompanyMoney } from './companyPaymentFiling'
import type { OwnerPaymentTarget } from './linkTarget'
import { starterNamesOf } from '../../categories/domain/starterCategories'
import { COMPANY_MONEY_ROLES, categoryWithRole } from '../../workbook/domain/category'
import type { Category, CompanyMoneyRole } from '../../workbook/domain/category'
import type { Account } from '../../workbook/domain/account'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { EURO } from '../../../../shared/money/currencyCode'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { fold, normaliseIban } from '../../../../shared/text/fold'

/** What the card asking where Kuna files payments from your company asks: the roles no category holds, and the day of the latest payment that needs one. */
export interface CompanyRolesAsk {
  readonly roles: readonly CompanyMoneyRole[]
  readonly through: CivilDate
}

/**
 * The roles that payments your company made to or from one of the file's euro accounts since it opened need and no category
 * holds, in the order of `COMPANY_MONEY_ROLES`. A payment on or before the day you said Not now asks nothing. Null while none asks.
 */
export function companyRolesAsk(
  book: {
    readonly accounts: readonly Pick<Account, 'currency' | 'iban' | 'openedOn'>[]
    readonly categories: readonly Category[]
    readonly settings: { readonly companyRolesPutOff: CivilDate | null }
  },
  payments: readonly OwnerPaymentTarget[],
): CompanyRolesAsk | null {
  const opened = new Map(book.accounts.filter((account) => account.currency === EURO && account.iban.trim() !== '').map((account) => [normaliseIban(account.iban), account.openedOn]))
  const missing = new Set<CompanyMoneyRole>()
  let through: CivilDate | null = null
  for (const payment of payments) {
    const since = opened.get(payment.ownerIban)
    if (since === undefined || payment.day < since || (book.settings.companyRolesPutOff !== null && payment.day <= book.settings.companyRolesPutOff)) continue
    const needs = payment.parts.map((part) => homeOfCompanyMoney(part.kind)).filter((home): home is CompanyMoneyRole => (COMPANY_MONEY_ROLES as readonly unknown[]).includes(home))
    const unheld = needs.filter((role) => categoryWithRole(book.categories, role) === undefined)
    if (unheld.length === 0) continue
    unheld.forEach((role) => missing.add(role))
    if (through === null || payment.day > through) through = payment.day
  }
  return through === null ? null : { roles: COMPANY_MONEY_ROLES.filter((role) => missing.has(role)), through }
}

/** The income category a file from before roles most likely means for the role: one shown and holding no role, whose name is the starter's in either language, or null. */
export function likelyCategoryOf(categories: readonly Category[], role: CompanyMoneyRole): RecordId | null {
  const names = new Set(starterNamesOf(role).map(fold))
  return categories.find((category) => category.kind === 'income' && category.parent !== null && !category.hidden && category.role === null && names.has(fold(category.name)))?.id ?? null
}
