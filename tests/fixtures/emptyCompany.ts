import { DEFAULT_SETTINGS } from '../../src/apps/company/settings/domain/settings'
import type { Workbook } from '../../src/apps/company/workbook/domain/workbook'

/** A Company workbook kept in this browser with nothing in it and the default settings, for a spec that needs empty lists rather than the HR d.o.o. example. */
export function emptyCompany(changes: Partial<Workbook> = {}): Workbook {
  return {
    id: 'empty-company',
    source: 'browser',
    title: 'Empty company',
    syncedAt: '2026-10-18T00:00:00.000Z',
    transactions: [],
    categories: [],
    accounts: [],
    rules: [],
    invoices: [],
    clients: [],
    billingPlan: [],
    ownerAdvances: [],
    splits: [],
    rowsKeptWhole: new Map(),
    dismissals: [],
    settings: DEFAULT_SETTINGS,
    packParts: {},
    problems: [],
    ...changes,
  }
}
