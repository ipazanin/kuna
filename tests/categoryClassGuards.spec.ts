import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { CATEGORY_CLASSES } from '../src/apps/company/packs/hr-doo/preset/domain/taxClassOf'
import { CATEGORY_WRITES } from '../src/apps/company/settings/application/namedRecordWrites'
import { categoryDraftsOf } from '../src/apps/company/settings/domain/categoryDrafts'
import { categoryClassMessages } from '../src/apps/company/settings/presentation/categoryClassMessages'
import type { ClassNaming } from '../src/apps/company/settings/presentation/categoryClassMessages'
import { categoryClassHelp } from '../src/apps/company/packs/hr-doo/preset/presentation/categoryClassHelp'
import type { DefinedBucket } from '../src/apps/company/workbook/domain/bucket'
import { civil } from './fixtures/ledger'
import type { CategoryDraft } from '../src/apps/company/settings/domain/categoryDrafts'
import { categoryClassRefusals } from '../src/apps/company/settings/domain/categoryGuards'
import { installedPack } from '../src/apps/company/packs/packContribution'
import { storedOf } from '../src/shared/storage/domain/recordsRead'
import { recordWithId } from '../src/shared/storage/domain/recordsRead'
import { categoryIdOf } from '../src/apps/company/workbook/domain/workbook'
import { browserHarness, driveHarness, forgetCaches, workbookGrids } from './fixtures/writeBack'
import type { WriteBackHarness } from './fixtures/writeBack'

/** Classes, VAT treatments and buckets named as the English editor names them. */
const naming: ClassNaming = { className: (role) => categoryClassHelp(role, civil('2026-10-30'))?.name ?? role, treatment: (treatment) => treatment, bucket: (bucket) => bucket }

function edited(slug: string, roles: readonly string[], vat: string, bucket: string, before: { roles: readonly string[]; vat: string; bucket: string } | null = null) {
  return { before: before === null ? null : { slug, ...before }, after: { slug, roles, vat, bucket } }
}

describe('categoryClassRefusals', () => {
  it('refuses an added category with no class, two classes, or a VAT treatment or bucket its class does not allow', () => {
    expect(categoryClassRefusals([edited('stationery', ['watched'], '', 'operating')], CATEGORY_CLASSES)).toEqual(['Pick how Kuna counts "stationery".'])
    expect(categoryClassRefusals([edited('dinners', ['representation', 'non-deductible'], 'representation', 'operating')], CATEGORY_CLASSES)).toEqual([
      'Kuna counts a category one way, and "dinners" has representation and non-deductible.',
    ])
    expect(categoryClassRefusals([edited('dinners', ['representation'], 'deductible-25', 'operating')], CATEGORY_CLASSES)).toEqual([
      '"dinners" carries representation, which allows only representation, not deductible-25.',
    ])
    expect(categoryClassRefusals([edited('dinners', ['representation'], 'representation', 'taxes')], CATEGORY_CLASSES)).toEqual([
      '"dinners" carries representation, which allows only operating, not taxes.',
    ])
  })

  it('lets through a category whose roles, VAT and bucket the change leaves alone, contradiction and all', () => {
    const saved = { roles: ['representation'], vat: 'deductible-25', bucket: 'operating' }
    expect(categoryClassRefusals([edited('dinners', saved.roles, saved.vat, saved.bucket, saved)], CATEGORY_CLASSES)).toEqual([])
    expect(categoryClassRefusals([edited('travel', [], '', 'operating', { roles: [], vat: '', bucket: 'operating' })], CATEGORY_CLASSES)).toEqual([])
  })

  it('reads the first class of two for the VAT and bucket, and keeps the modifiers beside it', () => {
    expect(categoryClassRefusals([edited('fuel', ['personal-transport', 'arrears'], 'car-50', 'operating')], CATEGORY_CLASSES)).toEqual([])
    expect(categoryClassRefusals([edited('fuel', ['personal-transport', 'deductible-cost'], 'deductible-25', 'operating')], CATEGORY_CLASSES)).toEqual([
      'Kuna counts a category one way, and "fuel" has personal-transport and deductible-cost.',
      '"fuel" carries personal-transport, which allows only car-50, foreign-vat or none, not deductible-25.',
    ])
  })

  it('asks for no class while the pack has none', () => {
    expect(categoryClassRefusals([edited('stationery', [], '', 'operating')], [])).toEqual([])
  })
})

