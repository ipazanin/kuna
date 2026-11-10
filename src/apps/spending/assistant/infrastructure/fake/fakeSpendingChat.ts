import { answered, answersSince, findRecordsArgs, goOnsInto, lookup, registerFakeChat } from '../../../../../shared/ai/infrastructure/fake/fakeChatReply'
import type { FakeChatTurn } from '../../../../../shared/ai/infrastructure/fake/fakeChatReply'
import type { ModelReply } from '../../../../../shared/ai/application/modelPort'
import { addDays, today } from '../../../../../shared/calendar/civilDate'
import { addMonths, monthOf } from '../../../../../shared/calendar/monthKey'
import { language } from '../../../../../shared/text/language'

const ANSWERS = {
  en: {
    rules: 'Pick a category on **To review** and choose **Always for this payee**.\n- Each rule then files new rows\n- A row you filed yourself stays as it is',
    spent: (figure: string) => `You spent ${figure} this month.`,
    paid: (who: string, amount: string) => `The latest payment to a person went to ${who}: ${amount}.`,
    invented: 'Last year it was €4,300.00.',
    proposed: 'The card below sorts them. Nothing changes until you accept it.',
    proposalTitle: 'Rules for what keeps coming',
    closeTitle: 'Close the old account',
    closeProposed: 'The card below closes the account and gives it the new IBAN. Check the IBAN before you accept.',
    nothingToSort: 'None of the latest rows names a shop I could make a rule for.',
    statementTitle: 'Import the pasted statement',
    statementProposed: 'I misread one amount at first, so Kuna refused it as not adding up. The card below now ties from the opening balance to the closing one.',
    copyTitle: 'Import the copied statement',
    copyProposed: 'One row is in Spending already and is skipped. Another looks like a row Kuna has from another source, so it waits on the card. Is it another payment?',
    noPhoto: 'Attach a photo of the receipt first, and I will read its lines.',
    pharmacy: 'Pharmacy',
    pharmacyTitle: 'A category for the pharmacy',
    pharmacyProposed: 'The card adds Pharmacy for the pharmacy rows waiting. Once you accept, the next card files them there with a rule.',
    pharmacyRuleTitle: 'File the pharmacy with a rule',
    pharmacyRuled: 'The card adds a rule for the pharmacy and files its waiting rows under Pharmacy.',
    petFood: 'Pet food',
    categoryTitle: 'A category for pet food',
    categoryFirst: 'One line is pet food, which has no category yet. Accept the card below, then ask me to read the receipt again.',
    receiptTitle: 'The receipt from Corner market',
    receiptProposed: 'The card below splits the payment into the lines I read. Nothing changes until you accept it.',
    matched: {
      same: (row: number) => `Row ${row} is in Spending already.`,
      like: (row: number) => `Row ${row} looks like a payment Spending has, dated a few days off. Is it another payment?`,
      none: (row: number) => `Row ${row} is not in Spending yet.`,
    },
    biggest: 'Your biggest spends last month:',
    noSpends: 'There were no spends last month.',
  },
  hr: {
    rules: 'Odaberite kategoriju na **Za pregled** i zatim **Uvijek za ovog primatelja**.\n- Svako pravilo zatim razvrstava nove retke\n- Redak koji ste sami razvrstali ostaje kakav jest',
    spent: (figure: string) => `Ovaj mjesec potrošili ste ${figure}.`,
    paid: (who: string, amount: string) => `Zadnja uplata osobi otišla je na ${who}: ${amount}.`,
    invented: 'Prošle godine bilo je 4.300,00 €.',
    proposed: 'Kartica ispod ih razvrstava. Ništa se ne mijenja dok je ne prihvatite.',
    proposalTitle: 'Pravila za ono što se ponavlja',
    closeTitle: 'Zatvori stari račun',
    closeProposed: 'Kartica ispod zatvara račun i daje mu novi IBAN. Provjerite IBAN prije nego što prihvatite.',
    nothingToSort: 'Nijedan od zadnjih redaka ne navodi trgovinu za koju bih mogao napraviti pravilo.',
    statementTitle: 'Uvezi zalijepljeni izvod',
    statementProposed: 'Isprva sam krivo pročitao jedan iznos, pa ga je Kuna odbila jer se ne zbraja. Kartica ispod sada se slaže od početnog do završnog stanja.',
    copyTitle: 'Uvezi prepisani izvod',
    copyProposed: 'Jedan je redak već u Potrošnji i preskočen je. Drugi nalikuje retku koji Kuna ima iz drugog izvora, pa čeka na kartici. Je li to drugo plaćanje?',
    noPhoto: 'Najprije priložite fotografiju fiskalnog računa, pa ću pročitati stavke.',
    pharmacy: 'Ljekarna',
    pharmacyTitle: 'Kategorija za ljekarnu',
    pharmacyProposed: 'Kartica dodaje Ljekarnu za retke ljekarne koji čekaju. Kad prihvatite, sljedeća kartica razvrstava ih u nju s pravilom.',
    pharmacyRuleTitle: 'Razvrstaj ljekarnu s pravilom',
    pharmacyRuled: 'Kartica dodaje pravilo za ljekarnu i razvrstava njezine retke koji čekaju u Ljekarnu.',
    petFood: 'Hrana za ljubimce',
    categoryTitle: 'Kategorija za hranu za ljubimce',
    categoryFirst: 'Jedna je stavka hrana za ljubimce, za koju još nema kategorije. Prihvatite karticu ispod, pa me ponovno zamolite da pročitam račun.',
    receiptTitle: 'Fiskalni račun iz trgovine Corner market',
    receiptProposed: 'Kartica ispod dijeli plaćanje na stavke koje sam pročitao. Ništa se ne mijenja dok je ne prihvatite.',
    matched: {
      same: (row: number) => `${row}. redak već je u Potrošnji.`,
      like: (row: number) => `${row}. redak nalikuje plaćanju koje Potrošnja ima nekoliko dana ranije ili kasnije. Je li to drugo plaćanje?`,
      none: (row: number) => `${row}. retka još nema u Potrošnji.`,
    },
    biggest: 'Vaši najveći troškovi prošlog mjeseca:',
    noSpends: 'Prošlog mjeseca nije bilo troškova.',
  },
}

