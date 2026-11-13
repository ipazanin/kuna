import ts from 'typescript'
import { describe, expect, it } from 'vitest'

import { RULE_CONDITION_FIELDS } from '../src/apps/company/assistant/ruleConditionFields'
import { installedPack } from '../src/apps/company/packs/packContribution'
import { SETTING_DEFINITIONS } from '../src/apps/company/settings/domain/settings'
import { INVESTMENT_SETTING_CHECKS } from '../src/apps/investments/workbook/application/settingWrites'
import { SPENDING_SETTING_CHECKS } from '../src/apps/spending/workbook/domain/readSpendingBook'
import type { StrictSchema } from '../src/shared/ai/domain/strictSchema'
import type { AssistantOperation } from '../src/shared/app/assistantOperations'
import { CHAT_EXCEPTIONS } from './chatCoverageExceptions'
import { FIELD_EXCEPTIONS, NO_FIELD_PATHS } from './chatFieldCoverageExceptions'
import { appOf, screenWrites, writeGraph } from './support/writePaths'
import { APP_OPERATIONS } from './fixtures/appOperations'

/** An operation that sets an editor's fields, with the operation's name for each field it spells differently. */
interface OperationFields {
  readonly name: string
  /** Put before each field, as `parts.` for an editor of one list item. */
  readonly prefix?: string
  /**
   * A field of the editor, as `field` or `field.member`, with the input field or fields that take it. A name such as `set-benchmark:instrument`
   * is a field of another operation of the app, which sets it on its own.
   */
  readonly renames?: Readonly<Record<string, string | readonly string[]>>
}

/**
 * Where an editor's fields come from and which operations must take them. The fields are a record kind's record for a kind's writes, or the
 * types of the named parameters of a write function. `type` names the editor's own type where the parameter is wider than one form.
 */
interface FieldSource {
  readonly path: string
  readonly from?: readonly string[]
  readonly type?: string
  /** A list of conditions whose `column` names the fields, as a rule's conditions do. */
  readonly columns?: string
  /** True when each field needs one of the operations rather than each of them, as for a kind that several forms write. */
  readonly anyOperation?: boolean
  readonly operations: readonly (string | OperationFields)[]
}

const CONDITION_RENAMES = Object.fromEntries(RULE_CONDITION_FIELDS.map((field) => [`conditions.${field.column}`, field.name]))
const INVOICING_RENAMES = Object.fromEntries(['address', 'country', 'taxId', 'invoiceMail', 'mailLanguage', 'reverseCharge'].map((field) => [`invoicing.${field}`, field]))
const ASSET_RENAMES = { name: 'asset', inUse: 'in_use', costNet: 'cost_net', doubledRate: 'doubled', fundedBy: 'funded_by', ledgerReference: 'ledger_reference', rowId: 'payment' }
const GRANT_RENAMES = {
  slug: 'grant',
  'parts.fixed': 'fixed_part',
  'parts.variable': 'variable_part',
  'period.from': 'period_from',
  'period.to': 'period_to',
  clawbackFirstYear: 'clawback_year1',
  clawbackSecondYear: 'clawback_year2',
  employmentRequiredUntil: 'employment_required_until',
}
const EMPLOYEE_RENAMES = { slug: 'employee', ibans: 'iban', agreedGross: 'agreed_gross', residenceCity: 'residence_city', pensionPillarTwo: 'pension_pillar_2', birthYear: 'birth_year' }
const YEAR_END_RENAMES = { 'figure.amount': 'amount', 'figure.date': 'amount', 'figure.basisPoints': 'amount', 'figure.count': 'amount' }
const COMPONENT_RENAMES = {
  'component.component': 'kind',
  'component.gross': 'amount',
  'component.from': 'from',
  'component.to': 'to',
  'component.item': 'item',
  'component.amount': 'amount',
  'component.basis': 'basis',
}
const SCENARIO_OPERATIONS: readonly OperationFields[] = [{ name: 'add-component', renames: COMPONENT_RENAMES }, { name: 'change-component', renames: COMPONENT_RENAMES }, { name: 'rename-scenario' }]
const INTERIM_RENAMES = { 'interimInterest.amount': 'interimAmount', 'interimInterest.date': 'interimDate' }
const SUBSIDY_RENAMES = {
  'subsidy.monthly': 'subsidyMonthly',
  'subsidy.payer': 'subsidyPayer',
  'subsidy.firstInstalment': 'subsidyFirstInstalment',
  'subsidy.instalments': 'subsidyInstalments',
}

const OFFER_RENAMES = {
  ...INTERIM_RENAMES,
  ...SUBSIDY_RENAMES,
  'costs.upfront': 'upfrontCost',
  'costs.monthly': 'monthlyCost',
  'costs.yearly': 'yearlyCost',
  drawdown: 'payout',
}

/** An entry keeps the link it has when it is retyped, and link-entry sets it. */
const LINK_ENTRY_RENAMES = { 'link.app': 'link-entry:loan', 'link.kind': 'link-entry:loan', 'link.key': 'link-entry:loan', 'link.due': 'link-entry:due' }

