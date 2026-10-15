/**
 * Strings that prove dev-only code reached a production bundle. The fake workbook's spreadsheet id
 * is the first, because every use of the fixture carries it. The spike's log prefix is the second.
 * The fixture and SpikeScreen.vue cannot import from here, so tests/devOnlyMarkers.spec.ts holds
 * their copies to these.
 */

export const FAKE_WORKBOOK_MARKER = 'FAKE-WORKBOOK-ONLY-DO-NOT-SHIP'

export const SPIKE_LOG_PREFIX = '[spike]'
