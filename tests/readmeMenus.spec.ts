import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

import type { AppContribution } from '../src/shared/app/appContribution'

// The specs run without the Vue compiler or Nuxt UI's app, which each app's export control and the toasts need.
vi.mock('../src/apps/company/workbook-files/presentation/LocalWorkbookStatus.vue', () => ({ default: {} }))
vi.mock('../src/apps/loans/workbook/presentation/LocalLoansStatus.vue', () => ({ default: {} }))
vi.mock('../src/apps/investments/workbook/presentation/LocalInvestmentsStatus.vue', () => ({ default: {} }))
vi.mock('../src/apps/assets/workbook/presentation/LocalAssetsStatus.vue', () => ({ default: {} }))
vi.mock('../src/apps/spending/workbook/presentation/LocalSpendingStatus.vue', () => ({ default: {} }))
vi.mock('@nuxt/ui/composables/useToast', () => ({ useToast: () => ({ add: () => undefined }) }))

const { APP_ORDER } = await import('../src/shell/routing/appRegistry')
const { hrDooPack } = await import('../src/apps/company/packs/hr-doo/hrDooPack')
const apps: readonly AppContribution[] = await Promise.all([
  import('../src/apps/spending/app').then((module) => module.spendingApp),
  import('../src/apps/company/app').then((module) => module.companyApp),
  import('../src/apps/investments/app').then((module) => module.investmentsApp),
  import('../src/apps/loans/app').then((module) => module.loansApp),
  import('../src/apps/assets/app').then((module) => module.assetsApp),
])

const root = join(import.meta.dirname, '..')
const PACK_ROW = 'Company, d.o.o. pack'

/** The rows of README's table of each app's menu and Settings tabs, by the app's name. */
function readmeRows(readme: string): ReadonlyMap<string, { readonly menu: readonly string[]; readonly tabs: readonly string[] }> {
  const heading = readme.indexOf('| App ')
  const table = readme.slice(heading).split('\n\n')[0]!.split('\n').slice(2)
  const list = (cell: string): string[] =>
    cell
      .split(',')
      .map((name) => name.trim())
      .filter((name) => name !== '')
  return new Map(
    table.map((line) => {
      const [app, menu, tabs] = line
        .split('|')
        .slice(1, 4)
        .map((cell) => cell.trim())
      return [app!, { menu: list(menu!), tabs: list(tabs!) }]
    }),
  )
}

/**
 * The English labels of a Settings screen's tabs, in the order its script writes them. Each label is a words module's
 * entry, such as `words.tabs.general`, read from the module the script imports it from.
 */
async function settingsTabLabels(file: string): Promise<string[]> {
  const script = readFileSync(join(root, file), 'utf8').split('</script>')[0]!
  const imported = new Map(
    [...script.matchAll(/^import \{ ([^}]+) \} from '([^']+)'/gm)].flatMap(([, names, from]) =>
      names!.split(',').map((name) => {
        const [exported, local] = name.trim().split(/\s+as\s+/)
        return [local ?? exported!, { exported: exported!, from: from! }] as const
      }),
    ),
  )
  const labels = [...script.matchAll(/\{ (?:value: [^,]+, label: ([\w.]+)|label: ([\w.]+), value: )/g)].map((match) => match[1] ?? match[2]!)
  return Promise.all(
    labels.map(async (label) => {
      const [local, ...path] = label.split('.')
      const source = imported.get(local!)
      if (source === undefined) throw new Error(`${file} labels a tab with ${label}, which it imports from no module.`)
      const module = (await import(join(root, dirname(file), source.from))) as Record<string, unknown>
      const text = path.reduce<unknown>((entry, key) => (entry as Record<string, unknown>)[key], module[source.exported])
      if (typeof text !== 'string') throw new Error(`${file} labels a tab with ${label}, which is no text.`)
      return text
    }),
  )
}

describe("README's table of the menus and Settings tabs", () => {
  const rows = readmeRows(readFileSync(join(root, 'README.md'), 'utf8'))
  const packPaths = new Set(hrDooPack.screens.map((screen) => screen.path))

  it('has a row per app in the menu’s order and one for the pack', () => {
    expect(apps.map((app) => app.id)).toEqual(APP_ORDER)
    expect([...rows.keys()]).toEqual([...apps.map((app) => app.name), PACK_ROW])
  })

  it.each(apps.map((app) => [app.name, app] as const))('lists the menu and the Settings tabs of %s', async (name, app) => {
    const settingsFile = `src/apps/${app.id}/settings/presentation/SettingsScreen.vue`
    expect(existsSync(join(root, settingsFile))).toBe(true)
    expect(rows.get(name)?.menu).toEqual(app.menu().flatMap((screen) => (packPaths.has(screen.path) ? [] : [screen.title])))
    expect(rows.get(name)?.tabs).toEqual(await settingsTabLabels(settingsFile))
  })

  it('lists the screens and the Settings tabs the d.o.o. pack adds to the company', () => {
    expect(rows.get(PACK_ROW)).toEqual({ menu: hrDooPack.screens.map((screen) => screen.title), tabs: hrDooPack.settingsTabs.map((tab) => tab.label) })
  })
})
