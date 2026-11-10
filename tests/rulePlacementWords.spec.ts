import { describe, expect, it } from 'vitest'

import { placementChoices, placementWords } from '../src/apps/company/rules/presentation/placementWords'
import { words } from '../src/apps/company/rules/presentation/words'

const RULES = [
  { id: 'merchant-model', order: 100 },
  { id: 'office-market', order: 200 },
  { id: 'bank-fees', order: 300 },
]

describe("where a rule is tried, in the rule form's words", () => {
  it('says the top place as first, a place before another rule by its name, and the end as after every rule', () => {
    expect(placementWords('merchant-model', true)).toBe(words.form.first)
    expect(placementWords('office-market', false)).toBe(words.form.before('office-market'))
    expect(placementWords(null, false)).toBe(words.form.last)
  })

  it('offers the top place as first in the form, leaving out the rule being edited', () => {
    expect(placementChoices(RULES, 'merchant-model', ' last')).toEqual([
      { value: 'office-market', label: words.form.first },
      { value: 'bank-fees', label: words.form.before('bank-fees') },
      { value: ' last', label: words.form.last },
    ])
  })
})
