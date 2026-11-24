import { holdsName, mergedPayees, newPayee, payeeProblem, saysOnlyItsName, tidiedPayee, withParty, withoutDetails } from '../domain/payeeDetails'
import { isPerson, oldMarksCount, payeeDirectory, payeeOfRow, personPayeesByWords } from '../domain/payeeDirectory'
import { payeeKey } from '../domain/payeeKey'
import { SETTING_WRITES } from '../../workbook/application/settingWrites'
import { SPENDING_KINDS, bookWith, dependentRefusals } from '../../workbook/application/spendingWriteGuards'
import type { Payee, PayeeParty } from '../../workbook/domain/payee'
import type { SpendingRecords } from '../../workbook/domain/readSpendingBook'
import type { TransactionItem } from '../../workbook/domain/transactionItem'
import { PAYEE_RECORDS } from '../../workbook/domain/spendingKinds'
import { PERSON_PAYEES_KEY } from '../../workbook/domain/spendingSettings'
import { payeeReason, words } from '../../workbook/domain/words'
import { personPayeesOf } from '../../../../shared/privacy/domain/personPayees'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import { recordsOf, sameRecord } from '../../../../shared/storage/domain/recordsRead'
import type { WriteRules } from '../../../../shared/storage/domain/writeRules'

/** A payee keeps a name and no name or IBAN another payee holds, and Undo takes back what a write did. No other record names a payee. */
export const PAYEE_WRITES: WriteRules<Payee> = {
  kind: PAYEE_RECORDS,
  reads: SPENDING_KINDS,
  undoable: true,
  read: (read, records) => bookWith(PAYEE_RECORDS, read, records).readings.payees,
  refusals: (_change, fresh, after) => dependentRefusals(['payees'], fresh, after),
}

/** What a payee write reads of the file: the payees, and the settings for the old marks of payees as people it moves. */
export type PayeeRecords = Pick<SpendingRecords, 'payees' | 'settings'>

/**
 * Writes the payees as `change` leaves them, after moving the old marks of payees as people onto payees, in one write so one
 * Undo takes back both. The move runs while the old marks count as `oldMarksCount` says: a marked name becomes a payee who is a
 * person, and the setting row goes. Each payee the write adds or changes must pass `payeeProblem` against the rest.
 */
function writePayees(unit: UnitOfWork, records: PayeeRecords, change: (payees: readonly Payee[], moved: readonly Payee[]) => readonly Payee[]): void {
  const stored = recordsOf(records.payees)
  const marks = oldMarksCount(stored) ? (recordsOf(records.settings).find((row) => row.key === PERSON_PAYEES_KEY) ?? null) : null
  const moved = marks === null ? [] : personPayeesOf(marks.value).map((name) => newPayee(name, 'person'))
  const after = change([...stored, ...moved], moved)
  const touched = after.filter((payee) => !stored.some((held) => sameRecord(held, payee)))
  for (const payee of touched) {
    const problem = payeeProblem(payee, after)
    if (problem !== null) throw new Error(words.payeeRefused(payee.names[0] ?? '', payeeReason(problem)))
  }
  const writes = unit.of(PAYEE_WRITES)
  for (const payee of touched) {
    const before = stored.find((held) => held.id === payee.id)
    if (before === undefined) writes.add(payee)
    else writes.change(before, payee)
  }
  stored.filter((held) => !after.some((payee) => payee.id === held.id)).forEach((held) => writes.remove(held))
  if (marks !== null) unit.of(SETTING_WRITES).remove(marks)
}

/**
 * The payees with this one in place of the one of its id, or added. Every payee of `takesOver` that holds one of its names goes,
 * and the first gives up its place to it when no payee has its id. A payee left with one name and no detail goes, since its rows
 * read the same without it.
 */
function withPayee(payees: readonly Payee[], payee: Payee, takesOver: readonly Payee[] = []): readonly Payee[] {
  const tidied = tidiedPayee(payee)
  const taken = takesOver.filter((other) => tidied.names.some((name) => holdsName(other, name)))
  const held = payees.find((other) => other.id === tidied.id) ?? taken[0]
  const left = payees.filter((other) => other === held || !taken.includes(other))
  if (saysOnlyItsName(tidied)) return left.filter((other) => other !== held)
  return held === undefined ? [...left, tidied] : left.map((other) => (other === held ? { ...tidied, id: held.id } : other))
}

/** Keeps the payee's details, adding the payee when the file has none of its id. A new payee of a name the old setting marked takes the place of that mark. */
export function savePayee(unit: UnitOfWork, records: PayeeRecords, payee: Payee): void {
  writePayees(unit, records, (payees, moved) => withPayee(payees, payee, moved))
}

/** The other payee's names, IBANs and details join the kept one, and the other goes, in one write. No row changes. */
export function mergePayees(unit: UnitOfWork, records: PayeeRecords, kept: Payee, other: Payee): void {
  writePayees(unit, records, (payees) =>
    withPayee(
      payees.filter((payee) => payee.id !== other.id),
      mergedPayees(kept, other),
    ),
  )
}

/** Takes off every detail you added to the payee. */
export function clearPayee(unit: UnitOfWork, records: PayeeRecords, payee: Payee): void {
  writePayees(unit, records, (payees) => withPayee(payees, withoutDetails(payee)))
}

/**
 * Says whether the payee of the name, and of the IBAN when given, is a person, a business or not said. A payee the name or IBAN
 * finds takes the mark. Otherwise the mark goes on the person payees whose names have the same words, such as one written
 * surname first, which `isPerson` reads too. A payee of the name is added only to say something no payee says yet.
 */
export function setPayeeParty(unit: UnitOfWork, records: PayeeRecords, name: string, party: PayeeParty | null, iban = ''): void {
  writePayees(unit, records, (payees) => {
    const found = payeeOfRow(payeeDirectory(payees, []), { payee: name, counterpartyIban: iban })
    if (found !== null) return withPayee(payees, withParty(found, party))
    const sameWords = personPayeesByWords(payees, name)
    if (party === null) return sameWords.reduce((left, payee) => withPayee(left, withParty(payee, null)), payees)
    if (name.trim() === '' || (party === 'person' && sameWords.length > 0)) return payees
    return [...payees, newPayee(name, party)]
  })
}

/** What a write that gives parts a payee of their own reads of the file to know which names are new. */
export type PartPayeeRecords = PayeeRecords & Pick<SpendingRecords, 'transactions'>

/**
 * Adds a payee marked as a person for each name the parts count under that no payee and no entry's payee holds yet, such as a
 * friend you paid for, in the write that names them, so one Undo takes back both. A name an entry already has is a payee as it is.
 */
export function addPartPayees(unit: UnitOfWork, records: PartPayeeRecords, parts: readonly Pick<TransactionItem, 'payee'>[]): void {
  const directory = payeeDirectory(recordsOf(records.payees), recordsOf(records.settings))
  const onEntries = new Set(recordsOf(records.transactions).map((row) => payeeKey(row.payee)))
  const fresh = new Map<string, string>()
  for (const { payee } of parts) {
    const key = payeeKey(payee)
    if (key === '' || onEntries.has(key) || fresh.has(key) || payeeOfRow(directory, { payee, counterpartyIban: '' }) !== null || isPerson(directory, payee)) continue
    fresh.set(key, payee.trim())
  }
  if (fresh.size === 0) return
  writePayees(unit, records, (payees) => [...payees, ...[...fresh.values()].map((name) => newPayee(name, 'person'))])
}
