import { answered, answersSince, findRecordsArgs, goOnsInto, lookup, registerFakeChat } from '../../../../../shared/ai/infrastructure/fake/fakeChatReply'
import type { FakeChatTurn } from '../../../../../shared/ai/infrastructure/fake/fakeChatReply'
import type { ModelReply, ModelRequest } from '../../../../../shared/ai/application/modelPort'
import { aboutEmployeesPay } from '../../../../../shared/ai/application/chatReads'
import { addDays, today } from '../../../../../shared/calendar/civilDate'
import { language } from '../../../../../shared/text/language'

const ANSWERS = {
  en: {
    sortTitle: 'File what I am sure of',
    sorted: (unsure: string) => `The card files the rows I am sure of. Once you accept, a card adds a category for client meals for ${unsure}, and the one after files it there with a rule.`,
    filedAll: 'The card files every row waiting.',
    mealsTitle: 'A category for client meals',
    mealsLabel: 'Client meals',
    mealsProposed: 'The card adds Client meals. Once you accept, the next card files the row there with a rule.',
    mealsRuleTitle: 'File it under Client meals with a rule',
    mealsRuled: 'The card adds a rule for the counterparty and files its waiting row under Client meals.',
    invoice: 'Kuna makes the invoice PDF and its mail on the Invoices tab, so I cannot make it from here. The link opens the tab with the client picked, and you press Make there.',
    currencyTitle: 'Show the figures in US dollars',
    currency: 'The card changes the currency of the books. Every figure then reads in dollars, so check the warned line before you accept.',
    ruleTitle: 'A rule for Laptop Store',
    rule: 'The card adds the rule and files the Laptop Store rows you confirmed under Equipment under Office supplies instead. Each of their lines is warned, since you filed them yourself.',
    noCategory: 'I found no category for office supplies. Add one on Settings, Categories first.',
    moveTitle: 'Try the second rule first',
    moved: 'The card moves the second rule to the top, so it is tried before every other rule.',
    fewRules: 'The books hold fewer than two rules, so there is nothing to move.',
    categoryTitle: 'Add a category for training',
    trainingLabel: 'Training',
    trainingFamily: 'operating',
    category: 'The card adds Training to the operating costs. Kuna counts it as a cost the profit tax allows, and its VAT is deducted.',
    mergeTitle: 'Merge AI services into software subscriptions',
    merge:
      'The card deletes AI services and moves its rows, rules, konto line and plan rows into software subscriptions. Its 2027 plan row joins the one already there, so check the added amount before you accept.',
    noMerge: 'I found no AI services or software subscriptions category to merge.',
    statementTitle: 'Import the pasted statement',
    statementProposed: 'The card imports the rows as I copied them. The statement printed no balances, so the account starts at zero.',
    statementRefused: 'Kuna refused the statement. Check the rows I copied against it.',
    noAccount: 'Company has no bank account to import the statement into. Add one on Settings, Accounts first.',
    copyTitle: 'Import the copied statement',
    copyProposed: 'One row is on the ledger already and is skipped. Another looks like a ledger row from another source, so it waits on the card. Is it another payment?',
    noBuildUp: 'Tag a figure with its ask button first, and I will read how Kuna built it.',
    explained: (label: string, amount: string, steps: string) => `${label} is ${amount}. Kuna builds it from ${steps}. The link opens the tax rule it rests on.`,
    keptByAnonymise:
      'That figure is about employees and their pay, so it stays on this device while Anonymise is on. Turn Anonymise off for this AI company in Kuna settings if you want it explained.',
    tripCostTitle: 'Add the parking to travel order 3/2026',
    parking: 'Parking garage in Rijeka',
    tripCost: 'The card adds 18.00 of parking the traveller paid to travel order 3/2026. It is paid back in the settlement once the trip is settled.',
    noTrip: 'I found no travel order 3/2026 in the books.',
  },
  hr: {
    sortTitle: 'Razvrstaj ono u što sam siguran',
    sorted: (unsure: string) =>
      `Kartica razvrstava retke u koje sam siguran. Kad prihvatite, sljedeća kartica dodaje kategoriju za obroke s klijentima za ${unsure}, a ona nakon nje razvrstava redak u nju s pravilom.`,
    filedAll: 'Kartica razvrstava sve retke koji čekaju.',
    mealsTitle: 'Kategorija za obroke s klijentima',
    mealsLabel: 'Obroci s klijentima',
    mealsProposed: 'Kartica dodaje Obroke s klijentima. Kad prihvatite, sljedeća kartica razvrstava redak u nju s pravilom.',
    mealsRuleTitle: 'Razvrstaj ga u Obroke s klijentima s pravilom',
    mealsRuled: 'Kartica dodaje pravilo za partnera i razvrstava njegov redak koji čeka u Obroke s klijentima.',
    invoice: 'Kuna izrađuje PDF računa i poruku na kartici Računi, pa ga ne mogu izraditi odavde. Poveznica otvara karticu s odabranim klijentom, a vi ondje pritisnete Izradi.',
    currencyTitle: 'Prikaži iznose u američkim dolarima',
    currency: 'Kartica mijenja valutu knjiga. Svaki iznos tada se čita u dolarima, pa provjerite označeni redak prije nego što prihvatite.',
    ruleTitle: 'Pravilo za Laptop Store',
    rule: 'Kartica dodaje pravilo i stavke Laptop Store koje ste potvrdili pod Opremom razvrstava pod Uredski materijal. Svaki njihov redak je označen jer ste ih sami razvrstali.',
    moveTitle: 'Neka se drugo pravilo isprobava prvo',
    moved: 'Kartica premješta drugo pravilo na vrh, pa se isprobava prije svih ostalih.',
    fewRules: 'U knjigama su manje od dva pravila, pa nema što premjestiti.',
    noCategory: 'Nisam našao kategoriju za uredski materijal. Najprije je dodajte na Postavkama, Kategorije.',
    categoryTitle: 'Dodaj kategoriju za edukaciju',
    trainingLabel: 'Edukacija',
    trainingFamily: 'poslovanje',
    category: 'Kartica dodaje Edukaciju među troškove poslovanja. Kuna je broji kao trošak koji porez na dobit priznaje, a PDV se odbija.',
    mergeTitle: 'Spoji AI usluge s pretplatama na softver',
    merge:
      'Kartica briše kategoriju AI usluge i premješta njezine stavke, pravila, konto stavku i stavke plana u pretplate na softver. Njezina stavka plana za 2027. pridružuje se onoj koja već postoji, pa provjerite zbrojeni iznos prije nego što prihvatite.',
    noMerge: 'Nisam našao kategorije AI usluge ili pretplate na softver za spajanje.',
    statementTitle: 'Uvezi zalijepljeni izvod',
    statementProposed: 'Kartica uvozi retke kako sam ih prepisao. Izvod ne ispisuje stanja, pa račun počinje od nule.',
    statementRefused: 'Kuna je odbila izvod. Usporedite retke koje sam prepisao s njim.',
    noAccount: 'Tvrtka nema bankovni račun u koji bi uvezla izvod. Najprije ga dodajte na Postavkama, Računi u banci.',
    copyTitle: 'Uvezi prepisani izvod',
    copyProposed: 'Jedan je redak već u evidenciji i preskočen je. Drugi nalikuje stavci iz drugog izvora, pa čeka na kartici. Je li to drugo plaćanje?',
    noBuildUp: 'Najprije označite iznos njegovim gumbom za pitanje, pa ću pročitati kako ga je Kuna izračunala.',
    explained: (label: string, amount: string, steps: string) => `${label} iznosi ${amount}. Kuna ga računa iz ${steps}. Poveznica otvara porezno pravilo na kojem počiva.`,
    keptByAnonymise:
      'Taj se iznos odnosi na zaposlenike i njihove plaće, pa ostaje na ovom uređaju dok je anonimizacija uključena. Isključite anonimizaciju za ovu AI tvrtku u postavkama Kune ako želite da ga objasnim.',
    tripCostTitle: 'Dodaj parkiranje putnom nalogu 3/2026',
    parking: 'Garaža u Rijeci',
    tripCost: 'Kartica putnom nalogu 3/2026 dodaje 18,00 eura parkiranja koje je platio putnik. Putniku se vraća u obračunu kad se put obračuna.',
    noTrip: 'U knjigama nisam našao putni nalog 3/2026.',
  },
}

