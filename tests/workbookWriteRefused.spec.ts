import { describe, expect, it } from 'vitest'

import { ASSET_RECORDS } from '../src/apps/assets/workbook/domain/assetKinds'
import { WorkbookWriteRefused, refuseOn } from '../src/shared/storage/application/workbookWriteRefused'
import { en as storageEnglish, hr as storageCroatian } from '../src/shared/storage/application/words'
import { en as infrastructureEnglish, hr as infrastructureCroatian } from '../src/shared/storage/infrastructure/words'

const NOTHING_SAID = /\bnothing was written\b|\bništa nije upisano\b/gi

const REFUSAL_REASONS = [
  storageEnglish.savedElsewhere,
  storageEnglish.madeOnFailedWrite,
  storageEnglish.busy,
  storageEnglish.noBooks,
  storageEnglish.notUndoable,
  infrastructureEnglish.notOnce(ASSET_RECORDS.noun),
  storageEnglish.refusals.alreadyThere(ASSET_RECORDS.noun, 'Flat'),
  storageEnglish.refusals.nothingToFindBy(ASSET_RECORDS.noun, 'Flat'),
  storageEnglish.refusals.newWithoutKey(ASSET_RECORDS.noun),
]

const CROATIAN_REASONS = [storageCroatian.savedElsewhere, storageCroatian.madeOnFailedWrite, infrastructureCroatian.notOnce(ASSET_RECORDS.noun)]

describe('a refused write', () => {
  it.each([...REFUSAL_REASONS, ...CROATIAN_REASONS])('leaves saying that nothing was written to the toast or card that shows it: %s', (reason) => {
    expect(reason).not.toMatch(NOTHING_SAID)
  })

  it('refuses with the reasons as given', () => {
    expect(() => refuseOn([storageEnglish.busy, storageEnglish.notUndoable])).toThrow(new WorkbookWriteRefused(`${storageEnglish.busy} ${storageEnglish.notUndoable}`))
    expect(() => refuseOn([])).not.toThrow()
  })
})
