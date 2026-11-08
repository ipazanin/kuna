import { NUMBER, NUMBER_OR_NULL, TEXT, TEXT_OR_NULL, dayOf, found, inputOf, isAttachment } from '../../../../shared/app/operationInput'
import type { ReceiptPhotos } from '../../receipts/application/receiptPhotos'
import { writeReceiptSplit } from '../../receipts/application/receiptWrites'
import { fiscalQr } from '../../receipts/domain/fiscalQr'
import type { FiscalQr } from '../../receipts/domain/fiscalQr'
import { placeInPhoto } from '../../receipts/domain/photoPlace'
import type { PhotoPlace } from '../../receipts/domain/photoPlace'
import { LINE_KINDS, receiptDraft, withR1Answer } from '../../receipts/domain/receiptDraft'
import type { AnsweredLine, R1Answer, ReceiptAnswer } from '../../receipts/domain/receiptDraft'
import { heldReceiptOf, receiptAccounts, receiptMatches, splittableRows } from '../../receipts/domain/receiptMatch'
import type { ReceiptFacts } from '../../receipts/domain/receiptMatch'
import { receiptSplit } from '../../receipts/domain/receiptSplit'
import type { ReceiptPlace, ReceiptSplit } from '../../receipts/domain/receiptSplit'
import type { Account } from '../../workbook/domain/account'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import { ACCOUNT_RECORDS, CATEGORY_RECORDS, TRANSACTION_RECORDS } from '../../workbook/domain/spendingKinds'
import type { Transaction } from '../../workbook/domain/transaction'
import { words } from '../words'
import { ATTACHMENT_REF } from '../../../../shared/app/assistantOperations'
import type { AssistantOperation, ProposalLine, ProposalStep } from '../../../../shared/app/assistantOperations'
import { StepRefused } from '../../../../shared/app/proposedWrites'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { EURO } from '../../../../shared/money/currencyCode'
import { formatAccountMoney } from '../../../../shared/money/moneyFormat'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'

const ANSWERS: readonly R1Answer[] = ['company', 'personal']

export const ADD_RECEIPT: AssistantOperation = {
  name: 'add-receipt',
  about: [
    'Adds a fiscal receipt from a photo attached to the chat, as Entries, Add a receipt does, splitting the payment into its lines. Read the photo with read_attachment first and copy what is printed. Never guess hidden or cut-off text: use null, and name the part in unreadable.',
    'Kuna reads the QR code and the place the photo was taken from the photo itself, and their date and total win over yours.',
    'entry is the payment it splits, found with find_records near its day and total. Only a payment Entries, Add a receipt would offer can go: the same total near the day, or a near total when none is the same.',
    'With entry null, account names the euro account of a new entry, which goes only when no payment on the file may be this receipt.',
    'Amounts are euros above zero, a discount below zero. Each line gets a category ref Kuna handed out, a spending category with no categories under it.',
    'A line whose category does not exist yet waits: propose that category on a card of its own first, and this receipt on the next card once it is accepted.',
    'A receipt marked R1, or naming a buyer, with no buyer\'s OIB readable needs the person to say whose it is: whose is "company" or "personal", as they said. A buyer\'s OIB Kuna can read decides by itself, so whose is null then, as for every other receipt.',
    'keepPhoto true keeps the photo as taken in the Receipts folder beside the Spending file on Drive, which stays there after Undo. Ask the person first.',
  ].join(' '),
  input: inputOf({
    photo: TEXT,
    entry: TEXT_OR_NULL,
    account: TEXT_OR_NULL,
    merchant: TEXT,
    merchantOib: TEXT_OR_NULL,
    buyerOib: TEXT_OR_NULL,
    markedR1: { type: 'boolean' },
    whose: { type: ['string', 'null'], description: '"company" or "personal", as the person said, for an R1 receipt Kuna cannot tell. Otherwise null.' },
    issuedOn: TEXT_OR_NULL,
    issuedAt: TEXT_OR_NULL,
    jir: TEXT_OR_NULL,
    zki: TEXT_OR_NULL,
    lines: {
      type: 'array',
      items: inputOf({
        printed: TEXT,
        text: { type: 'string', description: 'The line in plain words, so "MLIJ.TR.2,8% 1L" becomes "mlijeko trajno 2,8% 1 l".' },
        kind: { type: 'string', enum: [...LINE_KINDS] },
        quantity: NUMBER_OR_NULL,
        unitPrice: NUMBER_OR_NULL,
        lineTotal: NUMBER,
        category: TEXT,
      }),
    },
    vat: { type: 'array', items: inputOf({ base: NUMBER, tax: NUMBER }) },
    total: NUMBER,
    unreadable: { type: 'array', items: TEXT },
    keepPhoto: { type: 'boolean' },
  }),
  refs: { photo: ATTACHMENT_REF, entry: TRANSACTION_RECORDS.name, account: ACCOUNT_RECORDS.name, 'lines.category': CATEGORY_RECORDS.name },
  creates: null,
  alone: false,
  example: {
    photo: 'photo',
    entry: null,
    account: 'account',
    merchant: 'Corner market',
    merchantOib: null,
    buyerOib: null,
    markedR1: false,
    whose: null,
    issuedOn: '2026-11-02',
    issuedAt: '18:42',
    jir: null,
    zki: null,
    lines: [
      { printed: 'KRUH', text: 'kruh', kind: 'product', quantity: null, unitPrice: null, lineTotal: 3.2, category: 'category' },
      { printed: 'DET.TEK.', text: 'deterdžent tekući', kind: 'product', quantity: null, unitPrice: null, lineTotal: 5.5, category: 'category-other' },
    ],
    vat: [],
    total: 8.7,
    unreadable: [],
    keepPhoto: false,
  },
}

