import type { RouteLocationRaw } from 'vue-router'

import type { PublishedMoneyWithOwner, PublishedOwnerAdvance, PublishedOwnerMoney } from '../../../../shared/app/moneyWithOwner'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { keyOfRecordId } from '../../../../shared/storage/domain/recordId'
import type { RecordKind } from '../../../../shared/storage/domain/recordKind'
import { DEFAULT_FILTERS } from '../../filters/domain/filterState'
import { encodeFilters } from '../../filters/domain/filterQuery'
import { installedPack } from '../../packs/packContribution'
import type { OwnerMoneyKind } from '../../packs/packContribution'
import { COMPANY_APP } from '../../workbook/domain/companyApp'
import { LEDGER_RECORDS } from '../../workbook/domain/coreKinds'
import { displayNamesOf } from '../../workbook/domain/displayName'
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

/** Transactions narrowed to the day, where a row or a cost the owner paid on it is listed. */
export function transactionsOn(day: CivilDate): RouteLocationRaw {
  return { path: '/company/transactions', query: encodeFilters({ ...DEFAULT_FILTERS, period: { preset: 'custom', range: { from: day, to: day } } }, { explicitPeriod: true }) }
}

/** The costs the owner paid privately as other apps read them, each linked by its id in the pack's kind and named by its category. */
function publishedAdvances(workbook: Workbook, kind: RecordKind | null): readonly PublishedOwnerAdvance[] {
  if (kind === null) return []
  const names = displayNamesOf(workbook)
  return workbook.ownerAdvances.map((advance) => ({
    link: { app: COMPANY_APP, kind: kind.name, key: keyOfRecordId(kind, advance.id), due: null },
    day: advance.date,
    amount: advance.amount,
    description: advance.description,
    categoryName: names.category(advance.category),
    to: transactionsOn(advance.date),
  }))
}

/**
 * The money between the company and the owner as other apps read it: the bank rows between them, each linked by its row id, and
 * the costs the owner paid privately, each opening Transactions on its day. Null while the owner-pay switch is off, since then
 * the books keep no owner.
 */
export function publishedMoneyWithOwner(workbook: Workbook): PublishedMoneyWithOwner | null {
  if (!workbook.settings.ownerPayModule) return null
  const pack = installedPack()
  const payments = pack.moneyWithOwner(presentedWorkbook(workbook)).map(({ rowId, date, amount, direction, companyIban, ownerIban, parts }) => ({
    link: { app: COMPANY_APP, kind: LEDGER_RECORDS.name, key: rowId, due: null },
    day: date,
    amount,
    direction,
    companyIban,
    ownerIban,
    parts: parts.map((part) => ({ kind: publishedMoney(part, pack.paysForTrip), amount: part.amount })),
    to: transactionsOn(date),
  }))
  return { payments, advances: publishedAdvances(workbook, pack.ownerAdvanceRecords) }
}
