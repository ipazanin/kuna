import { describe, expect, it } from 'vitest'

import { realSyncDefine } from '../scripts/devRealBooks'

describe('KUNA_REAL_SYNC on npm run dev:real', () => {
  it('adds nothing to the env while the variable is unset or empty', () => {
    expect(realSyncDefine(undefined)).toEqual({})
    expect(realSyncDefine('')).toEqual({})
  })

  it('turns on the fake build and names the app whose real books go on its Drive', () => {
    expect(realSyncDefine('spending')).toEqual({
      'import.meta.env.VITE_FAKE_WORKBOOK': '"true"',
      'import.meta.env.VITE_REAL_SYNC': '"spending"',
    })
  })

  it('refuses a name that is no app with books, such as the rates file', () => {
    expect(() => realSyncDefine('rates')).toThrow('KUNA_REAL_SYNC names no app: rates.')
  })
})
