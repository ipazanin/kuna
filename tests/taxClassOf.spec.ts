import { describe, expect, it } from 'vitest'

import { CATEGORY_CLASSES, taxClassOf } from '../src/apps/company/packs/hr-doo/preset/domain/taxClassOf'
import { EARLIER_ROLES, STARTING_CATEGORIES, startingChange } from '../src/apps/company/packs/hr-doo/preset/domain/startingCategories'
import { categoriesToSort } from '../src/apps/company/packs/hr-doo/preset/presentation/categoriesToSort'
import { displayName } from '../src/apps/company/workbook/domain/displayName'
import { categoryClassHelp } from '../src/apps/company/packs/hr-doo/preset/presentation/categoryClassHelp'
import { civil } from './fixtures/ledger'
import { STUDIO_CATEGORIES } from './fixtures/exampleStudio'
import { dismissalOfNewerClass } from '../src/apps/company/rules/application/dismissalWrites'
import { categoryIdOf } from '../src/apps/company/workbook/domain/workbook'
import type { Category } from '../src/apps/company/workbook/domain/workbook'

const representation = STUDIO_CATEGORIES.find((category) => category.slug === 'representation')!

describe('taxClassOf', () => {
  it('finds the class a role carries, one for every tax-free payment, and none for a modifier', () => {
    expect(taxClassOf('representation')?.law).toBe('company/tax-classes.md#representation')
    expect(taxClassOf('tax-free:results-bonus')?.id).toBe('tax-free:*')
    expect(taxClassOf('arrears')).toBeNull()
    expect(CATEGORY_CLASSES.filter((taxClass) => taxClass.role.startsWith('tax-free:')).length).toBe(taxClassOf('tax-free:results-bonus')?.roles.length)
  })
})

describe('categoriesToSort', () => {
  const day = civil('2026-10-30')
  const lineOf = (category: Category, reason: string) => ({ id: categoryIdOf(category), label: displayName(category.slug, category.label), reason })
  const representationName = 'Representation: 50% added back to the profit tax base, no VAT back'

  it('finds nothing in a category with one class that keeps to it, whatever modifiers it has', () => {
    expect(categoriesToSort([representation, { ...representation, slug: 'gifts', roles: ['representation', 'arrears'] }], day, [])).toEqual([])
  })

  it('names every category with no class in one line, by the name the screens give it', () => {
    const travel = { ...representation, slug: 'travel', roles: [], vat: 'none' } as const
    const paper = { ...travel, slug: 'paper', label: 'Paper and pens', roles: ['watched'] }

    expect(categoriesToSort([travel, representation, paper], day, [])).toEqual([
      { id: null, label: 'No tax class yet', reason: 'Travel and Paper and pens. Pick one for each on the Categories card.' },
    ])
    expect(categoriesToSort([travel], day, [])[0]?.reason).toBe('Travel. Pick one for it on the Categories card.')
  })

  it('names two classes, and checks the VAT and bucket against the first the roles list', () => {
    const twice = { ...representation, roles: ['representation', 'non-deductible'], bucket: 'taxes' } as const

    expect(categoriesToSort([twice], day, [])).toEqual([
      lineOf(twice, `It carries "${representationName}" and "Fines and private costs: all added back". Kuna counts a category one way, so keep one on the Categories card.`),
      lineOf(twice, `It carries "${representationName}", which sits in operating, and the category sits in taxes. Change one of them on the Categories card.`),
    ])
  })

  it('names a VAT treatment the class does not take', () => {
    const deductible = { ...representation, vat: 'deductible-25' } as const

    expect(categoriesToSort([deductible], day, [])).toEqual([
      lineOf(deductible, `It carries "${representationName}", which takes Representation, and its VAT reads Input VAT 25\u00a0%. Change one of them on the Categories card.`),
    ])
  })

  it('suggests the interest income class for the interest category older books started on other income, and nothing once it carries another', () => {
    const older = { ...representation, slug: 'interest-income', family: 'income', bucket: 'income', roles: ['other-income'], vat: 'none' } as const

    expect(categoriesToSort([older], day, [])).toEqual([
      { ...lineOf(older, 'It carries "Other income", and new books give it "Interest, financial income". Pick that one on the Categories card.'), newerClassOf: 'interest-income' },
    ])
    expect(
      categoriesToSort(
        [
          { ...older, roles: ['interest-income'] },
          { ...older, roles: ['revenue'] },
          { ...older, slug: 'other-income' },
        ],
        day,
        [],
      ),
    ).toEqual([])
  })

  it('leaves out the suggested interest income class once the person dismissed it, and keeps it for a dismissal of another category or kind', () => {
    const older = { ...representation, slug: 'interest-income', family: 'income', bucket: 'income', roles: ['other-income'], vat: 'none' } as const
    const dismissed = dismissalOfNewerClass('interest-income', day)

    expect(categoriesToSort([older], day, [dismissed])).toEqual([])
    expect(categoriesToSort([older], day, [dismissalOfNewerClass('other-income', day), { ...dismissed, kind: 'not-covered' }])).toHaveLength(1)
  })
})

