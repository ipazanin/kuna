import { answered, answersSince, findRecordsArgs, lookup, proposedStep } from '../../../../../shared/ai/infrastructure/fake/fakeChatReply'
import type { FakeChatTurn } from '../../../../../shared/ai/infrastructure/fake/fakeChatReply'
import type { ModelReply } from '../../../../../shared/ai/application/modelPort'
import type { CivilDate } from '../../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../../shared/calendar/dayLabel'
import { language } from '../../../../../shared/text/language'
import { SPENDING_OPERATIONS } from '../../operations/spendingOperations'
import { fakeSpendingDayHere } from '../../../workbook/infrastructure/fake/fakeSpending'
import { GROCERIES, HOUSEHOLD, personTexts, recordsIn } from './fakeSpendingRecords'

const ANSWERS = {
  en: {
    noPhoto: 'Attach a photo of the receipt first, and I will read its lines.',
    petFood: 'Pet food',
    categoryTitle: 'A category for pet food',
    categoryFirst: 'One line is pet food, which has no category yet. Accept the card below, then ask me to read the receipt again.',
    receiptTitle: 'The receipt from Corner market',
    receiptProposed: 'The card below splits the payment into the lines I read. Nothing changes until you accept it.',
    pickWhich: (payments: string) => `The receipt may be any of these payments: ${payments}. Which one was it?`,
    paymentOn: (amount: string, day: string) => `${amount} on ${day}`,
    wasItCash: 'No payment in Spending matches this receipt. Did you pay in cash?',
    noPayment: 'None of the latest rows is a spend I could split.',
    pickedTitle: 'The receipt on Harbour bistro',
    pickedProposed: 'The card below puts the receipt on the Harbour bistro payment you picked. Check what the card says differs before you accept.',
    taggedTitle: 'The receipt on the entry you took it for',
    taggedProposed: 'The card below puts the receipt on the entry you took the photo for. Check what the card says differs before you accept.',
    cashTitle: 'A cash receipt',
    cardTitle: 'A card receipt',
    cardProposed: 'The card below keeps the receipt with the lines I read until the bank brings the payment. Nothing changes until you accept it.',
    noCardAccount: 'You keep no euro account the bank fills, so tell me which account the card is on.',
    cashProposed: 'The card below makes the cash payment with the lines I read. Nothing changes until you accept it.',
    howMuchCash: 'You keep no cash account in euros yet. How much cash did you have before you paid?',
    cashAccountFirst: 'The card below adds a cash account with what you had and puts the receipt on it.',
    cashName: 'Cash',
    whichCash: (accounts: string) => `Which cash account did you pay from: ${accounts}?`,
  },
  hr: {
    noPhoto: 'Najprije priložite fotografiju fiskalnog računa, pa ću pročitati stavke.',
    petFood: 'Hrana za ljubimce',
    categoryTitle: 'Kategorija za hranu za ljubimce',
    categoryFirst: 'Jedna je stavka hrana za ljubimce, za koju još nema kategorije. Prihvatite karticu ispod, pa me ponovno zamolite da pročitam račun.',
    receiptTitle: 'Fiskalni račun iz trgovine Corner market',
    receiptProposed: 'Kartica ispod dijeli plaćanje na stavke koje sam pročitao. Ništa se ne mijenja dok je ne prihvatite.',
    pickWhich: (payments: string) => `Fiskalni račun može biti bilo koje od ovih plaćanja: ${payments}. Koje je to bilo?`,
    paymentOn: (amount: string, day: string) => `${amount} od ${day}`,
    wasItCash: 'Nijedno plaćanje u Potrošnji ne odgovara ovom računu. Jeste li platili gotovinom?',
    noPayment: 'Nijedan od zadnjih redaka nije trošak koji bih mogao podijeliti.',
    pickedTitle: 'Fiskalni račun na plaćanju Harbour bistro',
    pickedProposed: 'Kartica ispod stavlja fiskalni račun na plaćanje Harbour bistro koje ste odabrali. Prije nego što prihvatite, provjerite što kartica kaže da se razlikuje.',
    taggedTitle: 'Fiskalni račun na unosu za koji ste ga snimili',
    taggedProposed: 'Kartica ispod stavlja fiskalni račun na unos za koji ste ga snimili. Prije nego što prihvatite, provjerite što kartica kaže da se razlikuje.',
    cashTitle: 'Fiskalni račun plaćen gotovinom',
    cardTitle: 'Fiskalni račun plaćen karticom',
    cardProposed: 'Kartica ispod čuva fiskalni račun sa stavkama koje sam pročitao dok banka ne donese plaćanje. Ništa se ne mijenja dok je ne prihvatite.',
    noCardAccount: 'Nemate račun u eurima koji puni banka, pa mi recite na kojem je računu kartica.',
    cashProposed: 'Kartica ispod upisuje plaćanje gotovinom sa stavkama koje sam pročitao. Ništa se ne mijenja dok je ne prihvatite.',
    howMuchCash: 'Još nemate račun gotovine u eurima. Koliko ste gotovine imali prije plaćanja?',
    cashAccountFirst: 'Kartica ispod dodaje račun gotovine s iznosom koji ste imali i stavlja fiskalni račun na njega.',
    cashName: 'Gotovina',
    whichCash: (accounts: string) => `S kojeg ste računa gotovine platili: ${accounts}?`,
  },
}

