import { CATEGORY_WRITES } from './categoryWrites'
import { companyMoneyCategoryIn } from '../domain/starterCategories'
import { SETTING_WRITES } from '../../workbook/application/settingWrites'
import type { Category, CompanyMoneyRole } from '../../workbook/domain/category'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import { COMPANY_ROLES_PUT_OFF_KEY } from '../../workbook/domain/spendingSettings'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { setSetting } from '../../../../shared/storage/application/settingWrites'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import type { Language } from '../../../../shared/text/language'

/** Which category takes a role: one the file holds, or a new one as a new file names it. */
export interface RolePick {
  readonly role: CompanyMoneyRole
  readonly category: RecordId | 'add'
}

/** Gives each picked category its role, and adds the new ones under the file's Income, in one write, so one Undo takes them all back. */
export function writeCompanyRoles(unit: UnitOfWork, categories: readonly Category[], picks: readonly RolePick[], language: Language): void {
  let held = categories
  for (const pick of picks) {
    if (pick.category === 'add') {
      const { added } = companyMoneyCategoryIn(held, pick.role, language)
      added.forEach((category) => unit.of(CATEGORY_WRITES).add(category))
      held = [...held, ...added]
      continue
    }
    const before = held.find((category) => category.id === pick.category)
    if (before === undefined) continue
    const after = { ...before, role: pick.role }
    unit.of(CATEGORY_WRITES).change(before, after)
    held = held.map((category) => (category.id === after.id ? after : category))
  }
}

/** Stops the card asking for the payments it asks about now. A later payment that needs a role asks again. */
export function putOffCompanyRoles(unit: UnitOfWork, book: Pick<SpendingBook, 'readings'>, through: CivilDate): void {
  setSetting(unit, SETTING_WRITES, book.readings.settings.facts, COMPANY_ROLES_PUT_OFF_KEY, through)
}
