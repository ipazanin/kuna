import { answered, answersSince, lookup, registerFakeChat } from '../../../../../shared/ai/infrastructure/fake/fakeChatReply'
import type { FakeChatTurn } from '../../../../../shared/ai/infrastructure/fake/fakeChatReply'
import type { ModelReply, ModelRequest } from '../../../../../shared/ai/application/modelPort'
import { language } from '../../../../../shared/text/language'

const ANSWERS = {
  en: {
    notRead: "You didn't allow reading Company, so I can only tell you how it works.",
    sortTitle: 'File what I am sure of',
    sorted: (unsure: string) => `The card files the rows I am sure of. I am not sure about ${unsure}: was it a client lunch, so Representation, or something else?`,
    nothingSure: 'None of the rows waiting is one I am sure of. Tell me what each was for, and I will propose a card.',
    invoice: 'Kuna makes the invoice PDF and its mail on the Invoices tab, so I cannot make it from here. The link opens the tab with the client picked, and you press Make there.',
    currencyTitle: 'Show the figures in US dollars',
    currency: 'The card changes the currency of the books. Every figure then reads in dollars, so check the warned line before you accept.',
    ruleTitle: 'A rule for Laptop Store',
    rule: 'The card adds the rule and files the Laptop Store rows you confirmed under Equipment under Office supplies instead. Each of their lines is warned, since you filed them yourself.',
    noCategory: 'I found no category for office supplies. Add one on Settings, Categories first.',
    noBuildUp: 'Tag a figure with its ask button first, and I will read how Kuna built it.',
    explained: (label: string, amount: string, steps: string) => `${label} is ${amount}. Kuna builds it from ${steps}. The link opens the tax rule it rests on.`,
  },
  hr: {
    notRead: 'Niste dopustili čitanje Tvrtke, pa vam mogu reći samo kako radi.',
    sortTitle: 'Razvrstaj ono u što sam siguran',
    sorted: (unsure: string) => `Kartica razvrstava retke u koje sam siguran. Za ${unsure} nisam siguran: je li to bio ručak s klijentom, dakle Reprezentacija, ili nešto drugo?`,
    nothingSure: 'Ni u jedan redak koji čeka nisam siguran. Recite mi za što je koji bio i predložit ću karticu.',
    invoice: 'Kuna izrađuje PDF računa i poruku na kartici Računi, pa ga ne mogu izraditi odavde. Poveznica otvara karticu s odabranim klijentom, a vi ondje pritisnete Izradi.',
    currencyTitle: 'Prikaži iznose u američkim dolarima',
    currency: 'Kartica mijenja valutu knjiga. Svaki iznos tada se čita u dolarima, pa provjerite označeni redak prije nego što prihvatite.',
    ruleTitle: 'Pravilo za Laptop Store',
    rule: 'Kartica dodaje pravilo i stavke Laptop Store koje ste potvrdili pod Opremom razvrstava pod Uredski materijal. Svaki njihov redak je označen jer ste ih sami razvrstali.',
    noCategory: 'Nisam našao kategoriju za uredski materijal. Najprije je dodajte na Postavkama, Kategorije.',
    noBuildUp: 'Najprije označite iznos njegovim gumbom za pitanje, pa ću pročitati kako ga je Kuna izračunala.',
    explained: (label: string, amount: string, steps: string) => `${label} iznosi ${amount}. Kuna ga računa iz ${steps}. Poveznica otvara porezno pravilo na kojem počiva.`,
  },
}

type Says = (typeof ANSWERS)['en']