/** A made-up OIB whose check digit is right. */
export const MADE_UP_MERCHANT_OIB = '12345678903'
/** Another, the made-up buyer of an R1 receipt. */
export const MADE_UP_BUYER_OIB = '11111111119'

const GROCERIES: readonly string[] = ['Groceries', 'Namirnice']
const HOUSEHOLD: readonly string[] = ['Household goods', 'Kućanske potrepštine']
const PET_FOOD: readonly string[] = [ANSWERS.en.petFood, ANSWERS.hr.petFood]

type Says = (typeof ANSWERS)['en']

/** A person's name came as an alias, or as it is with aliases off: the first payee of the rows that reads as a name. */
function latestPersonPaid(found: string): { readonly payee: string; readonly amount: string } | null {
  const { records } = JSON.parse(found) as { readonly records: readonly { readonly payee?: string; readonly amount: { readonly ref: string } }[] }
  const row = records.find((record) => /^(?:(?:Person|Osoba) \d+|\p{Lu}\p{L}+ \p{Lu}\p{L}+)$/u.test(record.payee ?? ''))
  return row === undefined ? null : { payee: row.payee ?? '', amount: `[${row.amount.ref}]` }
}

/** Reads the month's figures and the latest rows as a real model would, and answers from what the tools gave, with an amount of its own if told to invent one. */
function spendingReply({ request, tokens, invents }: FakeChatTurn, says: Says): ModelReply {
  const answers = answersSince(request)
  if (answers.length === 0) return lookup(0, 'read_figures', { app: 'spending', report: 'month', period: null }, tokens)
  if (answers.length === 1) return lookup(1, 'find_records', findRecordsArgs('spending', 'transaction', { limit: 5 }), tokens)
  const { figures } = JSON.parse(answers[0]!.text) as { readonly figures: readonly { readonly ref: string }[] }
  const paid = latestPersonPaid(answers[1]!.text)
  const parts = [says.spent(`[${figures[0]!.ref}]`), ...(paid === null ? [] : [says.paid(paid.payee, paid.amount)]), ...(invents ? [says.invented] : [])]
  return answered(request, parts.join(' '), tokens)
}

/**
 * Reads the latest rows and proposes a rule from the first filed row with a shop's name and no IBAN, into the category that row
 * is under, so the rule never files a person's payments. `before` counts the lookups the turn made before it.
 */