type Says = (typeof ANSWERS)['en']

interface FoundRecord {
  readonly ref: string
  readonly label?: string
  readonly counterparty?: string
  readonly category?: string
  readonly number?: string
}

/** The records a find gave, by the order the lookups ran. */
function recordsOf(text: string): readonly FoundRecord[] {
  return (JSON.parse(text) as { readonly records: readonly FoundRecord[] }).records
}

/** Every context line the person's turns carried, newest last, as a context line is sent only when it changed. */
function contextLines(request: ModelRequest): readonly string[] {
  return request.turns.flatMap((turn) => (turn.role === 'user' ? turn.parts.flatMap((part) => (part.kind === 'text' && part.text.startsWith('<context>') ? [part.text] : [])) : []))
}

/** Whether the person last was on a Company screen, by the address the context line gives. */
function inCompany(request: ModelRequest): boolean {
  const where = contextLines(request).filter((line) => line.includes('The person is in'))
  return where.at(-1)?.includes('(/company') ?? false
}

/** What asks to sort the rows waiting, as Suggest categories and the quick action do. */
const SORT_JOB = /suggest categories|^sort|predloži kategorije|^razvrstaj/i

/** The fields add-rule and change-rule share, each left as it is, as a model writes them before it names what the rule looks for. */
const RULE_LEFT = {
  name: null,
  on: null,
  before: null,
  payeeWords: null,
  descriptionWords: null,
  descriptionStart: null,
  iban: null,
  ibanPresent: null,
  direction: null,
  ownAccount: null,
  client: null,
  card: null,
  foreignCurrency: null,
  domain: null,
  family: null,
  subFamily: null,
  purpose: null,
  revenueCode: null,
  confidence: null,
  note: null,
}
/** The counterparties the fake model is sure of: a shop for devices files under Equipment. Any other row waiting gets a new category. */
const SURE: readonly { readonly word: string; readonly category: RegExp }[] = [{ word: 'GADGET', category: /^equipment$|^oprema$/i }]

