import { rulesOutcome, spendingCategorisationContext } from './spendingCategorisation'
import type { RuledRow } from './spendingCategorisation'
import type { RowChange } from './spendingCategorisation'
import { leftOutOf } from './leftOut'
import type { LeftOut } from './leftOut'
import { isBankSyncKey } from './statementRows'
import type { FileNote, StatementRow, StatementRows } from './statementRows'
import { heldRowsOf, twinRowsOf } from './twinRows'
import { filledByBank, pendingBooking } from './bankBooking'
import type { TwinQuestion } from './twinRows'
import { words } from './words'
import { sameMoney, typedRowsOf } from '../../pairing/domain/sameMoney'
import { cashAccountsFor, isWithdrawal, withCashLeg } from '../../pairing/domain/cashWithdrawals'
import { wantsSavingsAccount } from '../../pairing/domain/wantsSavingsAccount'
import { instalmentOffers } from '../../links/domain/instalmentOffers'
import { linkedEntry, ruleLinkWaits, ruleLinking } from '../../links/domain/linkFiling'
import type { RuleLinks, LinkedEntry } from '../../links/domain/linkFiling'
import type { AssetTarget, InstalmentTarget } from '../../links/domain/linkTarget'
import { receiptsArriving } from '../../receipts/domain/waitingReceipts'
import type { PlacedReceipt } from '../../receipts/domain/waitingReceipts'
import { words as receiptWords } from '../../receipts/domain/words'
import { isPairable, legsOfPair, transferPairs } from '../../pairing/domain/transferPairs'
import { refusedOnAccount } from '../../entries/domain/bankRows'
import { beforeStartDay } from '../../workbook/domain/account'
import { transferCategoryOf } from '../../workbook/domain/category'
import type { Category } from '../../workbook/domain/category'
import type { Account } from '../../workbook/domain/account'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import type { Receipt } from '../../workbook/domain/receipt'
import { droppedRowOf } from '../../workbook/domain/droppedRow'
import type { DroppedRow } from '../../workbook/domain/droppedRow'
import type { HeldBankRow } from '../../workbook/domain/heldBankRow'
import { rowLinkText } from '../../workbook/domain/rowLink'
import type { SpendingRule } from '../../workbook/domain/spendingRule'
import { DROPPED_ROW_RECORDS, TRANSACTION_RECORDS } from '../../workbook/domain/spendingKinds'
import { rowKey } from '../../workbook/domain/transaction'
import type { Transaction } from '../../workbook/domain/transaction'
import { filedAsTransfer, refiledItems, rowItemsOf, wholeItemOf } from '../../workbook/domain/rowItems'
import type { ItemizedRow } from '../../workbook/domain/rowItems'
import type { TransactionItem } from '../../workbook/domain/transactionItem'
import { mainCategoryOf } from '../../../../shared/categorising/domain/mainCategory'
import { addDays } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { rangeContains } from '../../../../shared/calendar/dateRange'
import { EURO } from '../../../../shared/money/currencyCode'
import { newRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { normaliseIban } from '../../../../shared/text/fold'
import { plural } from '../../../../shared/text/translation'

/** How far before today and before the statement's oldest new row the pairing looks for the other leg among rows on the file. */
const PAIRING_DAYS = 30

/**
 * What happens to a row: `before-opening` is left out, `not-taken` left out since another source fills its day on its account, `already-in` skipped, `outside-days` left out since the person named days
 * the file brings that leave it out, `look-alike` waits since it looks like a row on the file from another source, `filled` joins a
 * typed row, `booked` takes the place of a row on the file the bank had not booked yet, `replaced` takes the place of such a row on the person's word, `new` is added, and `refiled` is a row already on the file that
 * the pairing changes.
 */
export type DryRunOutcome = 'before-opening' | 'not-taken' | 'already-in' | 'outside-days' | 'look-alike' | 'filled' | 'booked' | 'replaced' | 'new' | 'refiled'

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
      /** The category it ends up with, null while it waits on review, and for a row an instalment splits the one its interest goes under. */
      readonly category: RecordId | null
      /** For cash taken out, its leg on the cash account, or null while it waits on To review for the account. Null for any other row. */
      readonly withdrawal: { readonly cashLeg: Transaction | null } | null
      /** The instalment in Loans the row pays or the asset a rule links it to, which the import links it to, and the parts the row comes in as. Absent on a row linked to neither, or to an asset Assets cannot show now. */
      readonly pays?: { readonly target: InstalmentTarget | AssetTarget; readonly parts: readonly TransactionItem[] }
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

/** How many rows the bank had not booked yet a statement books, and those it no longer lists, which go with their items and receipts. */
export interface PendingOutcome {
  readonly booked: number
  readonly gone: readonly Transaction[]
  readonly goneReceipts: readonly Receipt[]
  /** A note for each gone row you had filed, which To review keeps until you press OK. */
  readonly dropped: readonly DroppedRow[]
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
  /** The categories the links to Loans need that the file lacks, added in the same write. Absent when they need none. */
  readonly categories?: readonly Category[]
  /** The sync's rows that look like rows Kuna has, put on hold on To review until the person answers. */
  readonly held: readonly HeldBankRow[]
  /** The rows on the file that change: typed rows a bank row filled, rows the bank booked, and rows that became a transfer's leg or stopped being one. */
  readonly changed: readonly RowChange[]
  /** What the statement did to the rows on the file the bank had not booked yet. Absent when it booked none and none went. */
  readonly pending?: PendingOutcome
  readonly newRows: number
  readonly alreadyIn: number
  readonly filled: number
  /** What the reader left out of the file or noticed in it. */
  readonly fileNotes: readonly FileNote[]
  /** The rows the dry run leaves out, per account and why. */
  readonly leftOut: readonly LeftOut[]
  /** The accounts it adds rows to whose periods the book worked out from a file from before periods, which the import stores with its rows. */
  readonly sourcesStored: readonly Account[]
  readonly notes: readonly string[]
}

/**
 * Works out a statement against the file, row by row: a row before its account opened is left out, as the entry dialog
 * refuses one, and a row whose key is on the account is skipped. Each day of an account takes its rows from the source of its
 * period, so a row from any other source is left out, as a sync may hold a file's fee inside a row. A left-out row of the file
 * or the sync still claims its twin first. A file's or a sync's row taken is matched against the rows of the other two
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
 * A new row Kuna suggests pays one of the instalments `links` names, as `instalmentOffers` has it, is linked to it and split
 * by it as a link from To review would be. With no `links`, as for the bank sync, nothing is linked, and such a row is offered
 * on To review. `newKey` makes each new row's bare UUID.
 *
 * A statement that names the days it brings, such as a file for a gap the sync left, is taken for those days alone. On them no
 * day belongs to a source, so its rows are matched against the rows of the other sources as above, and each row the sync
 * already brought is already in or waits.
 *
 * Rows the AI copied off a statement carry keys no other source gives, so they are matched against the rows on the file from
 * another source instead, and no day belongs to a source for them. A row of the same day, amount and counterparty as one is
 * already in. A row that only looks like one waits, unless the person said to import it.
 */
export function statementDryRun(book: SpendingBook, statement: StatementRows, day: CivilDate, links: RuleLinks | null = null, newKey: () => string = newRecordId): StatementDryRun {
  const accounts = new Map(book.accounts.map((account) => [account.id, account]))
  const onFile = new Set(book.transactions.filter((row) => row.importKey !== '').map(rowKey))
  const beforeOpening = (row: StatementRow): boolean => {
    const account = accounts.get(row.account)
    return account !== undefined && beforeStartDay(account, row.date)
  }
  const notTaken = (row: StatementRow): boolean => {
    const account = accounts.get(row.account)
    return account !== undefined && refusedOnAccount(row, account)
  }
  const alreadyIn = (row: StatementRow): boolean => onFile.has(rowKey(row))
  const { days } = statement
  const outsideDays = (row: StatementRow): boolean => days !== undefined && !rangeContains(days, row.date)
  const comingAtAll = statement.rows.filter((row) => !beforeOpening(row) && !notTaken(row) && !alreadyIn(row) && !outsideDays(row))
  const itemsOf = rowItemsOf(book)
  const outcomeOf = rulesOutcome(book.rules, book)
  const ruleOf = (row: RuledRow): SpendingRule | null => outcomeOf(row).filing
  /** The category of the rule that files a row, as a new row takes it, and the labels the rules give it. */
  const filingOf = (row: RuledRow): { readonly category: RecordId | null; readonly labels: readonly RecordId[] } => {
    const { filing: rule, labelling } = outcomeOf(row)
    return { category: rule === null || (rule.link !== null && ruleLinkWaits(rule.link, links)) ? null : rule.category, labels: labelling?.labels ?? [] }
  }
  const booking = pendingBooking(book.transactions, comingAtAll, statement, { itemsOf, filing: filingOf, difference: receiptWords.difference, newKey })
  const bookedBy = new Map(booking.booked.map((booked) => [booked.row, booked.change]))
  const notOnFile = comingAtAll.filter((row) => !bookedBy.has(row))
  const { transcribed } = statement
  const otherSource = transcribed === undefined && days === undefined ? statement.rows.filter((row) => !beforeOpening(row) && notTaken(row) && !alreadyIn(row)) : []
  const { questions, outcomeOf: twinOutcomeOf, twinOf, likeOf } = twinRowsOf(otherSource, notOnFile, book, statement)
  const coming = notOnFile.filter((row) => twinOutcomeOf(row) === null)

  const context = spendingCategorisationContext(book)
  const transfer = transferCategoryOf(book.categories)?.id ?? null
  const isTransfer = filedAsTransfer(book.categories)
  const movesOwnMoney = (row: StatementRow): boolean => row.movedAt !== '' || context.ownIbans.has(normaliseIban(row.counterpartyIban))
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

  const newRowOf = new Map<StatementRow, ItemizedRow>(
    coming
      .filter((row) => !typedOf.has(row))
      .map((row) => {
        const unfiled = row.category === null && !nearTyped.has(row)
        const byBank = unfiled && row.cashWithdrawal ? transfer : null
        const { category: byRule, labels } = unfiled && byBank === null ? filingOf(row) : { category: null, labels: [] }
        const { category, ...facts } = row
        const added: Transaction = {
          ...facts,
          id: recordIdOf(TRANSACTION_RECORDS, newKey()),
          source: 'statement',
          pair: null,
          statement: statement.label,
          categorisedBy: byRule === null ? null : 'rule',
        }
        return [row, { row: added, items: [wholeItemOf(added, { category: category ?? byBank ?? byRule, note: '', link: null, labels, ruleLabels: labels })] }]
      }),
  )
  const newItemsOf = new Map([...[...newRowOf.values()].map(({ row, items }) => [row.id, items] as const), ...booking.booked.map(({ change }) => [change.after.id, change.items] as const)])
  const itemsAt = (row: Transaction): readonly TransactionItem[] => newItemsOf.get(row.id) ?? itemsOf(row)

  const replacing = notOnFile.filter((row) => twinOutcomeOf(row) === 'replaced' || twinOutcomeOf(row) === 'kept')
  const replacedOf = new Map(
    replacing.map((row) => {
      const booked = twinOf(row)
      const after = isBankSyncKey(booked.importKey)
        ? { ...booked, date: row.date, payee: row.payee, description: row.description }
        : twinOutcomeOf(row) === 'kept'
          ? { ...booked, importKey: row.importKey }
          : { ...filledByBank(booked, { ...row, statement: statement.label }), payee: row.payee }
      return [booked, after] as const
    }),
  )
  const since = addDays([day, ...coming.map((row) => row.date)].sort()[0]!, -PAIRING_DAYS)
  const gone = new Set(booking.gone)
  const bookedTo = new Map(booking.booked.map(({ change }) => [change.before, change.after]))
  const unpairedTo = new Map(booking.unpaired.map(({ before, after }) => [before, after]))
  const onFileToPair = book.transactions.filter((row) => row.date >= since && isPairable(row) && !gone.has(row)).map((row) => replacedOf.get(row) ?? bookedTo.get(row) ?? unpairedTo.get(row) ?? row)
  const asTransfers = transfer === null ? new Map<Transaction, ItemizedRow>() : transferred([...newRowOf.values()].map(({ row }) => row).concat(onFileToPair), book, transfer, isTransfer, itemsAt)

  const comingIn = [...newRowOf.values()].map((itemized) => asTransfers.get(itemized.row) ?? itemized)
  const withdrawals = comingIn.filter(({ row, items }) => isTransfer(items) && isWithdrawal(row, ruleOf(row), book.accounts))
  const cashLegs = new Map(
    withdrawals.flatMap((itemized) => {
      const [cash, ...others] = cashAccountsFor(itemized.row, ruleOf(itemized.row)?.withdrawal?.cashAccount ?? null, book.accounts)
      return transfer === null || cash === undefined || others.length > 0 ? [] : [[itemized, withCashLeg(itemized, cash, transfer, newKey)] as const]
    }),
  )
  const arriving = comingIn.flatMap((itemized) => cashLegs.get(itemized) ?? [itemized])
  const receipts = receiptsArriving(book, arriving, receiptWords.difference, newKey)
  const filedByReceipt = new Map(receipts.map((placed): [Transaction, ItemizedRow] => [placed.before, { row: placed.row, items: placed.items }]))
  const filed = arriving.map((itemized) => filedByReceipt.get(itemized.row) ?? itemized)
  const replacedRows: RowChange[] = [...replacedOf].map(([before, replaced]) => {
    const paired = asTransfers.get(replaced)
    return paired === undefined ? { before, after: replaced } : { before, after: paired.row, items: paired.items }
  })
  const bookedRows = [...booking.booked.map(({ change }) => change), ...booking.unpaired].map(({ before, after, items }): RowChange => {
    const paired = asTransfers.get(after)
    return paired === undefined ? { before, after, ...(items === undefined ? {} : { items }) } : { before, after: paired.row, items: paired.items }
  })
  const replacements = new Set([...replacedOf.values(), ...bookedTo.values(), ...unpairedTo.values()])
  const pairedOnFile = onFileToPair.flatMap((before): RowChange[] => {
    const after = asTransfers.get(before)
    return after === undefined || replacements.has(before) ? [] : [{ before, after: after.row, items: after.items }]
  })
  const changed = [...filledRows, ...bookedRows, ...replacedRows, ...pairedOnFile]
  const linked = links === null ? null : ruleLinkedRows(book, { added: filed, changed, gone: booking.gone, receipts }, links, ruleOf, day, newKey)
  const added = filed.map((itemized) => linked?.rows.get(itemized.row.id)?.entry ?? itemized)
  const categoryOf = (items: readonly TransactionItem[]): RecordId | null => (items.length === 0 ? null : mainCategoryOf(items))

  const fileLines = statement.rows.map((row): DryRunLine => {
    if (beforeOpening(row)) return { row, outcome: 'before-opening', category: null }
    const byItsTwin = twinOutcomeOf(row)
    const twinIn = alreadyIn(row) || byItsTwin === 'already-in' || byItsTwin === 'kept'
    if (notTaken(row)) return { row, outcome: twinIn ? 'already-in' : 'not-taken', category: null }
    const booked = bookedBy.get(row)
    if (booked !== undefined) return { row, outcome: 'booked', category: categoryOf(bookedRows.find(({ before }) => before === booked.before)?.items ?? booked.items) }
    if (twinIn) return { row, outcome: 'already-in', category: null }
    if (outsideDays(row)) return { row, outcome: 'outside-days', category: null }
    if (byItsTwin === 'look-alike') return { row, outcome: 'look-alike', category: null, like: likeOf(row) }
    if (byItsTwin === 'replaced') {
      const like = twinOf(row)
      const replaced = replacedRows.find(({ before }) => before === like)!
      return { row, outcome: 'replaced', category: categoryOf(replaced.items ?? itemsOf(like)), like }
    }
    const typed = typedOf.get(row)
    if (typed !== undefined) return { row, outcome: 'filled', category: categoryOf(itemsOf(typed)) }
    const fresh = newRowOf.get(row)!
    const after = asTransfers.get(fresh.row) ?? fresh
    const byReceipt = filedByReceipt.get(after.row) ?? after
    const paying = linked?.rows.get(byReceipt.row.id)
    return {
      row,
      outcome: 'new',
      category: paying === undefined ? categoryOf(byReceipt.items) : (paying.interest ?? categoryOf(paying.entry.items)),
      withdrawal: withdrawals.includes(after) ? { cashLeg: cashLegs.get(after)?.[1].row ?? null } : null,
      ...(paying?.target == null ? {} : { pays: { target: paying.target, parts: paying.entry.items } }),
    }
  })
  const lookAlikes = fileLines.flatMap((line) => (line.outcome === 'look-alike' ? [line] : []))
  const held = heldRowsOf(
    lookAlikes.filter(({ row }) => !row.pending),
    book,
    newKey,
  )
  const pendingLookAlikes = lookAlikes.length - lookAlikes.filter(({ row }) => !row.pending).length
  const pending: PendingOutcome | null =
    booking.booked.length === 0 && booking.gone.length === 0
      ? null
      : {
          booked: booking.booked.length,
          gone: booking.gone,
          goneReceipts: book.receipts.filter((receipt) => receipt.transaction !== null && booking.gone.some((row) => row.id === receipt.transaction)),
          dropped: booking.gone.flatMap((row) => droppedRowOf(row, itemsOf(row), recordIdOf(DROPPED_ROW_RECORDS, newKey()), book) ?? []),
        }
  const lines = [
    ...fileLines,
    ...pairedOnFile.map(({ before, items }): DryRunLine => ({ row: { ...before, category: categoryOf(itemsOf(before)) }, outcome: 'refiled', category: categoryOf(items ?? itemsOf(before)) })),
  ]
  const rowsOf = (outcome: DryRunOutcome): readonly StatementRow[] => lines.filter((line) => line.outcome === outcome).map((line) => line.row)
  const wanting = added.filter(({ row }) => wantsSavingsAccount(row, book.accounts)).length
  const wantingCash = withdrawals.length - cashLegs.size
  return {
    lines,
    questions,
    added: added.map(({ row }) => row),
    items: added.flatMap(({ items }) => items),
    receipts,
    ...(linked === null || linked.categories.length === 0 ? {} : { categories: linked.categories }),
    held,
    changed,
    ...(pending === null ? {} : { pending }),
    newRows: comingIn.length,
    alreadyIn: lines.filter((line) => line.outcome === 'already-in').length,
    filled: filledRows.length,
    fileNotes: statement.fileNotes,
    leftOut: leftOutOf({ beforeOpening: rowsOf('before-opening'), notTaken: rowsOf('not-taken'), outsideDays: rowsOf('outside-days') }, accounts, days),
    sourcesStored: book.sourcesWorkedOut.filter((account) => added.some(({ row }) => row.account === account.id)),
    notes: [
      ...(wanting === 0 ? [] : [plural(words.pocketsWaiting(wanting), wanting)]),
      ...(wantingCash === 0 ? [] : [plural(words.withdrawalsWaiting(wantingCash), wantingCash)]),
      ...(booking.booked.length === 0 ? [] : [plural(words.pendingBooked(booking.booked.length), booking.booked.length)]),
      ...(booking.gone.length === 0 ? [] : [plural(words.pendingGone(booking.gone.length), booking.gone.length)]),
      ...(pendingLookAlikes === 0 ? [] : [plural(words.pendingLookAlikesWait(pendingLookAlikes), pendingLookAlikes)]),
    ],
  }
}

/** A new row linked to the instalment it pays or to the asset its rule names, null for an asset Assets cannot show now. */
type LinkedNewRow = Omit<LinkedEntry, 'added'> & { readonly target: InstalmentTarget | AssetTarget | null }

/**
 * Each new row a rule whose rows are linked to a record filed, linked to the asset or the instalment it is as `ruleLinking` says,
 * then once Loans can be read each new row Kuna suggests pays an instalment, as `instalmentOffers` reads the file once the dry
 * run is written, linked to it by its id, and the categories the links add, a category the first needs added once. A row and
 * an instalment are linked once, so the rule's link wins where both would link.
 */
function ruleLinkedRows(
  book: SpendingBook,
  run: { readonly added: readonly ItemizedRow[]; readonly changed: readonly RowChange[]; readonly gone: readonly Transaction[]; readonly receipts: readonly PlacedReceipt[] },
  links: RuleLinks,
  ruleOf: (row: Transaction) => SpendingRule | null,
  day: CivilDate,
  newKey: () => string,
): { readonly rows: ReadonlyMap<RecordId, LinkedNewRow>; readonly categories: readonly Category[] } {
  const { targets, language, notes } = links
  const currencies = new Map(book.accounts.map((account) => [account.id, account.currency]))
  const withReceipt = new Set(run.receipts.map(({ row }) => row.id))
  const linkedRecords = new Set(book.items.flatMap((item) => (item.link === null ? [] : [rowLinkText(item.link)])))
  let categories = book.categories
  const rows = new Map<RecordId, LinkedNewRow>()
  for (const entry of run.added) {
    const link = entry.row.categorisedBy === 'rule' && !withReceipt.has(entry.row.id) ? (ruleOf(entry.row)?.link ?? null) : null
    if (link === null) continue
    const place = { currency: currencies.get(entry.row.account) ?? EURO, categories, language, notes }
    const paying = ruleLinking(entry, link, links, linkedRecords, place, newKey)
    if (paying === null) continue
    const { added, ...linked } = paying
    if (paying.target?.kind === 'instalment') linkedRecords.add(rowLinkText(paying.target.link))
    categories = [...categories, ...added]
    rows.set(entry.row.id, linked)
  }
  if (targets === null) return { rows, categories: categories.slice(book.categories.length) }
  const ruleLinked = run.added.map((itemized) => rows.get(itemized.row.id)?.entry ?? itemized)
  const comingIn = new Map(ruleLinked.map((itemized) => [itemized.row.id, itemized]))
  const changedItems = new Map(run.changed.flatMap(({ before, items }) => (items === undefined ? [] : [[before.id, items] as const])))
  const after = {
    ...book,
    transactions: rowsAfterDryRun(book.transactions, { added: run.added.map(({ row }) => row), changed: run.changed }).filter((row) => !run.gone.includes(row)),
    items: [...book.items.filter((item) => item.transaction === null || !changedItems.has(item.transaction)), ...[...changedItems.values()].flat(), ...ruleLinked.flatMap(({ items }) => items)],
    receipts: [...book.receipts, ...run.receipts.map(({ receipt }) => receipt.after)],
  }
  for (const { row, target, suggested } of instalmentOffers(after, targets, day)) {
    const entry = comingIn.get(row.id)
    if (!suggested || entry === undefined) continue
    // `instalmentOffers` leaves out a row a receipt is on, so no row linked here has one.
    const { added, ...linked } = linkedEntry(entry, target, { currency: currencies.get(row.account) ?? EURO, categories, language, notes, receipt: false }, newKey)
    categories = [...categories, ...added]
    rows.set(row.id, { ...linked, target })
  }
  return { rows, categories: categories.slice(book.categories.length) }
}

/** The file's rows as they stand once the dry run is written. */
export function rowsAfterDryRun(rows: readonly Transaction[], run: Pick<StatementDryRun, 'added' | 'changed' | 'pending'>): readonly Transaction[] {
  const changedTo = new Map(run.changed.map(({ before, after }) => [before, after]))
  const gone = new Set(run.pending?.gone ?? [])
  return [...rows.filter((row) => !gone.has(row)).map((row) => changedTo.get(row) ?? row), ...run.added]
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