const FIELD_SOURCES: readonly FieldSource[] = [
  { path: 'src/apps/assets/asset/application/assetWrites.ts#ASSET_WRITES.add', operations: ['add-asset'] },
  { path: 'src/apps/assets/asset/application/assetWrites.ts#ASSET_WRITES.change', operations: ['change-asset'] },
  { path: 'src/apps/assets/asset/application/assetWrites.ts#VALUATION_WRITES.add', operations: ['add-valuation'] },
  { path: 'src/apps/assets/asset/application/assetWrites.ts#VALUATION_WRITES.change', operations: ['change-valuation'] },
  { path: 'src/apps/company/billingPlan/application/billingWrites.ts#BILLING_WRITES.add', operations: ['add-billing-item'] },
  { path: 'src/apps/company/billingPlan/application/billingWrites.ts#BILLING_WRITES.change', operations: ['change-billing-item'] },
  { path: 'src/apps/company/settings/application/settingWrites.ts#setSettings', from: ['values'], operations: ['set-setting'] },
  {
    path: 'src/apps/company/settings/application/namedRecordWrites.ts#CLIENT_WRITES',
    operations: [
      { name: 'add-client', renames: { slug: 'client', ...INVOICING_RENAMES } },
      { name: 'change-client', renames: { slug: 'shortName', ...INVOICING_RENAMES } },
    ],
  },
  { path: 'src/apps/company/invoicing/infrastructure/mailDraftSwitch.ts#switchMailDrafts', from: ['on'], operations: [{ name: 'switch-mail-drafts', renames: { on: 'drafts' } }] },
  {
    path: 'src/apps/company/receivables/application/invoiceWrites.ts#INVOICE_WRITES.add',
    operations: [{ name: 'add-invoice', renames: { 'deliveryPeriod.from': 'periodFrom', 'deliveryPeriod.to': 'periodTo' } }],
  },
  {
    path: 'src/apps/company/receivables/application/invoiceWrites.ts#INVOICE_WRITES.change',
    operations: [{ name: 'change-invoice', renames: { 'deliveryPeriod.from': 'periodFrom', 'deliveryPeriod.to': 'periodTo' } }],
  },
  { path: 'src/apps/company/owner-share/application/ownerShareWrites.ts#writeOwnerShare', from: ['share'], operations: ['set-owner-share'] },
  {
    path: 'src/apps/company/rules/application/ruleWrites.ts#writeRuleSave',
    type: 'src/apps/company/rules/domain/ruleDraft.ts#RuleDraft',
    columns: 'conditions',
    operations: [
      { name: 'add-rule', renames: { id: 'name', enabled: 'on', ...CONDITION_RENAMES } },
      { name: 'change-rule', renames: { id: 'name', enabled: 'on', ...CONDITION_RENAMES } },
    ],
  },
  {
    path: 'src/apps/company/rules/application/ruleWrites.ts#writeRulesChange',
    type: 'src/apps/company/rules/domain/ruleDraft.ts#RuleDraft',
    columns: 'conditions',
    operations: [
      { name: 'add-rule', renames: { id: 'name', enabled: 'on', ...CONDITION_RENAMES } },
      { name: 'change-rule', renames: { id: 'name', enabled: 'on', ...CONDITION_RENAMES } },
    ],
  },
  {
    path: 'src/apps/company/settings/application/namedRecordWrites.ts#ACCOUNT_WRITES',
    operations: [
      { name: 'add-account', renames: { slug: 'account' } },
      { name: 'change-account', renames: { slug: 'name' } },
    ],
  },
  {
    path: 'src/apps/company/settings/application/namedRecordWrites.ts#CATEGORY_WRITES',
    type: 'src/apps/company/settings/domain/categoryDrafts.ts#CategoryDraft',
    operations: ['add-category', { name: 'change-category', renames: { category: 'name' } }],
  },
  {
    path: 'src/apps/company/settings/application/namedRecordWrites.ts#CATEGORY_WRITES.change',
    type: 'src/apps/company/settings/domain/categoryDrafts.ts#CategoryDraft',
    operations: [{ name: 'change-category', renames: { category: 'name' } }],
  },
  { path: 'src/apps/company/settings/application/namedRecordWrites.ts#deleteCategoryInto', from: ['into'], operations: ['delete-category'] },
  { path: 'src/apps/company/transactions/application/fileRows.ts#fileRows', from: ['verdicts'], operations: [{ name: 'file-row', renames: { 'verdict.category': 'category' } }] },
  { path: 'src/apps/company/settings/application/settingWrites.ts#treatPayeeAsPerson', from: ['payee', 'asPerson'], operations: ['flag-person'] },
  { path: 'src/apps/company/transactions/application/splitWrites.ts#writeSplit', from: ['drafts'], operations: [{ name: 'split-row', prefix: 'parts.', renames: { 'opened.id': 'parts.part' } }] },
  {
    path: 'src/apps/company/packs/hr-doo/domain/hrDooWrites.ts#OWNER_ADVANCE_WRITES.add',
    type: 'src/apps/company/packs/hr-doo/application/ownerAdvanceWrites.ts#OwnerAdvanceDraft',
    operations: ['add-owner-advance'],
  },
  {
    path: 'src/apps/company/packs/hr-doo/domain/hrDooWrites.ts#OWNER_ADVANCE_WRITES.change',
    type: 'src/apps/company/packs/hr-doo/application/ownerAdvanceWrites.ts#OwnerAdvanceDraft',
    operations: ['change-owner-advance'],
  },
  { path: 'src/apps/company/packs/hr-doo/domain/hrDooWrites.ts#ASSET_WRITES', operations: ['add-asset', 'change-asset'].map((name) => ({ name, renames: ASSET_RENAMES })) },
  { path: 'src/apps/company/packs/hr-doo/domain/hrDooWrites.ts#GRANT_WRITES', operations: ['add-grant', 'change-grant'].map((name) => ({ name, renames: GRANT_RENAMES })) },
  {
    path: 'src/apps/company/packs/hr-doo/domain/hrDooWrites.ts#PLAN_WRITES',
    anyOperation: true,
    operations: ['plan-dividend', 'plan-purchase', { name: 'plan-category', renames: { item: 'category' } }, { name: 'plan-owner-pay', renames: { from: 'switchOn' } }],
  },
  { path: 'src/apps/company/packs/hr-doo/domain/hrDooWrites.ts#SCENARIO_WRITES', anyOperation: true, operations: SCENARIO_OPERATIONS },
  { path: 'src/apps/company/packs/hr-doo/domain/hrDooWrites.ts#SCENARIO_WRITES.add', anyOperation: true, operations: SCENARIO_OPERATIONS },
  { path: 'src/apps/company/packs/hr-doo/domain/hrDooWrites.ts#SCENARIO_WRITES.change', anyOperation: true, operations: SCENARIO_OPERATIONS },
  { path: 'src/apps/company/packs/hr-doo/domain/hrDooWrites.ts#EMPLOYEE_WRITES', operations: ['add-employee', 'change-employee'].map((name) => ({ name, renames: EMPLOYEE_RENAMES })) },
  { path: 'src/apps/company/packs/hr-doo/domain/hrDooWrites.ts#YEAR_END_WRITES', operations: ['add-year-end-line', 'change-year-end-line'].map((name) => ({ name, renames: YEAR_END_RENAMES })) },
  { path: 'src/apps/company/packs/hr-doo/application/tripWrites.ts#saveTripOrder', from: ['draft'], operations: ['add-trip', 'change-trip'] },
  { path: 'src/apps/company/packs/hr-doo/application/tripWrites.ts#settleTrip', from: ['draft'], operations: ['settle-trip'] },
  { path: 'src/apps/company/packs/hr-doo/application/tripWrites.ts#saveTripLeg', from: ['draft'], operations: ['add-trip-leg', 'change-trip-leg'] },
  { path: 'src/apps/company/packs/hr-doo/application/tripWrites.ts#saveTripCost', from: ['draft'], operations: ['add-trip-cost', 'change-trip-cost'] },
  { path: 'src/apps/company/packs/hr-doo/application/tripRowWrites.ts#markTripReported', from: ['on'], operations: [{ name: 'mark-trip-reported', renames: { on: 'reportedOn' } }] },
  {
    path: 'src/apps/investments/holdings/application/mixWrites.ts#FUND_MIX_WRITES',
    operations: [{ name: 'change-instrument', renames: { 'slice.group': ['sectors.group', 'countries.group'], percent: ['sectors.percent', 'countries.percent'] } }],
  },
  {
    path: 'src/apps/investments/holdings/application/mixWrites.ts#TARGET_WRITES',
    operations: [{ name: 'set-targets', prefix: 'targets.', renames: { 'slice.group': 'targets.group', 'slice.account': 'targets.account' } }],
  },
  {
    path: 'src/apps/investments/holdings/application/holdingWrites.ts#INSTRUMENT_WRITES',
    operations: ['add-instrument', 'change-instrument'].map((name) => ({
      name,
      renames: { benchmark: 'set-benchmark:instrument', 'quoted.kind': 'quoted', 'quoted.coupon': 'coupon', 'quoted.maturity': 'maturity' },
    })),
  },
  {
    path: 'src/apps/investments/holdings/application/holdingWrites.ts#INSTRUMENT_WRITES.change',
    operations: [{ name: 'change-instrument', renames: { benchmark: 'set-benchmark:instrument', 'quoted.kind': 'quoted', 'quoted.coupon': 'coupon', 'quoted.maturity': 'maturity' } }],
  },
  { path: 'src/apps/investments/holdings/application/holdingWrites.ts#INVESTMENT_ACCOUNT_WRITES.add', operations: ['add-account'] },
  { path: 'src/apps/investments/holdings/application/holdingWrites.ts#INVESTMENT_ACCOUNT_WRITES.change', operations: ['change-account'] },
  { path: 'src/apps/investments/mail/application/mailReaderWrites.ts#MAIL_READER_WRITES', operations: ['set-mail-reader'] },
  { path: 'src/apps/investments/overview/application/checkWrites.ts#writeCheck', from: ['check', 'threshold', 'on'], operations: ['set-check'] },
  { path: 'src/apps/investments/workbook/application/settingWrites.ts#SETTING_WRITES', operations: ['set-setting'] },
  {
    path: 'src/apps/investments/transactions/application/transactionWrites.ts#writeTransaction',
    type: 'src/apps/investments/workbook/domain/trade.ts#Trade',
    operations: ['add-trade', 'change-trade'],
  },
  {
    path: 'src/apps/investments/transactions/application/transactionWrites.ts#writeTransaction',
    type: 'src/apps/investments/workbook/domain/income.ts#Income',
    operations: ['add-income', 'change-income'],
  },
  {
    path: 'src/apps/investments/transactions/application/transactionWrites.ts#writeTransaction',
    type: 'src/apps/investments/workbook/domain/cashMovement.ts#CashMovement',
    operations: ['add-cash-movement', 'change-cash-movement'],
  },
  {
    path: 'src/apps/investments/transactions/application/transactionWrites.ts#writeTransaction',
    type: 'src/apps/investments/workbook/domain/exchange.ts#Exchange',
    operations: ['add-exchange', 'change-exchange'].map((name) => ({ name, renames: { 'fees.amount': 'fees', 'fees.currency': 'feeCurrency' } })),
  },
  {
    path: 'src/apps/investments/transactions/application/transactionWrites.ts#writeTransaction',
    type: 'src/apps/investments/workbook/domain/transfer.ts#Transfer',
    operations: ['add-transfer', 'change-transfer'].map((name) => ({ name, renames: Object.fromEntries(['instrument', 'quantity', 'currency', 'amount'].map((field) => [`moved.${field}`, field])) })),
  },
  {
    path: 'src/apps/investments/transactions/application/transactionWrites.ts#writeTransaction',
    type: 'src/apps/investments/workbook/domain/split.ts#Split',
    operations: ['add-split', 'change-split'],
  },
  {
    path: 'src/apps/investments/transactions/application/transactionWrites.ts#writeTransaction',
    type: 'src/apps/investments/workbook/domain/spinOff.ts#SpinOff',
    operations: ['add-spin-off', 'change-spin-off'],
  },
  {
    path: 'src/apps/investments/transactions/application/transactionWrites.ts#writeTransaction',
    type: 'src/apps/investments/workbook/domain/handPrice.ts#HandPrice',
    operations: ['add-price', 'change-price'],
  },
  { path: 'src/apps/loans/bankLoans/application/bankLoanWrites.ts#BANK_LOAN_WRITES.add', operations: [{ name: 'add-bank-loan', renames: { ...INTERIM_RENAMES, ...SUBSIDY_RENAMES } }] },
  {
    path: 'src/apps/loans/bankLoans/application/bankLoanWrites.ts#BANK_LOAN_WRITES.change',
    operations: [{ name: 'change-bank-loan', renames: { ...INTERIM_RENAMES, ...Object.fromEntries(Object.keys(SUBSIDY_RENAMES).map((field) => [field, `set-subsidy:${field.split('.')[1]!}`])) } }],
  },
  { path: 'src/apps/loans/bankLoans/application/bankLoanWrites.ts#RATE_PERIOD_WRITES.add', operations: ['add-rate-period'] },
  { path: 'src/apps/loans/bankLoans/application/bankLoanWrites.ts#RATE_PERIOD_WRITES.change', operations: ['change-rate-period'] },
  { path: 'src/apps/loans/bankLoans/application/bankLoanWrites.ts#EXTRA_PAYMENT_WRITES.add', operations: ['add-extra-payment'] },
  { path: 'src/apps/loans/bankLoans/application/bankLoanWrites.ts#EXTRA_PAYMENT_WRITES.change', operations: ['change-extra-payment'] },
  { path: 'src/apps/loans/bankLoans/application/bankLoanWrites.ts#LATE_INSTALMENT_WRITES.add', operations: ['add-late-instalment'] },
  { path: 'src/apps/loans/bankLoans/application/bankLoanWrites.ts#LATE_INSTALMENT_WRITES.change', operations: ['change-late-instalment'] },
  { path: 'src/apps/loans/scenarios/application/scenarioWrites.ts#saveScenario', from: ['scenario'], anyOperation: true, operations: ['save-try', 'add-offer', 'change-offer'] },
  {
    path: 'src/apps/loans/scenarios/application/scenarioWrites.ts#saveScenario',
    type: 'src/apps/loans/scenarios/domain/loanScenario.ts#OfferTerms',
    operations: ['add-offer', 'change-offer'].map((name) => ({ name, renames: OFFER_RENAMES })),
  },
  {
    path: 'src/apps/loans/scenarios/application/scenarioWrites.ts#saveScenario',
    from: ['changes'],
    anyOperation: true,
    operations: [
      { name: 'save-try', renames: { from: 'date' } },
      ...['add-offer', 'change-offer'].map((name) => ({
        name,
        prefix: 'changes.',
        renames: { from: 'changes.date', on: 'changes.date', 'costs.upfront': 'changes.upfrontCost', 'costs.monthly': 'changes.monthlyCost', 'costs.yearly': 'changes.yearlyCost' },
      })),
    ],
  },
  { path: 'src/apps/loans/scenarios/application/scenarioWrites.ts#copyScenario', from: ['name'], operations: ['copy-scenario'] },
  {
    path: 'src/apps/loans/informalLoans/application/informalLoanWrites.ts#INFORMAL_LOAN_WRITES.add',
    operations: [{ name: 'add-informal-loan', renames: { 'expected.monthly': 'expectedMonthly', 'expected.from': 'expectedFrom', 'expected.day': 'expectedDay' } }],
  },
  {
    path: 'src/apps/loans/informalLoans/application/informalLoanWrites.ts#INFORMAL_LOAN_WRITES.change',
    operations: [{ name: 'change-informal-loan', renames: { 'expected.monthly': 'expectedMonthly', 'expected.from': 'expectedFrom', 'expected.day': 'expectedDay' } }],
  },
  { path: 'src/apps/loans/informalLoans/application/informalLoanWrites.ts#MOVEMENT_WRITES.add', operations: ['add-movement'] },
  { path: 'src/apps/loans/informalLoans/application/informalLoanWrites.ts#MOVEMENT_WRITES.change', operations: ['change-movement'] },
  { path: 'src/apps/spending/accounts/application/accountWrites.ts#ACCOUNT_WRITES.add', operations: ['add-account'] },
  { path: 'src/apps/spending/accounts/application/accountWrites.ts#ACCOUNT_WRITES.change', operations: ['change-account'] },
  { path: 'src/apps/spending/accounts/application/accountWrites.ts#changeAccount', from: ['after'], operations: ['change-account'] },
  { path: 'src/apps/spending/bankSync/application/bankSetupWrites.ts#fixOpening', from: ['opening'], operations: ['fix-opening'] },
  {
    path: 'src/apps/spending/bankSync/application/bankSetupWrites.ts#addBankAccounts',
    from: ['starts'],
    operations: [{ name: 'add-bank-account', renames: Object.fromEntries(['bank', 'linked', 'account', 'rows', 'stated', 'pending', 'fetchedOn'].map((field) => [`proposal.${field}`, 'line'])) }],
  },
  { path: 'src/apps/spending/budgets/application/budgetWrites.ts#setLimit', from: ['category', 'from', 'amount'], operations: ['set-limit'] },
  { path: 'src/apps/spending/categories/application/categoryWrites.ts#CATEGORY_WRITES.add', operations: [{ name: 'add-category', renames: { order: 'move-category:direction' } }] },
  {
    path: 'src/apps/spending/categories/application/categoryWrites.ts#CATEGORY_WRITES.change',
    operations: [{ name: 'change-category', renames: { parent: 'group', order: 'move-category:direction' } }],
  },
  {
    path: 'src/apps/spending/entries/application/entryWrites.ts#writeEntry',
    from: ['entry'],
    operations: ['add-entry', 'change-entry'].map((name) => ({ name, renames: LINK_ENTRY_RENAMES })),
  },
  {
    path: 'src/apps/spending/entries/application/entryWrites.ts#writeTransfer',
    from: ['typed'],
    operations: ['add-transfer', 'change-transfer'].map((name) => ({ name, renames: { account: ['from', 'to'], amount: ['amount', 'toAmount'], ...LINK_ENTRY_RENAMES } })),
  },
  {
    path: 'src/apps/spending/entries/application/entryWrites.ts#linkEntry',
    from: ['link'],
    operations: [{ name: 'link-entry', renames: { app: 'loan', kind: 'loan', key: 'loan' } }],
  },
  {
    path: 'src/apps/spending/entries/application/entryWrites.ts#writeEntrySplit',
    type: 'src/apps/spending/entries/domain/entrySplit.ts#PartDraft',
    operations: [{ name: 'split-entry', prefix: 'parts.', renames: { id: 'parts.part' } }],
  },
  { path: 'src/apps/spending/workbook/application/settingWrites.ts#treatPayeeAsPerson', from: ['payee', 'asPerson'], operations: ['flag-person'] },
  {
    path: 'src/apps/spending/receipts/application/receiptWrites.ts#writeReceiptSplit',
    type: 'src/apps/spending/workbook/domain/receipt.ts#Receipt',
    operations: [{ name: 'add-receipt', renames: { transaction: 'entry', issuedTime: 'issuedAt' } }],
  },
  {
    path: 'src/apps/spending/receipts/application/receiptWrites.ts#writeReceiptSplit',
    type: 'src/apps/spending/workbook/domain/entryPart.ts#EntryPart',
    operations: [{ name: 'add-receipt', prefix: 'lines.', renames: { amount: 'lines.lineTotal' } }],
  },
  {
    path: 'src/apps/spending/statements/application/statementWrites.ts#writeRulesInto',
    from: ['conditions', 'category', 'withdrawal'],
    operations: [
      { name: 'add-rule', renames: { cashAccount: 'cash_account' } },
      { name: 'change-rule', renames: { cashAccount: 'cash_account' } },
    ],
  },
  {
    path: 'src/apps/spending/statements/application/statementWrites.ts#changeRule',
    from: ['condition', 'category', 'withdrawal'],
    operations: [{ name: 'change-rule', renames: { cashAccount: 'cash_account' } }],
  },
  { path: 'kuna: src/shared/text/language.ts#chooseLanguage', from: ['choice'], operations: [{ name: 'set-language', renames: { choice: 'language' } }] },
  { path: 'kuna: src/shared/theme/theme.ts#chooseTheme', from: ['choice'], operations: [{ name: 'set-theme', renames: { choice: 'theme' } }] },
  { path: 'kuna: src/shared/sync/infrastructure/autoSyncSwitch.ts#switchAutoSync', from: ['on'], operations: [{ name: 'switch-auto-sync', renames: { on: 'auto' } }] },
  { path: 'kuna: src/shared/ai/presentation/chatDock.ts#resizeChat', from: ['px'], operations: [{ name: 'set-chat-width', renames: { px: 'width' } }] },
  { path: 'src/shell/ui/sidebarLayout.ts#chooseSidebar', from: ['chosen'], operations: [{ name: 'set-sidebar-layout', renames: { chosen: 'layout' } }] },
  { path: 'kuna: src/shared/app/kunaStart.ts#answerKunaStart', from: ['start'], operations: [{ name: 'add-app', renames: { apps: 'app' } }] },
]