/** What adding a receipt needs beyond the books, which `app.ts` hands in. */
export interface ReceiptPorts {
  /** The text of the QR code on a photo, or null for none. Throws for a photo this browser cannot decode. */
  qrTextOn(photo: Blob): Promise<string | null>
  /** Whether the books are on Drive, beside which alone a photo is kept. */
  keepsOnDrive(): boolean
  /** Whether Accept reaches Drive with the access already given, without leaving the page. */
  mayKeepNow(): boolean
  /** Drive's Receipts folder. It may open Google's popup for a fresh token, so only Accept's click calls it. */
  photos(): Promise<ReceiptPhotos>
  /** The model the chat runs, which the receipt keeps as the one that read it. */
  reader(): string
}

/** The photo as this device read it, which stands in the step for the attachment once read. */
interface PhotoRead {
  /** The file attached to the chat, which a photo already kept is known by. */
  readonly attached: Blob
  readonly file: File
  readonly qr: FiscalQr | null
  readonly place: PhotoPlace | null
}

/** The Drive id each step's photo was kept under, by the step's place, blank for one not kept. */
export type KeptPhotos = readonly string[]

function isPhotoRead(photo: unknown): photo is PhotoRead {
  return typeof photo === 'object' && photo !== null && 'attached' in photo && 'file' in photo && 'qr' in photo && 'place' in photo
}

/** The QR code a photo holds, or null for none and for a photo this browser cannot decode, whose date and total the model then reads. */
async function qrOf(photo: Blob, ports: Pick<ReceiptPorts, 'qrTextOn'>): Promise<FiscalQr | null> {
  try {
    const text = await ports.qrTextOn(photo)
    return text === null ? null : fiscalQr(text)
  } catch {
    return null
  }
}

/** The steps with each receipt's photo read for its QR code and place, since a dry run cannot wait for a file. Or why a file is no receipt photo. */
export async function withPhotosRead(steps: readonly ProposalStep[], ports: Pick<ReceiptPorts, 'qrTextOn'>): Promise<readonly ProposalStep[] | { readonly refused: readonly string[] }> {
  const read: ProposalStep[] = []
  for (const step of steps) {
    const photo = step.input['photo']
    if (step.operation !== ADD_RECEIPT.name) {
      read.push(step)
      continue
    }
    if (!isAttachment(photo)) return { refused: ['photo is not a file attached to this chat.'] }
    if (photo.kind !== 'photo') return { refused: ['A receipt is added from a photo. Read a PDF receipt and type it into an entry instead.'] }
    const file = new File([photo.original], photo.name, { type: photo.original.type })
    const photoRead: PhotoRead = { attached: photo.original, file, qr: await qrOf(file, ports), place: await placeInPhoto(file) }
    read.push({ ...step, input: { ...step.input, photo: photoRead } })
  }
  return read
}

/** The day a receipt's photo is kept under: the QR code's, else the one read. The check refused a step with neither. */
function issuedOnOf(input: Readonly<Record<string, unknown>>, photo: PhotoRead): CivilDate {
  return photo.qr?.issuedOn ?? dayOf(String(input['issuedOn']))
}

