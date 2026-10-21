import { describe, expect, it } from 'vitest'

import { fold, normaliseIban } from '../src/shared/text/fold'

describe('fold', () => {
  it('strips accents, including đ, which has no decomposition', () => {
    expect(fold('Đurđa Šimić')).toBe('DURDA SIMIC')
    expect(fold('MÜLLER&SÖHNE BANK d.d.')).toBe('MULLER&SOHNE BANK D.D.')
  })

  it('collapses and trims whitespace', () => {
    expect(fold('  UPL.ZA  ZAKUP\tPROSTORA ')).toBe('UPL.ZA ZAKUP PROSTORA')
  })
})

describe('normaliseIban', () => {
  it('drops the grouping spaces and upper-cases', () => {
    expect(normaliseIban(' hr62 1234 5670 0000 0000 1 ')).toBe('HR6212345670000000001')
  })
})
