import type { CivilDate } from '../../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../../shared/calendar/dayLabel'
import type { MonthKey } from '../../../../../shared/calendar/monthKey'
import { monthLabel } from '../../../../../shared/calendar/monthLabel'
import { withFullStop } from '../../../../../shared/text/withFullStop'
import { formatRate } from '../../../../../shared/money/moneyFormat'
import { language } from '../../../../../shared/text/language'
import type { EnglishForms, Translation } from '../../../../../shared/text/translation'
import { croatianBucket } from '../../../settings/domain/words'
import { uncapitalised } from '../../../../../shared/text/capitalised'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// The accountant is knjigovođa, a loan to the owner pozajmica vlasniku. A subject phrase such as Plaća za is the accountant's own words, so it is never translated.

const ENGLISH_LOAN_NOTE = ' Loans to the owner and their repayments stay out, since a loan is not pay.'
const ENGLISH_RENT_NOTE = ' Rent counts after the rent tax, which the owner pays the tax office out of it.'
const CROATIAN_LOAN_NOTE = ' Pozajmice vlasniku i njihovi povrati nisu uključeni jer pozajmica nije isplata.'
const CROATIAN_RENT_NOTE = ' Najam se broji nakon poreza na najam, koji vlasnik iz njega plaća Poreznoj upravi.'

