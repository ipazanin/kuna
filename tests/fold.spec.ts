import { describe, expect, it } from 'vitest'

import { fold, normaliseIban } from '../src/shared/text/fold'

describe('fold', () => {
  it('strips accents, including đ, which has no decomposition', () => {
    expect(fold('Đurđa Šimić')).toBe('DURDA SIMIC')
    expect(fold('ERSTE&STEIERMÄRKISCHE BANK d.d.')).toBe('ERSTE&STEIERMARKISCHE BANK D.D.')
  })

  it('collapses and trims whitespace', () => {
    expect(fold('  DOPR.ZA  MIROV.OSIG.\tZA STAROST ')).toBe('DOPR.ZA MIROV.OSIG. ZA STAROST')
  })
})

describe('normaliseIban', () => {
  it('drops the grouping spaces and upper-cases', () => {
    expect(normaliseIban(' hr12 1001 0051 8630 0016 0 ')).toBe('HR1210010051863000160')
  })
})
