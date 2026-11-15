import { describe, expect, it } from 'vitest'

import type { CategoryDraft } from '../src/apps/company/settings/domain/categoryDrafts'
import { NO_FILTERS, categoryListing, filtersInUse } from '../src/apps/company/settings/domain/categoryListing'
import type { CategoryFilters, ListedDraft } from '../src/apps/company/settings/domain/categoryListing'
import type { CategoryClass } from '../src/apps/company/workbook/domain/packPart'

function listed(saved: number | null, name: string, overrides: Partial<CategoryDraft> = {}, state: Partial<Omit<ListedDraft, 'draft'>> = {}): ListedDraft {
  return {
    draft: { saved, savedName: name, category: name, label: '', family: 'operating', bucket: 'operating', colour: '', roles: '', vat: '', ownerShare: '', ...overrides },
    unsaved: saved === null,
    inError: false,
    ...state,
  }
}

const TAB: readonly ListedDraft[] = [
  listed(0, 'revenue', { family: 'income', bucket: 'income', roles: 'revenue' }),
  listed(1, 'payroll-tax', { family: 'taxes', bucket: 'taxes', roles: 'owner-pay-tax, arrears' }),
  listed(2, 'ai-services', { vat: 'reverse-charge', ownerShare: '50' }),
  listed(3, 'travel', { label: 'Trips to clients' }),
  listed(4, 'salary-net', { family: 'owner', bucket: 'owner-pay', roles: 'arrears' }),
]

/** Revenue is a tax class, and arrears and owner-pay-tax are roles beside one. */
const CLASSES: readonly CategoryClass[] = [{ role: 'revenue', vat: ['none'], buckets: ['income'] }]

function filtered(filters: Partial<CategoryFilters>): number[] {
  return categoryListing(TAB, { ...NO_FILTERS, ...filters }, null, CLASSES)
}

describe('the categories table, filtered', () => {
  it('shows every row in the tab order without filters or a sort', () => {
    expect(categoryListing(TAB, NO_FILTERS, null, CLASSES)).toEqual([0, 1, 2, 3, 4])
    expect(filtersInUse(NO_FILTERS)).toBe(false)
  })

  it('searches every word in the name, the shown name, the family, the bucket and the roles, ignoring case and accents', () => {
    expect(filtered({ search: 'ARREARS' })).toEqual([1, 4])
    expect(filtered({ search: 'trips' })).toEqual([3])
    expect(filtered({ search: 'AI services' })).toEqual([2])
    expect(filtered({ search: 'owner  pay' })).toEqual([1, 4])
    expect(filtered({ search: 'incöme' })).toEqual([0])
    expect(filtered({ search: '   ' })).toEqual([0, 1, 2, 3, 4])
    expect(filtersInUse({ ...NO_FILTERS, search: '   ' })).toBe(false)
  })

  it('narrows to the categories that count by a tax class', () => {
    expect(filtered({ taxClass: 'revenue' })).toEqual([0])
    expect(filtersInUse({ ...NO_FILTERS, taxClass: 'revenue' })).toBe(true)
  })

  it('narrows to a bucket, a role, a category with an owner share or one with an unsaved change', () => {
    expect(filtered({ bucket: 'operating' })).toEqual([2, 3])
    expect(filtered({ role: 'arrears' })).toEqual([1, 4])
    expect(filtered({ role: 'arrears', search: 'salary' })).toEqual([4])
    expect(filtered({ withOwnerShare: true })).toEqual([2])
    expect(filtered({ unsavedOnly: true })).toEqual([])
  })

  it('keeps a row with an unsaved change, an error or one added in the editor in view whatever the filters say', () => {
    const tab = [...TAB, listed(null, '')]
    tab[1] = { ...tab[1]!, unsaved: true }
    tab[3] = { ...tab[3]!, inError: true }
    expect(categoryListing(tab, { ...NO_FILTERS, bucket: 'income' }, null, CLASSES)).toEqual([0, 1, 3, 5])
    expect(categoryListing(tab, { ...NO_FILTERS, unsavedOnly: true }, null, CLASSES)).toEqual([1, 3, 5])
  })
})

describe('the categories table, sorted', () => {
  it('sorts by name either way', () => {
    expect(categoryListing(TAB, NO_FILTERS, { column: 'category', descending: false }, CLASSES)).toEqual([2, 1, 0, 4, 3])
    expect(categoryListing(TAB, NO_FILTERS, { column: 'category', descending: true }, CLASSES)).toEqual([3, 4, 0, 1, 2])
  })

  it('sorts the shown name, which is the label or the name in words', () => {
    // AI services, Payroll tax, Revenue, Salary net, Trips to clients.
    expect(categoryListing(TAB, NO_FILTERS, { column: 'label', descending: false }, CLASSES)).toEqual([2, 1, 0, 4, 3])
  })

  it('sorts buckets in the order of the profit and loss, a tie in the tab order', () => {
    expect(categoryListing(TAB, NO_FILTERS, { column: 'bucket', descending: false }, CLASSES)).toEqual([0, 2, 3, 1, 4])
    expect(categoryListing(TAB, NO_FILTERS, { column: 'bucket', descending: true }, CLASSES)).toEqual([4, 1, 2, 3, 0])
  })

  it('puts a blank value last in either direction', () => {
    expect(categoryListing(TAB, NO_FILTERS, { column: 'vat', descending: false }, CLASSES)).toEqual([2, 0, 1, 3, 4])
    expect(categoryListing(TAB, NO_FILTERS, { column: 'vat', descending: true }, CLASSES)).toEqual([2, 0, 1, 3, 4])
    expect(categoryListing(TAB, NO_FILTERS, { column: 'roles', descending: true }, CLASSES)).toEqual([1, 4, 0, 2, 3])
  })

  it('sorts roles by those beside the tax class, as the column shows them', () => {
    // Revenue carries only its class, so its roles read blank and sort last.
    expect(categoryListing(TAB, NO_FILTERS, { column: 'roles', descending: false }, CLASSES)).toEqual([4, 1, 0, 2, 3])
  })

  it('sorts an owner share as a number', () => {
    const tab = [listed(0, 'a', { ownerShare: '9' }), listed(1, 'b', { ownerShare: '50' }), listed(2, 'c'), listed(3, 'd', { ownerShare: '100' })]
    expect(categoryListing(tab, NO_FILTERS, { column: 'ownerShare', descending: false }, CLASSES)).toEqual([0, 1, 3, 2])
    expect(categoryListing(tab, NO_FILTERS, { column: 'ownerShare', descending: true }, CLASSES)).toEqual([3, 1, 0, 2])
  })

  it('keeps rows added in the editor at the foot, in the order they were added', () => {
    const tab = [listed(null, 'zebra'), ...TAB, listed(null, 'aardvark')]
    expect(categoryListing(tab, NO_FILTERS, { column: 'category', descending: false }, CLASSES)).toEqual([3, 2, 1, 5, 4, 0, 6])
  })
})