export const en = {
  /** The pack's question on the company step of onboarding. */
  onboarding: {
    question: 'Is this a Croatian d.o.o. that pays its owner?',
    yes: 'Yes, add owner pay, taxes and year end',
  },
  /** The company and owner facts card of Settings, General. */
  facts: {
    title: 'Company and owner facts',
    subtitle: "What the tax figures need to know beyond the law. They stay in this workbook. The owner's facts for the payroll are on the director's row on Salaries.",
    summary: (registered: CivilDate | null, basisPoints: number) =>
      `${registered === null ? 'The registration day is not set' : `Registered on ${dayLabel(registered)}`}. Loans to the owner carry ${basisPoints / 100}%.`,
    registered: 'Company registered on',
    registeredHelp: 'Starts the first tax period.',
    loanInterest: "Interest the owner's loans carry, % a year",
    loanInterestHelp: "Below the income tax law's rate, the difference on each day's balance is a benefit in kind, which Year works out.",
    citReturn: 'Corporate tax return',
    pd: 'PD, on the accrual profit',
    pdNn: 'PD-NN, on cash received and paid',
    vatPrinciple: 'VAT falls due',
    onInvoice: 'On the invoice date',
    onPayment: 'When it is paid',
    doubled: 'Depreciation rates are doubled',
    doubledHelp: 'The default for assets. An asset row can still say otherwise.',
    accountantMail: "The accountant's mail",
    accountantMailNote: 'Each sync looks in Gmail for the kinds switched on and files what is new into their folders, which the Mail card lists. Nothing in the app reads those files.',
    accountantFrom: 'The accountant mails from',
    accountantFromHelp: 'Mail addresses, comma separated, which every kind below searches for.',
    notRead: 'Not read',
    notSet: 'Not set',
    kindOffNote: 'Off makes no Gmail or Drive call for it.',
    payroll: {
      label: 'Read the payroll mail',
      subject: 'Payroll subject starts with',
      subjectHelp: 'The words before the month, such as Plaća za.',
      folder: 'Payroll folder',
      folderHelp: 'Where it goes in Google Drive, as a path from My Drive, with a folder for each year and month inside.',
    },
    vat: {
      label: 'Read the VAT return mail',
      subject: 'VAT return subject starts with',
      subjectHelp: 'The words before the period, such as PDV za.',
      folder: 'VAT returns folder',
      folderHelp: 'Where it goes in Google Drive, as a path from My Drive, with a folder for each year inside.',
    },
    invoices: {
      label: "Read the accountant's invoice mail",
      subject: 'Invoice subject starts with',
      subjectHelp: "The words the accountant's own invoice mail starts with, such as Račun za.",
      folder: "Accountant's invoices folder",
      folderHelp: 'Where it goes in Google Drive, as a path from My Drive, with a folder for each year and month inside.',
    },
  },
  /** The switch of Settings, General that puts loans to the owner in owner pay or in financing. */
  loanBucket: {
    title: 'Loans to the owner',
    subtitle: 'From the categories tab: the bucket of the categories with the owner-loan-out and owner-loan-repaid roles.',
    none: 'No category carries the owner-loan-out or owner-loan-repaid role, so there is nothing to switch.',
    label: 'Loans to the owner count as owner pay',
    on: 'On: a loan is pay taken early and its repayment pay handed back, so both count in owner pay, costs and net. Off moves both to financing, outside profit and loss.',
    off: 'Off: loans and their repayments are financing, outside profit and loss. On moves both into owner pay, where they count in costs and net.',
    mixed: (listed: string) => `The loan categories sit in different buckets now: ${listed}. Switching puts both in one.`,
    inBucket: (category: string, bucket: string) => `${category} (${bucket})`,
    countAsPay: 'Loans count as owner pay',
    countAsFinancing: 'Loans count as financing',
    moved: (categories: string, bucket: string) => `The categories tab now puts ${categories} in the ${bucket} bucket.`,
    notChanged: 'Not changed',
  },
  /** The pack's lines on Overview's Waiting for you card. */
  waiting: {
    unaccounted: (count: number): EnglishForms => ({
      one: 'A reimbursement to the owner has no cost on file',
      other: `${count} reimbursements to the owner have no cost on file`,
    }),
    watchedTaxesMissed: (count: number, latest: string): EnglishForms => ({
      one: `${count} month of watched taxes has no payment, the latest ${latest}`,
      other: `${count} months of watched taxes have no payment, the latest ${latest}`,
    }),
    missedOnce: (category: string, month: string) => `${category}: no payment landed in ${month}`,
    missedMonths: (category: string, count: number, latest: string): EnglishForms => ({
      one: `${category}: no payment landed in ${count} month, the latest ${latest}`,
      other: `${category}: no payment landed in ${count} months, the latest ${latest}`,
    }),
    taxOverdue: (count: number, owed: string): EnglishForms => ({
      one: `A corporate tax payment is overdue, ${owed} still owed`,
      other: `${count} corporate tax payments are overdue, ${owed} still owed`,
    }),
    taxDue: (count: number, day: string, owed: string): EnglishForms => ({
      one: `A corporate tax payment falls due by ${day}, ${owed}`,
      other: `${count} corporate tax payments fall due by ${day}, ${owed}`,
    }),
  },
  /** The pack's pages as a link names them, a page and its tab. */
  links: { review: 'Review', yearTaxes: 'Year, Taxes', ownerTaken: 'Owner, Taken' },
  /** Review's card of reimbursements to the owner that no cost on file accounts for. */
  unaccounted: {
    title: (count: number): EnglishForms => ({ one: `${count} reimbursement with no cost on file`, other: `${count} reimbursements with no cost on file` }),
    summary: (total: string) => `${total} in all, counted as paid to the owner`,
    subtitle: 'Paid to the owner on a reimbursement category, with no cost on the owner-advances tab to repay. Net owed counts each as paid to the owner until its cost is added.',
    reimbursement: 'Reimbursement',
    paid: (day: string) => `Paid ${day}`,
    partOf: 'of',
    openRow: (day: string) => `Reimbursement of ${day}, open the row`,
    addCost: 'Add the cost',
    addCostOf: (day: string) => `Add the cost the reimbursement of ${day} repaid`,
  },
  /** The pack's screens as the menu and their headers name them. */
  screens: { owner: 'Owner', year: 'Year', salaries: 'Salaries' },
  /** The Owner screen's header and tabs. */
  owner: {
    description: 'What the owner took out, and who owes whom between the owner and the company.',
    addAdvance: 'Add advance',
    comparePayMixes: 'Compare pay mixes',
    tabs: { label: 'What the owner took and who owes whom', taken: 'Taken', owed: 'Who owes whom' },
    /** What each tab leaves out while no category carries a role it reads. */
    leftOut: {
      loanOut: 'no loan to the owner is listed',
      loanRepaid: 'no repayment is matched to a loan',
      payTax: 'gross cost is owner pay alone',
      reimbursement: 'no reimbursement repays an advance',
    },
  },
  /** The line that names a category role no category carries. */
  missingRoles: {
    before: 'No category has the role ',
    after: (leftOut: string) => `, so ${leftOut}.`,
    addRoles: 'Add roles on Settings, Categories',
  },
  /** What the accrual view gets wrong while no category carries a role it reads. */
  accrualLeftOut: {
    revenue: 'client payments stay in profit beside the revenue the invoices deliver',
    grant: 'a grant counts as income when it arrives, beside its release',
    capitalPurchase: 'an asset finds its payment only by its ledger_reference, and an unclaimed purchase counts as a cost',
    arrears: 'salary, its taxes and rent count in the month they were paid',
    prepaidAnnual: 'a policy paid a year ahead counts in the month it was paid',
    vatSettlement: 'VAT paid to the state or refunded counts in profit',
    corporateIncomeTax: 'corporate tax paid counts as a cost beside the tax of the year',
    profitDistribution: 'dividends and their tax count as costs',
    representation: 'no representation is added back to the tax base',
    personalTransport: 'PD line 7 adds back no personal transport',
    nonDeductible: 'PD lines 9, 11 and 24 add back no fine or private cost',
  },
  ownerPayOff: {
    title: 'The owner-pay module is off',
    description: 'This workbook sets owner_pay_module to FALSE, so owner pay counts as operating cost and this screen has nothing to show.',
    openSettings: 'Open Settings',
  },
  /** A figure that opens how it is worked out. */
  figure: {
    howItIsWorkedOut: (label: string) => `${label}, how it is worked out`,
    stepByStep: 'Step by step',
    rules: 'Rules',
    openRows: (label: string) => `${label}, open the rows`,
    openRule: (title: string) => `${title}, open the rule`,
    stillToSettle: 'Rules still to be settled',
    watched: { estimate: 'Values the ruleset only estimates', pending: 'Values set by a bill or a draft that is not law yet', unconfirmed: 'Values not yet confirmed against their source' },
    andMore: (count: number) => `and ${count} more`,
  },
  /** The build-up of the monthly net with the profit included. */
  ownerNet: {
    title: 'Monthly net, profit included',
    months: (count: number): EnglishForms => ({ one: `${count} month`, other: `${count} months` }),
    profitBeforeTax: (span: string) => `Profit before tax, ${span}`,
    paidOutOf: (year: number) => `Paid in ${year + 1} out of ${year}`,
    pay: (months: string) => `Pay without loans and dividends, ${months}`,
    dividendsLeftOut: 'Dividends left out, since the profit counts them',
    payAfterRentTax: 'Pay after the rent tax',
    noProfitMonth: 'No complete month of profit yet',
    profitAfterTaxes: (months: string) => `Profit after both taxes, ${months}`,
    payAMonth: 'Pay a month',
    profitAMonth: 'From profit a month',
    paidOutAlready: 'Paid out of it as dividends already',
    leftInCompany: 'Left in the company',
    setsOff: (day: string) => `Of it, sets off what the owner owes on ${day}`,
    subtitle: (period: string, payMonths: string, profitMonths: string | null) =>
      `${period}. Pay over ${payMonths}, profit over ${profitMonths === null ? 'no complete month' : `${profitMonths} up to the last complete month`}. The profit is the company's, so it follows the period alone.`,
  },
  /** The bridge chart of steps from one total to another. */
  bridge: {
    raises: 'Raises profit',
    lowers: 'Lowers profit',
    total: 'Total',
    residual: 'Not explained',
    amount: 'Amount',
    none: 'No bridge to show.',
    description: (first: string, firstAmount: string, steps: string, last: string | null) =>
      `From ${first} of ${firstAmount}, one bar per step: ${steps}${last === null ? '.' : `. The last bar is ${uncapitalised(last)}.`}`,
  },
  /** The Taken tab of the Owner screen. */
  taken: {
    take: 'Owner take',
    takeFromCosts: (amount: string) => `${amount} of it from company costs`,
    loansIn: 'Loans in, repayments out',
    loansOut: 'Loans left out, as financing',
    takeDefinition: (payLabel: string, loansArePay: boolean, benefitName: string | null, rentTaxed: boolean) =>
      (loansArePay
        ? `Everything in the ${uncapitalised(payLabel)} bucket over the period in view. A loan to the owner is pay taken early and its repayment is pay handed back, so both count. Reimbursements settle costs and are left out.`
        : `Everything in the ${uncapitalised(payLabel)} bucket over the period in view. Loans to the owner are in the financing bucket, so neither they nor their repayments count. Reimbursements settle costs and are left out.`) +
      (benefitName === null ? '' : ` ${benefitName}, the owner's parts of company costs, count too.`) +
      (rentTaxed ? `${ENGLISH_RENT_NOTE} The rows it opens add up to more by that tax.` : ''),
    payments: (count: number): EnglishForms => ({ one: `${count} payment`, other: `${count} payments` }),
    benefitsDefinition:
      "The owner's parts of company costs, at each row's owner share. They count as owner pay with no tax on them. The share is your own estimate, and the accountant books these costs in full.",
    grossCost: 'Gross cost of the owner',
    taxOnPay: (amount: string) => `${amount} of it tax on the pay`,
    grossCostDefinition: (rentTaxed: boolean) =>
      `Owner take plus the taxes owed because the owner was paid, the categories with the owner-pay-tax role${rentTaxed ? ', and the rent tax the owner pays out of the rent' : ''}. Corporate income tax stays out.`,
    netShare: 'Net share of gross cost',
    nothingPaid: 'Nothing paid to the owner',
    netShareOf: (withoutLoans: string, gross: string) => `${withoutLoans} of ${gross} gross cost`,
    netShareDefinition: (loansArePay: boolean, rentTaxed: boolean, benefitName: string | null) =>
      `How much of what the company spent on paying the owner reached the owner: the owner take without loans over itself plus the taxes owed because the owner was paid. ` +
      `100% would mean no tax on top.${loansArePay ? ENGLISH_LOAN_NOTE : ''}${rentTaxed ? ENGLISH_RENT_NOTE : ''}${benefitName === null ? '' : ` ${benefitName} count in the take and carry no tax, so they raise it.`}`,
    monthlyNetPay: 'Monthly net pay',
    noMonthInView: 'No month of the ledger in view',
    over: (amount: string, months: number): EnglishForms => ({ one: `${amount} over ${months} month`, other: `${amount} over ${months} months` }),
    monthlyNetPayDefinition: (payLabel: string, loansArePay: boolean, rentTaxed: boolean, benefitName: string | null) =>
      `What the owner was paid a month from every owner pay category, such as salary, bonus, dividend and rent${benefitName === null ? '' : `, ${uncapitalised(benefitName)} included`}: the owner take without loans over the months of the period. ` +
      `A rolling window leaves out the month so far, which the chart of ${uncapitalised(payLabel)} by month draws. Any other period counts a month the ledger covers only in part, such as the month so far, as a whole month, as the chart does.${loansArePay ? ENGLISH_LOAN_NOTE : ''}${rentTaxed ? ENGLISH_RENT_NOTE : ''}`,
    netDefinition:
      'What the owner earns a month once the profit counts as the months earn it. Pay is the owner take without loans and dividends over the months of the period, the rent after the rent tax. A rolling window leaves out the month so far. ' +
      'Profit is the profit before tax of the period up to the last complete month, as Year counts it, less corporate tax at the rate Year works out for each year and dividend tax, over those months. ' +
      'A dividend pays out profit those months already count, so pay leaves it out. The profit is the company’s, so it follows the period and not the other filters.',
    noProfitMonth: 'No complete month of profit yet',
    payAndProfit: (pay: string, profit: string, sinceTheStart: boolean) => `${pay} pay and ${profit} from profit, a month${sinceTheStart ? ', since the ledger began' : ''}`,
    notWorkedOut: (reason: string) => `Could not be worked out. ${reason}`,
    profitNeeds: 'The profit needs ',
    setOnSettings: 'Set it on Settings',
    profitFollowsPeriod: 'The profit follows the period only.',
    ring: {
      title: 'Owner take by type',
      subtitle: (period: string) => `${period}. Paid to the owner on balance, by category.`,
      definition:
        'Each owner pay category the company paid out more than it took back, as a share of the ring. Loans can be negative, so they sit under the ring with the rent tax the owner pays out of the rent, and with it they make the owner take. Beside the ring, what the owner owed the company at the end of each month, over every loan since the ledger began.',
      ownerTake: 'owner take',
      withoutLoans: 'without loans',
      paidOut: 'paid out',
      nothing: (period: string) => `Nothing was paid to the owner in ${period}.`,
      description: (period: string, shares: string, aside: string, total: string) => `Owner take by type in ${period}: ${shares}.${aside} Together ${total}.`,
      inAll: (total: string) => `${total} in all`,
      loanBalance: 'Owed by the owner at each month end, all loans since the ledger began',
      salariesLink: 'Salaries',
      salariesSplit: ' splits each salary into net pay, pension savings, tax and health.',
      reimbursementsOutside: 'Outside the owner take, since they settle costs:',
    },
    byMonth: (payLabel: string) => `${payLabel} by month`,
    drawsSubtitle: (period: string, rentTaxed: boolean) => `${period}. Loans and their repayments as one net band, and money handed back${rentTaxed ? ' and the rent tax' : ''} below zero.`,
    monthSoFar: 'Month so far',
  },
  /** The Who owes whom tab of the Owner screen. */
  owed: {
    partOf: (amount: string, payee: string, day: string) => `Part of ${amount} to ${payee || 'a payee'} on ${day}`,
    netOwed: 'Net owed',
    direction: (balance: number, on: string) => `${balance > 0 ? 'The owner owes the company' : balance < 0 ? 'The company owes the owner' : 'Nothing owed either way'} on ${on}`,
    definition: (on: string, loanBalance: string, advancesOutstanding: string, unaccounted: string | null) =>
      `One balance across both directions, as the books stood on ${on}, the last day of the period or the newest booking. The owner owes the company what was lent, private costs and the owner's parts of split company payments included, ` +
      `less what the owner paid back on a loan or reimbursement category (${loanBalance}). ` +
      `The company owes the owner the costs the owner paid privately and has not been reimbursed for (${advancesOutstanding}). ` +
      (unaccounted === null ? '' : `That figure counts the reimbursements with no cost on file (${unaccounted}) as paid to the owner until their costs are added. `) +
      'Positive means the owner owes the company. A private cost the company paid in full counts as lent only when its row is in a category with the owner-loan-out role.',
    noMonths: 'No months to show',
    lentAndRepaid: (lent: string, repaid: string) => `${lent} lent, ${repaid} repaid`,
    loanFigures: ['Owed at the start', 'Lent', 'Repaid', 'Owed at the end'] as const,
    advanceFigures: ['Owed at the start', 'Paid by the owner', 'Reimbursed', 'Owed at the end'] as const,
    advancesSummary: (count: number, owed: string, on: string): EnglishForms => ({
      one: `${count} cost, ${owed} owed to the owner on ${on}`,
      other: `${count} costs, ${owed} owed to the owner on ${on}`,
    }),
    loansSummary: (count: number, open: number, on: string): EnglishForms => ({
      one: `${count} loan, ${open === 0 ? 'none open' : `${open} open`} on ${on}`,
      other: `${count} loans, ${open === 0 ? 'none open' : `${open} open`} on ${on}`,
    }),
    otherFilters: 'Who owes whom follows the period only. The accounts and the other filters apply on Taken.',
    unaccounted: (count: number): EnglishForms => ({
      one: `Whatever the period, ${count} reimbursement to the owner with no cost on file waits on Review. Net owed counts it as paid to the owner until the cost is added.`,
      other: `Whatever the period, ${count} reimbursements to the owner with no cost on file wait on Review. Net owed counts them as paid to the owner until the cost is added.`,
    }),
    openReview: 'Open Review',
    loans: {
      title: 'Every loan, with the repayments that closed it',
      subtitle: (period: string, on: string) =>
        `${period}. Each loan with a balance in the period, as it stood on ${on}, private costs and the owner's parts of split company payments included. Repayments first close the loans they equal exactly. The rest go to the oldest open loan first, and one that outruns a loan carries on to the next.`,
      open: (count: number, oldest: string) => `${count} open, the oldest from ${oldest}.`,
      noneOpen: 'None open.',
      empty: (period: string) => `No loan to the owner had a balance in ${period}.`,
    },
    advances: {
      title: 'Costs the owner paid privately',
      subtitle: (period: string, on: string) =>
        `${period}, from the owner-advances tab. Each cost owed in the period, as it stood on ${on}. Each counts as a cost on its date, in its category. Reimbursements to the owner first repay the costs they equal exactly, and the rest repay the oldest first. They stay outside profit and loss.`,
      empty: (period: string) => `No cost the owner paid privately was owed in ${period}.`,
    },
    timeline: {
      title: 'Loans to the owner, by month',
      subtitle: (period: string) => `${period}. Lent below zero and repaid above it.`,
      definition: "What was lent to the owner and repaid each month. The balance at each month's end is beside the ring on Taken.",
    },
  },
  /** The dialog that adds or changes a cost the owner paid privately. */
  advanceDialog: {
    addTitle: 'Add an advance',
    changeTitle: 'Change the advance',
    addDescription: 'A cost the owner paid privately for the company. It counts as a cost on its date, and reimbursements to the owner repay it.',
    changeDescription: 'A cost the owner paid privately for the company, on the owner-advances tab. Only the cells you change are written.',
    dateError: 'A date, such as 2026-10-14',
    amountError: 'A positive amount with at most two decimals',
    categoryError: 'Choose the cost it was',
    added: 'Advance added',
    changed: 'Advance changed',
    deleted: 'Advance deleted',
    notAdded: 'Not added',
    notChanged: 'Not changed',
    notDeleted: 'Not deleted',
    openIt: 'Open it',
    asCategory: (amount: string, category: string) => `${amount} as ${category}.`,
    outside: (period: string) => ` Outside the period in view, ${period}, so the page does not list it.`,
    date: 'Date',
    amount: 'Amount',
    amountPlaceholder: '0.00',
    category: 'Category',
    categoryHelp: 'Operating costs and taxes only.',
    chooseCategory: 'Choose a category',
    searchCategories: 'Search categories',
    forWhat: 'What it was for',
    forWhatPlaceholder: 'Train tickets to the client',
    splitInstead: 'Part of a payment the company made was yours? Split that payment on Transactions instead.',
    delete: 'Delete advance',
    cancel: 'Cancel',
    save: 'Save advance',
    add: 'Add advance',
  },
  /** The lists of costs the owner paid privately and of loans to the owner. */
  advanceList: {
    openRow: (day: string) => `Advance of ${day}, open the row`,
    owedToOwner: 'Owed to the owner',
    reimbursed: 'Reimbursed',
    stillOwed: ' still owed',
    reimbursedOn: (day: string) => `Reimbursed ${day}`,
    edit: (day: string) => `Change or delete the advance of ${day}`,
    matched: (day: string) => `Reimbursements matched to the advance of ${day}`,
    reimbursementRow: (day: string) => `Reimbursement of ${day}, open the row`,
  },
  loanList: {
    openRow: (day: string) => `Loan of ${day}, open the row`,
    open: 'Open',
    repaid: 'Repaid',
    stillOwed: ' still owed ',
    closedOn: (day: string) => `Closed ${day}`,
    nothingLent: 'Nothing lent on this row',
    matched: (day: string) => `Repayments matched to the loan of ${day}`,
    repaymentRow: (day: string) => `Repayment of ${day}, open the row`,
  },
  /** The corporate tax payments the schedule expects, beside what was paid. */
  citObligations: {
    status: { paid: 'Paid', due: 'Due this month', overdue: 'Overdue', 'to-come': 'To come' },
    due: (day: string) => `Due ${day}`,
    payment: 'Payment',
    dueColumn: 'Due',
    expected: 'Expected',
    paid: 'Paid',
    stillOwed: 'Still owed',
    statusColumn: 'Status',
    paidRows: (label: string) => `${label}, paid, open the rows`,
  },
  /** The card of the owner's parts of shared company costs. */
  benefits: {
    estimate: 'Your estimate of private use. The accountant books these costs in full.',
    atShare: (category: string, share: string, amount: string) => `${category} at ${share} ${amount}`,
    mixed: 'mixed',
    description: (title: string, period: string, listed: string, total: string) => `${title} in ${period}, by the category each comes from: ${listed}. Together ${total}.`,
    asDividend: (title: string, period: string) =>
      `${title} in ${period}, taken out as a dividend instead: corporate tax at the rate Year works out for the year each was paid in, then dividend tax at the rate of the year after.`,
    noneShared: (period: string) => `No company cost in ${period} was shared with the owner.`,
    setDefaults: 'Set the defaults',
    subtitle: (period: string) => `${period}. The owner's parts of company costs, by the category they come from.`,
    definition: 'Each category whose costs were shared with the owner, with the owner share its rows were counted at, or mixed when they differ. They count as owner pay with no tax on them.',
    toTheOwner: 'to the owner',
    taxAvoided: 'Tax avoided against a dividend',
    wouldNet: 'As a dividend you would net',
    dividendNeeds: 'The tax a dividend would cost needs ',
    dividendNeedsAfter: ', the day the first tax period starts.',
    setOnSettings: 'Set it on Settings',
    notWorkedOut: (reason: string) => `The tax a dividend would cost could not be worked out. ${reason}`,
  },
  /** The series and the read-aloud text of the pack's charts. */
  charts: {
    otherCategories: 'Other categories',
    loansNet: 'Loans, net',
    rentTax: 'Rent tax the owner pays the tax office',
    lent: 'Lent',
    repaid: 'Repaid',
    owedByOwner: 'Owed by the owner',
    noMonths: 'No months to show.',
    span: (from: MonthKey, to: MonthKey) => `from ${monthLabel(from)} to ${monthLabel(to)}`,
    taxesByMonth: (span: string, series: string, total: string) => `Taxes paid by month ${span}, stacked by ${series}. ${total} in all, net of refunds.`,
    ownerPayByMonth: (span: string, series: string, total: string) => `Owner pay by month ${span}, stacked by ${series}. ${total} in all.`,
    loansByMonth: (span: string, lent: string, repaid: string) => `Loans to the owner by month ${span}: money lent below zero and repayments above it. ${lent} lent and ${repaid} repaid in all.`,
    owedAtMonthEnds: (span: string, complete: boolean, month: string, owed: string) =>
      `What the owner owed the company at each month's end ${span}. ${complete ? 'At the end of' : 'So far in'} ${month} the owner owed ${owed}.`,
  },
  /** The columns of the pack's tab editors, by the field each stores. */
  assetColumns: {
    asset: 'Asset',
    bought: 'Bought',
    in_use: 'In use from',
    cost_net: 'Cost without VAT',
    group: 'Group',
    doubled: 'Doubled rate',
    disposed: 'Disposed',
    funded_by: 'Funded by',
    noGrant: 'No grant',
    ledger_reference: 'Ledger reference',
    note: 'Note',
  },
  grantColumns: {
    grant: 'Grant',
    received: 'Received',
    amount: 'Amount',
    fixed_part: 'Fixed part',
    variable_part: 'Variable part',
    period_from: 'Period from',
    period_to: 'Period to',
    release: 'Release',
    blankRelease: 'Blank, fixed-then-assets',
    clawback_year1: 'Clawback, year 1',
    clawback_year2: 'Clawback, year 2',
    clawbackPlaceholder: 'whole or amount',
    employment_required_until: 'Employment until',
    note: 'Note',
  },
  yearEndColumns: {
    year: 'Year',
    statement: 'Statement',
    line: 'Line',
    kontoNumber: 'Konto number',
    choose: 'Choose',
    label: 'As printed',
    amount: 'Amount',
    categories: 'Categories',
    commaSeparated: 'Comma separated',
    aop: 'AOP',
    source: 'Source',
    note: 'Note',
    /** A statement among the choices, by the id the tab stores. */
    statements: { pl: 'pl', balance: 'balance', tax: 'tax', distribution: 'distribution', grant: 'grant', konto: 'konto' },
  },
  employeeColumns: {
    employee: 'Employee',
    name: 'Name',
    namePlaceholder: 'As the payslip names them',
    iban: 'Paid into',
    residence_city: 'Lives in',
    cityPlaceholder: 'Such as Zagreb',
    pension_pillar_2: 'Pillar II',
    dependants: 'Dependants',
    birth_year: 'Year of birth',
    agreed_gross: 'Agreed gross',
    from: 'Employed from',
    to: 'Employed to',
    director: 'Director',
  },
}

