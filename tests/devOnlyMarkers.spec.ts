import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { FAKE_WORKBOOK_ID } from '../src/apps/company/workbook/infrastructure/fake/fakeWorkbook'
import { REAL_BOOKS_ID } from '../src/shared/storage/infrastructure/real/realBooks'
import { FAKE_WORKBOOK_MARKER, GALLERY_MARKER, REAL_BOOKS_MARKER } from '../scripts/support/devOnlyMarkers.mjs'

describe('dev-only markers', () => {
  it('uses the fake marker as the fake workbook spreadsheet id, which every use of the fixture carries', () => {
    expect(FAKE_WORKBOOK_ID).toBe(FAKE_WORKBOOK_MARKER)
  })

  it('uses the real-books marker in the id the real books are kept under in the browser', () => {
    expect(REAL_BOOKS_ID).toBe(REAL_BOOKS_MARKER)
  })

  it.each(['src/shell/gallery/GalleryScreen.vue', 'src/apps/company/gallery/CompanyGallery.vue'])('stamps the root of %s with the marker the build looks for', (file) => {
    const gallery = readFileSync(join(import.meta.dirname, '..', file), 'utf8')

    expect(gallery).toContain(`data-dev-only="${GALLERY_MARKER}"`)
  })
})