describe('the categories editor and the tax classes', () => {
  const saved: readonly CategoryDraft[] = [
    { saved: 0, savedName: 'travel', category: 'travel', label: '', family: 'operating', bucket: 'operating', colour: '', roles: '', vat: '', ownerShare: '' },
    { saved: 1, savedName: 'dinners', category: 'dinners', label: '', family: 'operating', bucket: 'operating', colour: '', roles: 'representation', vat: 'deductible-25', ownerShare: '' },
  ]
  const messagesOf = (drafts: readonly CategoryDraft[]) => categoryClassMessages(drafts, saved, CATEGORY_CLASSES, naming)

  it('only hints at a row left as it was saved, so the tab still saves', () => {
    expect(messagesOf(saved)).toEqual({
      errors: new Map(),
      hints: new Map([
        [0, { class: 'Not classified yet. Kuna counts it by its bucket and VAT until you pick.' }],
        [1, { vat: 'This tax class allows only representation.' }],
      ]),
    })
    expect(messagesOf([{ ...saved[0]!, label: 'Trains' }, saved[1]!]).errors).toEqual(new Map())
  })

  it('holds a row added, or changed in its roles, VAT or bucket, to its class, each error on its field, and says what the editor allows', () => {
    const added: CategoryDraft = { saved: null, savedName: '', category: 'stationery', label: '', family: 'operating', bucket: 'operating', colour: '', roles: '', vat: '', ownerShare: '' }
    const { errors, hints } = messagesOf([{ ...saved[0]!, bucket: 'taxes' }, { ...saved[1]!, bucket: 'taxes' }, added])

    expect(errors.get(0)).toEqual({ class: 'Pick how Kuna counts this category.' })
    expect(errors.get(1)).toEqual({ vat: 'This tax class allows only representation.', bucket: 'This tax class allows only operating.' })
    expect(errors.get(2)).toEqual({ class: 'Pick how Kuna counts this category.' })
    expect(hints).toEqual(new Map())
  })

  it('names two classes on the class field as the editor names them', () => {
    expect(messagesOf([saved[0]!, { ...saved[1]!, roles: 'representation, non-deductible', vat: 'representation' }]).errors.get(1)).toEqual({
      class: 'Kuna counts a category one way, and this one has "Representation: 50% added back to the profit tax base, no VAT back" and "Fines and private costs: all added back".',
    })
  })

  it('asks nothing while the pack has no classes', () => {
    expect(categoryClassMessages(saved, saved, [], naming)).toEqual({ errors: new Map(), hints: new Map() })
  })
})

const used = new Set<string>()

afterEach(async () => {
  await forgetCaches(used)
})

function gridsWithDinners(): ReturnType<typeof workbookGrids> {
  return {
    ...workbookGrids(),
    categories: [
      ['category', 'family', 'bucket', 'roles', 'vat'],
      ['equipment', 'operating', 'operating', 'deductible-cost', 'deductible-25'],
      ['ai-services', 'operating', 'operating', 'deductible-cost', ''],
      // Other income, since the revenue role would match the category against invoices.
      ['revenue', 'income', 'income', 'other-income', ''],
      ['dinners', 'operating', 'operating', 'representation', 'deductible-25'],
    ],
  }
}

