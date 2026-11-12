import { globSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { COMPANY_FACT_SETTINGS } from '../src/apps/company/packs/hr-doo/domain/companyFacts'
import { en, hr } from '../src/apps/company/packs/hr-doo/domain/words'
import { en as presentationEn, hr as presentationHr } from '../src/apps/company/packs/hr-doo/presentation/words'
import { IMPORT_PROFILE_PREFIX } from '../src/apps/company/imports/domain/importProfile'
import { SETTING_DEFINITIONS, settingCodec } from '../src/apps/company/settings/domain/settings'
import type { PackSettings } from '../src/apps/company/settings/domain/settings'
import { en as companyEn, hr as companyHr } from '../src/apps/company/settings/domain/words'
import { codecOfInvestmentsKind } from '../src/apps/investments/workbook/application/investmentsCodecs'
import { INVESTMENT_SETTING_CHECKS } from '../src/apps/investments/workbook/application/settingWrites'
import { SETTING_RECORDS as INVESTMENT_SETTINGS } from '../src/apps/investments/workbook/domain/investmentKinds'
import { en as investmentsEn, hr as investmentsHr } from '../src/apps/investments/workbook/domain/words'
import { codecOfSpendingKind } from '../src/apps/spending/workbook/application/spendingCodecs'
import { SPENDING_SETTING_CHECKS } from '../src/apps/spending/workbook/domain/readSpendingBook'
import { SETTING_RECORDS as SPENDING_SETTINGS } from '../src/apps/spending/workbook/domain/spendingKinds'
import { en as spendingEn, hr as spendingHr } from '../src/apps/spending/workbook/domain/words'
import { labelOfRecord } from '../src/shared/storage/domain/recordCodec'
import type { RecordCodec } from '../src/shared/storage/domain/recordCodec'
import type { SettingRow } from '../src/shared/storage/domain/settingRows'

const root = join(import.meta.dirname, '..')

/** Files that name a setting by its key because they read, write or map it, and show no copy. */
const KEEPS_KEYS = new Set([
  'src/apps/company/packs/hr-doo/domain/companyFacts.ts',
  'src/apps/company/packs/hr-doo/assistant/operations/proposalLines.ts',
  'src/apps/company/workbook/infrastructure/fake/fakeWorkbook.ts',
])

/** Each app's words that own its settings' labels, with the labels they hold in both languages. */
const LABEL_OWNERS: readonly { readonly file: string; readonly labels: readonly unknown[] }[] = [
  { file: 'src/apps/company/packs/hr-doo/domain/words.ts', labels: [en.settingNames, hr.settingNames] },
  { file: 'src/apps/company/settings/domain/words.ts', labels: [companyEn.settingLabels, companyHr.settingLabels] },
  { file: 'src/apps/spending/workbook/domain/words.ts', labels: [spendingEn.settingLabels, spendingHr.settingLabels] },
  { file: 'src/apps/investments/workbook/domain/words.ts', labels: [investmentsEn.settingLabels, investmentsHr.settingLabels] },
]

/** Words that spell a setting's label for another thing of the same name, such as a balance sheet line or a field an invoice prints. */
const NAMES_BEYOND_SETTINGS = new Set([
  'src/apps/company/workbook/domain/words.ts: Temeljni kapital',
  'src/apps/company/packs/hr-doo/ruleset/presentation/words.ts: Share capital',
  'src/apps/company/packs/hr-doo/ruleset/presentation/words.ts: Temeljni kapital',
  'src/apps/company/packs/hr-doo/presentation/yearEnd/words.ts: Share capital',
  'src/apps/company/packs/hr-doo/presentation/yearEnd/words.ts: Temeljni kapital',
  'src/apps/company/packs/hr-doo/domain/dividend/words.ts: Share capital',
  'src/apps/company/packs/hr-doo/domain/dividend/words.ts: Temeljni kapital',
  'src/apps/company/packs/hr-doo/domain/accrual/words.ts: Share capital',
  'src/apps/company/packs/hr-doo/domain/accrual/words.ts: Temeljni kapital',
  'src/apps/company/packs/hr-doo/presentation/yearEnd/words.ts: Prijava poreza na dobit',
  'src/apps/company/packs/hr-doo/presentation/forecast/words.ts: Prijava poreza na dobit',
  'src/apps/company/imports/application/words.ts: Mapa izvoda',
  'src/apps/company/billingPlan/presentation/words.ts: Mjesečna naknada',
  'src/apps/investments/tax/presentation/words.ts: Vaš grad u 2023.',
])

function textsOf(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  return typeof value === 'object' && value !== null ? Object.values(value).flatMap(textsOf) : []
}

/** A snake_case key, such as bank_sync_keep_mine, which no screen shows. */
const SNAKE_KEY = /\b[a-z0-9]+(?:_[a-z0-9]+)+\b/

function labelOfKey(codec: RecordCodec<SettingRow>, key: string): string {
  return labelOfRecord(codec, { id: 'setting-1' as SettingRow['id'], key, value: '' })
}

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

  it('writes each setting label once, in the words that own it, so a sentence naming a setting reads the label a rename changes', () => {
    const owners = LABEL_OWNERS.flatMap(({ file, labels }) =>
      textsOf(labels)
        .filter((label) => label.includes(' '))
        .map((label) => ({ file, label })),
    )
    const written = globSync('src/**/*[wW]ords.ts', { cwd: root }).flatMap((file) => {
      const text = readFileSync(join(root, file), 'utf8')
      return owners.filter((owner) => owner.file !== file && text.includes(owner.label)).map(({ label }) => `${file}: ${label}`)
    })

    expect(written.filter((line) => !NAMES_BEYOND_SETTINGS.has(line))).toEqual([])
  })

  it("names a setting in a change by its label in the app's language, never by its key", () => {
    const company = settingCodec(() => COMPANY_FACT_SETTINGS as PackSettings<unknown>)
    const labels = [
      ...[...SETTING_DEFINITIONS, ...COMPANY_FACT_SETTINGS.definitions].map(({ key }) => labelOfKey(company, key)),
      labelOfKey(company, `${IMPORT_PROFILE_PREFIX}otp`),
      ...[...SPENDING_SETTING_CHECKS.keys()].map((key) => labelOfKey(codecOfSpendingKind(SPENDING_SETTINGS), key)),
      ...[...INVESTMENT_SETTING_CHECKS.keys()].map((key) => labelOfKey(codecOfInvestmentsKind(INVESTMENT_SETTINGS), key)),
    ]

    expect(labels.filter((label) => SNAKE_KEY.test(label))).toEqual([])
    expect(labelOfKey(codecOfSpendingKind(SPENDING_SETTINGS), 'bank_sync_keep_mine')).toBe(spendingEn.settingLabels.keepMine)
  })
})
