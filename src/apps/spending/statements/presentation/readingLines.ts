import { leftOutLine } from './leftOutLines'
import { words } from './readingWords'
import type { CroatianForms, EnglishForms } from '../../../../shared/text/translation'
import type { StatementDryRun } from '../domain/statementDryRun'
import type { DraftedAccount, FileNote, StatementRefusal } from '../domain/statementRows'
import type { Account } from '../../workbook/domain/account'
import { formatAccountMoney } from '../../../../shared/money/moneyFormat'
import { listInWords } from '../../../../shared/text/listInWords'
import { plural } from '../../../../shared/text/translation'

/** What to add to bring in the rows the drafted accounts would keep, of the bank the file's recipe names: the whole file when it was refused for them, else the savings rows left out. */
export function addMissingAccounts(missing: readonly DraftedAccount[], rows: 'file' | 'savings'): string {
  const phrase = (kind: Account['kind'], forms: (count: number, bank: string, currencies: string) => EnglishForms | CroatianForms): string[] => {
    const drafts = missing.filter(({ account }) => account.kind === kind).map(({ account }) => account)
    return drafts.length === 0 ? [] : [plural(forms(drafts.length, drafts[0]!.bank ?? '', listInWords(drafts.map((account) => account.currency))), drafts.length)]
  }
  const accounts = listInWords([...phrase('bank', words.refused.bankAccounts), ...phrase('savings', words.refused.savingsAccounts)])
  return rows === 'file' ? words.refused.addToBringIn(accounts) : words.refused.addToBringInSavings(accounts)
}

/** Why a reader read nothing of a file, as a sentence. */
export function refusalLine(refusal: StatementRefusal, missing: readonly DraftedAccount[]): string {
  switch (refusal.kind) {
    case 'no-column':
      return words.refused.noColumn(refusal.column)
    case 'unreadable':
      if (refusal.reads === 'day') return words.refused.notADay(refusal.line, refusal.text)
      if (refusal.reads === 'amount') return words.refused.notAnAmount(refusal.line, refusal.text)
      return words.refused.notReadable(refusal.line, refusal.column, refusal.text)
    case 'no-kind':
      return words.refused.noKind(refusal.line)
    case 'not-a-currency':
      return words.refused.notACurrency(refusal.line, refusal.text)
    case 'many-accounts':
      return words.refused.manyAccounts(refusal.bank, refusal.names.join(', '), refusal.currency)
    case 'missing-accounts':
      return addMissingAccounts(missing, 'file')
    case 'no-recipe':
      return words.refused.noRecipe(listInWords(refusal.misses.map(({ recipe, column }) => words.refused.recipeMiss(recipe, column))))
  }
}

/** What a reader left out of a file or noticed in it, as a sentence. */
export function fileNoteLine(note: FileNote): string {
  switch (note.kind) {
    case 'not-completed':
      return plural(words.notes.notCompleted(note.count), note.count)
    case 'savings-left-out':
      return plural(words.notes.savingsLeftOut(note.count, note.currencies.join(', ')), note.count)
    case 'other-product':
      return plural(words.notes.otherProduct(note.count, note.product), note.count)
    case 'balance-differs':
      return words.notes.balanceDiffers(
        note.savings ? words.notes.products.savings : words.notes.products.current,
        formatAccountMoney(note.balance, note.currency),
        formatAccountMoney(note.worked, note.currency),
      )
    case 'zero-left-out':
      return plural(words.notes.zeroLeftOut(note.count, note.account), note.count)
    case 'unreadable-left-out':
      return plural(words.notes.unreadableLeftOut(note.count, note.account), note.count)
    case 'balance-not-read':
      return words.notes.balanceNotRead(note.accounts, note.reason)
    case 'other-currency-left-out':
      return plural(words.notes.otherCurrencyLeftOut(note.count, note.currency), note.count)
  }
}

/** What a dry run says beside its rows: what the file left out or noticed, what the dry run left out, then what else it did. */
export function dryRunNotes(dryRun: Pick<StatementDryRun, 'fileNotes' | 'leftOut' | 'notes'>, accounts: readonly Pick<Account, 'id' | 'name'>[]): readonly string[] {
  return [...dryRun.fileNotes.map(fileNoteLine), ...dryRun.leftOut.map((leftOut) => leftOutLine(leftOut, accounts)), ...dryRun.notes]
}