const GRAPH = writeGraph()
const SCREEN_WRITES = screenWrites(GRAPH)
const CHAT_EXCEPTED = new Set(CHAT_EXCEPTIONS.flatMap((exception) => exception.paths))

/** The declaration a write path names, as `file` and the top-level name. */
function declarationOf(path: string): { readonly file: string; readonly name: string } {
  const [file, rest] = path.replace(/^[a-z-]+: /, '').split('#') as [string, string]
  return { file, name: rest.replace(/\.(add|change|remove)$/, '') }
}

/** The app whose screen writes through a path, from its `app: ` start or its file. */
function appOfPath(path: string): string {
  return /^([a-z-]+): /.exec(path)?.[1] ?? appOf(declarationOf(path).file)
}

function typeFileOf(source: FieldSource): string | null {
  return source.type === undefined ? null : source.type.split('#')[0]!
}

const PROGRAM = ts.createProgram([...new Set([...FIELD_SOURCES.map((source) => declarationOf(source.path).file), ...FIELD_SOURCES.flatMap((source) => typeFileOf(source) ?? [])])], {
  strict: true,
  exactOptionalPropertyTypes: true,
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  allowArbitraryExtensions: true,
  noEmit: true,
})
const CHECKER = PROGRAM.getTypeChecker()

