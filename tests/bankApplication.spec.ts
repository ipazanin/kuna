import { describe, expect, it } from 'vitest'

import { saveApplicationId } from '../src/apps/spending/bankSync/application/bankSync'
import { applicationIdOfFileName, applicationProblems } from '../src/apps/spending/bankSync/domain/bankAnswer'
import type { BankApplication } from '../src/apps/spending/bankSync/domain/bankAnswer'
import { SETTING_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import { BANK_SYNC_APPLICATION_KEY, bankFetchedKey, bankLinkKey } from '../src/apps/spending/workbook/domain/spendingSettings'
import type { UnitOfWork } from '../src/shared/storage/application/repository'
import { settingRow } from '../src/shared/storage/domain/settingRows'
import type { SettingRow } from '../src/shared/storage/domain/settingRows'
import { spendingBook } from './fixtures/spending'

const REDIRECT = 'https://example.invalid/kuna/'
const READY: BankApplication = { name: 'Kuna', environment: 'PRODUCTION', redirectUrls: [REDIRECT], active: true }

describe('the application problems', () => {
  it('finds none in an active production application that lists this address', () => {
    expect(applicationProblems(READY, REDIRECT)).toEqual([])
  })

  it('names the sandbox, a missing redirect and an application not active yet, in the order a person fixes them', () => {
    expect(applicationProblems({ ...READY, environment: 'SANDBOX', redirectUrls: ['https://example.invalid/other/'], active: false }, REDIRECT)).toEqual(['sandbox', 'redirect-missing', 'not-active'])
  })

  it('reads a redirect only when it is exactly this address', () => {
    expect(applicationProblems({ ...READY, redirectUrls: ['https://example.invalid/kuna'] }, REDIRECT)).toEqual(['redirect-missing'])
  })
})

describe('the application id of a key file', () => {
  it("is the file's name without .pem, as Enable Banking downloads it", () => {
    expect(applicationIdOfFileName('00000000-0000-4000-8000-000000000001.pem')).toBe('00000000-0000-4000-8000-000000000001')
    expect(applicationIdOfFileName('made-up.PEM')).toBe('made-up')
  })
})

describe('saving the application id', () => {
  const LINKED = [
    settingRow(SETTING_RECORDS, BANK_SYNC_APPLICATION_KEY, 'made-up-before'),
    settingRow(SETTING_RECORDS, bankLinkKey('otp'), '2027-01-01'),
    settingRow(SETTING_RECORDS, bankFetchedKey('otp'), '2026-11-20T08:00:00.000Z'),
  ]

  /** What the save leaves in each setting it writes, blank for a removed row. */
  function saved(settingRows: readonly SettingRow[], applicationId: string): Record<string, string> {
    const written: Record<string, string> = {}
    const unit = {
      of: () => ({
        add: (row: SettingRow) => (written[row.key] = row.value),
        change: (_before: SettingRow, after: SettingRow) => (written[after.key] = after.value),
        remove: (row: SettingRow) => (written[row.key] = ''),
      }),
    } as unknown as UnitOfWork
    saveApplicationId(unit, spendingBook([], { settingRows }), applicationId)
    return written
  }

  it("clears each bank's link end and last fetch for another application, since its sessions do not carry over", () => {
    expect(saved(LINKED, ' made-up-after ')).toEqual({ [BANK_SYNC_APPLICATION_KEY]: 'made-up-after', [bankLinkKey('otp')]: '', [bankFetchedKey('otp')]: '' })
  })

  it('keeps the links for the same application and writes only the id on a first set-up', () => {
    expect(saved(LINKED, 'made-up-before')).toEqual({})
    expect(saved([], 'made-up-after')).toEqual({ [BANK_SYNC_APPLICATION_KEY]: 'made-up-after' })
  })
})