function photoOf(input: Readonly<Record<string, unknown>>): PhotoRead {
  const photo = input['photo']
  if (!isPhotoRead(photo)) throw new StepRefused('photo is not a file attached to this chat.')
  return photo
}

/**
 * Keeps each photo a card asks to keep, in Accept's click, so Firefox lets Google's popup open. A photo this chat already kept
 * for a card whose write was then refused is not kept again, as the receipt dialog's retry does. Throws in the person's words when Drive cannot be reached now.
 */
export async function keptPhotos(steps: readonly ProposalStep[], ports: Pick<ReceiptPorts, 'mayKeepNow' | 'photos'>, keptBefore: WeakMap<Blob, string>): Promise<KeptPhotos> {
  const keeping = steps.map((step) => (step.operation === ADD_RECEIPT.name && step.input['keepPhoto'] === true ? photoOf(step.input) : null))
  const fresh = steps.flatMap((step, at) => {
    const photo = keeping[at]
    return photo === null || photo === undefined || keptBefore.has(photo.attached) ? [] : [{ step, photo }]
  })
  if (fresh.length > 0) {
    if (!ports.mayKeepNow()) throw new Error(words.receipts.keepNoAccess)
    const photos = await ports.photos()
    for (const { step, photo } of fresh) keptBefore.set(photo.attached, await photos.keep(photo.file, issuedOnOf(step.input, photo)))
  }
  return keeping.map((photo) => (photo === null ? '' : keptBefore.get(photo.attached)!))
}

/** What Accept leaves on Drive, which Undo does not take back. */
export function receiptsOutside(steps: readonly ProposalStep[]): readonly string[] {
  return steps.filter((step) => step.operation === ADD_RECEIPT.name && step.input['keepPhoto'] === true).map(() => words.receipts.photoStays)
}

/** The receipt as the model read it, in the shape the receipt draft checks. */
function answerOf(field: Readonly<Record<string, never>>): ReceiptAnswer {
  return {
    merchant: { name: field['merchant'], oib: field['merchantOib'] },
    buyerOib: field['buyerOib'],
    markedR1: field['markedR1'],
    issuedOn: field['issuedOn'],
    issuedAt: field['issuedAt'],
    jir: field['jir'],
    zki: field['zki'],
    lines: field['lines'] as readonly AnsweredLine[],
    vat: field['vat'],
    total: field['total'],
    unreadable: field['unreadable'],
  }
}

/** A note as a sentence on the card. */
function sentence(note: string): string {
  return /[.!?]$/.test(note) ? note : `${note}.`
}

/**
 * The row the receipt splits, among the payments Entries, Add a receipt offers for it, or the euro account of the new entry it
 * makes. A new entry goes only when no payment may be this receipt, so the model names the payment rather than doubling it.
 */
function placeOf(field: Readonly<Record<string, never>>, book: SpendingBook, receipt: ReceiptFacts, idOf: (value: unknown) => string): ReceiptPlace {
  const matches = receiptMatches(receipt, book)
  const candidates = matches.kind === 'none' ? [] : matches.candidates.map((candidate) => candidate.row)
  if (field['entry'] !== null) {
    if (field['account'] !== null) throw new StepRefused('A receipt splits the entry named, or with entry null makes a new entry on account, not both.')
    const entry = idOf(field['entry'])
    if (!splittableRows(book).some((row) => row.id === entry))
      throw new StepRefused('That entry cannot take a receipt: it is not on a euro account, it has a receipt, or it moves money between your accounts.')
    const row: Transaction | undefined = candidates.find((candidate) => candidate.id === entry)
    if (row === undefined)
      throw new StepRefused(
        "That payment is not one this receipt may be. Entries, Add a receipt offers a payment of the same total near the receipt's day, or a near total when none is the same. Name one of those, or propose entry null with an account when none is on the file.",
      )
    return { row }
  }
  if (field['account'] === null) throw new StepRefused('A receipt splits the entry named, or with entry null makes a new entry on account.')
  if (candidates.length > 0)
    throw new StepRefused(
      `A payment on the file may be this receipt: ${candidates
        .slice(0, 3)
        .map((row) => `${formatAccountMoney(row.amount, EURO)} on ${dayLabel(row.date)}`)
        .join(', ')}. Find it with find_records and name it in entry. If the person says none of them is this receipt, link Entries, where Add a receipt makes a new entry.`,
    )
  const account: Account = found(book.accounts, idOf(field['account']), 'account')
  if (!receiptAccounts(book.accounts).includes(account)) throw new StepRefused('A fiscal receipt is in euros, so a new entry goes on an open euro account.')
  if (receipt.issuedOn < account.openedOn) throw new StepRefused('That day is before the account opened.')
  return { account: account.id }
}

