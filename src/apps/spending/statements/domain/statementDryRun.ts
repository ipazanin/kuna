import { decidingRule, spendingCategorisationContext } from './spendingCategorisation'
import type { RowChange } from './spendingCategorisation'
import { isBankSyncKey, isTranscribedKey, rowSource } from './statementRows'
import type { StatementRow, StatementRows } from './statementRows'
import { words } from './words'
import { sameMoney, typedRowsOf } from '../../pairing/domain/sameMoney'
import { cashAccountsFor, isWithdrawal, withCashLeg } from '../../pairing/domain/cashWithdrawals'
import { wantsSavingsAccount } from '../../pairing/domain/wantsSavingsAccount'
import { receiptsArriving } from '../../receipts/domain/waitingReceipts'
import type { PlacedReceipt } from '../../receipts/domain/waitingReceipts'
import { words as receiptWords } from '../../receipts/domain/words'
import { isPairable, legsOfPair, transferPairs } from '../../pairing/domain/transferPairs'
import { beforeStartDay } from '../../workbook/domain/account'
import type { Account } from '../../workbook/domain/account'
import { transferCategoryOf } from '../../workbook/domain/category'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import type { HeldBankRow } from '../../workbook/domain/heldBankRow'
import { HELD_ROW_RECORDS, TRANSACTION_RECORDS } from '../../workbook/domain/spendingKinds'
import { rowKey } from '../../workbook/domain/transaction'
import type { Transaction } from '../../workbook/domain/transaction'
import { filedAsTransfer, refiledItems, rowItemsOf, wholeItemOf } from '../../workbook/domain/rowItems'
import type { ItemizedRow } from '../../workbook/domain/rowItems'
import type { TransactionItem } from '../../workbook/domain/transactionItem'
import { mainCategoryOf } from '../../../../shared/categorising/domain/mainCategory'
import { addDays, daysBetween } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { overlapOf, rangeContains } from '../../../../shared/calendar/dateRange'
import type { DateRange } from '../../../../shared/calendar/dateRange'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { bookedTwins } from '../../../../shared/money/lookAlikeBookings'
import type { BookedTwin, Booking, TwinAnswer } from '../../../../shared/money/lookAlikeBookings'
import type { AccountMoney } from '../../../../shared/money/accountMoney'
import { newRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { normaliseIban } from '../../../../shared/text/fold'
import { plural } from '../../../../shared/text/translation'

/** How far before today and before the statement's oldest new row the pairing looks for the other leg among rows on the file. */
const PAIRING_DAYS = 30

/**
 * What happens to a row: `before-opening` is left out, `already-in` skipped, `outside-days` left out since the person named days
 * the file brings that leave it out, `other-source` skipped since the other of a file and the bank sync covers its day, `look-alike` waits since it looks like a row on the file from another source, `filled` joins a
 * typed row, `replaced` takes the place of such a row on the person's word, `new` is added, and `refiled` is a row already on the file that
 * the pairing changes.
 */
export type DryRunOutcome = 'before-opening' | 'already-in' | 'outside-days' | 'other-source' | 'look-alike' | 'filled' | 'replaced' | 'new' | 'refiled'

export type DryRunLine =
  | {
      readonly row: StatementRow
      readonly outcome: Exclude<DryRunOutcome, 'look-alike' | 'replaced' | 'new'>
      /** The category it ends up with, null while it waits on review. */
      readonly category: RecordId | null
    }
  | {
      readonly row: StatementRow
      readonly outcome: 'new'
      readonly category: RecordId | null
      /** For cash taken out, its leg on the cash account, or null while it waits on To review for the account. Null for any other row. */
      readonly withdrawal: { readonly cashLeg: Transaction | null } | null
    }
  | {
      readonly row: StatementRow
      readonly outcome: 'look-alike'
      readonly category: null
      /** The row on the file it looks like. */
      readonly like: Transaction
    }
  | {
      readonly row: StatementRow
      readonly outcome: 'replaced'
      readonly category: RecordId | null
      /** The row on the file it takes the place of. */
      readonly like: Transaction
    }

/** A row of a file or the bank sync that looks like a row Kuna has from another source, and what the person said of it, null until they say. */
export interface TwinQuestion {
  /** The row's `rowKey`, which the answer goes under. */
  readonly key: string
  readonly row: StatementRow
  /** The row on the file from another source it looks like. */
  readonly booked: Transaction
  readonly keep: TwinAnswer['keep'] | null
}

/** What importing a statement would do, with nothing written yet. */
export interface StatementDryRun {
  readonly lines: readonly DryRunLine[]
  /** The statement's rows that look like rows Kuna has from another source, answered or not, in the statement's order. */
  readonly questions: readonly TwinQuestion[]
  /** The rows to add. */
  readonly added: readonly Transaction[]
  /** Every item of the rows to add, a waiting receipt's lines for a row it files. */
  readonly items: readonly TransactionItem[]
  /** The receipts that waited for the bank's row and go on one of the rows added, which they file. */
  readonly receipts: readonly PlacedReceipt[]
  /** The sync's rows that look like rows Kuna has, put on hold on To review until the person answers. */
  readonly held: readonly HeldBankRow[]
  /** The rows on the file that change: typed rows a bank row filled, and rows that became a transfer's leg. */
  readonly changed: readonly RowChange[]
  readonly newRows: number
  readonly alreadyIn: number
  readonly filled: number
  readonly notes: readonly string[]
}

/** The row that typed money becomes once the bank booked it. It keeps its id, its items and your name for the payee. */
export function filledByBank(
  typed: Transaction,
  bank: Pick<Transaction, 'date' | 'amount' | 'payee' | 'description' | 'counterpartyIban' | 'importKey' | 'statement' | 'movedAt' | 'pocket' | 'cashWithdrawal'>,
): Transaction {
  return {
    ...typed,
    date: bank.date,
    amount: bank.amount,
    payee: typed.payee === '' ? bank.payee : typed.payee,
    description: bank.description,
    counterpartyIban: bank.counterpartyIban,
    importKey: bank.importKey,
    statement: bank.statement,
    movedAt: bank.movedAt,
    pocket: bank.pocket,
    cashWithdrawal: bank.cashWithdrawal,
  }
}

/** Where an account's files end and its bank sync begins: the last day a file brought a row, and the first day the sync did. */
interface SourceDays {
  readonly lastFileDay: CivilDate | null
  readonly firstSyncDay: CivilDate | null
}

/** Each account's source days. A row the AI copied belongs to neither source, since it is matched row by row. */
function sourceDaysOf(rows: readonly Pick<Transaction, 'account' | 'date' | 'importKey'>[]): ReadonlyMap<RecordId, SourceDays> {
  const days = new Map<RecordId, SourceDays>()
  for (const { account, date, importKey } of rows) {
    if (importKey === '' || isTranscribedKey(importKey)) continue
    const { lastFileDay, firstSyncDay } = days.get(account) ?? { lastFileDay: null, firstSyncDay: null }
    days.set(
      account,
      isBankSyncKey(importKey)
        ? { lastFileDay, firstSyncDay: firstSyncDay === null || date < firstSyncDay ? date : firstSyncDay }
        : { firstSyncDay, lastFileDay: lastFileDay === null || date > lastFileDay ? date : lastFileDay },
    )
  }
  return days
}

/**
 * The days a file most likely brings when the bank sync covers some of its days: the longest run of its days on which the sync
 * brought no row to any of the file's accounts. Null when no day of the file is one the sync's days would leave out, or when
 * the sync brought rows on every day of it. A copied statement has none, as no day belongs to a source for it.
 */
export function syncGapOf(transactions: readonly Pick<Transaction, 'account' | 'date' | 'importKey'>[], statement: Pick<StatementRows, 'rows' | 'transcribed'>): DateRange | null {
  if (statement.transcribed !== undefined) return null
  const sourceDays = sourceDaysOf(transactions)
  const meetsSync = statement.rows.some((row) => {
    const firstSyncDay = sourceDays.get(row.account)?.firstSyncDay ?? null
    return firstSyncDay !== null && row.date >= firstSyncDay
  })
  if (!meetsSync) return null
  const accounts = new Set(statement.rows.map((row) => row.account))
  const syncDays = [...new Set(transactions.filter((row) => accounts.has(row.account) && isBankSyncKey(row.importKey)).map((row) => row.date))].sort()
  const fileDays = statement.rows.map((row) => row.date).sort()
  const file = { from: fileDays[0]!, to: fileDays[fileDays.length - 1]! }
  const edges = [addDays(file.from, -1), ...syncDays, addDays(file.to, 1)]
  const runs = edges.slice(1).flatMap((next, place) => overlapOf({ from: addDays(edges[place]!, 1), to: addDays(next, -1) }, file) ?? [])
  return runs.reduce<DateRange | null>((longest, run) => (longest === null || daysBetween(run.from, run.to) > daysBetween(longest.from, longest.to) ? run : longest), null)
}

/** A row as the look-alike test reads it, with the payee as the other side, and the row it came from. */
export function bookingOf<Row extends Pick<Transaction, 'date' | 'amount' | 'payee' | 'description'>>(row: Row): Booking<AccountMoney> & { readonly row: Row } {
  return { date: row.date, amount: row.amount, counterparty: row.payee, description: row.description, row }
}

/**
 * Each row's twin among the rows on the file from another source, but for those the statement's own keys hit and those of the
 * statement itself, such as its other parts. A copied row looks among every row an import brought, and a file's or a sync's row
 * among the rows of the other two sources. The rows are matched in order, so those given first take their twins first.
 */
function twinsOnFile(rows: readonly StatementRow[], book: SpendingBook, statement: StatementRows): ReadonlyMap<StatementRow, BookedTwin<Transaction>> {
  const keysHit = new Set(statement.rows.map(rowKey))
  const others = book.transactions.filter((row) => row.importKey !== '' && row.statement !== statement.label && !keysHit.has(rowKey(row)))
  const twins = new Map<StatementRow, BookedTwin<Transaction>>()
  const sourceOfRow = (row: Pick<StatementRow, 'importKey'>) => (statement.transcribed !== undefined ? 'copied' : isBankSyncKey(row.importKey) ? 'sync' : 'file')
  for (const group of new Set(rows.map((row) => `${row.account} ${sourceOfRow(row)}`))) {
    const ofGroup = rows.filter((row) => `${row.account} ${sourceOfRow(row)}` === group)
    const { account } = ofGroup[0]!
    const source = sourceOfRow(ofGroup[0]!)
    const copied = ofGroup.map(bookingOf)
    const onFile = others.filter((row) => row.account === account && (source === 'copied' || rowSource(row.importKey) !== source)).map(bookingOf)
    for (const [{ row }, twin] of bookedTwins(copied, onFile)) twins.set(row, { kind: twin.kind, booked: twin.booked.row })
  }
  return twins
}

/** One note per account for the rows the other source's days left out. */
function otherSourceNotes(rows: readonly StatementRow[], days: ReadonlyMap<RecordId, SourceDays>, accounts: ReadonlyMap<RecordId, Account>): readonly string[] {
  return [...new Set(rows.map((row) => row.account))].map((account) => {
    const ofAccount = rows.filter((row) => row.account === account)
    const name = accounts.get(account)?.name ?? ''
    const { lastFileDay, firstSyncDay } = days.get(account)!
    const forms = isBankSyncKey(ofAccount[0]!.importKey) ? words.coveredByFile(ofAccount.length, name, dayLabel(lastFileDay!)) : words.coveredBySync(ofAccount.length, name, dayLabel(firstSyncDay!))
    return plural(forms, ofAccount.length)
  })
}

/**
 * Works out a statement against the file, row by row: a row before its account opened is left out, as the entry dialog
 * refuses one, and a row whose key is on the account is skipped. Each account's days belong to one source, so a bank sync
 * row on or before the last day a file covers is left out, and so is a file's row from the sync's first day on, since a sync
 * may hold a file's fee inside a row. Past those days a file's or a sync's row is matched against the rows of the other two
 * sources, as copied rows are below, since two sources may date one booking on different days. One of the same day, amount and
 * counterparty is already in. One that only looks like one waits for the person to say whether to keep both or let the file's
 * row take the other's place, keeping its id, category and note, or keeping the bank's key when the other came from the sync.
 * Or the row Kuna has stays and takes the file's key, so a later read of the file finds it, or keeps the bank's key and takes
 * the file's day, payee and text when it came from the sync.
 * A sync's row that looks like one is put on hold on To review, and one already on hold by its key stays there. The rows the days leave out are matched first, so each takes its own twin. Else a row of the same money as a typed row fills it, and any other row is new, filed by the reader or the first rule that holds, or waiting on review. A row near a typed row waits
 * whatever a rule says, since filing it would count that money twice until you noticed. A row that moves money
 * between your accounts fills only a typed transfer leg, and a row the reader filed fills nothing. Then the new rows and the
 * unpaired rows from 30 days back are paired into transfers. A new row that takes cash out, as the bank's row type or the rule
 * that files it says, goes under Between my accounts and comes in paired with its leg on the cash account its rule names or
 * the one cash account of its currency. With no such account, or several, it waits on To review for the person to say which.
 * A receipt that waited for the bank's row goes on a new row it clearly is, as `receiptsArriving` says, and files it.
 * `newKey` makes each new row's bare UUID.
 *
 * A statement that names the days it brings, such as a file for a gap the sync left, is taken for those days alone. On them no
 * day belongs to a source, so its rows are matched against the rows of the other sources as above, and each row the sync
 * already brought is already in or waits.
 *
 * Rows the AI copied off a statement carry keys no other source gives, so they are matched against the rows on the file from
 * another source instead, and no day belongs to a source for them. A row of the same day, amount and counterparty as one is
 * already in. A row that only looks like one waits, unless the person said to import it.
 */
export function statementDryRun(book: SpendingBook, statement: StatementRows, day: CivilDate, newKey: () => string = newRecordId): StatementDryRun {
  const accounts = new Map(book.accounts.map((account) => [account.id, account]))
  const onFile = new Set(book.transactions.filter((row) => row.importKey !== '').map(rowKey))
  const beforeOpening = (row: StatementRow): boolean => {
    const account = accounts.get(row.account)
    return account !== undefined && beforeStartDay(account, row.date)
  }
  const alreadyIn = (row: StatementRow): boolean => onFile.has(rowKey(row))
  const { days } = statement
  const outsideDays = (row: StatementRow): boolean => days !== undefined && !rangeContains(days, row.date)
  const notOnFile = statement.rows.filter((row) => !beforeOpening(row) && !alreadyIn(row) && !outsideDays(row))
  const sourceDays = sourceDaysOf(book.transactions)
  const coveredByOtherSource = (row: StatementRow): boolean => {
    const { lastFileDay, firstSyncDay } = sourceDays.get(row.account) ?? { lastFileDay: null, firstSyncDay: null }
    return isBankSyncKey(row.importKey) ? lastFileDay !== null && row.date <= lastFileDay : firstSyncDay !== null && row.date >= firstSyncDay
  }
  const { transcribed } = statement
  const otherSource = new Set<StatementRow>(transcribed === undefined && days === undefined ? notOnFile.filter(coveredByOtherSource) : [])
  const toMatch = notOnFile.filter((row) => !otherSource.has(row))
  const heldKeys = new Set(book.held.map(rowKey))
  const twins = twinsOnFile([...otherSource, ...toMatch], book, statement)
  const questions = toMatch.flatMap((row): TwinQuestion[] => {
    const twin = twins.get(row)
    if (transcribed !== undefined || twin?.kind !== 'like' || heldKeys.has(rowKey(row))) return []
    const answer = statement.twinAnswers?.get(rowKey(row))
    return [{ key: rowKey(row), row, booked: twin.booked, keep: answer?.booked === twin.booked.id ? answer.keep : null }]
  })
  const questionOf = new Map(questions.map((question) => [question.row, question]))
  const heldByKey = new Map(book.held.map((held) => [rowKey(held), held]))
  /** What a row's twin on the file makes of it, or null for a row that comes in. */
  const byTwin = (row: StatementRow): 'already-in' | 'look-alike' | 'replaced' | 'kept' | null => {
    const twin = twins.get(row)
    const question = questionOf.get(row)
    if (heldByKey.has(rowKey(row))) return 'look-alike'
    if (twin === undefined) return null
    if (question !== undefined) return question.keep === null ? 'look-alike' : question.keep === 'file' ? 'replaced' : question.keep === 'kept' ? 'kept' : null
    if (twin.kind === 'same') return 'already-in'
    return transcribed?.lookAlikes === 'import' ? null : 'look-alike'
  }
  const twinOutcome = new Map(toMatch.map((row) => [row, byTwin(row)]))
  const coming = toMatch.filter((row) => twinOutcome.get(row) === null)

  const context = spendingCategorisationContext(book)
  const transfer = transferCategoryOf(book.categories)?.id ?? null
  const isTransfer = filedAsTransfer(book.categories)
  const movesOwnMoney = (row: StatementRow): boolean => row.movedAt !== '' || context.ownIbans.has(normaliseIban(row.counterpartyIban))
  const itemsOf = rowItemsOf(book)
  const isTypedLeg = (typed: Transaction): boolean => typed.pair !== null || isTransfer(itemsOf(typed))
  const typedRows = typedRowsOf(book)
  const legsFilled = sameMoney(typedRows.filter(isTypedLeg), coming.filter(movesOwnMoney)).matches
  const legsTaken = new Set(legsFilled.map(({ typed }) => typed))
  const sameMoneyAsTyped = sameMoney(
    typedRows.filter((typed) => !legsTaken.has(typed)),
    coming.filter((row) => row.category === null && !movesOwnMoney(row)),
  )
  const matches = [...legsFilled, ...sameMoneyAsTyped.matches]
  const nearTyped = new Set(sameMoneyAsTyped.near.map(({ bank }) => bank))
  const typedOf = new Map(matches.map(({ typed, bank }) => [bank, typed]))
  const filledRows: RowChange[] = matches.map(({ typed, bank }) => ({ before: typed, after: filledByBank(typed, { ...bank, statement: statement.label }) }))

  const ruleOf = decidingRule(book.rules, book)
  const newRowOf = new Map<StatementRow, ItemizedRow>(
    coming
      .filter((row) => !typedOf.has(row))
      .map((row) => {
        const unfiled = row.category === null && !nearTyped.has(row)
        const byBank = unfiled && row.cashWithdrawal ? transfer : null
        const byRule = unfiled && byBank === null ? (ruleOf(row)?.category ?? null) : null
        const { category, ...facts } = row
        const added: Transaction = {
          ...facts,
          id: recordIdOf(TRANSACTION_RECORDS, newKey()),
          source: 'statement',
          pair: null,
          statement: statement.label,
          categorisedBy: byRule === null ? null : 'rule',
        }
        return [row, { row: added, items: [wholeItemOf(added, { category: category ?? byBank ?? byRule, note: '', link: null })] }]
      }),
  )
  const newItemsOf = new Map([...newRowOf.values()].map(({ row, items }) => [row.id, items]))
  const itemsAt = (row: Transaction): readonly TransactionItem[] => newItemsOf.get(row.id) ?? itemsOf(row)

  const byId = new Map(book.transactions.map((row) => [row.id, row]))
  /** The row on the file a waiting row looks like: the one its hold names, or its twin. */
  const likeOf = (row: StatementRow): Transaction => {
    const onHold = heldByKey.get(rowKey(row))
    return (onHold === undefined ? undefined : byId.get(onHold.like)) ?? twins.get(row)!.booked
  }
  const replacing = toMatch.filter((row) => twinOutcome.get(row) === 'replaced' || twinOutcome.get(row) === 'kept')
  const replacedOf = new Map(
    replacing.map((row) => {
      const booked = twins.get(row)!.booked
      const after = isBankSyncKey(booked.importKey)
        ? { ...booked, date: row.date, payee: row.payee, description: row.description }
        : twinOutcome.get(row) === 'kept'
          ? { ...booked, importKey: row.importKey }
          : { ...filledByBank(booked, { ...row, statement: statement.label }), payee: row.payee }
      return [booked, after] as const
    }),
  )
  const since = addDays([day, ...coming.map((row) => row.date)].sort()[0]!, -PAIRING_DAYS)
  const onFileToPair = book.transactions.filter((row) => row.date >= since && isPairable(row)).map((row) => replacedOf.get(row) ?? row)
  const asTransfers = transfer === null ? new Map<Transaction, ItemizedRow>() : transferred([...newRowOf.values()].map(({ row }) => row).concat(onFileToPair), book, transfer, isTransfer, itemsAt)

  const comingIn = [...newRowOf.values()].map((itemized) => asTransfers.get(itemized.row) ?? itemized)
  const withdrawals = comingIn.filter(({ row, items }) => isTransfer(items) && isWithdrawal(row, ruleOf(row), book.accounts))
  const cashLegs = new Map(
    withdrawals.flatMap((itemized) => {
      const [cash, ...others] = cashAccountsFor(itemized.row, ruleOf(itemized.row)?.withdrawal?.cashAccount ?? null, book.accounts)
      return cash === undefined || others.length > 0 ? [] : [[itemized, withCashLeg(itemized, cash, transfer!, newKey)] as const]
    }),
  )
  const arriving = comingIn.flatMap((itemized) => cashLegs.get(itemized) ?? [itemized])
  const receipts = receiptsArriving(book, arriving, receiptWords.difference, newKey)
  const filedByReceipt = new Map(receipts.map((placed): [Transaction, ItemizedRow] => [placed.before, { row: placed.row, items: placed.items }]))
  const added = arriving.map((itemized) => filedByReceipt.get(itemized.row) ?? itemized)
  const replacedRows: RowChange[] = [...replacedOf].map(([before, replaced]) => {
    const paired = asTransfers.get(replaced)
    return paired === undefined ? { before, after: replaced } : { before, after: paired.row, items: paired.items }
  })
  const replacements = new Set(replacedOf.values())
  const pairedOnFile = onFileToPair.flatMap((before): RowChange[] => {
    const after = asTransfers.get(before)
    return after === undefined || replacements.has(before) ? [] : [{ before, after: after.row, items: after.items }]
  })
  const categoryOf = (items: readonly TransactionItem[]): RecordId | null => (items.length === 0 ? null : mainCategoryOf(items))

  const fileLines = statement.rows.map((row): DryRunLine => {
    if (beforeOpening(row)) return { row, outcome: 'before-opening', category: null }
    const byItsTwin = twinOutcome.get(row)
    if (alreadyIn(row) || byItsTwin === 'already-in' || byItsTwin === 'kept') return { row, outcome: 'already-in', category: null }
    if (outsideDays(row)) return { row, outcome: 'outside-days', category: null }
    if (otherSource.has(row)) return { row, outcome: 'other-source', category: null }
    if (byItsTwin === 'look-alike') return { row, outcome: 'look-alike', category: null, like: likeOf(row) }
    if (byItsTwin === 'replaced') {
      const like = twins.get(row)!.booked
      const replaced = replacedRows.find(({ before }) => before === like)!
      return { row, outcome: 'replaced', category: categoryOf(replaced.items ?? itemsOf(like)), like }
    }
    const typed = typedOf.get(row)
    if (typed !== undefined) return { row, outcome: 'filled', category: categoryOf(itemsOf(typed)) }
    const fresh = newRowOf.get(row)!
    const after = asTransfers.get(fresh.row) ?? fresh
    const filed = filedByReceipt.get(after.row) ?? after
    return { row, outcome: 'new', category: categoryOf(filed.items), withdrawal: withdrawals.includes(after) ? { cashLeg: cashLegs.get(after)?.[1].row ?? null } : null }
  })
  const held = fileLines.flatMap((line): HeldBankRow[] =>
    line.outcome === 'look-alike' && isBankSyncKey(line.row.importKey) && !heldKeys.has(rowKey(line.row))
      ? [
          {
            id: recordIdOf(HELD_ROW_RECORDS, newKey()),
            account: line.row.account,
            date: line.row.date,
            amount: line.row.amount,
            payee: line.row.payee,
            description: line.row.description,
            counterpartyIban: line.row.counterpartyIban,
            importKey: line.row.importKey,
            like: line.like.id,
          },
        ]
      : [],
  )
  const lines = [
    ...fileLines,
    ...pairedOnFile.map(({ before, items }): DryRunLine => ({ row: { ...before, category: categoryOf(itemsOf(before)) }, outcome: 'refiled', category: categoryOf(items ?? itemsOf(before)) })),
  ]
  const leftOut = lines.filter((line) => line.outcome === 'before-opening').length
  const outside = lines.filter((line) => line.outcome === 'outside-days').length
  const wanting = added.filter(({ row }) => wantsSavingsAccount(row, book.accounts)).length
  const wantingCash = withdrawals.length - cashLegs.size
  return {
    lines,
    questions,
    added: added.map(({ row }) => row),
    items: added.flatMap(({ items }) => items),
    receipts,
    held,
    changed: [...filledRows, ...replacedRows, ...pairedOnFile],
    newRows: comingIn.length,
    alreadyIn: lines.filter((line) => line.outcome === 'already-in').length,
    filled: filledRows.length,
    notes: [
      ...statement.notes,
      ...(leftOut === 0 ? [] : [plural(words.beforeOpeningLeftOut(leftOut), leftOut)]),
      ...(outside === 0 || days === undefined ? [] : [plural(words.outsideDaysLeftOut(outside, dayLabel(days.from), dayLabel(days.to)), outside)]),
      ...(wanting === 0 ? [] : [plural(words.pocketsWaiting(wanting), wanting)]),
      ...(wantingCash === 0 ? [] : [plural(words.withdrawalsWaiting(wantingCash), wantingCash)]),
      ...otherSourceNotes([...otherSource], sourceDays, accounts),
    ],
  }
}

/** The file's rows as they stand once the dry run is written. */
export function rowsAfterDryRun(rows: readonly Transaction[], run: Pick<StatementDryRun, 'added' | 'changed'>): readonly Transaction[] {
  const changedTo = new Map(run.changed.map(({ before, after }) => [before, after]))
  return [...rows.map((row) => changedTo.get(row) ?? row), ...run.added]
}

/** Each row the pairing changes, as it becomes: a pair's leg, or a lone leg that counts as a transfer and waits. */
function transferred(
  rows: readonly Transaction[],
  book: Pick<SpendingBook, 'accounts'>,
  transfer: RecordId,
  isTransfer: (items: readonly TransactionItem[]) => boolean,
  itemsOf: (row: Transaction) => readonly TransactionItem[],
): ReadonlyMap<Transaction, ItemizedRow> {
  const { pairs, waiting } = transferPairs(rows, book.accounts, itemsOf)
  const changes = new Map<Transaction, ItemizedRow>()
  for (const { debit, credit } of pairs) {
    const [debitLeg, creditLeg] = legsOfPair({ row: debit, items: itemsOf(debit) }, { row: credit, items: itemsOf(credit) }, transfer)
    changes.set(debit, debitLeg)
    changes.set(credit, creditLeg)
  }
  for (const row of waiting) {
    const items = itemsOf(row)
    if (!isTransfer(items)) changes.set(row, { row: { ...row, categorisedBy: null }, items: refiledItems(items, transfer) })
  }
  return changes
}
