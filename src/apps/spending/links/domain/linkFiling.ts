import { loanLinkOf, sameRecord } from './linkTarget'
import { expectedOf, interestCategoryOf, paidOut, planParts, splitByInstalment, splitIntoParts } from './instalmentParts'
import type { InstalmentSplit, LinkedPart, PartNotes } from './instalmentParts'
import { labelsOf } from '../../../../shared/categorising/domain/labels'
import type { AppTargets, AssetTarget, CompanyTarget, ExtraPaymentTarget, InstalmentTarget, LinkTarget } from './linkTarget'
import { assetLinkedEntry } from './assetLinks'
import { companyLinkedEntry, companyPaymentFiling } from './companyPaymentFiling'
import type { CompanyPaymentSplit } from './companyPaymentFiling'
import { inWindow, isNear, nearestTo } from '../../../../shared/app/moneyMatch'
import { fixedCategoryIn, loanInterestCategoryIn } from '../../categories/domain/starterCategories'
import { ruleLabelsOf } from '../../workbook/domain/carriedChoices'
import type { Category, FixedKind } from '../../workbook/domain/category'
import type { ItemizedRow } from '../../workbook/domain/rowItems'
import { filedAsTransfer, linkedItems, wholeItemOf } from '../../workbook/domain/rowItems'
import { rowLinkText } from '../../workbook/domain/rowLink'
import type { RowLink } from '../../workbook/domain/rowLink'
import type { Transaction } from '../../workbook/domain/transaction'
import type { TransactionItem } from '../../workbook/domain/transactionItem'
import { absAccountMoney, accountMoneyOfEuros, subtractAccountMoney } from '../../../../shared/money/accountMoney'
import type { AccountMoney } from '../../../../shared/money/accountMoney'
import { EURO } from '../../../../shared/money/currencyCode'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import { restOfWhole } from '../../../../shared/money/partsOfWhole'
import { newRecordId } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import type { Language } from '../../../../shared/text/language'

/**
 * Why a link files an entry whole: it names money lent, borrowed or paid back early, which goes under the fixed category
 * `wholeKindOf` names, a deposit or withdrawal of a broker's account for an entry with no category, which goes under
 * Saved to investments, or an asset's purchase, which goes under Bought assets, or it leaves the entry's money as it is, since
 * the instalment is all interest, the entry is money in, its account is not in euros as Loans' plan is, it is a transfer's leg,
 * a receipt split it, or it names a deposit or withdrawal or a cost of or income from an asset and the entry keeps its category.
 */
export type WholeReason = 'principal' | 'saving' | 'bought' | 'no-principal' | 'money-in' | 'not-euro' | 'transfer-leg' | 'receipt' | 'kept'

/**
 * How a link files an entry: whole, under its loan's fixed category or as it is, split into the instalment's interest and principal as
 * the plan has them, with what the entry paid beyond the plan as a part of its own, or in the parts of a payment from or to your company.
 * Each amount is signed as the entry is, and the difference is zero when the entry pays the plan's share, or of the other sign when it pays less.
 */
export type LinkFiling = LoanFiling | CompanyPaymentSplit

/** How a link to a record in Loans or Investments files an entry: whole, or split by an instalment. */
export type LoanFiling = { readonly split: false; readonly why: WholeReason } | InstalmentSplit

/** What a link reads of the entry's account and the file beside its rows. */
export interface LinkedOn {
  readonly currency: CurrencyCode
  /** Whether a receipt split the entry. */
  readonly receipt: boolean
  readonly categories: readonly Category[]
}

/**
 * The fixed category a link that files the whole entry puts it under: Loans to and from people for an informal loan's money,
 * Saved to investments for a broker's deposit or withdrawal, Bought assets for an asset, and Loan principal for a bank loan's.
 */
export function wholeKindOf(target: Exclude<LinkTarget, CompanyTarget>): Extract<FixedKind, 'repayment' | 'informal-loan' | 'saving' | 'asset'> {
  if (target.kind === 'cash-movement') return 'saving'
  if (target.kind === 'asset') return 'asset'
  return target.kind === 'informal-loan' || target.kind === 'movement' ? 'informal-loan' : 'repayment'
}

/**
 * How much more the entry moved than the movement or extra payment it is linked to, below zero when it moved less, or null for
 * another target or an account not in euros as Loans is. An instalment compares with its plan through `beyondPlan`.
 */
export function beyondRecord(target: LinkTarget, row: Pick<Transaction, 'amount'>, currency: CurrencyCode): AccountMoney | null {
  if ((target.kind !== 'movement' && target.kind !== 'extra-payment') || currency !== EURO) return null
  return subtractAccountMoney(absAccountMoney(row.amount), accountMoneyOfEuros(target.amount))
}

