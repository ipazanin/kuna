import { describe, expect, it } from 'vitest'

import type { DriveEntry } from '../src/apps/company/documents/application/driveFiling'
import { FAKE_INVOICE_FOLDER, createFakeFilingDrive } from '../src/apps/company/documents/infrastructure/fake/fakeFilingDrive'
import { fileTripDocuments } from '../src/apps/company/packs/hr-doo/application/tripFiling'
import { civil } from './fixtures/ledger'

const TRIP = { issued: civil('2026-03-10') }
const FILES = [
  { name: 'putni-nalog-1-2026.pdf', content: new Uint8Array([1]), mimeType: 'application/pdf' },
  { name: 'putni-nalog-1-2026.xlsx', content: new Uint8Array([2]), mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
]

/** The fake Drive with the folder picked as the travel orders folder, and the Picker picking what `picks` says inside it. */
async function pickedDrive(picks: (offered: readonly DriveEntry[]) => readonly DriveEntry[]) {
  let picking = (offered: readonly DriveEntry[]): readonly DriveEntry[] => offered
  const fake = createFakeFilingDrive((_title, offered) => picking(offered), 2026)
  await fake.drive.pickFolders(null, 'root')
  picking = picks
  return fake
}

function filesIn(fake: ReturnType<typeof createFakeFilingDrive>, folder: string) {
  const folders = fake.nodes.filter((node) => node.folder && node.name === folder && node.parentId === FAKE_INVOICE_FOLDER.id)
  return folders.map((held) => fake.nodes.filter((node) => node.parentId === held.id && !node.folder).map((node) => node.name))
}

describe("filing a travel order's documents on Drive", () => {
  it('files the PDF and the xlsx in the year folder the person picks, and replaces them when filed again', async () => {
    const fake = await pickedDrive((offered) => offered)
    await fileTripDocuments(fake.drive, FAKE_INVOICE_FOLDER.id, TRIP, FILES)
    await fileTripDocuments(fake.drive, FAKE_INVOICE_FOLDER.id, TRIP, [{ ...FILES[0]!, content: new Uint8Array([9]) }])
    expect(filesIn(fake, '2026')).toEqual([['putni-nalog-1-2026.pdf', 'putni-nalog-1-2026.xlsx']])
    expect(fake.nodes.find((node) => node.name === 'putni-nalog-1-2026.pdf')?.content).toEqual(new Uint8Array([9]))
  })

  it('makes the year folder when the Picker is closed', async () => {
    const fake = await pickedDrive(() => [])
    await fileTripDocuments(fake.drive, FAKE_INVOICE_FOLDER.id, TRIP, FILES)
    // The hidden folder of another app stays empty beside the one the app made.
    expect(filesIn(fake, '2026')).toEqual([[], ['putni-nalog-1-2026.pdf', 'putni-nalog-1-2026.xlsx']])
  })
})
