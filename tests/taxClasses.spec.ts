import { describe, expect, it } from 'vitest'

import { HR_DOO_PART } from '../src/apps/company/packs/hr-doo/domain/hrDooPart'
import { TAX_CLASSES } from '../src/apps/company/packs/hr-doo/preset/domain/taxClasses'
import { RULES } from '../src/apps/company/packs/hr-doo/ruleset/ruleset'
import { knownRoles } from '../src/apps/company/settings/domain/categoryGuards'
import { BUCKETS } from '../src/apps/company/workbook/domain/bucket'
import { VAT_TREATMENTS } from '../src/apps/company/workbook/domain/vatTreatment'

describe('tax classes', () => {
  it.each(TAX_CLASSES.map((taxClass) => [taxClass.id, taxClass] as const))('reads the class %s from rules the ruleset holds', (_id, taxClass) => {
    const ruleIds = RULES.map((rule) => rule.id)
    expect(taxClass.rules.filter((rule) => !ruleIds.includes(rule))).toEqual([])
    if (taxClass.addBack !== null) expect(taxClass.rules).toContain(taxClass.addBack)
  })

  it('is carried by roles a category may carry, each role by one class only', () => {
    const roles = TAX_CLASSES.flatMap((taxClass) => taxClass.roles)
    expect(roles.filter((role) => !knownRoles(HR_DOO_PART.categoryRoles).includes(role))).toEqual([])
    expect(new Set(roles).size).toBe(roles.length)
    expect(TAX_CLASSES.every((taxClass) => taxClass.roles.length > 0)).toBe(true)
  })

  it('names each class once', () => {
    expect(new Set(TAX_CLASSES.map((taxClass) => taxClass.id)).size).toBe(TAX_CLASSES.length)
  })

  it('allows only VAT treatments and buckets the categories tab knows, at least one of each', () => {
    for (const taxClass of TAX_CLASSES) {
      expect(taxClass.vat.length, taxClass.id).toBeGreaterThan(0)
      expect(taxClass.buckets.length, taxClass.id).toBeGreaterThan(0)
      expect(
        taxClass.vat.filter((treatment) => !VAT_TREATMENTS.includes(treatment)),
        taxClass.id,
      ).toEqual([])
      expect(
        taxClass.buckets.filter((bucket) => !BUCKETS.includes(bucket)),
        taxClass.id,
      ).toEqual([])
    }
  })

  it('lets a personal car category take no VAT, for a registration fee, after the treatments of its running costs', () => {
    expect(TAX_CLASSES.find((taxClass) => taxClass.id === 'personal-transport')?.vat).toEqual(['car-50', 'foreign-vat', 'none'])
  })
})
