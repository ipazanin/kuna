import { answered, answersSince, lookup, proposedStep } from '../../../../../shared/ai/infrastructure/fake/fakeChatReply'
import type { FakeChatTurn } from '../../../../../shared/ai/infrastructure/fake/fakeChatReply'
import type { ModelReply } from '../../../../../shared/ai/application/modelPort'
import { addDays } from '../../../../../shared/calendar/civilDate'
import { language } from '../../../../../shared/text/language'
import { SPENDING_OPERATIONS } from '../../operations/spendingOperations'
import { fakeSpendingDayHere } from '../../../workbook/infrastructure/fake/fakeSpending'
import { findAccounts, personTexts, recordsIn } from './fakeSpendingRecords'

const ANSWERS = {
  en: {
    statementTitle: 'Import the pasted statement',
    statementProposed: 'I misread one amount at first, so Kuna refused it as not adding up. The card below now ties from the opening balance to the closing one.',
    copyTitle: 'Import the copied statement',
    copyProposed: 'One row is in Spending already and is skipped. Another looks like a row Kuna has from another source, so it waits on the card. Is it another payment?',
    noFile: 'Attach the Revolut export with the paperclip, and I will copy its rows.',
    revolutName: 'Revolut export',
    revolutTitle: 'Import the Revolut export',
    revolutProposed: 'The card imports the rows I copied from the Revolut file. The export prints no opening or closing balance, so check the rows against it.',
    revolutRefused: 'Kuna refused the rows I copied. Check them against the file.',
    matched: {
      same: (row: number) => `Row ${row} is in Spending already.`,
      like: (row: number) => `Row ${row} looks like a payment Spending has, dated a few days off. Is it another payment?`,
      none: (row: number) => `Row ${row} is not in Spending yet.`,
    },
  },
  hr: {
    statementTitle: 'Uvezi zalijepljeni izvod',
    statementProposed: 'Isprva sam krivo pročitao jedan iznos, pa ga je Kuna odbila jer se ne zbraja. Kartica ispod sada se slaže od početnog do završnog stanja.',
    copyTitle: 'Uvezi prepisani izvod',
    copyProposed: 'Jedan je redak već u Potrošnji i preskočen je. Drugi nalikuje retku koji Kuna ima iz drugog izvora, pa čeka na kartici. Je li to drugo plaćanje?',
    noFile: 'Priložite izvoz iz Revoluta spajalicom i prepisat ću njegove retke.',
    revolutName: 'Izvoz iz Revoluta',
    revolutTitle: 'Uvezi izvoz iz Revoluta',
    revolutProposed: 'Kartica uvozi retke koje sam prepisao iz datoteke iz Revoluta. Izvoz ne ispisuje početno ni završno stanje, pa retke usporedite s njim.',
    revolutRefused: 'Kuna je odbila retke koje sam prepisao. Provjerite ih s datotekom.',
    matched: {
      same: (row: number) => `${row}. redak već je u Potrošnji.`,
      like: (row: number) => `${row}. redak nalikuje plaćanju koje Potrošnja ima nekoliko dana ranije ili kasnije. Je li to drugo plaćanje?`,
      none: (row: number) => `${row}. retka još nema u Potrošnji.`,
    },
  },
}

const says = ANSWERS[language]

/** A row as a model copies it off a statement into import-statement. */
interface CopiedRow {
  readonly date: string
  readonly amount: number
  readonly payee: string
}

/** Rows as a model would read them off a pasted statement, all made up, dated in the last week so every account is open by then. */
function statementRows(misread: boolean): readonly CopiedRow[] {
  const day = fakeSpendingDayHere()
  return [
    { date: addDays(day, -6), amount: -12.5, payee: 'Corner market' },
    { date: addDays(day, -5), amount: misread ? -40.01 : -40, payee: 'Harbour bistro' },
    { date: addDays(day, -4), amount: 100, payee: 'Mali dućan' },
  ]
}

/** Reads the accounts and transcribes a pasted statement onto the first: once with one amount a cent off, which Kuna refuses, then as printed. */
export function statementReply({ request, tokens }: FakeChatTurn): ModelReply {
  const answers = answersSince(request)
  if (answers.length === 0) return lookup(0, 'find_records', findAccounts, tokens)
  if (answers.length < 3) {
    const step = proposedStep(SPENDING_OPERATIONS, 'import-statement', {
      account: recordsIn(answers[0]!.text)[0]!.ref,
      statementName: '41/2026',
      opening: 500,
      closing: 547.5,
      rows: statementRows(answers.length === 1),
      part: 1,
      lookAlikes: 'ask',
    })
    return lookup(answers.length, 'propose_changes', { app: 'spending', title: says.statementTitle, steps: [step], next: false }, tokens)
  }
  return answered(request, says.statementProposed, tokens)
}

