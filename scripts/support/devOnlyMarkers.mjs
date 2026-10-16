/**
 * Strings that prove dev-only code reached a production bundle. The fake workbook's spreadsheet id
 * is the first, because every use of the fixture carries it. The gallery page's root attribute is
 * the second. The fixture and GalleryScreen.vue cannot import from here, so
 * tests/devOnlyMarkers.spec.ts holds their copies to these.
 */

export const FAKE_WORKBOOK_MARKER = 'FAKE-WORKBOOK-ONLY-DO-NOT-SHIP'

export const GALLERY_MARKER = 'DEV-GALLERY-ONLY-DO-NOT-SHIP'