function sortReply({ request, tokens }: FakeChatTurn, says: Says, before = 0): ModelReply {
  const answers = answersSince(request).slice(before)
  if (answers.length === 0) return lookup(before, 'find_records', findRecordsArgs('spending', 'transaction', { limit: 5 }), tokens)
  if (answers.length === 1) {
    const { records } = JSON.parse(answers[0]!.text) as {
      readonly records: readonly { readonly ref: string; readonly payee?: string; readonly category?: string; readonly counterpartyIban?: string }[]
    }
    const row = records.find((record) => record.category !== undefined && record.counterpartyIban === undefined && !/^(?:Person|Osoba) \d+$/.test(record.payee ?? ''))
    if (row === undefined) return answered(request, says.nothingToSort, tokens)
    const step = { op: 'add-rule', input: JSON.stringify({ row: row.ref, fragment: null, iban: null, category: row.category }), as: null }
    return lookup(before + 1, 'propose_changes', { app: 'spending', title: says.proposalTitle, steps: [step], next: false }, tokens)
  }
  return answered(request, says.proposed, tokens)
}

/** What asks to sort the rows waiting, as Suggest categories on To review and the quick action do. */
const SORT_JOB = /^sort the rows waiting on to review\. |^razvrstaj retke koji čekaju na kartici za pregled\. /i

const findWaiting = findRecordsArgs('spending', 'transaction', { only: 'waiting' })

interface WaitingRow {
  readonly ref: string
  readonly payee?: string
}

function waitingRows(text: string): readonly WaitingRow[] {
  return (JSON.parse(text) as { readonly records: readonly WaitingRow[] }).records
}

/**
 * Reads the rows waiting and proposes a new category for the first one with a payee, as no category fits it, with a card
 * after it. With nothing waiting it proposes a rule from the latest rows instead.
 */
function sortJobReply(turn: FakeChatTurn, says: Says): ModelReply {
  const { request, tokens } = turn
  const answers = answersSince(request)
  if (answers.length === 0) return lookup(0, 'find_records', findWaiting, tokens)
  if (waitingRows(answers[0]!.text).every((row) => row.payee === undefined)) return sortReply(turn, says, 1)
  if (answers.length === 1) {
    const step = { op: 'add-category', input: JSON.stringify({ name: says.pharmacy, kind: 'spending', parent: null, colour: null, hidden: null }), as: null }
    return lookup(1, 'propose_changes', { app: 'spending', title: says.pharmacyTitle, steps: [step], next: true }, tokens)
  }
  return answered(request, says.pharmacyProposed, tokens)
}

/** The card Go on asks for in the sorting job: a rule from the first waiting row with a payee into the new category. */
function sortGoOnReply({ request, tokens }: FakeChatTurn, says: Says): ModelReply {
  const answers = answersSince(request)
  if (answers.length === 0) return lookup(0, 'find_records', findWaiting, tokens)
  if (answers.length === 1) return lookup(1, 'find_records', findRecordsArgs('spending', 'category', { query: says.pharmacy, limit: 5 }), tokens)
  if (answers.length === 2) {
    const row = waitingRows(answers[0]!.text).find((waiting) => waiting.payee !== undefined)
    const category = recordsIn(answers[1]!.text).find((found) => found.name === says.pharmacy)?.ref
    if (row === undefined || category === undefined) return answered(request, says.nothingToSort, tokens)
    const step = { op: 'add-rule', input: JSON.stringify({ row: row.ref, fragment: null, iban: null, category }), as: null }
    return lookup(2, 'propose_changes', { app: 'spending', title: says.pharmacyRuleTitle, steps: [step], next: false }, tokens)
  }
  return answered(request, says.pharmacyRuled, tokens)
}

const findAccounts = findRecordsArgs('spending', 'account', { limit: 5 })

/** A made-up IBAN that passes the check, as a person might give it for the account's new number. */
const NEW_IBAN = 'HR1210010051863000160'

