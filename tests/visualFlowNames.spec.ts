import { describe, expect, it, vi } from 'vitest'

import type { AppContribution } from '../src/shared/app/appContribution'
import { APP_ORDER } from '../src/shell/routing/appRegistry'
import { assetsVisualFlows } from '../scripts/support/assetsVisualFlows.mjs'
import { companyVisualFlows } from '../scripts/support/companyVisualFlows.mjs'
import { investmentsVisualFlows } from '../scripts/support/investmentsVisualFlows.mjs'
import { loansVisualFlows } from '../scripts/support/loansVisualFlows.mjs'
import { shellVisualFlows } from '../scripts/support/shellVisualFlows.mjs'
import { spendingVisualFlows } from '../scripts/support/spendingVisualFlows.mjs'

// The specs run without the Vue compiler or Nuxt UI's app, which each app's sync status and toasts need.
vi.mock('../src/apps/spending/workbook/presentation/LocalSpendingStatus.vue', () => ({ default: {} }))
vi.mock('../src/apps/company/workbook-files/presentation/LocalWorkbookStatus.vue', () => ({ default: {} }))
vi.mock('../src/apps/investments/workbook/presentation/LocalInvestmentsStatus.vue', () => ({ default: {} }))
vi.mock('../src/apps/loans/workbook/presentation/LocalLoansStatus.vue', () => ({ default: {} }))
vi.mock('../src/apps/assets/workbook/presentation/LocalAssetsStatus.vue', () => ({ default: {} }))
vi.mock('@nuxt/ui/composables/useToast', () => ({ useToast: () => ({ add: () => undefined }) }))

const APPS: readonly AppContribution[] = [
  (await import('../src/apps/spending/app')).spendingApp,
  (await import('../src/apps/company/app')).companyApp,
  (await import('../src/apps/investments/app')).investmentsApp,
  (await import('../src/apps/loans/app')).loansApp,
  (await import('../src/apps/assets/app')).assetsApp,
]

/** The files a flow drops on a page, which no flow reads while the list is built. */
const SAMPLES = {
  IMPORT_FILE: '',
  IMPORT_SAMPLES: {},
  SPENDING_IMPORT_SAMPLES: {},
  SPENDING_RECEIPT_SAMPLES: {},
  CHAT_ATTACHMENT_SAMPLES: {},
  WORKBOOK_SAMPLES: {},
  FLEX_REPORT_SAMPLES: {},
  CLOSES_SAMPLES: {},
}

const FLOWS: readonly { name: string; hash: string }[] = [
  ...shellVisualFlows(SAMPLES),
  ...spendingVisualFlows(SAMPLES),
  ...companyVisualFlows(SAMPLES),
  ...investmentsVisualFlows(SAMPLES),
  ...loansVisualFlows(),
  ...assetsVisualFlows(),
]

/** Each app screen below the app's own page, such as /company/sorting, with the prefix its flows' names start with, such as company-sorting. */
const SCREENS = APPS.flatMap((app) => app.screens)
  .map((screen) => screen.path)
  .filter((path) => path.split('/').length > 2)
  .map((path) => ({ path, prefix: path.slice(1).replaceAll('/', '-') }))

/** The screen a flow's name says it opens, the longest prefix it starts with so spending-accounts is not read as spending-account. */
function namedScreen(name: string) {
  const named = SCREENS.filter(({ prefix }) => name === prefix || name.startsWith(`${prefix}-`))
  return named.sort((left, right) => right.prefix.length - left.prefix.length)[0] ?? null
}

function opensOn(hash: string, path: string): boolean {
  const opened = new URL(hash.slice(1), 'https://kuna.invalid').pathname
  return opened === path || opened.startsWith(`${path}/`)
}

describe("a visual flow's name", () => {
  it('reads the screens of every app', () => {
    expect(APPS.map((app) => app.id)).toEqual([...APP_ORDER])
  })

  it('is given to one flow only, since the shot index tells flows apart by name', () => {
    const named = FLOWS.map((flow) => flow.name)

    expect(named.filter((name, index) => named.indexOf(name) !== index)).toEqual([])
  })

  it('opens the screen its name starts with, so company-sorting-* opens #/company/sorting', () => {
    const astray = FLOWS.flatMap((flow) => {
      const screen = namedScreen(flow.name)
      return screen === null || opensOn(flow.hash, screen.path) ? [] : [`${flow.name} opens ${flow.hash}, not #${screen.path}`]
    })

    expect(astray).toEqual([])
  })
})