/** The new category the fake model proposes for a row no category fits, a client meal the profit tax counts as representation. */
function mealsCategory(says: Says): Readonly<Record<string, unknown>> {
  return {
    category: 'client-meals',
    label: says.mealsLabel,
    family: says.trainingFamily,
    bucket: 'operating',
    taxClass: 'representation',
    roles: [],
    vat: 'representation',
    colour: null,
    ownerShare: '',
  }
}

/**
 * Reads the rows waiting and the categories, and files the rows it is sure of on one card. A row no category fits gets a job of
 * cards that follow at each Go on: a new category, then a rule that files the row into it.
 */
function sortReply({ request, tokens }: FakeChatTurn, says: Says): ModelReply {
  const answers = answersSince(request)
  if (answers.length === 0) return lookup(0, 'find_records', findRecordsArgs('company', 'ledger-row', { only: 'waiting' }), tokens)
  if (answers.length === 1) return lookup(1, 'find_records', findRecordsArgs('company', 'category', { limit: 50 }), tokens)
  const waiting = recordsOf(answers[0]!.text)
  const categories = recordsOf(answers[1]!.text)
  const sure = waiting.flatMap((row) => {
    const pick = SURE.find((candidate) => row.counterparty?.includes(candidate.word))
    const category = pick === undefined ? undefined : categories.find((candidate) => pick.category.test(candidate.label ?? ''))
    return category === undefined ? [] : [{ row, category }]
  })
  const unsure = waiting.filter((row) => !sure.some((filed) => filed.row.ref === row.ref)).map((row) => row.counterparty ?? row.ref)
  if (answers.length === 2) {
    if (sure.length === 0)
      return lookup(2, 'propose_changes', { app: 'company', title: says.mealsTitle, steps: [{ op: 'add-category', input: JSON.stringify(mealsCategory(says)), as: null }], next: true }, tokens)
    const steps = sure.map(({ row, category }) => ({ op: 'file-row', input: JSON.stringify({ row: row.ref, category: category.ref }), as: null }))
    return lookup(2, 'propose_changes', { app: 'company', title: says.sortTitle, steps, next: unsure.length > 0 }, tokens)
  }
  if (sure.length === 0) return answered(request, says.mealsProposed, tokens)
  return answered(request, unsure.length === 0 ? says.filedAll : says.sorted(unsure.join(', ')), tokens)
}