function topLevel(file: string, name: string): ts.Node {
  const source = PROGRAM.getSourceFile(file)
  const found = source?.statements.flatMap((statement): ts.Node[] => {
    if (ts.isVariableStatement(statement)) return statement.declarationList.declarations.filter((declaration) => ts.isIdentifier(declaration.name) && declaration.name.text === name)
    if ((ts.isFunctionDeclaration(statement) || ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) && statement.name?.text === name) return [statement]
    return []
  })[0]
  if (found === undefined) throw new Error(`${file} declares no ${name}`)
  return found
}

function withoutNull(type: ts.Type): ts.Type[] {
  return (type.isUnion() ? type.types : [type]).filter((member) => (member.flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined)) === 0)
}

/** The item of a list, or the first of a pair. */
function elementOf(type: ts.Type): ts.Type {
  return CHECKER.isArrayType(type) || CHECKER.isTupleType(type) ? CHECKER.getTypeArguments(type as ts.TypeReference)[0]! : type
}

/** Whether a type is a record of fields rather than one value, such as a brand, a date or a list. */
function isRecord(type: ts.Type): boolean {
  if (type.isIntersection()) return type.types.every(isRecord)
  return (type.flags & ts.TypeFlags.Object) !== 0 && !CHECKER.isArrayType(type) && !CHECKER.isTupleType(type) && type.getCallSignatures().length === 0 && type.getSymbol()?.name !== 'Date'
}

