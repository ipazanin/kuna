import { describe, expect, it } from 'vitest'

import { PACK_ROLES } from '../src/apps/company/packs/hr-doo/domain/packRoles'
import { CATEGORY_CLASSES } from '../src/apps/company/packs/hr-doo/preset/domain/taxClassOf'
import { categoryClassRefusals } from '../src/apps/company/settings/domain/categoryGuards'
import { categoriesOfDrafts, categoryDraftErrors, draftWithClass, rolesOfText } from '../src/apps/company/settings/domain/categoryDrafts'
import type { CategoryDraft } from '../src/apps/company/settings/domain/categoryDrafts'

const KNOWN_ROLES = Object.values(PACK_ROLES)
const CAR_CLASS = PACK_ROLES.vehicleInsuranceInterestTaxAndFees

function carInsurance(roles: string): CategoryDraft {
  return { saved: 0, savedName: 'car-insurance', category: 'car-insurance', label: '', family: 'operating', bucket: 'operating', colour: '', roles, vat: 'none', ownerShare: '' }
}

function saveBlockers(draft: CategoryDraft): string[] {
  const fieldErrors = [...categoryDraftErrors([draft], new Set(), KNOWN_ROLES, false).values()].flatMap((found) => Object.values(found))
  const classRefusals = categoryClassRefusals(
    [
      {
        before: { slug: draft.category, roles: rolesOfText(draft.roles), vat: draft.vat, bucket: draft.bucket },
        after: { slug: draft.category, roles: rolesOfText(draft.roles), vat: draft.vat, bucket: draft.bucket },
      },
    ],
    CATEGORY_CLASSES,
  )
  return [...fieldErrors, ...classRefusals]
}

describe('picking a class on a category that carries the role the class replaced', () => {
  const stored = [{ fields: { category: 'car-insurance', family: 'operating', bucket: 'operating', roles: 'vehicle-insurance-and-interest', vat: 'none' }, id: 'a', row: 2 }] as never

  it('blocks the save with a roles error until a class is picked', () => {
    const blockers = saveBlockers(carInsurance('vehicle-insurance-and-interest'))

    expect(blockers).toEqual([expect.stringContaining('vehicle-insurance-and-interest')])
  })

  it('drops the replaced role, leaving a category the owner can save', () => {
    const picked = draftWithClass(carInsurance('vehicle-insurance-and-interest'), CATEGORY_CLASSES, CAR_CLASS)

    expect(picked.roles).toBe(CAR_CLASS)
    expect(saveBlockers(picked)).toEqual([])
    expect(categoriesOfDrafts(stored, [picked])[0]).toMatchObject({ record: { slug: 'car-insurance', roles: [CAR_CLASS] } })
  })

  it('keeps the modifiers the category carries beside the class', () => {
    const picked = draftWithClass(carInsurance('vehicle-insurance-and-interest, watched'), CATEGORY_CLASSES, CAR_CLASS)

    expect(picked.roles).toBe(`${CAR_CLASS}, watched`)
  })

  it('keeps an unknown role that is not the replaced one, so a typo stays visible and blocks the save', () => {
    const picked = draftWithClass(carInsurance('vehicle-insurence-and-interest'), CATEGORY_CLASSES, CAR_CLASS)

    expect(picked.roles).toBe(`${CAR_CLASS}, vehicle-insurence-and-interest`)
    expect(saveBlockers(picked)).toEqual([expect.stringContaining('vehicle-insurence-and-interest')])
  })

  it('leaves the replaced role on a category that picks a different class', () => {
    const picked = draftWithClass(carInsurance('vehicle-insurance-and-interest'), CATEGORY_CLASSES, PACK_ROLES.deductibleCost)

    expect(picked.roles).toBe(`${PACK_ROLES.deductibleCost}, vehicle-insurance-and-interest`)
  })
})