const says = ANSWERS[language]

/** A made-up OIB whose check digit is right. */
export const MADE_UP_MERCHANT_OIB = '12345678903'
/** Another, the made-up buyer of an R1 receipt. */
export const MADE_UP_BUYER_OIB = '11111111119'
/** The OIB the fake Company keeps on its invoicing terms, which an R1 receipt for the company names as its buyer. */
export const FAKE_COMPANY_OIB = '00000000001'

const PET_FOOD: readonly string[] = [ANSWERS.en.petFood, ANSWERS.hr.petFood]

/** The id of the last photo the context lines name, or null for none. */
function lastPhotoId(request: FakeChatTurn['request']): string | null {
  return (
    [
      ...personTexts(request)
        .join('\n')
        .matchAll(/\b(a\d+) \(photo\)/g),
    ].at(-1)?.[1] ?? null
  )
}

/** The ref of the entry the chat is tagged with, as a row's camera tags it, or null for none. */
function taggedEntry(request: FakeChatTurn['request']): string | null {
  return (
    [
      ...personTexts(request)
        .join('\n')
        .matchAll(/Tagged element: the transaction (\S+) of spending\b/g),
    ].at(-1)?.[1] ?? null
  )
}

/** A line of the sample receipt, whose lines add up to its QR code's €23.49. */
function receiptLine(printed: string, text: string, lineTotal: number, category: string, fields: Readonly<Record<string, unknown>> = {}) {
  return { printed, text, kind: 'product', lineTotal, category, ...fields }
}

/** One receipt's answer from match_records, as far as the fake chat reads it. */
interface ReceiptMatched {
  readonly match: 'ready' | 'pick' | 'none'
  readonly payments: readonly { readonly ref: string; readonly date: CivilDate; readonly amount: { readonly ref: string } }[]
}

function receiptMatchedIn(text: string): ReceiptMatched {
  return (JSON.parse(text) as { readonly receipts: readonly ReceiptMatched[] }).receipts[0]!
}

/**
 * With an entry tagged, the receipt goes on it. Otherwise reads the attached photo as the sample €23.49 receipt of the day and asks Kuna which payments it may be, which Kuna answers
 * from the photo's own QR code. With several it asks which one, and with none whether it was paid in cash. With one ready it
 * looks Pet food up by name. That has no category yet, so the first time it proposes that category alone, and once it is
 * there it proposes the receipt that splits the payment.
 */