/** Reads the accounts and proposes closing the first, with a new IBAN on it, so the card shows a closed account and a line it warns on. */
function closeAccountReply({ request, tokens }: FakeChatTurn, says: Says): ModelReply {
  const answers = answersSince(request)
  if (answers.length === 0) return lookup(0, 'find_records', findAccounts, tokens)
  if (answers.length === 1) {
    const { records } = JSON.parse(answers[0]!.text) as { readonly records: readonly { readonly ref: string }[] }
    const step = {
      op: 'change-account',
      input: JSON.stringify({ account: records[0]!.ref, name: null, kind: null, bank: null, currency: null, opening: null, openedOn: null, iban: NEW_IBAN, closed: 'yes' }),
      as: null,
    }
    return lookup(1, 'propose_changes', { app: 'spending', title: says.closeTitle, steps: [step], next: false }, tokens)
  }
  return answered(request, says.closeProposed, tokens)
}

/** Rows as a model would read them off a pasted statement, all made up, dated in the last week so every account is open by then. */
function statementRows(misread: boolean): readonly { readonly date: string; readonly amount: number; readonly payee: string; readonly iban: null }[] {
  const day = today()
  return [
    { date: addDays(day, -6), amount: -12.5, payee: 'Corner market', iban: null },
    { date: addDays(day, -5), amount: misread ? -40.01 : -40, payee: 'Harbour bistro', iban: null },
    { date: addDays(day, -4), amount: 100, payee: 'Mali dućan', iban: null },
  ]
}

/** Reads the accounts and transcribes a pasted statement onto the first: once with one amount a cent off, which Kuna refuses, then as printed. */
function statementReply({ request, tokens }: FakeChatTurn, says: Says): ModelReply {
  const answers = answersSince(request)
  if (answers.length === 0) return lookup(0, 'find_records', findAccounts, tokens)
  if (answers.length < 3) {
    const { records } = JSON.parse(answers[0]!.text) as { readonly records: readonly { readonly ref: string }[] }
    const input = { file: null, account: records[0]!.ref, statementName: '41/2026', opening: 500, closing: 547.5, rows: statementRows(answers.length === 1), part: 1, lookAlikes: 'ask' }
    const step = { op: 'import-statement', input: JSON.stringify(input), as: null }
    return lookup(answers.length, 'propose_changes', { app: 'spending', title: says.statementTitle, steps: [step], next: false }, tokens)
  }
  return answered(request, says.statementProposed, tokens)
}

/** The id of the last photo the context lines name, or null for none. */
function lastPhotoId(request: FakeChatTurn['request']): string | null {
  const said = request.turns.flatMap((turn) => (turn.role === 'user' ? turn.parts.flatMap((part) => (part.kind === 'text' ? [part.text] : [])) : [])).join('\n')
  return [...said.matchAll(/\b(a\d+) \(photo\)/g)].at(-1)?.[1] ?? null
}

interface FoundRecord {
  readonly ref: string
  readonly name?: string
  readonly payee?: string
  readonly category?: string
  readonly currency?: string
  readonly closed?: boolean
}

function recordsIn(text: string): readonly FoundRecord[] {
  return (JSON.parse(text) as { readonly records: readonly FoundRecord[] }).records
}

/** A line of the sample receipt, whose lines add up to its QR code's €23.49. */
function receiptLine(printed: string, text: string, lineTotal: number, category: string, fields: Readonly<Record<string, unknown>> = {}) {
  return { printed, text, kind: 'product', quantity: null, unitPrice: null, lineTotal, category, ...fields }
}

/**
 * Reads the attached photo as the sample €23.49 receipt and looks Pet food up by name. It has no category yet, so the first time it
 * proposes that category alone, and once it is there it finds the Corner market payment and proposes the receipt that splits it.
 */
