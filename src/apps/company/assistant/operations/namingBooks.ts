import type { Workbook } from '../../workbook/domain/workbook'

/** The records `after` holds, then those of `before` it no longer holds by their key. */
export function withRemoved<R>(after: readonly R[], before: readonly R[], keyOf: (record: R) => unknown): readonly R[] {
  const kept = new Set(after.map(keyOf))
  return [...after, ...before.filter((record) => !kept.has(keyOf(record)))]
}

/**
 * The books a card names records from: as its steps leave them, so a label or category an earlier step adds reads by its name,
 * with each record a step removes as it was, so a removal still reads by name too. `packRecords` does the same for the pack's records.
 */
export function namingBooks(before: Workbook, after: Workbook, packRecords: ((before: Workbook, after: Workbook) => Workbook) | null): Workbook {
  const named: Workbook = {
    ...after,
    transactions: withRemoved(after.transactions, before.transactions, (transaction) => transaction.id),
    categories: withRemoved(after.categories, before.categories, (category) => category.slug),
    accounts: withRemoved(after.accounts, before.accounts, (account) => account.slug),
    labels: withRemoved(after.labels, before.labels, (label) => label.id),
    clients: withRemoved(after.clients, before.clients, (client) => client.slug),
    invoices: withRemoved(after.invoices, before.invoices, (invoice) => invoice.id),
  }
  return packRecords === null ? named : packRecords(before, named)
}
