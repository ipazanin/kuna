import { fieldsOf, madeOrRefused, textOrKept } from './companyCard'
import type { CompanyCard, CompanyOperationSet } from './companyCard'
import { accountUses, writeAccounts } from '../../settings/application/accountWrites'
import { NEW_ACCOUNT_DRAFT, accountDraftErrors, accountDraftsOf, accountsOfDrafts } from '../../settings/domain/accountDrafts'
import type { AccountDraft } from '../../settings/domain/accountDrafts'
import { ACCOUNT_RECORDS } from '../../workbook/domain/coreKinds'
import { recordsOfKindIn } from '../../workbook/domain/readWorkbook'
import { COMPANY_SOURCES } from '../../workbook/domain/workbook'
import type { AssistantOperation, ProposalStep } from '../../../../shared/app/assistantOperations'
import { TEXT, TEXT_OR_NULL, inputOf } from '../../../../shared/app/operationInput'
import { datedPeriodsRefusal, periodsOfText } from '../../../../shared/app/accountSource'
import { draftsOfPeriods } from '../../../../shared/app/periodDrafts'
import { parseCivilDate } from '../../../../shared/calendar/civilDate'
import { StepRefused } from '../../../../shared/app/proposedWrites'
import { storedOf } from '../../../../shared/storage/domain/recordsRead'
import type { StoredRecord } from '../../../../shared/storage/domain/recordsRead'

const ACCOUNT = ACCOUNT_RECORDS.name

const BANK_ABOUT = 'The bank is any name, as the person writes it. A table recipe of Import finds its account by bank and currency.'

const ROWS_FROM_ABOUT =
  "sources lists where its rows come from, in order, each later one followed by the day it takes over, such as by-hand, mail 2026-03-01, and null is by-hand on add-account and keeps them on change-account. The first may carry its own day, before which the account takes no row, and mail first needs it, as the mail search starts there. mail: each sync reads the bank's statements from the bank's mail. provider-file: the bank's camt file brought on Import or in the chat. by-hand: its sheets, its camt files and the chat's copies. A day each source fills takes no row from another, and no day may reach one whose VAT return is filed."

const OPERATIONS: readonly AssistantOperation[] = [
  {
    name: 'add-account',
    about: `A new bank account as Settings, Accounts adds it: a short name in lower case with hyphens, a name on screen, its IBAN, its currency or "" for the books' own, and the bank that keeps it or "". ${ROWS_FROM_ABOUT} ${BANK_ABOUT}`,
    input: inputOf({ account: TEXT, label: TEXT, iban: TEXT, currency: TEXT, bank: TEXT, sources: TEXT_OR_NULL }),
    refs: {},
    creates: ACCOUNT,
    alone: false,
    example: { account: 'savings', label: 'Savings', iban: 'HR1210010051863000160', currency: '', bank: 'Example banka', sources: null },
  },
  {
    name: 'change-account',
    about: `Changes an account's short name, name on screen, IBAN, currency, bank or where its rows come from. An account ledger rows name keeps its short name and IBAN. Null leaves a field as it is. ${ROWS_FROM_ABOUT} The rows another source brought on the days a change gives away go, with what the card lists, as Settings, Accounts takes them out, and the new source brings its own. Undo puts them back until it does. ${BANK_ABOUT}`,
    input: inputOf({
      account: TEXT,
      name: TEXT_OR_NULL,
      label: TEXT_OR_NULL,
      iban: TEXT_OR_NULL,
      currency: TEXT_OR_NULL,
      bank: TEXT_OR_NULL,
      sources: TEXT_OR_NULL,
    }),
    refs: { account: ACCOUNT },
    creates: null,
    alone: false,
    example: { account: 'account', name: null, label: 'Main account', iban: null, currency: null, bank: null, sources: null },
  },
  {
    name: 'delete-account',
    about: 'Deletes an account no ledger row names.',
    input: inputOf({ account: TEXT }),
    refs: { account: ACCOUNT },
    creates: null,
    alone: false,
    example: { account: 'account-unused' },
  },
]