function receiptReply({ request, tokens }: FakeChatTurn, says: Says): ModelReply {
  const photo = lastPhotoId(request)
  if (photo === null) return answered(request, says.noPhoto, tokens)
  const answers = answersSince(request)
  if (answers.length === 0) return lookup(0, 'read_attachment', { attachment: photo, pages: null }, tokens)
  if (answers.length === 1) return lookup(1, 'find_records', findRecordsArgs('spending', 'category', { query: says.petFood, limit: 5 }), tokens)
  const petFood = recordsIn(answers[1]!.text).find((category) => PET_FOOD.includes(category.name ?? ''))?.ref
  if (petFood === undefined) {
    if (answers.length > 2) return answered(request, says.categoryFirst, tokens)
    const step = { op: 'add-category', input: JSON.stringify({ name: says.petFood, kind: 'spending', parent: null, colour: null, hidden: null }), as: null }
    return lookup(2, 'propose_changes', { app: 'spending', title: says.categoryTitle, steps: [step], next: false }, tokens)
  }
  if (answers.length === 2) return lookup(2, 'find_records', findRecordsArgs('spending', 'category', { limit: 50 }), tokens)
  const categories = recordsIn(answers[2]!.text)
  const refOf = (names: readonly string[]): string | undefined => categories.find((category) => names.includes(category.name ?? ''))?.ref
  if (answers.length === 3) return lookup(3, 'find_records', findRecordsArgs('spending', 'transaction', { query: 'Corner market', limit: 5 }), tokens)
  if (answers.length === 4) return lookup(4, 'find_records', findRecordsArgs('spending', 'account'), tokens)
  if (answers.length === 5) {
    const payment = recordsIn(answers[3]!.text).find((row) => row.category === undefined)
    const euros = recordsIn(answers[4]!.text).find((account) => account.currency === 'EUR' && account.closed !== true)
    const groceries = refOf(GROCERIES) ?? petFood
    const input = {
      photo,
      entry: payment?.ref ?? null,
      account: payment === undefined ? (euros?.ref ?? null) : null,
      merchant: 'Corner market',
      merchantOib: MADE_UP_MERCHANT_OIB,
      buyerOib: null,
      markedR1: false,
      whose: null,
      issuedOn: today(),
      issuedAt: '18:42',
      jir: null,
      zki: null,
      lines: [
        receiptLine('MLIJ.TR.2,8%1L', 'mlijeko trajno 2,8% 1 l', 12.3, groceries),
        receiptLine('KRUH POLUBIJ.', 'kruh polubijeli', 3.2, groceries, { quantity: 2, unitPrice: 1.6 }),
        receiptLine('POPUST', 'popust', -1.01, groceries, { kind: 'discount' }),
        receiptLine('DET.TEK.', 'deterdžent tekući', 5.5, refOf(HOUSEHOLD) ?? groceries),
        receiptLine('PSEC.HR.', 'pseća hrana', 3.5, petFood),
      ],
      vat: [{ base: 18.79, tax: 4.7 }],
      total: 23.49,
      unreadable: [],
      keepPhoto: true,
    }
    return lookup(5, 'propose_changes', { app: 'spending', title: says.receiptTitle, steps: [{ op: 'add-receipt', input: JSON.stringify(input), as: null }], next: false }, tokens)
  }
  return answered(request, says.receiptProposed, tokens)
}

/**
 * Rows of the OTP account in the statements sample as a statement prints them: the City pharmacy row of nine days back as the
 * file has it, the one of four days back a day later and spelled longer, and a new kiosk row.
 */
function otpStatementRows(): readonly { readonly date: string; readonly amount: string; readonly payee: string }[] {
  const day = today()
  return [
    { date: addDays(day, -9), amount: '-12.00', payee: 'City pharmacy' },
    { date: addDays(day, -3), amount: '-18.90', payee: 'CITY PHARMACY 22 ZAGREB' },
    { date: addDays(day, -1), amount: '-9.00', payee: 'Kiosk' },
  ]
}

function otpRef(found: string): string {
  const { records } = JSON.parse(found) as { readonly records: readonly { readonly ref: string; readonly bank?: string }[] }
  return (records.find((record) => record.bank === 'otp') ?? records[0]!).ref
}

/** Copies the OTP statement with no balances, so Kuna skips the first row, the second waits as a look-alike and the kiosk row is new. */
function copyReply({ request, tokens }: FakeChatTurn, says: Says): ModelReply {
  const answers = answersSince(request)
  if (answers.length === 0) return lookup(0, 'find_records', findAccounts, tokens)
  if (answers.length === 1) {
    const rows = otpStatementRows().map((row) => ({ ...row, amount: Number(row.amount), iban: null }))
    const input = { file: null, account: otpRef(answers[0]!.text), opening: null, closing: null, rows, statementName: '12/2026', part: 1, lookAlikes: 'ask' }
    return lookup(1, 'propose_changes', { app: 'spending', title: says.copyTitle, steps: [{ op: 'import-statement', input: JSON.stringify(input), as: null }], next: false }, tokens)
  }
  return answered(request, says.copyProposed, tokens)
}

