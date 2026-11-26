import { TEXT, TEXT_OR_NULL, choiceOf, inputOf } from '../../../../shared/app/operationInput'
import { clearPayee, mergePayees, savePayee } from '../../payees/application/payeeWrites'
import { editedPayee, holdsName, keyOfPayee, mergedPayees, newPayee, payeeEditProblem, withoutIban, withoutSpelling } from '../../payees/domain/payeeDetails'
import type { PayeeEdit } from '../../payees/domain/payeeDetails'
import { payeeNamed } from '../../payees/domain/payeeDirectory'
import { payeeKey } from '../../payees/domain/payeeKey'
import { PAYEE_PARTIES } from '../../workbook/domain/payee'
import type { Payee } from '../../workbook/domain/payee'
import type { SpendingBook, SpendingRecords } from '../../workbook/domain/readSpendingBook'
import { PAYEE_RECORDS } from '../../workbook/domain/spendingKinds'
import { en as bookWords, payeeReason } from '../../workbook/domain/words'
import type { AssistantOperation } from '../../../../shared/app/assistantOperations'
import { StepRefused } from '../../../../shared/app/proposedWrites'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import { groupedIban, ibanListOf } from '../../../../shared/text/iban'
import { normaliseIban } from '../../../../shared/text/fold'

/** What a step says of the party: a person, a business, not said, or null to keep it. */
const NOT_SAID = 'not-said'
const PARTY_OR_NULL = { type: ['string', 'null'], enum: [...PAYEE_PARTIES, NOT_SAID, null], description: `${PAYEE_PARTIES.join(', ')}, ${NOT_SAID}, or null to keep it.` } as const

const PAYEE_REF = { payee: PAYEE_RECORDS.name }

/** What a payee's page does in its details dialog: set the details, rename, join another payee in, take one spelling or IBAN off and clear the details. No entry changes. */
export const PAYEE_OPERATIONS: readonly AssistantOperation[] = [
  {
    name: 'set-payee-details',
    about:
      'Sets what you keep of a payee: whether they are a person or a business, the IBANs that gather their entries, comma separated and replacing the whole list, their tax number, website and note. Null keeps a field and "" clears a text. Only the person takes a person mark off, on the payee\'s page.',
    input: inputOf({ payee: TEXT, party: PARTY_OR_NULL, ibans: TEXT_OR_NULL, taxId: TEXT_OR_NULL, website: TEXT_OR_NULL, note: TEXT_OR_NULL }),
    refs: PAYEE_REF,
    creates: null,
    alone: false,
    example: { payee: 'payee', party: 'business', ibans: 'HR1210010051863000160', taxId: null, website: null, note: null },
  },
  {
    name: 'rename-payee',
    about: 'A new name for a payee to show under. Every name they had stays one of their spellings, so no entry changes.',
    input: inputOf({ payee: TEXT, name: TEXT }),
    refs: PAYEE_REF,
    creates: null,
    alone: false,
    example: { payee: 'payee', name: 'Corner shop' },
  },
  {
    name: 'merge-payees',
    about:
      'Joins the other payee into this one: their names, IBANs and the details this one lacks move here, the notes join, and the other goes. No entry changes. Only the person joins a person into a payee that is not one.',
    input: inputOf({ payee: TEXT, other: TEXT }),
    refs: { ...PAYEE_REF, other: PAYEE_RECORDS.name },
    creates: null,
    alone: false,
    example: { payee: 'payee', other: 'payee-other' },
  },
  {
    name: 'take-spelling-off-payee',
    about:
      "Takes one of a payee's other spellings off, so entries spelt that way stop counting under the payee unless an IBAN it holds still finds them. No entry changes. The name the payee shows under stays, so rename the payee first to take that one off.",
    input: inputOf({ payee: TEXT, spelling: TEXT }),
    refs: PAYEE_REF,
    creates: null,
    alone: false,
    example: { payee: 'payee', spelling: 'BAKERY D.O.O.' },
  },
  {
    name: 'take-iban-off-payee',
    about:
      'Takes one IBAN you added off a payee, so entries from it stop counting under the payee unless one of its names still finds them. No entry changes. An IBAN only their bank rows carry was never added, so it cannot be taken off.',
    input: inputOf({ payee: TEXT, iban: TEXT }),
    refs: PAYEE_REF,
    creates: null,
    alone: false,
    example: { payee: 'payee', iban: 'HR3512345670000000002' },
  },
  {
    name: 'clear-payee-details',
    about: "Takes off every detail you keep of a payee and keeps their names. Only the person clears a person's details.",
    input: inputOf({ payee: TEXT }),
    refs: PAYEE_REF,
    creates: null,
    alone: false,
    example: { payee: 'payee' },
  },
]

const PAYEE_OPERATION_NAMES: ReadonlySet<string> = new Set(PAYEE_OPERATIONS.map((operation) => operation.name))