/** The card a Go on asks for in the sorting job: first the new category, then a rule from the row no category fitted into it. */
function sortGoOnReply({ request, tokens }: FakeChatTurn, says: Says, goOns: number): ModelReply {
  const answers = answersSince(request)
  if (goOns === 1) {
    if (answers.length === 0)
      return lookup(0, 'propose_changes', { app: 'company', title: says.mealsTitle, steps: [{ op: 'add-category', input: JSON.stringify(mealsCategory(says)), as: null }], next: true }, tokens)
    return answered(request, says.mealsProposed, tokens)
  }
  if (answers.length === 0) return lookup(0, 'find_records', findRecordsArgs('company', 'ledger-row', { only: 'waiting' }), tokens)
  if (answers.length === 1) return lookup(1, 'find_records', findRecordsArgs('company', 'category', { limit: 50 }), tokens)
  if (answers.length === 2) {
    const row = recordsOf(answers[0]!.text).find((waiting) => !SURE.some((candidate) => waiting.counterparty?.includes(candidate.word)))
    const meals = recordsOf(answers[1]!.text).find((category) => category.label === says.mealsLabel)
    if (row === undefined || meals === undefined) return answered(request, says.filedAll, tokens)
    const input = { ...RULE_LEFT, row: row.ref, category: meals.ref }
    return lookup(2, 'propose_changes', { app: 'company', title: says.mealsRuleTitle, steps: [{ op: 'add-rule', input: JSON.stringify(input), as: null }], next: false }, tokens)
  }
  return answered(request, says.mealsRuled, tokens)
}

/** Reads the clients and links the Invoices tab with the first one picked, since the chat writes no PDF and no mail. */
function invoiceReply({ request, tokens }: FakeChatTurn, says: Says): ModelReply {
  const answers = answersSince(request)
  if (answers.length === 0) return lookup(0, 'find_records', findRecordsArgs('company', 'client', { limit: 10 }), tokens)
  if (answers.length === 1) {
    const [client] = recordsOf(answers[0]!.text)
    return lookup(1, 'show_screen', { route: '/company/invoicing?tab=invoices', params: client === undefined ? [] : [{ name: 'make', value: client.ref }] }, tokens)
  }
  return answered(request, says.invoice, tokens)
}

/** Reads the travel orders and proposes a parking cost the traveller paid on order 3/2026. */
function tripCostReply({ request, tokens }: FakeChatTurn, says: Says): ModelReply {
  const answers = answersSince(request)
  if (answers.length === 0) return lookup(0, 'find_records', findRecordsArgs('company', 'hr-doo.trip', { limit: 10 }), tokens)
  if (answers.length === 1) {
    const trip = recordsOf(answers[0]!.text).find((record) => record.number === '3/2026')
    if (trip === undefined) return answered(request, says.noTrip, tokens)
    const input = { trip: trip.ref, date: '2026-10-01', kind: 'parking', description: says.parking, amount: '18', foreignAmount: null, currency: null, paidBy: 'traveller' }
    return lookup(1, 'propose_changes', { app: 'company', title: says.tripCostTitle, steps: [{ op: 'add-trip-cost', input: JSON.stringify(input), as: null }], next: false }, tokens)
  }
  return answered(request, says.tripCost, tokens)
}

