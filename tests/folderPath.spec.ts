import { describe, expect, it } from 'vitest'

import { folderReadScope } from '../src/shared/google/googleScopes'
import { folderPathOf, startsAtBooksFolder } from '../src/shared/text/folderPath'

describe('folderPathOf', () => {
  it('reads folder names between slashes, trimmed, without blank ones', () => {
    expect(folderPathOf('/work/ dss //statements/')).toEqual(['work', 'dss', 'statements'])
    expect(folderPathOf(' / ')).toEqual([])
  })

  it('keeps the . of a path from the folder of the books file, which the books file’s scope reads, while a path from My Drive needs Drive read', () => {
    expect(folderPathOf('./statements')).toEqual(['.', 'statements'])
    expect(startsAtBooksFolder(['.', 'statements'])).toBe(true)
    expect(startsAtBooksFolder(['work', 'statements'])).toBe(false)
    expect(folderReadScope(['.', 'statements'])).toBe('drive.file')
    expect(folderReadScope(['work', 'statements'])).toBe('drive.readonly')
  })
})