/**
 * How linking the entry to the target files its money. An instalment on money out of a euro account splits into the plan's
 * interest, under the category most of the entry's money is in besides Loan principal or under Loan interest for an entry
 * with no category, and its principal, which goes under Loan principal and counts as no spending. A part the entry already
 * had gives way to them. An extra payment is all principal, so the whole entry goes under Loan principal, and an informal
 * loan or its movement goes whole under Loans to and from people. A transfer's leg and a receipt's row keep their parts. A payment
 * from or to your company, or a cost you paid for it, files as `companyPaymentFiling` says. A deposit or a withdrawal files an
 * entry with no category whole under Saved to investments, and an entry with a category keeps it, so no figure moves. An asset's
 * purchase files the entry whole under Bought assets, which counts as no spending, and a cost of it or income from it keeps the entry's category.
 */
export function linkFiling(entry: ItemizedRow, target: Exclude<LinkTarget, CompanyTarget>, on: LinkedOn): LoanFiling
export function linkFiling(entry: ItemizedRow, target: LinkTarget, on: LinkedOn): LinkFiling
export function linkFiling({ row, items }: ItemizedRow, target: LinkTarget, on: LinkedOn): LinkFiling {
  if (target.kind === 'owner-payment' || target.kind === 'owner-advance') return companyPaymentFiling({ row, items }, target, on)
  const whole = (why: WholeReason): LoanFiling => ({ split: false, why })
  if (row.pair !== null || filedAsTransfer(on.categories)(items)) return whole('transfer-leg')
  if (on.receipt) return whole('receipt')
  if (target.kind === 'cash-movement') return whole(items.every((item) => item.category === null) ? 'saving' : 'kept')
  if (target.kind === 'asset') return whole(target.use === 'bought' ? 'bought' : 'kept')
  if (target.kind !== 'instalment') return whole('principal')
  if (target.principal === 0) return whole('no-principal')
  if (row.amount >= 0) return whole('money-in')
  if (on.currency !== EURO) return whole('not-euro')
  return { split: true, category: interestCategoryOf(items, on.categories), ...planParts(row.amount, target) }
}

/** What linking an entry reads beside the file's rows: its account's currency, the file's categories, and the language and notes of the parts a split adds. */
export interface LinkPlace {
  readonly currency: CurrencyCode
  readonly categories: readonly Category[]
  readonly language: Language
  readonly notes: PartNotes
}

/** An entry as a link left it, with the categories it needs that a file made before them lacks: Loan principal or Loans to and from people, and Loan interest for an entry with no category. */
export interface LinkedEntry {
  readonly entry: ItemizedRow
  /** The category the instalment's interest went under, or null when the link left the entry whole. */
  readonly interest: RecordId | null
  readonly added: readonly Category[]
}

/**
 * The entry linked to the record in Loans or Investments it is, filed as `linkFiling` says: split by an instalment, whole under its loan's
 * fixed category, Saved to investments or Bought assets and filed by you, its parts joined into one that keeps every label, or each item as it is with the link on it, which for a cost of or income from an asset is each part chosen, filed under the category picked while it waits for one.
 */
export function linkedEntry(entry: ItemizedRow, target: LinkTarget, place: LinkPlace & Pick<LinkedOn, 'receipt'>, newKey: () => string = newRecordId): LinkedEntry {
  if (target.kind === 'owner-payment' || target.kind === 'owner-advance') return companyLinkedEntry(entry, target, place, newKey)
  const filing = linkFiling(entry, target, place)
  if (target.kind === 'asset' && !filing.split && (filing.why === 'kept' || filing.why === 'receipt')) return { entry: assetLinkedEntry(entry, target), interest: null, added: [] }
  if (!filing.split && filing.why !== 'principal' && filing.why !== 'saving' && filing.why !== 'bought')
    return { entry: { row: entry.row, items: linkedItems(entry.items, target.link) }, interest: null, added: [] }
  const principal = fixedCategoryIn(place.categories, filing.split ? 'repayment' : wholeKindOf(target), place.language, newKey)
  const principalAdded = principal.added ? [principal.category] : []
  if (!filing.split) {
    const first = entry.items[0] ?? wholeItemOf(entry.row, { category: null, note: '', link: null, labels: [] })
    const whole: TransactionItem = {
      ...first,
      amount: entry.row.amount,
      category: principal.category.id,
      link: target.link,
      labels: labelsOf(entry.items),
      ruleLabels: ruleLabelsOf(entry.items),
      splitByLink: false,
    }
    return { entry: { row: { ...entry.row, categorisedBy: 'person' }, items: [whole] }, interest: null, added: principalAdded }
  }
  const interest = filing.category === null ? loanInterestCategoryIn(place.categories, place.language, newKey) : { category: { id: filing.category }, added: [] }
  return {
    entry: splitByInstalment(entry, target.link, { ...filing, category: interest.category.id }, principal.category.id, place.notes, newKey),
    interest: interest.category.id,
    added: [...principalAdded, ...interest.added],
  }
}

/**
 * The entry that pays its instalment and an extra payment of the same loan in one debit, split into the instalment's interest
 * and principal linked to the instalment, the extra payment under Loan principal linked to it, then what is left over as the
 * difference linked to the instalment. The interest and the difference go under the category an instalment's interest takes.
 */
