// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'

import { loadWorkbookChoice, saveWorkbookChoice, someWorkbookOnDrive } from '../src/shared/storage/infrastructure/workbookChoice'

beforeEach(() => {
  localStorage.clear()
})

describe('the file each app chose on this device', () => {
  it('is kept under a key of its own per app, so company and Loans never see each other’s choice', () => {
    saveWorkbookChoice('company', { source: 'drive', id: 'company-file', name: 'kuna-company.json' })
    saveWorkbookChoice('loans', { source: 'browser', id: 'local-1', name: 'Loans file' })

    expect(loadWorkbookChoice('company')).toEqual({ source: 'drive', id: 'company-file', name: 'kuna-company.json' })
    expect(loadWorkbookChoice('loans')).toEqual({ source: 'browser', id: 'local-1', name: 'Loans file' })
    expect(Object.keys(localStorage).sort()).toEqual(['kuna.workbook-file.company', 'kuna.workbook-file.loans'])
  })

  it('forgets one app’s choice and keeps the other’s', () => {
    saveWorkbookChoice('company', { source: 'drive', id: 'company-file', name: 'kuna-company.json' })
    saveWorkbookChoice('loans', { source: 'drive', id: 'loans-file', name: 'kuna-loans.json' })

    saveWorkbookChoice('loans', null)

    expect(loadWorkbookChoice('loans')).toBeNull()
    expect(loadWorkbookChoice('company')?.id).toBe('company-file')
  })

  it('ignores the one key a single app kept before each app had its own', () => {
    localStorage.setItem('kuna.workbook-file', JSON.stringify({ source: 'drive', id: 'company-file', name: 'kuna-company.json' }))

    expect(loadWorkbookChoice('company')).toBeNull()
    expect(loadWorkbookChoice('loans')).toBeNull()
  })

  it('tells whether some app keeps its file on Drive', () => {
    saveWorkbookChoice('company', { source: 'browser', id: 'local-1', name: 'New books' })
    expect(someWorkbookOnDrive()).toBe(false)

    saveWorkbookChoice('loans', { source: 'drive', id: 'loans-file', name: 'kuna-loans.json' })
    expect(someWorkbookOnDrive()).toBe(true)
  })
})
