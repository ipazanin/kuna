import { describe, expect, it } from 'vitest'

import { saveApplicationId } from '../src/apps/spending/bankSync/application/bankSync'
import { applicationIdOfFileName, applicationProblems } from '../src/shared/bank-sync/domain/bankAnswer'
import type { BankApplication } from '../src/shared/bank-sync/domain/bankAnswer'
import { SETTING_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import { BANK_SYNC_APPLICATION_KEY } from '../src/apps/spending/workbook/domain/spendingSettings'
import { bankLinkId, oldLinkEndKey, oldLinkFetchedKey } from '../src/apps/spending/workbook/domain/bankLinkReading'
import type { BankLink } from '../src/shared/bank-sync/domain/bankLink'
import type { WriteRules } from '../src/shared/storage/domain/writeRules'
import { civil } from './fixtures/ledger'
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
  const APPLICATION = settingRow(SETTING_RECORDS, BANK_SYNC_APPLICATION_KEY, 'made-up-before')
  const OLD_LINK = [settingRow(SETTING_RECORDS, oldLinkEndKey('otp'), '2027-01-01'), settingRow(SETTING_RECORDS, oldLinkFetchedKey('otp'), '2026-11-20T08:00:00.000Z')]
  const LINK: BankLink = { id: bankLinkId({ bank: 'OTP banka', usage: 'personal' }), bank: 'OTP banka', usage: 'personal', endsOn: civil('2027-01-01'), fetchedAt: null }

  /** What the save leaves in each setting it writes, blank for a removed row, and the links it removes by bank. */
  function saved(settingRows: readonly SettingRow[], applicationId: string, bankLinks: readonly BankLink[] = []): Record<string, string> {
    const written: Record<string, string> = {}
    const unit = {
      of: (writes: WriteRules<unknown>) => ({
        add: (row: SettingRow) => (written[row.key] = row.value),
        change: (_before: SettingRow, after: SettingRow) => (written[after.key] = after.value),
        remove: (record: SettingRow | BankLink) => (written[writes.kind.name === 'bank-link' ? `link ${(record as BankLink).bank}` : (record as SettingRow).key] = ''),
      }),
    } as unknown as UnitOfWork
    saveApplicationId(unit, spendingBook([], { settingRows, bankLinks }), applicationId)
    return written
  }

  it("ends each link for another application, since its sessions do not carry over, and clears a book's old link settings", () => {
    expect(saved([APPLICATION], ' made-up-after ', [LINK])).toEqual({ [BANK_SYNC_APPLICATION_KEY]: 'made-up-after', 'link OTP banka': '' })
    expect(saved([APPLICATION, ...OLD_LINK], 'made-up-after')).toEqual({ [BANK_SYNC_APPLICATION_KEY]: 'made-up-after', [oldLinkEndKey('otp')]: '', [oldLinkFetchedKey('otp')]: '' })
  })

  it('keeps the links for the same application and writes only the id on a first set-up', () => {
    expect(saved([APPLICATION, ...OLD_LINK], 'made-up-before')).toEqual({})
    expect(saved([APPLICATION], 'made-up-before', [LINK])).toEqual({})
    expect(saved([], 'made-up-after')).toEqual({ [BANK_SYNC_APPLICATION_KEY]: 'made-up-after' })
  })
})