export function receiptReply(turn: FakeChatTurn): ModelReply {
  const { request, tokens } = turn
  const photo = lastPhotoId(request)
  if (photo === null) return answered(request, says.noPhoto, tokens)
  const tagged = taggedEntry(request)
  if (tagged !== null) return taggedReceiptReply(turn, photo, tagged)
  const answers = answersSince(request)
  if (answers.length === 0) return lookup(0, 'read_attachment', { attachment: photo, pages: null, sheet: null, rows: null }, tokens)
  if (answers.length === 1) {
    const receipts = [{ date: fakeSpendingDayHere(), total: 23.49, merchant: 'Corner market', photo }]
    return lookup(1, 'match_records', { app: 'spending', kind: 'receipt', account: null, rows: [], receipts }, tokens)
  }
  const matched = receiptMatchedIn(answers[1]!.text)
  if (matched.match === 'pick') return answered(request, says.pickWhich(matched.payments.map((payment) => says.paymentOn(`[${payment.amount.ref}]`, dayLabel(payment.date))).join(', ')), tokens)
  if (matched.match === 'none') return answered(request, says.wasItCash, tokens)
  if (answers.length === 2) return lookup(2, 'find_records', findRecordsArgs('spending', 'category', { query: says.petFood, limit: 5 }), tokens)
  const petFood = recordsIn(answers[2]!.text).find((category) => PET_FOOD.includes(category.name ?? ''))?.ref
  if (petFood === undefined) {
    if (answers.length > 3) return answered(request, says.categoryFirst, tokens)
    const step = proposedStep(SPENDING_OPERATIONS, 'add-category', { name: says.petFood, kind: 'spending' })
    return lookup(3, 'propose_changes', { app: 'spending', title: says.categoryTitle, steps: [step], next: false }, tokens)
  }
  if (answers.length === 3) return lookup(3, 'find_records', findRecordsArgs('spending', 'category', { limit: 50 }), tokens)
  if (answers.length === 4) {
    const categories = recordsIn(answers[3]!.text)
    const refOf = (names: readonly string[]): string | undefined => categories.find((category) => names.includes(category.name ?? ''))?.ref
    const groceries = refOf(GROCERIES) ?? petFood
    const step = proposedStep(SPENDING_OPERATIONS, 'add-receipt', {
      photo,
      paid: 'card',
      entry: matched.payments[0]!.ref,
      merchant: 'Corner market',
      merchantOib: MADE_UP_MERCHANT_OIB,
      issuedOn: fakeSpendingDayHere(),
      issuedAt: '18:42',
      lines: [
        receiptLine('MLIJ.TR.2,8%1L', 'mlijeko trajno 2,8% 1 l', 12.3, groceries),
        receiptLine('KRUH POLUBIJ.', 'kruh polubijeli', 3.2, groceries, { quantity: 2, unitPrice: 1.6 }),
        receiptLine('POPUST', 'popust', -1.01, groceries, { kind: 'discount' }),
        receiptLine('DET.TEK.', 'deterdžent tekući', 5.5, refOf(HOUSEHOLD) ?? groceries),
        receiptLine('PSEC.HR.', 'pseća hrana', 3.5, petFood),
      ],
      vat: [{ base: 18.79, tax: 4.7 }],
      total: 23.49,
      keepPhoto: true,
    })
    return lookup(4, 'propose_changes', { app: 'spending', title: says.receiptTitle, steps: [step], next: false }, tokens)
  }
  return answered(request, says.receiptProposed, tokens)
}

/** The sample €17.00 receipt as read off its photo, dated the day of the run, its lines under the category given, paid as said and placed as said. */
function receiptOf17(
  photo: string,
  paid: 'cash' | 'card',
  category: string,
  place: { readonly entry: string | null; readonly account: string | null },
  buyerOib: string | null = null,
): ReturnType<typeof proposedStep> {
  return proposedStep(SPENDING_OPERATIONS, 'add-receipt', {
    photo,
    paid,
    ...place,
    buyerOib,
    markedR1: buyerOib !== null,
    merchant: 'Harbour bistro',
    merchantOib: MADE_UP_MERCHANT_OIB,
    issuedOn: fakeSpendingDayHere(),
    issuedAt: '18:42',
    lines: [receiptLine('PIZZA MARG.', 'pizza margherita', 12, category), receiptLine('SOK NARANČA', 'sok od naranče', 5, category)],
    vat: [],
    total: 17,
    keepPhoto: false,
  })
}