/** Each field of a record, a field of a record inside it named `field.member`, and a list as one field. */
function fieldsOf(records: readonly ts.Type[], prefix = '', depth = 0): string[] {
  const properties = new Map(records.flatMap((record) => CHECKER.getPropertiesOfType(record)).map((property) => [property.name, property]))
  return [...properties.values()].flatMap((property) => {
    const declaration = property.valueDeclaration ?? property.declarations?.[0]
    const inner = withoutNull(declaration === undefined ? CHECKER.getTypeOfSymbol(property) : CHECKER.getTypeOfSymbolAtLocation(property, declaration))
    const name = `${prefix}${property.name}`
    return depth < 1 && inner.length > 0 && inner.every(isRecord) ? fieldsOf(inner, `${name}.`, depth + 1) : [name]
  })
}

/** The name of a record's type, or of the type a parameter is declared with, such as `SpendingRuleCondition`. */
function ownerOf(type: ts.Type, declared?: ts.TypeNode): string {
  const named = declared === undefined ? undefined : namedTypeOf(declared)
  if (named !== undefined) return named
  const record = withoutNull(type)[0]!
  return type.aliasSymbol?.name ?? record.aliasSymbol?.name ?? record.getSymbol()?.name ?? CHECKER.typeToString(record)
}

function namedTypeOf(node: ts.TypeNode): string | undefined {
  if (ts.isTypeReferenceNode(node)) return node.typeName.getText()
  if (ts.isUnionTypeNode(node)) return node.types.map(namedTypeOf).find((name) => name !== undefined)
  if (ts.isTypeOperatorNode(node)) return namedTypeOf(node.type)
  if (ts.isArrayTypeNode(node)) return namedTypeOf(node.elementType)
  if (ts.isTupleTypeNode(node)) return node.elements[0] === undefined ? undefined : namedTypeOf(node.elements[0] as ts.TypeNode)
  return undefined
}