describe.each([
  ['a file on Drive', driveHarness],
  ['a workbook kept in this browser', browserHarness],
] as const)('saving categories with tax classes to %s', (_name, harnessOf: (used: Set<string>, grids?: ReturnType<typeof workbookGrids>) => Promise<WriteBackHarness>) => {
  it('refuses a change that contradicts a class, saves one that keeps to it, and lets Undo put a contradiction back for the read to report', async () => {
    const { store } = await harnessOf(used, gridsWithDinners())
    const stored = (slug: string) => recordWithId(store.state.records!.categories, categoryIdOf({ slug }))!.record
    const reported = () =>
      installedPack()
        .categoriesToSort(store.state.workbook!.categories, civil('2026-10-30'))
        .map((line) => line.reason)
    const dinnersLine =
      'It carries "Representation: 50% added back to the profit tax base, no VAT back", which takes representation, and its VAT reads deductible-25. Change one of them on Settings, Categories.'

    expect(reported()).toEqual([dinnersLine])
    // The line asks for a change and leaves nothing out, so it is never among the rows the reader could not use.
    expect(store.state.workbook!.problems).toEqual([])
    await expect(store.write('Saved', (unit) => unit.of(CATEGORY_WRITES).change(stored('equipment'), { ...stored('equipment'), vat: 'representation' }))).rejects.toThrow(
      '"equipment" carries deductible-cost, which allows only deductible-25, deductible-13, deductible-5, reverse-charge, foreign-vat or none, not representation.',
    )

    await store.write('Saved', (unit) => unit.of(CATEGORY_WRITES).change(stored('dinners'), { ...stored('dinners'), vat: 'representation' }))
    expect(reported()).toEqual([])

    await store.undo(store.state.writes[0]!)
    expect(stored('dinners').vat).toBe('deductible-25')
    expect(reported()).toEqual([dinnersLine])
    expect(store.state.workbook!.problems).toEqual([])
  })

  it('lets the loan switch move the loan categories between owner pay and financing, and refuses a bucket their class does not take', async () => {
    const grids = gridsWithDinners()
    const { store } = await harnessOf(used, {
      ...grids,
      categories: [...grids.categories!, ['owner-loan-out', 'owner', 'owner-pay', 'owner-loan-out', ''], ['owner-loan-repaid', 'owner', 'owner-pay', 'owner-loan-repaid', '']],
    })
    const loans = () => ['owner-loan-out', 'owner-loan-repaid'].map((slug) => recordWithId(store.state.records!.categories, categoryIdOf({ slug }))!.record)
    const switchLoans = (bucket: DefinedBucket) => store.write('Loans switched', (unit) => loans().forEach((loan) => unit.of(CATEGORY_WRITES).change(loan, { ...loan, bucket })))
    const buckets = () => store.state.workbook!.categories.filter((category) => category.slug.startsWith('owner-loan')).map((category) => category.bucket)

    await switchLoans('financing')
    expect(buckets()).toEqual(['financing', 'financing'])
    await switchLoans('owner-pay')
    expect(buckets()).toEqual(['owner-pay', 'owner-pay'])
    await expect(switchLoans('operating')).rejects.toThrow('"owner-loan-out" carries owner-loan-out, which allows only owner-pay or financing, not operating.')
  })

  it('saves a label on a category that has no class yet', async () => {
    const grids = workbookGrids()
    const { store } = await harnessOf(used, { ...grids, categories: [...grids.categories!, ['travel', 'operating', 'operating']] })
    const travel = recordWithId(store.state.records!.categories, categoryIdOf({ slug: 'travel' }))!.record
    const drafts = categoryDraftsOf(storedOf(store.state.records!.categories))

    expect(categoryClassMessages(drafts, drafts, CATEGORY_CLASSES, naming).hints.get(3)).toEqual({ class: 'Not classified yet. Kuna counts it by its bucket and VAT until you pick.' })
    await store.write('Saved', (unit) => unit.of(CATEGORY_WRITES).change(travel, { ...travel, label: 'Trains' }))
    expect(store.state.workbook!.categories.find((category) => category.slug === 'travel')?.label).toBe('Trains')
  })
})
