import { describe, expect, it } from 'vitest'

import { displayName, displayNamesOf } from '../src/apps/company/workbook/domain/displayName'
import { BUCKET_COLOUR } from '../src/apps/company/workbook/domain/categoryColour'

describe('displayName', () => {
  it('reads a slug with spaces for hyphens and a capital first letter', () => {
    expect(displayName('corporate-income-tax')).toBe('Corporate income tax')
    expect(displayName('travel')).toBe('Travel')
  })

  it('writes the short acronyms in capitals', () => {
    expect(displayName('ai-services')).toBe('AI services')
    expect(displayName('vat')).toBe('VAT')
    expect(displayName('it-equipment')).toBe('IT equipment')
  })

  it('prefers the label the workbook gives', () => {
    expect(displayName('salary-net', '  Net salary ')).toBe('Net salary')
  })

  it('leaves an empty slug empty', () => {
    expect(displayName('')).toBe('')
  })
})

describe('displayNamesOf', () => {
  it('names the categories and accounts of a workbook, and any slug the tabs do not define', () => {
    const names = displayNamesOf({
      categories: [{ slug: 'rent-owner', label: 'Office rent', family: 'owner', bucket: 'owner-pay', colour: BUCKET_COLOUR, roles: [], vat: 'none', ownerShare: null }],
      accounts: [{ slug: 'main', label: '', iban: '', currency: '' }],
    })

    expect(names.category('rent-owner')).toBe('Office rent')
    expect(names.category('zzz-test')).toBe('Zzz test')
    expect(names.account('main')).toBe('Main')
  })
})
