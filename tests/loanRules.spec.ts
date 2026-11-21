import { describe, expect, it } from 'vitest'

import { extraPaymentOffers, loanRuleOffers } from '../src/apps/spending/links/domain/instalmentOffers'
import type { RuleLinks } from '../src/apps/spending/links/domain/linkFiling'
import { paidLoansIn } from '../src/apps/spending/links/domain/linkTarget'
import type { AssetTarget, InstalmentTarget } from '../src/apps/spending/links/domain/linkTarget'
import { assetRuleOffers } from '../src/apps/spending/links/domain/assetLinks'
import { rowsRulesWouldChange } from '../src/apps/spending/statements/application/statementWrites'
import { rulesRerun } from '../src/apps/spending/statements/domain/spendingCategorisation'
import { statementDryRun } from '../src/apps/spending/statements/domain/statementDryRun'
import type { StatementRow, StatementRows } from '../src/apps/spending/statements/domain/statementRows'
import { RULE_CODEC } from '../src/apps/spending/workbook/domain/ruleReading'
import { RULE_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import type { SpendingRule } from '../src/apps/spending/workbook/domain/spendingRule'
import type { RowLink } from '../src/apps/spending/workbook/domain/rowLink'
import { accountMoneyFromAmount } from '../src/shared/money/accountMoney'
import { moneyFromAmount } from '../src/shared/money/money'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { storedFieldsOfValues } from '../src/shared/storage/domain/storedFields'
import { civil } from './fixtures/ledger'
import { CATEGORIES, OTP, category, row, fileBook } from './fixtures/spending'

const DAY = civil('2026-11-25')
const CAR_LOAN: RowLink = { app: 'loans', kind: 'bank-loan', key: '3f6c1e2a-0000-4000-8000-000000000001', due: null }
const IBAN = 'HR1210010051863000160'
const NOTES = { interest: 'Interest', difference: 'Difference from the plan' }

/** A made-up instalment of Car loan, 612.20 you pay, of which 110.00 is interest, due on the day given. */
function due(date: string): InstalmentTarget {
  return {
    kind: 'instalment',
    interim: false,
    link: { ...CAR_LOAN, due: civil(date) },
    loanName: 'Car loan',
    lender: 'Example Bank',
    number: 14,
    count: 84,
    due: civil(date),
    youPay: moneyFromAmount(612.2),
    interest: moneyFromAmount(110),
    principal: moneyFromAmount(502.2),
  }
}

const TARGETS = [due('2026-10-15'), due('2026-11-15')]
const LINKS: RuleLinks = { targets: TARGETS, language: 'en', notes: NOTES, assets: { apps: ['assets'], targets: [] } }
const LOANS_UNREAD: RuleLinks = { targets: null, language: 'en', notes: NOTES, assets: { apps: ['assets'], targets: [] } }

const carRule = (link: RowLink | null = CAR_LOAN): SpendingRule => ({
  id: recordIdOf(RULE_RECORDS, 'rule-car'),
  order: 1,
  conditions: [{ test: 'iban_is', values: [IBAN], not: false }],
  labels: [],
  stop: false,
  category: category('Money and fees/Loan interest').id,
  withdrawal: null,
  link,
})

function statementRow(date: string, amount: number): StatementRow {
  return {
    account: OTP.id,
    date: civil(date),
    amount: accountMoneyFromAmount(amount),
    payee: 'Example Bank',
    category: null,
    description: 'Car loan',
    counterpartyIban: IBAN,
    importKey: `key-${date}-${amount}`,
    movedAt: '',
    pocket: false,
    cashWithdrawal: false,
    pending: false,
  }
}

const statementOf = (...rows: StatementRow[]): StatementRows => ({ label: 'export.csv', rows, fileNotes: [] })
const principal = CATEGORIES.find((held) => held.kind === 'repayment')!
const interest = category('Money and fees/Loan interest')

describe('a rule whose rows pay a loan', () => {
  it("links a new row to the loan's nearest instalment no row is linked to, within a tenth of its share, and splits it into the interest under the rule's category and the principal", () => {
    const run = statementDryRun(fileBook([], { rules: [carRule()] }), statementOf(statementRow('2026-11-16', -615)), DAY, LINKS)

    expect(run.lines.map((line) => (line.outcome === 'new' ? (line.pays?.target.kind === 'instalment' ? line.pays.target.due : undefined) : null))).toEqual([civil('2026-11-15')])
    // 615.00 against the plan's 612.20 leaves 2.80 as a part of its own under the rule's category.
    expect(run.items.map((part) => [part.amount, part.category, part.link?.due])).toEqual([
      [accountMoneyFromAmount(-110), interest.id, civil('2026-11-15')],
      [accountMoneyFromAmount(-502.2), principal.id, civil('2026-11-15')],
      [accountMoneyFromAmount(-2.8), interest.id, civil('2026-11-15')],
    ])
  })

  it('files a row far above the instalment, and a second row when the instalment is linked, whole under its category', () => {
    const linked = row(OTP, '2026-11-15', -612.2, 'Money and fees/Loan interest', { source: 'statement', counterpartyIban: IBAN, link: { ...CAR_LOAN, due: civil('2026-11-15') } })
    const run = statementDryRun(fileBook([linked], { rules: [carRule()] }), statementOf(statementRow('2026-11-17', -612.2), statementRow('2026-11-18', -5612.2)), DAY, LINKS)

    expect(run.items.map((part) => [part.amount, part.category, part.link])).toEqual([
      [accountMoneyFromAmount(-612.2), interest.id, null],
      [accountMoneyFromAmount(-5612.2), interest.id, null],
    ])
  })

  it('leaves a row it decides waiting with no category while Loans cannot be read, so a whole instalment never counts as interest', () => {
    const run = statementDryRun(fileBook([], { rules: [carRule()] }), statementOf(statementRow('2026-11-16', -612.2)), DAY, LOANS_UNREAD)
    expect(run.items.map((part) => part.category)).toEqual([null])
    expect(statementDryRun(fileBook([], { rules: [carRule(null)] }), statementOf(statementRow('2026-11-16', -612.2)), DAY, LOANS_UNREAD).items.map((part) => part.category)).toEqual([interest.id])
  })

  it('links one row to an instalment once, when the rule and the suggestion would both link it', () => {
    const run = statementDryRun(fileBook([], { rules: [carRule()] }), statementOf(statementRow('2026-11-15', -612.2), statementRow('2026-11-16', -612.2)), DAY, LINKS)
    expect(run.items.flatMap((part) => (part.link === null ? [] : [part.link.due]))).toEqual([civil('2026-11-15'), civil('2026-11-15')])
    expect(run.added.map((added) => run.items.filter((part) => part.transaction === added.id).length)).toEqual([2, 1])
  })

  it('links a waiting row once the rule is made, adds Loan principal to a file without it in the same write, and leaves its rows as they are while Loans cannot be read', () => {
    const waiting = row(OTP, '2026-11-15', -612.2, null, { source: 'statement', counterpartyIban: IBAN })
    const categories = CATEGORIES.filter((held) => held.kind !== 'repayment')
    const { changes, categories: added } = rulesRerun(fileBook([waiting], { categories }), [carRule()], { links: LINKS, newKey: () => 'a1000000-0000-4000-8000-000000000001' })

    expect(added.map((held) => [held.name, held.kind])).toEqual([['Loan principal', 'repayment']])
    expect(changes.flatMap(({ items }) => items ?? []).map((part) => [part.amount, part.category])).toEqual([
      [accountMoneyFromAmount(-110), interest.id],
      [accountMoneyFromAmount(-502.2), added[0]!.id],
    ])
    expect(rulesRerun(fileBook([waiting]), [carRule()], { links: LOANS_UNREAD }).changes).toEqual([])
    const filed = row(OTP, '2026-11-18', -5612.2, 'Money and fees/Loan interest', { source: 'statement', counterpartyIban: IBAN, categorisedBy: 'rule' })
    expect(rulesRerun(fileBook([filed]), [carRule()], { links: LOANS_UNREAD }).changes).toEqual([])
  })

  it('counts the rows a loan rule would link, and links a row it skipped while Loans could not be read once the rule is applied again', () => {
    const waiting = row(OTP, '2026-11-15', -612.2, null, { source: 'statement', counterpartyIban: IBAN })
    const rule = carRule()
    const added = { adding: [{ conditions: rule.conditions, category: rule.category, labels: [], stop: false, withdrawal: null, link: CAR_LOAN }] }
    expect(rowsRulesWouldChange(fileBook([waiting]), added, LINKS)).toBe(1)
    expect(rowsRulesWouldChange(fileBook([waiting]), added, LOANS_UNREAD)).toBe(0)

    // The rule was saved with Apply while Loans could not be read, so the row still waits.
    const book = fileBook([waiting], { rules: [rule] })
    const again = { changing: [{ rule, draft: rule }] }
    expect(rowsRulesWouldChange(book, again, LOANS_UNREAD)).toBe(0)
    expect(rowsRulesWouldChange(book, again, LINKS)).toBe(1)
    const { changes } = rulesRerun(book, [rule], { links: LINKS, applying: new Set([rule.id]) })
    expect(changes.flatMap(({ items }) => items ?? []).map((part) => part.link?.due ?? null)).toEqual([civil('2026-11-15'), civil('2026-11-15')])
  })

  it('stores the loan as a link with no due date, and refuses one with a due date', () => {
    const fields = RULE_CODEC.fieldsOf(carRule())
    expect(fields['link']).toBe(`loans/bank-loan/${CAR_LOAN.key}`)
    expect(RULE_CODEC.make(storedFieldsOfValues(fields), carRule().id).link).toEqual(CAR_LOAN)
    expect(() => RULE_CODEC.make(storedFieldsOfValues({ ...fields, link: `loans/bank-loan/${CAR_LOAN.key}/2026-11-15` }), carRule().id)).toThrow('with no due date')
  })
})

describe('the rule the Rules card offers', () => {
  const linked = row(OTP, '2026-10-15', -612.2, 'Money and fees/Loan interest', { source: 'statement', counterpartyIban: IBAN, link: { ...CAR_LOAN, due: civil('2026-10-15') } })

  it('offers rows to the IBAN of the first row linked to a loan, with its interest under the category that row used, until a rule tests that IBAN', () => {
    expect(paidLoansIn(TARGETS)).toEqual([{ link: CAR_LOAN, loanName: 'Car loan' }])
    expect(loanRuleOffers(fileBook([linked]), TARGETS)).toEqual([{ loan: { link: CAR_LOAN, loanName: 'Car loan' }, condition: { test: 'iban_is', values: [IBAN], not: false }, category: interest.id }])
    expect(loanRuleOffers(fileBook([linked], { rules: [carRule(null)] }), TARGETS)).toEqual([])
    expect(loanRuleOffers(fileBook([linked]), [])).toEqual([])
  })

  it('offers no rule for a loan a rule already names, though that rule tests another payee', () => {
    const otherPayee: SpendingRule = { ...carRule(), conditions: [{ test: 'payee_contains', values: ['OTP banka'], not: false }], labels: [], stop: false }
    expect(loanRuleOffers(fileBook([linked], { rules: [otherPayee] }), TARGETS)).toEqual([])
  })
})

describe('a rule whose rows are for an asset', () => {
  const CAR: AssetTarget = { kind: 'asset', link: { app: 'assets', kind: 'asset', key: 'made-up-car', due: null }, name: 'Family car', assetKind: 'car', bought: null }
  const insurance = category('Transport/Car registration and insurance')
  const carCosts = (): SpendingRule => ({ ...carRule(CAR.link), category: insurance.id })
  const assetsUnread: RuleLinks = { ...LOANS_UNREAD, assets: { apps: ['assets'], targets: [] } }

  it("links each new row it files whole to the asset under the rule's category, while neither Loans nor Assets can be read", () => {
    const run = statementDryRun(fileBook([], { rules: [carCosts()] }), statementOf(statementRow('2026-11-16', -420)), DAY, assetsUnread)
    expect(run.items.map((part) => [part.amount, part.category, part.link])).toEqual([[accountMoneyFromAmount(-420), insurance.id, CAR.link]])
    expect(run.lines.map((line) => line.outcome === 'new' && line.pays !== undefined)).toEqual([false])
  })

  it('names the asset on the dry run once Assets can be read, and links rows already in the book as the rule is applied', () => {
    const known: RuleLinks = { ...LINKS, assets: { apps: ['assets'], targets: [CAR] } }
    const run = statementDryRun(fileBook([], { rules: [carCosts()] }), statementOf(statementRow('2026-11-16', -420)), DAY, known)
    expect(run.lines.map((line) => (line.outcome === 'new' ? line.pays?.target : null))).toEqual([CAR])

    const filed = row(OTP, '2026-10-02', -400, null, { source: 'statement', counterpartyIban: IBAN })
    const book = fileBook([filed], { rules: [] })
    const rerun = rulesRerun(book, [{ ...carCosts(), id: recordIdOf(RULE_RECORDS, 'rule-car') }], { links: assetsUnread, applying: new Set([recordIdOf(RULE_RECORDS, 'rule-car')]) })
    expect(rerun.changes.flatMap(({ items }) => items ?? []).map((part) => [part.category, part.link])).toEqual([[insurance.id, CAR.link]])
  })

  it('offers a rule once the two newest rows linked to an asset go to one payee, under the newer category, and not after a single one', () => {
    const linked = (date: string, path: string) => row(OTP, date, -420, path, { source: 'statement', counterpartyIban: IBAN, link: CAR.link })
    const two = fileBook([linked('2025-11-10', 'Transport/Car registration and insurance'), linked('2026-11-10', 'Transport/Car service and repairs')])
    expect(assetRuleOffers(two, [CAR])).toEqual([{ asset: CAR, condition: { test: 'iban_is', values: [IBAN], not: false }, category: category('Transport/Car service and repairs').id }])
    expect(assetRuleOffers(fileBook([linked('2026-11-10', 'Transport/Fuel')]), [CAR])).toEqual([])
    expect(assetRuleOffers({ ...two, rules: [carCosts()] }, [CAR])).toEqual([])
  })
})

describe('the rows To review offers to record as an extra payment', () => {
  const paysNovember = row(OTP, '2026-11-15', -612.2, 'Money and fees/Loan interest', { source: 'statement', counterpartyIban: IBAN, link: { ...CAR_LOAN, due: civil('2026-11-15') } })
  const filed = (date: string, amount: number) => row(OTP, date, amount, 'Money and fees/Loan interest', { source: 'statement', counterpartyIban: IBAN, categorisedBy: 'rule' })
  const offered = (rows: Parameters<typeof fileBook>[0], paidLoan: RowLink | null = CAR_LOAN) =>
    extraPaymentOffers(fileBook(rows), TARGETS, () => paidLoan).map(({ row: offer, instalment, withInstalment, extra }) => [offer.date, instalment.due, withInstalment, extra])

  it("offers a row its loan's rule filed more than a tenth above the share of the nearest instalment, which another row pays, as all extra payment", () => {
    expect(offered([paysNovember, filed('2026-11-18', -5612.2)])).toEqual([[civil('2026-11-18'), civil('2026-11-15'), false, accountMoneyFromAmount(5612.2)]])
  })

  it('offers a row booked in the window of an instalment no row pays yet as paying it too, with what it pays beyond the share', () => {
    expect(offered([filed('2026-11-18', -5612.2)])).toEqual([[civil('2026-11-18'), civil('2026-11-15'), true, accountMoneyFromAmount(5000)]])
    expect(offered([filed('2026-11-24', -5612.2)])).toEqual([])
  })

  it('leaves out a row near the share, one below the share and a row of a rule that names no loan', () => {
    expect(offered([paysNovember, filed('2026-11-18', -640)])).toEqual([])
    expect(offered([filed('2026-11-18', -640)])).toEqual([])
    expect(offered([paysNovember, filed('2026-11-18', -100)])).toEqual([])
    expect(offered([paysNovember, filed('2026-11-18', -5612.2)], null)).toEqual([])
  })
})
