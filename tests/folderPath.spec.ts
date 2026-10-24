import { describe, expect, it } from 'vitest'

import { folderPathOf } from '../src/shared/text/folderPath'

describe('folderPathOf', () => {
  it('reads folder names between slashes, trimmed, without blank ones', () => {
    expect(folderPathOf('/work/ dss //statements/')).toEqual(['work', 'dss', 'statements'])
    expect(folderPathOf(' / ')).toEqual([])
  })
})
