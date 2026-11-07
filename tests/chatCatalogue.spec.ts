import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { ASSETS_ASSISTANT } from '../src/apps/assets/assistant/assetsAssistant'
import { ASSETS_SETTINGS_ROUTE } from '../src/apps/assets/overview/presentation/assetLinks'
import { companyAssistant } from '../src/apps/company/assistant/companyAssistant'
import { HR_DOO_ASSISTANT } from '../src/apps/company/packs/hr-doo/assistant/hrDooAssistant'
import { COMPANY_FACT_SETTINGS } from '../src/apps/company/packs/hr-doo/domain/companyFacts'
import { SETTING_DEFINITIONS } from '../src/apps/company/settings/domain/settings'
import { INVESTMENTS_ASSISTANT } from '../src/apps/investments/assistant/investmentsAssistant'
import { LOANS_ASSISTANT } from '../src/apps/loans/assistant/loansAssistant'
import { SPENDING_ASSISTANT } from '../src/apps/spending/assistant/spendingAssistant'
import * as spendingKinds from '../src/apps/spending/workbook/domain/spendingKinds'
import { en as spendingWords, hr as spendingCroatian } from '../src/apps/spending/assistant/words'
import { catalogueOf, placeAt } from '../src/shared/ai/application/catalogue'
import { words as companyTransactionWords } from '../src/apps/company/transactions/presentation/words'
import type { CatalogueApp } from '../src/shared/ai/application/catalogue'
import { words as statementWords } from '../src/apps/spending/statements/presentation/words'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const COMPANY = companyAssistant(HR_DOO_ASSISTANT)

function appOf(id: string, assistant: CatalogueApp['assistant'], paths: readonly `/${string}`[]): CatalogueApp {
  return { id, name: id, purpose: `What ${id} keeps.`, screens: paths.map((path) => ({ path, title: path })), assistant }
}

const APPS: readonly CatalogueApp[] = [
  appOf('company', COMPANY, ['/company', '/company/transactions', '/company/settings']),
  appOf('loans', LOANS_ASSISTANT, ['/loans']),
  appOf('investments', INVESTMENTS_ASSISTANT, ['/investments', '/investments/settings']),
  appOf('assets', ASSETS_ASSISTANT, ['/assets', ASSETS_SETTINGS_ROUTE as `/${string}`]),
  appOf('spending', SPENDING_ASSISTANT, ['/spending', '/spending/transactions', '/spending/budgets', '/spending/settings']),
]
const KUNA_SCREENS = [{ path: '/settings', title: 'Kuna settings' }] as const

/** The source of each screen a place's tab belongs to, read as text, since a screen needs the Vue compiler to load. */
function sourceUnder(folder: string): string {
  return readdirSync(join(ROOT, folder), { recursive: true, encoding: 'utf8' })
    .filter((name) => /\.(ts|vue)$/.test(name))
    .map((name) => readFileSync(join(ROOT, folder, name), 'utf8'))
    .join('\n')
}

describe('the catalogue', () => {
  const catalogue = catalogueOf(APPS, KUNA_SCREENS)

  it('gives the same bytes on every run, as a cached prefix needs', () => {
    const again = catalogueOf(APPS, KUNA_SCREENS)
    expect(again.system).toBe(catalogue.system)
    expect([...again.pages]).toEqual([...catalogue.pages])
    expect([...again.routes]).toEqual([...catalogue.routes])
  })

  it('finds the place a person is on by the query values it names, and only those', () => {
    expect(placeAt(catalogue, '/company/transactions', { tab: 'review', counterparty: 'anyone' })).toEqual({ address: '/company/transactions?tab=review', title: companyTransactionWords.tabs.review })
    expect(placeAt(catalogue, '/company/transactions', { tab: 'rows' })).toBeNull()
    expect(placeAt(catalogue, '/company/transactions', {})).toBeNull()
  })

  it('keeps its instructions under their budget of 4,000 tokens at three characters each', () => {
    expect(catalogue.system.length / 3).toBeLessThan(4000)
  })

  it('names every page the instructions and each app page list', () => {
    const named = [...catalogue.system.matchAll(/^- ([a-z-]+):/gm), ...[...catalogue.pages.values()].flatMap((page) => [...page.matchAll(/^- ([a-z-]+\/guide\/[a-z-]+):/gm)])].map((match) => match[1]!)
    expect(named).toContain('spending/guide/first-rules')
    for (const path of named.filter((name) => APPS.some((app) => name.startsWith(app.id)) || name === 'kuna')) {
      expect(catalogue.pages.has(path), path).toBe(true)
    }
  })

  it('lists every kind Spending stores and every settings key Company reads', () => {
    const spending = catalogue.pages.get('spending')!
    for (const kind of Object.values(spendingKinds)) expect(spending).toContain(`(${kind.name})`)
    const company = catalogue.pages.get('company')!
    for (const definition of [...SETTING_DEFINITIONS, ...COMPANY_FACT_SETTINGS.definitions]) expect(company).toContain(`- ${definition.key}: `)
  })

  it('holds no secret, however the code spells a key', () => {
    const whole = [catalogue.system, ...catalogue.pages.values()].join('\n')
    expect(whole).not.toMatch(/kuna\.secret|kuna-secrets|kuna-investments-keys|made-up-|sk-[a-z]+-|ya29\.|AIza/)
  })

  it('tells the model to name what Kuna cannot do, link the issues page and write no report', () => {
    expect(catalogue.system).toContain('call show_screen with the route "issues"')
    expect(catalogue.system).toContain('Do not write that report for them')
    expect(catalogue.system).not.toContain('github.com')
  })

  it('links each place to a screen of its app and a tab that screen has', () => {
    const owners: Readonly<Record<string, string>> = {
      '/company/settings': 'src/apps/company/settings/presentation',
      '/company/transactions': 'src/apps/company/transactions/presentation',
      '/investments/settings': 'src/apps/investments/settings/presentation',
      '/spending/settings': 'src/apps/spending/settings/presentation',
      '/spending/transactions': 'src/apps/spending/entries/presentation',
    }
    for (const app of APPS) {
      for (const place of app.assistant.places) {
        const [path, query] = place.route.split('?') as [string, string]
        expect(
          app.screens.map((screen) => screen.path as string),
          place.route,
        ).toContain(path)
        const tab = new URLSearchParams(query).get('tab')!
        expect(sourceUnder(owners[path]!), place.route).toMatch(new RegExp(`['"\`]${tab}['"\`]|_TAB\\b`))
      }
    }
  })

  it('sends each guide only to places and screens the catalogue can link', () => {
    for (const app of APPS) {
      for (const guide of app.assistant.guides) {
        for (const place of guide.places) expect(catalogue.routes.has(place), `${guide.id}: ${place}`).toBe(true)
      }
    }
  })

  it('calls things in a guide what the screen calls them, in both languages', () => {
    const guide = catalogue.pages.get('spending/guide/first-rules')!
    expect(guide).toContain(statementWords.review.always)
    const labels = { entries: 'E', review: 'R', import: 'I', always: 'A', settings: 'S', rules: 'U', bankSync: 'B', limits: 'L', general: 'G', deployment: 'D' }
    for (const words of [spendingWords, spendingCroatian]) {
      expect(words.guides.rules.body(labels)).toContain('A')
      expect(Object.keys(words.guides)).toEqual(['rules', 'import', 'bankSync', 'limits', 'categories'])
    }
  })
})
