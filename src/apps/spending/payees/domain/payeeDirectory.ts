import { holdsName, keyOfPayee, payeeProblem } from './payeeDetails'
import { payeeKey } from './payeeKey'
import type { Payee } from '../../workbook/domain/payee'
import { PERSON_PAYEES_KEY } from '../../workbook/domain/spendingSettings'
import type { Transaction } from '../../workbook/domain/transaction'
import { flaggedAsPerson, personPayeesOf } from '../../../../shared/privacy/domain/personPayees'
import { sameName } from '../../../../shared/privacy/domain/names'
import { settingValue } from '../../../../shared/storage/domain/settingRows'
import type { SettingRow } from '../../../../shared/storage/domain/settingRows'
import { normaliseIban } from '../../../../shared/text/fold'

/** The payees you keep details of, and the names the old person setting marks while the file holds no payee yet. */
export interface PayeeDirectory {
  readonly payees: readonly Payee[]
  /** The names `person_payees` lists, read only until the first payee write moves them onto payees. */
  readonly markedPeople: readonly string[]
}

/**
 * Whether the old person setting still says who is a person: while none of the payees counts as `payeeProblem` says. The reader,
 * the directory and the first payee write that moves the marks all ask this one rule.
 */
export function oldMarksCount(payees: readonly Payee[]): boolean {
  return payees.every((payee) => payeeProblem(payee, payees) !== null)
}

/** The directory of the payees that count and the settings as stored. Once any payee counts, the old person setting is not read. */
export function payeeDirectory(payees: readonly Payee[], settings: readonly SettingRow[]): PayeeDirectory {
  return { payees, markedPeople: oldMarksCount(payees) ? personPayeesOf(settingValue(settings, PERSON_PAYEES_KEY)) : [] }
}

/**
 * The payee a row belongs to. A payee that lists the row's name, once folded, is the one. Then a payee that lists the row's IBAN
 * is, unless another payee lists the row's name. Null when neither finds one, and the row's name alone then tells its payee.
 */
export function payeeOfRow(directory: PayeeDirectory, row: Pick<Transaction, 'payee' | 'counterpartyIban'>): Payee | null {
  const named = directory.payees.find((payee) => holdsName(payee, row.payee))
  if (named !== undefined) return named
  const iban = normaliseIban(row.counterpartyIban)
  return iban === '' ? null : (directory.payees.find((payee) => payee.ibans.includes(iban)) ?? null)
}

/** What tells the row's payee from another: its payee's first name folded, or its own name folded when no payee finds it. */
export function rowPayeeKey(directory: PayeeDirectory, row: Pick<Transaction, 'payee' | 'counterpartyIban'>): string {
  const payee = payeeOfRow(directory, row)
  return payee === null ? payeeKey(row.payee) : keyOfPayee(payee)
}

/**
 * Whether the payee of the name, and of the IBAN when given, is a person. A payee found by the name or IBAN says so itself.
 * Otherwise a person payee with a name of the same words, such as one written surname first, or the old setting marks it.
 */
export function isPerson(directory: PayeeDirectory, name: string, iban = ''): boolean {
  const payee = payeeOfRow(directory, { payee: name, counterpartyIban: iban })
  if (payee !== null) return payee.party === 'person'
  return personPayeesByWords(directory.payees, name).length > 0 || flaggedAsPerson(directory.markedPeople, name)
}

/** The person payees with a name of the same words as this one, such as one written surname first. */
export function personPayeesByWords(payees: readonly Payee[], name: string): readonly Payee[] {
  return payees.filter((payee) => payee.party === 'person' && payee.names.some((spelling) => sameName(spelling, name)))
}

/** The people among the payees, each with every name and IBAN, which the chat sends under an alias. */
export function personPayees(directory: PayeeDirectory): readonly Pick<Payee, 'names' | 'ibans'>[] {
  return [...directory.payees.filter((payee) => payee.party === 'person'), ...directory.markedPeople.map((name) => ({ names: [name], ibans: [] }))]
}