/** The literal values of a list's `column`, each a field of the list. */
function columnsOf(type: ts.Type, list: string): string[] {
  const listed = CHECKER.getPropertyOfType(withoutNull(type)[0]!, list)!
  const column = CHECKER.getPropertyOfType(elementOf(withoutNull(CHECKER.getTypeOfSymbol(listed))[0]!), 'column')!
  const values = withoutNull(CHECKER.getTypeOfSymbol(column))
  return values.map((value) => `${list}.${(value as ts.StringLiteralType).value}`)
}

/** An editor's fields as `app: Owner.field`, from the types of its source. */
function editorFields(source: FieldSource): readonly { readonly key: string; readonly field: string }[] {
  const { file, name } = declarationOf(source.path)
  const app = appOfPath(source.path)
  const listed = (type: ts.Type, owner: string) => {
    const columns = source.columns
    const fields = fieldsOf(withoutNull(type)).flatMap((field) => (field === columns ? columnsOf(type, columns) : [field]))
    return fields.map((field) => ({ key: `${app}: ${owner}.${field}`, field }))
  }
  if (source.type !== undefined) {
    const [typeFile, typeName] = source.type.split('#') as [string, string]
    const type = CHECKER.getTypeAtLocation(topLevel(typeFile, typeName))
    return listed(type, typeName)
  }
  const declaration = topLevel(file, name)
  if (ts.isVariableDeclaration(declaration)) {
    const rules = CHECKER.getTypeAtLocation(declaration.name)
    const record = CHECKER.getTypeArguments(rules as ts.TypeReference)[0]!
    return listed(record, ownerOf(record))
  }
  const parameters = (declaration as ts.FunctionDeclaration).parameters.filter((parameter) => (source.from ?? []).includes(parameter.name.getText()))
  expect(
    parameters.map((parameter) => parameter.name.getText()),
    `${source.path} takes ${(source.from ?? []).join(', ')}`,
  ).toEqual(source.from ?? [])
  return parameters.flatMap((parameter) => {
    const type = elementOf(CHECKER.getNonNullableType(CHECKER.getTypeAtLocation(parameter)))
    return withoutNull(type).every(isRecord) ? listed(type, ownerOf(type, parameter.type)) : [{ key: `${app}: ${name}.${parameter.name.getText()}`, field: parameter.name.getText() }]
  })
}

