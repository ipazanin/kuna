import type { RouteLocationRaw } from 'vue-router'

import { homeCardFigures } from '../../shared/app/homeCardFigures'
import type { PublishedLinkTarget } from '../../shared/app/rowLinks'
import type { CivilDate } from '../../shared/calendar/civilDate'
import type { Money } from '../../shared/money/money'
import { sessionWrite } from '../../shared/storage/application/sessionWrite'
import { keyOfRecordId } from '../../shared/storage/domain/recordId'
import type { RecordId } from '../../shared/storage/domain/recordId'
import { TERMS_LINK } from './invoicing/presentation/invoicingLinks'
import { installedPack } from './packs/packContribution'
import { transactionsOn } from './transactions/application/publishedMoneyWithOwner'
import { useWorkbook } from './workbook/application/workbookStore'
import { COMPANY_APP } from './workbook/domain/companyApp'
import { displayNamesOf } from './workbook/domain/displayName'
import { ADVANCE_BUCKETS } from './workbook/domain/workbook'
import type { Workbook } from './workbook/domain/workbook'

/** The company as another app reads it. */
export interface PublishedCompany {
  /** Eleven digits, or blank while Company's invoicing terms hold none. */
  readonly oib: string
}

/** The invoicing terms, where Company's OIB is set. While Company is not set up, the link opens its first run. */
export const COMPANY_OIB_LINK: RouteLocationRaw = TERMS_LINK

/** The company of the books, for a reader that has them in hand, such as check:figures. */
export function companyOf(workbook: Pick<Workbook, 'settings'>): PublishedCompany {
  return { oib: workbook.settings.invoicing.oib }
}

const { state } = useWorkbook()

/** The company of the books on screen, a wait while they open, a failure, or null while Company is not set up. */
export function publishedCompany(): PublishedCompany | 'opening' | 'failed' | null {
  return homeCardFigures(state, companyOf)
}

/** A category a cost the owner paid privately may count in, as another app offers it: its slug and the name the screens give it. */
export interface PublishedAdvanceCategory {
  readonly slug: string
  readonly name: string
}

/** Whether a category's bucket is one a cost the owner paid may count in. */
function takesAdvances(bucket: string): boolean {
  return (ADVANCE_BUCKETS as readonly string[]).includes(bucket)
}

/** The categories a cost the owner paid may count in, in the books on screen, or none while Company is not open or keeps no owner pay. */
export function advanceCategories(): readonly PublishedAdvanceCategory[] {
  const { workbook } = useWorkbook().state
  if (workbook === null || !workbook.settings.ownerPayModule || installedPack().ownerAdvanceRecords === null) return []
  const names = displayNamesOf(workbook)
  return workbook.categories.filter((category) => takesAdvances(category.bucket)).map((category) => ({ slug: category.slug, name: names.category(category.slug) }))
}

/** A cost the owner paid privately that another app adds to Company, such as a purchase on the owner's own card. */
export interface OwnerAdvanceToAdd {
  readonly day: CivilDate
  /** Above zero. */
  readonly amount: Money
  readonly description: string
  /** The slug of one of `advanceCategories`. */
  readonly category: string
}

/** A record another app added in Company: the link that names it, the page that shows it, and Undo, which Company refuses once the record changed. */
export interface AddedInCompany {
  readonly link: PublishedLinkTarget
  readonly to: RouteLocationRaw
  undo(): Promise<void>
}

/**
 * Adds the cost the owner paid to the Company books on screen in a write of its own, under the title the adding app gives, as
 * the advance dialog adds one with no payment back and no labels. Throws with the reason when Company is not open, keeps no
 * owner pay or refuses it.
 */
export async function addOwnerAdvance(advance: OwnerAdvanceToAdd, title: string): Promise<AddedInCompany> {
  const store = useWorkbook()
  const { workbook, records } = store.state
  const pack = installedPack()
  const kind = pack.ownerAdvanceRecords
  if (workbook === null || records === null) throw new Error('Company is not open.')
  if (kind === null || !workbook.settings.ownerPayModule) throw new Error('Company keeps no owner pay, so it takes no costs the owner paid.')
  const category = workbook.categories.find((candidate) => candidate.slug === advance.category)
  if (category === undefined || !takesAdvances(category.bucket)) throw new Error(`A cost the owner paid counts in an operating or tax category, not in ${advance.category}.`)
  let added: RecordId | null = null
  const written = await sessionWrite(
    store,
    title,
    (unit) => {
      added = pack.addOwnerAdvance(unit, records, workbook.categories, { date: advance.day, amount: advance.amount, description: advance.description, category: advance.category })
    },
    'add-owner-advance-from-another-app',
  )
  if (added === null) throw new Error('Company did not add the cost.')
  return {
    link: { app: COMPANY_APP, kind: kind.name, key: keyOfRecordId(kind, added), due: null },
    to: transactionsOn(advance.day),
    undo: async () => (written === null ? undefined : store.undo(written)),
  }
}