/** Whether the step is one of the payee operations. */
export function isPayeeStep(operation: string): boolean {
  return PAYEE_OPERATION_NAMES.has(operation)
}

/** The payee the key names: the record you keep, or a new one of the name their entries spell. */
function payeeOf(book: SpendingBook, key: string): Payee {
  const record = book.payees.find((payee) => keyOfPayee(payee) === key)
  if (record !== undefined) return record
  const named = payeeNamed(book, key)
  if (named === null) throw new StepRefused('That payee is no longer in the file.')
  return newPayee(named.name)
}

function editOf(payee: Payee): PayeeEdit {
  return { name: payee.names[0] ?? '', otherNames: payee.names.slice(1), party: payee.party, ibans: payee.ibans, taxId: payee.taxId, website: payee.website, note: payee.note }
}

/** Refuses a payee the payees could not keep, in the words a refused write uses, and a person who would lose the mark. */
function refuseProblem(book: SpendingBook, kept: Payee, name: string, leaving: Payee | null, wasPerson: boolean): void {
  const problem = payeeEditProblem(
    kept,
    name,
    book.payees.filter((payee) => payee.id !== leaving?.id),
  )
  if (problem !== null) throw new StepRefused(bookWords.payeeRefused(name.trim(), payeeReason(problem, bookWords)))
  if (wasPerson && kept.party !== 'person') throw new StepRefused("Only the person takes a person mark off a payee, on the payee's page.")
}

/** The details a set-payee-details step gives, each null field kept as the payee has it. */
function detailsEdit(kept: PayeeEdit, field: Readonly<Record<string, never>>): PayeeEdit {
  const party = choiceOf([...PAYEE_PARTIES, NOT_SAID], field['party'], 'party')
  return {
    ...kept,
    party: party === null ? kept.party : party === NOT_SAID ? null : party,
    ibans: field['ibans'] === null ? kept.ibans : ibanListOf(field['ibans']),
    taxId: field['taxId'] ?? kept.taxId,
    website: field['website'] ?? kept.website,
    note: field['note'] ?? kept.note,
  }
}

/** The payee without one of its other spellings, refusing the name it shows under and a spelling it does not hold. */
function spellingTakenOff(payee: Payee, spelling: string): Payee {
  const name = payee.names[0] ?? ''
  if (payeeKey(spelling) === keyOfPayee(payee)) throw new StepRefused(`${name} is the name the payee shows under, so it stays. Rename the payee first to take it off.`)
  if (!holdsName(payee, spelling)) throw new StepRefused(`${spelling.trim()} is not one of ${name}'s spellings.`)
  return withoutSpelling(payee, spelling)
}

/** The payee without one IBAN you added, refusing one it does not hold. */
function ibanTakenOff(payee: Payee, iban: string): Payee {
  if (!payee.ibans.includes(normaliseIban(iban))) throw new StepRefused(`${groupedIban(normaliseIban(iban))} is not an IBAN you added to ${payee.names[0] ?? ''}.`)
  return withoutIban(payee, iban)
}

/** Writes a payee step through the writes the payee's details dialog uses. */
export function writePayeeStep(
  unit: UnitOfWork,
  book: SpendingBook,
  records: Pick<SpendingRecords, 'payees' | 'settings'>,
  operation: string,
  field: Readonly<Record<string, never>>,
  idOf: (value: unknown) => string,
): void {
  const payee = payeeOf(book, idOf(field['payee']))
  const wasPerson = payee.party === 'person'
  if (operation === 'clear-payee-details') {
    if (wasPerson) throw new StepRefused("Only the person clears a person's details, on the payee's page.")
    clearPayee(unit, records, payee)
    return
  }
  if (operation === 'merge-payees') {
    const other = payeeOf(book, idOf(field['other']))
    if (other.id === payee.id || keyOfPayee(other) === keyOfPayee(payee)) throw new StepRefused('A payee cannot be joined into themselves.')
    refuseProblem(book, mergedPayees(payee, other), payee.names[0] ?? '', other, wasPerson || other.party === 'person')
    mergePayees(unit, records, payee, other)
    return
  }
  if (operation === 'take-spelling-off-payee' || operation === 'take-iban-off-payee') {
    const without = operation === 'take-spelling-off-payee' ? spellingTakenOff(payee, field['spelling']) : ibanTakenOff(payee, field['iban'])
    refuseProblem(book, without, payee.names[0] ?? '', null, wasPerson)
    savePayee(unit, records, without)
    return
  }
  const kept = editOf(payee)
  const edit: PayeeEdit = operation === 'rename-payee' ? { ...kept, name: field['name'] } : detailsEdit(kept, field)
  const edited = editedPayee(payee, edit)
  refuseProblem(book, edited, edit.name, null, wasPerson)
  savePayee(unit, records, edited)
}
