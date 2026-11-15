import { describe, expect, it } from 'vitest'

import { RULES } from '../src/apps/company/packs/hr-doo/ruleset/ruleset'
import { CROATIAN_TERM_LABELS } from '../src/apps/company/packs/hr-doo/ruleset/presentation/termLabels'
import type { Term } from '../src/apps/company/packs/hr-doo/ruleset/schema'

function keysOf([key, term]: [string, Term]): string[] {
  return [key, ...(term.kind === 'table' ? term.rows.flatMap((row) => Object.keys(row)) : [])]
}

describe('the Croatian labels of the rules’ terms', () => {
  it('names every term and table column a rule holds, and nothing no rule holds', () => {
    const keys = new Set(RULES.flatMap((rule) => rule.versions.flatMap((version) => Object.entries<Term>(version.value).flatMap(keysOf))))

    expect([...keys].filter((key) => CROATIAN_TERM_LABELS[key] === undefined)).toEqual([])
    expect(Object.keys(CROATIAN_TERM_LABELS).filter((key) => !keys.has(key))).toEqual([])
  })
})
