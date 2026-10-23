import { describe, expect, it } from 'vitest'

import type { ChartTokens } from '../src/shared/charts/chartTokens'
import { categoryColourOf } from '../src/features/workbook/domain/categoryColour'
import type { Category } from '../src/features/workbook/domain/workbook'
import { categorySeries } from '../src/packs/hr-doo/presentation/packCharts'
import { PACK_CATEGORIES } from './fixtures/hrDooCategories'

const TOKENS = { series: ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'], deemphasis: 'grey' } as unknown as ChartTokens
const TAXES = PACK_CATEGORIES.filter((category) => category.bucket === 'taxes')
const name = (slug: string) => slug

function paints(listed: readonly Category[], moved: readonly string[]): [string, string, string][] {
  return categorySeries(listed, moved, TOKENS, name).map((entry) => [entry.name, entry.token, entry.colour])
}

function taxed(slug: string, colour: string): Category {
  return { ...TAXES.find((category) => category.slug === slug)!, colour: categoryColourOf(colour) }
}

describe('categorySeries', () => {
  it('keeps each tax category in its colour when another one paid nothing in the period', () => {
    const everyTax = paints(
      TAXES,
      TAXES.map((category) => category.slug),
    )
    const withoutPayrollTax = paints(
      TAXES,
      TAXES.map((category) => category.slug).filter((slug) => slug !== 'payroll-tax'),
    )

    expect(everyTax.map(([slug, token]) => [slug, token])).toEqual([
      ['payroll-contributions', '--series-1'],
      ['payroll-tax', '--series-2'],
      ['corporate-income-tax', '--series-3'],
      ['dividend-tax', '--series-4'],
      ['tax-refund', '--series-5'],
    ])
    expect(withoutPayrollTax).toEqual(everyTax.filter(([slug]) => slug !== 'payroll-tax'))
  })

  it('paints a category in the swatch it was given, and the rest by their place', () => {
    const listed = TAXES.map((category) =>
      category.slug === 'corporate-income-tax' ? taxed(category.slug, '#6250D6') : category.slug === 'tax-refund' ? taxed(category.slug, '#a3adb9') : category,
    )

    expect(paints(listed, ['payroll-contributions', 'corporate-income-tax', 'tax-refund'])).toEqual([
      ['payroll-contributions', '--series-1', 's1'],
      ['corporate-income-tax', '--series-7', 's7'],
      ['tax-refund', '--chart-deemphasis', 'grey'],
    ])
  })

  it('gives the categories without a colour the slots no listed category was given', () => {
    const listed = TAXES.map((category) => (category.slug === 'dividend-tax' ? taxed(category.slug, '#1baf7a') : category))

    expect(paints(listed, ['payroll-contributions', 'dividend-tax', 'tax-refund'])).toEqual([
      ['payroll-contributions', '--series-2', 's2'],
      ['dividend-tax', '--series-1', 's1'],
      ['tax-refund', '--series-5', 's5'],
    ])
  })

  it('takes a colour outside the palette as none, so the category keeps the slot of its place', () => {
    expect(paints([taxed('payroll-contributions', '#f9dcdc')], ['payroll-contributions'])).toEqual([['payroll-contributions', '--series-1', 's1']])
  })

  it('folds the categories past the eight free slots into one grey series of those that moved', () => {
    const listed = Array.from({ length: 10 }, (_, index) => ({ ...TAXES[0]!, slug: `tax-${index + 1}` }))

    expect(paints(listed, ['tax-2', 'tax-9'])).toEqual([
      ['tax-2', '--series-2', 's2'],
      ['Other categories', '--chart-deemphasis', 'grey'],
    ])
    expect(categorySeries(listed, ['tax-2', 'tax-9'], TOKENS, name).at(-1)?.categories).toEqual(['tax-9'])
    expect(paints(listed, ['tax-2']).map(([slug]) => slug)).toEqual(['tax-2'])
  })
})