/** Proposes the books in US dollars, a setting whose line the card warns on. */
function currencyReply({ request, tokens }: FakeChatTurn, says: Says): ModelReply {
  const answers = answersSince(request)
  if (answers.length === 0) {
    const step = { op: 'set-setting', input: JSON.stringify({ key: 'currency', value: 'USD' }), as: null }
    return lookup(0, 'propose_changes', { app: 'company', title: says.currencyTitle, steps: [step], next: false }, tokens)
  }
  return answered(request, says.currency, tokens)
}

/**
 * Reads the categories and the first rule, and proposes a rule tried before every other that files Laptop Store under office
 * supplies, which re-files the row the owner confirmed under Equipment.
 */
function ruleReply({ request, tokens }: FakeChatTurn, says: Says): ModelReply {
  const answers = answersSince(request)
  if (answers.length === 0) return lookup(0, 'find_records', findRecordsArgs('company', 'category', { limit: 50 }), tokens)
  if (answers.length === 1) return lookup(1, 'find_records', findRecordsArgs('company', 'rule', { limit: 1 }), tokens)
  if (answers.length === 2) {
    const office = recordsOf(answers[0]!.text).find((category) => /office supplies|uredski materijal/i.test(category.label ?? ''))
    if (office === undefined) return answered(request, says.noCategory, tokens)
    const [first] = recordsOf(answers[1]!.text)
    const input = { ...RULE_LEFT, row: null, category: office.ref, before: first?.ref ?? null, payeeWords: 'Laptop Store', direction: 'out', confidence: 'rule' }
    return lookup(2, 'propose_changes', { app: 'company', title: says.ruleTitle, steps: [{ op: 'add-rule', input: JSON.stringify(input), as: null }], next: false }, tokens)
  }
  return answered(request, says.rule, tokens)
}

/** Reads the rules and proposes trying the second one before the first, a card that changes only where a rule stands. */
function moveReply({ request, tokens }: FakeChatTurn, says: Says): ModelReply {
  const answers = answersSince(request)
  if (answers.length === 0) return lookup(0, 'find_records', findRecordsArgs('company', 'rule', { limit: 50 }), tokens)
  if (answers.length === 1) {
    const rules = recordsOf(answers[0]!.text)
    const [first, second] = rules
    if (first === undefined || second === undefined) return answered(request, says.fewRules, tokens)
    const input = { ...RULE_LEFT, rule: second.ref, category: null, before: first.ref, last: null }
    return lookup(1, 'propose_changes', { app: 'company', title: says.moveTitle, steps: [{ op: 'change-rule', input: JSON.stringify(input), as: null }], next: false }, tokens)
  }
  return answered(request, says.moved, tokens)
}

/** Proposes a new operating category for training with its tax class, a cost the profit tax allows, and VAT deducted at the full rate. */
function categoryReply({ request, tokens }: FakeChatTurn, says: Says): ModelReply {
  const answers = answersSince(request)
  if (answers.length === 0) {
    const input = {
      category: 'training',
      label: says.trainingLabel,
      family: says.trainingFamily,
      bucket: 'operating',
      taxClass: 'deductible-cost',
      colour: null,
      roles: [],
      vat: 'deductible-25',
      ownerShare: '',
    }
    return lookup(0, 'propose_changes', { app: 'company', title: says.categoryTitle, steps: [{ op: 'add-category', input: JSON.stringify(input), as: null }], next: false }, tokens)
  }
  return answered(request, says.category, tokens)
}