/** Each field an input takes, by its path, such as `parts.amount` for a list's items. */
function inputFields(schema: StrictSchema, prefix = ''): string[] {
  const held = schema as { readonly properties?: Readonly<Record<string, StrictSchema>>; readonly items?: StrictSchema; readonly anyOf?: readonly StrictSchema[] }
  const own = Object.entries(held.properties ?? {}).flatMap(([name, inner]) => [`${prefix}${name}`, ...inputFields(inner, `${prefix}${name}.`)])
  return [...own, ...(held.items === undefined ? [] : inputFields(held.items, prefix)), ...(held.anyOf ?? []).flatMap((inner) => inputFields(inner, prefix))]
}

function operationOf(app: string, name: string): AssistantOperation | undefined {
  return APP_OPERATIONS.get(app)?.find((operation) => operation.name === name)
}

function takes(app: string, operation: OperationFields, field: string): boolean {
  const renamed = operation.renames?.[field] ?? `${operation.prefix ?? ''}${field}`
  return (typeof renamed === 'string' ? [renamed] : renamed).every((name) => {
    const [other, inOther] = name.includes(':') ? (name.split(':') as [string, string]) : [operation.name, name]
    const input = operationOf(app, other)?.input
    return input !== undefined && inputFields(input).includes(inOther)
  })
}