export function linkedWithExtraPayment(entry: ItemizedRow, instalment: InstalmentTarget, extra: ExtraPaymentTarget, place: LinkPlace, newKey: () => string = newRecordId): LinkedEntry {
  const principal = fixedCategoryIn(place.categories, 'repayment', place.language, newKey)
  const filed = interestCategoryOf(entry.items, place.categories)
  const interest = filed === null ? loanInterestCategoryIn(place.categories, place.language, newKey) : { category: { id: filed }, added: [] }
  const plan = planParts(entry.row.amount, instalment)
  const extraPaid = paidOut(extra.amount)
  const parts: readonly LinkedPart[] = [
    [plan.interest, interest.category.id, place.notes.interest, instalment.link],
    [plan.principal, principal.category.id, '', instalment.link],
    [extraPaid, principal.category.id, '', extra.link],
    [restOfWhole(plan.difference, [extraPaid]), interest.category.id, place.notes.difference, instalment.link],
  ]
  return { entry: splitIntoParts(entry, parts, newKey), interest: interest.category.id, added: [...(principal.added ? [principal.category] : []), ...interest.added] }
}

/** The apps that keep assets, which a rule's link may name, and the assets they publish, none while they cannot be read. */
export interface RuleAssets {
  readonly apps: readonly string[]
  readonly targets: readonly LinkTarget[]
}

/**
 * The records in Loans a write may link rows to, null while Loans cannot be read, the assets a rule may link rows to, and the
 * language and notes of the parts and categories a link adds.
 */
export type RuleLinks = Pick<LinkPlace, 'language' | 'notes'> & { readonly targets: readonly LinkTarget[] | null; readonly assets: RuleAssets }

/** An entry a rule linked to the instalment it pays or to an asset, with the record it names, null for an asset Assets cannot show now. */
export type RuleLinked = LinkedEntry & { readonly target: InstalmentTarget | AssetTarget | null }

/** Whether a rule's link names an asset, which links the rows the rule files whether or not Assets can be read, since nothing is checked against it. */
export function linksToAsset(link: RowLink, links: Pick<RuleLinks, 'assets'> | null): boolean {
  return links !== null && links.assets.apps.includes(link.app)
}

/** Whether a rule's link waits on Loans' targets to file its rows: a link to a loan while Loans cannot be read. */
export function ruleLinkWaits(link: RowLink, links: Pick<RuleLinks, 'assets' | 'targets'> | null): boolean {
  return !linksToAsset(link, links) && (links?.targets ?? null) === null
}

/**
 * What a rule whose rows are linked to a record does to an entry it filed. A rule naming an asset links the whole entry to it,
 * keeping the rule's category, as a cost of it or income from it, whether or not Assets can be read. A rule naming a loan does as
 * `instalmentRuleLinking` says once Loans can be read. Null leaves the entry filed whole with no link.
 */
export function ruleLinking(entry: ItemizedRow, link: RowLink, links: RuleLinks, linked: ReadonlySet<string>, place: LinkPlace, newKey: () => string = newRecordId): RuleLinked | null {
  if (entry.row.pair !== null) return null
  if (linksToAsset(link, links)) {
    const known = links.assets.targets.find((target): target is AssetTarget => target.kind === 'asset' && sameRecord(target.link, link))
    const asset: AssetTarget = known ?? { kind: 'asset', link, name: '', assetKind: 'other', bought: null }
    return { entry: assetLinkedEntry(entry, asset), interest: null, added: [], target: known ?? null }
  }
  return links.targets === null ? null : instalmentRuleLinking(entry, link, links.targets, linked, place, newKey)
}

/**
 * What a rule whose rows pay a loan does to an entry it filed: links it to the loan's instalment due nearest its day inside the
 * window that no row is linked to yet, as `linked` names them, when the entry is money out of a euro account paying the share
 * within a tenth, and splits it as `linkedEntry` does, the interest under the rule's category. Null leaves it filed whole.
 */
function instalmentRuleLinking(entry: ItemizedRow, loan: RowLink, targets: readonly LinkTarget[], linked: ReadonlySet<string>, place: LinkPlace, newKey: () => string): RuleLinked | null {
  if (entry.row.amount >= 0 || entry.row.pair !== null || place.currency !== EURO) return null
  const open = targets.filter(
    (target): target is InstalmentTarget =>
      target.kind === 'instalment' && sameRecord(loanLinkOf(target.link), loan) && !linked.has(rowLinkText(target.link)) && inWindow(expectedOf(target), entry.row),
  )
  const nearest = nearestTo(
    entry.row.date,
    open.map((target) => ({ date: target.due, target })),
  )?.target
  if (nearest === undefined || !isNear(expectedOf(nearest), entry.row)) return null
  return { ...linkedEntry(entry, nearest, { ...place, receipt: false }, newKey), target: nearest }
}

/** The records an app's targets give a write to link rows to, none while the app opens, failed or is not set up, and the assets a rule may name. */
export function ruleLinksOf(targets: AppTargets<LinkTarget>, words: Pick<LinkPlace, 'language' | 'notes'>, assets: RuleAssets): RuleLinks {
  return { targets: targets === null || typeof targets === 'string' ? null : targets, language: words.language, notes: words.notes, assets }
}