/** Saves the accounts as Settings, Accounts saves its editor's rows, after its checks, with the rows a handover takes out. */
function saveAccounts(card: CompanyCard, edit: (drafts: readonly AccountDraft[]) => readonly AccountDraft[]): void {
  const records = card.records()
  const stored: readonly StoredRecord<unknown>[] = storedOf(records.accounts)
  const drafts = edit(accountDraftsOf(stored, card.workbook.accounts))
  const used = new Set(accountUses((kind) => recordsOfKindIn(records, kind)).keys())
  writeAccounts(card.unit, { records, workbook: card.workbook }, storedOf(records.accounts), madeOrRefused(accountDraftErrors(drafts, used), accountsOfDrafts(stored, drafts)))
}

function accountAt(drafts: readonly AccountDraft[], slug: string): number {
  const at = drafts.findIndex((draft) => draft.savedName.trim().toLowerCase() === slug)
  if (at < 0) throw new StepRefused('That account is no longer in the books.')
  return at
}

/** The periods a step lists, as the accounts editor would hold them, or `kept` on null. */
function sourcesField(text: string | null, kept: AccountDraft['periods']): AccountDraft['periods'] {
  if (text === null) return kept
  const periods = periodsOfText(text, COMPANY_SOURCES, parseCivilDate, 'may-have-day')
  if (periods === null || datedPeriodsRefusal(periods, ['mail']) !== null)
    throw new StepRefused(`Write sources as ${COMPANY_SOURCES.join(', ')} in order, each later one followed by the day it takes over, and mail first with its day, such as by-hand, mail 2026-03-01.`)
  return draftsOfPeriods(periods)
}

function addAccount(card: CompanyCard, step: ProposalStep): void {
  const field = fieldsOf(step)
  const slug = String(field['account']).trim().toLowerCase()
  const periods = sourcesField(field['sources'] ?? null, NEW_ACCOUNT_DRAFT.periods)
  saveAccounts(card, (drafts) => [...drafts, { ...NEW_ACCOUNT_DRAFT, account: slug, label: field['label']!, iban: field['iban']!, currency: field['currency']!, bank: field['bank']!, periods }])
  card.made(step.as, slug)
}

function changeAccount(card: CompanyCard, step: ProposalStep): void {
  const field = fieldsOf(step)
  const slug = card.idOf(field['account']).toLowerCase()
  saveAccounts(card, (drafts) => {
    const at = accountAt(drafts, slug)
    const before = drafts[at]!
    const after: AccountDraft = {
      ...before,
      account: textOrKept(field['name'], before.account),
      label: textOrKept(field['label'], before.label),
      iban: textOrKept(field['iban'], before.iban),
      currency: textOrKept(field['currency'], before.currency),
      bank: textOrKept(field['bank'], before.bank),
      periods: sourcesField(field['sources'] ?? null, before.periods),
    }
    return drafts.map((draft, place) => (place === at ? after : draft))
  })
}

function deleteAccount(card: CompanyCard, step: ProposalStep): void {
  const slug = card.idOf(fieldsOf(step)['account']).toLowerCase()
  if (accountUses((kind) => recordsOfKindIn(card.records(), kind)).has(slug)) throw new StepRefused('Ledger rows name that account, so it stays.')
  saveAccounts(card, (drafts) => drafts.filter((_, place) => place !== accountAt(drafts, slug)))
}

const PLANS: Readonly<Record<string, (card: CompanyCard, step: ProposalStep) => void>> = {
  'add-account': addAccount,
  'change-account': changeAccount,
  'delete-account': deleteAccount,
}

/** What the chat can do to Company's bank accounts, through Settings, Accounts' own drafts and writes. */
export const ACCOUNT_OPERATIONS: CompanyOperationSet = {
  operations: OPERATIONS,
  planStep: (card, step) => PLANS[step.operation]!(card, step),
}