export const hr: Translation<typeof en> = {
  onboarding: {
    question: 'Je li ovo hrvatski d.o.o. koji vlasniku isplaćuje plaću ili dobit?',
    yes: 'Da, dodaj isplate vlasniku, poreze i zaključak godine',
  },
  facts: {
    title: 'Podaci o tvrtki i vlasniku',
    subtitle: 'Što porezni izračuni trebaju znati osim onoga što piše u zakonu. Ostaju u ovoj datoteci. Podaci o vlasniku za plaće nalaze se u retku direktora na zaslonu Plaće.',
    summary: (registered, basisPoints) =>
      `${withFullStop(registered === null ? 'Dan registracije nije postavljen' : `Registrirana ${dayLabel(registered)}`)} Pozajmice vlasniku nose ${formatRate(basisPoints / 10_000)}.`,
    registered: 'Tvrtka registrirana',
    registeredHelp: 'Počinje prvo porezno razdoblje.',
    loanInterest: 'Kamata na pozajmice vlasniku, % godišnje',
    loanInterestHelp: 'Ako je stopa niža od one iz Zakona o porezu na dohodak, razlika na dnevni saldo primitak je u naravi, koji izračunava zaslon Godina.',
    citReturn: 'Prijava poreza na dobit',
    pd: 'PD, prema načelu nastanka događaja',
    pdNn: 'PD-NN, prema novčanom načelu',
    vatPrinciple: 'Obračun PDV-a',
    onInvoice: 'Prema izdanim računima',
    onPayment: 'Prema naplaćenim naknadama',
    doubled: 'Stope amortizacije su udvostručene',
    doubledHelp: 'Zadano za sredstva. Redak sredstva i dalje može navesti drukčije.',
    accountantMail: 'Pošta knjigovođe',
    accountantMailNote: 'Svaka sinkronizacija u Gmailu traži uključene vrste pošte i novo sprema u njihove mape, koje navodi kartica Pošta. Ništa u aplikaciji ne čita te datoteke.',
    accountantFrom: 'Knjigovođa šalje s adresa',
    accountantFromHelp: 'Adrese e-pošte, odvojene zarezom, koje traži svaka vrsta pošte ispod.',
    notRead: 'Ne čita se',
    notSet: 'Nije postavljeno',
    kindOffNote: 'Kad je isključeno, za nju se ne poziva ni Gmail ni Drive.',
    payroll: {
      label: 'Čitaj poštu o plaćama',
      subject: 'Predmet pošte o plaćama počinje s',
      subjectHelp: 'Riječi ispred mjeseca, na primjer Plaća za.',
      folder: 'Mapa plaća',
      folderHelp: 'Kamo se sprema na Google Driveu, kao put od mape Moj disk, s mapom za svaku godinu i mjesec unutra.',
    },
    vat: {
      label: 'Čitaj poštu s prijavama PDV-a',
      subject: 'Predmet pošte s prijavom PDV-a počinje s',
      subjectHelp: 'Riječi ispred razdoblja, na primjer PDV za.',
      folder: 'Mapa prijava PDV-a',
      folderHelp: 'Kamo se sprema na Google Driveu, kao put od mape Moj disk, s mapom za svaku godinu unutra.',
    },
    invoices: {
      label: 'Čitaj poštu s računima knjigovođe',
      subject: 'Predmet pošte s računom počinje s',
      subjectHelp: 'Riječi kojima počinje pošta s računima samog knjigovođe, na primjer Račun za.',
      folder: 'Mapa računa knjigovođe',
      folderHelp: 'Kamo se sprema na Google Driveu, kao put od mape Moj disk, s mapom za svaku godinu i mjesec unutra.',
    },
  },
  loanBucket: {
    title: 'Pozajmice vlasniku',
    subtitle: 'S lista „categories”: skupina kategorija s ulogama owner-loan-out i owner-loan-repaid.',
    none: 'Nijedna kategorija nema ulogu owner-loan-out ni owner-loan-repaid, pa se nema što prebaciti.',
    label: 'Pozajmice vlasniku broje se kao isplate vlasniku',
    on: 'Uključeno: pozajmica je unaprijed uzeta isplata, a njezin povrat vraćena isplata, pa se obje broje u isplatama vlasniku, troškovima i netu. Isključivanje obje premješta u financiranje, izvan računa dobiti i gubitka.',
    off: 'Isključeno: pozajmice i njihovi povrati su financiranje, izvan računa dobiti i gubitka. Uključivanje obje premješta u isplate vlasniku, gdje se broje u troškovima i netu.',
    mixed: (listed) => `Kategorije pozajmica sada su u različitim skupinama: ${listed}. Prebacivanje ih stavlja u jednu.`,
    inBucket: (category, bucket) => `${category} (${croatianBucket(bucket)})`,
    countAsPay: 'Pozajmice se broje kao isplate vlasniku',
    countAsFinancing: 'Pozajmice se broje kao financiranje',
    moved: (categories, bucket) => `List „categories” sada stavlja ${categories} u skupinu ${croatianBucket(bucket)}.`,
    notChanged: 'Nije promijenjeno',
  },
  waiting: {
    unaccounted: (count) => ({
      one: `${count} povrat troškova vlasniku nema trošak u datoteci`,
      few: `${count} povrata troškova vlasniku nemaju trošak u datoteci`,
      other: `${count} povrata troškova vlasniku nema trošak u datoteci`,
    }),
    watchedTaxesMissed: (count, latest) => ({
      one: `Za ${count} mjesec praćenih poreza nema uplate, a zadnji je ${latest}`,
      few: `Za ${count} mjeseca praćenih poreza nema uplate, a zadnji je ${latest}`,
      other: `Za ${count} mjeseci praćenih poreza nema uplate, a zadnji je ${latest}`,
    }),
    missedOnce: (category, month) => `${category}: nema uplate u mjesecu ${month}`,
    missedMonths: (category, count, latest) => ({
      one: `${category}: nema uplate za ${count} mjesec, a zadnji je ${latest}`,
      few: `${category}: nema uplate za ${count} mjeseca, a zadnji je ${latest}`,
      other: `${category}: nema uplate za ${count} mjeseci, a zadnji je ${latest}`,
    }),
    taxOverdue: (count, owed) => ({
      one: `${count} uplata poreza na dobit kasni, a duguje se još ${owed}`,
      few: `${count} uplate poreza na dobit kasne, a duguje se još ${owed}`,
      other: `${count} uplata poreza na dobit kasni, a duguje se još ${owed}`,
    }),
    taxDue: (count, day, owed) => ({
      one: `${count} uplata poreza na dobit dospijeva do ${day}, ${owed}`,
      few: `${count} uplate poreza na dobit dospijevaju do ${day}, ${owed}`,
      other: `${count} uplata poreza na dobit dospijeva do ${day}, ${owed}`,
    }),
  },
  links: { review: 'Za provjeru', yearTaxes: 'Godina, Porezi', ownerTaken: 'Vlasnik, Uzeto' },
  unaccounted: {
    title: (count) => ({
      one: `${count} povrat troškova bez troška u datoteci`,
      few: `${count} povrata troškova bez troška u datoteci`,
      other: `${count} povrata troškova bez troška u datoteci`,
    }),
    summary: (total) => `Ukupno ${total}, broji se kao isplaćeno vlasniku`,
    subtitle:
      'Isplaćeno vlasniku na kategoriju povrata troškova, a na listu „owner-advances” nema troška koji bi se time vratio. Neto dug broji svaki takav povrat kao isplatu vlasniku dok se ne doda njegov trošak.',
    reimbursement: 'Povrat troškova',
    paid: (day) => `Plaćeno ${day}`,
    partOf: 'od',
    openRow: (day) => `Povrat troškova od ${day}, otvori stavku`,
    addCost: 'Dodaj trošak',
    addCostOf: (day) => `Dodaj trošak koji je povrat od ${day} podmirio`,
  },
  screens: { owner: 'Vlasnik', year: 'Godina', salaries: 'Plaće' },
  owner: {
    description: 'Što je vlasnik uzeo iz tvrtke i tko kome duguje između vlasnika i tvrtke.',
    addAdvance: 'Dodaj predujam',
    comparePayMixes: 'Usporedi načine isplate',
    tabs: { label: 'Što je vlasnik uzeo i tko kome duguje', taken: 'Uzeto', owed: 'Tko kome duguje' },
    leftOut: {
      loanOut: 'nije navedena nijedna pozajmica vlasniku',
      loanRepaid: 'nijedan povrat nije povezan s pozajmicom',
      payTax: 'bruto trošak čine samo isplate vlasniku',
      reimbursement: 'nijedan povrat troškova ne vraća predujam',
    },
  },
  missingRoles: {
    before: 'Nijedna kategorija nema ulogu ',
    after: (leftOut) => `, pa ${leftOut}.`,
    addRoles: 'Dodajte uloge u Postavkama, pod Kategorije',
  },
  accrualLeftOut: {
    revenue: 'uplate klijenata ostaju u dobiti uz prihod koji donose računi',
    grant: 'potpora se broji kao prihod kad stigne, uz svoje priznavanje',
    capitalPurchase: 'sredstvo pronalazi svoju uplatu samo po polju ledger_reference, a nepovezana kupnja broji se kao trošak',
    arrears: 'plaća, njezini porezi i najam broje se u mjesecu u kojem su plaćeni',
    prepaidAnnual: 'polica plaćena godinu unaprijed broji se u mjesecu u kojem je plaćena',
    vatSettlement: 'PDV plaćen državi ili vraćen od nje broji se u dobiti',
    corporateIncomeTax: 'plaćeni porez na dobit broji se kao trošak uz porez za godinu',
    profitDistribution: 'dividende i porez na njih broje se kao troškovi',
    representation: 'poreznoj osnovici ne dodaje se nikakva reprezentacija',
    personalTransport: 'redak 7 obrasca PD ne dodaje osnovici nikakav osobni prijevoz',
    nonDeductible: 'retci 9, 11 i 24 obrasca PD ne dodaju osnovici nikakvu kaznu ni privatni trošak',
  },
  ownerPayOff: {
    title: 'Modul isplata vlasniku je isključen',
    description: 'Ova datoteka postavlja owner_pay_module na FALSE, pa se isplate vlasniku broje kao poslovni rashodi, a ovaj zaslon nema što prikazati.',
    openSettings: 'Otvori Postavke',
  },
  figure: {
    howItIsWorkedOut: (label) => `${label}, kako se izračunava`,
    stepByStep: 'Korak po korak',
    rules: 'Odredbe',
    openRows: (label) => `${label}, otvori stavke`,
    openRule: (title) => `${title}, otvori odredbu`,
    stillToSettle: 'Odredbe koje još treba potvrditi',
    watched: {
      estimate: 'Vrijednosti koje propisi samo procjenjuju',
      pending: 'Vrijednosti iz prijedloga zakona ili nacrta koji još nije na snazi',
      unconfirmed: 'Vrijednosti koje još nisu provjerene u izvoru',
    },
    andMore: (count) => `i još ${count}`,
  },
  ownerNet: {
    title: 'Mjesečni neto, s dobiti',
    months: (count) => ({ one: `${count} mjesec`, few: `${count} mjeseca`, other: `${count} mjeseci` }),
    profitBeforeTax: (span) => `Dobit prije oporezivanja, ${span}`,
    paidOutOf: (year) => `Isplaćeno ${year + 1}. iz dobiti za ${year}.`,
    pay: (months) => `Isplate bez pozajmica i dividendi, ${months}`,
    dividendsLeftOut: 'Dividende nisu uključene jer ih broji dobit',
    payAfterRentTax: 'Isplate nakon poreza na najam',
    noProfitMonth: 'Još nema cijelog mjeseca dobiti',
    profitAfterTaxes: (months) => `Dobit nakon oba poreza, ${months}`,
    payAMonth: 'Isplate mjesečno',
    profitAMonth: 'Iz dobiti mjesečno',
    paidOutAlready: 'Iz nje već isplaćeno kao dividende',
    leftInCompany: 'Ostaje u tvrtki',
    setsOff: (day) => `Od toga se prebija dug vlasnika na dan ${day}`,
    subtitle: (period, payMonths, profitMonths) =>
      `${withFullStop(period)} Isplate kroz ${payMonths}, dobit kroz ${profitMonths === null ? 'nijedan cijeli mjesec' : `${profitMonths} do zadnjeg cijelog mjeseca`}. Dobit je tvrtkina, pa slijedi samo razdoblje.`,
  },
  bridge: {
    raises: 'Povećava dobit',
    lowers: 'Smanjuje dobit',
    total: 'Ukupno',
    residual: 'Nije objašnjeno',
    amount: 'Iznos',
    none: 'Nema mosta za prikaz.',
    description: (first, firstAmount, steps, last) => `Od stavke „${first}” s iznosom ${firstAmount}, jedan stupac po koraku: ${steps}${last === null ? '.' : `. Zadnji stupac je „${last}”.`}`,
  },
  taken: {
    take: 'Ukupno vlasniku',
    takeFromCosts: (amount) => `od toga ${amount} iz troškova tvrtke`,
    loansIn: 'Pozajmice uključene, povrati oduzeti',
    loansOut: 'Pozajmice nisu uključene, kao financiranje',
    takeDefinition: (payLabel, loansArePay, benefitName, rentTaxed) =>
      `Sve u skupini „${payLabel}” u prikazanom razdoblju. ` +
      (loansArePay
        ? 'Pozajmica vlasniku unaprijed je uzeta isplata, a njezin povrat vraćena isplata, pa se broje obje. '
        : 'Pozajmice vlasniku su u skupini financiranja, pa se ne broje ni one ni njihovi povrati. ') +
      'Povrati troškova podmiruju troškove i nisu uključeni.' +
      (benefitName === null ? '' : ` Broji se i „${benefitName}”, vlasnikovi dijelovi troškova tvrtke.`) +
      (rentTaxed ? `${CROATIAN_RENT_NOTE} Stavke koje otvara zbrajaju se na toliko više.` : ''),
    payments: (count) => ({ one: `${count} plaćanje`, few: `${count} plaćanja`, other: `${count} plaćanja` }),
    benefitsDefinition:
      'Vlasnikovi dijelovi troškova tvrtke, po udjelu vlasnika svake stavke. Broje se kao isplate vlasniku bez poreza. Udio je vaša procjena, a knjigovođa te troškove knjiži u cijelosti.',
    grossCost: 'Bruto trošak vlasnika',
    taxOnPay: (amount) => `od toga ${amount} poreza na isplate`,
    grossCostDefinition: (rentTaxed) =>
      `Ukupno vlasniku uz poreze koji se duguju zato što je vlasnik isplaćen, kategorije s ulogom owner-pay-tax${rentTaxed ? ' i porez na najam koji vlasnik plaća iz najamnine' : ''}. Porez na dobit nije uključen.`,
    netShare: 'Neto udio u bruto trošku',
    nothingPaid: 'Vlasniku ništa nije isplaćeno',
    netShareOf: (withoutLoans, gross) => `${withoutLoans} od ${gross} bruto troška`,
    netShareDefinition: (loansArePay, rentTaxed, benefitName) =>
      'Koliko je od onoga što je tvrtka potrošila na isplate vlasniku stiglo vlasniku: ukupno vlasniku bez pozajmica podijeljeno s tim iznosom uvećanim za poreze koji se duguju zato što je vlasnik isplaćen. ' +
      `100 % značilo bi da nema poreza povrh toga.${loansArePay ? CROATIAN_LOAN_NOTE : ''}${rentTaxed ? CROATIAN_RENT_NOTE : ''}${benefitName === null ? '' : ` „${benefitName}” broji se u ukupnom iznosu i nema poreza, pa udio povećava.`}`,
    monthlyNetPay: 'Mjesečna neto isplata',
    noMonthInView: 'U prikazu nema mjeseca evidencije',
    over: (amount, months) => ({ one: `${amount} kroz ${months} mjesec`, few: `${amount} kroz ${months} mjeseca`, other: `${amount} kroz ${months} mjeseci` }),
    monthlyNetPayDefinition: (payLabel, loansArePay, rentTaxed, benefitName) =>
      `Koliko je vlasnik mjesečno primio iz svih kategorija isplata vlasniku, na primjer plaće, nagrade, dividende i najma${benefitName === null ? '' : `, uključujući „${benefitName}”`}: ukupno vlasniku bez pozajmica, podijeljeno s brojem mjeseci razdoblja. ` +
      `Pomični prozor izostavlja tekući mjesec, koji grafikon „${payLabel} po mjesecima” prikazuje. Ostala razdoblja mjesec koji evidencija pokriva samo djelomično, na primjer tekući mjesec, broje kao cijeli mjesec, kao i grafikon.${loansArePay ? CROATIAN_LOAN_NOTE : ''}${rentTaxed ? CROATIAN_RENT_NOTE : ''}`,
    netDefinition:
      'Koliko vlasnik zarađuje mjesečno kad se dobit broji onako kako je mjeseci zarađuju. Isplate su ukupno vlasniku bez pozajmica i dividendi kroz mjesece razdoblja, a najam nakon poreza na najam. Pomični prozor izostavlja tekući mjesec. ' +
      'Dobit je dobit prije oporezivanja za razdoblje do zadnjeg cijelog mjeseca, kako je broji zaslon Godina, umanjena za porez na dobit po stopi koju Godina izračuna za svaku godinu i za porez na dividendu, kroz te mjesece. ' +
      'Dividenda isplaćuje dobit koju ti mjeseci već broje, pa je isplate izostavljaju. Dobit je tvrtkina, pa slijedi razdoblje, a ne ostale filtre.',
    noProfitMonth: 'Još nema cijelog mjeseca dobiti',
    payAndProfit: (pay, profit, sinceTheStart) => `${pay} isplate i ${profit} iz dobiti, mjesečno${sinceTheStart ? ', od početka evidencije' : ''}`,
    notWorkedOut: (reason) => `Nije se moglo izračunati. ${reason}`,
    profitNeeds: 'Dobit treba postavku ',
    setOnSettings: 'Otvorite Postavke',
    profitFollowsPeriod: 'Dobit slijedi samo razdoblje.',
    ring: {
      title: 'Ukupno vlasniku po vrsti',
      subtitle: (period) => `${withFullStop(period)} Isplaćeno vlasniku u neto iznosu, po kategoriji.`,
      definition:
        'Svaka kategorija isplata vlasniku na kojoj je tvrtka isplatila više nego što je vratila, kao dio prstena. Pozajmice mogu biti negativne, pa stoje ispod prstena, s porezom na najam koji vlasnik plaća iz najamnine, i s njim čine ukupno vlasniku. Uz prsten je ono što je vlasnik dugovao tvrtki na kraju svakog mjeseca, za sve pozajmice od početka evidencije.',
      ownerTake: 'ukupno vlasniku',
      withoutLoans: 'bez pozajmica',
      paidOut: 'isplaćeno',
      nothing: (period) => `Vlasniku ništa nije isplaćeno u razdoblju ${withFullStop(period)}`,
      description: (period, shares, aside, total) => `Ukupno vlasniku po vrsti, ${period}: ${shares}.${aside} Zajedno ${total}.`,
      inAll: (total) => `Ukupno ${total}`,
      loanBalance: 'Dug vlasnika na kraju svakog mjeseca, sve pozajmice od početka evidencije',
      salariesLink: 'Plaće',
      salariesSplit: ' dijele svaku plaću na neto isplatu, mirovinsko osiguranje, porez i zdravstveno osiguranje.',
      reimbursementsOutside: 'Izvan ukupnog iznosa vlasniku, jer podmiruju troškove:',
    },
    byMonth: (payLabel) => `${payLabel} po mjesecima`,
    drawsSubtitle: (period, rentTaxed) => `${withFullStop(period)} Pozajmice i njihovi povrati kao jedan neto pojas, a vraćeni novac${rentTaxed ? ' i porez na najam' : ''} ispod nule.`,
    monthSoFar: 'Tekući mjesec',
  },
  owed: {
    partOf: (amount, payee, day) => `Dio plaćanja od ${amount}${payee === '' ? '' : ` primatelju ${payee}`}, ${day}`,
    netOwed: 'Neto dug',
    direction: (balance, on) => `${balance > 0 ? 'Vlasnik duguje tvrtki' : balance < 0 ? 'Tvrtka duguje vlasniku' : 'Nitko nikome ne duguje'} na dan ${on}`,
    definition: (on, loanBalance, advancesOutstanding, unaccounted) =>
      `Jedan saldo za oba smjera, kakav je bio na dan ${on}, zadnji dan razdoblja ili dan najnovije stavke. Vlasnik tvrtki duguje ono što je posuđeno, uključujući privatne troškove i vlasnikove dijelove podijeljenih plaćanja tvrtke, ` +
      `umanjeno za ono što je vlasnik vratio na kategoriju pozajmica ili povrata troškova (${loanBalance}). ` +
      `Tvrtka vlasniku duguje troškove koje je vlasnik platio privatno, a za koje mu još nisu vraćeni (${advancesOutstanding}). ` +
      (unaccounted === null ? '' : `Taj iznos povrate troškova bez troška u datoteci (${unaccounted}) broji kao isplatu vlasniku dok se ne dodaju njihovi troškovi. `) +
      'Pozitivan iznos znači da vlasnik duguje tvrtki. Privatni trošak koji je tvrtka platila u cijelosti broji se kao posuđeno samo kad je njegova stavka u kategoriji s ulogom owner-loan-out.',
    noMonths: 'Nema mjeseci za prikaz',
    lentAndRepaid: (lent, repaid) => `${lent} posuđeno, ${repaid} vraćeno`,
    loanFigures: ['Dug na početku', 'Posuđeno', 'Vraćeno', 'Dug na kraju'],
    advanceFigures: ['Dug na početku', 'Platio vlasnik', 'Vraćeno vlasniku', 'Dug na kraju'],
    advancesSummary: (count, owed, on) => ({
      one: `${count} trošak, vlasniku se duguje ${owed} na dan ${on}`,
      few: `${count} troška, vlasniku se duguje ${owed} na dan ${on}`,
      other: `${count} troškova, vlasniku se duguje ${owed} na dan ${on}`,
    }),
    loansSummary: (count, open, on) => {
      const opened = open === 0 ? 'nijedna otvorena' : `otvorenih: ${open}`
      return { one: `${count} pozajmica, ${opened} na dan ${on}`, few: `${count} pozajmice, ${opened} na dan ${on}`, other: `${count} pozajmica, ${opened} na dan ${on}` }
    },
    otherFilters: 'Tko kome duguje slijedi samo razdoblje. Računi u banci i ostali filtri vrijede na kartici Uzeto.',
    unaccounted: (count) => ({
      one: `Bez obzira na razdoblje, ${count} povrat troškova vlasniku bez troška u datoteci čeka u Za provjeru. Neto dug ga broji kao isplatu vlasniku dok se ne doda trošak.`,
      few: `Bez obzira na razdoblje, ${count} povrata troškova vlasniku bez troška u datoteci čekaju u Za provjeru. Neto dug ih broji kao isplatu vlasniku dok se ne doda trošak.`,
      other: `Bez obzira na razdoblje, ${count} povrata troškova vlasniku bez troška u datoteci čeka u Za provjeru. Neto dug ih broji kao isplatu vlasniku dok se ne doda trošak.`,
    }),
    openReview: 'Otvori Za provjeru',
    loans: {
      title: 'Sve pozajmice, s povratima koji su ih zatvorili',
      subtitle: (period, on) =>
        `${withFullStop(period)} Svaka pozajmica sa saldom u razdoblju, kakva je bila na dan ${on}, uključujući privatne troškove i vlasnikove dijelove podijeljenih plaćanja tvrtke. Povrati najprije zatvaraju pozajmice kojima su točno jednaki. Ostali idu najstarijoj otvorenoj pozajmici, a povrat veći od pozajmice prelazi na sljedeću.`,
      open: (count, oldest) => `Otvorenih: ${count}, najstarija od ${withFullStop(oldest)}`,
      noneOpen: 'Nijedna nije otvorena.',
      empty: (period) => `Nijedna pozajmica vlasniku nije imala saldo u razdoblju ${withFullStop(period)}`,
    },
    advances: {
      title: 'Troškovi koje je vlasnik platio privatno',
      subtitle: (period, on) =>
        `${period}, s lista „owner-advances”. Svaki trošak koji se dugovao u razdoblju, kakav je bio na dan ${withFullStop(on)} Svaki se broji kao trošak na svoj datum, u svojoj kategoriji. Povrati troškova vlasniku najprije vraćaju troškove kojima su točno jednaki, a ostali vraćaju najstarije. Ostaju izvan računa dobiti i gubitka.`,
      empty: (period) => `Nijedan trošak koji je vlasnik platio privatno nije se dugovao u razdoblju ${withFullStop(period)}`,
    },
    timeline: {
      title: 'Pozajmice vlasniku po mjesecima',
      subtitle: (period) => `${withFullStop(period)} Posuđeno ispod nule, a vraćeno iznad nje.`,
      definition: 'Što je svaki mjesec posuđeno vlasniku i vraćeno. Saldo na kraju svakog mjeseca nalazi se uz prsten na kartici Uzeto.',
    },
  },
  advanceDialog: {
    addTitle: 'Dodaj predujam',
    changeTitle: 'Uredi predujam',
    addDescription: 'Trošak koji je vlasnik privatno platio za tvrtku. Broji se kao trošak na svoj datum, a povrati troškova vlasniku ga vraćaju.',
    changeDescription: 'Trošak koji je vlasnik privatno platio za tvrtku, na listu „owner-advances”. Upisuju se samo ćelije koje promijenite.',
    dateError: 'Datum, na primjer 2026-10-14',
    amountError: 'Pozitivan iznos s najviše dvije decimale',
    categoryError: 'Odaberite koji je to trošak bio',
    added: 'Predujam je dodan',
    changed: 'Predujam je promijenjen',
    deleted: 'Predujam je obrisan',
    notAdded: 'Nije dodano',
    notChanged: 'Nije promijenjeno',
    notDeleted: 'Nije obrisano',
    openIt: 'Otvori ga',
    asCategory: (amount, category) => `${amount} u kategoriji ${category}.`,
    outside: (period) => ` Izvan je prikazanog razdoblja (${period}), pa ga stranica ne navodi.`,
    date: 'Datum',
    amount: 'Iznos',
    amountPlaceholder: '0,00',
    category: 'Kategorija',
    categoryHelp: 'Samo poslovni rashodi i porezi.',
    chooseCategory: 'Odaberite kategoriju',
    searchCategories: 'Pretraži kategorije',
    forWhat: 'Za što je bilo',
    forWhatPlaceholder: 'Karte za vlak do klijenta',
    splitInstead: 'Dio plaćanja tvrtke bio je vaš? Umjesto toga podijelite to plaćanje u Transakcijama.',
    delete: 'Obriši predujam',
    cancel: 'Odustani',
    save: 'Spremi predujam',
    add: 'Dodaj predujam',
  },
  advanceList: {
    openRow: (day) => `Predujam od ${day}, otvori stavku`,
    owedToOwner: 'Duguje se vlasniku',
    reimbursed: 'Vraćeno',
    stillOwed: ' još se duguje',
    reimbursedOn: (day) => `Vraćeno ${day}`,
    edit: (day) => `Uredi ili obriši predujam od ${day}`,
    matched: (day) => `Povrati troškova povezani s predujmom od ${day}`,
    reimbursementRow: (day) => `Povrat troškova od ${day}, otvori stavku`,
  },
  loanList: {
    openRow: (day) => `Pozajmica od ${day}, otvori stavku`,
    open: 'Otvorena',
    repaid: 'Vraćena',
    stillOwed: ' još se duguje ',
    closedOn: (day) => `Zatvorena ${day}`,
    nothingLent: 'Na ovoj stavci ništa nije posuđeno',
    matched: (day) => `Povrati povezani s pozajmicom od ${day}`,
    repaymentRow: (day) => `Povrat od ${day}, otvori stavku`,
  },
  citObligations: {
    status: { paid: 'Plaćeno', due: 'Dospijeva ovaj mjesec', overdue: 'Kasni', 'to-come': 'Slijedi' },
    due: (day) => `Dospijeva ${day}`,
    payment: 'Uplata',
    dueColumn: 'Dospijeće',
    expected: 'Očekivano',
    paid: 'Plaćeno',
    stillOwed: 'Još se duguje',
    statusColumn: 'Stanje',
    paidRows: (label) => `${label}, plaćeno, otvori stavke`,
  },
  benefits: {
    estimate: 'Vaša procjena privatne upotrebe. Knjigovođa te troškove knjiži u cijelosti.',
    atShare: (category, share, amount) => `${category} uz udio ${share} ${amount}`,
    mixed: 'različit',
    description: (title, period, listed, total) => `„${title}”, ${period}, po kategoriji iz koje dolazi: ${listed}. Zajedno ${total}.`,
    asDividend: (title, period) =>
      `„${title}”, ${period}, kad bi se umjesto toga isplatilo kao dividenda: porez na dobit po stopi koju Godina izračuna za godinu u kojoj je plaćeno, a zatim porez na dividendu po stopi sljedeće godine.`,
    noneShared: (period) => `Nijedan trošak tvrtke u razdoblju ${period} nije podijeljen s vlasnikom.`,
    setDefaults: 'Postavi zadane udjele',
    subtitle: (period) => `${withFullStop(period)} Vlasnikovi dijelovi troškova tvrtke, po kategoriji iz koje dolaze.`,
    definition:
      'Svaka kategorija čiji su troškovi podijeljeni s vlasnikom, s udjelom vlasnika po kojem su se brojile njezine stavke, ili „različit” kad se razlikuju. Broje se kao isplate vlasniku bez poreza.',
    toTheOwner: 'vlasniku',
    taxAvoided: 'Ušteda na porezu u odnosu na dividendu',
    wouldNet: 'Kao dividenda neto biste dobili',
    dividendNeeds: 'Za porez koji bi koštala dividenda treba postavka ',
    dividendNeedsAfter: ', dan kad počinje prvo porezno razdoblje.',
    setOnSettings: 'Otvorite Postavke',
    notWorkedOut: (reason) => `Porez koji bi koštala dividenda nije se mogao izračunati. ${reason}`,
  },
  charts: {
    otherCategories: 'Ostale kategorije',
    loansNet: 'Pozajmice, neto',
    rentTax: 'Porez na najam koji vlasnik plaća Poreznoj upravi',
    lent: 'Posuđeno',
    repaid: 'Vraćeno',
    owedByOwner: 'Dug vlasnika',
    noMonths: 'Nema mjeseci za prikaz.',
    span: (from, to) => `${monthLabel(from)} – ${monthLabel(to)}`,
    taxesByMonth: (span, series, total) => `Plaćeni porezi po mjesecima, ${span}, složeni po vrstama: ${series}. Ukupno ${total}, umanjeno za povrate.`,
    ownerPayByMonth: (span, series, total) => `Isplate vlasniku po mjesecima, ${span}, složene po vrstama: ${series}. Ukupno ${total}.`,
    loansByMonth: (span, lent, repaid) => `Pozajmice vlasniku po mjesecima, ${span}: posuđeno ispod nule, a povrati iznad nje. Ukupno posuđeno ${lent} i vraćeno ${repaid}.`,
    owedAtMonthEnds: (span, complete, month, owed) =>
      `Dug vlasnika prema tvrtki na kraju svakog mjeseca, ${span}. ${complete ? 'Na kraju mjeseca' : 'Dosad u mjesecu'} ${month} vlasnik je dugovao ${owed}.`,
  },
  assetColumns: {
    asset: 'Sredstvo',
    bought: 'Kupljeno',
    in_use: 'U upotrebi od',
    cost_net: 'Nabavna vrijednost bez PDV-a',
    group: 'Skupina',
    doubled: 'Udvostručena stopa',
    disposed: 'Otuđeno',
    funded_by: 'Financirano iz',
    noGrant: 'Bez potpore',
    ledger_reference: 'Referenca u evidenciji',
    note: 'Napomena',
  },
  grantColumns: {
    grant: 'Potpora',
    received: 'Primljeno',
    amount: 'Iznos',
    fixed_part: 'Fiksni dio',
    variable_part: 'Varijabilni dio',
    period_from: 'Razdoblje od',
    period_to: 'Razdoblje do',
    release: 'Priznavanje',
    blankRelease: 'Prazno, fixed-then-assets',
    clawback_year1: 'Povrat, 1. godina',
    clawback_year2: 'Povrat, 2. godina',
    clawbackPlaceholder: 'whole ili iznos',
    employment_required_until: 'Zapošljavanje do',
    note: 'Napomena',
  },
  yearEndColumns: {
    year: 'Godina',
    statement: 'Izvještaj',
    line: 'Pozicija',
    kontoNumber: 'Broj konta',
    choose: 'Odaberite',
    label: 'Kako je ispisano',
    amount: 'Iznos',
    categories: 'Kategorije',
    commaSeparated: 'Odvojene zarezom',
    aop: 'AOP',
    source: 'Izvor',
    note: 'Napomena',
    statements: {
      pl: 'Račun dobiti i gubitka',
      balance: 'Bilanca',
      tax: 'Porez na dobit (PD)',
      distribution: 'Raspodjela dobiti',
      grant: 'Potpore',
      konto: 'Konto',
    },
  },
  employeeColumns: {
    employee: 'Zaposlenik',
    name: 'Ime',
    namePlaceholder: 'Kako ga navodi platna lista',
    iban: 'Isplata na',
    residence_city: 'Prebivalište',
    cityPlaceholder: 'Na primjer Zagreb',
    pension_pillar_2: 'II. stup',
    dependants: 'Uzdržavani članovi',
    birth_year: 'Godina rođenja',
    agreed_gross: 'Ugovorena bruto plaća',
    from: 'Zaposlen od',
    to: 'Zaposlen do',
    director: 'Direktor',
  },
}

export const words = language === 'hr' ? hr : en