/** Reads the categories and deletes AI services into software subscriptions, which moves what names it there in the same change. */
function mergeReply({ request, tokens }: FakeChatTurn, says: Says): ModelReply {
  const answers = answersSince(request)
  if (answers.length === 0) return lookup(0, 'find_records', findRecordsArgs('company', 'category', { limit: 50 }), tokens)
  if (answers.length === 1) {
    const categories = recordsOf(answers[0]!.text)
    const ai = categories.find((category) => /^ai\b/i.test(category.label ?? ''))
    const software = categories.find((category) => /software|softver/i.test(category.label ?? ''))
    if (ai === undefined || software === undefined) return answered(request, says.noMerge, tokens)
    const step = { op: 'delete-category', input: JSON.stringify({ category: ai.ref, into: software.ref }), as: null }
    return lookup(1, 'propose_changes', { app: 'company', title: says.mergeTitle, steps: [step], next: false }, tokens)
  }
  return answered(request, says.merge, tokens)
}

/** Reads the accounts and copies a pasted statement that prints no balances onto the first, which has no rows yet, so Kuna starts it at zero. */
function statementReply({ request, tokens }: FakeChatTurn, says: Says): ModelReply {
  const answers = answersSince(request)
  if (answers.length === 0) return lookup(0, 'find_records', findAccounts, tokens)
  if (answers.length === 1) {
    const [account] = recordsOf(answers[0]!.text)
    if (account === undefined) return answered(request, says.noAccount, tokens)
    const day = today()
    const rows = [
      { date: addDays(day, -6), amount: -12.5, counterparty: 'Corner market', iban: null, description: 'REF 1001' },
      { date: addDays(day, -5), amount: -40, counterparty: 'Harbour bistro', iban: null, description: 'REF 1002' },
      { date: addDays(day, -4), amount: 100, counterparty: 'Northwind', iban: null, description: 'REF 1003' },
    ]
    const input = { file: null, profile: null, account: account.ref, statementName: '7/2026', opening: null, closing: null, rows, lookAlikes: 'ask', newAccount: null, part: 1 }
    return lookup(1, 'propose_changes', { app: 'company', title: says.statementTitle, steps: [{ op: 'import-statement', input: JSON.stringify(input), as: null }], next: false }, tokens)
  }
  return answered(request, answers[1]!.isError ? says.statementRefused : says.statementProposed, tokens)
}

const findAccounts = findRecordsArgs('company', 'account', { limit: 5 })

/**
 * Copies a statement of the main account in the fake books, with no balances: the snack kiosk row of 8 October as the bank has it,
 * which Kuna skips, the phone bill of 7 October dated two days later, which waits as a look-alike, and a new row after them.
 */
function copyReply({ request, tokens }: FakeChatTurn, says: Says): ModelReply {
  const answers = answersSince(request)
  if (answers.length === 0) return lookup(0, 'find_records', findAccounts, tokens)
  if (answers.length === 1) {
    const accounts = recordsOf(answers[0]!.text)
    const main = accounts.find((account) => /main|glavn/i.test(account.label ?? '')) ?? accounts.find((account) => !/legacy|star/i.test(account.label ?? ''))
    if (main === undefined) return answered(request, says.noAccount, tokens)
    const rows = [
      { date: '2026-10-08', amount: -6.4, counterparty: 'SNACK KIOSK', iban: null, description: 'Card purchase' },
      { date: '2026-10-09', amount: -14.08, counterparty: 'Phone network d.d.', iban: null, description: 'Mobile plan' },
      { date: '2026-10-20', amount: -12.5, counterparty: 'Papirnica d.o.o.', iban: null, description: 'Papir' },
    ]
    const input = { file: null, profile: null, account: main.ref, statementName: '10/2026', opening: null, closing: null, rows, lookAlikes: 'ask', newAccount: null, part: 1 }
    return lookup(1, 'propose_changes', { app: 'company', title: says.copyTitle, steps: [{ op: 'import-statement', input: JSON.stringify(input), as: null }], next: false }, tokens)
  }
  return answered(request, answers[1]!.isError ? says.statementRefused : says.copyProposed, tokens)
}

