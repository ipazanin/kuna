import { payeeKey } from './payeeKey'
import type { Payee, PayeeParty } from '../../workbook/domain/payee'
import { PAYEE_RECORDS } from '../../workbook/domain/spendingKinds'
import { newRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import { normaliseIban } from '../../../../shared/text/fold'
import { isIban } from '../../../../shared/text/iban'
import { isValidOib } from '../../../../shared/text/oib'

/** Why a payee's details cannot be kept, as a fact the reader and every write word for themselves. */
export type PayeeProblem =
  | { readonly kind: 'no-name' }
  | { readonly kind: 'name-taken'; readonly name: string; readonly holder: string }
  | { readonly kind: 'not-an-iban'; readonly iban: string }
  | { readonly kind: 'iban-taken'; readonly iban: string; readonly holder: string }
  | { readonly kind: 'not-an-oib'; readonly taxId: string }

/** Eleven digits are an OIB and must pass its check digit. Other text is a foreign tax number. */
const ELEVEN_DIGITS = /^\d{11}$/

/**
 * Why the payee cannot be kept beside the others, or null when it can. A payee has a name that is not blank once folded, and no
 * other payee holds any of its names once folded or any of its IBANs, since a row finds one payee by either. Each IBAN is a valid
 * one, and a tax number of eleven digits is a valid OIB. The reader and every write ask this one rule.
 */
export function payeeProblem(payee: Pick<Payee, 'id' | 'names' | 'ibans' | 'taxId'>, payees: readonly Pick<Payee, 'id' | 'names' | 'ibans'>[]): PayeeProblem | null {
  if (payee.names.every((name) => payeeKey(name) === '')) return { kind: 'no-name' }
  const others = payees.filter((other) => other.id !== payee.id)
  for (const name of payee.names) {
    const holder = others.find((other) => holdsName(other, name))
    if (holder !== undefined) return { kind: 'name-taken', name, holder: holder.names[0] ?? '' }
  }
  for (const iban of payee.ibans) {
    if (!isIban(iban)) return { kind: 'not-an-iban', iban }
    const holder = others.find((other) => other.ibans.includes(iban))
    if (holder !== undefined) return { kind: 'iban-taken', iban, holder: holder.names[0] ?? '' }
  }
  return ELEVEN_DIGITS.test(payee.taxId) && !isValidOib(payee.taxId) ? { kind: 'not-an-oib', taxId: payee.taxId } : null
}

/** What tells the payee from another: its first name folded, so every link to the name it shows under keeps working. */
export function keyOfPayee(payee: Pick<Payee, 'names'>): string {
  return payeeKey(payee.names[0] ?? '')
}

/** The payee with its names trimmed, each spelling once once folded, and its IBANs normalised, each once. Blank ones go. */
export function tidiedPayee(payee: Payee): Payee {
  const names = payee.names.map((name) => name.trim()).filter((name, place, all) => payeeKey(name) !== '' && all.findIndex((other) => payeeKey(other) === payeeKey(name)) === place)
  const ibans = [...new Set(payee.ibans.map(normaliseIban).filter((iban) => iban !== ''))]
  return { ...payee, names, ibans, taxId: payee.taxId.trim(), website: payee.website.trim(), note: payee.note.trim() }
}

/** A payee of the name, with an id of its own and no details yet. */
export function newPayee(name: string, party: PayeeParty | null = null): Payee {
  return tidiedPayee({ id: recordIdOf(PAYEE_RECORDS, newRecordId()), names: [name], ibans: [], party, taxId: '', website: '', note: '' })
}

/** The payee under the new name first, keeping every name it had, so rows spelt the old way stay its own. */
export function renamedPayee(payee: Payee, name: string): Payee {
  return tidiedPayee({ ...payee, names: [name, ...payee.names] })
}

/**
 * The payee with the other's names and IBANs after its own. Each field it has filled stays, an empty one takes the other's, and
 * the two notes join, so nothing either held is lost.
 */
export function mergedPayees(kept: Payee, other: Payee): Payee {
  return tidiedPayee({
    ...kept,
    names: [...kept.names, ...other.names],
    ibans: [...kept.ibans, ...other.ibans],
    party: kept.party ?? other.party,
    taxId: kept.taxId.trim() === '' ? other.taxId : kept.taxId,
    website: kept.website.trim() === '' ? other.website : kept.website,
    note: [kept.note, other.note]
      .map((note) => note.trim())
      .filter((note) => note !== '')
      .join('\n'),
  })
}

/** What a person sets on a payee: its name, the other spellings it keeps and every detail. */
export type PayeeEdit = Pick<Payee, 'party' | 'ibans' | 'taxId' | 'website' | 'note'> & { readonly name: string; readonly otherNames: readonly string[] }

/**
 * The payee with the edit: its first name, then the other spellings it keeps, so entries of a spelling taken off stop counting
 * under it. A name spelt another way is a rename, which keeps the old first name among the others.
 */
export function editedPayee(payee: Payee, edit: PayeeEdit): Payee {
  const names = [payee.names[0] ?? '', ...edit.otherNames]
  const kept = tidiedPayee({ ...payee, names, party: edit.party, ibans: edit.ibans, taxId: edit.taxId, website: edit.website, note: edit.note })
  return edit.name.trim() === (payee.names[0] ?? '') ? kept : renamedPayee(kept, edit.name)
}

/** Why the edited payee cannot be kept beside the others, as `payeeProblem` says, where a name that folds blank is no name although the old ones stay. */
export function payeeEditProblem(edited: Payee, name: string, payees: readonly Pick<Payee, 'id' | 'names' | 'ibans'>[]): PayeeProblem | null {
  return payeeKey(name) === '' ? { kind: 'no-name' } : payeeProblem(edited, payees)
}

/** The payee without the spelling, once folded. Its first name stays, since that is the name it shows under. */
export function withoutSpelling(payee: Payee, name: string): Payee {
  return { ...payee, names: payee.names.filter((held, place) => place === 0 || payeeKey(held) !== payeeKey(name)) }
}

/** The payee without the IBAN, once normalised. */
export function withoutIban(payee: Payee, iban: string): Payee {
  return { ...payee, ibans: payee.ibans.filter((held) => held !== normaliseIban(iban)) }
}

export function withParty(payee: Payee, party: PayeeParty | null): Payee {
  return { ...payee, party }
}

/** The payee with its names alone, every detail you added gone. */
export function withoutDetails(payee: Payee): Payee {
  return { ...payee, ibans: [], party: null, taxId: '', website: '', note: '' }
}

/** Whether the payee holds one name and no detail, so its rows read the same without the record. */
export function saysOnlyItsName(payee: Payee): boolean {
  return payee.names.length <= 1 && payee.ibans.length === 0 && payee.party === null && payee.taxId === '' && payee.website === '' && payee.note === ''
}

/** Whether the payee holds the name, once folded. */
export function holdsName(payee: Pick<Payee, 'names'>, name: string): boolean {
  const key = payeeKey(name)
  return key !== '' && payee.names.some((held) => payeeKey(held) === key)
}
