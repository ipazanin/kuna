import { globSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { COMPANY_FACT_SETTINGS } from '../src/apps/company/packs/hr-doo/domain/companyFacts'
import { en, hr } from '../src/apps/company/packs/hr-doo/domain/words'
import { en as presentationEn, hr as presentationHr } from '../src/apps/company/packs/hr-doo/presentation/words'

const root = join(import.meta.dirname, '..')

/** Files that name a setting by its key because they read, write or map it, and show no copy. */
const KEEPS_KEYS = new Set([
  'src/apps/company/packs/hr-doo/domain/companyFacts.ts',
  'src/apps/company/packs/hr-doo/assistant/operations/proposalLines.ts',
  'src/apps/company/workbook/infrastructure/fake/fakeWorkbook.ts',
])

const OWNER = 'src/apps/company/packs/hr-doo/domain/words.ts'

const keys = COMPANY_FACT_SETTINGS.definitions.map((definition) => definition.key)

/** A line with each quoted key standing alone and each key written as an object key taken out, so only a key inside a sentence is left. */
function sentencesNamingAKey(line: string): boolean {
  const withoutBareKeys = keys.reduce((rest, key) => rest.replaceAll(`'${key}'`, '').replaceAll(`"${key}"`, '').replaceAll(`${key}:`, ''), line)
  return keys.some((key) => withoutBareKeys.includes(key))
}

describe('settings keys in copy', () => {
  it('lists the keys of the settings the screen labels', () => {
    expect(keys).toContain('hr_company_registered')
  })

  it('never shows a setting by its key in English or Croatian copy, only by its screen label', () => {
    const named = globSync(['src/**/*.ts', 'src/**/*.vue'], { cwd: root })
      .filter((file) => !KEEPS_KEYS.has(file))
      .flatMap((file) =>
        readFileSync(join(root, file), 'utf8')
          .split('\n')
          .flatMap((line, index) => (sentencesNamingAKey(line) ? [`${file}:${index + 1}`] : [])),
      )

    expect(named).toEqual([])
  })

  it('gives the settings card the label that every sentence naming the setting uses', () => {
    expect([presentationEn.facts.registered, presentationEn.facts.loanInterest, presentationEn.facts.citReturn, presentationEn.facts.vatPrinciple, presentationEn.facts.doubled]).toEqual(
      Object.values(en.settingNames),
    )
    expect([presentationHr.facts.registered, presentationHr.facts.loanInterest, presentationHr.facts.citReturn, presentationHr.facts.vatPrinciple, presentationHr.facts.doubled]).toEqual(
      Object.values(hr.settingNames),
    )
  })

  it('writes each setting label once, in the words that own it', () => {
    const labels = [en, hr].flatMap(({ settingNames }) => [settingNames.registered, settingNames.loanInterest, settingNames.doubled])
    const written = globSync(['src/**/*.ts', 'src/**/*.vue'], { cwd: root })
      .filter((file) => file !== OWNER)
      .flatMap((file) => {
        const text = readFileSync(join(root, file), 'utf8')
        return labels.filter((label) => text.includes(label)).map((label) => `${file}: ${label}`)
      })

    expect(written).toEqual([])
  })
})