interface FoundRecord {
  readonly ref: string
  readonly label?: string
  readonly counterparty?: string
  readonly category?: string
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

const findIn = (kind: string, only: string | null, limit: number) => ({ app: 'company', kind, query: null, from: null, to: null, about: null, only, limit, cursor: null })

/** The counterparties the fake model is sure of: a shop for devices files under Equipment. Any other row waiting is asked about. */
const SURE: readonly { readonly word: string; readonly category: RegExp }[] = [{ word: 'GADGET', category: /^equipment$|^oprema$/i }]

/** Reads the rows waiting and the categories, files the rows it is sure of on one card, and asks about the rest. */
function sortReply({ request, tokens }: FakeChatTurn, says: Says): ModelReply {
  const answers = answersSince(request)
  if (answers.length === 0) return lookup(0, 'find_records', findIn('ledger-row', 'waiting', 20), tokens)
  if (answers[0]!.isError) return answered(request, says.notRead, tokens)
  if (answers.length === 1) return lookup(1, 'find_records', findIn('category', null, 50), tokens)
  const waiting = recordsOf(answers[0]!.text)
  const categories = recordsOf(answers[1]!.text)
  const sure = waiting.flatMap((row) => {
    const pick = SURE.find((candidate) => row.counterparty?.includes(candidate.word))
    const category = pick === undefined ? undefined : categories.find((candidate) => pick.category.test(candidate.label ?? ''))
    return category === undefined ? [] : [{ row, category }]
  })
  const unsure = waiting.filter((row) => !sure.some((filed) => filed.row.ref === row.ref)).map((row) => row.counterparty ?? row.ref)
  if (sure.length === 0) return answered(request, says.nothingSure, tokens)
  if (answers.length === 2) {
    const steps = sure.map(({ row, category }) => ({ op: 'file-row', input: JSON.stringify({ row: row.ref, category: category.ref }), as: null }))
    return lookup(2, 'propose_changes', { app: 'company', title: says.sortTitle, steps }, tokens)
  }
  return answered(request, says.sorted(unsure.join(', ')), tokens)
}

/** Reads the clients and links the Invoices tab with the first one picked, since the chat writes no PDF and no mail. */
function invoiceReply({ request, tokens }: FakeChatTurn, says: Says): ModelReply {
  const answers = answersSince(request)
  if (answers.length === 0) return lookup(0, 'find_records', findIn('client', null, 10), tokens)
  if (answers[0]!.isError) return answered(request, says.notRead, tokens)
  if (answers.length === 1) {
    const [client] = recordsOf(answers[0]!.text)
    return lookup(1, 'show_screen', { route: '/company/invoicing?tab=invoices', params: client === undefined ? [] : [{ name: 'make', value: client.ref }] }, tokens)
  }
  return answered(request, says.invoice, tokens)
}

/** Proposes the books in US dollars, a setting whose line the card warns on. */
function currencyReply({ request, tokens }: FakeChatTurn, says: Says): ModelReply {
  const answers = answersSince(request)
  if (answers.length === 0) {
    const step = { op: 'set-setting', input: JSON.stringify({ key: 'currency', value: 'USD' }), as: null }
    return lookup(0, 'propose_changes', { app: 'company', title: says.currencyTitle, steps: [step] }, tokens)
  }
  return answered(request, says.currency, tokens)
}

/**
 * Reads the categories and the first rule, and proposes a rule tried before every other that files Laptop Store under office
 * supplies, which re-files the row the owner confirmed under Equipment.
 */
function ruleReply({ request, tokens }: FakeChatTurn, says: Says): ModelReply {
  const answers = answersSince(request)
  if (answers.length === 0) return lookup(0, 'find_records', findIn('category', null, 50), tokens)
  if (answers[0]!.isError) return answered(request, says.notRead, tokens)
  if (answers.length === 1) return lookup(1, 'find_records', findIn('rule', null, 1), tokens)
  if (answers.length === 2) {
    const office = recordsOf(answers[0]!.text).find((category) => /office supplies|uredski materijal/i.test(category.label ?? ''))
    if (office === undefined) return answered(request, says.noCategory, tokens)
    const [first] = recordsOf(answers[1]!.text)
    const input = { row: null, category: office.ref, before: first?.ref ?? null, payeeWords: 'Laptop Store', descriptionWords: null, iban: null, direction: 'out', confidence: 'rule', note: null }
    return lookup(2, 'propose_changes', { app: 'company', title: says.ruleTitle, steps: [{ op: 'add-rule', input: JSON.stringify(input), as: null }] }, tokens)
  }
  return answered(request, says.rule, tokens)
}

interface ReadStep {
  readonly label: string
  readonly amount: string
  readonly steps: readonly ReadStep[]
}

/** Reads the build-up the context line names, links the first tax rule it cites, and answers in prose from the read. */
function buildUpReply({ request, tokens }: FakeChatTurn, says: Says): ModelReply {
  const ref = contextLines(request)
    .flatMap((line) => [...line.matchAll(/build-up-\d+/g)].map((match) => match[0]))
    .at(-1)
  if (ref === undefined) return answered(request, says.noBuildUp, tokens)
  const answers = answersSince(request)
  if (answers.length === 0) return lookup(0, 'read_build_up', { ref }, tokens)
  if (answers[0]!.isError) return answered(request, answers[0]!.text, tokens)
  const read = JSON.parse(answers[0]!.text) as { readonly figure: ReadStep; readonly ruleRefs?: Readonly<Record<string, string>> }
  const [rule] = Object.values(read.ruleRefs ?? {})
  if (answers.length === 1 && rule !== undefined) return lookup(1, 'show_screen', { route: '/company/settings?tab=tax-rules', params: [{ name: 'rule', value: rule }] }, tokens)
  const steps = read.figure.steps.map((step) => `${step.label} ${step.amount}`).join(', ')
  return answered(request, says.explained(read.figure.label, read.figure.amount, steps), tokens)
}

/**
 * Company's part of the fake chat, only while the person is on a Company screen: one that asks to suggest categories or sort
 * reads the rows waiting and files the sure ones, one about an invoice links the Invoices tab, one about dollars proposes the
 * currency, one that always files Laptop Store proposes a rule that re-files a confirmed row, and one that asks to explain reads the tagged build-up.
 */
function companyChat(turn: FakeChatTurn): ModelReply | null {
  if (!inCompany(turn.request)) return null
  const says = ANSWERS[language === 'hr' ? 'hr' : 'en']
  const { typed } = turn
  if (/suggest categories|^sort|predloži kategorije|^razvrstaj/i.test(typed)) return sortReply(turn, says)
  if (/invoice|faktur/i.test(typed)) return invoiceReply(turn, says)
  if (/dollar|dolar/i.test(typed)) return currencyReply(turn, says)
  if (/laptop store/i.test(typed)) return ruleReply(turn, says)
  if (/explain|objasni/i.test(typed)) return buildUpReply(turn, says)
  return null
}

export function registerFakeCompanyChat(): void {
  registerFakeChat(companyChat)
}