/**
 * Reads the attached photo as the sample €17.00 receipt and puts it on the Harbour bistro payment the person named, under the
 * category its part is filed in, a payment of another day and amount that may be split by hand already, so the card warns on each.
 */
export function pickedReceiptReply({ request, tokens }: FakeChatTurn): ModelReply {
  const photo = lastPhotoId(request)
  if (photo === null) return answered(request, says.noPhoto, tokens)
  const answers = answersSince(request)
  if (answers.length === 0) return lookup(0, 'read_attachment', { attachment: photo, pages: null, sheet: null, rows: null }, tokens)
  if (answers.length === 1) return lookup(1, 'find_records', findRecordsArgs('spending', 'transaction', { query: 'Harbour bistro', limit: 5 }), tokens)
  if (answers.length === 2) {
    const rows = recordsIn(answers[1]!.text).map((row) => row.ref)
    return lookup(2, 'find_records', findRecordsArgs('spending', 'item', { refs: rows, fields: ['transaction', 'category'], limit: 20 }), tokens)
  }
  if (answers.length === 3) {
    const items = recordsIn(answers[2]!.text)
    const filed = recordsIn(answers[1]!.text)
      .flatMap((row) => items.filter((item) => item.transaction === row.ref))
      .find((item) => item.category !== undefined)
    if (filed?.category === undefined || filed.transaction === undefined) return answered(request, says.noPayment, tokens)
    const step = receiptOf17(photo, 'card', filed.category, { entry: filed.transaction, account: null })
    return lookup(3, 'propose_changes', { app: 'spending', title: says.pickedTitle, steps: [step], next: false }, tokens)
  }
  return answered(request, says.pickedProposed, tokens)
}

/** Reads the attached photo as the sample €17.00 receipt and puts it on the entry the chat is tagged with, under Groceries, so the card warns on what differs. */
function taggedReceiptReply({ request, tokens }: FakeChatTurn, photo: string, entry: string): ModelReply {
  const answers = answersSince(request)
  if (answers.length === 0) return lookup(0, 'read_attachment', { attachment: photo, pages: null, sheet: null, rows: null }, tokens)
  if (answers.length === 1) return lookup(1, 'find_records', findRecordsArgs('spending', 'category', { limit: 50 }), tokens)
  if (answers.length === 2) {
    const groceries = recordsIn(answers[1]!.text).find((category) => GROCERIES.includes(category.name ?? ''))?.ref ?? ''
    const step = receiptOf17(photo, 'card', groceries, { entry, account: null })
    return lookup(2, 'propose_changes', { app: 'spending', title: says.taggedTitle, steps: [step], next: false }, tokens)
  }
  return answered(request, says.taggedProposed, tokens)
}

/** The amount of cash the person says they had, such as "I had €50" or "Imao sam 50,00 €", or null when the message names none. */
function cashSaid(typed: string): number | null {
  const [, whole, cents] = /(\d+)(?:[.,](\d{1,2}))?/.exec(typed) ?? []
  return whole === undefined ? null : Number(`${whole}.${(cents ?? '0').padEnd(2, '0')}`)
}

/**
 * Reads the attached photo as the sample €17.00 receipt paid in cash, under Groceries, and looks up the cash accounts in euros.
 * With one, Kuna puts the new entry on it, and with several the chat asks which. With none, it asks how much cash the person had
 * before paying, and once told, the card adds a cash account with that opening from the receipt's day and puts the receipt on it.
 */