/** What the card warns on for one receipt: the read's checks that failed. */
function warningOf(notes: readonly string[], split: ReceiptSplit): ProposalLine | null {
  return notes.length === 0 ? null : { label: split.receipt.merchant, fields: [], warning: notes.map(sentence).join(' ') }
}

/**
 * Plans one receipt into the write, through the dialog's own split and write: checked as a read, its R1 answered, placed on
 * its row or a new entry. Gives the split, so later steps see it, and the card's warning on it.
 */
export function writeReceiptStep(
  unit: UnitOfWork,
  book: SpendingBook,
  field: Readonly<Record<string, never>>,
  idOf: (value: unknown) => string,
  ports: Pick<ReceiptPorts, 'keepsOnDrive' | 'mayKeepNow' | 'reader'>,
  photoId: string,
): { readonly split: ReceiptSplit; readonly warning: ProposalLine | null } {
  const photo = photoOf(field)
  if (field['keepPhoto'] === true && !ports.keepsOnDrive()) throw new StepRefused('The photo is kept only beside a Spending file on Drive. Propose it with keepPhoto false.')
  if (field['keepPhoto'] === true && !ports.mayKeepNow())
    throw new StepRefused(
      'Kuna cannot reach Drive on this device without leaving the page, so it cannot keep the photo now. Propose it with keepPhoto false, or link Entries, where Add a receipt keeps it after a sync.',
    )
  const whose = ANSWERS.find((answer) => answer === field['whose']) ?? null
  if (whose === null && field['whose'] !== null) throw new StepRefused('whose is "company", "personal" or null.')
  const answer = answerOf(field)
  const unknown = answer.lines.filter((line) => !book.categories.some((category) => category.id === idOf(line.category)))
  if (unknown.length > 0) throw new StepRefused('A new category goes on a card of its own first, and this receipt on the next card once that one is accepted.')
  const drafted = receiptDraft({ ...answer, lines: answer.lines.map((line) => ({ ...line, category: idOf(line.category) })) }, { qr: photo.qr, book, companyOib: book.settings.companyOib })
  const company = book.categories.find((category) => category.kind === 'company')
  let read = drafted.read
  if (read.r1Asked) {
    if (whose === null) throw new StepRefused("This receipt is marked R1, or names a buyer, with no buyer's OIB readable. Ask the person whether it is for the company, then propose it with whose.")
    read = withR1Answer(read, whose, company!.id)
  } else if (whose !== null) throw new StepRefused("whose is null unless the receipt is marked R1, or names a buyer, with no buyer's OIB readable.")
  if (read.issuedOn === null) throw new StepRefused('The receipt needs its date as printed in issuedOn, as no QR code gives one.')
  if (read.total === null) throw new StepRefused('The receipt needs its printed total above zero, as no QR code gives one.')
  if (read.lines.length === 0) throw new StepRefused('A receipt holds its lines as printed, each with an amount.')
  const unfiled = read.lines.filter((line) => line.category === null)
  if (unfiled.length > 0)
    throw new StepRefused(
      `${unfiled.map((line) => line.printed).join(', ')}: a line goes under a spending category a person can pick, with none under it. For the company comes only through the R1 rule or whose.`,
    )
  const held = heldReceiptOf(read, book.receipts)
  if (held !== null) throw new StepRefused('This fiscal receipt is already on the file, as its JIR or ZKI says. Removing it from its entry comes first.')
  const split = receiptSplit(
    {
      merchant: read.merchant,
      merchantOib: read.merchantOib,
      buyerOib: read.buyerOib,
      issuedOn: read.issuedOn,
      issuedTime: read.issuedTime,
      total: read.total,
      jir: read.jir,
      zki: read.zki,
      readBy: ports.reader(),
      photo: photoId,
      latitude: photo.place?.latitude ?? '',
      longitude: photo.place?.longitude ?? '',
    },
    placeOf(field, book, { merchant: read.merchant, issuedOn: read.issuedOn, total: read.total }, idOf),
    read.lines.map((line) => ({ printed: line.printed, text: line.text, amount: line.amount, category: line.category! })),
  )
  writeReceiptSplit(unit, split)
  return { split, warning: warningOf(drafted.notes, split) }
}