describe('the cost line older books keep for travel, insurance, training, bank fees and late payment interest', () => {
  const day = civil('2026-11-15')
  const older = (slug: string, roles: readonly string[]): Category => ({ ...representation, slug, family: 'operating', bucket: 'operating', roles, vat: 'none' })
  const lineOf = (category: Category, reason: string) => ({ id: categoryIdOf(category), label: displayName(category.slug, category.label), reason })

  it('suggests the other-costs-line role new books give, until the category carries it or the person dismissed it', () => {
    const travel = older('travel', ['deductible-cost'])
    const said = 'New books also give it "other-costs-line", which puts its costs on the profit and loss line the accountant uses. Add it on the Categories card.'

    expect(categoriesToSort([travel, older('insurance', ['deductible-cost', 'prepaid-annual'])], day, [])).toEqual([
      { ...lineOf(travel, said), newerClassOf: 'travel' },
      { ...lineOf(older('insurance', ['deductible-cost', 'prepaid-annual']), said), newerClassOf: 'insurance' },
    ])
    expect(categoriesToSort([older('travel', ['deductible-cost', 'other-costs-line']), older('bank-fees', ['non-deductible'])], day, [])).toEqual([])
    expect(categoriesToSort([travel], day, [dismissalOfNewerClass('travel', day)])).toEqual([])
  })

  it('suggests no class to the chat for a change of roles beside the same class', () => {
    expect(startingChange({ slug: 'training', roles: ['deductible-cost'] }, [])).toEqual({ kind: 'roles', added: ['other-costs-line'] })
    expect(startingChange({ slug: 'late-payment-interest', roles: ['deductible-cost'] }, [])).toEqual({ kind: 'roles', added: ['financial-expenses-line'] })
  })
})

/**
 * What each starting category carried in books started before the last change to the starting set. A change to the set changes a
 * row here and gives the category in `startingCategories.ts` the roles it had, so older books are offered the change.
 */
const STARTING_ROLES_OF_OLDER_BOOKS: Readonly<Record<string, readonly string[]>> = {
  'interest-income': ['other-income'],
  travel: ['deductible-cost'],
  insurance: ['deductible-cost', 'prepaid-annual'],
  training: ['deductible-cost'],
  'bank-fees': ['deductible-cost'],
  'late-payment-interest': ['deductible-cost'],
}

describe('the starting categories', () => {
  it('say what older books held for every category new books start otherwise', () => {
    const changed = STARTING_CATEGORIES.filter((category) => EARLIER_ROLES.has(category.slug)).map((category) => category.slug)
    expect(Object.fromEntries(changed.map((slug) => [slug, EARLIER_ROLES.get(slug)]))).toEqual(STARTING_ROLES_OF_OLDER_BOOKS)
  })
})

describe('categoryClassHelp', () => {
  it('names a class with the shares in force on the day, says how Kuna counts it, and links to its rule', () => {
    expect(categoryClassHelp('personal-transport', civil('2026-10-30'))).toEqual({
      name: 'Personal car costs: 50% added back, 50% of the VAT back',
      sentence: 'Kuna counts this under "Personal car costs: 50% added back, 50% of the VAT back".',
      link: { label: 'Rule on Tax rules', to: { path: '/company/settings', query: { tab: 'tax-rules', rule: 'hr.cit.personal-transport-add-back' } } },
    })
    expect(categoryClassHelp('tax-free:results-bonus', civil('2026-10-30'))?.name).toBe('Tax-free payment: results-bonus')
    expect(categoryClassHelp('capital-purchase', civil('2026-10-30'))?.name).toMatch(/^An asset above .*665.*, depreciated$/)
    expect(categoryClassHelp('arrears', civil('2026-10-30'))).toBeNull()
  })

  it('reads a day before the ruleset starts on its first day', () => {
    expect(categoryClassHelp('representation', civil('2024-06-01'))?.name).toBe('Representation: 50% added back to the profit tax base, no VAT back')
  })
})
