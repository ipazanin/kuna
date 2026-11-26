import type { CompanyMoney, CompanyTarget } from './linkTarget'
import type { LinkedEntry, LinkedOn, LinkFiling, LinkPlace } from './linkFiling'
import { companyMoneyCategoryIn, fixedCategoryIn } from '../../categories/domain/starterCategories'
import { carriedFields } from '../../workbook/domain/carriedChoices'
import type { Category, CompanyMoneyRole } from '../../workbook/domain/category'
import { ITEM_RECORDS } from '../../workbook/domain/spendingKinds'
import type { ItemizedRow } from '../../workbook/domain/rowItems'
import { filedAsTransfer, linkedItems, wholeRowItemId } from '../../workbook/domain/rowItems'
import type { TransactionItem } from '../../workbook/domain/transactionItem'
import { mainCategoryOf } from '../../../../shared/categorising/domain/mainCategory'
import { accountMoneyOfEuros, addAccountMoney, negateAccountMoney } from '../../../../shared/money/accountMoney'
import type { AccountMoney } from '../../../../shared/money/accountMoney'
import { EURO } from '../../../../shared/money/currencyCode'
import { restOfWhole } from '../../../../shared/money/partsOfWhole'
import { newRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/**
 * Where money from or to your company goes in Spending: the income category of a role, Loans to and from people for an owner
 * loan either way, For the company for a cost paid back either way, or no category yet for other money such as share capital,
 * which waits on To review.
 */
export type CompanyMoneyHome = CompanyMoneyRole | 'informal-loan' | 'company' | null

/** Tax-free pay that is not for a trip, such as a results bonus, goes under Salary, and a trip's per diems and kilometres under Travel allowances. */
const HOMES: Readonly<Record<CompanyMoney, CompanyMoneyHome>> = {
  salary: 'salary',
  'tax-free-pay': 'salary',
  rent: 'rental-income',
  'profit-payout': 'profit-payout',
  'travel-allowance': 'travel-allowance',
  'owner-loan': 'informal-loan',
  'cost-refund': 'company',
  other: null,
}

export function homeOfCompanyMoney(kind: CompanyMoney): CompanyMoneyHome {
  return HOMES[kind]
}

/** A part of a row a payment from or to your company files, signed as the row is: one home's money, or what the row moved beyond the payment under the row's own category. */
export type CompanyPart = { readonly home: CompanyMoneyHome; readonly amount: AccountMoney } | { readonly home: 'difference'; readonly amount: AccountMoney }

/** A row filed in the parts of the payment it is, in the order of the payment's parts, with the difference last. */
export interface CompanyPaymentSplit {
  readonly split: 'payment'
  readonly parts: readonly CompanyPart[]
  /** The category the difference goes under: the one most of the row's money is in, or null for a row with none. */
  readonly rowCategory: RecordId | null
}

/**
 * The record's parts as money of a euro account, credits for money to you and debits for money from you, with parts of the same
 * home joined. A cost you paid for your company is one part under For the company, paid out of your account.
 */
function paymentParts(target: CompanyTarget): readonly CompanyPart[] {
  if (target.kind === 'owner-advance') return [{ home: 'company', amount: negateAccountMoney(accountMoneyOfEuros(target.amount)) }]
  const parts: { home: CompanyMoneyHome; amount: AccountMoney }[] = []
  for (const part of target.parts) {
    const amount = target.direction === 'to-owner' ? accountMoneyOfEuros(part.amount) : negateAccountMoney(accountMoneyOfEuros(part.amount))
    const home = homeOfCompanyMoney(part.kind)
    const held = parts.find((candidate) => candidate.home === home)
    if (held === undefined) parts.push({ home, amount })
    else held.amount = addAccountMoney(held.amount, amount)
  }
  return parts
}

/**
 * How linking the row to a payment from or to your company, or to a cost you paid for it, files it. A transfer's leg, a receipt's
 * row and a row on an account not in euros keep their parts. Any other row is filed in the record's parts by what each part's
 * money is, and what the row moved beyond the record stays as a part of its own under the row's category.
 */
export function companyPaymentFiling({ row, items }: ItemizedRow, target: CompanyTarget, on: LinkedOn): LinkFiling {
  if (row.pair !== null || filedAsTransfer(on.categories)(items)) return { split: false, why: 'transfer-leg' }
  if (on.receipt) return { split: false, why: 'receipt' }
  if (on.currency !== EURO) return { split: false, why: 'not-euro' }
  const parts = paymentParts(target)
  const difference = restOfWhole(
    row.amount,
    parts.map((part) => part.amount),
  )
  const filed = items.filter((item): item is TransactionItem & { readonly category: RecordId } => item.category !== null)
  return {
    split: 'payment',
    parts: difference === 0 ? parts : [...parts, { home: 'difference', amount: difference }],
    rowCategory: filed.length === 0 ? null : mainCategoryOf(filed),
  }
}

/** The home's category in the file, or a new one with the categories it needs, which the write adds. */
export function categoryOfHome(home: CompanyMoneyRole | 'informal-loan' | 'company', categories: readonly Category[], place: Pick<LinkPlace, 'language'>, newKey: () => string = newRecordId) {
  if (home !== 'informal-loan' && home !== 'company') return companyMoneyCategoryIn(categories, home, place.language, newKey)
  const fixed = fixedCategoryIn(categories, home, place.language, newKey)
  return { category: fixed.category, added: fixed.added ? [fixed.category] : [] }
}

/** The category of each part, with the categories a file made before them lacks, which the write adds once. */
function partCategories(filing: CompanyPaymentSplit, place: Pick<LinkPlace, 'categories' | 'language'>, newKey: () => string) {
  let categories = place.categories
  const added: Category[] = []
  const ids = filing.parts.map(({ home }): RecordId | null => {
    if (home === null) return null
    if (home === 'difference') return filing.rowCategory
    const found = categoryOfHome(home, categories, place, newKey)
    categories = [...categories, ...found.added]
    added.push(...found.added)
    return found.category.id
  })
  return { ids, added }
}

/**
 * The row linked to the payment or the cost, filed as `companyPaymentFiling` says: its items replaced by one item per part, each linked
 * to the payment and carrying every label of the row and the payee all of it counted under, the first keeping the id of the row's first item, and filed by you.
 * One part files the row whole. A row that keeps its parts only takes the link.
 */
export function companyLinkedEntry(entry: ItemizedRow, target: CompanyTarget, place: LinkPlace & Pick<LinkedOn, 'receipt'>, newKey: () => string = newRecordId): LinkedEntry {
  const filing = companyPaymentFiling(entry, target, place)
  if (filing.split !== 'payment') return { entry: { row: entry.row, items: linkedItems(entry.items, target.link) }, interest: null, added: [] }
  const { ids, added } = partCategories(filing, place, newKey)
  const firstId = entry.items[0]?.id ?? wholeRowItemId(entry.row)
  const carried = carriedFields(entry.items)
  const several = filing.parts.length > 1
  const items = filing.parts.map((part, at): TransactionItem => ({
    id: at === 0 ? firstId : recordIdOf(ITEM_RECORDS, newKey()),
    transaction: entry.row.id,
    receipt: null,
    printed: '',
    note: part.home === 'difference' ? place.notes.difference : '',
    amount: part.amount,
    category: ids[at] ?? null,
    link: target.link,
    ...carried,
    sharedCost: null,
    splitByLink: several,
  }))
  return { entry: { row: { ...entry.row, categorisedBy: 'person' }, items }, interest: null, added }
}