/** Asks Kuna which rows of the OTP statement Spending has, and says for each whether it is in, looks like a payment there, or is new. */
function matchReply({ request, tokens }: FakeChatTurn, says: Says): ModelReply {
  const answers = answersSince(request)
  if (answers.length === 0) return lookup(0, 'find_records', findAccounts, tokens)
  if (answers.length === 1) {
    const rows = otpStatementRows().map(({ date, amount, payee }) => ({ date, amount, counterparty: payee, description: '' }))
    return lookup(1, 'match_records', { app: 'spending', kind: 'transaction', account: otpRef(answers[0]!.text), rows }, tokens)
  }
  const { matches } = JSON.parse(answers[1]!.text) as { readonly matches: readonly { readonly row: number; readonly match: 'same' | 'like' | 'none' }[] }
  return answered(request, matches.map(({ row, match }) => `- ${says.matched[match](row)}`).join('\n'), tokens)
}

/** Reads last month's spends, the biggest first, and lists the payees with their amounts. */
function biggestReply({ request, tokens }: FakeChatTurn, says: Says): ModelReply {
  const answers = answersSince(request)
  if (answers.length === 0) {
    const month = addMonths(monthOf(today()), -1)
    const spends = findRecordsArgs('spending', 'transaction', {
      from: month,
      to: month,
      filters: [{ field: 'amount', op: 'at-most', values: ['0'] }],
      sort: [{ field: 'amount', direction: 'ascending' }],
      fields: ['payee', 'amount'],
      limit: 3,
    })
    return lookup(0, 'find_records', spends, tokens)
  }
  const { records } = JSON.parse(answers[0]!.text) as { readonly records: readonly { readonly payee?: string; readonly amount: { readonly ref: string } }[] }
  if (records.length === 0) return answered(request, says.noSpends, tokens)
  return answered(request, [says.biggest, ...records.map((record) => `- ${record.payee ?? ''} [${record.amount.ref}]`)].join('\n'), tokens)
}

/**
 * Spending's part of the fake chat: Suggest categories proposes a new category and, at Go on, a rule into it, any other that starts with sort proposes a rule, one that starts with close proposes closing
 * an account with a new IBAN, one that starts with import transcribes a pasted statement, one that starts with transcribe copies a statement a row of which waits as a look-alike, one that asks to check these rows says which rows of that statement Spending has, one about the biggest spends lists last month's, one that asks to read the receipt reads the photo attached and proposes it, a question about spending reads figures and rows, and one about rules reads the guide and links its tab.
 */
function spendingChat(turn: FakeChatTurn): ModelReply | null {
  const says = ANSWERS[language === 'hr' ? 'hr' : 'en']
  const { request, tokens, typed, lookups } = turn
  if (goOnsInto(request, SORT_JOB) !== null) return sortGoOnReply(turn, says)
  if (SORT_JOB.test(typed)) return sortJobReply(turn, says)
  if (/^sort|^razvrstaj/i.test(typed)) return sortReply(turn, says)
  if (/^close|^zatvori/i.test(typed)) return closeAccountReply(turn, says)
  if (/^import|^uvezi/i.test(typed)) return statementReply(turn, says)
  if (/^transcribe|^prenesi/i.test(typed)) return copyReply(turn, says)
  if (/^check these rows|^provjeri ove retke/i.test(typed)) return matchReply(turn, says)
  if (/biggest spends|najveći troškovi/i.test(typed)) return biggestReply(turn, says)
  if (/^read (the|this|a) receipt|^pročitaj (fiskalni )?račun/i.test(typed)) return receiptReply(turn, says)
  if (/spent|spend|potroš/i.test(typed)) return spendingReply(turn, says)
  if (/rule|pravil/i.test(typed)) {
    if (lookups === 0) return lookup(lookups, 'kuna_docs', { path: 'spending/guide/first-rules' }, tokens)
    if (lookups === 1) return lookup(lookups, 'show_screen', { route: '/spending/settings?tab=rules', params: [] }, tokens)
    return answered(request, says.rules, tokens)
  }
  return null
}

export function registerFakeSpendingChat(): void {
  registerFakeChat(spendingChat)
}
