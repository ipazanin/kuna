import type { PublishedOwnerMoney, PublishedOwnerPayment } from '../../../../shared/app/moneyWithOwner'
import { DEFAULT_FILTERS } from '../../filters/domain/filterState'
import { encodeFilters } from '../../filters/domain/filterQuery'
import { installedPack } from '../../packs/packContribution'
import type { OwnerMoneyKind } from '../../packs/packContribution'
import { COMPANY_APP } from '../../workbook/domain/companyApp'
import { LEDGER_RECORDS } from '../../workbook/domain/coreKinds'
import type { Workbook } from '../../workbook/domain/workbook'
import { presentedWorkbook } from '../domain/presentedWorkbook'

/** What another app files a part as. A tax-free payment a trip pays is a travel allowance, and any other is tax-free pay. */
function publishedMoney(part: OwnerMoneyKind, paysForTrip: (payment: string) => boolean): PublishedOwnerMoney {
  switch (part.kind) {
    case 'net-salary':
      return 'salary'
    case 'dividend':
      return 'profit-payout'
    case 'tax-free':
      return paysForTrip(part.payment) ? 'travel-allowance' : 'tax-free-pay'
    default:
      return part.kind
  }
}

/**
 * The bank rows between the company and the owner as other apps read them, each linked by its row id and opening Transactions
 * on its day, or null while the owner-pay switch is off, since then the books keep no owner.
 */
export function publishedMoneyWithOwner(workbook: Workbook): readonly PublishedOwnerPayment[] | null {
  if (!workbook.settings.ownerPayModule) return null
  const pack = installedPack()
  return pack.moneyWithOwner(presentedWorkbook(workbook)).map(({ rowId, date, amount, direction, companyIban, ownerIban, parts }) => ({
    link: { app: COMPANY_APP, kind: LEDGER_RECORDS.name, key: rowId, due: null },
    day: date,
    amount,
    direction,
    companyIban,
    ownerIban,
    parts: parts.map((part) => ({ kind: publishedMoney(part, pack.paysForTrip), amount: part.amount })),
    to: { path: '/company/transactions', query: encodeFilters({ ...DEFAULT_FILTERS, period: { preset: 'custom', range: { from: date, to: date } } }, { explicitPeriod: true }) },
  }))
}