interface ReadStep {
  readonly label: string
  readonly amount: string
  readonly steps: readonly ReadStep[]
}

/** Reads the build-up the context line names, links the first tax rule it cites, and answers in prose from the read, or says Anonymise keeps it on the device. */
function buildUpReply({ request, tokens }: FakeChatTurn, says: Says): ModelReply {
  const ref = contextLines(request)
    .flatMap((line) => [...line.matchAll(/build-up-\d+/g)].map((match) => match[0]))
    .at(-1)
  if (ref === undefined) return answered(request, says.noBuildUp, tokens)
  const answers = answersSince(request)
  if (answers.length === 0) return lookup(0, 'read_build_up', { ref }, tokens)
  if (answers[0]!.isError) return answered(request, answers[0]!.text === aboutEmployeesPay('build-up') ? says.keptByAnonymise : answers[0]!.text, tokens)
  const read = JSON.parse(answers[0]!.text) as { readonly figure: ReadStep; readonly ruleRefs?: Readonly<Record<string, string>> }
  const [rule] = Object.values(read.ruleRefs ?? {})
  if (answers.length === 1 && rule !== undefined) return lookup(1, 'show_screen', { route: '/company/settings?tab=tax-rules', params: [{ name: 'rule', value: rule }] }, tokens)
  const steps = read.figure.steps.map((step) => `${step.label} ${step.amount}`).join(', ')
  return answered(request, says.explained(read.figure.label, read.figure.amount, steps), tokens)
}

/**
 * Company's part of the fake chat, only while the person is on a Company screen: one that asks to suggest categories or sort
 * reads the rows waiting, files the sure ones and goes on at each Go on with a new category and a rule for the rest, one about an invoice links the Invoices tab, one about dollars proposes the
 * currency, one that always files Laptop Store proposes a rule that re-files a confirmed row, one that tries the second rule first moves it to the top, one about training proposes a category with its tax
 * class, one that starts with merge deletes AI services into software subscriptions, one that starts with import copies a pasted statement onto the first account, one that starts with transcribe copies a statement of the main account a row of which waits as a look-alike, one that asks to explain reads the tagged build-up, and one about parking adds a cost to travel order 3/2026.
 */
function companyChat(turn: FakeChatTurn): ModelReply | null {
  if (!inCompany(turn.request)) return null
  const says = ANSWERS[language === 'hr' ? 'hr' : 'en']
  const { typed } = turn
  const sortGoOns = goOnsInto(turn.request, SORT_JOB)
  if (sortGoOns !== null) return sortGoOnReply(turn, says, sortGoOns)
  if (SORT_JOB.test(typed)) return sortReply(turn, says)
  if (/invoice|faktur/i.test(typed)) return invoiceReply(turn, says)
  if (/dollar|dolar/i.test(typed)) return currencyReply(turn, says)
  if (/laptop store/i.test(typed)) return ruleReply(turn, says)
  if (/second rule first|drugo pravilo isprobava prvo/i.test(typed)) return moveReply(turn, says)
  if (/training|edukacij/i.test(typed)) return categoryReply(turn, says)
  if (/^merge|^spoji/i.test(typed)) return mergeReply(turn, says)
  if (/^import|^uvezi/i.test(typed)) return statementReply(turn, says)
  if (/^transcribe|^prenesi/i.test(typed)) return copyReply(turn, says)
  if (/explain|objasni/i.test(typed)) return buildUpReply(turn, says)
  if (/parking|parkiranj/i.test(typed)) return tripCostReply(turn, says)
  return null
}

export function registerFakeCompanyChat(): void {
  registerFakeChat(companyChat)
}