export function cashReceiptReply({ request, tokens, typed }: FakeChatTurn): ModelReply {
  const photo = lastPhotoId(request)
  if (photo === null) return answered(request, says.noPhoto, tokens)
  const answers = answersSince(request)
  if (answers.length === 0) return lookup(0, 'read_attachment', { attachment: photo, pages: null, sheet: null, rows: null }, tokens)
  if (answers.length === 1) return lookup(1, 'find_records', findRecordsArgs('spending', 'category', { limit: 50 }), tokens)
  if (answers.length === 2) return lookup(2, 'find_records', findRecordsArgs('spending', 'account'), tokens)
  const cash = recordsIn(answers[2]!.text).filter((account) => account.kind === 'cash' && account.currency === 'EUR' && account.closed !== true)
  if (cash.length > 1) return answered(request, says.whichCash(cash.map((account) => account.name ?? '').join(', ')), tokens)
  const opening = cashSaid(typed)
  if (cash.length === 0 && opening === null) return answered(request, says.howMuchCash, tokens)
  if (answers.length > 3) return answered(request, cash.length === 0 ? says.cashAccountFirst : says.cashProposed, tokens)
  const groceries = recordsIn(answers[1]!.text).find((category) => GROCERIES.includes(category.name ?? ''))?.ref ?? ''
  const receipt = (account: string | null) => receiptOf17(photo, 'cash', groceries, { entry: null, account })
  const account = proposedStep(SPENDING_OPERATIONS, 'add-account', { name: says.cashName, kind: 'cash', currency: 'EUR', opening, openedOn: fakeSpendingDayHere(), rowsFrom: 'by-hand' }, '$cash')
  const steps = cash.length === 0 ? [account, receipt('$cash')] : [receipt(null)]
  return lookup(3, 'propose_changes', { app: 'spending', title: says.cashTitle, steps, next: false }, tokens)
}

/**
 * Reads the attached photo as the sample €17.00 receipt paid in cash and marked R1, with the fake Company's OIB as its buyer, on
 * the one cash account in euros. With Company open, Kuna files every line under For the company. Without it, the card says so.
 */
export function r1ReceiptReply({ request, tokens }: FakeChatTurn): ModelReply {
  const photo = lastPhotoId(request)
  if (photo === null) return answered(request, says.noPhoto, tokens)
  const answers = answersSince(request)
  if (answers.length === 0) return lookup(0, 'read_attachment', { attachment: photo, pages: null, sheet: null, rows: null }, tokens)
  if (answers.length === 1) return lookup(1, 'find_records', findRecordsArgs('spending', 'category', { limit: 50 }), tokens)
  if (answers.length > 2) return answered(request, says.cashProposed, tokens)
  const groceries = recordsIn(answers[1]!.text).find((category) => GROCERIES.includes(category.name ?? ''))?.ref ?? ''
  const step = receiptOf17(photo, 'cash', groceries, { entry: null, account: null }, FAKE_COMPANY_OIB)
  return lookup(2, 'propose_changes', { app: 'spending', title: says.cashTitle, steps: [step], next: false }, tokens)
}

/**
 * Reads the attached photo as the sample €17.00 receipt paid by card, under Groceries, and puts it on the first euro account the
 * bank fills. The bank has not brought that payment yet, so the card says the receipt waits for the bank's row.
 */
export function cardReceiptReply({ request, tokens }: FakeChatTurn): ModelReply {
  const photo = lastPhotoId(request)
  if (photo === null) return answered(request, says.noPhoto, tokens)
  const answers = answersSince(request)
  if (answers.length === 0) return lookup(0, 'read_attachment', { attachment: photo, pages: null, sheet: null, rows: null }, tokens)
  if (answers.length === 1) return lookup(1, 'find_records', findRecordsArgs('spending', 'category', { limit: 50 }), tokens)
  if (answers.length === 2) return lookup(2, 'find_records', findRecordsArgs('spending', 'account'), tokens)
  if (answers.length > 3) return answered(request, says.cardProposed, tokens)
  const account = recordsIn(answers[2]!.text).find((found) => found.kind === 'bank' && found.currency === 'EUR' && found.rowsFrom === 'bank-link' && found.closed !== true)
  if (account === undefined) return answered(request, says.noCardAccount, tokens)
  const groceries = recordsIn(answers[1]!.text).find((category) => GROCERIES.includes(category.name ?? ''))?.ref ?? ''
  const step = receiptOf17(photo, 'card', groceries, { entry: null, account: account.ref })
  return lookup(3, 'propose_changes', { app: 'spending', title: says.cardTitle, steps: [step], next: false }, tokens)
}