/**
 * Rows of the OTP account in the statements sample as a statement prints them: the City pharmacy row of nine days back as the
 * file has it, the one of four days back a day later and spelled longer, and a new kiosk row.
 */
function otpStatementRows(): readonly { readonly date: string; readonly amount: string; readonly payee: string }[] {
  const day = fakeSpendingDayHere()
  return [
    { date: addDays(day, -9), amount: '-12.00', payee: 'City pharmacy' },
    { date: addDays(day, -3), amount: '-18.90', payee: 'CITY PHARMACY 22 ZAGREB' },
    { date: addDays(day, -1), amount: '-9.00', payee: 'Kiosk' },
  ]
}

/** The account of the bank's name, or the first when none is. */
function accountOf(found: string, bank: string): string {
  const accounts = recordsIn(found)
  return (accounts.find((account) => account.bank === bank) ?? accounts[0]!).ref
}

/** Copies the OTP statement with no balances, so Kuna skips the first row, the second waits as a look-alike and the kiosk row is new. */
export function copyReply({ request, tokens }: FakeChatTurn): ModelReply {
  const answers = answersSince(request)
  if (answers.length === 0) return lookup(0, 'find_records', findAccounts, tokens)
  if (answers.length === 1) {
    const rows = otpStatementRows().map((row) => ({ ...row, amount: Number(row.amount) }))
    const step = proposedStep(SPENDING_OPERATIONS, 'import-statement', { account: accountOf(answers[0]!.text, 'otp'), rows, statementName: '12/2026', part: 1, lookAlikes: 'ask' })
    return lookup(1, 'propose_changes', { app: 'spending', title: says.copyTitle, steps: [step], next: false }, tokens)
  }
  return answered(request, says.copyProposed, tokens)
}

/** The last CSV attached to the chat, by the id its context line gives, or null for none. */
function attachedCsv(request: FakeChatTurn['request']): string | null {
  return (
    personTexts(request)
      .flatMap((text) => [...text.matchAll(/\b(a\d+) \(csv\b/g)].map((match) => match[1]!))
      .at(-1) ?? null
  )
}

/** The completed rows of a Revolut export as read_attachment hands its cells, under the export's own header row. */
function revolutRows(read: string): readonly CopiedRow[] {
  const [header = [], ...cells] = (JSON.parse(read) as { readonly rows: readonly (readonly string[])[] }).rows
  const at = (column: string): number => header.indexOf(column)
  return cells.filter((row) => row[at('State')] === 'COMPLETED').map((row) => ({ date: row[at('Completed Date')]!.slice(0, 10), amount: Number(row[at('Amount')]), payee: row[at('Description')]! }))
}

/** Reads the Revolut export attached to the chat as cells, finds the Revolut account and copies the export's completed rows onto it, with no balances since the export prints none. */
export function revolutCopyReply({ request, tokens }: FakeChatTurn): ModelReply {
  const file = attachedCsv(request)
  if (file === null) return answered(request, says.noFile, tokens)
  const answers = answersSince(request)
  if (answers.length === 0) return lookup(0, 'read_attachment', { attachment: file, pages: null, sheet: null, rows: null }, tokens)
  if (answers.length === 1) return lookup(1, 'find_records', findAccounts, tokens)
  if (answers.length === 2) {
    const step = proposedStep(SPENDING_OPERATIONS, 'import-statement', {
      file,
      account: accountOf(answers[1]!.text, 'revolut'),
      statementName: says.revolutName,
      rows: revolutRows(answers[0]!.text),
      part: 1,
      lookAlikes: 'ask',
    })
    return lookup(2, 'propose_changes', { app: 'spending', title: says.revolutTitle, steps: [step], next: false }, tokens)
  }
  return answered(request, answers[2]!.isError ? says.revolutRefused : says.revolutProposed, tokens)
}

/** Asks Kuna which rows of the OTP statement Spending has, and says for each whether it is in, looks like a payment there, or is new. */
export function matchReply({ request, tokens }: FakeChatTurn): ModelReply {
  const answers = answersSince(request)
  if (answers.length === 0) return lookup(0, 'find_records', findAccounts, tokens)
  if (answers.length === 1) {
    const rows = otpStatementRows().map(({ date, amount, payee }) => ({ date, amount, counterparty: payee, description: '' }))
    return lookup(1, 'match_records', { app: 'spending', kind: 'transaction', account: accountOf(answers[0]!.text, 'otp'), rows, receipts: [] }, tokens)
  }
  const { matches } = JSON.parse(answers[1]!.text) as { readonly matches: readonly { readonly row: number; readonly match: 'same' | 'like' | 'none' }[] }
  return answered(request, matches.map(({ row, match }) => `- ${says.matched[match](row)}`).join('\n'), tokens)
}