function operationsOf(source: FieldSource): readonly OperationFields[] {
  return source.operations.map((operation) => (typeof operation === 'string' ? { name: operation } : operation))
}

/** Each field an operation of its source does not take, as `app: Owner.field` beside the operation. */
const GAPS = FIELD_SOURCES.flatMap((source) => {
  const app = appOfPath(source.path)
  const operations = operationsOf(source).filter((operation) => operationOf(app, operation.name) !== undefined)
  return editorFields(source).flatMap(({ key, field }) => {
    const missing = operations.filter((operation) => !takes(app, operation, field))
    const gap = source.anyOperation === true ? missing.length === operations.length : missing.length > 0
    return gap ? [{ key, operations: missing.map((operation) => `${app}/${operation.name}`) }] : []
  })
})
/** Each app's settings keys, which its screens save as rows of its settings, the pack's among Company's. */
const SETTING_KEYS: ReadonlyMap<string, readonly string[]> = new Map([
  ['spending', [...SPENDING_SETTING_CHECKS.keys()]],
  ['investments', [...INVESTMENT_SETTING_CHECKS.keys()]],
  ['company', [...SETTING_DEFINITIONS, ...(installedPack().workbook?.settings.definitions ?? [])].map((definition) => definition.key)],
])

/** The keys an app's set-setting takes, from the enum of its key input. */
function settableKeys(app: string): readonly string[] {
  const input = operationOf(app, 'set-setting')?.input as { readonly properties?: { readonly key?: { readonly enum?: readonly string[] } } } | undefined
  return input?.properties?.key?.enum ?? []
}

/** Each settings key an app's set-setting does not take, as `app: Setting.key`. */
const SETTING_GAPS = [...SETTING_KEYS].flatMap(([app, keys]) => {
  const settable = new Set(settableKeys(app))
  return keys.filter((key) => !settable.has(key)).map((key) => `${app}: Setting.${key}`)
})

const EXCEPTED_FIELDS = new Set(FIELD_EXCEPTIONS.flatMap((exception) => exception.fields))
const NO_FIELDS = new Set(NO_FIELD_PATHS.flatMap((exception) => exception.paths))
const SOURCED = new Set(FIELD_SOURCES.map((source) => source.path))

describe('every field and settings key a screen sets has a chat operation that takes it, or a listed exception', () => {
  it('finds the fields of every write path a screen uses, or lists a path that sets no field', () => {
    const unlisted = [...SCREEN_WRITES.keys()].filter((path) => !path.includes('store.') && !CHAT_EXCEPTED.has(path) && !SOURCED.has(path) && !NO_FIELDS.has(path))
    expect(unlisted, 'Add the path to FIELD_SOURCES, or to NO_FIELD_PATHS in tests/chatFieldCoverageExceptions.ts with a reason').toEqual([])
  })

  it('names only paths a screen writes through and operations that exist', () => {
    const unknownPaths = [...SOURCED, ...NO_FIELDS].filter((path) => !SCREEN_WRITES.has(path))
    const unknownOperations = FIELD_SOURCES.flatMap((source) =>
      operationsOf(source)
        .filter((operation) => operationOf(appOfPath(source.path), operation.name) === undefined)
        .map((operation) => `${source.path} ${operation.name}`),
    )
    expect({ unknownPaths, unknownOperations }).toEqual({ unknownPaths: [], unknownOperations: [] })
  })

  it('has an operation take each field a screen sets, or lists it with a reason', () => {
    const gaps = GAPS.filter((gap) => !EXCEPTED_FIELDS.has(gap.key)).map((gap) => `${gap.key} (${gap.operations.join(', ')})`)
    expect(gaps, 'Add the field to the operation, or a reason in tests/chatFieldCoverageExceptions.ts').toEqual([])
  })

  it('has set-setting take each settings key a screen saves, or lists it with a reason', () => {
    expect(
      SETTING_GAPS.filter((key) => !EXCEPTED_FIELDS.has(key)),
      "Let the app's set-setting take the key through the screen's own check, or add a reason in tests/chatFieldCoverageExceptions.ts",
    ).toEqual([])
  })

  it('lists no field an operation takes or no screen sets', () => {
    const gapKeys = new Set([...GAPS.map((gap) => gap.key), ...SETTING_GAPS])
    expect(
      [...EXCEPTED_FIELDS].filter((key) => !gapKeys.has(key)),
      'Take these out of tests/chatFieldCoverageExceptions.ts',
    ).toEqual([])
  })

  it('lists each path and field once, and a path either way', () => {
    const paths = NO_FIELD_PATHS.flatMap((exception) => exception.paths)
    const fields = FIELD_EXCEPTIONS.flatMap((exception) => exception.fields)
    expect(paths.filter((path) => SOURCED.has(path) || CHAT_EXCEPTED.has(path))).toEqual([])
    expect(paths.length).toBe(NO_FIELDS.size)
    expect(fields.length).toBe(EXCEPTED_FIELDS.size)
  })
})
