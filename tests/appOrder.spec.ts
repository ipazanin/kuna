import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { APP_ORDER, inAppOrder } from '../src/shell/routing/appRegistry'

describe('the order of the apps', () => {
  it('shows Spending, Company, Investments, Loans and Assets whatever order they were installed in', () => {
    const installed = ['company', 'loans', 'investments', 'assets', 'spending'].map((id) => ({ id }))

    expect(inAppOrder(installed).map((app) => app.id)).toEqual(['spending', 'company', 'investments', 'loans', 'assets'])
  })

  it('puts an app the order does not name last', () => {
    expect(inAppOrder([{ id: 'notes' }, { id: 'loans' }, { id: 'spending' }]).map((app) => app.id)).toEqual(['spending', 'loans', 'notes'])
  })

  it('names every app in src/apps', () => {
    const apps = readdirSync(join(import.meta.dirname, '../src/apps'), { withFileTypes: true }).filter((entry) => entry.isDirectory())

    expect([...APP_ORDER].sort()).toEqual(apps.map((entry) => entry.name).sort())
  })
})
