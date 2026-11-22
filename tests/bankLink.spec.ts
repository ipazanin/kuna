import { describe, expect, it } from 'vitest'

import { forgetBankLink } from '../src/apps/spending/bankSync/application/bankLinkWrites'
import { banksFor, sameLink } from '../src/apps/spending/bankSync/domain/bankLink'
import type { BankLink } from '../src/apps/spending/bankSync/domain/bankLink'
import { BANK_LINK_CODEC, bankLinkId, bankLinksOf, oldLinkEndKey, oldLinkFetchedKey } from '../src/apps/spending/workbook/domain/bankLinkReading'
import { readSpendingBook, spendingRecordsOf } from '../src/apps/spending/workbook/domain/readSpendingBook'
import { BANK_LINK_RECORDS, SETTING_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import { NO_RECORDS } from '../src/shared/storage/domain/recordsRead'
import type { RecordsRead } from '../src/shared/storage/domain/recordsRead'
import { identityOf } from '../src/shared/storage/domain/recordCodec'
import { settingRow } from '../src/shared/storage/domain/settingRows'
import { storedFieldsOfValues } from '../src/shared/storage/domain/storedFields'
import type { UnitOfWork } from '../src/shared/storage/application/repository'
import type { WriteRules } from '../src/shared/storage/domain/writeRules'
import type { SettingRow } from '../src/shared/storage/domain/settingRows'
import { civil } from './fixtures/ledger'
import { spendingBook } from './fixtures/spending'

const FETCHED = Date.parse('2026-11-20T08:00:00.000Z')
const OTP: BankLink = { id: bankLinkId({ bank: 'OTP banka', usage: 'personal' }), bank: 'OTP banka', usage: 'personal', endsOn: civil('2027-05-03'), fetchedAt: FETCHED }

describe('a bank link', () => {
  it('is one per bank and login, so two devices linking the same bank keep one record', () => {
    expect(bankLinkId({ bank: 'OTP banka', usage: 'personal' })).toBe(bankLinkId({ bank: 'OTP banka', usage: 'personal' }))
    expect(bankLinkId({ bank: 'OTP banka', usage: 'business' })).not.toBe(OTP.id)
    expect(sameLink(OTP, { bank: 'OTP banka', usage: 'business' })).toBe(false)
  })

  it('is stored as its bank, login, end and last answer, and read back the same under the id its fields make', () => {
    const fields = BANK_LINK_CODEC.fieldsOf(OTP)
    expect(fields).toEqual({ bank: 'OTP banka', usage: 'personal', ends_on: '2027-05-03', fetched_at: '2026-11-20T08:00:00.000Z' })
    expect(identityOf(BANK_LINK_CODEC, OTP)).toBe(OTP.id)
    expect(BANK_LINK_CODEC.make(storedFieldsOfValues(fields), OTP.id)).toEqual(OTP)
    expect(BANK_LINK_CODEC.make(storedFieldsOfValues(BANK_LINK_CODEC.fieldsOf({ ...OTP, fetchedAt: null })), OTP.id)).toEqual({ ...OTP, fetchedAt: null })
  })

  it('refuses a login Kuna does not know and a last answer that is no UTC time', () => {
    expect(() => BANK_LINK_CODEC.make(storedFieldsOfValues({ ...BANK_LINK_CODEC.fieldsOf(OTP), usage: 'corporate' }), OTP.id)).toThrow()
    expect(() => BANK_LINK_CODEC.make(storedFieldsOfValues({ ...BANK_LINK_CODEC.fieldsOf(OTP), fetched_at: 'yesterday' }), OTP.id)).toThrow()
  })
})

describe("a book's links", () => {
  const OLD_SETTINGS = [
    settingRow(SETTING_RECORDS, oldLinkEndKey('otp'), '2027-05-03'),
    settingRow(SETTING_RECORDS, oldLinkFetchedKey('otp'), '2026-11-20T08:00:00.000Z'),
    settingRow(SETTING_RECORDS, oldLinkEndKey('revolut'), '2027-04-01'),
  ]

  it('are read from the old settings of a book from before bank-link records, each as a personal link of its bank', () => {
    expect(bankLinksOf([], OLD_SETTINGS)).toEqual([OTP, { id: bankLinkId({ bank: 'Revolut', usage: 'personal' }), bank: 'Revolut', usage: 'personal', endsOn: civil('2027-04-01'), fetchedAt: null }])
  })

  it('are the records once one counts, whatever old settings a book still holds', () => {
    const revolut: BankLink = { ...OTP, id: bankLinkId({ bank: 'Revolut', usage: 'personal' }), bank: 'Revolut' }
    expect(bankLinksOf([revolut], OLD_SETTINGS)).toEqual([revolut])
  })

  it('leave the old settings doubted in a book that holds a record too, as read no more', () => {
    const read = <R extends { readonly id: string }>(records: readonly R[]): RecordsRead<R> => ({
      records: records.map((record) => ({ record, id: record.id as never, label: '', fields: {} })),
      refused: [],
    })
    const book = readSpendingBook(
      spendingRecordsOf(
        <R>(kind: { readonly name: string }) => (kind.name === BANK_LINK_RECORDS.name ? read([OTP]) : kind.name === SETTING_RECORDS.name ? read(OLD_SETTINGS) : NO_RECORDS) as RecordsRead<R>,
      ),
    )
    expect(book.bankLinks).toEqual([OTP])
    expect(book.problems.filter((problem) => problem.kind === 'setting').map(({ reason }) => reason)).toEqual(
      OLD_SETTINGS.map(() => 'is read no more, since the book keeps each bank link as a record of its own'),
    )
  })
})

describe('the banks a login can link', () => {
  it('are those that take it, in the order Enable Banking lists them', () => {
    const listed = [
      { name: 'Made-up Business Bank', usages: ['business' as const], beta: false },
      { name: 'Made-up Bank', usages: ['business' as const, 'personal' as const], beta: true },
      { name: 'Other Bank', usages: ['personal' as const], beta: false },
    ]
    expect(banksFor(listed, 'personal').map(({ name }) => name)).toEqual(['Made-up Bank', 'Other Bank'])
  })
})

describe('removing one bank link', () => {
  const REVOLUT: BankLink = { id: bankLinkId({ bank: 'Revolut', usage: 'personal' }), bank: 'Revolut', usage: 'personal', endsOn: civil('2027-02-01'), fetchedAt: null }

  /** What the write does, each record or setting by its bank or key, in the order it writes them. */
  function removed(bankLinks: readonly BankLink[], settingRows: readonly SettingRow[] = []): readonly string[] {
    const written: string[] = []
    const named = (record: BankLink | SettingRow): string => ('bank' in record ? record.bank : record.key)
    const unit = {
      of: (writes: WriteRules<unknown>) => ({
        add: (record: BankLink | SettingRow) => written.push(`${writes.kind.name} add ${named(record)}`),
        change: (_before: BankLink | SettingRow, after: BankLink | SettingRow) => written.push(`${writes.kind.name} change ${named(after)}`),
        remove: (record: BankLink | SettingRow) => written.push(`${writes.kind.name} remove ${named(record)}`),
      }),
    } as unknown as UnitOfWork
    forgetBankLink(unit, spendingBook([], { bankLinks, settingRows }), { bank: 'Revolut', usage: 'personal' })
    return written
  }

  it("takes away that bank's record alone and leaves every other link as it was", () => {
    expect(removed([OTP, REVOLUT])).toEqual([`${BANK_LINK_RECORDS.name} remove Revolut`])
  })

  it('writes nothing for a bank the book holds no link of', () => {
    expect(removed([OTP])).toEqual([])
  })

  it("moves a book's old link settings onto records in the same write, without the bank removed", () => {
    const old = ['otp', 'revolut'].map((key) => settingRow(SETTING_RECORDS, oldLinkEndKey(key), '2027-01-01'))
    expect(removed([], old)).toEqual([`${BANK_LINK_RECORDS.name} add OTP banka`, ...['otp', 'revolut'].map((key) => `${SETTING_RECORDS.name} remove ${oldLinkEndKey(key)}`)])
  })
})
