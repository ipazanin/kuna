import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { HR_DOO_PART } from '../src/apps/company/packs/hr-doo/domain/hrDooPart'
import { TAX_CLASSES } from '../src/apps/company/packs/hr-doo/preset/domain/taxClasses'
import { en as classWords } from '../src/apps/company/packs/hr-doo/preset/presentation/classWords'
import { RULES } from '../src/apps/company/packs/hr-doo/ruleset/ruleset'
import { knownRoles } from '../src/apps/company/settings/domain/categoryGuards'
import { BUCKETS } from '../src/apps/company/workbook/domain/bucket'
import { VAT_TREATMENTS } from '../src/apps/company/workbook/domain/vatTreatment'
import { anchorOf } from './support/headingAnchor'

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

  describe('the car costs the personal transport add-back leaves out', () => {
    // PravPD Art. 25(1) leaves these out of ZPD Art. 7(1)(4). The rule's note, the class that carries them and its doc section name each.
    const LEFT_OUT = ['insurance', 'interest', 'vehicle tax', 'registration fees']
    const carried = TAX_CLASSES.filter((taxClass) => taxClass.addBack === null && taxClass.rules.includes('hr.cit.personal-transport-add-back'))
    const note = RULES.find((rule) => rule.id === 'hr.cit.personal-transport-add-back')?.versions.at(-1)?.note ?? ''

    it('names them in the rule note', () => {
      expect(LEFT_OUT.filter((cost) => !note.toLowerCase().includes(cost))).toEqual([])
    })

    it('gives them one class, which names them in its help and its doc section', () => {
      expect(carried.map((taxClass) => taxClass.id)).toEqual(['vehicle-insurance-interest-tax-and-fees'])
      const help = classWords.classes.vehicleInsuranceInterestTaxAndFees.toLowerCase()
      const [file, anchor] = carried[0]!.law.split('#')
      const section =
        readFileSync(`docs/law/${file}`, 'utf8')
          .split(/^## /m)
          .find((part) => anchorOf(part.slice(0, part.indexOf('\n'))) === anchor) ?? ''
      expect(LEFT_OUT.filter((cost) => !help.includes(cost))).toEqual([])
      expect(LEFT_OUT.filter((cost) => !section.toLowerCase().includes(cost))).toEqual([])
    })

    it('leaves none of them in the personal transport class', () => {
      const transport = TAX_CLASSES.find((taxClass) => taxClass.id === 'personal-transport')!
      expect(transport.addBack).toBe('hr.cit.personal-transport-add-back')
      expect(classWords.classes.personalTransport('50%', '50%').toLowerCase()).not.toMatch(/insurance|interest|registration|vehicle tax/)
    })
  })

  it('lets a personal car category take no VAT, for a supplier outside the VAT system, after the treatments of its running costs', () => {
    expect(TAX_CLASSES.find((taxClass) => taxClass.id === 'personal-transport')?.vat).toEqual(['car-50', 'foreign-vat', 'none'])
  })
})
