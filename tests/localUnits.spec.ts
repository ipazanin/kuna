import { describe, expect, it } from 'vitest'

import { localRates } from '../src/apps/company/packs/hr-doo/domain/payroll/incomeTax'
import { LOCAL_UNITS, findLocalUnit } from '../src/apps/company/packs/hr-doo/ruleset/localUnits'
import { ruleValue } from '../src/apps/company/packs/hr-doo/ruleset/ruleset'
import { day } from '../src/apps/company/packs/hr-doo/ruleset/schema'

function labelOf(typed: string): string | null {
  return findLocalUnit(typed).unit?.label ?? null
}

describe('findLocalUnit', () => {
  it('reads a name in any case, with or without diacritics and with or without Grad or Općina', () => {
    expect(new Set(['Rijeka', 'rijeka', 'GRAD RIJEKA', 'Grad Rijeka', '  grad  rijeka '].map(labelOf))).toEqual(new Set(['Grad Rijeka']))
    expect(new Set(['Zagreb', 'grad zagreb', 'Grad Zagreb'].map(labelOf))).toEqual(new Set(['Grad Zagreb']))
    expect(labelOf('cakovec')).toBe('Grad Čakovec')
    expect(labelOf('Đakovo')).toBe('Grad Đakovo')
    expect(labelOf('opcina bale')).toBe('Općina Bale – Valle')
  })

  it('reads either name of a bilingual unit, with any dash between them', () => {
    expect(new Set(['Pula', 'Pola', 'Pula – Pola', 'PULA - POLA', 'pula-pola'].map(labelOf))).toEqual(new Set(['Grad Pula – Pola']))
  })

  it('refuses a name two units share until the type or the county tells them apart', () => {
    expect(findLocalUnit('Otok').problem).toBe('"Otok" could be Općina Otok (Splitsko-dalmatinska) or Grad Otok (Vukovarsko-srijemska), so choose one')
    expect(labelOf('Grad Otok')).toBe('Grad Otok')
    expect(labelOf('Općina Sveta Nedelja')).toBe('Općina Sveta Nedelja')
    expect(findLocalUnit('Privlaka').problem).toBe('"Privlaka" could be Općina Privlaka (Vukovarsko-srijemska) or Općina Privlaka (Zadarska), so choose one')
    expect(labelOf('Privlaka (Zadarska)')).toBe('Općina Privlaka (Zadarska)')
    expect(labelOf('opcina privlaka (zadarska zupanija)')).toBe('Općina Privlaka (Zadarska)')
  })

  it('refuses a name that is no unit, a unit of the wrong type and a blank', () => {
    expect(findLocalUnit('Atlantis').problem).toBe('"Atlantis" is not a Croatian city or municipality')
    expect(findLocalUnit('Općina Zagreb').problem).toBe('"Općina Zagreb" is not a Croatian city or municipality')
    expect(findLocalUnit('Zagreb (Istarska)').unit).toBeNull()
    expect(findLocalUnit(' ').problem).toBe('name the city or municipality')
  })

  it('finds every unit by its own label', () => {
    const lost = LOCAL_UNITS.filter((unit) => findLocalUnit(unit.label).unit !== unit).map((unit) => unit.label)
    expect(LOCAL_UNITS).toHaveLength(556)
    expect(lost).toEqual([])
  })
})

describe('localRates', () => {
  function ratesOf(city: string, on: string): readonly [number, number] {
    const rates = localRates(city, day(on), ruleValue)
    return [rates.lowerRate, rates.higherRate]
  }

  it('gives Split 21.5% and 32.25% until 28 February 2025, then 21.5% and 32%', () => {
    expect(ratesOf('Split', '2025-02-28')).toEqual([2150, 3225])
    expect(ratesOf('Split', '2025-03-01')).toEqual([2150, 3200])
    expect(ratesOf('Grad Split', '2026-06-30')).toEqual([2150, 3200])
  })

  it('gives Zagreb 23% and 33% from 1 March 2025, after the 23.6% and 35.4% of its 2024 decision', () => {
    expect(ratesOf('Zagreb', '2025-01-01')).toEqual([2360, 3540])
    expect(ratesOf('Zagreb', '2025-03-01')).toEqual([2300, 3300])
    expect(ratesOf('Zagreb', '2026-12-31')).toEqual([2300, 3300])
  })

  it('follows a unit that changed its rates on 1 January 2026', () => {
    expect(ratesOf('Općina Otok', '2025-12-31')).toEqual([2000, 3000])
    expect(ratesOf('Općina Otok', '2026-01-01')).toEqual([1700, 2700])
  })

  it('refuses a name the lookup refuses, with its reason', () => {
    expect(() => localRates('Otok', day('2026-01-01'), ruleValue)).toThrow('No local income tax rates on 2026-01-01: "Otok" could be')
  })
})
