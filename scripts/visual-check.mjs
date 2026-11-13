/**
 * Renders every screen of the fake-mode build in real Chrome at nine widths, from 360 to 2560 px,
 * in the dark and the light theme at 360, 430 and 1440 and in one theme at the others. It asserts
 * what a screenshot cannot: no horizontal overflow, no card whose content is wider than the card
 * outside the editors allowed to scroll sideways, no console errors (CSP violations included), no
 * request to another origin, that each screen rendered its title, and that it drew as many charts as
 * it has from the fake workbook. Every chart on the gallery must draw and every icon must come from
 * the bundle. From 768 px, cards whose tops line up in a row must end at the same height. Two fields
 * side by side in a form, a dialog or a card must have their inputs at the same height, on every
 * screen and in every flow, and every DashboardGrid must rearrange from 768 to 1440 px and again to
 * 1920 px, unless its cards already sit in one row at the wider width. Cards side by side in a grid
 * that is not a DashboardGrid fail, outside the gallery. A deep
 * link to a rule on Settings, Tax rules must open that rule in the side panel and bring its line to
 * just below the search bar, marked, and keep it there once slow web fonts swap in. Deep links into
 * a collapsed card must open it and land on their row. At 360, 430 and 1440 px each screen
 * collapses and expands one card. The total and the label in the middle of every donut must sit
 * inside the ring's hole with 2 px to spare. In a titled card a table's first cell that shows starts its text where the
 * title does, a card's header actions sit under its title on a phone, a tab's one card of words and fields keeps to 42rem,
 * and a DrillLink wears the colour of the text class it is given.
 * On every screen, at every step of a flow and in every menu a flow opens, no text may overlap other text by more than 2 px,
 * no label may be cut to under half its width with no ellipsis, and no placeholder may be cut short, other than what `support/textOverlap.mjs` allows by name.
 * The category picker flows and the menu flows open each kind of picker at 360, 640, 1024 and 1440 px.
 * On every screen and at every step of a flow in Croatian it fails on English left on the page,
 * other than the data `support/englishLeft.mjs` lets through by name. Every flow has a Croatian run,
 * on its own or inside another, such as the Settings tabs, Year's tab link, both imports, Salaries,
 * the home, its Set up and the race on the To review tab.
 *
 * With saves that take seconds (`?fake=slow-writes`) the loan bucket switch on Settings and the benchmark select on Investments, Settings move at once, grayed with a
 * spinner, in Croatian too, and what is typed in the Settings form survives the switch's save.
 * With a key kept, every app shows with the chat open (`?chat=1`), docked where it leaves the page 640 px and in the page's place below.
 * Every screen is also checked at 1,264, 1,390 and 1,920 px with the expanded sidebar and the chat docked. A flow asks in
 * English and Croatian, answers the dialog, follows the link the fake model shows, and a second one tags an element from the gallery.
 * Another flags a payee as a person on its Spending entry, lets the chat read Spending from its card and opens the exact text sent,
 * with that person's alias and the IBAN masked, and again with Anonymise off. A proposal shows its card with Accept and one Undo.
 * Spending's To review asks the chat from its card's header and from a waiting row, each outlined while the chat is about it.
 * A receipt photo from Entries starts a new chat unless one is going on, which it joins, and the chat sends its task once the
 * photo is read. The chat proposes its new category on one card and the receipt on the next, and Accept splits the payment with one Undo. The receipt dialog shows no part of the assistant.
 * Company's To review keeps Suggest categories, which opens the chat about the queue and files the sure rows on a card, and an
 * opened row asks about itself. An invoice asked of the chat is a link to the Invoices tab, dollars are a currency card with a
 * warned line, a rule for Laptop Store re-files a confirmed row with a warning, trying the second rule first is a card that says where it is tried, a category for training or for
 * donations is a card that names its tax class, and Kuna's dark look is a card with Undo. In the fake books with a donation of 3,000.00, well above its cap,
 * and a sponsorship to a listed club, Year's PD return shows PD lines 14 and 33.a with a caption that neither is averaged, and the categories tab,
 * scrolled to the two rows, names their classes.
 * In Loans a loan offer is a card that sets Kuna's EKS and first instalment beside the printed ones and warns where they differ, a bank loan
 * from its contract warns where its first instalment differs from the printed one, and an extra
 * payment is a card. Setting an app up with the chat: each first run's home and folder steps offer it, it makes one file and opens the
 * chat on the overview, the overview and the set-up card offer it too, a card made while Loans is new says the chat goes on and Accept
 * sends Go on, the first send of a new app with a file of cells says the app knows no names yet, the empty chat on the home offers one
 * button for each new app the person uses, and a send with no credit left says so in plain words. In Investments a buy is a card, a sale over the units held is refused, and an attached workbook with no
 * split or spin-off is an import card. In Assets a valuation is a card. Each card is accepted and undone, in Croatian too.
 * A text note put beside a photo on the prompt is a refused chip that names the kinds Kuna takes. On Salaries with Anonymise
 * off for Anthropic, Explain on a salary figure reads its build-up, and after a switch to OpenAI and back the same Explain is
 * refused with nothing sent, in Croatian too.
 *
 * Kuna settings shows the assistant's card with no key, with a made-up Anthropic key kept and Anonymise on, with Anonymise off
 * for Anthropic, with a key refused and after a switch of company, which turns Anonymise back on, in Croatian too, and Company
 * and Spending show their Assistant tabs, Spending's naming only the chat when no key is kept. Loans, Investments and Assets
 * show theirs with a key kept, and Kuna settings lists their lines. Spending's entry dialog and an opened row of Company's To review tab treat a payee
 * as a person, in Croatian too. With a key kept, the build-up amounts on Owner, Salaries, Year's Pay tab
 * and a closed year's open items have Ask the chat beside them, which opens the chat with the figure's build-up as its tag, in Croatian too.
 *
 * Net worth renders on the sample Loans and Investments files beside the company on Drive and in this browser,
 * while the Loans file opens, once its read fails (`?loans=failed`), with Investments alone and on a first run, with its
 * figures worked out from the same fake sets, in Croatian too, and so does Year's Pay tab with the kept profit paid out now.
 * It also renders with the sample Assets file beside them, with the Assets file alone and while the house price index
 * loads (`?index=opening`).
 *
 * The Assets app renders its first run, its empty Overview and its Settings (`?assets=drive`), its Settings for a file
 * kept in this browser, the sample's Overview and the pages of its flat and its car beside the sample Loans file
 * (`?assets=sample&loans=sample`), the flat without Loans, with its loan gone from Loans (`?assets=loan-gone`) and with
 * the index failed (`?index=failed`), and its Overview while its file opens and once its read fails, in Croatian where
 * a screen has words of its own. Its flows add a flat with its region and the Home loan, clear the loan, delete the
 * flat and undo it, and add a valuation to the car and delete it and undo that, in English and Croatian.
 *
 * The Spending app renders its first run, its empty Overview and its Settings (`?spending=drive`), its Settings for a
 * file kept in this browser, the sample's Overview, Transactions, Limits, Accounts, the dollar account with its ECB rate
 * line and Settings with the categories (`?spending=sample`), Limits with two overspent (`?spending=over`), Accounts
 * while the ECB rates fail (`?rates=failed`), its Overview while its file opens and once its read fails, and Entries with a
 * row a receipt split (`?spending=receipts`), each in
 * Croatian too, with its figures worked out from the same fake sets. Net worth renders with the sample Spending
 * file beside the other samples, alone, and while the ECB rates load (`?rates=opening`). At every width it opens the
 * entry dialog for money out and for a move between two currencies. Its flows add, change and delete money out and undo
 * the delete, move money between two accounts and read both balances, rename, move and delete a category into another
 * and undo it, set and end a limit and undo that, read a Revolut export as a dry run, import it and undo it, add the accounts an export in two currencies needs and undo that, refuse an export
 * with a column missing, send a pair back to review and undo it, make a rule from To review and delete it, find the Spending file another device made on Drive and keep a new
 * one in this browser, in English and Croatian.
 *
 * Beyond the screens of the fake workbook on Drive, it renders the home with every app in Set up and
 * onboarding's first steps on a first run (`?fake=empty`), each tab of the company's Settings and the
 * Year page's editors for a workbook kept in this browser (`?fake=browser`), Settings, Books file for
 * a file a newer app saved (`?fake=newer-file`), Spending Entries and Settings for one (`?spending=newer-file`), Spending Entries and Settings for a file from before parts of entries with its offer to update it, and Entries once updated (`?spending=before-items`), Entries for one with a split transfer, which is not offered the update (`?spending=before-items-split-transfer`), the Loans Settings, the Loans Overview with one loan
 * (`?loans=one-loan`), with a house loan, a car loan and an informal loan you owe on a plan (`?loans=house-and-car`), with one equal principal loan (`?loans=equal-principal`) and while its file opens (`?loans=opening`), Scenarios with its offers, its charts opened and with none, the home, Kuna settings, the Loans first run and every Loans screen in Croatian (`?lang=hr`),
 * the Investments first run, its empty Overview and its Settings on an empty file (`?investments=drive`) and its Overview while its file opens (`?investments=opening`), each in Croatian too,
 * the Investments Overview on the sample (`?investments=sample`), on the sample without a deposit so an account's cash is below zero (`?investments=cash-below-zero`) and with late prices whose last
 * fetch failed (`?prices=late-prices`), each in Croatian too and with its figures worked out from the same fake sets, the home with the Investments card's figures and its badge, the nearest tax date or else the late prices,
 * the sample's Holdings with its five mixes and closed positions, also with a late close and on a past close (`?on=`), and two holdings' pages, one in US dollars with a lot partly sold and its trades as dots sized by amount, and one from a spin-off that split, each in Croatian too, a fund with an empty fund profile, a money fund with a whole one and a share whose company profile Finnhub refused, each with its Details and warnings and in Croatian too,
 * the sample's Performance over everything against its benchmark and compared with a named fund, over 2024 where it is ahead of the benchmark, in Croatian too, and over a quarter, a portfolio too young for a rate a year with no benchmark chosen (`?investments=young`) and the sample whose
 * benchmark has no closes (`?prices=no-benchmark`), each in Croatian too, its Months, its Sources over everything and over the last year, its Falls, and its Income, Coming, Costs and Saving tabs, in Croatian too,
 * the sample's Tax screen for 2026 with its Year, Sales, Foreign income and Turns tax-free tabs, in Croatian too,
 * the sample's Transactions, in Croatian too, and Transactions on an empty file, the import of the made-up portfolio workbook
 * into an empty Investments file with the fake prices, each step and the dry run in English and Croatian, and the same workbook again adding nothing,
 * the Prices tab of the Investments Settings on the sample with current prices, with made-up keys kept, with a key another browser saved taken by the sync on open, a key this browser kept lost to another browser's newer removal and a key the Investments file's old keys file held (`?keys=`), and with late prices, its General tab, on a file another device left in the Drive bin (`?investments=binned`) in Croatian too, three made-up CSV files of closes imported on it, Remove the Investments file on the sample on Drive asked first, cancelled and removed to the first run in English and Croatian, the same for the sample kept in this browser (`?investments=browser`), the sync on open of the binned file with its steps,
 * IBKR's report by mail read by a sync, reviewed from the Overview, its account answered and accepted with one Undo, with rows not seen yet asked
 * about and one left out (`?fake=flex-unseen`), with a report that no longer fits (`?fake=flex-misfit`) and its Settings card switched on, each in Croatian too,
 * the fetch after the import waiting out the fake vendor's minute and then back at its close, Company's
 * Overview, Transactions with its To review and Import tabs, every tab of Analysis, Invoicing with its Plan and Clients tabs, every tab of Settings and onboarding's first steps in Croatian (`?lang=hr`),
 * Year, Salaries and Owner in Croatian in the fake file on Drive, in this browser and with one and five employees, Salaries for one
 * made-up employee (`?fake=one-employee`) and for five (`?fake=five-employees`), and the summary
 * of an xlsx file it writes from the fake workbook with two problems added.
 *
 * At 360 and 1440 px, in both themes and both modes, it then adds, edits, deletes and undoes a
 * category, with its colour, a label and a role, an asset, an employee on Salaries and an
 * invoice, changes and deletes an owner advance and undoes the delete, and screenshots the editors
 * and the invoice dialog on the way. On Settings, Categories it searches, filters to a bucket, sorts
 * by a press and the keyboard, and edits, saves and undoes a row while filtered and sorted. On Settings, General it saves the statements folder the
 * settings lack at the path the app uses, then a new path, and adds, refuses and removes card
 * settlement IBANs as tags. On Invoicing, Clients it gives a client a second IBAN, saves it and
 * undoes it, and takes a new IBAN off with its tag's remove button.
 * On Transactions it changes the category of a settled row, which a rule files elsewhere, and undoes it.
 * On Owner, Taken, at 360, 430 and 1440 px, the monthly net with the profit included opens its build-up and
 * Year from it in the workbook kept in this browser, and reads – with a link to the setting in the fake file on Drive.
 * On Year a link to the Statements tab alone keeps the year it opened through two tabs and Back.
 * It also makes an invoice through the checks and every step, with the fake Picker picking the
 * invoice and year folders and the month folder made on request, then re-exports it.
 * At 360, 430 and 1440 px it does the same with a pay scenario's component, copies a scenario, and
 * adds the starting scenarios to a workbook without any. On the sample Investments file it adds a buy, reads its summary, changes it, deletes it and
 * brings it back with Undo, has a sale beyond what its account holds refused, and adds a holding from inside the transaction dialog with a price
 * entered by hand. At every width it opens each Loans dialog and each Investments dialog, the holding dialog's search with a made-up key among them,
 * in English and Croatian, the Company dialogs whose fields sit two to a row, the app menu in Croatian
 * and the bank loan's what-if in Croatian. At 360, 768 and 1440 px it opens in Croatian the dialogs
 * and phone sheets of Transactions, its To review tab and Settings, Categories, and groups Transactions by
 * category and by month. At the same widths, in Croatian, it splits a payment on Transactions and
 * from the To review queue, changes a settled row's category, changes and deletes a rule from its editor,
 * dismisses and restores a group no rule repeats, and adds, edits, finds, filters and sorts
 * categories on Settings, each undone. At the same widths it reads the sample statement and bank export on Import
 * in Croatian, confirms and undoes the statement, opens a held statement from the sync's steps, lists
 * what a sync filed from the fake mailbox on the Mail card, and opens the switch of data source and a
 * file's summary on Settings, Books file. At the same widths, in Croatian, it adds, edits, deletes and
 * undoes an invoice, makes and re-exports one, gives a client a second IBAN, and opens the dialogs
 * of Invoicing and its Plan tab. At the same widths, in Croatian, it saves the card settlement
 * IBANs on Settings, General, and walks onboarding to new books on Drive and to new books in this
 * browser, with Start over. At the same widths, in Croatian, it changes and clears an owner share on
 * Transactions and fills the rows of a new default share on Settings, Categories, each undone. At the same widths, in Croatian,
 * it adds and undoes an asset, an employee, an owner advance's change, a pay scenario's component, the starting scenarios, a
 * category's plan and a planned purchase.
 * It plans a category for 2027 on Year, Plan, edits, clears and undoes it, and plans a purchase in a
 * workbook without plan rows. On Transactions it splits a payment, edits the split, deletes it and
 * undoes the delete. On the To review tab it does the same from a row of the queue. In books whose ledger rows have no id yet it follows
 * Waiting for you to Settings, Books file, gives the rows their ids and undoes it, in Croatian too. On Settings, Category rules it dismisses a group of
 * confirmed rows no rule repeats, restores it and undoes the restore. There it also changes a rule's note in the rule's editor and undoes it,
 * then deletes the rule from its editor and brings it back with Undo. On the Import tab of Transactions it drops the sample camt.053 statement and the
 * sample bank export, makes a profile for the export, reads each dry run, confirms it, reads how many
 * new rows wait for review and undoes it, then deletes the profile, at 360, 430 and 1440 px. With the
 * file on Drive, from Overview, Sync files the fake statements folder's sample statement with no
 * toast, its step on Kuna settings says so with Undo, which takes it out, Import lists it,
 * and a last sync finds nothing new. With a held statement in the folder, the sync control says 1
 * problem and opens its steps, a popover at 1440 and a bottom sheet at 360, whose link opens Import,
 * which says why. A tab Google gave no Drive read token gets Allow access in the sync control, which
 * files the sample, and a slow statements folder shows the control while its step runs and once it
 * is ready. On Salaries with five employees the one problem opens its build-up and its bank rows,
 * the People tab opens one employee's month and a month of the Over time table opens on the Month
 * tab.
 * The mail step is off until the Mail card on Settings, General saves a sender with the subject it
 * asks for, and the next sync files the bank's new mail. With the fake mailbox it files the bank's
 * PDF and statement, the statements step of the same sync files the statement on the ledger, its
 * link opens the list on the Mail card, and a second sync files nothing new. Mail all filed already
 * says nothing new, a source that fails and an upload that fails each give 1 problem with the steps
 * open, and a token without Gmail read gets Allow access, which runs the step. Saving a sender on the
 * Mail card without Gmail read asks for it in the same tap and syncs, and Allow access whose Google
 * window closed says so beside the button. Gmail asking to slow down fails the step with one plain
 * sentence, which the Mail card says too, and mail all filed by another app moves the source's
 * search to a week before the newest file in its folder.
 * The first run keeps an empty workbook on the fake Drive and one in this browser, goes back to the
 * step that made them, which shows them made and starts over, and offers to open the books the fake
 * Drive already holds when new books, a move from this browser or the Loans file would make a
 * second file. New books
 * on the fake Drive with statements from mail name the bank, make the statements folder beside the
 * books file and file the bank's mail there on the first sync. The statement step asks for Drive
 * read before the Picker when the page lacks it. An xlsx file
 * moves to the fake Drive through its summary, Settings, Books file moves a workbook kept in this
 * browser there with the Drive read its folders need asked up front, and a row confirmed on the To review tab while another device files the other row keeps both.
 *
 * Run against a preview of the fake build:
 *   npm run build:fake && npm run preview:fake -- --port 4173
 *   npm run check:visual -- http://localhost:4173/kuna/
 *
 * While working on one screen, `--only billing,owner` limits the run to the screens and flows with exactly those names,
 * `--only 'chat-receipt*'` to those whose names start so, and `--widths 360,1440` to those widths. A limited
 * run keeps the other screenshots and says it was limited. The full run without options is the check.
 * `--classic-scrollbars` draws 15 px scrollbars from 640 px up, as Linux and Windows do, where a Mac floats them over the page,
 * so a run here finds what a scrollbar's room changes. The docked widths then name the shell's width, without the scrollbar.
 * `--every-theme` shoots both themes at every width, for a design review, which looks at 360, 640, 1024 and 1440 px:
 *   npm run check:visual -- http://localhost:4173/kuna/ --every-theme --widths 360,640,1024,1440 --only chat-read
 *
 * Screenshots go to visual-check/ (gitignored), or to VISUAL_OUTPUT_DIR.
 */

import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { launch } from 'puppeteer-core'
import * as XLSX from 'xlsx'

import { companyHubFigures } from '../src/apps/company/home/presentation/companyHubFigures.ts'
import { readDocument } from '../src/apps/company/workbook/infrastructure/companyDocument.ts'
import { fakeWorkbookDocument } from '../src/apps/company/workbook/infrastructure/fake/fakeWorkbook.ts'
import { tabsOfDocument } from '../src/apps/company/workbook/infrastructure/spreadsheetDocument.ts'
import { templateColumnNames } from '../src/apps/company/workbook/infrastructure/workbookTemplate.ts'
import { holdingReturn } from '../src/apps/investments/holdings/domain/holding.ts'
import { holdingMix, holdingMixes } from '../src/apps/investments/holdings/domain/holdingMix.ts'
import { holdingDetails } from '../src/apps/investments/holdings/presentation/holdingDetails.ts'
import { holdingsList } from '../src/apps/investments/holdings/domain/holdingsList.ts'
import { targetGaps } from '../src/apps/investments/holdings/domain/targetMix.ts'
import { latestRecords } from '../src/apps/investments/holdings/domain/latestRecords.ts'
import { figuresClose, portfolioFigures } from '../src/apps/investments/holdings/domain/portfolioFigures.ts'
import { averageCostText } from '../src/apps/investments/holdings/presentation/holdingText.ts'
import { incomeForecast } from '../src/apps/investments/income/domain/incomeForecast.ts'
import { fetchedFactsBook } from '../src/apps/investments/prices/domain/factsBook.ts'
import { FAKE_KEY_SAVED_AT } from '../src/shared/secrets/infrastructure/fake/fakeSecrets.ts'
import { PROVIDER_PRESETS } from '../src/shared/ai/domain/providerPresets.ts'
import { incomeByYear } from '../src/apps/investments/income/domain/incomeHistory.ts'
import { investingRhythm } from '../src/apps/investments/income/domain/investingRhythm.ts'
import { foreignIncomeYear } from '../src/apps/investments/tax/domain/foreignIncome.ts'
import { taxFreeCalendar } from '../src/apps/investments/tax/domain/taxFreeCalendar.ts'
import { taxReminder } from '../src/apps/investments/tax/domain/taxReminders.ts'
import { capitalGainsYear } from '../src/apps/investments/tax/domain/taxYear.ts'
import { recentCosts, yearlyCosts } from '../src/apps/investments/income/domain/yearlyCosts.ts'
import { gainSources, incomeAgainstLastYear } from '../src/apps/investments/overview/domain/overviewFigures.ts'
import { portfolioChecks } from '../src/apps/investments/overview/domain/portfolioChecks.ts'
import { checkLines } from '../src/apps/investments/overview/presentation/checkLines.ts'
import { benchmarkState, comparedBenchmark } from '../src/apps/investments/performance/domain/benchmark.ts'
import { monthlyReturns } from '../src/apps/investments/performance/domain/monthlyReturns.ts'
import { periodGains } from '../src/apps/investments/performance/domain/periodGains.ts'
import { dayValuer, portfolioPerformance } from '../src/apps/investments/performance/domain/portfolioPerformance.ts'
import { underwater } from '../src/apps/investments/performance/domain/underwater.ts'
import { pricesDay } from '../src/apps/investments/prices/application/pricesUpdate.ts'
import { pricesFileBook, pricesFileRateBook } from '../src/apps/investments/prices/domain/pricesFileBooks.ts'
import { fakePricesFile } from '../src/apps/investments/prices/infrastructure/fake/fakePrices.ts'
import { fakeInvestmentsDocument } from '../src/apps/investments/workbook/infrastructure/fake/fakeInvestments.ts'
import { INVESTMENTS_DOCUMENT } from '../src/apps/investments/workbook/infrastructure/investmentsDocument.ts'
import { investmentsHubFigures } from '../src/apps/investments/home/presentation/investmentsHubFigures.ts'
import { loansHubFigures } from '../src/apps/loans/home/presentation/loansHubFigures.ts'
import { fakeLoansDocument } from '../src/apps/loans/workbook/infrastructure/fake/fakeLoans.ts'
import { LOANS_DOCUMENT } from '../src/apps/loans/workbook/infrastructure/loansDocument.ts'
import { assetsHubFigures, yoursCaption } from '../src/apps/assets/home/presentation/assetsHubFigures.ts'
import { houseIndexOfAnswer } from '../src/apps/assets/houseIndex/infrastructure/dzsHouseIndex.ts'
import { FAKE_HOUSE_INDEX_ANSWER } from '../src/apps/assets/houseIndex/infrastructure/fake/fakeHouseIndex.ts'
import { assetLoansOf } from '../src/apps/assets/loans/application/assetLoans.ts'
import { assetsOnDay, assetsTotal } from '../src/apps/assets/values/presentation/assetsOnDay.ts'
import { valueCaption } from '../src/apps/assets/values/presentation/valueCaption.ts'
import { ASSETS_DOCUMENT } from '../src/apps/assets/workbook/infrastructure/assetsDocument.ts'
import { fakeAssetsDocument } from '../src/apps/assets/workbook/infrastructure/fake/fakeAssets.ts'
import { bankLoansOf } from '../src/apps/loans/facts.ts'
import { accountsOnDay } from '../src/apps/spending/accounts/presentation/accountsOnDay.ts'
import { euroLine } from '../src/apps/spending/accounts/presentation/euroLine.ts'
import { spendingFigures } from '../src/apps/spending/analytics/presentation/spendingFigures.ts'
import { leftToSpend } from '../src/apps/spending/budgets/domain/budgetCarry.ts'
import { en as budgetsEnglish, hr as budgetsCroatian } from '../src/apps/spending/budgets/presentation/words.ts'
import { spendingHubFigures } from '../src/apps/spending/home/presentation/spendingHubFigures.ts'
import { ratesNeeded } from '../src/apps/spending/rates/domain/ratesNeeded.ts'
import { fakeSpendingDocument } from '../src/apps/spending/workbook/infrastructure/fake/fakeSpending.ts'
import { SPENDING_DOCUMENT } from '../src/apps/spending/workbook/infrastructure/spendingDocument.ts'
import { en as netWorthEnglish } from '../src/shell/netWorth/words.ts'
import { addMonths, monthOf } from '../src/shared/calendar/monthKey.ts'
import { EURO } from '../src/shared/money/currencyCode.ts'
import { fakeRatesState } from '../src/shared/rates/infrastructure/fake/fakeRatesState.ts'
import { personalNet } from '../src/shared/app/personalNet.ts'
import { today } from '../src/shared/calendar/civilDate.ts'
import { dayLabel, shortDayLabel, weekdayDayLabel } from '../src/shared/calendar/dayLabel.ts'
import { formatAccountMoney, formatMoney, formatPercent, formatPercentChange } from '../src/shared/money/moneyFormat.ts'
import { installHrDooPack } from './support/installPack.mjs'
import { chromeLaunch, floatPhoneScrollbars } from './support/browsers.mjs'
import { collapseAndExpand } from './support/cardFlows.mjs'
import { englishLeftOn } from './support/englishLeft.mjs'
import { textOverlapsOn } from './support/textOverlap.mjs'
import { pageTabsFlow, pageTabsFlowIn, yearTabLinkFlow, yearTabLinkFlowIn } from './support/pageTabFlows.mjs'
import {
  accessClosedFlow,
  advanceFlow,
  advanceFlowIn,
  appMenuFlow,
  appMenuFlowIn,
  sidebarFitFlowIn,
  sidebarAdjustsFlowIn,
  sidebarDeadAddressFlow,
  assetFlow,
  assetFlowIn,
  assetsEditorFlow,
  firstRunBrowserFlowIn,
  setUpInOtherTabFlow,
  firstRunOnDriveFlowIn,
  assetsEditorFlowIn,
  assetsValuationFlow,
  assetsValuationFlowIn,
  spendingFirstAccountFlow,
  spendingFirstAccountFlowIn,
  spendingFirstAccountBankFlowIn,
  investmentsAddHeldFlow,
  spendingCategoryFlowIn,
  spendingEntryDialogFlowIn,
  spendingBankRowFlowIn,
  spendingLinkFlowIn,
  spendingCreditToTransferFlowIn,
  spendingDeleteNoteFlowIn,
  spendingEntryFlowIn,
  spendingBankSyncBalanceFlowIn,
  spendingBankSyncLookAlikeFlowIn,
  spendingBankSyncWithdrawalFlowIn,
  spendingReviewCashFlowIn,
  spendingRuleWithdrawalFlowIn,
  spendingBankSyncFailedFlowIn,
  spendingBankSyncFlowIn,
  spendingBankSyncPartFlowIn,
  spendingBankSyncPendingFlowIn,
  spendingBankSyncRowsFlowIn,
  spendingBankSyncSetupFlowIn,
  spendingBankSyncStartDayFlowIn,
  spendingImportFlowIn,
  spendingImportMissingFlowIn,
  spendingImportMissingBankFlowIn,
  spendingImportLookAlikeFlowIn,
  spendingImportSyncedLookAlikeFlowIn,
  spendingImportMissingSavingsFlowIn,
  spendingImportRefusedFlowIn,
  spendingReceiptFlowIn,
  spendingSplitFlowIn,
  spendingAccountDialogFlowIn,
  spendingAccountStartDayFlowIn,
  spendingReceiptPickFlowIn,
  spendingReceiptPlaceFlowIn,
  spendingReceiptWaitsFlowIn,
  spendingReviewNearFlowIn,
  spendingLimitFlowIn,
  spendingReviewFlowIn,
  spendingRuleFlowIn,
  spendingRulesAddFlowIn,
  spendingTransferFlowIn,
  employeeFlow,
  employeeFlowIn,
  cardSettlementIbansFlow,
  cardSettlementIbansFlowIn,
  categoryFiltersFlow,
  categoryFiltersFlowIn,
  categoryFlow,
  categoryFlowIn,
  categoryMoveFlow,
  categoryMoveFlowIn,
  ruleWaitingFlowIn,
  changeCategoryFlow,
  changeCategoryFlowIn,
  clientIbansFlow,
  clientIbansFlowIn,
  companyDialogsFlow,
  companyDialogsFlowIn,
  buildUpFlowIn,
  homeFlowIn,
  importCamtFlowIn,
  importCamtLookAlikeFlowIn,
  importTableFlowIn,
  loansOpenFlowIn,
  mailSaveAsksFlowIn,
  ownerNetUnregisteredFlowIn,
  raceFlowIn,
  deleteKeysFlowIn,
  salariesFlowIn,
  assistKeyRefusedFlowIn,
  assistProviderSwitchFlowIn,
  setUpFlowIn,
  statementsFolderFlowIn,
  dismissFlow,
  dismissFlowIn,
  heldStatementFlow,
  heldStatementFlowIn,
  importFlowIn,
  mailListFlowIn,
  categoryPickerFlowIn,
  dataSourceDialogsFlowIn,
  homeFlow,
  importCamtFlow,
  importTableFlow,
  invoiceFlow,
  invoiceFlowIn,
  invoiceRunFlow,
  invoiceRunFlowIn,
  invoicingDialogsFlowIn,
  loansDialogsFlow,
  newerFileDialogFlowIn,
  loansDialogsFlowIn,
  investmentsDialogsFlow,
  investmentsDialogsFlowIn,
  investmentsInstrumentSearchFlowIn,
  investmentsBondFlowIn,
  investmentsHoldingDotHoverFlow,
  deleteDataCopyFlow,
  deleteDataBrowserFlow,
  deleteDataDriveFlowIn,
  deleteDataGivenFlowIn,
  deleteKunaFailsFlowIn,
  deleteKunaFlowIn,
  investmentsBinnedFlow,
  investmentsClosesImportFlowIn,
  investmentsEditorFlow,
  investmentsImportFlowIn,
  investmentsMailCardFlowIn,
  investmentsMailUploadFlowIn,
  investmentsMailFlowIn,
  loansDriveFlow,
  loansDriveFlowIn,
  loansEditorFlow,
  loansEditorFlowIn,
  loansOpenFlow,
  loansScenarioEditorFlow,
  loansScenariosFlow,
  loansScenariosFlowIn,
  loansWhatIfFlow,
  loansWhatIfFlowIn,
  loansSavedTriesFlow,
  rowsDialogsFlowIn,
  mailAccessFlow,
  mailFailedFlow,
  mailNothingNewFlow,
  mailFiledFlow,
  mailOffFlow,
  mailPlanSpecimenFlow,
  mailSaveAsksFlow,
  mailUploadFailedFlow,
  mailRateLimitedFlow,
  mailWindowFlow,
  moveFromBrowserFlow,
  moveFromBrowserFlowIn,
  moveOntoDriveFlow,
  moveOntoDriveFlowIn,
  onboardingBringFlow,
  onboardingBringFlowIn,
  onboardingBrowserFlow,
  onboardingBrowserFlowIn,
  onboardingDriveFlow,
  onboardingDriveFlowIn,
  kunaWelcomeAiFlowIn,
  kunaWelcomeAiUnfinishedFlow,
  kunaWelcomeAiRefusedFlowIn,
  kunaWelcomeBrowserFlow,
  kunaWelcomeFlow,
  kunaWelcomeFlowIn,
  moveIntoKunaFlow,
  moveIntoKunaFlowIn,
  moveStatementsIntoKunaFlow,
  moveStatementsIntoKunaFlowIn,
  onboardingDeliveryFlow,
  onboardingDeliveryFlowIn,
  onboardingPackFlow,
  onboardingPackFlowIn,
  onboardingOnDriveFlow,
  onboardingOnDriveFlowIn,
  onboardingOpenFlow,
  onboardingOpenFlowIn,
  onboardingStartOverFlow,
  onboardingStartOverFlowIn,
  ownerNetFlow,
  ownerNetUnregisteredFlow,
  ownerShareFlow,
  ownerShareFlowIn,
  salariesFlow,
  planFlow,
  planFlowIn,
  planTabFlow,
  planTabFlowIn,
  raceFlow,
  reviewSplitFlow,
  reviewSplitFlowIn,
  rulesEditorFlow,
  rulesEditorFlowIn,
  scenarioFlow,
  scenarioFlowIn,
  setUpFlow,
  shareFillFlow,
  shareFillFlowIn,
  rowIdsFlow,
  rowIdsFlowIn,
  splitFlow,
  splitFlowIn,
  refusedSplitFlowIn,
  startingScenariosFlow,
  startingScenariosFlowIn,
  statementAccessFlow,
  statementSyncFlow,
  statementsFolderFlow,
  saveFailsFlow,
  savesWaitingBenchmarkFlow,
  savesWaitingFlow,
  syncRunningFlow,
  syncStatesFlowIn,
  chatPanelFlowIn,
  chatCloseAccountFlowIn,
  chatProposeFlowIn,
  chatReadFlowIn,
  reviewFlagPersonFlowIn,
  spendingFlagPersonFlowIn,
  chatTagFlowIn,
  chatAttachFlow,
  chatAttachRefusedFlow,
  chatAttachUnsafeFlow,
  chatSheetSentFlow,
  chatAttachPdfOpenRouterFlow,
  chatAttachDropFlow,
  chatConsentFilesFlow,
  chatConsentCellsFlow,
  chatQuestionFilesFlow,
  chatStatementCardFlowIn,
  chatStatementLookAlikeFlowIn,
  chatLookupFlowIn,
  chatReceiptFlowIn,
  chatReceiptPathFlowIn,
  chatReceiptRowFlowIn,
  chatSplitFlowIn,
  spendingReceiptDialogFlowIn,
  spendingReviewAskFlowIn,
} from './support/editorFlows.mjs'
import { writeChatAttachmentSamples } from './support/chatAttachmentFiles.mjs'
import {
  setUpCardHeaderFlowIn,
  setUpChatCompanyFolderFlowIn,
  setUpChatCompanyHomeFlowIn,
  setUpChatFolderFlowIn,
  setUpChatGoesOnFlowIn,
  setUpChatHomeFlowIn,
  setUpChatNamesFlowIn,
  setUpOpenersFlowIn,
  chatOutOfCreditFlowIn,
} from './support/setUpChatFlows.mjs'
import { figureAskFlowIn } from './support/figureAskFlows.mjs'
import { overpaidFilingFlowIn, tripsFlow, tripsFlowIn } from './support/tripFlows.mjs'
import { categoriesDonationsFlowIn, yearDonationsFlowIn } from './support/donationFlows.mjs'
import { companyChatAnonymiseFlowIn, companyChatCardFlowIn, companyReviewAskFlowIn, kunaChatThemeFlowIn } from './support/companyChatFlows.mjs'
import { appChatCardFlowIn } from './support/appsChatFlows.mjs'
import { MADE_UP_ANTHROPIC_KEY } from './support/chatFlows.mjs'
import { SAMPLE_DAY, writeFlexReportSamples, writeImportSamples, writeSpendingImportSamples, writeSpendingReceiptSamples } from './support/importSampleFiles.mjs'
import { screenMenusFlow } from './support/menuFlows.mjs'
import { chatResizeFlow, menuLitFlow, quickJumpFlowIn, shellSqueezeFlow, sidebarRoomWarningFlowIn, sidebarStateFlowIn, skipLinkFlow } from './support/shellFlows.mjs'
import { writeClosesSamples } from './support/closesSampleFiles.mjs'
import { writeWorkbookSamples } from './support/workbookSampleFile.mjs'
import { runSelection } from './support/runSelection.mjs'
import { settleCharts } from './support/settleCharts.mjs'
import { screenshotWholePage } from './support/wholePage.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SCREENSHOT_DIR = process.env.VISUAL_OUTPUT_DIR ?? join(ROOT, 'visual-check')

/**
 * Every screen renders at each width. A width with a `theme` renders in that theme only, since the
 * layout does not change with the theme. `cardFlow` collapses and expands a card on each screen.
 */
const VIEWPORTS = [
  { name: 'phone', width: 360, height: 780, cardFlow: true },
  { name: 'phone-large', width: 430, height: 932, cardFlow: true },
  { name: 'small-tablet', width: 640, height: 960, theme: 'light' },
  { name: 'tablet', width: 768, height: 1024, alignedCards: true, theme: 'dark' },
  { name: 'tablet-wide', width: 1024, height: 1366, alignedCards: true, theme: 'light' },
  { name: 'laptop', width: 1280, height: 800, alignedCards: true, theme: 'dark' },
  { name: 'desktop', width: 1440, height: 900, alignedCards: true, cardFlow: true },
  { name: 'wide', width: 1920, height: 1080, alignedCards: true, theme: 'dark' },
  { name: 'wider', width: 2560, height: 1440, alignedCards: true, theme: 'light' },
  // The expanded sidebar beside the docked chat: at its narrowest, where the owner first met it, and on a wide monitor.
  { name: 'docked-narrowest', width: 1264, height: 900, alignedCards: true, theme: 'light', chatDocked: true },
  { name: 'docked-laptop', width: 1390, height: 900, alignedCards: true, theme: 'dark', chatDocked: true },
  { name: 'docked-wide', width: 1920, height: 1080, alignedCards: true, theme: 'light', chatDocked: true },
]

const selection = runSelection(VIEWPORTS.map((viewport) => viewport.width))
const BASE = selection.base

/** A card is a raised surface. One nested inside another card is part of that card. */
const CARD_SELECTOR = '.rounded-card'

/**
 * `charts` is how many charts the screen draws from the fake workbook. `shows` is the text, or the
 * texts, that only appear once the fake workbook's rows reached the screen. `linkedRule` is the rule a deep link names.
 * `linkedPart` is the element a deep link's hash names, and `linkedRow` the row a deep link's query
 * marks, each inside a card that has to open for it. `linkedCard` is a card a link from another
 * screen points at, which has to open. `collapsedBefore` names the cards this device
 * remembers as collapsed, and `expandedBefore` those it remembers as open. `stored` is what this device keeps in localStorage before the page loads, such as made-up price vendor keys. `lacks` is text the screen must not show. `cards: false` marks a screen with no collapsible card.
 */
/** The ids of the sample Loans file's bank loan, its informal loan you owe and its informal loan owed to you whose borrower is behind on the plan, `?loans=sample`. */
const SAMPLE_BANK_LOAN = 'fa4e0000-0000-4000-8000-000000000001'
const SAMPLE_INFORMAL_LOAN = 'fa4e0000-0000-4000-8000-000000000006'
const SAMPLE_PLANNED_LOAN = 'fa4e0000-0000-4000-8000-000000000040'
const SAMPLE_SETTLED_LOAN = 'fa4e0000-0000-4000-8000-000000000050'
/** The equal principal loan of `?loans=equal-principal`. */
const FLAT_LOAN = 'fa4e0000-0000-4000-8000-000000000070'

/** The day the fake build seeds its prices for, so the expected figures are the ones on screen. */
const INVESTMENTS_DAY = pricesDay(new Date().toISOString())
const CROATIAN_MONEY = { currency: 'EUR', locale: 'hr-HR' }

/**
 * The made-up portfolio's figures on the Overview and the home card, worked out with the same domain functions the
 * screens use, as `?investments=` and `?prices=` name the fake sets. Money comes in English and in Croatian.
 */
function fakeInvestmentsShows(variant, pricesVariant) {
  const { workbook, rates, figures } = fakePortfolio(variant, pricesVariant)
  const income = incomeAgainstLastYear(workbook.book, INVESTMENTS_DAY)
  const sources = gainSources(figures)
  const newestFlow = latestRecords(workbook.book, rates, 5).find((entry) => entry.kind === 'trade' || entry.kind === 'income' || entry.kind === 'cash-movement')
  return {
    close: weekdayDayLabel(figuresClose(figures)),
    newestShort: shortDayLabel(figuresClose(figures)),
    english: [
      formatMoney(figures.value),
      formatMoney(figures.totalGain, 'always'),
      `${formatPercent(figures.totalGainShare, 'always')} on the ${formatMoney(figures.putIn)} you put in`,
      formatMoney(income.thisYear),
      formatMoney(sources.tradingFees),
      ...(figures.lastDay?.share == null ? [] : [formatPercentChange(figures.lastDay.share)]),
      ...(newestFlow === undefined ? [] : [formatMoney(newestFlow.euros, 'always')]),
    ],
    croatian: [formatMoney(figures.value, 'negative', CROATIAN_MONEY), formatMoney(figures.totalGain, 'always', CROATIAN_MONEY), formatMoney(figures.putIn, 'negative', CROATIAN_MONEY)],
    home: [formatMoney(figures.value), formatMoney(figures.totalGain, 'always')],
    homeCroatian: [formatMoney(figures.value, 'negative', CROATIAN_MONEY), formatMoney(figures.totalGain, 'always', CROATIAN_MONEY)],
    ...homeBadge(workbook.book, rates, figuresClose(figures)),
  }
}

/** The home card's badge on the check's day: the nearest tax date, or else the late prices, in English in full and in Croatian by its first words. */
function homeBadge(book, rates, newestClose) {
  const reminder = taxReminder(book, rates, INVESTMENTS_DAY)
  if (reminder === null) {
    return { badge: `Prices from ${shortDayLabel(newestClose)}`, badgeCroatian: 'Cijene od' }
  }
  const day = shortDayLabel(reminder.due)
  switch (reminder.kind) {
    case 'ino-doh':
      return { badge: `INO-DOH by ${day}`, badgeCroatian: 'INO-DOH do' }
    case 'joppd':
      return { badge: `JOPPD by ${day}`, badgeCroatian: 'JOPPD do' }
    case 'payments':
      return { badge: reminder.count === 1 ? `Tax on 1 payment by ${day}` : `Tax on ${reminder.count} payments by ${day}`, badgeCroatian: 'Porez na' }
  }
}

/** The made-up Investments file and its figures on the fake build's day, as `?investments=` and `?prices=` name them. */
function fakePortfolio(variant, pricesVariant) {
  const at = `${INVESTMENTS_DAY}T09:00:00.000Z`
  const { workbook } = INVESTMENTS_DOCUMENT.read({ meta: { id: 'visual', source: 'browser', title: 'visual', syncedAt: at }, document: fakeInvestmentsDocument(at, variant) })
  const prices = fakePricesFile(pricesVariant, INVESTMENTS_DAY)
  const rates = pricesFileRateBook(prices)
  const figures = portfolioFigures({ book: workbook.book, prices: pricesFileBook(prices, workbook.book.prices), rates, today: INVESTMENTS_DAY })
  return { workbook, rates, figures }
}

/** The ids of the sample Assets file's flat, linked to the sample Home loan, and its car, `?assets=sample`. */
const SAMPLE_FLAT = 'fa4e2000-0000-4000-8000-000000000001'
const SAMPLE_CAR = 'fa4e2000-0000-4000-8000-000000000002'
const FAKE_HOUSE_INDEX = houseIndexOfAnswer(FAKE_HOUSE_INDEX_ANSWER)

/** The sample Assets file and the sample Loans file's bank loans as Assets reads them, on the check's day. */
function fakeAssets(set = 'sample') {
  const at = `${INVESTMENTS_DAY}T09:00:00.000Z`
  const meta = { id: 'visual', source: 'browser', title: 'visual', syncedAt: at }
  return {
    book: ASSETS_DOCUMENT.read({ meta, document: fakeAssetsDocument(at, set) }).workbook,
    loans: assetLoansOf(bankLoansOf(LOANS_DOCUMENT.read({ meta, document: fakeLoansDocument(at) }).workbook, today())),
  }
}

/**
 * The sample Assets file's figures, worked out with the functions its screens call: what the assets are worth beside the
 * sample Loans file and alone, the flat with what is owed on the Home loan and what is yours, the flat at its price
 * while the index fails, and the car by the customs table. Money comes in English and in Croatian.
 */
function fakeAssetsShows() {
  const { book, loans } = fakeAssets()
  const total = assetsTotal(book, today(), FAKE_HOUSE_INDEX, loans)
  const [flat, car] = assetsOnDay(book, today(), FAKE_HOUSE_INDEX, loans)
  const both = (cents) => ({ english: formatMoney(cents), croatian: formatMoney(cents, 'negative', CROATIAN_MONEY) })
  return {
    total: both(total.value),
    alone: both(assetsTotal(book, today(), FAKE_HOUSE_INDEX, null).value),
    yours: yoursCaption(total.yoursAfter),
    flat: { value: both(flat.value.cents), caption: valueCaption(flat.value), owed: both(flat.equity.owed), yours: both(flat.equity.yours), price: both(flat.asset.price) },
    car: { value: both(car.value.cents), caption: valueCaption(car.value) },
  }
}

/** The sample Spending file's USD account, `?spending=sample`, which the made-up ECB rates turn into euros. */
const SAMPLE_USD_ACCOUNT = 'fa4e3000-0000-4000-8000-000000001003'
const SAMPLE_OTP_ACCOUNT = 'fa4e3000-0000-4000-8000-000000001001'

/** A fake Spending set as its screens read it on the check's day, with the made-up ECB rates its foreign accounts need, or with the rates failed. */
async function fakeSpending(set, ratesFailed = false) {
  const at = new Date().toISOString()
  const meta = { id: 'visual', source: 'browser', title: 'visual', syncedAt: at }
  const book = SPENDING_DOCUMENT.read({ meta, document: fakeSpendingDocument(at, set) }).workbook
  return { book, rates: await fakeRatesState(ratesNeeded(book), today(), ratesFailed) }
}

/**
 * The fake Spending sets' figures, worked out with the functions its screens call: this month's spent, income and saved,
 * what is left of its limits, Food's limit with its carry, the limits `over` overspends, what the open accounts hold in
 * euros with the rates and while they fail, the dollar account in dollars and in euros with its rate line, and the
 * payees of this month. Money comes in English and in Croatian.
 */
async function fakeSpendingShows(sample) {
  const failed = await fakeSpending('sample', true)
  const over = await fakeSpending('over')
  const day = today()
  const month = monthOf(day)
  const both = (cents, sign = 'negative') => ({ english: formatMoney(cents, sign), croatian: formatMoney(cents, sign, CROATIAN_MONEY) })
  const figures = spendingFigures(sample.book, sample.rates.everyday)
  const totals = figures.totalsOf(month)
  const limits = figures.limitsIn(month)
  const food = limits.find((limit) => sample.book.categories.find((category) => category.id === limit.category)?.name === 'Food')
  const [held] = spendingHubFigures(sample.book, sample.rates, day).parts
  const [heldWhileFailed] = spendingHubFigures(failed.book, failed.rates, day).parts
  const dollars = accountsOnDay(sample.book, day, sample.rates.everyday).find((entry) => entry.account.currency !== EURO)
  const overspent = spendingFigures(over.book, over.rates.everyday)
    .limitsIn(month)
    .filter((limit) => limit.left < 0)
  return {
    spent: both(totals.spent),
    left: both(leftToSpend(limits)),
    food: { available: both(food.available), left: both(food.left), carriedIn: both(food.carriedIn, 'always') },
    held: { ...both(held.cents), caption: held.caption },
    heldWhileFailed: { ...both(heldWhileFailed.cents), caption: heldWhileFailed.caption },
    dollars: {
      balance: { english: formatAccountMoney(dollars.balance, dollars.account.currency), croatian: formatMoney(dollars.balance, 'negative', { currency: dollars.account.currency, locale: 'hr-HR' }) },
      euros: both(dollars.euros),
      rateLine: euroLine(dollars, sample.rates, day).caption,
    },
    over: {
      english: overspent.map((limit) => budgetsEnglish.overBy(formatMoney(-limit.left))),
      croatian: overspent.map((limit) => budgetsCroatian.overBy(formatMoney(-limit.left, 'negative', CROATIAN_MONEY))),
    },
    payees: [...new Set(sample.book.transactions.filter((row) => monthOf(row.date) === month).map((row) => row.payee))],
  }
}

/**
 * Net worth on the fake sets, worked out with the functions its screen calls: the sum of the sample Loans,
 * Investments, Assets and Spending files with each of their parts, what is yours after the Home loan and what the
 * accounts span, with what the sum leaves out, the sum of the Investments, the Assets and the Spending sample alone,
 * and what the owner could take out of the company kept in this browser (`?fake=browser`). Money comes in English and
 * in Croatian.
 */
function fakeOverviewShows(spendingSample) {
  const at = `${INVESTMENTS_DAY}T09:00:00.000Z`
  const meta = { id: 'visual', source: 'browser', title: 'visual', syncedAt: at }
  const loans = loansHubFigures(LOANS_DOCUMENT.read({ meta, document: fakeLoansDocument(at) }).workbook, today())
  const investments = investmentsHubFigures(fakePortfolio('sample', 'sample').figures)
  const sample = fakeAssets()
  const assets = assetsHubFigures(sample.book, today(), FAKE_HOUSE_INDEX, sample.loans)
  const assetsAlone = assetsHubFigures(sample.book, today(), FAKE_HOUSE_INDEX, null)
  const spending = spendingHubFigures(spendingSample.book, spendingSample.rates, today())
  const netOf = (figures) => personalNet(figures.map((counted) => ({ name: 'visual', notSetUp: false, currency: 'EUR', figures: counted })))
  const sumOf = (figures) => netOf(figures).sum.cents
  const leavesOut = (figures) => netWorthEnglish.leavesOut(netOf(figures).leavesOut)
  installHrDooPack()
  const [takeOut] = companyHubFigures(readDocument(meta, fakeWorkbookDocument(at, 'browser', null)).workbook).parts
  const every = [loans, investments, assets, spending]
  const amounts = [sumOf(every), ...every.flatMap((figures) => figures.parts).map((part) => part.cents)]
  return {
    english: [...amounts.map((cents) => formatMoney(cents)), assets.parts[0].caption, spending.parts[0].caption, leavesOut(every)].filter((text) => text !== ''),
    croatian: amounts.map((cents) => formatMoney(cents, 'negative', CROATIAN_MONEY)),
    investmentsOnly: formatMoney(sumOf([investments])),
    assetsOnly: formatMoney(sumOf([assetsAlone])),
    assetsOnlyLeavesOut: leavesOut([assetsAlone]),
    spendingOnly: { english: formatMoney(sumOf([spending])), croatian: formatMoney(sumOf([spending]), 'negative', CROATIAN_MONEY), caption: spending.parts[0].caption },
    takeOut: formatMoney(takeOut.cents),
    takeOutCroatian: formatMoney(takeOut.cents, 'negative', CROATIAN_MONEY),
  }
}

/** The sample's Holdings figures: the value, the holdings' cost and their gain, in English and in Croatian. */
function fakeHoldingsShows() {
  const { workbook, figures } = fakePortfolio('sample', 'sample')
  const { total } = holdingsList(figures, workbook.book, { grouping: 'class', find: '', sort: null })
  return {
    english: [formatMoney(total.value), formatMoney(total.cost), formatMoney(total.gain, 'always')],
    croatian: [formatMoney(total.value, 'negative', CROATIAN_MONEY), formatMoney(total.cost, 'negative', CROATIAN_MONEY), formatMoney(total.gain, 'always', CROATIAN_MONEY)],
  }
}

/** Example Tech of the sample, in US dollars with its first lot partly sold, and Example Spinco, received in a spin-off, split two for one and priced by hand. */
const SAMPLE_SHARE_A = 'fa4e1000-0000-4000-8000-000000000010'
const SAMPLE_SPIN_CO = 'fa4e1000-0000-4000-8000-000000000014'
/** The sample's World ETF, accumulating, with its own mix by sector and by country, and its Index Fund, never bought, with no mix. */
const SAMPLE_WORLD_ETF = 'fa4e1000-0000-4000-8000-000000000012'
const SAMPLE_INDEX_FUND = 'fa4e1000-0000-4000-8000-000000000015'
/** The sample's Example Dividend Co, whose company profile Finnhub refused, and its Money Fund, with a whole fund profile from Alpha Vantage and no TER typed. */
const SAMPLE_SHARE_B = 'fa4e1000-0000-4000-8000-000000000011'
const SAMPLE_MONEY_FUND = 'fa4e1000-0000-4000-8000-000000000013'

/** A sample holding's page: its name, its value, its total return and its average cost, in English and in Croatian. */
function fakeHoldingShows(key) {
  const { figures } = fakePortfolio('sample', 'sample')
  const holding = figures.holdings.find((entry) => entry.instrument.id === `instrument:${key}`)
  const returns = holdingReturn(holding)
  return {
    name: holding.instrument.name,
    english: [formatMoney(holding.valuation.value), formatMoney(returns.total, 'always'), averageCostText(holding)],
    croatian: [formatMoney(holding.valuation.value, 'negative', CROATIAN_MONEY), formatMoney(returns.total, 'always', CROATIAN_MONEY)],
  }
}

const SAMPLE_HOLDINGS = fakeHoldingsShows()

/** The sample's sources and the facts its fake prices file holds, as Holdings and the Overview read them. */
function fakeSources() {
  const { workbook, rates, figures } = fakePortfolio('sample', 'sample')
  const prices = fakePricesFile('sample', INVESTMENTS_DAY)
  const sources = { book: workbook.book, prices: pricesFileBook(prices, workbook.book.prices), rates, today: INVESTMENTS_DAY }
  return { book: workbook.book, sources, figures, facts: fetchedFactsBook(prices.facts) }
}

/** The gap of each group of the sample's target mix, in English and in Croatian. */
function fakeTargetsShows() {
  const { book, figures, facts } = fakeSources()
  const mix = holdingMix(figures, book, facts, book.targets[0].slice.mix)
  const gaps = targetGaps(mix, book.targets).map((line) => line.gap)
  return { english: gaps.map((gap) => formatMoney(gap, 'always')), croatian: gaps.map((gap) => formatMoney(gap, 'always', CROATIAN_MONEY)) }
}

/** The sentences of the sample's portfolio checks, as the Overview lists them in English. */
function fakeChecksShows() {
  const { book, sources, figures, facts } = fakeSources()
  const checks = portfolioChecks(figures, holdingMixes(figures, book, facts), recentCosts(sources, dayValuer(sources), facts), book.targets, book.checks)
  return checkLines(checks, book).map((line) => line.sentence)
}

/** The values and captions of a sample holding's Details card in English, with its warnings, as the fake prices file's facts give them. */
function fakeDetailsShows(key) {
  const { sources, figures, facts } = fakeSources()
  const holding = figures.holdings.find((entry) => entry.instrument.id === `instrument:${key}`)
  const details = holdingDetails(holding, sources, facts)
  return [
    ...details.facts.flatMap((fact) => [fact.value, ...(fact.caption === undefined ? [] : [fact.caption])]),
    ...(details.problems?.sentences ?? []),
    ...(details.leveraged === null ? [] : [details.leveraged]),
  ]
}

const SAMPLE_TARGETS = fakeTargetsShows()
const SAMPLE_CHECKS = fakeChecksShows()

/** A past close for Holdings' `?on=`, after the World ETF's buys and the retired share's sale. */
const HOLDINGS_PAST_DAY = '2025-12-31'

/** The close of the first late holding when the fake prices stop four weekdays back, as Holdings marks it. */
const LATE_HOLDING_CLOSE = dayLabel(fakePortfolio('sample', 'late-prices').figures.holdings.find((holding) => holding.late).valuation.close.date)
const SAMPLE_SHARE_A_PAGE = fakeHoldingShows(SAMPLE_SHARE_A)
const SAMPLE_SPIN_CO_PAGE = fakeHoldingShows(SAMPLE_SPIN_CO)

/**
 * Performance over a period of a fake set, everything unless named, worked out as the screen works it out: the
 * time-weighted return and its rate a year, the money-weighted rate, and with a benchmark its own return, the difference
 * and the same money in it beside the portfolio's value.
 */
function fakePerformanceShows(variant, pricesVariant, period = { kind: 'all' }) {
  const { workbook, rates } = fakePortfolio(variant, pricesVariant)
  const prices = fakePricesFile(pricesVariant, INVESTMENTS_DAY)
  const sources = { book: workbook.book, prices: pricesFileBook(prices, workbook.book.prices), rates, today: INVESTMENTS_DAY }
  const performance = portfolioPerformance(sources, comparedBenchmark(benchmarkState(sources), workbook.book, prices.splits), period)
  const { timeWeighted, moneyWeighted, value } = performance.portfolio
  const comparison = performance.benchmark
  return {
    english: [
      `From ${dayLabel(performance.from)} to ${dayLabel(performance.to)}.`,
      formatPercentChange(timeWeighted.total),
      ...(timeWeighted.yearly === null ? [] : [`time-weighted, ${formatPercentChange(timeWeighted.yearly)} a year`]),
      ...(moneyWeighted.kind === 'rate' ? [formatPercentChange(moneyWeighted.rate)] : []),
      ...(comparison === null
        ? []
        : [
            formatPercentChange(comparison.priceReturn.total),
            formatPercentChange(comparison.difference),
            `${formatMoney(comparison.replay.value)} against your ${formatMoney(value)}`,
            `You are ${formatMoney(comparison.valueDifference, 'magnitude')} ${comparison.valueDifference < 0 ? 'behind' : 'ahead'}`,
          ]),
    ],
    croatian:
      comparison === null
        ? []
        : [
            formatMoney(value, 'negative', CROATIAN_MONEY),
            formatMoney(comparison.replay.value, 'negative', CROATIAN_MONEY),
            `${comparison.valueDifference < 0 ? 'Zaostajete' : 'Ispred ste'} ${formatMoney(comparison.valueDifference, 'magnitude', CROATIAN_MONEY)}`,
          ],
  }
}

/**
 * Performance's other tabs on the sample, worked out as the screen works them out: the first year's chained return on
 * Months, the price and currency totals of the currency effect over everything and over the last year on Sources, and
 * the deepest fall below a peak on Falls, which the risk card beside it shows as the largest fall.
 */
function fakePerformanceTabsShows() {
  const { workbook, rates } = fakePortfolio('sample', 'sample')
  const prices = fakePricesFile('sample', INVESTMENTS_DAY)
  const sources = { book: workbook.book, prices: pricesFileBook(prices, workbook.book.prices), rates, today: INVESTMENTS_DAY }
  const compared = comparedBenchmark(benchmarkState(sources), workbook.book, prices.splits)
  const valuedOn = dayValuer(sources)
  const everything = portfolioPerformance(sources, compared, { kind: 'all' }, valuedOn)
  const lastYear = portfolioPerformance(sources, compared, { kind: 'years', years: 1 }, valuedOn)
  const totals = (performance, format) => {
    const gains = periodGains(sources, performance, valuedOn)
    return [formatMoney(gains.start, 'negative', format), formatMoney(gains.end, 'negative', format), formatMoney(gains.price, 'always', format), formatMoney(gains.currency, 'always', format)]
  }
  return {
    months: formatPercentChange(monthlyReturns(everything.growth)[0].portfolio),
    sources: totals(everything),
    sourcesCroatian: totals(everything, CROATIAN_MONEY),
    sourcesLastYear: totals(lastYear),
    deepest: formatPercentChange(underwater(everything.growth).deepest),
  }
}

/**
 * The sample's income tabs on Performance, worked out as the tabs work them out: the newest year's income received,
 * what the next twelve months should bring and the day the soonest lot turns tax-free with its value now.
 */
function fakeIncomeShows() {
  const { workbook, rates, figures } = fakePortfolio('sample', 'sample')
  const prices = fakePricesFile('sample', INVESTMENTS_DAY)
  const sources = { book: workbook.book, prices: pricesFileBook(prices, workbook.book.prices), rates, today: INVESTMENTS_DAY }
  const [newestYear] = incomeByYear(workbook.book, INVESTMENTS_DAY)
  const coming = incomeForecast(sources, fetchedFactsBook(prices.facts)).received
  const [soonest] = taxFreeCalendar(figures, INVESTMENTS_DAY).flatMap((month) => month.lots)
  const [newestCosts] = yearlyCosts(sources, dayValuer(sources), fetchedFactsBook(prices.facts))
  const rhythm = investingRhythm(workbook.book, INVESTMENTS_DAY)
  return {
    income: [formatMoney(newestYear.total.received)],
    incomeCroatian: [formatMoney(newestYear.total.received, 'negative', CROATIAN_MONEY)],
    coming: [`About ${formatMoney(coming)} in the next 12 months`],
    comingCroatian: [`Oko ${formatMoney(coming, 'negative', CROATIAN_MONEY)} u sljedećih 12 mjeseci`],
    taxFree: [`tax-free from ${dayLabel(soonest.lot.taxFreeFrom)}`, formatMoney(soonest.value)],
    taxFreeCroatian: [formatMoney(soonest.value, 'negative', CROATIAN_MONEY)],
    costs: [formatMoney(newestCosts.total)],
    costsCroatian: [formatMoney(newestCosts.total, 'negative', CROATIAN_MONEY)],
    saving: [formatMoney(rhythm.averageMonth)],
    savingCroatian: [formatMoney(rhythm.averageMonth, 'negative', CROATIAN_MONEY)],
  }
}

const SAMPLE_PERFORMANCE = fakePerformanceShows('sample', 'sample')
const SAMPLE_PERFORMANCE_TABS = fakePerformanceTabsShows()
const SAMPLE_INCOME = fakeIncomeShows()

/** The sample's 2026 on the Tax screen, worked out as the screen works it out, in English and in Croatian. */
function fakeTaxShows() {
  const { workbook, rates } = fakePortfolio('sample', 'sample')
  const gains = capitalGainsYear(workbook.book, rates, 2026)
  const foreign = foreignIncomeYear(workbook.book, rates, 2026)
  const both = (cents, sign = 'negative') => [formatMoney(cents, sign), formatMoney(cents, sign, CROATIAN_MONEY)]
  const [tax, taxCroatian] = both(gains.tax)
  const [free, freeCroatian] = both(gains.taxFreeGains)
  const saleGains = gains.sales.map((sale) => both(sale.gain, 'always'))
  const [left, leftCroatian] = both(foreign.joppd.leftToPay)
  return {
    year: [tax, free, gains.reportMark],
    yearCroatian: [taxCroatian, freeCroatian, gains.reportMark],
    sales: saleGains.map(([english]) => english),
    salesCroatian: saleGains.map(([, croatian]) => croatian),
    foreign: [left],
    foreignCroatian: [leftCroatian],
  }
}

const SAMPLE_TAX = fakeTaxShows()
const YOUNG_PERFORMANCE = fakePerformanceShows('young', 'sample')
const NO_BENCHMARK_PERFORMANCE = fakePerformanceShows('sample', 'no-benchmark')
const YEAR_PERFORMANCE = fakePerformanceShows('sample', 'sample', { kind: 'year', year: 2024 })

const SAMPLE_INVESTMENTS = fakeInvestmentsShows('sample', 'sample')
const LATE_INVESTMENTS = fakeInvestmentsShows('sample', 'late-prices')
const CASH_BELOW_ZERO_INVESTMENTS = fakeInvestmentsShows('cash-below-zero', 'sample')
const SPENDING_SAMPLE = await fakeSpending('sample')
const OVERVIEW = fakeOverviewShows(SPENDING_SAMPLE)
const ASSETS = fakeAssetsShows()
const SPENDING = await fakeSpendingShows(SPENDING_SAMPLE)

const SCREENS = [
  { name: 'overview', hash: '#/company', title: 'Overview', charts: 2, shows: ['Waiting for you', 'A typical month', 'Every euro earned', 'Balance at month end'] },
  {
    name: 'overview-croatian',
    query: 'lang=hr',
    hash: '#/company',
    title: 'Pregled',
    charts: 2,
    shows: ['Čeka vas', 'Tipičan mjesec, na tri načina', 'Kamo ide prihod', 'Stanje na kraju mjeseca', 'Novca dostaje za'],
  },
  { name: 'transactions', hash: '#/company/transactions', title: 'Transactions', charts: 0, shows: 'Northwind Analytics', cards: false },
  { name: 'transactions-owner-part', hash: '#/company/transactions?p=all&cat=equipment', title: 'Transactions', charts: 0, shows: ['30% to owner, from Equipment', 'Laptop Store'], cards: false },
  {
    name: 'transactions-owner-part-reverse-charge',
    hash: '#/company/transactions?p=l3&cat=ai-services',
    title: 'Transactions',
    charts: 0,
    shows: ['50% to owner', 'MODEL API SUBSCRIPTION'],
    cards: false,
  },
  {
    name: 'transactions-owner-part-reverse-charge-croatian',
    query: 'lang=hr',
    hash: '#/company/transactions?p=l3&cat=ai-services',
    title: 'Transakcije',
    charts: 0,
    shows: ['50\u00a0% vlasniku', 'MODEL API SUBSCRIPTION'],
    cards: false,
  },
  { name: 'transactions-croatian', query: 'lang=hr', hash: '#/company/transactions', title: 'Transakcije', charts: 0, shows: ['Northwind Analytics', 'Izvezi CSV', 'Stavke', 'Uvoz'], cards: false },
  {
    name: 'transactions-owner-part-croatian',
    query: 'lang=hr',
    hash: '#/company/transactions?p=all&cat=equipment',
    title: 'Transakcije',
    charts: 0,
    shows: ['30\u00a0% vlasniku, iz kategorije „Oprema”', 'Laptop Store'],
    cards: false,
  },
  { name: 'import', hash: '#/company/transactions?tab=import', title: 'Transactions', charts: 0, shows: 'Drop a statement file here', cards: false },
  {
    name: 'import-croatian',
    query: 'lang=hr',
    hash: '#/company/transactions?tab=import',
    title: 'Transakcije',
    charts: 0,
    shows: ['Ispusti datoteku izvoda ovdje', 'Datoteka izvoda'],
    cards: false,
  },
  { name: 'analysis', hash: '#/company/analysis', title: 'Analysis', charts: 0, shows: ['External contractors', 'Who the company paid most'] },
  { name: 'analysis-over-time', hash: '#/company/analysis?tab=over-time', title: 'Analysis', charts: 2, shows: ['Rolling net', 'Cumulative net'] },
  { name: 'analysis-compare', hash: '#/company/analysis?tab=compare', title: 'Analysis', charts: 0, shows: ['Revenue', 'Show all'] },
  { name: 'analysis-croatian', query: 'lang=hr', hash: '#/company/analysis', title: 'Analiza', charts: 0, shows: ['Troškovi po kategorijama', 'Kome je tvrtka najviše platila', 'Raspodjela'] },
  { name: 'analysis-over-time-croatian', query: 'lang=hr', hash: '#/company/analysis?tab=over-time', title: 'Analiza', charts: 2, shows: ['Pomični neto', 'Kumulativni neto', 'Tekući mjesec'] },
  { name: 'analysis-compare-croatian', query: 'lang=hr', hash: '#/company/analysis?tab=compare', title: 'Analiza', charts: 0, shows: ['Račun dobiti i gubitka', 'Po kategorijama', 'Pozicija'] },
  { name: 'invoicing', hash: '#/company/invoicing', title: 'Invoicing', charts: 1, shows: ['Next invoice', 'Every invoice', 'Show all'] },
  { name: 'invoicing-plan', hash: '#/company/invoicing?tab=plan', title: 'Invoicing', charts: 0, shows: ['Plan rows, 2026', 'Month by month, 2026', 'Totals over every client'] },
  {
    name: 'invoicing-month',
    hash: '#/company/invoicing?tab=plan&year=2026&month=2026-10#billing-month-2026-10',
    title: 'Invoicing',
    charts: 0,
    shows: "of the month's rows is not invoiced yet",
    linkedPart: 'billing-month-2026-10',
  },
  { name: 'invoicing-plan-2025', hash: '#/company/invoicing?tab=plan&year=2025', title: 'Invoicing', charts: 0, shows: 'Month by month, 2025' },
  { name: 'invoicing-plan-2025-croatian', query: 'lang=hr', hash: '#/company/invoicing?tab=plan&year=2025', title: 'Računi', charts: 0, shows: 'Po mjesecima, 2025.' },
  { name: 'invoicing-clients', hash: '#/company/invoicing?tab=clients', title: 'Invoicing', charts: 0, shows: 'Add client' },
  {
    name: 'invoicing-terms',
    hash: '#/company/invoicing?tab=clients#invoicing-terms',
    title: 'Invoicing',
    charts: 0,
    shows: 'Save terms',
    linkedPart: 'invoicing-terms',
  },
  {
    name: 'invoicing-croatian',
    query: 'lang=hr',
    hash: '#/company/invoicing',
    title: 'Računi',
    charts: 1,
    shows: ['Sljedeći račun', 'Svi računi, s uplatama koje su ih podmirile', 'Dani do naplate'],
  },
  {
    name: 'invoicing-plan-croatian',
    query: 'lang=hr',
    hash: '#/company/invoicing?tab=plan',
    title: 'Računi',
    charts: 0,
    shows: ['Stavke plana, 2026.', 'Po mjesecima, 2026.', 'Ukupno za sve klijente'],
  },
  {
    name: 'invoicing-month-croatian',
    query: 'lang=hr',
    hash: '#/company/invoicing?tab=plan&year=2026&month=2026-10#billing-month-2026-10',
    title: 'Računi',
    charts: 0,
    shows: 'od stavki ovog mjeseca još nije fakturirano',
    linkedPart: 'billing-month-2026-10',
  },
  { name: 'invoicing-clients-croatian', query: 'lang=hr', hash: '#/company/invoicing?tab=clients', title: 'Računi', charts: 0, shows: ['Novi klijent', 'Uvjeti naplate i računa'] },
  {
    name: 'invoicing-terms-croatian',
    query: 'lang=hr',
    hash: '#/company/invoicing?tab=clients#invoicing-terms',
    title: 'Računi',
    charts: 0,
    shows: ['Spremi uvjete', 'Napomena o prijenosu porezne obveze'],
    linkedPart: 'invoicing-terms',
  },
  {
    name: 'year',
    hash: '#/company/year?tab=taxes',
    title: 'Year',
    charts: 0,
    shows: ['Corporate income tax, expected against paid', 'Payroll cadence', 'Tax by type'],
  },
  { name: 'year-forecast-unregistered', query: 'fake=unregistered', hash: '#/company/year', title: 'Year', charts: 0, shows: 'The forecast needs the day the company was registered', cards: false },
  { name: 'year-plan', hash: '#/company/year?tab=plan', title: 'Year', charts: 0, shows: ['Plan for 2026', 'Revenue comes from the billing plan'], cards: false },
  {
    name: 'year-pay-unregistered',
    query: 'fake=unregistered',
    hash: '#/company/year?year=2027&tab=pay',
    title: 'Year',
    charts: 0,
    shows: ['The figures need the “Company registered on” setting', 'Scenarios for 2027'],
  },
  { name: 'year-accountant', hash: '#/company/year?year=2025', title: 'Year', charts: 1, shows: ['Lines at a glance', 'From the cash net to profit, 2025'] },
  { name: 'year-statements', hash: '#/company/year?tab=statements', title: 'Year', charts: 0, shows: ['Profit and loss', 'Konto lines', "The accountant's lines"] },
  { name: 'year-assets', hash: '#/company/year?tab=assets', title: 'Year', charts: 0, shows: ['Workstation', 'Asset rows', 'Grant rows'] },
  {
    name: 'year-croatian',
    query: 'lang=hr',
    hash: '#/company/year?tab=taxes',
    title: 'Godina',
    charts: 0,
    shows: ['Porez na dobit, očekivano i plaćeno', 'Ritam plaćanja poreza na plaće', 'Porezi po vrsti'],
  },
  {
    name: 'year-forecast-unregistered-croatian',
    query: 'fake=unregistered&lang=hr',
    hash: '#/company/year',
    title: 'Godina',
    charts: 0,
    shows: 'Za prognozu treba dan registracije tvrtke',
    cards: false,
  },
  { name: 'year-plan-croatian', query: 'lang=hr', hash: '#/company/year?tab=plan', title: 'Godina', charts: 0, shows: ['Plan za 2026.', 'Prihod dolazi iz plana naplate'], cards: false },
  {
    name: 'year-pay-unregistered-croatian',
    query: 'fake=unregistered&lang=hr',
    hash: '#/company/year?year=2027&tab=pay',
    title: 'Godina',
    charts: 0,
    shows: ['Za brojke treba postavka „Tvrtka registrirana”', 'Scenariji za 2027.'],
  },
  { name: 'year-accountant-croatian', query: 'lang=hr', hash: '#/company/year?year=2025', title: 'Godina', charts: 1, shows: ['Pozicije na prvi pogled', 'Od neto novca do dobiti, 2025.'] },
  { name: 'year-statements-croatian', query: 'lang=hr', hash: '#/company/year?tab=statements', title: 'Godina', charts: 0, shows: ['Račun dobiti i gubitka', 'Konta', 'Knjigovođine pozicije'] },
  { name: 'year-assets-croatian', query: 'lang=hr', hash: '#/company/year?tab=assets', title: 'Godina', charts: 0, shows: ['Workstation', 'Retci sredstava', 'Retci potpora'] },
  { name: 'year-assets-doubled', hash: '#/company/year?tab=assets&rates=doubled', title: 'Year', charts: 0, shows: 'What doubled rates would change' },
  {
    name: 'year-grant-rows',
    hash: '#/company/year?tab=assets#grant-rows',
    title: 'Year',
    charts: 0,
    shows: 'Save grants',
    collapsedBefore: ['year.grant-rows'],
    linkedPart: 'grant-rows',
  },
  { name: 'salaries', hash: '#/company/salaries', title: 'Salaries', charts: 0, shows: ["No row is the director's yet", 'No employees yet.', 'Add employee'] },
  { name: 'salaries-croatian', query: 'lang=hr', hash: '#/company/salaries', title: 'Plaće', charts: 0, shows: ['Još nijedan redak nije direktorov', 'Još nema zaposlenika.', 'Novi zaposlenik'] },
  {
    name: 'owner',
    hash: '#/company/owner',
    title: 'Owner',
    charts: 2,
    shows: [
      'Owner take by type',
      'Loans, net',
      'Rent tax the owner pays the tax office',
      'Owed by the owner at each month end',
      'Net share of gross cost',
      'Monthly net pay',
      'Monthly net, profit included',
      'Benefits from company costs',
      'of it from company costs',
    ],
    cards: false,
  },
  {
    name: 'owner-croatian',
    query: 'lang=hr',
    hash: '#/company/owner',
    title: 'Vlasnik',
    charts: 2,
    shows: ['Ukupno vlasniku po vrsti', 'Neto udio u bruto trošku', 'Mjesečna neto isplata', 'Koristi od troškova tvrtke'],
    cards: false,
  },
  { name: 'owner-2025', hash: '#/company/owner?p=2025', title: 'Owner', charts: 2, shows: ['Jan 2025 – Dec 2025', 'Owner take by type', 'Monthly net pay', 'over 8 months'], cards: false },
  {
    name: 'owner-2025-croatian',
    query: 'lang=hr',
    hash: '#/company/owner?p=2025',
    title: 'Vlasnik',
    charts: 2,
    shows: ['Ukupno vlasniku po vrsti', 'Mjesečna neto isplata', 'kroz 8 mjeseci'],
    cards: false,
  },
  {
    name: 'owner-owed',
    hash: '#/company/owner?tab=owed',
    title: 'Owner',
    charts: 0,
    shows: ['Costs the owner paid privately', 'with no cost on file waits for review', 'The owner owes the company on 8 Oct 2026', 'Owed at the end'],
  },
  {
    name: 'owner-owed-croatian',
    query: 'lang=hr',
    hash: '#/company/owner?tab=owed',
    title: 'Vlasnik',
    charts: 0,
    shows: ['Troškovi koje je vlasnik platio privatno', 'Vlasnik duguje tvrtki', 'Dug na kraju'],
  },
  {
    name: 'owner-owed-2025',
    hash: '#/company/owner?tab=owed&p=2025',
    title: 'Owner',
    charts: 0,
    shows: ['The owner owes the company on 31 Dec 2025', 'No cost the owner paid privately was owed in Jan 2025 – Dec 2025'],
  },
  {
    name: 'owner-owed-2025-croatian',
    query: 'lang=hr',
    hash: '#/company/owner?tab=owed&p=2025',
    title: 'Vlasnik',
    charts: 0,
    shows: ['Vlasnik duguje tvrtki na dan 31.\u00a012.\u00a02025.', 'Nijedan trošak koji je vlasnik platio privatno nije se dugovao u razdoblju'],
  },
  {
    name: 'owner-owed-filtered',
    hash: '#/company/owner?tab=owed&p=all&cat=equipment',
    title: 'Owner',
    charts: 0,
    shows: ['Who owes whom follows the period only', 'The owner owes the company on 8 Oct 2026'],
  },
  {
    name: 'owner-owed-filtered-croatian',
    query: 'lang=hr',
    hash: '#/company/owner?tab=owed&p=all&cat=equipment',
    title: 'Vlasnik',
    charts: 0,
    shows: ['Tko kome duguje slijedi samo razdoblje', 'Vlasnik duguje tvrtki na dan 8.\u00a010.\u00a02026.'],
  },
  { name: 'transactions-review', hash: '#/company/transactions?tab=review', title: 'Transactions', charts: 0, shows: ['GADGET CORNER', 'Refund of a parking fee', 'To review'] },
  {
    name: 'transactions-review-croatian',
    query: 'lang=hr',
    hash: '#/company/transactions?tab=review',
    title: 'Transakcije',
    charts: 0,
    shows: ['GADGET CORNER', '2 stavke za provjeru', 'Za provjeru'],
  },
  {
    name: 'company-settings-category-rules',
    hash: '#/company/settings?tab=category-rules',
    title: 'Settings',
    charts: 0,
    shows: ['merchant-airline', 'Confirmed rows no rule repeats', 'Category rules', 'Tax rules'],
  },
  {
    name: 'company-settings-category-rules-croatian',
    query: 'lang=hr',
    hash: '#/company/settings?tab=category-rules',
    title: 'Postavke',
    charts: 0,
    shows: ['merchant-airline', 'Potvrđene stavke koje nijedno pravilo ne ponavlja', 'Partner sadrži', 'Pravila kategorija', 'Porezna pravila'],
  },
  {
    name: 'company-settings-category-rules-linked',
    hash: '#/company/settings?tab=category-rules&rule=merchant-airline',
    title: 'Settings',
    charts: 0,
    shows: 'merchant-airline',
    collapsedBefore: ['settings.category-rules'],
    linkedRow: '[data-testid="rule-row"][aria-current="true"]',
  },
  {
    name: 'company-settings-category-rules-linked-croatian',
    query: 'lang=hr',
    hash: '#/company/settings?tab=category-rules&rule=merchant-airline',
    title: 'Postavke',
    charts: 0,
    shows: 'merchant-airline',
    collapsedBefore: ['settings.category-rules'],
    linkedRow: '[data-testid="rule-row"][aria-current="true"]',
  },
  {
    name: 'home',
    hash: '#/',
    title: 'All apps',
    charts: 0,
    shows: ['Company', 'Cash on hand', '2 rows to review', 'Loans', 'Investments', 'Assets', 'Spending', 'Set up'],
    cards: false,
  },
  {
    name: 'home-croatian',
    query: 'lang=hr',
    hash: '#/',
    title: 'Sve aplikacije',
    charts: 0,
    shows: ['Tvrtka', 'Novac na računima', 'Krediti', 'Ulaganja', 'Imovina', 'Potrošnja', 'Postavi'],
    cards: false,
  },
  {
    name: 'kuna-overview',
    query: 'fake=unregistered&loans=sample&investments=sample&assets=sample&spending=sample',
    hash: '#/overview',
    title: 'Net worth',
    charts: 0,
    shows: ['Net worth', 'Next ', 'Bank and cash', ...OVERVIEW.english, 'What you could take out needs the company’s registration day in Settings.'],
    cards: false,
  },
  {
    name: 'kuna-overview-croatian',
    query: 'loans=sample&investments=sample&assets=sample&spending=sample&lang=hr',
    hash: '#/overview',
    title: 'Neto imovina',
    charts: 0,
    shows: ['Neto imovina', 'Sljedeći anuitet ', 'Banka i gotovina', ...OVERVIEW.croatian, 'vaše nakon kredita „Home loan”', 'Novac tvrtke, izvan zbroja'],
    cards: false,
  },
  {
    name: 'kuna-overview-browser',
    query: 'fake=browser&loans=sample&investments=sample',
    hash: '#/overview',
    title: 'Net worth',
    charts: 0,
    shows: ['The company’s money, kept apart from the sum', 'You could take out now', OVERVIEW.takeOut, 'settles your loan to the company'],
    cards: false,
  },
  {
    name: 'kuna-overview-browser-croatian',
    query: 'fake=browser&loans=sample&investments=sample&lang=hr',
    hash: '#/overview',
    title: 'Neto imovina',
    charts: 0,
    shows: ['Možete isplatiti sada', OVERVIEW.takeOutCroatian, 'zatvori vaš dug prema tvrtki'],
    cards: false,
  },
  { name: 'kuna-overview-loans-opening', query: 'loans=opening&investments=sample', hash: '#/overview', title: 'Net worth', charts: 0, ready: '[data-testid="overview-net-opening"]', cards: false },
  {
    name: 'kuna-overview-loans-failed',
    query: 'loans=failed&investments=sample',
    hash: '#/overview',
    title: 'Net worth',
    charts: 0,
    ready: '[data-testid="overview-net-held"]',
    shows: 'Loans did not open, so nothing is added up.',
    cards: false,
  },
  {
    name: 'kuna-overview-loans-failed-croatian',
    query: 'loans=failed&investments=sample&lang=hr',
    hash: '#/overview',
    title: 'Neto imovina',
    charts: 0,
    ready: '[data-testid="overview-net-held"]',
    shows: 'Datoteka aplikacije Krediti nije se otvorila, pa se ništa ne zbraja.',
    cards: false,
  },
  {
    name: 'kuna-overview-investments-only',
    query: 'investments=sample',
    hash: '#/overview',
    title: 'Net worth',
    charts: 0,
    shows: [OVERVIEW.investmentsOnly, 'Not set up: Loans', 'Not set up: Assets', 'Not set up: Spending'],
    cards: false,
  },
  {
    name: 'kuna-overview-assets-only',
    query: 'assets=sample',
    hash: '#/overview',
    title: 'Net worth',
    charts: 0,
    shows: [OVERVIEW.assetsOnly, 'Assets value', OVERVIEW.assetsOnlyLeavesOut, 'Not set up: Loans', 'Not set up: Investments', 'Not set up: Spending'],
    cards: false,
  },
  {
    name: 'kuna-overview-spending-only',
    query: 'spending=sample',
    hash: '#/overview',
    title: 'Net worth',
    charts: 0,
    shows: [OVERVIEW.spendingOnly.english, 'Bank and cash', OVERVIEW.spendingOnly.caption, 'Not set up: Loans', 'Not set up: Investments', 'Not set up: Assets'],
    cards: false,
  },
  {
    name: 'kuna-overview-spending-only-croatian',
    query: 'spending=sample&lang=hr',
    hash: '#/overview',
    title: 'Neto imovina',
    charts: 0,
    shows: [OVERVIEW.spendingOnly.croatian, 'Banka i gotovina', 'Nije postavljeno: Krediti'],
    cards: false,
  },
  {
    name: 'kuna-overview-rates-opening',
    query: 'loans=sample&investments=sample&assets=sample&spending=sample&rates=opening',
    hash: '#/overview',
    title: 'Net worth',
    charts: 0,
    ready: '[data-testid="overview-net-opening"]',
    cards: false,
  },
  {
    name: 'kuna-overview-index-opening',
    query: 'loans=sample&investments=sample&assets=sample&index=opening',
    hash: '#/overview',
    title: 'Net worth',
    charts: 0,
    ready: '[data-testid="overview-net-opening"]',
    cards: false,
  },
  {
    name: 'kuna-overview-fresh',
    query: 'fake=empty',
    hash: '#/overview',
    title: 'Net worth',
    charts: 0,
    shows: ['Nothing to add up until an app is set up.', 'Not set up: Company', 'Not set up: Loans', 'Not set up: Investments', 'Not set up: Assets', 'Not set up: Spending'],
    cards: false,
  },
  {
    name: 'company-settings',
    hash: '#/company/settings',
    title: 'Settings',
    charts: 0,
    shows: ['The workbook', 'Mail', 'Company and owner facts', 'Bucket labels', 'Loans to the owner', 'Categories to sort', 'Kuna counts these by bucket and VAT'],
  },
  {
    name: 'company-settings-loan-rate',
    hash: '#/company/settings#owner-loan-interest',
    title: 'Settings',
    charts: 0,
    shows: ["Interest the owner's loans carry", 'Categories to sort'],
    collapsedBefore: ['settings.facts'],
    linkedPart: 'owner-loan-interest',
  },
  {
    name: 'company-settings-categories',
    hash: '#/company/settings?tab=categories',
    title: 'Settings',
    charts: 0,
    shows: ['The bucket decides where a row counts', 'Kuna counts it as', 'Not classified yet', 'Kuna counts this as representation'],
    collapsedBefore: ['settings.categories'],
    linkedCard: 'settings.categories',
  },
  {
    name: 'company-settings-categories-croatian',
    query: 'lang=hr',
    hash: '#/company/settings?tab=categories',
    title: 'Postavke',
    charts: 0,
    shows: ['Skupina određuje gdje se stavka broji', 'Spremi kategorije', 'Kategorije', 'Porezna pravila', 'Kuna to broji kao', 'Još nije razvrstana'],
    collapsedBefore: ['settings.categories'],
    linkedCard: 'settings.categories',
  },
  {
    name: 'company-settings-croatian',
    query: 'lang=hr',
    hash: '#/company/settings',
    title: 'Postavke',
    charts: 0,
    shows: ['Osnovno', 'Pošta', 'Podaci o tvrtki i vlasniku', 'Nazivi skupina', 'Pozajmice vlasniku', 'Kategorije za razvrstavanje'],
  },
  {
    name: 'company-settings-loan-rate-croatian',
    query: 'lang=hr',
    hash: '#/company/settings#owner-loan-interest',
    title: 'Postavke',
    charts: 0,
    shows: ['Kamata na pozajmice vlasniku', 'Kategorije za razvrstavanje'],
    collapsedBefore: ['settings.facts'],
    linkedPart: 'owner-loan-interest',
  },
  { name: 'company-settings-accounts', hash: '#/company/settings?tab=accounts', title: 'Settings', charts: 0, shows: 'Your bank accounts' },
  { name: 'company-settings-accounts-croatian', query: 'lang=hr', hash: '#/company/settings?tab=accounts', title: 'Postavke', charts: 0, shows: ['Vaši računi u banci', 'Prikazuje se kao'] },
  { name: 'company-settings-tax-rules', hash: '#/company/settings?tab=tax-rules', title: 'Settings', charts: 0, shows: ['Watch list', 'Rules by area', 'hr.cit.rate'] },
  {
    name: 'company-settings-tax-rules-croatian',
    query: 'lang=hr',
    hash: '#/company/settings?tab=tax-rules',
    title: 'Postavke',
    charts: 0,
    shows: ['Za praćenje', 'Odredbe po područjima', 'hr.cit.rate', 'Sva područja'],
  },
  {
    name: 'company-settings-tax-rules-linked',
    hash: '#/company/settings?tab=tax-rules&rule=hr.contrib.director-floor',
    title: 'Settings',
    charts: 0,
    shows: 'Contribution base floor for an employed',
    linkedRule: 'hr.contrib.director-floor',
  },
  {
    name: 'company-settings-tax-rules-linked-croatian',
    query: 'lang=hr',
    hash: '#/company/settings?tab=tax-rules&rule=hr.contrib.director-floor',
    title: 'Postavke',
    charts: 0,
    shows: ['Najniža osnovica za doprinose zaposlenog direktora', 'Izvori'],
    linkedRule: 'hr.contrib.director-floor',
  },
  {
    name: 'company-settings-books',
    hash: '#/company/settings?tab=books',
    title: 'Settings',
    charts: 0,
    ready: '[data-testid="drive-file-place"] a',
    shows: ['kuna-company.json', 'Books', 'None yet. The first save of a day makes one.', 'Open in Drive'],
    cards: false,
  },
  {
    name: 'company-settings-books-croatian',
    query: 'lang=hr',
    hash: '#/company/settings?tab=books',
    title: 'Postavke',
    charts: 0,
    ready: '[data-testid="drive-file-place"] a',
    shows: ['kuna-company.json', 'Datoteka tvrtke', 'Izvezi u Excel', 'Promijeni izvor podataka', 'Otvori na Driveu'],
    cards: false,
  },
  {
    name: 'kuna-settings',
    keyless: true,
    hash: '#/settings',
    title: 'Kuna settings',
    charts: 0,
    ready: '[data-testid="assist-card"]',
    shows: [
      'Sync as the app opens',
      'Sign out of Google',
      'Appearance and privacy',
      'AI assistant',
      'AI company',
      'Go to Anthropic and make an account.',
      'Your key',
      'Get a key',
      'Get it from Google',
    ],
    cards: false,
  },
  {
    name: 'kuna-settings-croatian',
    keyless: true,
    query: 'lang=hr',
    hash: '#/settings',
    title: 'Postavke Kune',
    charts: 0,
    ready: '[data-testid="assist-card"]',
    shows: [
      'Sinkronizacija, asistent s prekidačima Uvijek dopusti i Anonimiziraj za svaku AI tvrtku',
      'Jezik preglednika',
      'Hrvatski',
      'Kad promijenite jezik, aplikacija se ponovno učita.',
      'AI asistent',
      'AI tvrtka',
      'Otvorite stranicu tvrtke Anthropic i napravite korisnički račun.',
      'Vaš ključ',
      'Preuzmi ga s Googlea',
    ],
    cards: false,
  },
  ...[
    { name: 'chat-panel-home', hash: '#/?chat=1', title: 'All apps', label: 'In Kuna' },
    { name: 'chat-panel-spending', query: 'spending=sample', hash: '#/spending/transactions?chat=1', title: 'Entries', label: 'In Spending' },
    { name: 'chat-panel-spending-croatian', query: 'spending=sample&lang=hr', hash: '#/spending/transactions?chat=1', title: 'Unosi', label: 'U aplikaciji Potrošnja' },
    { name: 'chat-panel-company', hash: '#/company?chat=1', title: 'Overview', label: 'In Company' },
    { name: 'chat-panel-company-transactions', hash: '#/company/transactions?chat=1', title: 'Transactions', label: 'In Company' },
    { name: 'chat-panel-loans', query: 'loans=sample', hash: '#/loans?chat=1', title: 'Overview', label: 'In Loans' },
    { name: 'chat-panel-investments', query: 'investments=sample', hash: '#/investments?chat=1', title: 'Overview', label: 'In Investments' },
    { name: 'chat-panel-assets', query: 'assets=sample&loans=sample', hash: '#/assets?chat=1', title: 'Overview', label: 'In Assets' },
  ].map(({ label, ...visit }) => ({
    charts: 0,
    ready: '[data-testid="chat-panel"]',
    stored: { 'kuna.secret.anthropic': MADE_UP_ANTHROPIC_KEY },
    shows: [label],
    chatOpen: true,
    ...visit,
  })),
  {
    name: 'kuna-settings-assist',
    hash: '#/settings',
    title: 'Kuna settings',
    charts: 0,
    ready: '[data-testid="assist-key-kept"]',
    stored: { 'kuna.secret.anthropic': MADE_UP_ANTHROPIC_KEY },
    shows: [
      'A key ending in 0042 is kept in this browser.',
      'A sync also saves it in your Google account',
      'Sonnet 5.5 (default)',
      'Always allow the chat',
      'Kuna asks once in each chat before it reads your records and sends to Anthropic.',
      'Anonymise',
      'Rows about employees and their pay are left out of what Kuna sends to Anthropic.',
    ],
    cards: false,
  },
  {
    name: 'kuna-settings-assist-croatian',
    query: 'lang=hr',
    hash: '#/settings',
    title: 'Postavke Kune',
    charts: 0,
    ready: '[data-testid="assist-key-kept"]',
    stored: { 'kuna.secret.anthropic': MADE_UP_ANTHROPIC_KEY },
    shows: [
      'U ovom pregledniku čuva se ključ koji završava na 0042.',
      'Sonnet 5.5 (zadano)',
      'Uvijek dopusti razgovoru',
      'Kuna jednom u svakom razgovoru pita prije nego što pročita vaše zapise i pošalje ih tvrtki Anthropic.',
      'Anonimiziraj',
      'Retci o zaposlenicima i njihovim plaćama ne šalju se tvrtki Anthropic.',
    ],
    cards: false,
  },
  {
    name: 'kuna-settings-anonymise-off',
    hash: '#/settings',
    title: 'Kuna settings',
    charts: 0,
    ready: '[data-testid="assist-anonymise"][aria-checked="false"]',
    stored: { 'kuna.secret.anthropic': MADE_UP_ANTHROPIC_KEY, 'kuna.assist-anonymise': 'anthropic' },
    shows: ['Rows about employees and their pay go to Anthropic as written, and to no other company.', 'Changing AI company turns this back on.'],
    cards: false,
  },
  {
    name: 'kuna-settings-anonymise-off-croatian',
    query: 'lang=hr',
    hash: '#/settings',
    title: 'Postavke Kune',
    charts: 0,
    ready: '[data-testid="assist-anonymise"][aria-checked="false"]',
    stored: { 'kuna.secret.anthropic': MADE_UP_ANTHROPIC_KEY, 'kuna.assist-anonymise': 'anthropic' },
    shows: ['Retci o zaposlenicima i njihovim plaćama šalju se tvrtki Anthropic kako su zapisani', 'Ako promijenite AI tvrtku, ovo se ponovno uključuje.'],
    cards: false,
  },
  {
    name: 'kuna-settings-assist-typed-model',
    hash: '#/settings',
    title: 'Kuna settings',
    charts: 0,
    ready: '[data-testid="assist-key-kept"]',
    stored: { 'kuna.secret.anthropic': MADE_UP_ANTHROPIC_KEY, 'kuna.assist-model.anthropic': 'claude-made-up-model' },
    shows: ['Kuna knows no price for this model, so its runs say price unknown.'],
    cards: false,
  },
  {
    name: 'kuna-settings-assist-typed-model-croatian',
    query: 'lang=hr',
    hash: '#/settings',
    title: 'Postavke Kune',
    charts: 0,
    ready: '[data-testid="assist-key-kept"]',
    stored: { 'kuna.secret.anthropic': MADE_UP_ANTHROPIC_KEY, 'kuna.assist-model.anthropic': 'claude-made-up-model' },
    shows: ['Kuna ne zna cijenu ovog modela, pa uz njegova pokretanja piše cijena nepoznata.'],
    cards: false,
  },
  {
    name: 'kuna-settings-assist-typed-model-openrouter',
    hash: '#/settings',
    title: 'Kuna settings',
    charts: 0,
    ready: '[data-testid="assist-key-kept"]',
    stored: { 'kuna.secret.openrouter': 'made-up-openrouter-key-0042', 'kuna.assist-model.openrouter': 'made-up/model' },
    shows: ['A typed model may search the web on its own side, which Kuna cannot see.'],
    cards: false,
  },
  {
    name: 'kuna-settings-assist-on',
    hash: '#/settings',
    title: 'Kuna settings',
    charts: 0,
    ready: '[data-testid="assist-allow"][aria-checked="true"]',
    stored: { 'kuna.secret.anthropic': MADE_UP_ANTHROPIC_KEY, 'kuna.assist-allowed.anthropic': 'on' },
    shows: ['A key ending in 0042 is kept in this browser.', 'Always allow the chat', 'The chat reads your records in every app and sends to Anthropic without asking first.'],
    cards: false,
  },
  {
    name: 'kuna-settings-assist-on-croatian',
    query: 'lang=hr',
    hash: '#/settings',
    title: 'Postavke Kune',
    charts: 0,
    ready: '[data-testid="assist-allow"][aria-checked="true"]',
    stored: { 'kuna.secret.anthropic': MADE_UP_ANTHROPIC_KEY, 'kuna.assist-allowed.anthropic': 'on' },
    shows: ['Uvijek dopusti razgovoru', 'Razgovor čita vaše zapise u svim aplikacijama i šalje ih tvrtki Anthropic bez pitanja.'],
    cards: false,
  },
  {
    name: 'kuna-settings-assist-two-keys',
    hash: '#/settings',
    title: 'Kuna settings',
    charts: 0,
    ready: '[data-testid="assist-provider"][data-provider="openai"]',
    stored: { 'kuna.secret.anthropic': MADE_UP_ANTHROPIC_KEY, 'kuna.secret.openai': 'made-up-openai-key-0077', 'kuna.assist-provider': 'openai' },
    shows: ['A key ending in 0077 is kept in this browser.', 'OpenAI keeps what Kuna sends'],
    cards: false,
  },
  {
    name: 'company-settings-assist',
    hash: '#/company/settings?tab=assistant',
    title: 'Settings',
    charts: 0,
    ready: '[data-testid="assist-allowed"][data-allowed="true"]',
    stored: { 'kuna.secret.anthropic': MADE_UP_ANTHROPIC_KEY, 'kuna.assist-allowed.anthropic': 'on' },
    shows: [
      'Uses your Anthropic key, straight from this browser.',
      'The chat reads your records in every app and sends to Anthropic without asking first.',
      'Change Always allow in Kuna settings',
      'Chat',
      'records and figures from Company',
    ],
    cards: false,
  },
  {
    name: 'company-settings-assist-croatian',
    query: 'lang=hr',
    hash: '#/company/settings?tab=assistant',
    title: 'Postavke',
    charts: 0,
    ready: '[data-testid="assist-allowed"][data-allowed="true"]',
    stored: { 'kuna.secret.anthropic': MADE_UP_ANTHROPIC_KEY, 'kuna.assist-allowed.anthropic': 'on' },
    shows: [
      'Koristi vaš ključ za Anthropic, izravno iz ovog preglednika.',
      'Razgovor čita vaše zapise u svim aplikacijama i šalje ih tvrtki Anthropic bez pitanja.',
      'Promijeni Uvijek dopusti u postavkama Kune',
      'Razgovor',
      'iznosi iz aplikacije Tvrtka',
    ],
    cards: false,
  },
  {
    name: 'company-settings-assist-no-key',
    keyless: true,
    hash: '#/company/settings?tab=assistant',
    title: 'Settings',
    charts: 0,
    ready: '[data-testid="assist-add-key"]',
    shows: ['With a key, the chat can read and change your records in Company.', 'Add a key in Kuna settings'],
    cards: false,
  },
  {
    name: 'company-settings-assist-no-key-croatian',
    keyless: true,
    query: 'lang=hr',
    hash: '#/company/settings?tab=assistant',
    title: 'Postavke',
    charts: 0,
    ready: '[data-testid="assist-add-key"]',
    shows: ['S ključem razgovor može čitati i mijenjati vaše zapise u aplikaciji Tvrtka.', 'Dodaj ključ u postavkama Kune'],
    cards: false,
  },
  {
    name: 'loans-settings-assist',
    query: 'loans=sample',
    hash: '#/loans/settings?tab=assistant',
    title: 'Settings',
    charts: 0,
    ready: '[data-testid="assist-allowed"][data-allowed="false"]',
    stored: { 'kuna.secret.anthropic': MADE_UP_ANTHROPIC_KEY },
    shows: [
      'Uses your Anthropic key, straight from this browser.',
      'Kuna asks once in each chat before it reads your records and sends to Anthropic.',
      'records and figures from Loans the chat asks for',
    ],
    cards: false,
  },
  {
    name: 'loans-settings-assist-croatian',
    query: 'loans=sample&lang=hr',
    hash: '#/loans/settings?tab=assistant',
    title: 'Postavke',
    charts: 0,
    ready: '[data-testid="assist-allowed"][data-allowed="false"]',
    stored: { 'kuna.secret.anthropic': MADE_UP_ANTHROPIC_KEY },
    shows: [
      'Koristi vaš ključ za Anthropic, izravno iz ovog preglednika.',
      'Kuna jednom u svakom razgovoru pita prije nego što pročita vaše zapise i pošalje ih tvrtki Anthropic.',
      'zapisi i iznosi iz aplikacije Krediti',
    ],
    cards: false,
  },
  {
    name: 'investments-settings-assist',
    query: 'investments=sample',
    hash: '#/investments/settings?tab=assistant',
    title: 'Settings',
    charts: 0,
    ready: '[data-testid="assist-allowed"][data-allowed="false"]',
    stored: { 'kuna.secret.anthropic': MADE_UP_ANTHROPIC_KEY },
    shows: [
      'Uses your Anthropic key, straight from this browser.',
      'Kuna asks once in each chat before it reads your records and sends to Anthropic.',
      'records and figures from Investments the chat asks for',
    ],
    cards: false,
  },
  {
    name: 'investments-settings-assist-croatian',
    query: 'investments=sample&lang=hr',
    hash: '#/investments/settings?tab=assistant',
    title: 'Postavke',
    charts: 0,
    ready: '[data-testid="assist-allowed"][data-allowed="false"]',
    stored: { 'kuna.secret.anthropic': MADE_UP_ANTHROPIC_KEY },
    shows: [
      'Koristi vaš ključ za Anthropic, izravno iz ovog preglednika.',
      'Kuna jednom u svakom razgovoru pita prije nego što pročita vaše zapise i pošalje ih tvrtki Anthropic.',
      'zapisi i iznosi iz aplikacije Ulaganja',
    ],
    cards: false,
  },
  {
    name: 'assets-settings-assist',
    query: 'assets=sample&loans=sample',
    hash: '#/assets/settings?tab=assistant',
    title: 'Settings',
    charts: 0,
    ready: '[data-testid="assist-allowed"][data-allowed="false"]',
    stored: { 'kuna.secret.anthropic': MADE_UP_ANTHROPIC_KEY },
    shows: [
      'Uses your Anthropic key, straight from this browser.',
      'Kuna asks once in each chat before it reads your records and sends to Anthropic.',
      'records and figures from Assets the chat asks for',
    ],
    cards: false,
  },
  {
    name: 'assets-settings-assist-croatian',
    query: 'assets=sample&loans=sample&lang=hr',
    hash: '#/assets/settings?tab=assistant',
    title: 'Postavke',
    charts: 0,
    ready: '[data-testid="assist-allowed"][data-allowed="false"]',
    stored: { 'kuna.secret.anthropic': MADE_UP_ANTHROPIC_KEY },
    shows: [
      'Koristi vaš ključ za Anthropic, izravno iz ovog preglednika.',
      'Kuna jednom u svakom razgovoru pita prije nego što pročita vaše zapise i pošalje ih tvrtki Anthropic.',
      'zapisi i iznosi iz aplikacije Imovina',
    ],
    cards: false,
  },
]

/** The gallery's chart cards that draw a chart. The loading card counts, the empty one does not. */
const GALLERY_CHARTS = 8

/** The gallery's donut cards, each of which must draw its ring. */
const GALLERY_DONUTS = 3

/** Screens outside the fake workbook on Drive. `query` picks the fake variant, `upload` drops the import file on the page. */
const SOURCE_SCREENS = [
  {
    name: 'home-fresh',
    query: 'fake=empty',
    hash: '#/',
    title: 'Welcome to Kuna',
    charts: 0,
    shows: ['Welcome to Kuna'],
    cards: false,
  },
  {
    name: 'home-fresh-croatian',
    query: 'fake=empty&lang=hr',
    hash: '#/',
    title: 'Dobrodošli u Kunu',
    charts: 0,
    shows: ['Dobrodošli u Kunu'],
    cards: false,
  },
  { name: 'home-loans', query: 'loans=sample', hash: '#/', title: 'All apps', charts: 0, shows: ['Cash on hand', 'You owe in all'], cards: false },
  { name: 'home-assets', query: 'assets=sample', hash: '#/', title: 'All apps', charts: 0, shows: ['Assets value', ASSETS.alone.english, '1 asset without a value'], cards: false },
  {
    name: 'home-spending-review',
    query: 'spending=statements',
    hash: '#/',
    title: 'All apps',
    charts: 0,
    shows: ['Spent this month', '5 rows to review'],
    cards: false,
  },
  {
    name: 'home-spending-review-croatian',
    query: 'spending=statements&lang=hr',
    hash: '#/',
    title: 'Sve aplikacije',
    charts: 0,
    shows: ['Potrošeno ovaj mjesec', 'Za pregled: 5'],
    cards: false,
  },
  {
    name: 'home-spending',
    query: 'spending=sample',
    hash: '#/',
    title: 'All apps',
    charts: 0,
    shows: ['Spent this month', SPENDING.spent.english, 'Left this month', SPENDING.left.english],
    cards: false,
  },
  {
    name: 'home-spending-croatian',
    query: 'spending=sample&lang=hr',
    hash: '#/',
    title: 'Sve aplikacije',
    charts: 0,
    shows: ['Potrošeno ovaj mjesec', SPENDING.spent.croatian, 'Preostalo ovaj mjesec', SPENDING.left.croatian],
    cards: false,
  },
  {
    name: 'home-investments',
    query: 'investments=sample',
    hash: '#/',
    title: 'All apps',
    charts: 0,
    ready: '[data-app="investments"] dl',
    shows: ['Investments', 'Value', 'Total gain', ...SAMPLE_INVESTMENTS.home, ...(SAMPLE_INVESTMENTS.badge.startsWith('Prices') ? [] : [SAMPLE_INVESTMENTS.badge])],
    cards: false,
  },
  {
    name: 'home-investments-croatian',
    query: 'investments=sample&lang=hr',
    hash: '#/',
    title: 'Sve aplikacije',
    charts: 0,
    ready: '[data-app="investments"] dl',
    shows: ['Ulaganja', 'Vrijednost', 'Ukupna dobit', ...SAMPLE_INVESTMENTS.homeCroatian],
    cards: false,
  },
  {
    name: 'home-investments-late',
    query: 'investments=sample&prices=late-prices',
    hash: '#/',
    title: 'All apps',
    charts: 0,
    ready: '[data-app="investments"] [data-testid="home-card-waiting"]',
    shows: [LATE_INVESTMENTS.badge, ...LATE_INVESTMENTS.home],
    cards: false,
  },
  {
    name: 'home-investments-late-croatian',
    query: 'investments=sample&prices=late-prices&lang=hr',
    hash: '#/',
    title: 'Sve aplikacije',
    charts: 0,
    ready: '[data-app="investments"] [data-testid="home-card-waiting"]',
    shows: [LATE_INVESTMENTS.badgeCroatian, ...LATE_INVESTMENTS.homeCroatian],
    cards: false,
  },
  { name: 'home-loans-croatian', query: 'loans=sample&lang=hr', hash: '#/', title: 'Sve aplikacije', charts: 0, shows: ['Novac na računima', 'Ukupno dugujete'], cards: false },
  { name: 'welcome', query: 'fake=empty', hash: '#/company/start', title: 'Company', charts: 0, shows: ['What brings you here?', 'Start new books', 'Open my books on Google Drive'], cards: false },
  {
    name: 'onboarding-access',
    query: 'fake=empty',
    hash: '#/company/start?step=access',
    title: 'Company',
    charts: 0,
    shows: ['What the app may do in your Google account', 'Invoice mail drafts in Gmail', 'Continue to Google'],
    cards: false,
  },
  { name: 'onboarding-find', query: 'fake=empty', hash: '#/company/start?path=open&step=find', title: 'Company', charts: 0, shows: ['Find your books on Drive', 'Pick another file'], cards: false },
  {
    name: 'welcome-croatian',
    query: 'fake=empty&lang=hr',
    hash: '#/company/start',
    title: 'Tvrtka',
    charts: 0,
    shows: ['Što vas dovodi ovamo?', 'Započni novu datoteku', 'Otvori svoju datoteku na Google Driveu', 'Bez poslužitelja'],
    cards: false,
  },
  {
    name: 'onboarding-access-croatian',
    query: 'fake=empty&lang=hr',
    hash: '#/company/start?step=access',
    title: 'Tvrtka',
    charts: 0,
    shows: ['Što aplikacija smije raditi u vašem Google računu', 'Skice poruka s računima u Gmailu', 'Nastavi na Google'],
    cards: false,
  },
  {
    name: 'onboarding-find-croatian',
    query: 'fake=empty&lang=hr',
    hash: '#/company/start?path=open&step=find',
    title: 'Tvrtka',
    charts: 0,
    shows: ['Pronađi svoju datoteku na Driveu', 'Odaberi drugu datoteku'],
    cards: false,
  },
  { name: 'company-settings-browser', query: 'fake=browser', hash: '#/company/settings', title: 'Settings', charts: 0, shows: 'Save settings' },
  { name: 'company-settings-categories-browser', query: 'fake=browser', hash: '#/company/settings?tab=categories', title: 'Settings', charts: 0, shows: 'Save categories' },
  { name: 'company-settings-categories-browser-croatian', query: 'fake=browser&lang=hr', hash: '#/company/settings?tab=categories', title: 'Postavke', charts: 0, shows: 'Spremi kategorije' },
  { name: 'company-settings-accounts-browser', query: 'fake=browser', hash: '#/company/settings?tab=accounts', title: 'Settings', charts: 0, shows: 'Save accounts' },
  { name: 'company-settings-books-browser', query: 'fake=browser', hash: '#/company/settings?tab=books', title: 'Settings', charts: 0, shows: ['Import a file', 'Keep on Google Drive'], cards: false },
  { name: 'company-settings-browser-croatian', query: 'fake=browser&lang=hr', hash: '#/company/settings', title: 'Postavke', charts: 0, shows: ['Spremi postavke', 'Zapis brojeva'] },
  { name: 'company-settings-accounts-browser-croatian', query: 'fake=browser&lang=hr', hash: '#/company/settings?tab=accounts', title: 'Postavke', charts: 0, shows: 'Spremi račune' },
  {
    name: 'company-settings-books-browser-croatian',
    query: 'fake=browser&lang=hr',
    hash: '#/company/settings?tab=books',
    title: 'Postavke',
    charts: 0,
    shows: ['Uvezi datoteku', 'Čuvaj na Google Driveu'],
    cards: false,
  },
  {
    name: 'company-settings-books-newer',
    query: 'fake=newer-file',
    hash: '#/company/settings?tab=books',
    title: 'Settings',
    charts: 0,
    ready: '[data-testid="newer-file-notice"]',
    shows: 'A newer version of Kuna saved this file',
    cards: false,
  },
  {
    name: 'company-settings-books-newer-croatian',
    query: 'fake=newer-file&lang=hr',
    hash: '#/company/settings?tab=books',
    title: 'Postavke',
    charts: 0,
    ready: '[data-testid="newer-file-notice"]',
    shows: 'Ovu je datoteku spremila novija verzija',
    cards: false,
  },
  { name: 'kuna-settings-browser', query: 'fake=browser', hash: '#/settings', title: 'Kuna settings', charts: 0, shows: ['Appearance and privacy', 'Browser language'], cards: false },
  { name: 'kuna-settings-browser-croatian', query: 'fake=browser&lang=hr', hash: '#/settings', title: 'Postavke Kune', charts: 0, shows: ['Izgled i privatnost', 'Jezik preglednika'], cards: false },
  { name: 'year-accountant-browser', query: 'fake=browser', hash: '#/company/year?year=2025', title: 'Year', charts: 1, shows: 'Loans to the owner carry 2.5%' },
  { name: 'year-statements-browser', query: 'fake=browser', hash: '#/company/year?year=2025&tab=statements', title: 'Year', charts: 0, shows: 'Balance paid on', expandedBefore: ['year.tax'] },
  {
    name: 'year-accountant-lines-browser',
    query: 'fake=browser',
    hash: '#/company/year?year=2025&tab=statements#accountant-lines',
    title: 'Year',
    charts: 0,
    shows: 'Save year-end lines',
    linkedPart: 'accountant-lines',
  },
  { name: 'year-asset-rows-browser', query: 'fake=browser', hash: '#/company/year?tab=assets#asset-rows', title: 'Year', charts: 0, shows: 'Save assets', linkedPart: 'asset-rows' },
  {
    name: 'salaries-browser',
    query: 'fake=browser',
    hash: '#/company/salaries#employee-rows',
    title: 'Salaries',
    charts: 1,
    shows: 'Save employees',
    collapsedBefore: ['salaries.employees'],
    linkedPart: 'employee-rows',
  },
  {
    name: 'salaries-one-employee',
    query: 'fake=one-employee',
    hash: '#/company/salaries',
    title: 'Salaries',
    charts: 1,
    shows: ['Where the company’s money goes', 'Gross to net', 'App and bank', 'Pension savings', 'The app and the bank agree on every line they both state'],
  },
  {
    name: 'salaries-one-employee-over-time',
    query: 'fake=one-employee',
    hash: '#/company/salaries?tab=over-time',
    title: 'Salaries',
    charts: 1,
    shows: ['Cost to the company by payday, 2026', 'Paydays of 2026'],
  },
  {
    name: 'salaries-five-employees',
    query: 'fake=five-employees',
    hash: '#/company/salaries',
    title: 'Salaries',
    charts: 1,
    shows: ['Paid to the employees', 'Health insurance, everyone paid', 'Everyone'],
  },
  { name: 'trips-list', query: 'fake=one-employee', hash: '#/company/trips', title: 'Trips', charts: 0, shows: ['Travel orders of 2026', '1/2026', 'Waits for times'], cards: false },
  { name: 'trips-list-croatian', query: 'fake=one-employee&lang=hr', hash: '#/company/trips', title: 'Putni nalozi', charts: 0, shows: ['Putni nalozi u 2026.', 'Čeka vremena'], cards: false },
  {
    name: 'trips-order',
    query: 'fake=one-employee',
    hash: '#/company/trips?trip=00000000-0000-4000-8000-002000000001',
    title: 'Travel order 1/2026',
    charts: 0,
    shows: ['Made-up Estate', 'ZG-000-XX', 'Days approved'],
    cards: false,
  },
  {
    name: 'trips-order-croatian',
    query: 'fake=one-employee&lang=hr',
    hash: '#/company/trips?trip=00000000-0000-4000-8000-002000000001',
    title: 'Putni nalog 1/2026',
    charts: 0,
    shows: ['Odobreno dana', 'Privatni automobil'],
    cards: false,
  },
  {
    name: 'trips-settlement',
    query: 'fake=one-employee',
    hash: '#/company/trips?trip=00000000-0000-4000-8000-002000000001&tab=settlement',
    title: 'Travel order 1/2026',
    charts: 0,
    shows: ['Per diems', 'Day 1', 'Owed to the traveller', 'Zagreb – Zadar', 'Bank rows', 'The row is filed as the settlement says.'],
  },
  {
    name: 'trips-settlement-croatian',
    query: 'fake=one-employee&lang=hr',
    hash: '#/company/trips?trip=00000000-0000-4000-8000-002000000001&tab=settlement',
    title: 'Putni nalog 1/2026',
    charts: 0,
    shows: ['Dnevnice', 'Pripada putniku', 'Dionice', 'Bankovne stavke', 'Razvrstano po obračunu'],
  },
  {
    name: 'trips-abroad',
    query: 'fake=one-employee',
    hash: '#/company/trips?trip=00000000-0000-4000-8000-002000000003&tab=settlement',
    title: 'Travel order 2/2026',
    charts: 0,
    shows: ['Take-off', 'Paid by the company, outside the payout', 'Kuna found a payment on'],
  },
  {
    name: 'trips-abroad-croatian',
    query: 'fake=one-employee&lang=hr',
    hash: '#/company/trips?trip=00000000-0000-4000-8000-002000000003&tab=settlement',
    title: 'Putni nalog 2/2026',
    charts: 0,
    shows: ['Polijetanje', 'Platilo društvo, izvan isplate', 'Kuna je našla plaćanje'],
  },
  {
    name: 'trips-overpaid',
    query: 'fake=one-employee-overpaid',
    hash: '#/company/trips?trip=00000000-0000-4000-8000-002000000003&tab=settlement',
    title: 'Travel order 2/2026',
    charts: 0,
    shows: ['Bank rows', 'File by the settlement', 'Outside the travel order, stays in Travel', 'more than the settlement pays out.'],
  },
  {
    name: 'trips-overpaid-croatian',
    query: 'fake=one-employee-overpaid&lang=hr',
    hash: '#/company/trips?trip=00000000-0000-4000-8000-002000000003&tab=settlement',
    title: 'Putni nalog 2/2026',
    charts: 0,
    shows: ['Bankovne stavke', 'Razvrstaj po obračunu', 'Izvan putnog naloga, ostaje u kategoriji', 'više nego što obračun isplaćuje.'],
  },
  {
    name: 'trips-waiting',
    query: 'fake=one-employee',
    hash: '#/company/trips?trip=00000000-0000-4000-8000-002000000004&tab=settlement',
    title: 'Travel order 3/2026',
    charts: 0,
    shows: ['The settlement waits for', 'above the tax-free', 'No leg yet.'],
    cards: false,
  },
  {
    name: 'trips-waiting-croatian',
    query: 'fake=one-employee&lang=hr',
    hash: '#/company/trips?trip=00000000-0000-4000-8000-002000000004&tab=settlement',
    title: 'Putni nalog 3/2026',
    charts: 0,
    shows: ['Obračun čeka', 'veća je od neoporezivih', 'Još nema dionica.'],
    cards: false,
  },
  {
    name: 'trips-dollars',
    query: 'fake=one-employee',
    hash: '#/company/trips?trip=00000000-0000-4000-8000-002000000005&tab=settlement',
    title: 'Travel order 4/2026',
    charts: 0,
    shows: ['Per diems', 'Less the advance', 'To pay out', 'Bank rows', 'File by the settlement'],
  },
  {
    name: 'trips-dollars-croatian',
    query: 'fake=one-employee&lang=hr',
    hash: '#/company/trips?trip=00000000-0000-4000-8000-002000000005&tab=settlement',
    title: 'Putni nalog 4/2026',
    charts: 0,
    shows: ['Dnevnice', 'Umanjeno za predujam', 'Za isplatu', 'Bankovne stavke', 'Razvrstaj po obračunu'],
  },
  {
    name: 'overview-one-employee',
    query: 'fake=one-employee',
    hash: '#/company',
    title: 'Overview',
    charts: 2,
    shows: ['Waiting for you', 'was due to be reported by', 'which may be its payout'],
  },
  {
    name: 'overview-one-employee-croatian',
    query: 'fake=one-employee&lang=hr',
    hash: '#/company',
    title: 'Pregled',
    charts: 2,
    shows: ['trebalo je prijaviti do', 'koje bi moglo biti isplata'],
  },
  {
    name: 'salaries-trip-reports',
    query: 'fake=one-employee',
    hash: '#/company/salaries?year=2026&month=2026-03',
    title: 'Salaries',
    charts: 1,
    shows: ['JOPPD code 17', '1/2026, Zadar', '5/2026, Varaždin', 'Reported 14 Apr', 'In all for'],
  },
  {
    name: 'salaries-trip-reports-croatian',
    query: 'fake=one-employee&lang=hr',
    hash: '#/company/salaries?year=2026&month=2026-03',
    title: 'Plaće',
    charts: 1,
    shows: ['JOPPD, oznaka 17', '1/2026, Zadar', 'Prijavljeno', 'Ukupno za'],
  },
  { name: 'salaries-five-employees-people', query: 'fake=five-employees', hash: '#/company/salaries?tab=people', title: 'Salaries', charts: 0, shows: ['Everyone paid in Sep 2026', 'Niko Test'] },
  { name: 'salaries-five-employees-one', query: 'fake=five-employees', hash: '#/company/salaries?employee=lea', title: 'Salaries', charts: 1, shows: ['Lea Proba', 'Paid to the employee'] },
  {
    name: 'salaries-browser-croatian',
    query: 'fake=browser&lang=hr',
    hash: '#/company/salaries#employee-rows',
    title: 'Plaće',
    charts: 1,
    shows: ['Zaposlenici', 'Spremi promjene'],
    collapsedBefore: ['salaries.employees'],
    linkedPart: 'employee-rows',
  },
  {
    name: 'salaries-one-employee-croatian',
    query: 'fake=one-employee&lang=hr',
    hash: '#/company/salaries',
    title: 'Plaće',
    charts: 1,
    shows: ['Kamo ide novac tvrtke', 'Od bruta do neta', 'Aplikacija i banka', 'Aplikacija i banka slažu se u svakoj stavci koju obje navode'],
  },
  {
    name: 'salaries-one-employee-over-time-croatian',
    query: 'fake=one-employee&lang=hr',
    hash: '#/company/salaries?tab=over-time',
    title: 'Plaće',
    charts: 1,
    shows: ['Trošak tvrtke po danu isplate, 2026.', 'Dani isplate u 2026.'],
  },
  {
    name: 'salaries-five-employees-croatian',
    query: 'fake=five-employees&lang=hr',
    hash: '#/company/salaries',
    title: 'Plaće',
    charts: 1,
    shows: ['Isplaćeno zaposlenicima', 'Zdravstveno osiguranje, svi isplaćeni', 'Svi'],
  },
  {
    name: 'salaries-five-employees-people-croatian',
    query: 'fake=five-employees&lang=hr',
    hash: '#/company/salaries?tab=people',
    title: 'Plaće',
    charts: 0,
    shows: ['Svi isplaćeni', 'Niko Test'],
  },
  {
    name: 'salaries-five-employees-one-croatian',
    query: 'fake=five-employees&lang=hr',
    hash: '#/company/salaries?employee=lea',
    title: 'Plaće',
    charts: 1,
    shows: ['Lea Proba', 'Isplaćeno zaposleniku'],
  },
  {
    name: 'owner-browser',
    query: 'fake=browser',
    hash: '#/company/owner',
    title: 'Owner',
    charts: 2,
    shows: ['Tax avoided against a dividend', 'As a dividend you would net', 'Set the defaults', 'Monthly net pay', 'from profit, a month'],
    cards: false,
  },
  { name: 'owner-owed-browser', query: 'fake=browser', hash: '#/company/owner?tab=owed&p=all', title: 'Owner', charts: 0, shows: ['Costs the owner paid privately', 'Net owed'] },
  {
    name: 'owner-browser-croatian',
    query: 'fake=browser&lang=hr',
    hash: '#/company/owner',
    title: 'Vlasnik',
    charts: 2,
    shows: ['Ušteda na porezu u odnosu na dividendu', 'Kao dividenda neto biste dobili', 'Mjesečni neto, s dobiti', 'iz dobiti, mjesečno'],
    cards: false,
  },
  {
    name: 'owner-owed-browser-croatian',
    query: 'fake=browser&lang=hr',
    hash: '#/company/owner?tab=owed&p=all',
    title: 'Vlasnik',
    charts: 0,
    shows: ['Troškovi koje je vlasnik platio privatno', 'Neto dug'],
  },
  {
    name: 'year-forecast-browser',
    query: 'fake=browser',
    hash: '#/company/year?year=2026',
    title: 'Year',
    charts: 1,
    shows: ['Month by month, 2026', 'plan rows of 2026 are not invoiced yet', 'Plan against actual, 2026'],
  },
  {
    name: 'year-forecast-2027-browser',
    query: 'fake=browser',
    hash: '#/company/year?year=2027',
    title: 'Year',
    charts: 1,
    shows: ['Month by month, 2027', 'Values the ruleset only estimates for 2027'],
  },
  {
    name: 'year-pay-browser',
    query: 'fake=browser',
    hash: '#/company/year?year=2027&tab=pay',
    title: 'Year',
    charts: 1,
    shows: ['Dividend capacity', 'Where the profit before owner pay goes, 2027', '1 warning', 'Side by side'],
  },
  {
    name: 'year-pay-interim-browser',
    query: 'fake=browser',
    hash: '#/company/year?year=2027&tab=pay&payout=interim',
    title: 'Year',
    charts: 1,
    shows: 'An interim payout in 2027',
    expandedBefore: ['year.comparison'],
  },
  {
    name: 'year-pay-interim-browser-croatian',
    query: 'fake=browser&lang=hr',
    hash: '#/company/year?year=2027&tab=pay&payout=interim',
    title: 'Godina',
    charts: 1,
    shows: 'Predujam dobiti u 2027.',
    expandedBefore: ['year.comparison'],
  },
  { name: 'year-pay-2026-browser', query: 'fake=browser', hash: '#/company/year?year=2026&tab=pay', title: 'Year', charts: 0, shows: ['No scenario for 2026 to compare yet', 'Dividend capacity'] },
  {
    name: 'year-pay-kept-now',
    query: 'fake=browser',
    hash: '#/company/year?year=2026&tab=pay&payout=kept-now',
    title: 'Year',
    charts: 0,
    shows: ['Kept profit of the years before 2026, paid out now, set off against what the owner owes', 'Paid to the owner', OVERVIEW.takeOut],
  },
  {
    name: 'year-pay-kept-now-croatian',
    query: 'fake=browser&lang=hr',
    hash: '#/company/year?year=2026&tab=pay&payout=kept-now',
    title: 'Godina',
    charts: 0,
    shows: ['Zadržana dobit iz godina prije 2026., isplaćena sada i prebijena s dugom vlasnika', 'Isplaćeno vlasniku', OVERVIEW.takeOutCroatian],
  },
  { name: 'year-pay-no-scenarios', query: 'fake=no-scenarios', hash: '#/company/year?year=2027&tab=pay', title: 'Year', charts: 0, shows: 'No scenario is for 2027 yet' },
  { name: 'year-taxes-browser', query: 'fake=browser', hash: '#/company/year?tab=taxes', title: 'Year', charts: 0, shows: ['For 2026', '1 payment is overdue', 'Less tax refund'] },
  { name: 'year-accountant-browser-croatian', query: 'fake=browser&lang=hr', hash: '#/company/year?year=2025', title: 'Godina', charts: 1, shows: 'Pozajmice vlasniku nose 2,5' },
  {
    name: 'year-statements-browser-croatian',
    query: 'fake=browser&lang=hr',
    hash: '#/company/year?year=2025&tab=statements',
    title: 'Godina',
    charts: 0,
    shows: 'Razlika plaćena',
    expandedBefore: ['year.tax'],
  },
  {
    name: 'year-accountant-lines-browser-croatian',
    query: 'fake=browser&lang=hr',
    hash: '#/company/year?year=2025&tab=statements#accountant-lines',
    title: 'Godina',
    charts: 0,
    shows: ['Knjigovođine pozicije', 'Spremi promjene'],
    linkedPart: 'accountant-lines',
  },
  {
    name: 'year-asset-rows-browser-croatian',
    query: 'fake=browser&lang=hr',
    hash: '#/company/year?tab=assets#asset-rows',
    title: 'Godina',
    charts: 0,
    shows: ['Retci sredstava', 'Spremi promjene'],
    linkedPart: 'asset-rows',
  },
  {
    name: 'year-grant-rows-croatian',
    query: 'lang=hr',
    hash: '#/company/year?tab=assets#grant-rows',
    title: 'Godina',
    charts: 0,
    shows: ['Retci potpora', 'Spremi promjene'],
    collapsedBefore: ['year.grant-rows'],
    linkedPart: 'grant-rows',
  },
  { name: 'year-assets-doubled-croatian', query: 'lang=hr', hash: '#/company/year?tab=assets&rates=doubled', title: 'Godina', charts: 0, shows: 'Što bi promijenile udvostručene stope' },
  {
    name: 'year-forecast-browser-croatian',
    query: 'fake=browser&lang=hr',
    hash: '#/company/year?year=2026',
    title: 'Godina',
    charts: 1,
    shows: ['Po mjesecima, 2026.', 'Plan i ostvarenje, 2026.', 'još nisu fakturirana'],
  },
  {
    name: 'year-forecast-2027-browser-croatian',
    query: 'fake=browser&lang=hr',
    hash: '#/company/year?year=2027',
    title: 'Godina',
    charts: 1,
    shows: ['Po mjesecima, 2027.', 'Vrijednosti koje propisi samo procjenjuju za 2027.'],
  },
  {
    name: 'year-pay-browser-croatian',
    query: 'fake=browser&lang=hr',
    hash: '#/company/year?year=2027&tab=pay',
    title: 'Godina',
    charts: 1,
    shows: ['Mogućnost isplate dividende', 'Kamo ide dobit prije isplata vlasniku, 2027.', '1 upozorenje', 'Jedan uz drugi'],
  },
  {
    name: 'year-pay-2026-browser-croatian',
    query: 'fake=browser&lang=hr',
    hash: '#/company/year?year=2026&tab=pay',
    title: 'Godina',
    charts: 0,
    shows: ['Još nema scenarija za 2026. za usporedbu', 'Mogućnost isplate dividende'],
  },
  { name: 'year-pay-no-scenarios-croatian', query: 'fake=no-scenarios&lang=hr', hash: '#/company/year?year=2027&tab=pay', title: 'Godina', charts: 0, shows: 'Za 2027. još nema scenarija' },
  { name: 'year-taxes-browser-croatian', query: 'fake=browser&lang=hr', hash: '#/company/year?tab=taxes', title: 'Godina', charts: 0, shows: ['Za 2026.', '1 uplata kasni'] },
  { name: 'invoicing-plan-browser', query: 'fake=browser', hash: '#/company/invoicing?tab=plan', title: 'Invoicing', charts: 0, shows: 'Fill the rest of 2026' },
  { name: 'invoicing-clients-browser', query: 'fake=browser', hash: '#/company/invoicing?tab=clients', title: 'Invoicing', charts: 0, shows: 'Save clients' },
  { name: 'invoicing-clients-browser-croatian', query: 'fake=browser&lang=hr', hash: '#/company/invoicing?tab=clients', title: 'Računi', charts: 0, shows: 'Spremi promjene' },
  { name: 'invoicing-empty-plan-browser', query: 'fake=browser-no-billing-plan', hash: '#/company/invoicing?tab=plan', title: 'Invoicing', charts: 0, shows: 'Add the first row', cards: false },
  { name: 'invoicing-plan-browser-croatian', query: 'fake=browser&lang=hr', hash: '#/company/invoicing?tab=plan', title: 'Računi', charts: 0, shows: 'Popuni ostatak 2026.' },
  {
    name: 'invoicing-empty-plan-browser-croatian',
    query: 'fake=browser-no-billing-plan&lang=hr',
    hash: '#/company/invoicing?tab=plan',
    title: 'Računi',
    charts: 0,
    shows: ['Dodaj prvu stavku', 'Još nema stavki plana'],
    cards: false,
  },
  { name: 'loans-start', hash: '#/loans', title: 'Loans', charts: 0, shows: ['Where the Loans file lives', 'A new file on Google Drive', 'My file on Google Drive'], cards: false },
  {
    name: 'loans-start-croatian',
    query: 'lang=hr',
    hash: '#/loans',
    title: 'Krediti',
    charts: 0,
    shows: ['Gdje se čuva datoteka kredita', 'Nova datoteka na Google Driveu', 'Moja datoteka na Google Driveu'],
    ready: '[data-testid="home-link"][aria-label="Kuna, sve aplikacije"]',
    cards: false,
  },
  { name: 'loans-start-folder', hash: '#/loans/start?step=folder', title: 'Loans', charts: 0, shows: ['Where the Loans file is saved', 'Kuna › loans', 'Create the file here'], cards: false },
  {
    name: 'loans-start-folder-croatian',
    query: 'lang=hr',
    hash: '#/loans/start?step=folder',
    title: 'Krediti',
    charts: 0,
    shows: ['Gdje se sprema datoteka kredita', 'Kuna › loans', 'Izradi datoteku ovdje', 'Natrag'],
    cards: false,
  },
  { name: 'loans-start-find', hash: '#/loans/start?step=find', title: 'Loans', charts: 0, shows: ['Find your Loans file on Drive', 'Pick another file', 'kuna-loans.json'], cards: false },
  {
    name: 'loans-start-find-croatian',
    query: 'lang=hr',
    hash: '#/loans/start?step=find',
    title: 'Krediti',
    charts: 0,
    shows: ['Pronađi datoteku kredita na Driveu', 'Odaberi drugu datoteku', 'kuna-loans.json'],
    cards: false,
  },
  { name: 'loans-overview', query: 'loans=drive', hash: '#/loans', title: 'Overview', charts: 0, shows: ['No loans yet', 'on Google Drive as kuna-loans.json'], cards: false },
  {
    name: 'loans-overview-croatian',
    query: 'loans=drive&lang=hr',
    hash: '#/loans',
    title: 'Pregled',
    charts: 0,
    shows: ['Još nema kredita ni pozajmica', 'na Google Driveu kao kuna-loans.json', 'Dodaj pozajmicu'],
    cards: false,
  },
  {
    name: 'loans-sample',
    query: 'loans=sample',
    hash: '#/loans',
    title: 'Overview',
    charts: 0,
    shows: ['Home loan', 'From Marko', 'To Petra', 'You owe', 'Owed to you', 'Net', 'Petra is', 'behind', 'Completed', 'Subsidy ends', 'APN pays', 'paid back'],
  },
  {
    name: 'loans-sample-croatian',
    query: 'loans=sample&lang=hr',
    hash: '#/loans',
    title: 'Pregled',
    charts: 0,
    shows: ['Home loan', 'Dugujete', 'Duguje vam se', 'Neto', 'Petra kasni s otplatom', 'Završeno', 'Plaća APN', 'otplaćeno'],
  },
  { name: 'loans-one-loan', query: 'loans=one-loan', hash: '#/loans', title: 'Overview', charts: 0, shows: ['Home loan', 'owed today', 'paid back', 'Subsidy ends'], cards: false },
  {
    name: 'loans-one-loan-croatian',
    query: 'loans=one-loan&lang=hr',
    hash: '#/loans',
    title: 'Pregled',
    charts: 0,
    shows: ['Home loan', 'dug danas', 'otplaćeno', 'Subvencija završava'],
    cards: false,
  },
  {
    name: 'loans-house-and-car',
    query: 'loans=house-and-car',
    hash: '#/loans',
    title: 'Overview',
    charts: 2,
    shows: [
      'Home loan',
      'Car loan',
      'From Dora',
      'You owe',
      'Nobody owes you',
      'Interest still to pay',
      'Bank loans paid off',
      'Overdue, to Dora',
      'Owed over time',
      'What goes out each month',
      'Your upcoming payments',
      'you owe Dora',
      'Every payment of Car loan',
      'Every payment of From Dora',
    ],
    cards: false,
  },
  {
    name: 'loans-house-and-car-croatian',
    query: 'loans=house-and-car&lang=hr',
    hash: '#/loans',
    title: 'Pregled',
    charts: 2,
    shows: [
      'Car loan',
      'Nitko vam ne duguje',
      'Preostala kamata',
      'Svi krediti otplaćeni',
      'Kasnite s otplatom: Dora',
      'Dug kroz vrijeme',
      'Koliko plaćate svaki mjesec',
      'Vaši sljedeći obroci',
      'dugujete: Dora',
    ],
    cards: false,
  },
  { name: 'loans-opening', query: 'loans=opening', hash: '#/loans', title: 'Overview', charts: 0, ready: '[data-testid="loans-loading"]', cards: false },
  { name: 'loans-opening-croatian', query: 'loans=opening&lang=hr', hash: '#/loans', title: 'Pregled', charts: 0, ready: '[data-testid="loans-loading"]', cards: false },
  {
    name: 'loans-bank-loan-opening',
    query: 'loans=opening',
    hash: `#/loans/bank-loan?loan=${SAMPLE_BANK_LOAN}`,
    title: null,
    charts: 0,
    ready: '[data-testid="screen-skeleton"]',
    cards: false,
  },
  {
    name: 'loans-bank-loan-opening-croatian',
    query: 'loans=opening&lang=hr',
    hash: `#/loans/bank-loan?loan=${SAMPLE_BANK_LOAN}`,
    title: null,
    charts: 0,
    ready: '[data-testid="screen-skeleton"]',
    cards: false,
  },
  {
    name: 'loans-informal-loan-opening',
    query: 'loans=opening',
    hash: `#/loans/informal-loan?loan=${SAMPLE_INFORMAL_LOAN}`,
    title: null,
    charts: 0,
    ready: '[data-testid="screen-skeleton"]',
    cards: false,
  },
  {
    name: 'loans-informal-loan-opening-croatian',
    query: 'loans=opening&lang=hr',
    hash: `#/loans/informal-loan?loan=${SAMPLE_INFORMAL_LOAN}`,
    title: null,
    charts: 0,
    ready: '[data-testid="screen-skeleton"]',
    cards: false,
  },
  {
    name: 'loans-bank-loan',
    query: 'loans=sample',
    hash: `#/loans/bank-loan?loan=${SAMPLE_BANK_LOAN}`,
    title: 'Home loan',
    charts: 2,
    shows: [
      'Owed today',
      'Total owed',
      'APN pays',
      'Owed over time',
      'Lowers what is owed',
      'Rate change',
      'Where the payments go',
      'Over the whole loan',
      'What if',
      'Saved tries',
      '€150 every month',
      'Estimate',
      '6M EURIBOR',
      'days late',
    ],
  },
  {
    name: 'loans-bank-loan-croatian',
    query: 'loans=sample&lang=hr',
    hash: `#/loans/bank-loan?loan=${SAMPLE_BANK_LOAN}`,
    title: 'Home loan',
    charts: 2,
    shows: [
      'Dug danas',
      'Ukupno za otplatu',
      'Plaća APN',
      'Dug kroz vrijeme',
      'Smanjuje dug',
      'Promjena kamatne stope',
      'Kamo idu anuiteti',
      'Što ako',
      'Spremljeni izračuni',
      'Anuiteti svake godine',
      'Procjena',
      '6M EURIBOR',
      'dana nakon dospijeća',
      'Razdoblja kamatne stope',
    ],
  },
  {
    name: 'loans-informal-loan',
    query: 'loans=sample',
    hash: `#/loans/informal-loan?loan=${SAMPLE_INFORMAL_LOAN}`,
    title: 'From Marko',
    charts: 1,
    shows: ['You owe Marko', 'Borrowed since', 'Borrowed in kind', 'Repaid in kind', 'Forgiven', 'He bought a boat battery for me', 'Raises what is owed'],
  },
  {
    name: 'loans-informal-loan-plan',
    query: 'loans=sample',
    hash: `#/loans/informal-loan?loan=${SAMPLE_PLANNED_LOAN}`,
    title: 'To Petra',
    charts: 1,
    shows: ['Owed to you', 'Petra owes you', 'Expected payments', 'Petra is', 'behind', 'Next instalment', 'What they owe you at each month end', 'Paid for the ferry tickets', 'Expected by the plan'],
  },
  {
    name: 'loans-informal-loan-settled',
    query: 'loans=sample',
    hash: `#/loans/informal-loan?loan=${SAMPLE_SETTLED_LOAN}`,
    title: 'Small loans',
    charts: 1,
    shows: ['Owed to you', 'Nobody owes anything', 'Boat fuel', 'What they owe you at each month end'],
  },
  {
    name: 'loans-informal-loan-croatian',
    query: 'loans=sample&lang=hr',
    hash: `#/loans/informal-loan?loan=${SAMPLE_INFORMAL_LOAN}`,
    title: 'From Marko',
    charts: 1,
    shows: ['Dugujete: Marko', 'Posuđeno nakon toga', 'Posuđeno u naravi', 'Vraćeno u naravi', 'Oprošteno', 'Promjene', 'Povećava dug'],
  },
  {
    name: 'loans-informal-loan-plan-croatian',
    query: 'loans=sample&lang=hr',
    hash: `#/loans/informal-loan?loan=${SAMPLE_PLANNED_LOAN}`,
    title: 'To Petra',
    charts: 1,
    shows: ['Duguje vam se', 'Petra vam duguje', 'Očekivani obroci', 'Petra kasni s otplatom', 'Sljedeći obrok', 'Koliko vam se duguje na kraju svakog mjeseca', 'Očekivano prema planu'],
  },
  {
    name: 'loans-informal-loan-settled-croatian',
    query: 'loans=sample&lang=hr',
    hash: `#/loans/informal-loan?loan=${SAMPLE_SETTLED_LOAN}`,
    title: 'Small loans',
    charts: 1,
    shows: ['Duguje vam se', 'Nitko nikome ne duguje', 'Boat fuel', 'Koliko vam se duguje na kraju svakog mjeseca'],
  },
  {
    name: 'loans-scenarios',
    query: 'loans=sample',
    hash: '#/loans/scenarios',
    title: 'Scenarios',
    charts: 0,
    shows: [
      'Jadran Bank offer',
      'Lighthouse Bank offer',
      'Side by side',
      'Monthly instalment',
      'last €836.11',
      'You pay in all',
      "Kuna's EKS estimate",
      'EKS the bank printed',
      'Owed over time',
      'Your offers',
    ],
  },
  {
    name: 'loans-scenarios-charts',
    query: 'loans=sample',
    hash: '#/loans/scenarios',
    title: 'Scenarios',
    charts: 2,
    shows: ['Interest over the loan', 'A line goes flat once its loan is paid off.'],
    expandedBefore: ['loans.scenarios.owed', 'loans.scenarios.interest'],
  },
  {
    name: 'loans-scenarios-croatian',
    query: 'loans=sample&lang=hr',
    hash: '#/loans/scenarios',
    title: 'Scenariji',
    charts: 0,
    shows: ['Jadran Bank offer', 'Usporedno', 'Mjesečna rata', 'posljednja 836,11', 'Ukupno plaćate', 'Kamata kroz kredit', 'Vaše ponude'],
  },
  {
    name: 'loans-scenarios-empty',
    query: 'loans=equal-principal',
    hash: '#/loans/scenarios',
    title: 'Scenarios',
    charts: 0,
    shows: ['No offers yet', 'Type in a loan you are weighing'],
    cards: false,
  },
  {
    name: 'loans-scenarios-empty-croatian',
    query: 'loans=equal-principal&lang=hr',
    hash: '#/loans/scenarios',
    title: 'Scenariji',
    charts: 0,
    shows: 'Još nema ponuda',
    cards: false,
  },
  {
    name: 'loans-equal-principal',
    query: 'loans=equal-principal',
    hash: `#/loans/bank-loan?loan=${FLAT_LOAN}`,
    title: 'Flat loan',
    charts: 2,
    shows: ['Owed today', 'APN pays', 'falling', 'What if', 'Saved tries', 'Nothing saved yet', 'Where the payments go'],
  },
  {
    name: 'loans-equal-principal-croatian',
    query: 'loans=equal-principal&lang=hr',
    hash: `#/loans/bank-loan?loan=${FLAT_LOAN}`,
    title: 'Flat loan',
    charts: 2,
    shows: ['Dug danas', 'Plaća APN', 'i sve manje', 'Rate svake godine', 'Spremljeni izračuni', 'rata'],
  },
  {
    name: 'loans-settings',
    query: 'loans=drive',
    hash: '#/loans/settings',
    title: 'Settings',
    charts: 0,
    ready: '[data-testid="loans-books-card"] [data-testid="drive-file-place"] a',
    shows: ['Loans books', 'kuna-loans.json', 'Switch storage'],
    cards: false,
  },
  {
    name: 'loans-settings-croatian',
    query: 'loans=drive&lang=hr',
    hash: '#/loans/settings',
    title: 'Postavke',
    charts: 0,
    ready: '[data-testid="loans-books-card"] [data-testid="drive-file-place"] a',
    shows: ['Datoteka kredita', 'kuna-loans.json', 'Promijeni mjesto', 'Zadnja sinkronizacija'],
    cards: false,
  },
  {
    name: 'loans-settings-browser',
    query: 'fake=browser&loans=browser',
    hash: '#/loans/settings',
    title: 'Settings',
    charts: 0,
    shows: ['Loans books', 'Fake Loans file', 'Some changes are in no exported file yet'],
    cards: false,
  },
  {
    name: 'loans-settings-browser-croatian',
    query: 'fake=browser&loans=browser&lang=hr',
    hash: '#/loans/settings',
    title: 'Postavke',
    charts: 0,
    shows: ['Datoteka kredita', 'Fake Loans file', 'Neke promjene još nisu ni u jednoj izvezenoj datoteci'],
    cards: false,
  },
  { name: 'assets-start', hash: '#/assets', title: 'Assets', charts: 0, shows: ['Where the Assets file lives', 'A new file on Google Drive', 'My file on Google Drive'], cards: false },
  {
    name: 'assets-start-croatian',
    query: 'lang=hr',
    hash: '#/assets',
    title: 'Imovina',
    charts: 0,
    shows: ['Gdje se čuva datoteka imovine', 'Nova datoteka na Google Driveu', 'Moja datoteka na Google Driveu'],
    cards: false,
  },
  { name: 'assets-overview-empty', query: 'assets=drive', hash: '#/assets', title: 'Overview', charts: 0, shows: ['No assets yet', 'Add an asset', 'kuna-assets.json'], cards: false },
  {
    name: 'assets-overview-empty-croatian',
    query: 'assets=drive&lang=hr',
    hash: '#/assets',
    title: 'Pregled',
    charts: 0,
    shows: ['Još nema imovine', 'Dodaj imovinu', 'kuna-assets.json'],
    cards: false,
  },
  {
    name: 'assets-overview',
    query: 'assets=sample&loans=sample',
    hash: '#/assets',
    title: 'Overview',
    charts: 0,
    shows: ['Assets value', ASSETS.total.english, ASSETS.yours, ASSETS.flat.value.english, ASSETS.car.value.english, 'No value yet', '1 asset without a value'],
    cards: false,
  },
  {
    name: 'assets-overview-croatian',
    query: 'assets=sample&loans=sample&lang=hr',
    hash: '#/assets',
    title: 'Pregled',
    charts: 0,
    shows: ['Vrijednost imovine', ASSETS.total.croatian, ASSETS.flat.value.croatian, ASSETS.car.value.croatian, 'Još nema vrijednosti', '1 stavka imovine bez vrijednosti'],
    cards: false,
  },
  {
    name: 'assets-flat',
    query: 'assets=sample&loans=sample',
    hash: `#/assets/asset?asset=${SAMPLE_FLAT}`,
    title: 'Flat in Zagreb',
    charts: 0,
    shows: [ASSETS.flat.value.english, ASSETS.flat.caption, 'Owed on the Home loan', ASSETS.flat.owed.english, 'Yours after the loan', ASSETS.flat.yours.english, 'Valuations'],
    cards: false,
  },
  {
    name: 'assets-flat-croatian',
    query: 'assets=sample&loans=sample&lang=hr',
    hash: `#/assets/asset?asset=${SAMPLE_FLAT}`,
    title: 'Flat in Zagreb',
    charts: 0,
    shows: [ASSETS.flat.value.croatian, 'preračunato na', 'Dug po kreditu „Home loan”', ASSETS.flat.owed.croatian, 'Vaše nakon kredita', ASSETS.flat.yours.croatian, 'Procjene'],
    cards: false,
  },
  {
    name: 'assets-flat-no-loans',
    query: 'assets=sample',
    hash: `#/assets/asset?asset=${SAMPLE_FLAT}`,
    title: 'Flat in Zagreb',
    charts: 0,
    shows: [ASSETS.flat.value.english, ASSETS.flat.caption],
    cards: false,
  },
  {
    name: 'assets-flat-loan-gone',
    query: 'assets=loan-gone&loans=sample',
    hash: `#/assets/asset?asset=${SAMPLE_FLAT}`,
    title: 'Flat in Zagreb',
    charts: 0,
    shows: [ASSETS.flat.value.english, 'Its loan is no longer in Loans'],
    cards: false,
  },
  {
    name: 'assets-flat-index-failed',
    query: 'assets=sample&loans=sample&index=failed',
    hash: `#/assets/asset?asset=${SAMPLE_FLAT}`,
    title: 'Flat in Zagreb',
    charts: 0,
    shows: [ASSETS.flat.price.english, 'Price paid on 15 Mar 2025', 'The DZS index did not load, so flats show their valuation or the price paid.'],
    cards: false,
  },
  {
    name: 'assets-flat-loans-opening',
    query: 'assets=sample&loans=opening',
    hash: `#/assets/asset?asset=${SAMPLE_FLAT}`,
    title: 'Flat in Zagreb',
    charts: 0,
    shows: [ASSETS.flat.value.english, 'Waiting for Loans to open'],
    cards: false,
  },
  {
    name: 'assets-flat-index-opening',
    query: 'assets=sample&loans=sample&index=opening',
    hash: `#/assets/asset?asset=${SAMPLE_FLAT}`,
    title: 'Flat in Zagreb',
    charts: 0,
    ready: '[data-testid="asset-value-waiting"]',
    cards: false,
  },
  {
    name: 'assets-overview-index-opening-croatian',
    query: 'assets=sample&loans=sample&index=opening&lang=hr',
    hash: '#/assets',
    title: 'Pregled',
    charts: 0,
    ready: '[data-testid="assets-value-waiting"]',
    shows: 'Čeka se indeks DZS-a',
    cards: false,
  },
  {
    name: 'assets-car',
    query: 'assets=sample&loans=sample',
    hash: `#/assets/asset?asset=${SAMPLE_CAR}`,
    title: 'Family car',
    charts: 0,
    shows: [ASSETS.car.value.english, ASSETS.car.caption, 'First registration'],
    cards: false,
  },
  {
    name: 'assets-car-croatian',
    query: 'assets=sample&loans=sample&lang=hr',
    hash: `#/assets/asset?asset=${SAMPLE_CAR}`,
    title: 'Family car',
    charts: 0,
    shows: [ASSETS.car.value.croatian, 'Procjena prema carinskoj tablici', 'Prva registracija'],
    cards: false,
  },
  { name: 'assets-opening', query: 'assets=opening', hash: '#/assets', title: 'Overview', charts: 0, ready: '[data-testid="assets-loading"]', cards: false },
  { name: 'assets-failed', query: 'assets=failed', hash: '#/assets', title: 'Overview', charts: 0, cards: false },
  {
    name: 'assets-settings',
    query: 'assets=drive',
    hash: '#/assets/settings',
    title: 'Settings',
    charts: 0,
    ready: '[data-testid="assets-books-card"] [data-testid="drive-file-place"] a',
    shows: ['Assets file', 'kuna-assets.json', 'Switch storage'],
    cards: false,
  },
  {
    name: 'assets-settings-croatian',
    query: 'assets=drive&lang=hr',
    hash: '#/assets/settings',
    title: 'Postavke',
    charts: 0,
    ready: '[data-testid="assets-books-card"] [data-testid="drive-file-place"] a',
    shows: ['Datoteka imovine', 'kuna-assets.json', 'Promijeni mjesto'],
    cards: false,
  },
  {
    name: 'assets-settings-browser',
    query: 'fake=browser&assets=browser',
    hash: '#/assets/settings',
    title: 'Settings',
    charts: 0,
    shows: ['Assets file', 'Fake Assets file', 'Some changes are in no exported file yet'],
    cards: false,
  },
  { name: 'spending-start', hash: '#/spending', title: 'Spending', charts: 0, shows: ['Where the Spending file lives', 'A new file on Google Drive', 'My file on Google Drive'], cards: false },
  {
    name: 'spending-start-croatian',
    query: 'lang=hr',
    hash: '#/spending',
    title: 'Potrošnja',
    charts: 0,
    shows: ['Gdje se čuva datoteka potrošnje', 'Nova datoteka na Google Driveu', 'Moja datoteka na Google Driveu'],
    cards: false,
  },
  {
    name: 'spending-entries-newer',
    query: 'spending=newer-file',
    hash: '#/spending/transactions',
    title: 'Entries',
    charts: 0,
    ready: '[data-testid="newer-file-notice"]',
    shows: ['A newer version of Kuna saved this file', 'Reload', ...SPENDING.payees],
    cards: false,
  },
  {
    name: 'spending-entries-newer-croatian',
    query: 'spending=newer-file&lang=hr',
    hash: '#/spending/transactions',
    title: 'Unosi',
    charts: 0,
    ready: '[data-testid="newer-file-notice"]',
    shows: ['Ovu je datoteku spremila novija verzija', 'Učitaj ponovno', ...SPENDING.payees],
    cards: false,
  },
  {
    name: 'spending-entries-before-items',
    query: 'spending=before-items',
    hash: '#/spending/transactions',
    title: 'Entries',
    charts: 0,
    ready: '[data-testid="spending-items-move"]',
    shows: ['This file stores entries the way older versions of Kuna did', 'Update the file', 'Weekly shop'],
    cards: false,
  },
  {
    name: 'spending-entries-before-items-croatian',
    query: 'spending=before-items&lang=hr',
    hash: '#/spending/transactions',
    title: 'Unosi',
    charts: 0,
    ready: '[data-testid="spending-items-move"]',
    shows: ['Ova datoteka vodi unose kao starije verzije Kune', 'Ažuriraj datoteku', 'Weekly shop'],
    cards: false,
  },
  {
    name: 'spending-entries-moved',
    query: 'spending=before-items',
    hash: '#/spending/transactions',
    title: 'Entries',
    charts: 0,
    ready: '[data-testid="spending-items-move"]',
    clickThen: { click: '[data-testid="spending-items-move"] button', gone: '[data-testid="spending-items-move"]' },
    shows: ['Weekly shop', 'Corner market'],
    lacks: ['Update the file'],
    cards: false,
  },
  {
    name: 'spending-entries-moved-croatian',
    query: 'spending=before-items&lang=hr',
    hash: '#/spending/transactions',
    title: 'Unosi',
    charts: 0,
    ready: '[data-testid="spending-items-move"]',
    clickThen: { click: '[data-testid="spending-items-move"] button', gone: '[data-testid="spending-items-move"]' },
    shows: ['Weekly shop', 'Corner market'],
    lacks: ['Ažuriraj datoteku'],
    cards: false,
  },
  {
    name: 'spending-entries-before-items-blocked',
    query: 'spending=before-items-split-transfer',
    hash: '#/spending/transactions',
    title: 'Entries',
    charts: 0,
    ready: '[data-testid="spending-items-move-blocked"]',
    shows: ['1 entry or part needs fixing before this file can be updated', '1 transfer between your accounts is split.', 'Open Overview'],
    lacks: ['Update the file'],
    cards: false,
  },
  {
    name: 'spending-entries-before-items-blocked-croatian',
    query: 'spending=before-items-split-transfer&lang=hr',
    hash: '#/spending/transactions',
    title: 'Unosi',
    charts: 0,
    ready: '[data-testid="spending-items-move-blocked"]',
    shows: ['1 unos ili dio treba ispraviti prije ažuriranja ove datoteke', '1 prijenos između vaših računa podijeljen je.', 'Otvori pregled'],
    lacks: ['Ažuriraj datoteku'],
    cards: false,
  },
  {
    name: 'spending-settings-before-items',
    query: 'spending=before-items',
    hash: '#/spending/settings',
    title: 'Settings',
    charts: 0,
    ready: '[data-testid="spending-items-move"]',
    shows: ['This file stores entries the way older versions of Kuna did', 'Update the file'],
  },
  {
    name: 'spending-settings-before-items-croatian',
    query: 'spending=before-items&lang=hr',
    hash: '#/spending/settings',
    title: 'Postavke',
    charts: 0,
    ready: '[data-testid="spending-items-move"]',
    shows: ['Ova datoteka vodi unose kao starije verzije Kune', 'Ažuriraj datoteku'],
  },
  {
    name: 'company-overview-newer',
    query: 'fake=newer-file',
    hash: '#/company',
    title: 'Overview',
    charts: 2,
    ready: '[data-testid="newer-file-notice"]',
    shows: ['A newer version of Kuna saved this file', 'Reload', 'Waiting for you'],
  },
  {
    name: 'company-overview-newer-croatian',
    query: 'fake=newer-file&lang=hr',
    hash: '#/company',
    title: 'Pregled',
    charts: 2,
    ready: '[data-testid="newer-file-notice"]',
    shows: ['Ovu je datoteku spremila novija verzija', 'Učitaj ponovno', 'Čeka vas'],
  },
  {
    name: 'spending-settings-newer',
    query: 'spending=newer-file',
    hash: '#/spending/settings',
    title: 'Settings',
    charts: 0,
    ready: '[data-testid="newer-file-notice"]',
    shows: 'A newer version of Kuna saved this file',
  },
  {
    name: 'spending-settings-newer-croatian',
    query: 'spending=newer-file&lang=hr',
    hash: '#/spending/settings',
    title: 'Postavke',
    charts: 0,
    ready: '[data-testid="newer-file-notice"]',
    shows: 'Ovu je datoteku spremila novija verzija',
  },
  {
    name: 'spending-overview-empty',
    query: 'spending=drive',
    hash: '#/spending',
    title: 'Overview',
    charts: 0,
    shows: ['Start with one account', 'Revolut', 'Add an account', 'kuna-spending.json'],
    cards: false,
  },
  {
    name: 'spending-overview-empty-croatian',
    query: 'spending=drive&lang=hr',
    hash: '#/spending',
    title: 'Pregled',
    charts: 0,
    shows: ['Počni s jednim računom', 'Revoluta', 'Dodaj račun', 'kuna-spending.json'],
    cards: false,
  },
  {
    name: 'spending-overview',
    query: 'spending=sample',
    hash: '#/spending',
    title: 'Overview',
    charts: 2,
    shows: ['Spent', SPENDING.spent.english, 'Left this month', SPENDING.left.english, 'Spending by group', 'Limits this month', 'Bank and cash', SPENDING.held.english],
    cards: false,
  },
  {
    name: 'spending-overview-croatian',
    query: 'spending=sample&lang=hr',
    hash: '#/spending',
    title: 'Pregled',
    charts: 2,
    shows: ['Potrošeno', SPENDING.spent.croatian, 'Preostalo ovaj mjesec', SPENDING.left.croatian, 'Potrošnja po skupinama', 'Ograničenja ovaj mjesec', 'Banka i gotovina', SPENDING.held.croatian],
    cards: false,
  },
  {
    name: 'spending-transactions',
    query: 'spending=sample',
    hash: '#/spending/transactions',
    title: 'Entries',
    charts: 0,
    shows: [...SPENDING.payees, 'All accounts', 'All categories'],
    cards: false,
  },
  {
    name: 'spending-transactions-croatian',
    query: 'spending=sample&lang=hr',
    hash: '#/spending/transactions',
    title: 'Unosi',
    charts: 0,
    shows: [...SPENDING.payees, 'Svi računi', 'Sve kategorije'],
    cards: false,
  },
  {
    name: 'spending-settings-receipts',
    query: 'spending=receipts',
    hash: '#/spending/settings?tab=receipts',
    title: 'Settings',
    charts: 0,
    ready: '[data-testid="spending-receipts-settings"]',
    shows: ['Receipts naming 00000000001 as the buyer go under For the company.', 'Change it in Company'],
    cards: false,
  },
  {
    name: 'spending-settings-receipts-no-company',
    query: 'fake=empty&spending=receipts',
    hash: '#/spending/settings?tab=receipts',
    title: 'Settings',
    charts: 0,
    ready: '[data-testid="spending-receipts-settings"]',
    shows: ['Company is not set up on this device', 'Open Company'],
    cards: false,
  },
  {
    name: 'spending-settings-receipts-croatian',
    query: 'spending=receipts&lang=hr',
    hash: '#/spending/settings?tab=receipts',
    title: 'Postavke',
    charts: 0,
    ready: '[data-testid="spending-receipts-settings"]',
    shows: ['Fiskalni računi na kojima je kupac 00000000001 idu pod Za tvrtku.', 'Promijeni ga u Tvrtki'],
    cards: false,
  },
  {
    name: 'spending-settings-receipts-no-company-croatian',
    query: 'fake=empty&spending=receipts&lang=hr',
    hash: '#/spending/settings?tab=receipts',
    title: 'Postavke',
    charts: 0,
    ready: '[data-testid="spending-receipts-settings"]',
    shows: ['Tvrtka nije postavljena na ovom uređaju', 'Otvori Tvrtku'],
    cards: false,
  },
  {
    name: 'spending-transaction-lines',
    query: 'spending=receipts',
    hash: '#/spending/transactions',
    title: 'Entries',
    charts: 0,
    ready: '[data-testid="spending-row-lines"]',
    shows: ['Corner market', 'Groceries', 'Household goods'],
    cards: false,
  },
  {
    name: 'spending-transaction-lines-croatian',
    query: 'spending=receipts&lang=hr',
    hash: '#/spending/transactions',
    title: 'Unosi',
    charts: 0,
    ready: '[data-testid="spending-row-lines"]',
    shows: ['Corner market', 'Namirnice', 'Kućanske potrepštine'],
    cards: false,
  },
  {
    name: 'spending-entries',
    query: 'spending=receipts',
    hash: '#/spending/transactions',
    title: 'Entries',
    charts: 0,
    ready: '[data-testid="spending-add-receipt"][aria-haspopup="menu"]',
    stored: { 'kuna.secret.anthropic': MADE_UP_ANTHROPIC_KEY },
    shows: ['Add a receipt', 'Add an entry'],
    cards: false,
  },
  {
    name: 'spending-entries-croatian',
    query: 'spending=receipts&lang=hr',
    hash: '#/spending/transactions',
    title: 'Unosi',
    charts: 0,
    ready: '[data-testid="spending-add-receipt"][aria-haspopup="menu"]',
    stored: { 'kuna.secret.anthropic': MADE_UP_ANTHROPIC_KEY },
    shows: ['Dodaj fiskalni račun', 'Dodaj unos'],
    cards: false,
  },
  {
    name: 'spending-review',
    query: 'spending=statements',
    hash: '#/spending/transactions?tab=review',
    title: 'Entries',
    charts: 0,
    shows: ['Rows to review', 'Old Town Bookshop', 'Maybe the same money', 'Maybe a transfer', 'Paired transfers', 'Not a pair', 'Waiting for the other side', 'Wants a Revolut savings account'],
    cards: false,
  },
  {
    name: 'spending-review-croatian',
    query: 'spending=statements&lang=hr',
    hash: '#/spending/transactions?tab=review',
    title: 'Unosi',
    charts: 0,
    shows: ['Stavke za pregled', 'Old Town Bookshop', 'Možda isti novac', 'Možda prijenos', 'Spojeni prijenosi', 'Nije par', 'Čeka drugu stranu', 'Treba Revolutov štedni račun'],
    cards: false,
  },
  {
    name: 'spending-settings-bank-sync',
    query: 'spending=statements',
    hash: '#/spending/settings?tab=bank-sync',
    title: 'Settings',
    charts: 0,
    shows: ['Bank sync', 'Script deployment ID'],
    cards: false,
  },
  {
    name: 'spending-settings-bank-sync-croatian',
    query: 'spending=statements&lang=hr',
    hash: '#/spending/settings?tab=bank-sync',
    title: 'Postavke',
    charts: 0,
    shows: ['Sinkronizacija s bankom', 'ID implementacije skripte'],
    cards: false,
  },
  {
    name: 'spending-settings-bank-sync-linked',
    query: 'spending=statements&banksync=linked',
    hash: '#/spending/settings?tab=bank-sync',
    title: 'Settings',
    charts: 0,
    shows: ['Linked until', 'Link OTP again'],
    cards: false,
  },
  {
    name: 'spending-settings-bank-sync-linked-croatian',
    query: 'spending=statements&banksync=linked&lang=hr',
    hash: '#/spending/settings?tab=bank-sync',
    title: 'Postavke',
    charts: 0,
    shows: ['Povezano do', 'Ponovno poveži OTP'],
    cards: false,
  },
  { name: 'spending-bank-sync-ending', query: 'spending=statements&banksync=ending', hash: '#/', title: 'All apps', charts: 0, shows: ['The link to OTP ends on', 'Link it again.'], cards: false },
  {
    name: 'spending-bank-sync-ending-croatian',
    query: 'spending=statements&banksync=ending&lang=hr',
    hash: '#/',
    title: 'Sve aplikacije',
    charts: 0,
    shows: ['Veza s bankom OTP istječe', ', pa je ponovno povežite.'],
    cards: false,
  },
  {
    name: 'spending-settings-rules',
    query: 'spending=statements',
    hash: '#/spending/settings?tab=rules',
    title: 'Settings',
    charts: 0,
    shows: ['Rules', 'Payee contains Corner market'],
    cards: false,
  },
  {
    name: 'spending-settings-rules-croatian',
    query: 'spending=statements&lang=hr',
    hash: '#/spending/settings?tab=rules',
    title: 'Postavke',
    charts: 0,
    shows: ['Pravila', 'Primatelj sadrži Corner market'],
    cards: false,
  },
  {
    name: 'spending-budgets',
    query: 'spending=sample',
    hash: '#/spending/budgets',
    title: 'Limits',
    charts: 0,
    shows: ['Food', SPENDING.food.available.english, SPENDING.food.left.english, SPENDING.food.carriedIn.english],
    cards: false,
  },
  {
    name: 'spending-budgets-croatian',
    query: 'spending=sample&lang=hr',
    hash: '#/spending/budgets',
    title: 'Ograničenja',
    charts: 0,
    shows: ['Hrana', SPENDING.food.available.croatian, SPENDING.food.left.croatian, SPENDING.food.carriedIn.croatian],
    cards: false,
  },
  { name: 'spending-budgets-over', query: 'spending=over', hash: '#/spending/budgets', title: 'Limits', charts: 0, shows: SPENDING.over.english, cards: false },
  { name: 'spending-budgets-over-croatian', query: 'spending=over&lang=hr', hash: '#/spending/budgets', title: 'Ograničenja', charts: 0, shows: SPENDING.over.croatian, cards: false },
  {
    name: 'spending-accounts',
    query: 'spending=sample',
    hash: '#/spending/accounts',
    title: 'Accounts',
    charts: 0,
    shows: ['Bank and cash', SPENDING.held.english, SPENDING.held.caption, 'OTP current', 'Revolut USD', SPENDING.dollars.balance.english, SPENDING.dollars.euros.english],
    cards: false,
  },
  {
    name: 'spending-accounts-croatian',
    query: 'spending=sample&lang=hr',
    hash: '#/spending/accounts',
    title: 'Računi',
    charts: 0,
    shows: ['Banka i gotovina', SPENDING.held.croatian, 'Revolut USD', SPENDING.dollars.balance.croatian, SPENDING.dollars.euros.croatian],
    cards: false,
  },
  {
    name: 'spending-account-usd',
    query: 'spending=sample',
    hash: `#/spending/account?account=${SAMPLE_USD_ACCOUNT}`,
    title: 'Revolut USD',
    charts: 0,
    shows: ['Balance today', SPENDING.dollars.balance.english, SPENDING.dollars.euros.english, SPENDING.dollars.rateLine],
    cards: false,
  },
  {
    name: 'spending-account-usd-croatian',
    query: 'spending=sample&lang=hr',
    hash: `#/spending/account?account=${SAMPLE_USD_ACCOUNT}`,
    title: 'Revolut USD',
    charts: 0,
    shows: ['Stanje danas', SPENDING.dollars.balance.croatian, SPENDING.dollars.euros.croatian, 'Po tečaju ESB-a od'],
    cards: false,
  },
  {
    name: 'spending-accounts-by-hand',
    query: 'spending=sample&banksync=by-hand',
    hash: '#/spending/accounts',
    title: 'Accounts',
    charts: 0,
    shows: ['Revolut USD', 'By hand'],
    cards: false,
  },
  {
    name: 'spending-accounts-by-hand-croatian',
    query: 'spending=sample&banksync=by-hand&lang=hr',
    hash: '#/spending/accounts',
    title: 'Računi',
    charts: 0,
    shows: ['Revolut USD', 'Ručno'],
    cards: false,
  },
  {
    name: 'spending-account-usd-by-hand',
    query: 'spending=sample&banksync=by-hand',
    hash: `#/spending/account?account=${SAMPLE_USD_ACCOUNT}`,
    title: 'Revolut USD',
    charts: 0,
    shows: ['Balance today', 'By hand'],
    cards: false,
  },
  {
    name: 'spending-account-usd-by-hand-croatian',
    query: 'spending=sample&banksync=by-hand&lang=hr',
    hash: `#/spending/account?account=${SAMPLE_USD_ACCOUNT}`,
    title: 'Revolut USD',
    charts: 0,
    shows: ['Stanje danas', 'Ručno'],
    cards: false,
  },
  {
    name: 'spending-rates-failed',
    query: 'spending=sample&rates=failed',
    hash: '#/spending/accounts',
    title: 'Accounts',
    charts: 0,
    shows: ['1 account in another currency not converted: the ECB rates did not load', SPENDING.heldWhileFailed.english, SPENDING.heldWhileFailed.caption],
    cards: false,
  },
  {
    name: 'spending-rates-failed-croatian',
    query: 'spending=sample&rates=failed&lang=hr',
    hash: '#/spending/accounts',
    title: 'Računi',
    charts: 0,
    shows: ['1 račun u drugoj valuti nije preračunat: tečajevi ESB-a nisu se učitali', SPENDING.heldWhileFailed.croatian],
    cards: false,
  },
  {
    name: 'spending-categories',
    query: 'spending=sample',
    hash: '#/spending/settings',
    title: 'Settings',
    charts: 0,
    shows: ['Categories', 'Food', 'Groceries', 'Outside spending and income', 'Between my accounts', 'Saved to investments', 'For the company', 'Counted in no spending, income or limit figure'],
  },
  {
    name: 'spending-categories-croatian',
    query: 'spending=sample&lang=hr',
    hash: '#/spending/settings',
    title: 'Postavke',
    charts: 0,
    shows: ['Kategorije', 'Hrana', 'Namirnice', 'Izvan potrošnje i prihoda', 'Između mojih računa', 'Prijenos u ulaganja', 'Za tvrtku', 'Ne ulazi ni u potrošnju, ni u prihode, ni u ograničenja'],
  },
  {
    name: 'spending-settings',
    query: 'spending=drive',
    hash: '#/spending/settings',
    title: 'Settings',
    charts: 0,
    ready: '[data-testid="spending-books-card"] [data-testid="drive-file-place"] a',
    shows: ['Spending file', 'kuna-spending.json', 'Switch storage'],
  },
  {
    name: 'spending-settings-croatian',
    query: 'spending=drive&lang=hr',
    hash: '#/spending/settings',
    title: 'Postavke',
    charts: 0,
    ready: '[data-testid="spending-books-card"] [data-testid="drive-file-place"] a',
    shows: ['Datoteka potrošnje', 'kuna-spending.json', 'Promijeni mjesto'],
  },
  {
    name: 'spending-settings-assist',
    query: 'spending=drive',
    hash: '#/spending/settings?tab=assistant',
    title: 'Settings',
    charts: 0,
    ready: '[data-testid="assist-allowed"][data-allowed="false"]',
    stored: { 'kuna.secret.anthropic': MADE_UP_ANTHROPIC_KEY },
    shows: [
      'Uses your Anthropic key, straight from this browser.',
      'Kuna asks once in each chat before it reads your records and sends to Anthropic.',
      'records and figures from Spending the chat asks for',
    ],
    lacks: ['Read a receipt'],
    cards: false,
  },
  {
    name: 'spending-settings-assist-croatian',
    query: 'spending=drive&lang=hr',
    hash: '#/spending/settings?tab=assistant',
    title: 'Postavke',
    charts: 0,
    ready: '[data-testid="assist-allowed"][data-allowed="false"]',
    stored: { 'kuna.secret.anthropic': MADE_UP_ANTHROPIC_KEY },
    shows: [
      'Koristi vaš ključ za Anthropic, izravno iz ovog preglednika.',
      'Kuna jednom u svakom razgovoru pita prije nego što pročita vaše zapise i pošalje ih tvrtki Anthropic.',
      'zapisi i iznosi iz aplikacije Potrošnja',
    ],
    lacks: ['Pročitaj fiskalni račun'],
    cards: false,
  },
  {
    name: 'spending-settings-assist-no-key',
    keyless: true,
    query: 'spending=drive',
    hash: '#/spending/settings?tab=assistant',
    title: 'Settings',
    charts: 0,
    ready: '[data-testid="assist-add-key"]',
    shows: ['With a key, the chat can read and change your records in Spending.', 'Add a key in Kuna settings'],
    cards: false,
  },
  {
    name: 'spending-settings-assist-no-key-croatian',
    keyless: true,
    query: 'spending=drive&lang=hr',
    hash: '#/spending/settings?tab=assistant',
    title: 'Postavke',
    charts: 0,
    ready: '[data-testid="assist-add-key"]',
    shows: ['S ključem razgovor može čitati i mijenjati vaše zapise u aplikaciji Potrošnja.', 'Dodaj ključ u postavkama Kune'],
    cards: false,
  },
  {
    name: 'spending-settings-browser',
    query: 'fake=browser&spending=browser',
    hash: '#/spending/settings',
    title: 'Settings',
    charts: 0,
    shows: ['Spending file', 'Fake Spending file', 'Some changes are in no exported file yet'],
  },
  {
    name: 'spending-settings-browser-croatian',
    query: 'fake=browser&spending=browser&lang=hr',
    hash: '#/spending/settings',
    title: 'Postavke',
    charts: 0,
    shows: ['Datoteka potrošnje', 'Fake Spending file', 'Neke promjene još nisu ni u jednoj izvezenoj datoteci'],
  },
  { name: 'spending-opening', query: 'spending=opening', hash: '#/spending', title: 'Overview', charts: 0, ready: '[data-testid="spending-loading"]', cards: false },
  { name: 'spending-opening-croatian', query: 'spending=opening&lang=hr', hash: '#/spending', title: 'Pregled', charts: 0, ready: '[data-testid="spending-loading"]', cards: false },
  { name: 'spending-failed', query: 'spending=failed', hash: '#/spending', title: 'Overview', charts: 0, cards: false },
  { name: 'spending-failed-croatian', query: 'spending=failed&lang=hr', hash: '#/spending', title: 'Pregled', charts: 0, cards: false },
  {
    name: 'investments-start',
    hash: '#/investments',
    title: 'Investments',
    charts: 0,
    shows: ['Where the Investments file lives', 'A new file on Google Drive', 'My file on Google Drive'],
    cards: false,
  },
  {
    name: 'investments-start-croatian',
    query: 'lang=hr',
    hash: '#/investments',
    title: 'Ulaganja',
    charts: 0,
    shows: ['Gdje se čuva datoteka ulaganja', 'Nova datoteka na Google Driveu', 'Moja datoteka na Google Driveu'],
    cards: false,
  },
  {
    name: 'investments-overview',
    query: 'investments=drive',
    hash: '#/investments',
    title: 'Overview',
    charts: 0,
    shows: ['No transactions yet', 'Add what I hold now', 'Import my full history', 'on Google Drive as kuna-investments.json'],
    cards: false,
  },
  {
    name: 'investments-overview-croatian',
    query: 'investments=drive&lang=hr',
    hash: '#/investments',
    title: 'Pregled',
    charts: 0,
    shows: ['Još nema transakcija', 'Dodaj što držim', 'Uvezi cijelu povijest', 'na Google Driveu kao kuna-investments.json'],
    cards: false,
  },
  { name: 'investments-opening', query: 'investments=opening', hash: '#/investments', title: 'Overview', charts: 0, ready: '[data-testid="investments-loading"]', cards: false },
  {
    name: 'investments-opening-croatian',
    query: 'investments=opening&lang=hr',
    hash: '#/investments',
    title: 'Pregled',
    charts: 0,
    ready: '[data-testid="investments-loading"]',
    cards: false,
  },
  {
    name: 'investments-settings',
    query: 'investments=drive',
    hash: '#/investments/settings',
    title: 'Settings',
    charts: 0,
    ready: '[data-testid="investments-books-card"] [data-testid="drive-file-place"] a',
    shows: ['Investments books', 'kuna-investments.json', 'Switch storage'],
  },
  {
    name: 'investments-settings-croatian',
    query: 'investments=drive&lang=hr',
    hash: '#/investments/settings',
    title: 'Postavke',
    charts: 0,
    ready: '[data-testid="investments-books-card"] [data-testid="drive-file-place"] a',
    shows: ['Datoteka ulaganja', 'kuna-investments.json', 'Promijeni mjesto', 'Zadnja sinkronizacija'],
  },
  {
    name: 'investments-overview-sample',
    query: 'investments=sample',
    hash: '#/investments',
    title: 'Overview',
    charts: 1,
    shows: [
      `At the close of ${SAMPLE_INVESTMENTS.close}.`,
      'Prices entered by hand',
      'Example Money Fund (EMF) uses the price you entered on',
      ...SAMPLE_INVESTMENTS.english,
      'Value over time',
      'Where the money is',
      'Cash and currencies',
      'All holdings',
      'Where the gain comes from',
      'Movers on the last day',
      'Latest transactions',
      'Stock lending',
      'Portfolio checks',
      'Change the thresholds',
      ...SAMPLE_CHECKS,
      'Fetched facts',
      'Vendors sent nothing usable for 2 holdings:',
      'Example Dividend Co',
    ],
  },
  {
    name: 'investments-overview-sample-croatian',
    query: 'investments=sample&lang=hr',
    hash: '#/investments',
    title: 'Pregled',
    charts: 1,
    shows: [
      'Stanje na zatvaranju:',
      'Cijene unesene ručno',
      ...SAMPLE_INVESTMENTS.croatian,
      'Vrijednost kroz vrijeme',
      'Gdje je novac',
      'Sve pozicije',
      'Odakle dolazi dobit',
      'Zadnje transakcije',
      'Provjere portfelja',
      'Iznad praga',
      'Promijeni pragove',
      'Dohvaćeni podaci',
      'Izvori nisu poslali ništa upotrebljivo za 2 pozicije:',
    ],
  },
  {
    name: 'investments-overview-cash-below-zero',
    query: 'investments=cash-below-zero',
    hash: '#/investments',
    title: 'Overview',
    charts: 1,
    shows: ['Some figures need a look', 'Broker Two holds −€', 'of cash, below zero. A deposit or an exchange is probably missing.', ...CASH_BELOW_ZERO_INVESTMENTS.english],
  },
  {
    name: 'investments-overview-cash-below-zero-croatian',
    query: 'investments=cash-below-zero&lang=hr',
    hash: '#/investments',
    title: 'Pregled',
    charts: 1,
    shows: ['Neke brojke treba provjeriti', 'Broker Two: novac je −', 'ispod nule. Vjerojatno nedostaje uplata ili konverzija.', ...CASH_BELOW_ZERO_INVESTMENTS.croatian],
  },
  {
    name: 'investments-holdings',
    query: 'investments=sample',
    hash: '#/investments/holdings',
    title: 'Holdings',
    charts: 1,
    expandedBefore: ['holdings.map'],
    ready: '[data-testid="holdings"] [data-testid="holding-row"], [data-testid="holdings-table"]',
    shows: [
      'holdings and the cash, worth',
      'Mix',
      'By sector',
      'By class',
      'Other and not known',
      '1 holding has no sector yet:',
      'Example Tech',
      'Example World ETF',
      'Example Money Fund',
      'Stocks',
      'Money market',
      'Cash and currencies',
      'Broker Two',
      'Total',
      'Closed positions',
      'Example Retired Co',
      'Map of holdings',
      'Size is the value, colour the gain on what you hold',
      'Gain of 10 to 25%',
      'Target mix',
      ...SAMPLE_HOLDINGS.english,
    ],
  },
  {
    name: 'investments-holdings-croatian',
    query: 'investments=sample&lang=hr',
    hash: '#/investments/holdings',
    title: 'Pozicije',
    charts: 1,
    expandedBefore: ['holdings.map'],
    ready: '[data-testid="holdings"] [data-testid="holding-row"], [data-testid="holdings-table"]',
    shows: [
      'pozicija i novac, vrijednost',
      'Raspodjela',
      'Po sektoru',
      'Po klasi',
      'Ostalo i nepoznato',
      '1 pozicija još nema sektor:',
      'Dionice',
      'Novčani fondovi',
      'Novac i valute',
      'Ukupno',
      'Zatvorene pozicije',
      'Karta pozicija',
      'Veličina je vrijednost, boja dobit na onome što držite',
      'Ciljna raspodjela',
      ...SAMPLE_HOLDINGS.croatian,
    ],
  },
  {
    name: 'investments-holdings-split-class',
    query: 'investments=sample',
    hash: '#/investments/holdings?split=class',
    title: 'Holdings',
    charts: 1,
    expandedBefore: ['holdings.map'],
    ready: '[data-mix="class"] .donut-ring canvas',
    shows: ['Mix', 'By class', 'Stocks', 'Money market', 'Cash and currencies', 'value'],
  },
  {
    name: 'investments-holdings-split-class-croatian',
    query: 'investments=sample&lang=hr',
    hash: '#/investments/holdings?split=class',
    title: 'Pozicije',
    charts: 1,
    expandedBefore: ['holdings.map'],
    ready: '[data-mix="class"] .donut-ring canvas',
    shows: ['Raspodjela', 'Po klasi', 'Dionice', 'Novčani fondovi', 'Novac i valute', 'vrijednost'],
  },
  {
    name: 'investments-holdings-split-country',
    query: 'investments=sample',
    hash: '#/investments/holdings?split=country&group=currency',
    title: 'Holdings',
    charts: 1,
    expandedBefore: ['holdings.map'],
    ready: '[data-mix="country"] .donut-ring canvas',
    shows: ['Mix', 'By country or region', 'United States', 'of holdings', 'By currency', 'USD', 'cash balance'],
  },
  {
    name: 'investments-holdings-split-country-croatian',
    query: 'investments=sample&lang=hr',
    hash: '#/investments/holdings?split=country&group=currency',
    title: 'Pozicije',
    charts: 1,
    expandedBefore: ['holdings.map'],
    ready: '[data-mix="country"] .donut-ring canvas',
    shows: ['Raspodjela', 'Po državi ili regiji', 'u pozicijama', 'Po valuti', 'USD', 'novčan'],
  },
  {
    name: 'investments-holdings-targets',
    query: 'investments=sample',
    hash: '#/investments/holdings',
    title: 'Holdings',
    charts: 1,
    expandedBefore: ['holdings.map', 'holdings.targets'],
    ready: '[data-testid="targets-table"]',
    shows: ['Target mix', 'By class', 'Set targets', 'Group', 'Target', 'Gap', 'If you put in', 'Splits it over what each group lacks', 'Stocks', 'Money market', ...SAMPLE_TARGETS.english],
  },
  {
    name: 'investments-holdings-targets-croatian',
    query: 'investments=sample&lang=hr',
    hash: '#/investments/holdings',
    title: 'Pozicije',
    charts: 1,
    expandedBefore: ['holdings.map', 'holdings.targets'],
    ready: '[data-testid="targets-table"]',
    shows: ['Ciljna raspodjela', 'Po klasi', 'Postavi ciljeve', 'Skupina', 'Cilj', 'Razlika', 'Ako uplatite', 'Dionice', 'Novčani fondovi', ...SAMPLE_TARGETS.croatian],
  },
  {
    name: 'investments-holdings-on-date',
    query: 'investments=sample',
    hash: `#/investments/holdings?on=${HOLDINGS_PAST_DAY}`,
    title: 'Holdings',
    charts: 1,
    expandedBefore: ['holdings.map'],
    ready: '[data-testid="holdings"] [data-testid="holding-row"], [data-testid="holdings-table"]',
    shows: [`Holdings at the close of ${dayLabel(HOLDINGS_PAST_DAY)}`, 'Today', 'By sector', 'Example World ETF', 'Closed positions', 'Example Retired Co'],
  },
  {
    name: 'investments-holdings-on-date-croatian',
    query: 'investments=sample&lang=hr',
    hash: `#/investments/holdings?on=${HOLDINGS_PAST_DAY}`,
    title: 'Pozicije',
    charts: 1,
    expandedBefore: ['holdings.map'],
    ready: '[data-testid="holdings"] [data-testid="holding-row"], [data-testid="holdings-table"]',
    shows: ['Pozicije na zatvaranju', 'Na dan', 'Danas', 'Po sektoru', 'Zatvorene pozicije'],
  },
  {
    name: 'investments-holdings-late',
    query: 'investments=sample&prices=late-prices',
    hash: '#/investments/holdings',
    title: 'Holdings',
    charts: 1,
    expandedBefore: ['holdings.map'],
    ready: '[data-testid="holdings"] [data-testid="holding-row"], [data-testid="holdings-table"]',
    shows: [`Close of ${LATE_HOLDING_CLOSE}, late`, 'Example Tech'],
  },
  {
    name: 'investments-holdings-late-croatian',
    query: 'investments=sample&prices=late-prices&lang=hr',
    hash: '#/investments/holdings',
    title: 'Pozicije',
    charts: 1,
    expandedBefore: ['holdings.map'],
    ready: '[data-testid="holdings"] [data-testid="holding-row"], [data-testid="holdings-table"]',
    shows: ['Zaključna cijena od', 'kasni', 'Example Tech'],
  },
  {
    name: 'investments-holding-usd',
    query: 'investments=sample',
    hash: `#/investments/holding?instrument=${SAMPLE_SHARE_A}`,
    title: SAMPLE_SHARE_A_PAGE.name,
    charts: 1,
    shows: [
      'quoted in USD',
      'first bought',
      'Total return',
      'Price',
      'Currency',
      'Realised on sales',
      'Average cost',
      'Tax-free',
      'Lots still held',
      'Transactions',
      'Sell',
      'Buy',
      'Sale',
      ...SAMPLE_SHARE_A_PAGE.english,
      'Market cap',
      'Listed since',
      '52-week range',
      'From Finnhub, approximate',
      ...fakeDetailsShows(SAMPLE_SHARE_A),
    ],
    cards: false,
  },
  {
    name: 'investments-holding-usd-croatian',
    query: 'investments=sample&lang=hr',
    hash: `#/investments/holding?instrument=${SAMPLE_SHARE_A}`,
    title: SAMPLE_SHARE_A_PAGE.name,
    charts: 1,
    shows: [
      'kotira u USD',
      'Ukupni prinos',
      'Tečaj',
      'Ostvareno prodajom',
      'Prosječna nabavna cijena',
      'Bez poreza',
      'Kupnje koje još držite',
      'Transakcije',
      'Kupnja',
      'Prodaja',
      ...SAMPLE_SHARE_A_PAGE.croatian,
      'Tržišna kapitalizacija',
      'Na burzi od',
      'Raspon u 52 tjedna',
      'Iz izvora Finnhub, približno',
    ],
    cards: false,
  },
  {
    name: 'investments-holding-split',
    query: 'investments=sample',
    hash: `#/investments/holding?instrument=${SAMPLE_SPIN_CO}`,
    title: SAMPLE_SPIN_CO_PAGE.name,
    charts: 1,
    shows: [
      'Price entered by hand on',
      'Split',
      '2 for 1',
      'Spin-off',
      'received from Example Dividend Co',
      'from a spin-off on',
      'Lots still held',
      'Details',
      'Not known',
      'Type it with Change',
      'Company profile from Finnhub',
      'Exchange',
      'NEW YORK STOCK EXCHANGE, INC.',
      'Entered by hand',
      ...SAMPLE_SPIN_CO_PAGE.english,
    ],
    cards: false,
  },
  {
    name: 'investments-holding-split-croatian',
    query: 'investments=sample&lang=hr',
    hash: `#/investments/holding?instrument=${SAMPLE_SPIN_CO}`,
    title: SAMPLE_SPIN_CO_PAGE.name,
    charts: 1,
    shows: [
      'Cijena unesena ručno',
      'Podjela',
      '2 za 1',
      'Izdvajanje',
      'primljeno iz: Example Dividend Co',
      'iz izdvajanja',
      'Pojedinosti',
      'Nije poznato',
      'Upiši to pod Promijeni',
      'Profil tvrtke iz izvora Finnhub',
      'Burza',
      ...SAMPLE_SPIN_CO_PAGE.croatian,
    ],
    cards: false,
  },
  {
    name: 'investments-holding-fund',
    query: 'investments=sample',
    hash: `#/investments/holding?instrument=${SAMPLE_WORLD_ETF}`,
    title: 'Example World ETF',
    charts: 1,
    ready: '[data-mix="country"] .donut-ring canvas',
    shows: [
      'Details',
      'Fund or ETF',
      'Its mix, as you typed it',
      '11 sectors',
      '8 countries or regions',
      'TER',
      '0.20%',
      'Dividends',
      'Accumulating',
      'Alpha Vantage',
      'As XYZ.DEX there',
      'By sector',
      'By country or region',
      'of this holding',
      'United States',
      'Domicile',
      'Ireland',
      'From its ISIN',
      '52-week range',
      'Alpha Vantage sent no fund profile for XYZ.DEX',
      'in its daily fetch. There is no Alpha Vantage key in this browser.',
      'Prices settings',
      ...fakeDetailsShows(SAMPLE_WORLD_ETF),
    ],
    cards: false,
  },
  {
    name: 'investments-holding-fund-croatian',
    query: 'investments=sample&lang=hr',
    hash: `#/investments/holding?instrument=${SAMPLE_WORLD_ETF}`,
    title: 'Example World ETF',
    charts: 1,
    ready: '[data-mix="country"] .donut-ring canvas',
    shows: [
      'Pojedinosti',
      'Fond ili ETF',
      'Raspodjela koju ste upisali',
      '11 sektora',
      '8 država ili regija',
      'Dividende',
      'Akumulirajući',
      'Po sektoru',
      'Po državi ili regiji',
      'ove pozicije',
      'Sjedište fonda',
      'Irska',
      'Raspon u 52 tjedna',
      'Alpha Vantage nije poslao profil fonda za XYZ.DEX',
      'pri dnevnom dohvaćanju. U ovom pregledniku nema ključa za Alpha Vantage.',
      'Postavke cijena',
    ],
    cards: false,
  },
  {
    name: 'investments-holding-fund-profile',
    query: 'investments=sample',
    hash: `#/investments/holding?instrument=${SAMPLE_MONEY_FUND}`,
    title: 'Example Money Fund',
    charts: 1,
    ready: '[data-testid="holding-details"]',
    shows: [
      'Details',
      'TER',
      '0.15%',
      'Fund profile from Alpha Vantage',
      'Fund size',
      'From Alpha Vantage, no currency stated',
      'Started',
      '48 holdings',
      'Listed by Alpha Vantage, maybe not all',
      ...fakeDetailsShows(SAMPLE_MONEY_FUND),
    ],
    cards: false,
  },
  {
    name: 'investments-holding-fund-profile-croatian',
    query: 'investments=sample&lang=hr',
    hash: `#/investments/holding?instrument=${SAMPLE_MONEY_FUND}`,
    title: 'Example Money Fund',
    charts: 1,
    ready: '[data-testid="holding-details"]',
    shows: [
      'Pojedinosti',
      'TER',
      'Profil fonda iz izvora Alpha Vantage',
      'Veličina fonda',
      'Iz izvora Alpha Vantage, bez valute',
      'Osnovan',
      '48 pozicija',
      'Popis iz izvora Alpha Vantage, možda nepotpun',
    ],
    cards: false,
  },
  {
    name: 'investments-holding-refused-profile',
    query: 'investments=sample',
    hash: `#/investments/holding?instrument=${SAMPLE_SHARE_B}`,
    title: 'Example Dividend Co',
    charts: 1,
    ready: '[data-testid="holding-fact-problem"]',
    shows: [
      'Details',
      'Finnhub refused the company profile for US000000DEF2: it needs a paid key',
      'There is no Finnhub key in this browser.',
      'Prices settings',
      'From its ISIN',
      ...fakeDetailsShows(SAMPLE_SHARE_B),
    ],
    cards: false,
  },
  {
    name: 'investments-holding-refused-profile-croatian',
    query: 'investments=sample&lang=hr',
    hash: `#/investments/holding?instrument=${SAMPLE_SHARE_B}`,
    title: 'Example Dividend Co',
    charts: 1,
    ready: '[data-testid="holding-fact-problem"]',
    shows: ['Pojedinosti', 'Finnhub odbio je profil tvrtke za US000000DEF2: traži plaćeni ključ', 'U ovom pregledniku nema ključa za Finnhub.', 'Postavke cijena', 'Iz ISIN-a'],
    cards: false,
  },
  {
    name: 'investments-holding-no-mix',
    query: 'investments=sample',
    hash: `#/investments/holding?instrument=${SAMPLE_INDEX_FUND}`,
    title: 'Example Index Fund',
    charts: 0,
    ready: '[data-testid="holding-no-mix"]',
    shows: ['Details', 'No mix by sector or country yet', 'Type its mix', 'Not known'],
    cards: false,
  },
  {
    name: 'investments-holding-compare',
    query: 'investments=sample',
    hash: `#/investments/holding?instrument=${SAMPLE_SHARE_A}&compare=twelvedata:EXQ`,
    title: SAMPLE_SHARE_A_PAGE.name,
    charts: 1,
    ready: '[data-testid="compare-chip"]',
    shows: ['Change since', 'each line as quoted', 'EXQ', 'Buy'],
    cards: false,
  },
  {
    name: 'investments-holding-compare-croatian',
    query: 'investments=sample&lang=hr',
    hash: `#/investments/holding?instrument=${SAMPLE_SHARE_A}&compare=twelvedata:EXQ`,
    title: SAMPLE_SHARE_A_PAGE.name,
    charts: 1,
    ready: '[data-testid="compare-chip"]',
    shows: ['Promjena od', 'svaka linija kako kotira', 'EXQ', 'Kupnja'],
    cards: false,
  },
  {
    name: 'investments-transactions',
    query: 'investments=sample',
    hash: '#/investments/transactions',
    title: 'Transactions',
    charts: 0,
    ready: '[data-testid="transactions"] [data-testid="transaction-row"]',
    shows: ['records, newest first', 'Add transaction', 'All kinds', 'Fee refund', 'Exchange', 'EUR into USD', 'Spin-off', 'Example Spinco from Example Dividend Co', '2 for 1', 'Monthly statement'],
    cards: false,
  },
  {
    name: 'investments-transactions-croatian',
    query: 'investments=sample&lang=hr',
    hash: '#/investments/transactions',
    title: 'Transakcije',
    charts: 0,
    ready: '[data-testid="transactions"] [data-testid="transaction-row"]',
    shows: ['zapisa, najnoviji prvi', 'Dodaj transakciju', 'Sve vrste', 'Povrat naknade', 'Konverzija', 'EUR u USD', 'Izdvajanje', '2 za 1'],
    cards: false,
  },
  {
    name: 'investments-transactions-empty',
    query: 'investments=drive',
    hash: '#/investments/transactions',
    title: 'Transactions',
    charts: 0,
    ready: '[data-testid="transactions-empty"]',
    shows: ['Every buy, sale, dividend, deposit, exchange and transfer shows here once you add it.', 'Add transaction'],
    cards: false,
  },
  {
    name: 'investments-performance',
    query: 'investments=sample',
    hash: '#/investments/performance',
    title: 'Performance',
    charts: 1,
    ready: '[data-testid="performance-tiles"]',
    shows: [
      'Your return',
      'Yearly return',
      'Benchmark',
      'Example Index Fund',
      'Difference',
      'Growth of €100.00',
      'The same money in Example Index Fund',
      'Returns by year',
      'so far',
      'A year with fewer than 12 monthly returns has no volatility.',
      ...SAMPLE_PERFORMANCE.english,
    ],
  },
  {
    name: 'investments-performance-croatian',
    query: 'investments=sample&lang=hr',
    hash: '#/investments/performance',
    title: 'Uspješnost',
    charts: 1,
    ready: '[data-testid="performance-tiles"]',
    shows: [
      'Vaš prinos',
      'Godišnji prinos',
      'Indeks',
      'Razlika',
      'Rast od 100,00',
      'Isti novac u indeksu Example Index Fund',
      'Prinosi po godinama',
      'zasad',
      'Godina s manje od 12 mjesečnih prinosa nema volatilnost.',
      ...SAMPLE_PERFORMANCE.croatian,
    ],
  },
  {
    name: 'investments-performance-compare',
    query: 'investments=sample',
    hash: '#/investments/performance?compare=twelvedata:EXQ',
    title: 'Performance',
    charts: 1,
    ready: '[data-testid="compare-chip"]',
    shows: ['Change since', "EXQ in euros at the day's ECB rate", 'Your portfolio', 'The same money in Example Index Fund'],
  },
  {
    name: 'investments-performance-compare-croatian',
    query: 'investments=sample&lang=hr',
    hash: '#/investments/performance?compare=twelvedata:EXQ',
    title: 'Uspješnost',
    charts: 1,
    ready: '[data-testid="compare-chip"]',
    shows: ['Promjena od', 'EXQ u eurima po ECB-ovu tečaju dana', 'Vaš portfelj'],
  },
  {
    name: 'investments-performance-compare-index',
    query: 'investments=sample',
    hash: '#/investments/performance?compare=twelvedata:SPY',
    title: 'Performance',
    charts: 1,
    ready: '[data-testid="compare-chip"]',
    shows: ['Change since', "S&P 500 (SPY) in euros at the day's ECB rate", 'S&P 500 (SPY)', 'Your portfolio'],
  },
  {
    name: 'investments-performance-quarter',
    query: 'investments=sample',
    hash: '#/investments/performance?period=2024q2',
    title: 'Performance',
    charts: 1,
    ready: '[data-testid="performance-part"]',
    shows: ['From 31 Mar 2024 to 30 Jun 2024.', 'Q2', 'Growth of €100.00', 'Under a year', 'Returns by year'],
  },
  {
    name: 'investments-performance-year-croatian',
    query: 'investments=sample&lang=hr',
    hash: '#/investments/performance?period=2024',
    title: 'Uspješnost',
    charts: 1,
    ready: '[data-testid="performance-part"]',
    shows: ['Cijela godina', 'Rast od 100,00', 'Prinosi po godinama', ...YEAR_PERFORMANCE.croatian],
  },
  {
    name: 'investments-performance-year',
    query: 'investments=sample',
    hash: '#/investments/performance?period=2024',
    title: 'Performance',
    charts: 1,
    ready: '[data-testid="performance-part"]',
    shows: ['Whole year', ...YEAR_PERFORMANCE.english],
  },
  {
    name: 'investments-performance-months',
    query: 'investments=sample',
    hash: '#/investments/performance?tab=months',
    title: 'Performance',
    charts: 0,
    ready: '[data-testid="performance-months"]',
    shows: ['Returns by month', 'Every month since your first deposit, time-weighted', 'Your return', 'Against the index', 'Year', SAMPLE_PERFORMANCE_TABS.months],
  },
  {
    name: 'investments-performance-months-croatian',
    query: 'investments=sample&lang=hr',
    hash: '#/investments/performance?tab=months',
    title: 'Uspješnost',
    charts: 0,
    ready: '[data-testid="performance-months"]',
    shows: ['Prinosi po mjesecima', 'Vaš prinos', 'Prema indeksu', 'Godina'],
  },
  {
    name: 'investments-performance-sources',
    query: 'investments=sample',
    hash: '#/investments/performance?tab=sources',
    title: 'Performance',
    charts: 2,
    ready: '[data-testid="performance-currency"]',
    shows: ['How the value changed', 'Start', 'End', 'What drove the return', 'Currency effect', 'Put in or taken out', 'Gain', 'Trading fees of', 'Portfolio', ...SAMPLE_PERFORMANCE_TABS.sources],
    cards: false,
  },
  {
    name: 'investments-performance-sources-1y',
    query: 'investments=sample',
    hash: '#/investments/performance?tab=sources&period=1y',
    title: 'Performance',
    charts: 2,
    ready: '[data-testid="performance-currency"]',
    shows: ['How the value changed', 'What drove the return', 'Currency effect', ...SAMPLE_PERFORMANCE_TABS.sourcesLastYear],
    cards: false,
  },
  {
    name: 'investments-performance-sources-croatian',
    query: 'investments=sample&lang=hr',
    hash: '#/investments/performance?tab=sources',
    title: 'Uspješnost',
    charts: 2,
    ready: '[data-testid="performance-currency"]',
    shows: ['Kako se mijenjala vrijednost', 'Početak', 'Kraj', 'Što je donijelo prinos', 'Učinak tečaja', 'Uloženo ili isplaćeno', 'Portfelj', ...SAMPLE_PERFORMANCE_TABS.sourcesCroatian],
    cards: false,
  },
  {
    name: 'investments-performance-falls',
    query: 'investments=sample',
    hash: '#/investments/performance?tab=falls',
    title: 'Performance',
    charts: 1,
    ready: '[data-testid="performance-underwater"]',
    shows: ['Below the peak', 'Now', 'Deepest', 'Longest below a peak', 'Largest fall and volatility', SAMPLE_PERFORMANCE_TABS.deepest],
    cards: false,
  },
  {
    name: 'investments-performance-falls-croatian',
    query: 'investments=sample&lang=hr',
    hash: '#/investments/performance?tab=falls',
    title: 'Uspješnost',
    charts: 1,
    ready: '[data-testid="performance-underwater"]',
    shows: ['Ispod vrha', 'Sada', 'Najdublje', 'Najdulje ispod vrha', 'Najveći pad i volatilnost'],
    cards: false,
  },
  {
    name: 'investments-performance-young',
    query: 'investments=young',
    hash: '#/investments/performance',
    title: 'Performance',
    charts: 1,
    ready: '[data-testid="performance-tiles"]',
    shows: ['Under a year', 'Shown for a period of a year or more', 'time-weighted', 'None chosen', 'Pick one in Settings', ...YOUNG_PERFORMANCE.english],
  },
  {
    name: 'investments-performance-young-croatian',
    query: 'investments=young&lang=hr',
    hash: '#/investments/performance',
    title: 'Uspješnost',
    charts: 1,
    ready: '[data-testid="performance-tiles"]',
    shows: ['Manje od godine', 'vremenski ponderirano', 'Nije odabran', 'Odaberi ga u postavkama', ...YOUNG_PERFORMANCE.croatian],
  },
  {
    name: 'investments-performance-no-benchmark',
    query: 'investments=sample&prices=no-benchmark',
    hash: '#/investments/performance',
    title: 'Performance',
    charts: 1,
    ready: '[data-testid="performance-notice"]',
    shows: ['Example Index Fund has no close in the prices file yet', 'No closes yet', 'Nothing to compare with', ...NO_BENCHMARK_PERFORMANCE.english],
  },
  {
    name: 'investments-performance-no-benchmark-croatian',
    query: 'investments=sample&prices=no-benchmark&lang=hr',
    hash: '#/investments/performance',
    title: 'Uspješnost',
    charts: 1,
    ready: '[data-testid="performance-notice"]',
    shows: ['Example Index Fund: u datoteci cijena još nema zaključne cijene', 'Još nema cijena', 'Nema usporedbe', ...NO_BENCHMARK_PERFORMANCE.croatian],
  },
  {
    name: 'investments-performance-income',
    query: 'investments=sample',
    hash: '#/investments/performance?tab=income',
    title: 'Performance',
    charts: 1,
    ready: '[data-testid="income-by-year"]',
    shows: ['Dividends, interest and other income, with the tax withheld at source.', 'By month', 'By year', 'Dividends', 'Interest', 'so far', ...SAMPLE_INCOME.income],
  },
  {
    name: 'investments-performance-income-croatian',
    query: 'investments=sample&lang=hr',
    hash: '#/investments/performance?tab=income',
    title: 'Uspješnost',
    charts: 1,
    ready: '[data-testid="income-by-year"]',
    shows: ['Po mjesecima', 'Po godinama', 'Dividende', 'Kamate', 'zasad', ...SAMPLE_INCOME.incomeCroatian],
  },
  {
    name: 'investments-performance-coming',
    query: 'investments=sample',
    hash: '#/investments/performance?tab=coming',
    title: 'Performance',
    charts: 1,
    ready: '[data-testid="coming-list"]',
    shows: ['Coming income', 'Announced', 'From last year', 'Payments to come', 'Status', 'Example Dividend Co', ...SAMPLE_INCOME.coming],
  },
  {
    name: 'investments-performance-coming-croatian',
    query: 'investments=sample&lang=hr',
    hash: '#/investments/performance?tab=coming',
    title: 'Uspješnost',
    charts: 1,
    ready: '[data-testid="coming-list"]',
    shows: ['Očekivani prihod', 'Najavljeno', 'Prema prošloj godini', 'Isplate koje dolaze', ...SAMPLE_INCOME.comingCroatian],
  },
  {
    name: 'investments-tax-partial-history',
    query: 'investments=partial-history',
    hash: '#/investments/tax',
    title: 'Tax',
    charts: 0,
    ready: '[data-testid="tax-history"]',
    shows: ['Tax on sales is left out for now', 'My history is complete'],
    cards: false,
  },
  {
    name: 'investments-tax-partial-history-croatian',
    query: 'investments=partial-history&lang=hr',
    hash: '#/investments/tax',
    title: 'Porez',
    charts: 0,
    ready: '[data-testid="tax-history"]',
    shows: ['Porez na prodaje zasad je izostavljen', 'Povijest je potpuna'],
    cards: false,
  },
  {
    name: 'investments-overview-partial-history',
    query: 'investments=partial-history',
    hash: '#/investments',
    title: 'Overview',
    charts: 1,
    ready: '[data-testid="getting-set-up"]',
    shows: ['Getting set up', 'Tell Kuna when this is your whole history'],
  },
  {
    name: 'investments-tax',
    query: 'investments=sample',
    hash: '#/investments/tax?year=2026',
    title: 'Tax',
    charts: 0,
    ready: '[data-testid="tax-deadlines"]',
    shows: ['Tax to pay', 'What to type into JOPPD', 'Deadlines', 'Rules Kuna uses', ...SAMPLE_TAX.year],
  },
  {
    name: 'investments-tax-croatian',
    query: 'investments=sample&lang=hr',
    hash: '#/investments/tax?year=2026',
    title: 'Porez',
    charts: 0,
    ready: '[data-testid="tax-deadlines"]',
    shows: ['Porez za uplatu', 'Što upisati u JOPPD', 'Rokovi', 'Pravila koja Kuna koristi', ...SAMPLE_TAX.yearCroatian],
  },
  {
    name: 'investments-tax-2023-city',
    query: 'investments=sale-2023',
    hash: '#/investments/tax?year=2023',
    title: 'Tax',
    charts: 0,
    ready: '[data-testid="tax-deadlines"]',
    shows: ['Your city in 2023', 'City not chosen', 'Choose it under Your city in 2023'],
  },
  {
    name: 'investments-tax-2023-city-croatian',
    query: 'investments=sale-2023&lang=hr',
    hash: '#/investments/tax?year=2023',
    title: 'Porez',
    charts: 0,
    ready: '[data-testid="tax-deadlines"]',
    shows: ['Vaš grad u 2023.', 'Grad nije odabran', 'Odaberi ga pod Vaš grad u 2023.'],
  },
  {
    name: 'investments-tax-sales',
    query: 'investments=sample',
    hash: '#/investments/tax?year=2026&tab=sales',
    title: 'Tax',
    charts: 0,
    ready: '[data-testid="tax-sales"]',
    shows: ['Example Tech', 'Example Spinco', 'Tax-free', 'Old loss, not offset', 'Download for Porezna (XLSX)', 'settles 5 Oct 2026, estimated', 'settles 20 Oct 2026', ...SAMPLE_TAX.sales],
    lacks: ['settles 20 Oct 2026, estimated'],
  },
  {
    name: 'investments-tax-sales-croatian',
    query: 'investments=sample&lang=hr',
    hash: '#/investments/tax?year=2026&tab=sales',
    title: 'Porez',
    charts: 0,
    ready: '[data-testid="tax-sales"]',
    shows: ['Bez poreza', 'Stari gubitak, ne odbija se', 'Preuzmi za Poreznu (XLSX)', 'namira 5.\u00a010.\u00a02026., procjena', 'namira 20.\u00a010.\u00a02026.', ...SAMPLE_TAX.salesCroatian],
    lacks: ['namira 20.\u00a010.\u00a02026., procjena'],
  },
  {
    name: 'investments-tax-foreign',
    query: 'investments=sample',
    hash: '#/investments/tax?year=2026&tab=foreign',
    title: 'Tax',
    charts: 0,
    ready: '[data-testid="tax-foreign"]',
    shows: [
      'Foreign income',
      'United States',
      'Ireland',
      'Country not known',
      'No US treaty in force in 2026, 30% withheld',
      "Owes 10% pension contributions and tax at your city's lower rate on the rest. Unconfirmed.",
      ...SAMPLE_TAX.foreign,
    ],
  },
  {
    name: 'investments-tax-foreign-croatian',
    query: 'investments=sample&lang=hr',
    hash: '#/investments/tax?year=2026&tab=foreign',
    title: 'Porez',
    charts: 0,
    ready: '[data-testid="tax-foreign"]',
    shows: [
      'Inozemni dohodak',
      'Sjedinjene Američke Države',
      'Irska',
      'Država nije poznata',
      'Duguje 10 % doprinosa za mirovinsko i porez po nižoj stopi vašeg grada na ostatak. Nepotvrđeno.',
      ...SAMPLE_TAX.foreignCroatian,
    ],
  },
  {
    name: 'investments-tax-tax-free',
    query: 'investments=sample',
    hash: '#/investments/tax?tab=tax-free',
    title: 'Tax',
    charts: 0,
    ready: '[data-testid="tax-free-lots"]',
    shows: ['Turns tax-free', 'Value now', ...SAMPLE_INCOME.taxFree],
  },
  {
    name: 'investments-tax-tax-free-croatian',
    query: 'investments=sample&lang=hr',
    hash: '#/investments/tax?tab=tax-free',
    title: 'Porez',
    charts: 0,
    ready: '[data-testid="tax-free-lots"]',
    shows: ['Postaje bez poreza', 'Vrijednost sada', 'bez poreza od', ...SAMPLE_INCOME.taxFreeCroatian],
  },
  {
    name: 'investments-performance-costs',
    query: 'investments=sample',
    hash: '#/investments/performance?tab=costs',
    title: 'Performance',
    charts: 0,
    ready: '[data-testid="costs-years"]',
    shows: [
      'Costs per year',
      'Trading fees',
      'Exchange fees',
      'Account fees',
      'Fund costs, estimated',
      'Example World ETF',
      'TER 0.20%',
      'so far',
      "Fund costs are already inside each fund's price",
      ...SAMPLE_INCOME.costs,
    ],
  },
  {
    name: 'investments-performance-costs-croatian',
    query: 'investments=sample&lang=hr',
    hash: '#/investments/performance?tab=costs',
    title: 'Uspješnost',
    charts: 0,
    ready: '[data-testid="costs-years"]',
    shows: ['Troškovi po godinama', 'Naknade trgovanja', 'Naknade konverzije', 'Naknade računa', 'Troškovi fondova, procjena', 'zasad', ...SAMPLE_INCOME.costsCroatian],
  },
  {
    name: 'investments-performance-saving',
    query: 'investments=sample',
    hash: '#/investments/performance?tab=saving',
    title: 'Performance',
    charts: 2,
    ready: '[data-testid="projection-chart"]',
    shows: [
      'Months in a row',
      'Longest run',
      'A month, last 12 months',
      'How regularly you invest',
      'Projection',
      'Each month',
      'Return a year',
      'At 3.5% a year you could take out',
      'At 4% a year you could take out',
      'Before tax and inflation',
      ...SAMPLE_INCOME.saving,
    ],
    cards: false,
  },
  {
    name: 'investments-performance-saving-croatian',
    query: 'investments=sample&lang=hr',
    hash: '#/investments/performance?tab=saving',
    title: 'Uspješnost',
    charts: 2,
    ready: '[data-testid="projection-chart"]',
    shows: [
      'Mjeseci zaredom',
      'Najdulji niz',
      'Mjesečno, zadnjih 12 mjeseci',
      'Koliko redovito ulažete',
      'Projekcija',
      'Svaki mjesec',
      'Prinos godišnje',
      'Prije poreza i inflacije',
      ...SAMPLE_INCOME.savingCroatian,
    ],
    cards: false,
  },
  {
    name: 'investments-prices-late',
    query: 'investments=sample&prices=late-prices',
    hash: '#/investments',
    title: 'Overview',
    charts: 1,
    ready: '[data-testid="investments-prices-behind"]',
    shows: [
      'Prices are behind',
      'The newest close is from',
      'The last fetch got nothing for 7 series',
      'Prices in Settings',
      `At the close of ${LATE_INVESTMENTS.close}.`,
      'Example Tech (ABC) is valued at its close of',
      ', which is late.',
      ...LATE_INVESTMENTS.english,
    ],
  },
  {
    name: 'investments-prices-late-croatian',
    query: 'investments=sample&prices=late-prices&lang=hr',
    hash: '#/investments',
    title: 'Pregled',
    charts: 1,
    ready: '[data-testid="investments-prices-behind"]',
    shows: ['Cijene kasne', 'Najnovija zaključna cijena je od', 'Zadnje dohvaćanje nije dobilo ništa za 7 nizova', 'Cijene u postavkama', 'koja kasni.', ...LATE_INVESTMENTS.croatian],
  },
  {
    name: 'investments-prices-settings',
    query: 'investments=sample',
    hash: '#/investments/settings?tab=prices',
    title: 'Settings',
    charts: 0,
    ready: '[data-testid="investments-prices-card"] [data-vendor="ecb"]',
    shows: [
      'Where prices come from',
      'Twelve Data',
      'Finnhub',
      'Company profiles of US shares',
      'Alpha Vantage',
      'European Central Bank',
      'No key in this browser.',
      'Needs no key.',
      'Get a free key',
      'Fetched',
      'Asked for 7 series, 0 already up to date.',
      'A free key takes 8 requests a minute and 800 a day.',
      'A free key takes 60 requests a minute.',
      'Gives daily closes and symbol search.',
      'Gives company profiles and symbol search.',
      'Gives daily closes, splits, fund profiles, announced dividends and symbol search.',
      'Import closes',
    ],
    cards: false,
  },
  {
    name: 'investments-prices-settings-croatian',
    query: 'investments=sample&lang=hr',
    hash: '#/investments/settings?tab=prices',
    title: 'Postavke',
    charts: 0,
    ready: '[data-testid="investments-prices-card"] [data-vendor="ecb"]',
    shows: [
      'Odakle dolaze cijene',
      'Profili američkih dionica',
      'Daje profile tvrtki i pretragu simbola.',
      'Europska središnja banka',
      'U ovom pregledniku nema ključa.',
      'Ne treba ključ.',
      'Besplatan ključ',
      'Zadnje dohvaćanje',
      'Besplatni ključ prima 8 zahtjeva u minuti i 800 dnevno.',
      'Uvoz zaključnih cijena',
    ],
    cards: false,
  },
  {
    name: 'investments-settings-sample',
    query: 'investments=sample',
    hash: '#/investments/settings',
    title: 'Settings',
    charts: 0,
    ready: '[data-testid="investments-books-card"]',
    shows: ['General', 'Prices', 'What Performance compares your portfolio with', 'Its last close in the prices file is from', 'Add a benchmark'],
  },
  {
    name: 'investments-settings-checks',
    query: 'investments=sample',
    hash: '#/investments/settings?tab=checks',
    title: 'Settings',
    charts: 0,
    ready: '[data-testid="investments-checks"]',
    shows: ['Checks', 'Portfolio checks', 'Largest holding', 'Default threshold 20%', 'Costs of the last 12 months', 'Gap to the target mix', 'Default threshold 5 points'],
    cards: false,
  },
  {
    name: 'investments-settings-checks-croatian',
    query: 'investments=sample&lang=hr',
    hash: '#/investments/settings?tab=checks',
    title: 'Postavke',
    charts: 0,
    ready: '[data-testid="investments-checks"]',
    shows: ['Provjere', 'Provjere portfelja', 'Najveća pozicija', 'Zadani prag 20\u00a0%', 'Troškovi u zadnjih 12 mjeseci', 'Zadani prag 5 postotnih bodova', 'Uključeno'],
    cards: false,
  },
  {
    name: 'investments-settings-binned',
    query: 'investments=binned',
    hash: '#/investments/settings',
    title: 'Settings',
    charts: 0,
    ready: '[data-testid="books-file-missing"]',
    shows: ['Kuna stopped using this file', 'The file is in the Drive bin, so Kuna no longer reads or saves it.', 'Switch storage'],
  },
  {
    name: 'investments-settings-binned-croatian',
    query: 'investments=binned&lang=hr',
    hash: '#/investments/settings',
    title: 'Postavke',
    charts: 0,
    ready: '[data-testid="books-file-missing"]',
    shows: ['Kuna je prestala koristiti ovu datoteku', 'Datoteka je u otpadu na Driveu, pa je Kuna više ne čita i ne sprema.', 'Promijeni mjesto'],
  },
  {
    name: 'investments-settings-sample-croatian',
    query: 'investments=sample&lang=hr',
    hash: '#/investments/settings',
    title: 'Postavke',
    charts: 0,
    ready: '[data-testid="investments-books-card"]',
    shows: ['Općenito', 'Cijene', 'Referentni indeks', 'Dodaj indeks'],
  },
  {
    name: 'investments-prices-settings-keys',
    query: 'investments=sample',
    hash: '#/investments/settings?tab=prices',
    title: 'Settings',
    charts: 0,
    ready: '[data-testid="investments-prices-card"] [data-testid="price-vendor-forget"]',
    stored: { 'kuna.secret.twelvedata': 'made-up-twelve-data-key-0042', 'kuna.secret.alphavantage': 'MADEUPKEY01' },
    shows: ['A key ending in 0042 is kept in this browser.', 'A key is kept in this browser.', 'Remove'],
    cards: false,
  },
  {
    name: 'investments-prices-settings-keys-croatian',
    query: 'investments=sample&lang=hr',
    hash: '#/investments/settings?tab=prices',
    title: 'Postavke',
    charts: 0,
    ready: '[data-testid="investments-prices-card"] [data-testid="price-vendor-forget"]',
    stored: { 'kuna.secret.twelvedata': 'made-up-twelve-data-key-0042', 'kuna.secret.alphavantage': 'MADEUPKEY01' },
    shows: ['U ovom pregledniku čuva se ključ koji završava na 0042.', 'U ovom pregledniku čuva se ključ.', 'Ukloni'],
    cards: false,
  },
  {
    name: 'investments-prices-settings-synced',
    query: 'investments=sample&keys=other-browser',
    hash: '#/investments/settings?tab=prices',
    title: 'Settings',
    charts: 0,
    ready: '[data-testid="investments-prices-card"] [data-vendor="twelvedata"][data-kept="true"]',
    shows: ['A key ending in 8642 is kept in this browser.', 'Each sync saves them to your Google account, hidden from Drive, so every browser you sign in to gets them.'],
    cards: false,
  },
  {
    name: 'investments-prices-settings-synced-croatian',
    query: 'investments=sample&keys=other-browser&lang=hr',
    hash: '#/investments/settings?tab=prices',
    title: 'Postavke',
    charts: 0,
    ready: '[data-testid="investments-prices-card"] [data-vendor="twelvedata"][data-kept="true"]',
    shows: ['U ovom pregledniku čuva se ključ koji završava na 8642.', 'Svaka ih sinkronizacija sprema na vaš Google račun, u skrivenu mapu koju Drive ne prikazuje'],
    cards: false,
  },
  {
    name: 'investments-prices-settings-removed',
    query: 'investments=sample&keys=removed',
    hash: '#/investments/settings?tab=prices',
    title: 'Settings',
    charts: 0,
    ready: '[data-testid="investments-prices-card"] [data-vendor="twelvedata"][data-kept="false"]',
    stored: { 'kuna.secret.twelvedata': 'made-up-twelve-data-key-0042', 'kuna.secret-changed.twelvedata': FAKE_KEY_SAVED_AT },
    shows: ['No key in this browser.', 'Each sync saves them to your Google account, hidden from Drive'],
    cards: false,
  },
  {
    name: 'investments-prices-legacy-keys',
    query: 'investments=sample&keys=legacy',
    hash: '#/investments/settings?tab=prices',
    title: 'Settings',
    charts: 0,
    ready: '[data-testid="investments-prices-card"] [data-vendor="twelvedata"][data-kept="true"]',
    shows: ['A key ending in 5307 is kept in this browser.', 'Each sync saves them to your Google account, hidden from Drive'],
    cards: false,
  },
  {
    name: 'investments-prices-settings-late',
    query: 'investments=sample&prices=late-prices',
    hash: '#/investments/settings?tab=prices',
    title: 'Settings',
    charts: 0,
    ready: '[data-testid="prices-failures"]',
    shows: [
      'The last fetch got nothing for 7 series',
      'Example Tech (ABC)',
      'Twelve Data refused the request.',
      "Alpha Vantage's limit was reached.",
      'USD rates',
      'European Central Bank did not answer.',
    ],
    cards: false,
  },
  {
    name: 'investments-prices-settings-late-croatian',
    query: 'investments=sample&prices=late-prices&lang=hr',
    hash: '#/investments/settings?tab=prices',
    title: 'Postavke',
    charts: 0,
    ready: '[data-testid="prices-failures"]',
    shows: [
      'Zadnje dohvaćanje nije dobilo ništa za 7 nizova',
      'Twelve Data: zahtjev je odbijen.',
      'Alpha Vantage: dosegnuto je ograničenje.',
      'Tečajevi USD',
      'Europska središnja banka: nema odgovora.',
    ],
    cards: false,
  },
  {
    name: 'import-summary',
    query: 'fake=empty',
    hash: '#/company/start?path=bring&home=browser&step=file',
    title: 'Company',
    charts: 0,
    shows: ['rows the app could not use', 'records, by tab', 'Keep in this browser'],
    upload: true,
    cards: false,
  },
  {
    name: 'import-summary-croatian',
    query: 'fake=empty&lang=hr',
    hash: '#/company/start?path=bring&home=browser&step=file',
    title: 'Tvrtka',
    charts: 0,
    shows: ['aplikacija nije mogla upotrijebiti', 'po listovima', 'Transakcije'],
    upload: true,
    cards: false,
  },
]

const THEMES = ['dark', 'light']

const VISITS = [
  ...THEMES.flatMap((theme) => SCREENS.map((screen) => ({ ...screen, theme, file: `${screen.name}-${theme}` }))),
  ...THEMES.flatMap((theme) => SOURCE_SCREENS.map((screen) => ({ ...screen, theme, file: `${screen.name}-${theme}` }))),
  ...THEMES.map((theme) => ({
    name: `gallery-${theme}`,
    hash: '#/gallery',
    title: 'Gallery',
    gallery: true,
    theme,
    file: `gallery-${theme}`,
  })),
]

/**
 * The only cards that may scroll sideways: editors whose every column is an input, on a phone, and the grid of monthly
 * returns, which reads as a table. Each names its card, the widest content room in px it may scroll at, and why. The room
 * is what the shell gives the page's content, so a docked chat or a sidebar narrows it as a narrower window does.
 */
const SIDEWAYS_SCROLL_ALLOWED = [
  {
    card: 'settings.categories',
    roomUpTo: Infinity,
    reason: 'Seven input columns at their narrowest are wider than the 100rem measure the Settings screen keeps.',
  },
  { card: 'settings.accounts', roomUpTo: 959, reason: 'Every column is an input, and they fit beside each other only from 960 px of content.' },
  { card: 'invoicing.clients', roomUpTo: Infinity, reason: 'Nine input columns, with the invoice details, are wider than any card.' },
  { card: 'year.asset-rows', roomUpTo: Infinity, reason: 'Ten input columns are wider than the 100rem measure the Year screen keeps.' },
  { card: 'year.grant-rows', roomUpTo: Infinity, reason: 'Twelve input columns are wider than the 100rem measure the Year screen keeps.' },
  { card: 'year.accountant-lines', roomUpTo: Infinity, reason: 'Nine input columns are wider than the 100rem measure the Year screen keeps.' },
  { card: 'salaries.employees', roomUpTo: Infinity, reason: 'Eleven input columns are wider than the 100rem measure the Salaries screen keeps.' },
  {
    card: 'investments.performance.months',
    roomUpTo: 1120,
    reason: 'Fourteen columns of signed figures with two decimals, a year and its twelve months, are wider than the card in Croatian up to 1120 px of content.',
  },
]

/** The screens whose cards may sit side by side in a grid of their own, each with why. */
const HAND_BUILT_GRIDS_ALLOWED = [{ screen: 'gallery', reason: 'The gallery sets specimens side by side to compare their states.' }]

const failures = []
/** Every card found wider than its content, allowed or not, listed at the end. */
const overflowSeen = []

/**
 * A dashboard grid has to rearrange as the screen widens from one of these widths to the next, unless all its cards
 * already sit in one row at the wider one, or its room stays between the same container steps. A docked chat takes part
 * of the window, so the room is the grid's container and not the window.
 */
const REFLOW_WIDTHS = [768, 1440, 1920]
/** The dashboard grids each screen showed and the container steps its styles had, by its name and the width, such as `overview 1440`. */
const dashboardGridsSeen = new Map()

/** The visit's address with the chat opened by its query, beside any query the screen has and before a link to a part. */
function withChatOpen(hash) {
  const [address, part] = hash.slice(1).split('#')
  const [path, search] = address.split('?')
  const query = new URLSearchParams(search ?? '')
  query.set('chat', '1')
  return `#${path}?${query}${part === undefined ? '' : `#${part}`}`
}

/** Whether a visit's query pins Croatian, so the screen is scanned for English left on it. */
function inCroatian(query) {
  return new URLSearchParams(query ?? '').get('lang') === 'hr'
}

/** Prints the failure as it is found, so a run that is cut short still shows it, and keeps it for the summary. */
function fail(scope, message) {
  const failure = `[${scope}] ${message}`
  failures.push(failure)
  console.error(`  ✗ ${failure}`)
}

function watchForErrors(page) {
  const errors = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(String(error)))
  return errors
}

/** Fake mode never talks to Google, so any other origin is a leak, api.iconify.design included. */
function watchForForeignRequests(page) {
  const own = new URL(BASE).origin
  const foreign = []
  page.on('request', (request) => {
    const url = request.url()
    if (url.startsWith('data:') || url.startsWith('blob:') || new URL(url).origin === own) return
    foreign.push(url)
  })
  return foreign
}

function readPage(page) {
  return page.evaluate((cardSelector) => {
    const doc = document.documentElement
    const name = (element) => `${element.tagName.toLowerCase()}.${element.className?.toString().split(' ')[0] ?? ''}`
    const overflowing = [...document.querySelectorAll('*')].filter((element) => element.getBoundingClientRect().right > doc.clientWidth + 1).map(name)
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      contentRoom: Math.round(document.querySelector('main > div')?.getBoundingClientRect().width ?? 0),
      overflowing: [...new Set(overflowing)].slice(0, 6),
      title: document.querySelector('[data-testid="screen-title"]')?.textContent?.trim() ?? null,
      chartHeights: [...document.querySelectorAll('.chart-body canvas')]
        .filter((canvas) => canvas.closest('.chart-body').getClientRects().length > 0)
        .map((canvas) => canvas.getBoundingClientRect().height),
      donutHeights: [...document.querySelectorAll('[data-testid="donut-card"] canvas')].map((canvas) => canvas.getBoundingClientRect().height),
      iconCount: document.querySelectorAll('svg.iconify').length,
      unrenderedIcons: [...document.querySelectorAll('.iconify')].filter((icon) => icon.tagName.toLowerCase() !== 'svg').length,
      themeClass: doc.classList.contains('light') ? 'light' : doc.classList.contains('dark') ? 'dark' : 'none',
      text: document.body.innerText,
      raggedRows: raggedCardRows(cardSelector),
      cardOverflow: overflowingCards(cardSelector),
      unevenFieldRows: unevenFieldRows(),
      dashboardGrids: dashboardGrids(),
      containerSteps: containerSteps(),
      handBuiltGrids: handBuiltGrids(cardSelector),
      crowdedDonuts: crowdedDonuts(cardSelector),
      offsetTables: offsetTables(),
      phoneHeaderActions: phoneHeaderActions(),
      wideLoneCards: wideLoneCards(),
      drillLinksOffColour: drillLinksOffColour(),
    }

    const titleOf = (card) => (card.querySelector(':scope > header :is(h1, h2, h3)')?.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 48)

    /**
     * Tables straight in a titled card's body whose first cell that shows, in the head and in the body's first row, does
     * not start its text where the card's title starts, as when a column hidden on a phone takes the inset with it.
     */
    function offsetTables() {
      const found = []
      for (const table of document.querySelectorAll('.data-table')) {
        const frame = table.parentElement
        const card = frame.parentElement?.parentElement
        if (!card?.matches('[data-app-card]') || table.getClientRects().length === 0 || frame.scrollLeft > 0) continue
        const title = card.querySelector(':scope > header :is(h1, h2, h3)')
        if (title === null) continue
        const titleStart = title.getBoundingClientRect().left
        for (const row of [table.tHead?.rows[0], table.tBodies[0]?.rows[0]]) {
          const cell = [...(row?.cells ?? [])].find((candidate) => getComputedStyle(candidate).display !== 'none')
          if (cell === undefined) continue
          const style = getComputedStyle(cell)
          const textStart = cell.getBoundingClientRect().left + parseFloat(style.borderLeftWidth) + parseFloat(style.paddingLeft)
          if (Math.abs(textStart - titleStart) > 1.5) {
            found.push(`"${titleOf(card)}" starts its first cell "${cell.textContent.trim().slice(0, 24)}" ${Math.round(textStart - titleStart)} px from its title`)
            break
          }
        }
      }
      return found
    }

    /** Below 640 px a card's header actions sit on a row of their own under its title, starting where the title does. */
    function phoneHeaderActions() {
      if (window.innerWidth >= 640) return []
      const found = []
      for (const actions of document.querySelectorAll('[data-testid="card-actions"]')) {
        const titleBlock = actions.previousElementSibling
        if (titleBlock === null || actions.getClientRects().length === 0) continue
        const placed = actions.getBoundingClientRect()
        const title = titleBlock.getBoundingClientRect()
        if (placed.top < title.bottom - 1 || Math.abs(placed.left - title.left) > 1) found.push(`"${titleOf(actions.closest('[data-app-card]'))}" keeps its header actions beside its title on a phone`)
      }
      return found
    }

    /** A tab that holds one card of words and fields keeps it to 42rem, the welcome's measure. A card with a table or a chart takes the tab's width. */
    function wideLoneCards() {
      const measure = 42 * parseFloat(getComputedStyle(document.documentElement).fontSize)
      const found = []
      for (const panel of document.querySelectorAll('[role="tabpanel"]')) {
        const shown = [...panel.children].filter((child) => child.getClientRects().length > 0)
        const card = shown[0]
        if (shown.length !== 1 || !card.matches('[data-app-card]') || card.querySelector('table, canvas') !== null) continue
        const width = card.getBoundingClientRect().width
        if (width > measure + 1) found.push(`"${titleOf(card)}", the one card of its tab, is ${Math.round(width)} px wide, past the 42rem measure`)
      }
      return found
    }

    /** A DrillLink takes the colour of the text class its caller gives it, which a style of its own once overrode. */
    function drillLinksOffColour() {
      const found = []
      for (const link of document.querySelectorAll('a.drill-link')) {
        const colourClass = [...link.classList].find((name) => /^text-(?:highlighted|default|toned|muted|dimmed|primary|error|success|warning|info)$/.test(name))
        if (colourClass === undefined || link.getClientRects().length === 0) continue
        const probe = document.createElement('span')
        probe.className = colourClass
        link.parentElement.append(probe)
        const wanted = getComputedStyle(probe).color
        probe.remove()
        if (getComputedStyle(link).color !== wanted) found.push(`the link "${link.textContent.trim().slice(0, 32)}" ignores its ${colourClass}`)
      }
      return found
    }

    /**
     * Donuts whose middle reaches past the hole: a corner of a line of the total or its label sits
     * farther from the ring's centre than the hole's radius less 2 px. The hole's radius is how far
     * the ring's canvas stays clear from its centre, read in 32 directions, so a ring that has not
     * drawn has no hole to check.
     */
    function crowdedDonuts(selector) {
      const found = []
      for (const ring of document.querySelectorAll('.donut-ring')) {
        const canvas = ring.querySelector('canvas')
        const middle = ring.querySelector('.ring-middle')
        if (canvas === null || middle === null || canvas.width === 0 || ring.getClientRects().length === 0) continue
        const box = canvas.getBoundingClientRect()
        const scale = canvas.width / box.width
        const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data
        const painted = (x, y) => pixels[(Math.round(y * scale) * canvas.width + Math.round(x * scale)) * 4 + 3] > 128
        let hole = Infinity
        for (let step = 0; step < 32; step++) {
          const angle = (step / 32) * 2 * Math.PI
          for (let radius = 0; radius < box.width / 2; radius += 0.5) {
            if (painted(box.width / 2 + Math.cos(angle) * radius, box.height / 2 + Math.sin(angle) * radius)) {
              hole = Math.min(hole, radius)
              break
            }
          }
        }
        if (hole === Infinity) continue
        const centreX = box.left + box.width / 2
        const centreY = box.top + box.height / 2
        const walker = document.createTreeWalker(middle, NodeFilter.SHOW_TEXT)
        for (let text = walker.nextNode(); text !== null; text = walker.nextNode()) {
          const range = document.createRange()
          range.selectNodeContents(text)
          for (const line of range.getClientRects()) {
            const reach = Math.max(...[line.left, line.right].flatMap((x) => [line.top, line.bottom].map((y) => Math.hypot(x - centreX, y - centreY))))
            if (reach > hole - 2) {
              const title = (ring.closest(selector)?.querySelector('h2, h3')?.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 48)
              found.push(`"${text.textContent.trim()}" in the middle of "${title}" reaches ${reach.toFixed(1)} px from the centre, past the ring's ${hole.toFixed(1)} px hole`)
            }
          }
        }
      }
      return found
    }

    /**
     * Pairs of side-by-side fields in one form, dialog or card whose tops line up but whose controls
     * start more than 1 px apart, as when a label that wraps pushes its input below its neighbour's.
     * A field without an input, a select or a text area, such as a radio group or a switch, has no
     * control to line up.
     */
    function unevenFieldRows() {
      const control =
        'input:not([type="hidden"], [type="checkbox"], [type="radio"], [type="file"], [aria-hidden="true"]), select, textarea, [role="combobox"], [data-slot="base"]:has(> [data-slot="segment"])'
      const fields = [...document.querySelectorAll('[data-slot="root"]:has(> [data-slot="wrapper"])')].flatMap((field) => {
        const input = [...field.querySelectorAll(control)].find((element) => element.getClientRects().length > 0)
        if (input === undefined) return []
        // An input inside a Nuxt UI input box starts where its box does, past the box's icon or tags.
        const box = input.parentElement.closest('[data-slot="root"]')
        const measured = box !== field && field.contains(box) ? box : input
        return [{ field, frame: field.closest('form, [role="dialog"], .rounded-card'), box: field.getBoundingClientRect(), control: measured.getBoundingClientRect().top }]
      })
      const label = ({ field }) => (field.querySelector('[data-slot="label"]')?.textContent ?? '').trim().slice(0, 32)
      const uneven = []
      for (const [index, left] of fields.entries()) {
        for (const right of fields.slice(index + 1)) {
          const sideBySide = left.box.right <= right.box.left + 1 || right.box.right <= left.box.left + 1
          if (left.frame !== right.frame || !sideBySide || Math.abs(left.box.top - right.box.top) > 1) continue
          const gap = Math.abs(left.control - right.control)
          if (gap > 1) uneven.push(`"${label(left)}" and "${label(right)}" have their inputs ${Math.round(gap)} px apart`)
        }
      }
      return uneven
    }

    /**
     * Each dashboard grid laid out as a grid, in page order, with how many of its parts sit in each
     * of its rows and the width of the container its steps answer to. Below @8xl a pair is not a grid, its parts stacking in the screen's column.
     */
    function dashboardGrids() {
      const roomOf = (grid) => {
        for (let box = grid.parentElement; box !== null; box = box.parentElement) {
          const style = getComputedStyle(box)
          if (style.containerType !== 'normal') return Math.round(box.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight))
        }
        return window.innerWidth
      }
      const grids = []
      for (const grid of document.querySelectorAll('[data-layout]')) {
        if (getComputedStyle(grid).display !== 'grid') continue
        const rows = new Map()
        for (const part of [...grid.children].filter((child) => child.getClientRects().length > 0)) {
          const top = Math.round(part.getBoundingClientRect().top)
          const row = [...rows.keys()].find((start) => Math.abs(start - top) <= 1) ?? top
          rows.set(row, (rows.get(row) ?? 0) + 1)
        }
        const name = (grid.dataset.testid ?? grid.querySelector('h2, h3, p')?.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 32)
        grids.push({ name, layout: grid.dataset.layout, room: roomOf(grid), rows: [...rows.entries()].sort(([first], [second]) => first - second).map(([, count]) => count) })
      }
      return grids
    }

    /** The widths in px at which the page's container queries change something, read from its stylesheets. */
    function containerSteps() {
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize)
      const steps = new Set()
      const visit = (rules) => {
        for (const rule of rules) {
          if (rule instanceof CSSContainerRule) {
            for (const [, amount, unit] of rule.conditionText.matchAll(/(?:width\s*>=?|min-width:)\s*([\d.]+)(rem|px)/g)) steps.add(Math.round(Number(amount) * (unit === 'rem' ? rem : 1)))
          }
          if (rule.cssRules) visit(rule.cssRules)
        }
      }
      for (const sheet of document.styleSheets) visit(sheet.cssRules)
      return [...steps].sort((first, second) => first - second)
    }

    /**
     * Grids on the screen that set two of their cards side by side without being a DashboardGrid, so
     * they rearrange by breakpoints of their own. A grid inside a card is part of that card.
     */
    function handBuiltGrids(selector) {
      const found = []
      for (const grid of new Set([...document.querySelectorAll(`main ${selector}`)].map((card) => card.parentElement))) {
        if (grid.dataset.layout !== undefined || grid.closest(selector) !== null || getComputedStyle(grid).display !== 'grid') continue
        const tops = [...grid.children].filter((child) => child.matches(selector) && child.getClientRects().length > 0).map((card) => Math.round(card.getBoundingClientRect().top))
        if (!tops.some((top, index) => tops.slice(index + 1).some((other) => Math.abs(other - top) <= 1))) continue
        found.push((grid.dataset.testid ?? grid.querySelector('h2, h3, p')?.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 32))
      }
      return found
    }

    /**
     * Cards whose content is wider than the card: the card or a box in it that scrolls or clips
     * sideways, or a box that reaches past the card's edges. A line of text cut short with an
     * ellipsis is meant to clip, and a box inside one that scrolls is counted with it.
     */
    function overflowingCards(selector) {
      const clips = (style) => style.overflowX !== 'visible'
      const found = []
      for (const card of document.querySelectorAll(selector)) {
        if (card.parentElement?.closest(selector) || card.getClientRects().length === 0) continue
        const edge = card.getBoundingClientRect()
        let widest = null
        for (const element of [card, ...card.querySelectorAll('*')]) {
          if (element.getClientRects().length === 0) continue
          const style = getComputedStyle(element)
          if (style.position === 'fixed' || style.textOverflow === 'ellipsis') continue
          // An indeterminate progress bar slides its indicator past its own clipped track, so its scroll width changes by the frame.
          if (element.getAttribute('role') === 'progressbar') continue
          let content = 0
          // A one-line input scrolls a long value inside itself, which never widens its card.
          if (element instanceof HTMLElement && !(element instanceof HTMLInputElement) && element.clientWidth > 1 && clips(style) && element.scrollWidth > element.clientWidth + 1) {
            content = element.scrollWidth - element.clientWidth + edge.width
          } else if (element !== card) {
            const box = element.getBoundingClientRect()
            let inside = element.parentElement
            while (inside !== null && inside !== card && !clips(getComputedStyle(inside))) inside = inside.parentElement
            if (inside === card && box.width > 1 && (box.right > edge.right + 1 || box.left < edge.left - 1)) {
              content = Math.max(box.right, edge.right) - Math.min(box.left, edge.left)
            }
          }
          if (content > (widest?.content ?? 0)) widest = { content, element }
        }
        if (widest !== null) {
          found.push({
            card: card.dataset.card ?? null,
            title: (card.querySelector('h2, h3')?.textContent ?? card.getAttribute('aria-label') ?? card.dataset.testid ?? '').trim().replace(/\s+/g, ' ').slice(0, 48),
            width: Math.round(edge.width),
            content: Math.round(widest.content),
            by: `${widest.element.tagName.toLowerCase()}${widest.element.classList.length ? `.${[...widest.element.classList].slice(0, 2).join('.')}` : ''}`,
          })
        }
      }
      return found
    }

    /**
     * Pairs of side-by-side cards whose tops line up but whose bottoms are more than 1 px apart. A card
     * with a sibling card stacked right under it, beside one without, heads a column of cards beside a
     * single long card, so its bottom is not meant to line up.
     */
    function raggedCardRows(selector) {
      const cards = [...document.querySelectorAll(selector)]
        .filter((card) => !card.parentElement?.closest(selector) && card.getClientRects().length > 0)
        .map((card) => ({ card, box: card.getBoundingClientRect() }))
      const label = (card) => (card.querySelector('h2, h3, p, dt, span')?.textContent ?? card.textContent ?? '').trim().slice(0, 32)
      const headsColumn = ({ card, box }) =>
        cards.some(
          (other) =>
            other.card.parentElement === card.parentElement &&
            Math.abs(other.box.left - box.left) <= 1 &&
            Math.abs(other.box.right - box.right) <= 1 &&
            other.box.top >= box.bottom - 1 &&
            other.box.top - box.bottom <= 32,
        )
      const ragged = []
      for (const [index, left] of cards.entries()) {
        for (const right of cards.slice(index + 1)) {
          const sideBySide = left.box.right <= right.box.left + 1 || right.box.right <= left.box.left + 1
          if (!sideBySide || Math.abs(left.box.top - right.box.top) > 1) continue
          if (headsColumn(left) !== headsColumn(right)) continue
          const gap = Math.abs(left.box.bottom - right.box.bottom)
          if (gap > 1) ragged.push(`"${label(left.card)}" and "${label(right.card)}" end ${Math.round(gap)} px apart`)
        }
      }
      return ragged
    }
  }, CARD_SELECTOR)
}

/**
 * Runs in the page: the linked part sits just below the bars that stay at the top, or in view at
 * the foot of a page too short to scroll it higher, in a card that is open.
 */
function linkedPartLanded(id) {
  const part = document.getElementById(id)
  const card = part?.closest('[data-card]')
  if (part === null || card?.dataset.collapsed !== 'false') return false
  const band = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sticky-band')) || 0
  const top = part.getBoundingClientRect().top
  const atFoot = window.scrollY >= document.documentElement.scrollHeight - window.innerHeight - 1
  return (top >= band && top <= band + 40) || (atFoot && top >= band && top < window.innerHeight)
}

/** Runs in the page: the linked row is in an open card and inside the window. */
function linkedRowShown(selector) {
  const row = document.querySelector(selector)
  if (row === null || row.closest('[data-card]')?.dataset.collapsed !== 'false') return false
  const box = row.getBoundingClientRect()
  return box.height > 0 && box.top >= 0 && box.bottom <= window.innerHeight
}

/**
 * Runs in the page: the side panel holds the linked rule, and its line in the list is marked and
 * starts just below the sticky search bar and its area's heading.
 */
function linkedRuleInView(ruleId) {
  const line = document.getElementById(`rule-${ruleId}`)
  const bar = document.querySelector('[data-testid="ruleset-bar"]')
  const panel = document.querySelector('[role="dialog"] [data-testid="rule-detail"]')
  const heading = line?.closest('section')?.querySelector('h3')
  if (line === null || bar === null || panel === null || heading == null || line.getAttribute('aria-current') !== 'true') return false
  const below = line.getBoundingClientRect().top - heading.getBoundingClientRect().bottom
  return heading.getBoundingClientRect().top >= bar.getBoundingClientRect().bottom - 1 && below >= -1 && below <= 24
}

/** Holds back every web font, as a slow runner does, so text reflows after the screen's first frames. */
async function slowWebFonts(page) {
  await page.setRequestInterception(true)
  page.on('request', (request) => {
    if (request.url().endsWith('.woff2')) setTimeout(() => request.continue(), 400)
    else request.continue()
  })
}

mkdirSync(SCREENSHOT_DIR, { recursive: true })
// Screenshots of a screen that no longer exists would otherwise survive and mislead a review. A limited run keeps the others.
if (!selection.limited) {
  for (const stale of readdirSync(SCREENSHOT_DIR).filter((file) => file.endsWith('.png'))) {
    rmSync(join(SCREENSHOT_DIR, stale))
  }
}

/** The fake workbook as an xlsx file, with a ledger row that has no amount and a setting the app does not know. */
function writeImportFile() {
  installHrDooPack()
  const tabs = tabsOfDocument(fakeWorkbookDocument('2026-10-16T08:00:00.000Z', 'browser'))
  const values = Object.fromEntries(
    Object.entries(tabs).map(([tab, rows]) => {
      const header = [...new Set([...templateColumnNames(tab), ...rows.flatMap((row) => Object.keys(row.cells))])]
      return [tab, [header, ...rows.map((row) => header.map((column) => row.cells[column] ?? ''))]]
    }),
  )
  const book = XLSX.utils.book_new()
  const ledger = [...values.ledger, [values.ledger[1][0], 'main', 'stray row without an amount']]
  const settings = [...values.settings, ['colour_scheme', 'teal']]
  for (const [tab, grid] of Object.entries({ ...values, ledger, settings })) {
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(grid), tab)
  }
  const path = join(SCREENSHOT_DIR, 'example-books.xlsx')
  writeFileSync(path, XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }))
  return path
}

const IMPORT_FILE = writeImportFile()
const IMPORT_SAMPLES = await writeImportSamples(SCREENSHOT_DIR)
const SPENDING_IMPORT_SAMPLES = writeSpendingImportSamples(SCREENSHOT_DIR)
const SPENDING_RECEIPT_SAMPLES = writeSpendingReceiptSamples(SCREENSHOT_DIR)
const CHAT_ATTACHMENT_SAMPLES = await writeChatAttachmentSamples(SCREENSHOT_DIR)
const WORKBOOK_SAMPLES = await writeWorkbookSamples(SCREENSHOT_DIR)
const FLEX_REPORT_SAMPLES = writeFlexReportSamples(SCREENSHOT_DIR)
const CLOSES_SAMPLES = writeClosesSamples(SCREENSHOT_DIR)

/** The dialog flows run at every width, so the uneven form row rule sees each dialog as every width lays it out. */
const EVERY_VIEWPORT = VIEWPORTS.filter((viewport) => !viewport.chatDocked).map((viewport) => viewport.name)
/** The menu flows run at the widths where a menu's text wraps differently, so the text overlap rule sees every picker open. */
const MENU_VIEWPORTS = ['phone', 'small-tablet', 'tablet-wide', 'desktop']
/** The widths where the sidebar's states and the docked chat trade room. */
const SIDEBAR_VIEWPORTS = ['tablet-wide', 'laptop', 'desktop', 'wide']
/** The widths a design review looks at, for the flows that shoot what it needs. */
const DESIGN_REVIEW_VIEWPORTS = ['phone', 'small-tablet', 'tablet-wide', 'desktop']

/** The editors' flows, each on a fresh load, so the fake file on Drive and the workbook kept in this browser start from their seed. */
const FLOWS = [
  { name: 'chat-panel-flow', hash: '#/spending', title: 'Overview', run: chatPanelFlowIn('en'), queries: { drive: '&spending=sample', browser: '&fake=browser&spending=sample' } },
  {
    name: 'chat-panel-flow-croatian',
    hash: '#/spending',
    title: 'Pregled',
    run: chatPanelFlowIn('hr'),
    queries: { drive: '&spending=sample&lang=hr', browser: '&fake=browser&spending=sample&lang=hr' },
  },
  { name: 'chat-read', hash: '#/spending', title: 'Overview', run: chatReadFlowIn('en'), modes: ['drive'], viewports: DESIGN_REVIEW_VIEWPORTS, queries: { drive: '&spending=people' } },
  {
    name: 'chat-read-croatian',
    hash: '#/spending',
    title: 'Pregled',
    run: chatReadFlowIn('hr'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&spending=people&lang=hr' },
  },
  { name: 'chat-propose', hash: '#/spending', title: 'Overview', run: chatProposeFlowIn('en'), modes: ['drive'], viewports: DESIGN_REVIEW_VIEWPORTS, queries: { drive: '&spending=people' } },
  {
    name: 'chat-propose-croatian',
    hash: '#/spending',
    title: 'Pregled',
    run: chatProposeFlowIn('hr'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&spending=people&lang=hr' },
  },
  {
    name: 'chat-close-account',
    hash: '#/spending',
    title: 'Overview',
    run: chatCloseAccountFlowIn('en'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&spending=people' },
  },
  {
    name: 'chat-close-account-croatian',
    hash: '#/spending',
    title: 'Pregled',
    run: chatCloseAccountFlowIn('hr'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&spending=people&lang=hr' },
  },
  {
    name: 'spending-flag-person',
    hash: '#/spending/transactions',
    title: 'Entries',
    run: spendingFlagPersonFlowIn('en'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&spending=people' },
  },
  {
    name: 'spending-flag-person-croatian',
    hash: '#/spending/transactions',
    title: 'Unosi',
    run: spendingFlagPersonFlowIn('hr'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&spending=people&lang=hr' },
  },
  { name: 'review-flag-person', hash: '#/company/transactions?tab=review', title: 'Transactions', run: reviewFlagPersonFlowIn('en'), modes: ['drive'], viewports: DESIGN_REVIEW_VIEWPORTS },
  {
    name: 'review-flag-person-croatian',
    hash: '#/company/transactions?tab=review',
    title: 'Transakcije',
    run: reviewFlagPersonFlowIn('hr'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&lang=hr' },
  },
  // The gallery is in English alone, so the chat's Croatian twins open the chat on the Croatian home. The tag has none until a screen tags an element.
  { name: 'chat-tag', hash: '#/gallery', title: 'Gallery', run: chatTagFlowIn('en'), viewports: DESIGN_REVIEW_VIEWPORTS },
  { name: 'chat-attach-photo', hash: '#/gallery', title: 'Gallery', run: chatAttachFlow('photo', CHAT_ATTACHMENT_SAMPLES), modes: ['drive'], viewports: DESIGN_REVIEW_VIEWPORTS },
  {
    name: 'chat-attach-photo-croatian',
    hash: '#/',
    title: 'Sve aplikacije',
    run: chatAttachFlow('photo', CHAT_ATTACHMENT_SAMPLES, 'hr'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&lang=hr' },
  },
  { name: 'chat-attach-pdf', hash: '#/gallery', title: 'Gallery', run: chatAttachFlow('pdf', CHAT_ATTACHMENT_SAMPLES), modes: ['drive'], viewports: DESIGN_REVIEW_VIEWPORTS },
  {
    name: 'chat-attach-pdf-croatian',
    hash: '#/',
    title: 'Sve aplikacije',
    run: chatAttachFlow('pdf', CHAT_ATTACHMENT_SAMPLES, 'hr'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&lang=hr' },
  },
  { name: 'chat-attach-sheet', hash: '#/gallery', title: 'Gallery', run: chatAttachFlow('sheet', CHAT_ATTACHMENT_SAMPLES), modes: ['drive'], viewports: DESIGN_REVIEW_VIEWPORTS },
  {
    name: 'chat-attach-sheet-croatian',
    hash: '#/',
    title: 'Sve aplikacije',
    run: chatAttachFlow('sheet', CHAT_ATTACHMENT_SAMPLES, 'hr'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&lang=hr' },
  },
  { name: 'chat-attach-unsafe', hash: '#/gallery', title: 'Gallery', run: chatAttachUnsafeFlow(CHAT_ATTACHMENT_SAMPLES), modes: ['drive'], viewports: DESIGN_REVIEW_VIEWPORTS },
  {
    name: 'chat-attach-unsafe-croatian',
    hash: '#/',
    title: 'Sve aplikacije',
    run: chatAttachUnsafeFlow(CHAT_ATTACHMENT_SAMPLES, 'hr'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&lang=hr' },
  },
  { name: 'chat-sent-cells', hash: '#/gallery', title: 'Gallery', run: chatSheetSentFlow(CHAT_ATTACHMENT_SAMPLES), modes: ['drive'], viewports: DESIGN_REVIEW_VIEWPORTS },
  {
    name: 'chat-sent-cells-croatian',
    hash: '#/',
    title: 'Sve aplikacije',
    run: chatSheetSentFlow(CHAT_ATTACHMENT_SAMPLES, 'hr'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&lang=hr' },
  },
  { name: 'chat-attach-refused', hash: '#/gallery', title: 'Gallery', run: chatAttachRefusedFlow(CHAT_ATTACHMENT_SAMPLES), modes: ['drive'], viewports: DESIGN_REVIEW_VIEWPORTS },
  {
    name: 'chat-attach-refused-croatian',
    hash: '#/',
    title: 'Sve aplikacije',
    run: chatAttachRefusedFlow(CHAT_ATTACHMENT_SAMPLES, 'hr'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&lang=hr' },
  },
  { name: 'chat-attach-pdf-openrouter', hash: '#/gallery', title: 'Gallery', run: chatAttachPdfOpenRouterFlow(CHAT_ATTACHMENT_SAMPLES), modes: ['drive'], viewports: DESIGN_REVIEW_VIEWPORTS },
  { name: 'chat-attach-drop', hash: '#/gallery', title: 'Gallery', run: chatAttachDropFlow(), modes: ['drive'], viewports: DESIGN_REVIEW_VIEWPORTS },
  {
    name: 'chat-attach-drop-croatian',
    hash: '#/',
    title: 'Sve aplikacije',
    run: chatAttachDropFlow('hr'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&spending=sample&lang=hr' },
  },
  { name: 'chat-question-files', hash: '#/gallery', title: 'Gallery', run: chatQuestionFilesFlow(CHAT_ATTACHMENT_SAMPLES), modes: ['drive'], viewports: DESIGN_REVIEW_VIEWPORTS },
  {
    name: 'chat-question-files-croatian',
    hash: '#/',
    title: 'Sve aplikacije',
    run: chatQuestionFilesFlow(CHAT_ATTACHMENT_SAMPLES, 'hr'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&lang=hr' },
  },
  { name: 'chat-consent-files', hash: '#/gallery', title: 'Gallery', run: chatConsentFilesFlow(CHAT_ATTACHMENT_SAMPLES), modes: ['drive'], viewports: DESIGN_REVIEW_VIEWPORTS },
  {
    name: 'chat-consent-files-croatian',
    hash: '#/',
    title: 'Sve aplikacije',
    run: chatConsentFilesFlow(CHAT_ATTACHMENT_SAMPLES, 'hr'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&lang=hr' },
  },
  { name: 'chat-consent-cells', hash: '#/gallery', title: 'Gallery', run: chatConsentCellsFlow(CHAT_ATTACHMENT_SAMPLES), modes: ['drive'], viewports: DESIGN_REVIEW_VIEWPORTS },
  {
    name: 'chat-consent-cells-croatian',
    hash: '#/',
    title: 'Sve aplikacije',
    run: chatConsentCellsFlow(CHAT_ATTACHMENT_SAMPLES, 'hr'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&lang=hr' },
  },
  { name: 'chat-consent-cells-plain', hash: '#/gallery', title: 'Gallery', run: chatConsentCellsFlow(CHAT_ATTACHMENT_SAMPLES, 'en', false), modes: ['drive'], viewports: DESIGN_REVIEW_VIEWPORTS },
  {
    name: 'chat-consent-cells-plain-croatian',
    hash: '#/',
    title: 'Sve aplikacije',
    run: chatConsentCellsFlow(CHAT_ATTACHMENT_SAMPLES, 'hr', false),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&lang=hr' },
  },
  {
    name: 'chat-statement-card',
    hash: '#/spending/transactions?tab=import',
    title: 'Entries',
    run: chatStatementCardFlowIn('en'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&spending=sample' },
  },
  {
    name: 'chat-statement-card-croatian',
    hash: '#/spending/transactions?tab=import',
    title: 'Unosi',
    run: chatStatementCardFlowIn('hr'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&spending=sample&lang=hr' },
  },
  { name: 'chat-lookup', hash: '#/spending', title: 'Overview', run: chatLookupFlowIn('en'), modes: ['drive'], viewports: DESIGN_REVIEW_VIEWPORTS, queries: { drive: '&spending=statements' } },
  {
    name: 'chat-lookup-croatian',
    hash: '#/spending',
    title: 'Pregled',
    run: chatLookupFlowIn('hr'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&spending=statements&lang=hr' },
  },
  {
    name: 'chat-statement-lookalike',
    hash: '#/spending/transactions?tab=import',
    title: 'Entries',
    run: chatStatementLookAlikeFlowIn('en', 'chat-statement-lookalike'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&spending=statements' },
  },
  {
    name: 'chat-statement-lookalike-croatian',
    hash: '#/spending/transactions?tab=import',
    title: 'Unosi',
    run: chatStatementLookAlikeFlowIn('hr', 'chat-statement-lookalike'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&spending=statements&lang=hr' },
  },
  {
    name: 'company-chat-statement-lookalike',
    hash: '#/company',
    title: 'Overview',
    run: chatStatementLookAlikeFlowIn('en', 'company-chat-statement-lookalike'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
  },
  {
    name: 'company-chat-statement-lookalike-croatian',
    hash: '#/company',
    title: 'Pregled',
    run: chatStatementLookAlikeFlowIn('hr', 'company-chat-statement-lookalike'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&lang=hr' },
  },
  // Spending's ways into the chat: To review's asks, a receipt from Entries and its cards, and the receipt dialog without the assistant.
  {
    name: 'spending-review-ask',
    hash: '#/spending/transactions?tab=review',
    title: 'Entries',
    run: spendingReviewAskFlowIn('en', ['queue']),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&spending=statements' },
  },
  {
    name: 'spending-review-ask-croatian',
    hash: '#/spending/transactions?tab=review',
    title: 'Unosi',
    run: spendingReviewAskFlowIn('hr', ['queue']),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&spending=statements&lang=hr' },
  },
  {
    name: 'spending-review-row-tagged',
    hash: '#/spending/transactions?tab=review',
    title: 'Entries',
    run: spendingReviewAskFlowIn('en', ['row']),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&spending=statements' },
  },
  {
    name: 'spending-review-row-tagged-croatian',
    hash: '#/spending/transactions?tab=review',
    title: 'Unosi',
    run: spendingReviewAskFlowIn('hr', ['row']),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&spending=statements&lang=hr' },
  },
  {
    name: 'spending-receipt-dialog',
    hash: '#/spending/transactions',
    title: 'Entries',
    run: spendingReceiptDialogFlowIn('en', SPENDING_RECEIPT_SAMPLES),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&spending=receipts' },
  },
  {
    name: 'spending-receipt-dialog-croatian',
    hash: '#/spending/transactions',
    title: 'Unosi',
    run: spendingReceiptDialogFlowIn('hr', SPENDING_RECEIPT_SAMPLES),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&spending=receipts&lang=hr' },
  },
  {
    name: 'chat-category-then-receipt',
    hash: '#/spending/transactions',
    title: 'Entries',
    run: chatReceiptFlowIn('en', SPENDING_RECEIPT_SAMPLES),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&spending=receipts' },
  },
  {
    name: 'chat-category-then-receipt-croatian',
    hash: '#/spending/transactions',
    title: 'Unosi',
    run: chatReceiptFlowIn('hr', SPENDING_RECEIPT_SAMPLES),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&spending=receipts&lang=hr' },
  },
  {
    name: 'chat-receipt-card',
    hash: '#/spending/transactions',
    title: 'Entries',
    run: chatReceiptFlowIn('en', SPENDING_RECEIPT_SAMPLES, { accept: true }),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&spending=receipts' },
  },
  {
    name: 'chat-receipt-card-croatian',
    hash: '#/spending/transactions',
    title: 'Unosi',
    run: chatReceiptFlowIn('hr', SPENDING_RECEIPT_SAMPLES, { accept: true }),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&spending=receipts&lang=hr' },
  },
  // The receipt paths beyond a payment that matches: two that may be it, none, one the person picked and split by hand, cash with one, no or two cash accounts, a card payment the bank has not brought yet, and an R1 receipt for the company with Company open and without it.
  ...[
    ['pick', 'receipts'],
    ['none', 'receipts'],
    ['picked', 'receipts'],
    ['cash', 'receipts'],
    ['cash-none', 'foreign'],
    ['cash-several', 'receipts'],
    ['card-waits', 'receipts&banksync=saved'],
    ['r1', 'receipts'],
    ['r1-no-company', 'receipts&fake=empty'],
  ].flatMap(([path, set]) => [
    {
      name: `chat-receipt-${path}`,
      hash: '#/spending/transactions',
      title: 'Entries',
      run: chatReceiptPathFlowIn('en', SPENDING_RECEIPT_SAMPLES, path),
      modes: ['drive'],
      viewports: DESIGN_REVIEW_VIEWPORTS,
      queries: { drive: `&spending=${set}` },
    },
    {
      name: `chat-receipt-${path}-croatian`,
      hash: '#/spending/transactions',
      title: 'Unosi',
      run: chatReceiptPathFlowIn('hr', SPENDING_RECEIPT_SAMPLES, path),
      modes: ['drive'],
      viewports: DESIGN_REVIEW_VIEWPORTS,
      queries: { drive: `&spending=${set}&lang=hr` },
    },
  ]),
  {
    name: 'chat-receipt-row',
    hash: '#/spending/transactions',
    title: 'Entries',
    run: chatReceiptRowFlowIn('en', SPENDING_RECEIPT_SAMPLES),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&spending=receipts' },
  },
  {
    name: 'chat-receipt-row-croatian',
    hash: '#/spending/transactions',
    title: 'Unosi',
    run: chatReceiptRowFlowIn('hr', SPENDING_RECEIPT_SAMPLES),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&spending=receipts&lang=hr' },
  },
  {
    name: 'spending-account-dialog',
    hash: `#/spending/account?account=${SAMPLE_OTP_ACCOUNT}`,
    title: 'OTP current',
    run: spendingAccountDialogFlowIn('en'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&spending=sample' },
  },
  {
    name: 'spending-account-dialog-croatian',
    hash: `#/spending/account?account=${SAMPLE_OTP_ACCOUNT}`,
    title: 'OTP current',
    run: spendingAccountDialogFlowIn('hr'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&spending=sample&lang=hr' },
  },
  {
    name: 'spending-account-start-day',
    hash: `#/spending/account?account=${SAMPLE_OTP_ACCOUNT}`,
    title: 'OTP current',
    run: spendingAccountStartDayFlowIn('en'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&spending=sample' },
  },
  {
    name: 'spending-account-start-day-croatian',
    hash: `#/spending/account?account=${SAMPLE_OTP_ACCOUNT}`,
    title: 'OTP current',
    run: spendingAccountStartDayFlowIn('hr'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&spending=sample&lang=hr' },
  },
  {
    name: 'spending-split',
    hash: '#/spending/transactions',
    title: 'Entries',
    run: spendingSplitFlowIn('en'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&spending=sample' },
  },
  {
    name: 'spending-split-croatian',
    hash: '#/spending/transactions',
    title: 'Unosi',
    run: spendingSplitFlowIn('hr'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&spending=sample&lang=hr' },
  },
  {
    name: 'chat-split-card',
    hash: '#/spending/transactions',
    title: 'Entries',
    run: chatSplitFlowIn('en'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&spending=sample' },
  },
  {
    name: 'chat-split-card-croatian',
    hash: '#/spending/transactions',
    title: 'Unosi',
    run: chatSplitFlowIn('hr'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&spending=sample&lang=hr' },
  },
  {
    name: 'chat-receipt-joins',
    hash: '#/spending/transactions',
    title: 'Entries',
    run: chatReceiptFlowIn('en', SPENDING_RECEIPT_SAMPLES, { joins: true }),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&spending=receipts' },
  },
  {
    name: 'chat-receipt-joins-croatian',
    hash: '#/spending/transactions',
    title: 'Unosi',
    run: chatReceiptFlowIn('hr', SPENDING_RECEIPT_SAMPLES, { joins: true }),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&spending=receipts&lang=hr' },
  },
  // Company's ways into the chat and its cards, and Kuna's theme card.
  {
    name: 'company-review-ask',
    hash: '#/company/transactions?tab=review',
    title: 'Transactions',
    run: companyReviewAskFlowIn('en'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
  },
  {
    name: 'company-review-ask-croatian',
    hash: '#/company/transactions?tab=review',
    title: 'Transakcije',
    run: companyReviewAskFlowIn('hr'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&lang=hr' },
  },
  {
    name: 'company-chat-invoice',
    hash: '#/company',
    title: 'Overview',
    run: companyChatCardFlowIn('en', 'invoice'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
  },
  {
    name: 'company-chat-invoice-croatian',
    hash: '#/company',
    title: 'Pregled',
    run: companyChatCardFlowIn('hr', 'invoice'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&lang=hr' },
  },
  {
    name: 'company-chat-currency',
    hash: '#/company',
    title: 'Overview',
    run: companyChatCardFlowIn('en', 'currency'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
  },
  {
    name: 'company-chat-currency-croatian',
    hash: '#/company',
    title: 'Pregled',
    run: companyChatCardFlowIn('hr', 'currency'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&lang=hr' },
  },
  {
    name: 'company-chat-refile',
    hash: '#/company',
    title: 'Overview',
    run: companyChatCardFlowIn('en', 'refile'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
  },
  {
    name: 'company-chat-refile-croatian',
    hash: '#/company',
    title: 'Pregled',
    run: companyChatCardFlowIn('hr', 'refile'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&lang=hr' },
  },
  {
    name: 'company-chat-move',
    hash: '#/company',
    title: 'Overview',
    run: companyChatCardFlowIn('en', 'move'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
  },
  {
    name: 'company-chat-move-croatian',
    hash: '#/company',
    title: 'Pregled',
    run: companyChatCardFlowIn('hr', 'move'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&lang=hr' },
  },
  {
    name: 'company-chat-category',
    hash: '#/company',
    title: 'Overview',
    run: companyChatCardFlowIn('en', 'category'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
  },
  {
    name: 'company-chat-category-croatian',
    hash: '#/company',
    title: 'Pregled',
    run: companyChatCardFlowIn('hr', 'category'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&lang=hr' },
  },
  {
    name: 'company-chat-donation',
    hash: '#/company',
    title: 'Overview',
    run: companyChatCardFlowIn('en', 'donation'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
  },
  {
    name: 'company-chat-donation-croatian',
    hash: '#/company',
    title: 'Pregled',
    run: companyChatCardFlowIn('hr', 'donation'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&lang=hr' },
  },
  {
    name: 'year-pd-donations',
    hash: '#/company/year',
    title: 'Year',
    run: yearDonationsFlowIn('en'),
    modes: ['browser'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { browser: '&fake=browser-donations' },
  },
  {
    name: 'year-pd-donations-croatian',
    hash: '#/company/year',
    title: 'Godina',
    run: yearDonationsFlowIn('hr'),
    modes: ['browser'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { browser: '&fake=browser-donations&lang=hr' },
  },
  {
    name: 'company-settings-categories-donations',
    hash: '#/company/settings?tab=categories',
    title: 'Settings',
    run: categoriesDonationsFlowIn('en'),
    modes: ['browser'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { browser: '&fake=browser-donations' },
  },
  {
    name: 'company-settings-categories-donations-croatian',
    hash: '#/company/settings?tab=categories',
    title: 'Postavke',
    run: categoriesDonationsFlowIn('hr'),
    modes: ['browser'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { browser: '&fake=browser-donations&lang=hr' },
  },
  {
    name: 'company-chat-merge',
    hash: '#/company',
    title: 'Overview',
    run: companyChatCardFlowIn('en', 'merge'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&fake=category-move' },
  },
  {
    name: 'trips-chat-cost',
    hash: '#/company/trips',
    title: 'Trips',
    run: companyChatCardFlowIn('en', 'trip-cost'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&fake=one-employee' },
  },
  {
    name: 'trips-chat-cost-croatian',
    hash: '#/company/trips',
    title: 'Putni nalozi',
    run: companyChatCardFlowIn('hr', 'trip-cost'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&fake=one-employee&lang=hr' },
  },
  {
    name: 'company-chat-merge-croatian',
    hash: '#/company',
    title: 'Pregled',
    run: companyChatCardFlowIn('hr', 'merge'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&fake=category-move&lang=hr' },
  },
  {
    name: 'kuna-chat-theme',
    hash: '#/',
    title: 'All apps',
    run: kunaChatThemeFlowIn('en'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
  },
  {
    name: 'kuna-chat-theme-croatian',
    hash: '#/',
    title: 'Sve aplikacije',
    run: kunaChatThemeFlowIn('hr'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&lang=hr' },
  },
  {
    name: 'company-chat-anonymise',
    hash: '#/company/salaries',
    title: 'Salaries',
    run: companyChatAnonymiseFlowIn('en'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&fake=five-employees' },
  },
  {
    name: 'company-chat-anonymise-croatian',
    hash: '#/company/salaries',
    title: 'Plaće',
    run: companyChatAnonymiseFlowIn('hr'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&fake=five-employees&lang=hr' },
  },
  // Loans', Investments' and Assets' cards in the chat.
  {
    name: 'chat-offer-card',
    hash: '#/loans/scenarios',
    title: 'Scenarios',
    run: appChatCardFlowIn('en', 'offer'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&loans=sample' },
  },
  {
    name: 'chat-offer-card-croatian',
    hash: '#/loans/scenarios',
    title: 'Scenariji',
    run: appChatCardFlowIn('hr', 'offer'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&loans=sample&lang=hr' },
  },
  {
    name: 'loans-chat-bank-loan',
    hash: '#/loans',
    title: 'Overview',
    run: appChatCardFlowIn('en', 'contract'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&loans=sample' },
  },
  {
    name: 'loans-chat-bank-loan-croatian',
    hash: '#/loans',
    title: 'Pregled',
    run: appChatCardFlowIn('hr', 'contract'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&loans=sample&lang=hr' },
  },
  {
    name: 'loans-chat-extra-payment',
    hash: '#/loans',
    title: 'Overview',
    run: appChatCardFlowIn('en', 'extra'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&loans=sample' },
  },
  {
    name: 'loans-chat-extra-payment-croatian',
    hash: '#/loans',
    title: 'Pregled',
    run: appChatCardFlowIn('hr', 'extra'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&loans=sample&lang=hr' },
  },
  {
    name: 'investments-chat-trade',
    hash: '#/investments',
    title: 'Overview',
    run: appChatCardFlowIn('en', 'buy'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&investments=partial-history' },
  },
  {
    name: 'investments-chat-trade-croatian',
    hash: '#/investments',
    title: 'Pregled',
    run: appChatCardFlowIn('hr', 'buy'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&investments=partial-history&lang=hr' },
  },
  {
    name: 'spending-chat-revolut-copy',
    hash: '#/spending',
    title: 'Overview',
    run: appChatCardFlowIn('en', 'revolut', CHAT_ATTACHMENT_SAMPLES),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&spending=sample' },
  },
  {
    name: 'spending-chat-revolut-copy-croatian',
    hash: '#/spending',
    title: 'Pregled',
    run: appChatCardFlowIn('hr', 'revolut', CHAT_ATTACHMENT_SAMPLES),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&spending=sample&lang=hr' },
  },
  {
    name: 'investments-chat-copy',
    hash: '#/investments',
    title: 'Overview',
    run: appChatCardFlowIn('en', 'copy'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&investments=partial-history' },
  },
  {
    name: 'investments-chat-copy-croatian',
    hash: '#/investments',
    title: 'Pregled',
    run: appChatCardFlowIn('hr', 'copy'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&investments=partial-history&lang=hr' },
  },
  {
    name: 'investments-chat-file-copy',
    hash: '#/investments',
    title: 'Overview',
    run: appChatCardFlowIn('en', 'file', CHAT_ATTACHMENT_SAMPLES),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&investments=partial-history' },
  },
  {
    name: 'investments-chat-file-copy-croatian',
    hash: '#/investments',
    title: 'Pregled',
    run: appChatCardFlowIn('hr', 'file', CHAT_ATTACHMENT_SAMPLES),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&investments=partial-history&lang=hr' },
  },
  {
    name: 'company-chat-statement-zero',
    hash: '#/company',
    title: 'Overview',
    run: appChatCardFlowIn('en', 'zero'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&fake=no-ledger' },
  },
  {
    name: 'company-chat-statement-zero-croatian',
    hash: '#/company',
    title: 'Pregled',
    run: appChatCardFlowIn('hr', 'zero'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&fake=no-ledger&lang=hr' },
  },
  {
    name: 'assets-chat-valuation',
    hash: '#/assets',
    title: 'Overview',
    run: appChatCardFlowIn('en', 'valuation'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&assets=sample&loans=sample' },
  },
  {
    name: 'assets-chat-valuation-croatian',
    hash: '#/assets',
    title: 'Pregled',
    run: appChatCardFlowIn('hr', 'valuation'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&assets=sample&loans=sample&lang=hr' },
  },
  { name: 'page-tabs', hash: '#/company/settings', title: 'Settings', run: pageTabsFlow },
  { name: 'year-tab-link', hash: '#/company/year?tab=statements', title: 'Year', run: yearTabLinkFlow },
  { name: 'page-tabs-croatian', hash: '#/company/settings', title: 'Postavke', run: pageTabsFlowIn('hr'), queries: { drive: '&lang=hr', browser: '&fake=browser&lang=hr' } },
  { name: 'year-tab-link-croatian', hash: '#/company/year?tab=statements', title: 'Godina', run: yearTabLinkFlowIn('hr'), queries: { drive: '&lang=hr', browser: '&fake=browser&lang=hr' } },
  { name: 'categories', hash: '#/company/settings?tab=categories', title: 'Settings', run: categoryFlow },
  { name: 'categories-filters', hash: '#/company/settings?tab=categories', title: 'Settings', run: categoryFiltersFlow },
  {
    name: 'category-move',
    hash: '#/company/settings?tab=categories',
    title: 'Settings',
    run: categoryMoveFlow,
    viewports: ['phone', 'phone-large', 'tablet', 'tablet-wide', 'desktop'],
    queries: { drive: '&fake=category-move', browser: '&fake=browser-category-move' },
  },
  {
    name: 'category-move-croatian',
    hash: '#/company/settings?tab=categories',
    title: 'Postavke',
    run: categoryMoveFlowIn('hr'),
    viewports: ['phone', 'phone-large', 'tablet', 'tablet-wide', 'desktop'],
    queries: { drive: '&fake=category-move&lang=hr', browser: '&fake=browser-category-move&lang=hr' },
  },
  {
    name: 'rule-waiting-croatian',
    hash: '#/company/transactions?tab=review',
    title: 'Transakcije',
    run: ruleWaitingFlowIn('hr'),
    viewports: ['phone'],
    queries: { drive: '&lang=hr', browser: '&fake=browser&lang=hr' },
  },
  {
    name: 'categories-croatian',
    hash: '#/company/settings?tab=categories',
    title: 'Postavke',
    run: categoryFlowIn('hr'),
    viewports: ['phone', 'tablet', 'desktop'],
    queries: { drive: '&lang=hr', browser: '&fake=browser&lang=hr' },
  },
  {
    name: 'categories-filters-croatian',
    hash: '#/company/settings?tab=categories',
    title: 'Postavke',
    run: categoryFiltersFlowIn('hr'),
    viewports: ['phone', 'tablet', 'desktop'],
    queries: { drive: '&lang=hr', browser: '&fake=browser&lang=hr' },
  },
  { name: 'settings-statements-folder', hash: '#/company/settings', title: 'Settings', run: statementsFolderFlow },
  {
    name: 'settings-statements-folder-croatian',
    hash: '#/company/settings',
    title: 'Postavke',
    run: statementsFolderFlowIn('hr'),
    queries: { drive: '&lang=hr', browser: '&fake=browser&lang=hr' },
  },
  { name: 'settings-card-ibans', hash: '#/company/settings', title: 'Settings', run: cardSettlementIbansFlow },
  {
    name: 'settings-card-ibans-croatian',
    hash: '#/company/settings',
    title: 'Postavke',
    run: cardSettlementIbansFlowIn('hr'),
    viewports: ['phone', 'tablet', 'desktop'],
    queries: { drive: '&lang=hr', browser: '&fake=browser&lang=hr' },
  },
  { name: 'clients-ibans', hash: '#/company/invoicing?tab=clients', title: 'Invoicing', run: clientIbansFlow },
  { name: 'assets', hash: '#/company/year?tab=assets#asset-rows', title: 'Year', run: assetFlow },
  { name: 'employees', hash: '#/company/salaries#employee-rows', title: 'Salaries', run: employeeFlow },
  { name: 'advances', hash: '#/company/owner?tab=owed', title: 'Owner', run: advanceFlow },
  {
    name: 'assets-croatian',
    hash: '#/company/year?tab=assets#asset-rows',
    title: 'Godina',
    run: assetFlowIn('hr'),
    viewports: ['phone', 'tablet', 'desktop'],
    queries: { drive: '&lang=hr', browser: '&fake=browser&lang=hr' },
  },
  {
    name: 'employees-croatian',
    hash: '#/company/salaries#employee-rows',
    title: 'Plaće',
    run: employeeFlowIn('hr'),
    viewports: ['phone', 'tablet', 'desktop'],
    queries: { drive: '&lang=hr', browser: '&fake=browser&lang=hr' },
  },
  {
    name: 'advances-croatian',
    hash: '#/company/owner?tab=owed',
    title: 'Vlasnik',
    run: advanceFlowIn('hr'),
    viewports: ['phone', 'tablet', 'desktop'],
    queries: { drive: '&lang=hr', browser: '&fake=browser&lang=hr' },
  },
  { name: 'invoices', hash: '#/company/invoicing?p=all', title: 'Invoicing', run: invoiceFlow },
  { name: 'invoice-run', hash: '#/company/invoicing?p=all', title: 'Invoicing', run: invoiceRunFlow },
  {
    name: 'clients-ibans-croatian',
    hash: '#/company/invoicing?tab=clients',
    title: 'Računi',
    run: clientIbansFlowIn('hr'),
    viewports: ['phone', 'tablet', 'desktop'],
    queries: { drive: '&lang=hr', browser: '&fake=browser&lang=hr' },
  },
  {
    name: 'invoices-croatian',
    hash: '#/company/invoicing?p=all',
    title: 'Računi',
    run: invoiceFlowIn('hr'),
    viewports: ['phone', 'tablet', 'desktop'],
    queries: { drive: '&lang=hr', browser: '&fake=browser&lang=hr' },
  },
  {
    name: 'invoice-run-croatian',
    hash: '#/company/invoicing?p=all',
    title: 'Računi',
    run: invoiceRunFlowIn('hr'),
    viewports: ['phone', 'tablet', 'desktop'],
    queries: { drive: '&lang=hr', browser: '&fake=browser&lang=hr' },
  },
  {
    name: 'dialogs-invoicing-croatian',
    hash: '#/company/invoicing?p=all',
    title: 'Računi',
    run: invoicingDialogsFlowIn('hr'),
    viewports: ['phone', 'tablet', 'desktop'],
    queries: { drive: '&lang=hr', browser: '&fake=browser&lang=hr' },
  },
  { name: 'scenarios', hash: '#/company/year?year=2027&tab=pay', title: 'Year', run: scenarioFlow, viewports: ['phone', 'phone-large', 'desktop'] },
  {
    name: 'starting-scenarios',
    hash: '#/company/year?year=2027&tab=pay',
    title: 'Year',
    run: startingScenariosFlow,
    viewports: ['phone', 'phone-large', 'desktop'],
    queries: { drive: '&fake=no-scenarios', browser: '&fake=browser-no-scenarios' },
  },
  { name: 'plan', hash: '#/company/year?year=2027&tab=plan', title: 'Year', run: planFlow, viewports: ['phone', 'phone-large', 'desktop'] },
  {
    name: 'plan-tab',
    hash: '#/company/year?year=2027&tab=plan',
    title: 'Year',
    run: planTabFlow,
    viewports: ['phone', 'phone-large', 'desktop'],
    queries: { drive: '&fake=no-plan', browser: '&fake=browser-no-plan' },
  },
  {
    name: 'scenarios-croatian',
    hash: '#/company/year?year=2027&tab=pay',
    title: 'Godina',
    run: scenarioFlowIn('hr'),
    viewports: ['phone', 'tablet', 'desktop'],
    queries: { drive: '&lang=hr', browser: '&fake=browser&lang=hr' },
  },
  {
    name: 'starting-scenarios-croatian',
    hash: '#/company/year?year=2027&tab=pay',
    title: 'Godina',
    run: startingScenariosFlowIn('hr'),
    viewports: ['phone', 'tablet', 'desktop'],
    queries: { drive: '&fake=no-scenarios&lang=hr', browser: '&fake=browser-no-scenarios&lang=hr' },
  },
  {
    name: 'plan-croatian',
    hash: '#/company/year?year=2027&tab=plan',
    title: 'Godina',
    run: planFlowIn('hr'),
    viewports: ['phone', 'tablet', 'desktop'],
    queries: { drive: '&lang=hr', browser: '&fake=browser&lang=hr' },
  },
  {
    name: 'plan-tab-croatian',
    hash: '#/company/year?year=2027&tab=plan',
    title: 'Godina',
    run: planTabFlowIn('hr'),
    viewports: ['phone', 'tablet', 'desktop'],
    queries: { drive: '&fake=no-plan&lang=hr', browser: '&fake=browser-no-plan&lang=hr' },
  },
  { name: 'split', hash: '#/company/transactions?p=all&q=GADGET', title: 'Transactions', run: splitFlow, viewports: DESIGN_REVIEW_VIEWPORTS },
  { name: 'split-review', hash: '#/company/transactions?tab=review', title: 'Transactions', run: reviewSplitFlow, viewports: ['phone', 'phone-large', 'desktop'] },
  { name: 'change-category', hash: '#/company/transactions?p=all&q=CODE%20HOST', title: 'Transactions', run: changeCategoryFlow },
  {
    name: 'split-croatian',
    hash: '#/company/transactions?p=all&q=GADGET',
    title: 'Transakcije',
    run: splitFlowIn('hr'),
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&lang=hr', browser: '&fake=browser&lang=hr' },
  },
  {
    name: 'split-refused',
    hash: '#/company/transactions?p=2026-03-16..2026-03-16&q=Pixel%20Studio',
    title: 'Transactions',
    run: refusedSplitFlowIn('en', 'refused'),
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&fake=refused-splits', browser: '&fake=browser-refused-splits' },
  },
  {
    name: 'split-refused-croatian',
    hash: '#/company/transactions?p=2026-03-16..2026-03-16&q=Pixel%20Studio',
    title: 'Transakcije',
    run: refusedSplitFlowIn('hr', 'refused'),
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&fake=refused-splits&lang=hr', browser: '&fake=browser-refused-splits&lang=hr' },
  },
  {
    name: 'split-unreadable',
    hash: '#/company/transactions?p=2026-05-10..2026-05-10&q=BISTRO',
    title: 'Transactions',
    run: refusedSplitFlowIn('en', 'unreadable'),
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&fake=refused-splits', browser: '&fake=browser-refused-splits' },
  },
  {
    name: 'split-unreadable-croatian',
    hash: '#/company/transactions?p=2026-05-10..2026-05-10&q=BISTRO',
    title: 'Transakcije',
    run: refusedSplitFlowIn('hr', 'unreadable'),
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&fake=refused-splits&lang=hr', browser: '&fake=browser-refused-splits&lang=hr' },
  },
  {
    name: 'split-review-croatian',
    hash: '#/company/transactions?tab=review',
    title: 'Transakcije',
    run: reviewSplitFlowIn('hr'),
    viewports: ['phone', 'tablet', 'desktop'],
    queries: { drive: '&lang=hr', browser: '&fake=browser&lang=hr' },
  },
  {
    name: 'row-ids',
    hash: '#/company',
    title: 'Overview',
    run: rowIdsFlow,
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&fake=no-row-ids', browser: '&fake=browser-no-row-ids' },
  },
  {
    name: 'row-ids-croatian',
    hash: '#/company',
    title: 'Pregled',
    run: rowIdsFlowIn('hr'),
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&fake=no-row-ids&lang=hr', browser: '&fake=browser-no-row-ids&lang=hr' },
  },
  {
    name: 'change-category-croatian',
    hash: '#/company/transactions?p=all&q=CODE%20HOST',
    title: 'Transakcije',
    run: changeCategoryFlowIn('hr'),
    viewports: ['phone', 'tablet', 'desktop'],
    queries: { drive: '&lang=hr', browser: '&fake=browser&lang=hr' },
  },
  { name: 'owner-share', hash: '#/company/transactions?p=all&q=purchase%2C%20laptop', title: 'Transactions', run: ownerShareFlow },
  {
    name: 'owner-share-croatian',
    hash: '#/company/transactions?p=all&q=purchase%2C%20laptop',
    title: 'Transakcije',
    run: ownerShareFlowIn('hr'),
    viewports: ['phone', 'tablet', 'desktop'],
    queries: { drive: '&lang=hr', browser: '&fake=browser&lang=hr' },
  },
  { name: 'owner-net', hash: '#/company/owner?p=2026', title: 'Owner', run: ownerNetFlow, viewports: ['phone', 'phone-large', 'desktop'], modes: ['browser'] },
  {
    name: 'owner-net-unregistered',
    hash: '#/company/owner?p=2026',
    title: 'Owner',
    run: ownerNetUnregisteredFlow,
    viewports: ['phone', 'phone-large', 'desktop'],
    modes: ['drive'],
    queries: { drive: '&fake=unregistered' },
  },
  {
    name: 'owner-net-unregistered-croatian',
    hash: '#/company/owner?p=2026',
    title: 'Vlasnik',
    run: ownerNetUnregisteredFlowIn('hr'),
    viewports: ['phone', 'phone-large', 'desktop'],
    modes: ['drive'],
    queries: { drive: '&fake=unregistered&lang=hr' },
  },
  {
    name: 'owner-net-croatian',
    hash: '#/company/owner?p=2026',
    title: 'Vlasnik',
    run: buildUpFlowIn('hr', '[data-testid="owner-net-with-profit"] [data-testid="build-up-button"]'),
    modes: ['browser'],
    queries: { browser: '&fake=browser&lang=hr' },
  },
  { name: 'share-fill', hash: '#/company/settings?tab=categories', title: 'Settings', run: shareFillFlow },
  {
    name: 'share-fill-croatian',
    hash: '#/company/settings?tab=categories',
    title: 'Postavke',
    run: shareFillFlowIn('hr'),
    viewports: ['phone', 'tablet', 'desktop'],
    queries: { drive: '&lang=hr', browser: '&fake=browser&lang=hr' },
  },
  { name: 'dismiss', hash: '#/company/settings?tab=category-rules', title: 'Settings', run: dismissFlow, viewports: ['phone', 'phone-large', 'desktop'] },
  { name: 'rules-editor', hash: '#/company/settings?tab=category-rules', title: 'Settings', run: rulesEditorFlow },
  {
    name: 'dismiss-croatian',
    hash: '#/company/settings?tab=category-rules',
    title: 'Postavke',
    run: dismissFlowIn('hr'),
    viewports: ['phone', 'tablet', 'desktop'],
    queries: { drive: '&lang=hr', browser: '&fake=browser&lang=hr' },
  },
  {
    name: 'rules-editor-croatian',
    hash: '#/company/settings?tab=category-rules',
    title: 'Postavke',
    run: rulesEditorFlowIn('hr'),
    viewports: ['phone', 'tablet', 'desktop'],
    queries: { drive: '&lang=hr', browser: '&fake=browser&lang=hr' },
  },
  { name: 'import-camt', hash: '#/company/transactions?tab=import', title: 'Transactions', run: importCamtFlow(IMPORT_SAMPLES.camt), viewports: ['phone', 'phone-large', 'desktop'] },
  { name: 'import-table', hash: '#/company/transactions?tab=import', title: 'Transactions', run: importTableFlow(IMPORT_SAMPLES.table), viewports: ['phone', 'phone-large', 'desktop'] },
  ...[
    { name: 'import-camt-croatian', run: importCamtFlowIn('hr', IMPORT_SAMPLES.camt) },
    { name: 'import-table-croatian', run: importTableFlowIn('hr', IMPORT_SAMPLES.table) },
  ].map(({ name, run }) => ({
    name,
    hash: '#/company/transactions?tab=import',
    title: 'Transakcije',
    run,
    viewports: ['phone', 'phone-large', 'desktop'],
    queries: { drive: '&lang=hr', browser: '&fake=browser&lang=hr' },
  })),
  {
    name: 'import-camt-lookalike',
    hash: '#/company/transactions?tab=import',
    title: 'Transactions',
    run: importCamtLookAlikeFlowIn('en', IMPORT_SAMPLES.camt),
    viewports: DESIGN_REVIEW_VIEWPORTS,
    modes: ['drive'],
    queries: { drive: '&fake=copied' },
  },
  {
    name: 'import-camt-lookalike-croatian',
    hash: '#/company/transactions?tab=import',
    title: 'Transakcije',
    run: importCamtLookAlikeFlowIn('hr', IMPORT_SAMPLES.camt),
    viewports: DESIGN_REVIEW_VIEWPORTS,
    modes: ['drive'],
    queries: { drive: '&fake=copied&lang=hr' },
  },
  { name: 'statements-sync', hash: '#/company', title: 'Overview', run: statementSyncFlow, modes: ['drive'] },
  { name: 'statements-held', hash: '#/company', title: 'Overview', run: heldStatementFlow, modes: ['drive'], queries: { drive: '&fake=held-statement' } },
  {
    name: 'statements-held-croatian',
    hash: '#/company',
    title: 'Pregled',
    run: heldStatementFlowIn('hr'),
    viewports: ['phone', 'tablet', 'desktop'],
    modes: ['drive'],
    queries: { drive: '&fake=held-statement&lang=hr' },
  },
  {
    name: 'import-files-croatian',
    hash: '#/company/transactions?tab=import',
    title: 'Transakcije',
    run: importFlowIn('hr', IMPORT_SAMPLES),
    viewports: ['phone', 'tablet', 'desktop'],
    queries: { drive: '&lang=hr', browser: '&fake=browser&lang=hr' },
  },
  {
    name: 'mail-list-croatian',
    hash: '#/company',
    title: 'Pregled',
    run: mailListFlowIn('hr'),
    viewports: ['phone', 'tablet', 'desktop'],
    modes: ['drive'],
    queries: { drive: '&fake=mail&lang=hr' },
  },
  {
    name: 'dialogs-data-source-croatian',
    hash: '#/company/settings?tab=books',
    title: 'Postavke',
    run: dataSourceDialogsFlowIn('hr', IMPORT_FILE),
    viewports: ['phone', 'tablet', 'desktop'],
    modes: ['browser'],
    queries: { browser: '&fake=browser&lang=hr' },
  },
  { name: 'statements-access', hash: '#/company', title: 'Overview', run: statementAccessFlow, modes: ['drive'] },
  { name: 'sync-running', hash: '#/company', title: 'Overview', run: syncRunningFlow, modes: ['drive'], queries: { drive: '&fake=slow-statements' } },
  {
    name: 'saves-waiting',
    hash: '#/company/settings',
    title: 'Settings',
    run: savesWaitingFlow,
    viewports: ['phone', 'small-tablet', 'tablet-wide', 'desktop'],
    modes: ['drive'],
    queries: { drive: '&fake=slow-writes' },
  },
  {
    name: 'saves-waiting-croatian',
    hash: '#/company/settings',
    title: 'Postavke',
    run: savesWaitingFlow,
    viewports: ['phone', 'small-tablet', 'tablet-wide', 'desktop'],
    modes: ['drive'],
    queries: { drive: '&fake=slow-writes&lang=hr' },
  },
  {
    name: 'saves-waiting-benchmark',
    hash: '#/investments/settings',
    title: 'Settings',
    run: savesWaitingBenchmarkFlow,
    viewports: ['phone', 'small-tablet', 'tablet-wide', 'desktop'],
    modes: ['drive'],
    queries: { drive: '&fake=slow-writes&investments=sample' },
  },
  {
    name: 'saves-waiting-benchmark-croatian',
    hash: '#/investments/settings',
    title: 'Postavke',
    run: savesWaitingBenchmarkFlow,
    viewports: ['phone', 'small-tablet', 'tablet-wide', 'desktop'],
    modes: ['drive'],
    queries: { drive: '&fake=slow-writes&investments=sample&lang=hr' },
  },
  {
    name: 'save-fails',
    hash: '#/company/settings',
    title: 'Settings',
    run: saveFailsFlow,
    viewports: ['phone', 'small-tablet', 'tablet-wide', 'desktop'],
    modes: ['drive'],
    queries: { drive: '&fake=save-fails' },
  },
  {
    name: 'save-fails-croatian',
    hash: '#/company/settings',
    title: 'Postavke',
    run: saveFailsFlow,
    viewports: ['phone', 'small-tablet', 'tablet-wide', 'desktop'],
    modes: ['drive'],
    queries: { drive: '&fake=save-fails&lang=hr' },
  },
  { name: 'mail-off', hash: '#/company', title: 'Overview', run: mailOffFlow, modes: ['drive'] },
  { name: 'mail-filed', hash: '#/company', title: 'Overview', run: mailFiledFlow, modes: ['drive'], queries: { drive: '&fake=mail' } },
  { name: 'mail-upload-failed', hash: '#/company', title: 'Overview', run: mailUploadFailedFlow, modes: ['drive'], queries: { drive: '&fake=mail-upload-failed' } },
  { name: 'mail-nothing-new', hash: '#/company', title: 'Overview', run: mailNothingNewFlow, modes: ['drive'], queries: { drive: '&fake=mail-nothing-new' } },
  { name: 'mail-failed', hash: '#/company', title: 'Overview', run: mailFailedFlow, modes: ['drive'], queries: { drive: '&fake=mail-failed' } },
  { name: 'mail-access', hash: '#/company', title: 'Overview', run: mailAccessFlow, modes: ['drive'], queries: { drive: '&fake=mail' } },
  { name: 'mail-save-asks', hash: '#/company', title: 'Overview', run: mailSaveAsksFlow, modes: ['drive'] },
  { name: 'mail-save-asks-croatian', hash: '#/company', title: 'Pregled', run: mailSaveAsksFlowIn('hr'), modes: ['drive'], queries: { drive: '&lang=hr' } },
  { name: 'mail-plan-specimen', hash: '#/gallery', title: 'Gallery', run: mailPlanSpecimenFlow, modes: ['drive'] },
  { name: 'mail-rate-limited', hash: '#/company', title: 'Overview', run: mailRateLimitedFlow, modes: ['drive'], queries: { drive: '&fake=mail-rate-limited' } },
  { name: 'set-up-in-other-tab', hash: '#/', title: 'All apps', run: setUpInOtherTabFlow, modes: ['drive'] },
  { name: 'mail-window', hash: '#/company', title: 'Overview', run: mailWindowFlow, modes: ['drive'], queries: { drive: '&fake=mail-nothing-new' } },
  { name: 'sync-access-closed', hash: '#/company', title: 'Overview', run: accessClosedFlow, modes: ['drive'], queries: { drive: '&fake=google-closed' } },
  ...[
    { name: 'statements-sync-croatian', variant: '' },
    { name: 'statements-access-croatian', variant: '', stored: { 'kuna.google-granted': JSON.stringify(['drive.file', 'gmail.compose']) } },
    { name: 'sync-running-croatian', variant: '&fake=slow-statements' },
    { name: 'mail-off-croatian', variant: '', stored: { 'kuna.google-granted': null, 'kuna.google-needed': null } },
    { name: 'mail-upload-failed-croatian', variant: '&fake=mail-upload-failed' },
    { name: 'mail-nothing-new-croatian', variant: '&fake=mail-nothing-new' },
    { name: 'mail-failed-croatian', variant: '&fake=mail-failed' },
    { name: 'mail-access-croatian', variant: '&fake=mail', stored: { 'kuna.google-granted': JSON.stringify(['drive.file', 'drive.readonly', 'gmail.compose']) } },
    { name: 'mail-rate-limited-croatian', variant: '&fake=mail-rate-limited' },
    { name: 'sync-access-closed-croatian', variant: '&fake=google-closed', stored: { 'kuna.google-silent-refused': 'interaction_required' } },
  ].map(({ name, variant, stored }) => ({ name, hash: '#/company', title: 'Pregled', run: syncStatesFlowIn('hr', stored), modes: ['drive'], queries: { drive: `${variant}&lang=hr` } })),
  { name: 'salaries', hash: '#/company/salaries', title: 'Salaries', run: salariesFlow, modes: ['drive'], queries: { drive: '&fake=five-employees' } },
  { name: 'salaries-flow-croatian', hash: '#/company/salaries', title: 'Plaće', run: salariesFlowIn('hr'), modes: ['drive'], queries: { drive: '&fake=five-employees&lang=hr' } },
  { name: 'trips', hash: '#/company/trips', title: 'Trips', run: tripsFlow, modes: ['drive'], viewports: DESIGN_REVIEW_VIEWPORTS, queries: { drive: '&fake=one-employee' } },
  {
    name: 'trips-croatian',
    hash: '#/company/trips',
    title: 'Putni nalozi',
    run: tripsFlowIn('hr'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&fake=one-employee&lang=hr' },
  },
  ...['en', 'hr'].map((language) => ({
    name: language === 'en' ? 'trips-overpaid-filing' : 'trips-overpaid-filing-croatian',
    hash: '#/company/trips?trip=00000000-0000-4000-8000-002000000003&tab=settlement',
    title: language === 'en' ? 'Travel order 2/2026' : 'Putni nalog 2/2026',
    run: overpaidFilingFlowIn(language),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: `&fake=one-employee-overpaid${language === 'en' ? '' : '&lang=hr'}` },
  })),
  { name: 'onboarding-drive', hash: '#/company/start', title: 'Company', run: onboardingDriveFlow, modes: ['drive'], queries: { drive: '&fake=empty' } },
  { name: 'onboarding-pack', hash: '#/company/start', title: 'Company', run: onboardingPackFlow, modes: ['drive'], queries: { drive: '&fake=empty' } },
  { name: 'onboarding-delivery', hash: '#/company/start', title: 'Company', run: onboardingDeliveryFlow, modes: ['drive'], queries: { drive: '&fake=empty' } },
  { name: 'kuna-welcome', hash: '#/', title: 'Welcome to Kuna', run: kunaWelcomeFlow, modes: ['drive'], queries: { drive: '&fake=empty' } },
  { name: 'kuna-welcome-browser', hash: '#/', title: 'Welcome to Kuna', run: kunaWelcomeBrowserFlow, modes: ['drive'], queries: { drive: '&fake=empty' } },
  { name: 'kuna-welcome-croatian', hash: '#/', title: 'Dobrodošli u Kunu', run: kunaWelcomeFlowIn('hr'), modes: ['drive'], queries: { drive: '&fake=empty&lang=hr' } },
  {
    name: 'kuna-welcome-ai',
    viewports: ['phone', 'small-tablet', 'tablet-wide', 'desktop'],
    hash: '#/',
    title: 'Welcome to Kuna',
    run: kunaWelcomeAiFlowIn('en'),
    modes: ['drive'],
    queries: { drive: '&fake=empty' },
  },
  {
    name: 'kuna-welcome-ai-croatian',
    viewports: ['phone', 'small-tablet', 'tablet-wide', 'desktop'],
    hash: '#/',
    title: 'Dobrodošli u Kunu',
    run: kunaWelcomeAiFlowIn('hr'),
    modes: ['drive'],
    queries: { drive: '&fake=empty&lang=hr' },
  },
  {
    name: 'kuna-welcome-ai-refused',
    viewports: ['phone', 'small-tablet', 'tablet-wide', 'desktop'],
    hash: '#/',
    title: 'Welcome to Kuna',
    run: kunaWelcomeAiRefusedFlowIn('en'),
    modes: ['drive'],
    queries: { drive: '&fake=empty&ai=key-refused' },
  },
  { name: 'kuna-welcome-ai-unfinished', hash: '#/', title: 'Welcome to Kuna', run: kunaWelcomeAiUnfinishedFlow, modes: ['drive'], queries: { drive: '&fake=empty' } },
  {
    name: 'kuna-welcome-ai-refused-croatian',
    viewports: ['phone', 'small-tablet', 'tablet-wide', 'desktop'],
    hash: '#/',
    title: 'Dobrodošli u Kunu',
    run: kunaWelcomeAiRefusedFlowIn('hr'),
    modes: ['drive'],
    queries: { drive: '&fake=empty&ai=key-refused&lang=hr' },
  },
  { name: 'move-into-kuna', hash: '#/company/settings?tab=books', title: 'Settings', run: moveIntoKunaFlow, modes: ['drive'] },
  { name: 'move-into-kuna-statements', hash: '#/company/settings?tab=books', title: 'Settings', run: moveStatementsIntoKunaFlow, modes: ['drive'], queries: { drive: '&fake=mail-move' } },
  {
    name: 'move-into-kuna-statements-croatian',
    hash: '#/company/settings?tab=books',
    title: 'Postavke',
    run: moveStatementsIntoKunaFlowIn('hr'),
    modes: ['drive'],
    queries: { drive: '&fake=mail-move&lang=hr' },
  },
  { name: 'move-into-kuna-croatian', hash: '#/company/settings?tab=books', title: 'Postavke', run: moveIntoKunaFlowIn('hr'), modes: ['drive'], queries: { drive: '&lang=hr' } },
  { name: 'onboarding-browser', hash: '#/company/start', title: 'Company', run: onboardingBrowserFlow, modes: ['browser'], queries: { browser: '&fake=empty' } },
  {
    name: 'onboarding-drive-croatian',
    hash: '#/company/start',
    title: 'Tvrtka',
    run: onboardingDriveFlowIn('hr'),
    viewports: ['phone', 'tablet', 'desktop'],
    modes: ['drive'],
    queries: { drive: '&fake=empty&lang=hr' },
  },
  {
    name: 'onboarding-browser-croatian',
    hash: '#/company/start',
    title: 'Tvrtka',
    run: onboardingBrowserFlowIn('hr'),
    viewports: ['phone', 'tablet', 'desktop'],
    modes: ['browser'],
    queries: { browser: '&fake=empty&lang=hr' },
  },
  { name: 'onboarding-bring', hash: '#/company/start', title: 'Company', run: onboardingBringFlow(IMPORT_FILE), modes: ['drive'], queries: { drive: '&fake=empty' } },
  { name: 'onboarding-open', hash: '#/company/start?path=open', title: 'Company', run: onboardingOpenFlow, modes: ['drive'] },
  { name: 'onboarding-start-over', hash: '#/company/start', title: 'Company', run: onboardingStartOverFlow, modes: ['drive'], queries: { drive: '&fake=empty' } },
  { name: 'onboarding-on-drive', hash: '#/company/start?step=folder', title: 'Company', run: onboardingOnDriveFlow, modes: ['drive'] },
  { name: 'onboarding-move-on-drive', hash: '#/company/settings?tab=books', title: 'Settings', run: moveOntoDriveFlow, modes: ['browser'], queries: { browser: '&fake=browser-beside-drive' } },
  { name: 'onboarding-pack-croatian', hash: '#/company/start', title: 'Tvrtka', run: onboardingPackFlowIn('hr'), modes: ['drive'], queries: { drive: '&fake=empty&lang=hr' } },
  { name: 'onboarding-delivery-croatian', hash: '#/company/start', title: 'Tvrtka', run: onboardingDeliveryFlowIn('hr'), modes: ['drive'], queries: { drive: '&fake=empty&lang=hr' } },
  { name: 'onboarding-bring-croatian', hash: '#/company/start', title: 'Tvrtka', run: onboardingBringFlowIn('hr', IMPORT_FILE), modes: ['drive'], queries: { drive: '&fake=empty&lang=hr' } },
  { name: 'onboarding-open-croatian', hash: '#/company/start?path=open', title: 'Tvrtka', run: onboardingOpenFlowIn('hr'), modes: ['drive'], queries: { drive: '&lang=hr' } },
  { name: 'onboarding-start-over-croatian', hash: '#/company/start', title: 'Tvrtka', run: onboardingStartOverFlowIn('hr'), modes: ['drive'], queries: { drive: '&fake=empty&lang=hr' } },
  { name: 'onboarding-on-drive-croatian', hash: '#/company/start?step=folder', title: 'Tvrtka', run: onboardingOnDriveFlowIn('hr'), modes: ['drive'], queries: { drive: '&lang=hr' } },
  {
    name: 'onboarding-move-on-drive-croatian',
    hash: '#/company/settings?tab=books',
    title: 'Postavke',
    run: moveOntoDriveFlowIn('hr'),
    modes: ['browser'],
    queries: { browser: '&fake=browser-beside-drive&lang=hr' },
  },
  { name: 'loans-drive', hash: '#/loans', title: 'Loans', run: loansDriveFlow, modes: ['drive'] },
  // Setting an app up with the chat: the first run's buttons, the overview's, the goes-on line and the names line on the first send.
  {
    name: 'set-up-chat-home-spending',
    hash: '#/spending',
    title: 'Spending',
    run: setUpChatHomeFlowIn('spending', 'en'),
    modes: ['browser'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { browser: '&fake=empty' },
  },
  {
    name: 'set-up-chat-folder-spending',
    hash: '#/spending/start?step=folder',
    title: 'Spending',
    run: setUpChatFolderFlowIn('spending', 'en'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '' },
  },
  {
    name: 'set-up-chat-home-spending-croatian',
    hash: '#/spending',
    title: 'Potrošnja',
    run: setUpChatHomeFlowIn('spending', 'hr'),
    modes: ['browser'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { browser: '&fake=empty&lang=hr' },
  },
  {
    name: 'set-up-chat-folder-spending-croatian',
    hash: '#/spending/start?step=folder',
    title: 'Potrošnja',
    run: setUpChatFolderFlowIn('spending', 'hr'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&lang=hr' },
  },
  {
    name: 'set-up-chat-home-loans',
    hash: '#/loans',
    title: 'Loans',
    run: setUpChatHomeFlowIn('loans', 'en'),
    modes: ['browser'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { browser: '&fake=empty' },
  },
  {
    name: 'set-up-chat-folder-loans',
    hash: '#/loans/start?step=folder',
    title: 'Loans',
    run: setUpChatFolderFlowIn('loans', 'en'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '' },
  },
  {
    name: 'set-up-chat-home-loans-croatian',
    hash: '#/loans',
    title: 'Krediti',
    run: setUpChatHomeFlowIn('loans', 'hr'),
    modes: ['browser'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { browser: '&fake=empty&lang=hr' },
  },
  {
    name: 'set-up-chat-folder-loans-croatian',
    hash: '#/loans/start?step=folder',
    title: 'Krediti',
    run: setUpChatFolderFlowIn('loans', 'hr'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&lang=hr' },
  },
  {
    name: 'set-up-chat-home-assets',
    hash: '#/assets',
    title: 'Assets',
    run: setUpChatHomeFlowIn('assets', 'en'),
    modes: ['browser'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { browser: '&fake=empty' },
  },
  {
    name: 'set-up-chat-folder-assets',
    hash: '#/assets/start?step=folder',
    title: 'Assets',
    run: setUpChatFolderFlowIn('assets', 'en'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '' },
  },
  {
    name: 'set-up-chat-home-assets-croatian',
    hash: '#/assets',
    title: 'Imovina',
    run: setUpChatHomeFlowIn('assets', 'hr'),
    modes: ['browser'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { browser: '&fake=empty&lang=hr' },
  },
  {
    name: 'set-up-chat-folder-assets-croatian',
    hash: '#/assets/start?step=folder',
    title: 'Imovina',
    run: setUpChatFolderFlowIn('assets', 'hr'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&lang=hr' },
  },
  {
    name: 'set-up-chat-home-investments',
    hash: '#/investments',
    title: 'Investments',
    run: setUpChatHomeFlowIn('investments', 'en'),
    modes: ['browser'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { browser: '&fake=empty' },
  },
  {
    name: 'set-up-chat-folder-investments',
    hash: '#/investments/start?step=folder',
    title: 'Investments',
    run: setUpChatFolderFlowIn('investments', 'en'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '' },
  },
  {
    name: 'set-up-chat-home-investments-croatian',
    hash: '#/investments',
    title: 'Ulaganja',
    run: setUpChatHomeFlowIn('investments', 'hr'),
    modes: ['browser'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { browser: '&fake=empty&lang=hr' },
  },
  {
    name: 'set-up-chat-folder-investments-croatian',
    hash: '#/investments/start?step=folder',
    title: 'Ulaganja',
    run: setUpChatFolderFlowIn('investments', 'hr'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&lang=hr' },
  },
  {
    name: 'set-up-chat-home-company',
    hash: '#/company/start',
    title: 'Company',
    run: setUpChatCompanyHomeFlowIn('en'),
    modes: ['browser'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { browser: '&fake=empty' },
  },
  {
    name: 'set-up-chat-folder-company',
    hash: '#/company/start',
    title: 'Company',
    run: setUpChatCompanyFolderFlowIn('en'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&fake=empty' },
  },
  {
    name: 'set-up-chat-home-company-croatian',
    hash: '#/company/start',
    title: 'Tvrtka',
    run: setUpChatCompanyHomeFlowIn('hr'),
    modes: ['browser'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { browser: '&fake=empty&lang=hr' },
  },
  {
    name: 'set-up-chat-folder-company-croatian',
    hash: '#/company/start',
    title: 'Tvrtka',
    run: setUpChatCompanyFolderFlowIn('hr'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&fake=empty&lang=hr' },
  },
  { name: 'set-up-chat-goes-on', hash: '#/loans', title: 'Loans', run: setUpChatGoesOnFlowIn('en'), modes: ['browser'], viewports: DESIGN_REVIEW_VIEWPORTS, queries: { browser: '&fake=empty' } },
  {
    name: 'set-up-chat-goes-on-croatian',
    hash: '#/loans',
    title: 'Krediti',
    run: setUpChatGoesOnFlowIn('hr'),
    modes: ['browser'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { browser: '&fake=empty&lang=hr' },
  },
  {
    name: 'set-up-chat-names',
    hash: '#/spending',
    title: 'Spending',
    run: setUpChatNamesFlowIn('en', CHAT_ATTACHMENT_SAMPLES.deposits),
    modes: ['browser'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { browser: '&fake=empty' },
  },
  {
    name: 'set-up-chat-names-croatian',
    hash: '#/spending',
    title: 'Potrošnja',
    run: setUpChatNamesFlowIn('hr', CHAT_ATTACHMENT_SAMPLES.deposits),
    modes: ['browser'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { browser: '&fake=empty&lang=hr' },
  },
  {
    name: 'set-up-chat-openers',
    hash: '#/?chat=1',
    title: 'All apps',
    run: setUpOpenersFlowIn('en'),
    modes: ['browser'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { browser: '&fake=empty&start=browser' },
  },
  {
    name: 'set-up-chat-openers-croatian',
    hash: '#/?chat=1',
    title: 'Sve aplikacije',
    run: setUpOpenersFlowIn('hr'),
    modes: ['browser'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { browser: '&fake=empty&start=browser&lang=hr' },
  },
  { name: 'chat-out-of-credit', hash: '#/?chat=1', title: 'All apps', run: chatOutOfCreditFlowIn('en'), modes: ['drive'], viewports: DESIGN_REVIEW_VIEWPORTS, queries: { drive: '&ai=out-of-credit' } },
  {
    name: 'chat-out-of-credit-croatian',
    hash: '#/?chat=1',
    title: 'Sve aplikacije',
    run: chatOutOfCreditFlowIn('hr'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&ai=out-of-credit&lang=hr' },
  },
  {
    name: 'set-up-chat-card-investments',
    hash: '#/investments',
    title: 'Overview',
    run: setUpCardHeaderFlowIn('investments', 'en'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&investments=partial-history' },
  },
  {
    name: 'set-up-chat-card-investments-croatian',
    hash: '#/investments',
    title: 'Pregled',
    run: setUpCardHeaderFlowIn('investments', 'hr'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&investments=partial-history&lang=hr' },
  },
  { name: 'loans-browser', hash: '#/loans', title: 'Loans', run: firstRunBrowserFlowIn('loans', 'en'), modes: ['browser'] },
  { name: 'loans-open', hash: '#/loans', title: 'Loans', run: loansOpenFlow, modes: ['drive'], queries: { drive: '&loans=other-device' } },
  { name: 'loans-start-on-drive', hash: '#/loans/start?step=folder', title: 'Loans', run: firstRunOnDriveFlowIn('loans', 'en'), modes: ['drive'], queries: { drive: '&loans=other-device' } },
  { name: 'loans-browser-croatian', hash: '#/loans', title: 'Krediti', run: firstRunBrowserFlowIn('loans', 'hr'), modes: ['browser'], queries: { browser: '&fake=browser&lang=hr' } },
  { name: 'loans-open-croatian', hash: '#/loans', title: 'Krediti', run: loansOpenFlowIn('hr'), modes: ['drive'], queries: { drive: '&loans=other-device&lang=hr' } },
  { name: 'loans-drive-croatian', hash: '#/loans', title: 'Krediti', run: loansDriveFlowIn('hr'), modes: ['drive'], queries: { drive: '&lang=hr' } },
  {
    name: 'loans-start-on-drive-croatian',
    hash: '#/loans/start?step=folder',
    title: 'Krediti',
    run: firstRunOnDriveFlowIn('loans', 'hr'),
    modes: ['drive'],
    queries: { drive: '&loans=other-device&lang=hr' },
  },
  { name: 'loans-editor', hash: '#/loans', title: 'Overview', run: loansEditorFlow, modes: ['drive'], queries: { drive: '&loans=sample&investments=sample' } },
  { name: 'assets-editor', hash: '#/assets', title: 'Overview', run: assetsEditorFlow, modes: ['drive'], queries: { drive: '&assets=drive&loans=sample' } },
  { name: 'assets-editor-croatian', hash: '#/assets', title: 'Pregled', run: assetsEditorFlowIn('hr'), modes: ['drive'], queries: { drive: '&assets=drive&loans=sample&lang=hr' } },
  { name: 'assets-valuation', hash: `#/assets/asset?asset=${SAMPLE_CAR}`, title: 'Family car', run: assetsValuationFlow, modes: ['drive'], queries: { drive: '&assets=sample&loans=sample' } },
  {
    name: 'assets-valuation-croatian',
    hash: `#/assets/asset?asset=${SAMPLE_CAR}`,
    title: 'Family car',
    run: assetsValuationFlowIn('hr'),
    modes: ['drive'],
    queries: { drive: '&assets=sample&loans=sample&lang=hr' },
  },
  { name: 'loans-editor-croatian', hash: '#/loans', title: 'Pregled', run: loansEditorFlowIn('hr'), modes: ['drive'], queries: { drive: '&loans=sample&lang=hr' } },
  {
    name: 'spending-entry',
    hash: '#/spending/transactions',
    title: 'Entries',
    run: spendingEntryDialogFlowIn('en', 'out'),
    modes: ['drive'],
    viewports: EVERY_VIEWPORT,
    queries: { drive: '&spending=sample' },
  },
  {
    name: 'spending-link',
    hash: `#/spending/transactions?month=${addMonths(monthOf(today()), -1)}`,
    title: 'Entries',
    run: spendingLinkFlowIn('en', addMonths(monthOf(today()), -2)),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&spending=sample&loans=sample' },
  },
  {
    name: 'spending-link-croatian',
    hash: `#/spending/transactions?month=${addMonths(monthOf(today()), -1)}`,
    title: 'Unosi',
    run: spendingLinkFlowIn('hr', addMonths(monthOf(today()), -2)),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&spending=sample&loans=sample&lang=hr' },
  },
  {
    name: 'spending-entry-bank-row',
    hash: '#/spending/transactions',
    title: 'Entries',
    run: spendingBankRowFlowIn('en'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&spending=synced&banksync=saved' },
  },
  {
    name: 'spending-entry-bank-row-croatian',
    hash: '#/spending/transactions',
    title: 'Unosi',
    run: spendingBankRowFlowIn('hr'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&spending=synced&banksync=saved&lang=hr' },
  },
  {
    name: 'spending-transfer',
    hash: '#/spending/transactions',
    title: 'Entries',
    run: spendingEntryDialogFlowIn('en', 'transfer'),
    modes: ['drive'],
    viewports: EVERY_VIEWPORT,
    queries: { drive: '&spending=sample' },
  },
  {
    name: 'spending-receipt-matched',
    viewports: ['phone', 'small-tablet', 'tablet-wide', 'desktop'],
    hash: '#/spending/transactions',
    title: 'Entries',
    run: spendingReceiptFlowIn('en', SPENDING_RECEIPT_SAMPLES),
    modes: ['drive'],
    queries: { drive: '&spending=receipts' },
  },
  {
    name: 'spending-receipt-pick',
    viewports: ['phone', 'small-tablet', 'tablet-wide', 'desktop'],
    hash: '#/spending/transactions',
    title: 'Entries',
    run: spendingReceiptPickFlowIn('en', SPENDING_RECEIPT_SAMPLES),
    modes: ['drive'],
    queries: { drive: '&spending=receipts' },
  },
  {
    name: 'spending-receipt-place',
    viewports: ['phone', 'small-tablet', 'tablet-wide', 'desktop'],
    hash: '#/spending/transactions',
    title: 'Entries',
    run: spendingReceiptPlaceFlowIn('en', SPENDING_RECEIPT_SAMPLES),
    modes: ['drive'],
    queries: { drive: '&spending=receipts' },
  },
  {
    name: 'spending-receipt-waits',
    hash: '#/spending/transactions',
    title: 'Entries',
    run: spendingReceiptWaitsFlowIn('en', SPENDING_RECEIPT_SAMPLES),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&spending=receipts&banksync=saved' },
  },
  {
    name: 'spending-receipt-waits-croatian',
    hash: '#/spending/transactions',
    title: 'Unosi',
    run: spendingReceiptWaitsFlowIn('hr', SPENDING_RECEIPT_SAMPLES),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&spending=receipts&banksync=saved&lang=hr' },
  },
  {
    name: 'spending-review-near',
    viewports: ['phone', 'small-tablet', 'tablet-wide', 'desktop'],
    hash: '#/spending/transactions?tab=import',
    title: 'Entries',
    run: spendingReviewNearFlowIn('en', SPENDING_IMPORT_SAMPLES),
    modes: ['drive'],
    queries: { drive: '&spending=statements' },
  },
  {
    name: 'spending-import-revolut',
    viewports: ['phone', 'small-tablet', 'tablet-wide', 'desktop'],
    hash: '#/spending/transactions?tab=import',
    title: 'Entries',
    run: spendingImportFlowIn('en', SPENDING_IMPORT_SAMPLES),
    modes: ['drive'],
    queries: { drive: '&spending=statements' },
  },
  {
    name: 'spending-import-refused',
    viewports: ['phone', 'small-tablet', 'tablet-wide', 'desktop'],
    hash: '#/spending/transactions?tab=import',
    title: 'Entries',
    run: spendingImportRefusedFlowIn('en', SPENDING_IMPORT_SAMPLES),
    modes: ['drive'],
    queries: { drive: '&spending=statements' },
  },
  {
    name: 'spending-import-missing',
    viewports: ['phone', 'small-tablet', 'tablet-wide', 'desktop'],
    hash: '#/spending/transactions?tab=import',
    title: 'Entries',
    run: spendingImportMissingFlowIn('en', SPENDING_IMPORT_SAMPLES),
    modes: ['drive'],
    queries: { drive: '&spending=statements' },
  },
  {
    name: 'spending-import-lookalike',
    viewports: DESIGN_REVIEW_VIEWPORTS,
    hash: '#/spending/transactions?tab=import',
    title: 'Entries',
    run: spendingImportLookAlikeFlowIn('en', SPENDING_IMPORT_SAMPLES),
    modes: ['drive'],
    queries: { drive: '&spending=copied' },
  },
  {
    name: 'spending-import-missing-savings',
    viewports: ['phone', 'small-tablet', 'tablet-wide', 'desktop'],
    hash: '#/spending/transactions?tab=import',
    title: 'Entries',
    run: spendingImportMissingSavingsFlowIn('en', SPENDING_IMPORT_SAMPLES),
    modes: ['drive'],
    queries: { drive: '&spending=statements' },
  },
  {
    name: 'spending-bank-sync-link',
    viewports: ['phone', 'small-tablet', 'tablet-wide', 'desktop'],
    hash: '#/spending/settings?tab=bank-sync',
    title: 'Settings',
    run: spendingBankSyncFlowIn('en'),
    modes: ['drive'],
    queries: { drive: '&spending=statements' },
  },
  {
    name: 'spending-import-bank-sync',
    viewports: ['phone', 'small-tablet', 'tablet-wide', 'desktop'],
    hash: '#/spending/settings?tab=bank-sync',
    title: 'Settings',
    run: spendingBankSyncRowsFlowIn('en'),
    modes: ['drive'],
    queries: { drive: '&spending=statements&banksync=unknown-account' },
  },
  {
    name: 'spending-bank-sync-lookalike',
    viewports: DESIGN_REVIEW_VIEWPORTS,
    hash: '#/spending/settings?tab=bank-sync',
    title: 'Settings',
    run: spendingBankSyncLookAlikeFlowIn('en'),
    modes: ['drive'],
    queries: { drive: '&spending=statements&banksync=look-alike' },
  },
  {
    name: 'spending-bank-sync-withdrawal',
    viewports: DESIGN_REVIEW_VIEWPORTS,
    hash: '#/spending/settings?tab=bank-sync',
    title: 'Settings',
    run: spendingBankSyncWithdrawalFlowIn('en'),
    modes: ['drive'],
    queries: { drive: '&spending=statements&banksync=withdrawal' },
  },
  {
    name: 'spending-review-cash',
    viewports: DESIGN_REVIEW_VIEWPORTS,
    hash: '#/spending/transactions?tab=review',
    title: 'Entries',
    run: spendingReviewCashFlowIn('en'),
    modes: ['drive'],
    queries: { drive: '&spending=cash' },
  },
  {
    name: 'spending-rules-withdrawal',
    viewports: DESIGN_REVIEW_VIEWPORTS,
    hash: '#/spending/settings?tab=rules',
    title: 'Settings',
    run: spendingRuleWithdrawalFlowIn('en'),
    modes: ['drive'],
    queries: { drive: '&spending=statements' },
  },
  {
    name: 'spending-bank-sync-withdrawal-croatian',
    viewports: DESIGN_REVIEW_VIEWPORTS,
    hash: '#/spending/settings?tab=bank-sync',
    title: 'Postavke',
    run: spendingBankSyncWithdrawalFlowIn('hr'),
    modes: ['drive'],
    queries: { drive: '&spending=statements&banksync=withdrawal&lang=hr' },
  },
  {
    name: 'spending-review-cash-croatian',
    viewports: DESIGN_REVIEW_VIEWPORTS,
    hash: '#/spending/transactions?tab=review',
    title: 'Unosi',
    run: spendingReviewCashFlowIn('hr'),
    modes: ['drive'],
    queries: { drive: '&spending=cash&lang=hr' },
  },
  {
    name: 'spending-rules-withdrawal-croatian',
    viewports: DESIGN_REVIEW_VIEWPORTS,
    hash: '#/spending/settings?tab=rules',
    title: 'Postavke',
    run: spendingRuleWithdrawalFlowIn('hr'),
    modes: ['drive'],
    queries: { drive: '&spending=statements&lang=hr' },
  },
  {
    name: 'spending-bank-sync-lookalike-croatian',
    viewports: DESIGN_REVIEW_VIEWPORTS,
    hash: '#/spending/settings?tab=bank-sync',
    title: 'Postavke',
    run: spendingBankSyncLookAlikeFlowIn('hr'),
    modes: ['drive'],
    queries: { drive: '&spending=statements&banksync=look-alike&lang=hr' },
  },
  {
    name: 'spending-bank-sync-balance',
    viewports: ['phone', 'small-tablet', 'tablet-wide', 'desktop'],
    hash: '#/spending/settings?tab=bank-sync',
    title: 'Settings',
    run: spendingBankSyncBalanceFlowIn('en'),
    modes: ['drive'],
    queries: { drive: '&spending=statements&banksync=balance-differs' },
  },
  {
    name: 'spending-bank-sync-balance-croatian',
    viewports: ['phone', 'small-tablet', 'tablet-wide', 'desktop'],
    hash: '#/spending/settings?tab=bank-sync',
    title: 'Postavke',
    run: spendingBankSyncBalanceFlowIn('hr'),
    modes: ['drive'],
    queries: { drive: '&spending=statements&banksync=balance-differs&lang=hr' },
  },
  {
    name: 'spending-bank-sync-failed',
    viewports: ['phone', 'small-tablet', 'tablet-wide', 'desktop'],
    hash: '#/spending/settings?tab=bank-sync',
    title: 'Settings',
    run: spendingBankSyncFailedFlowIn('en'),
    modes: ['drive'],
    queries: { drive: '&spending=statements&banksync=failed' },
  },
  {
    name: 'spending-bank-sync-one-failed',
    viewports: ['phone', 'small-tablet', 'tablet-wide', 'desktop'],
    hash: '#/spending/settings?tab=bank-sync',
    title: 'Settings',
    run: spendingBankSyncPartFlowIn('en', 'spending-bank-sync-one-failed', (words) => words.bankFailed('OTP', 'HTTP 503')),
    modes: ['drive'],
    queries: { drive: '&spending=statements&banksync=otp-failed' },
  },
  {
    name: 'spending-bank-sync-ended',
    viewports: ['phone', 'small-tablet', 'tablet-wide', 'desktop'],
    hash: '#/spending/settings?tab=bank-sync',
    title: 'Settings',
    run: spendingBankSyncPartFlowIn('en', 'spending-bank-sync-ended', (words) => words.sessionEnded('OTP banka')),
    modes: ['drive'],
    queries: { drive: '&spending=statements&banksync=ended' },
  },
  {
    name: 'spending-bank-sync-setup',
    viewports: ['phone', 'small-tablet', 'tablet-wide', 'desktop'],
    hash: '#/spending/settings?tab=bank-sync',
    title: 'Settings',
    run: spendingBankSyncSetupFlowIn('en', 'spending-bank-sync-setup', {
      waitFor: '[data-testid="spending-bank-account-add-all"]',
      tap: '[data-testid="spending-bank-account-add-all"]',
      done: (screen) => screen.spendingAccounts.addedCount(2).other,
      after: 'spending-bank-sync-setup-added',
    }),
    modes: ['drive'],
    queries: { drive: '&spending=statements&banksync=new-accounts' },
  },
  {
    name: 'spending-bank-sync-setup-croatian',
    viewports: ['phone', 'small-tablet', 'tablet-wide', 'desktop'],
    hash: '#/spending/settings?tab=bank-sync',
    title: 'Postavke',
    run: spendingBankSyncSetupFlowIn('hr', 'spending-bank-sync-setup', {
      waitFor: '[data-testid="spending-bank-account-add-all"]',
      tap: '[data-testid="spending-bank-account-add-all"]',
      done: (screen) => screen.spendingAccounts.addedCount(2).few,
      after: 'spending-bank-sync-setup-added',
    }),
    modes: ['drive'],
    queries: { drive: '&spending=statements&banksync=new-accounts&lang=hr' },
  },
  {
    name: 'spending-bank-sync-setup-start-day',
    viewports: ['phone', 'small-tablet', 'tablet-wide', 'desktop'],
    hash: '#/spending/settings?tab=bank-sync',
    title: 'Settings',
    run: spendingBankSyncStartDayFlowIn('en'),
    modes: ['drive'],
    queries: { drive: '&spending=statements&banksync=new-accounts' },
  },
  {
    name: 'spending-bank-sync-setup-start-day-croatian',
    viewports: ['phone', 'small-tablet', 'tablet-wide', 'desktop'],
    hash: '#/spending/settings?tab=bank-sync',
    title: 'Postavke',
    run: spendingBankSyncStartDayFlowIn('hr'),
    modes: ['drive'],
    queries: { drive: '&spending=statements&banksync=new-accounts&lang=hr' },
  },
  {
    name: 'spending-bank-sync-setup-not-in-kuna',
    viewports: ['phone', 'small-tablet', 'tablet-wide', 'desktop'],
    hash: '#/spending/settings?tab=bank-sync',
    title: 'Settings',
    run: spendingBankSyncSetupFlowIn('en', 'spending-bank-sync-setup-not-in-kuna', {
      waitFor: '[data-testid="spending-bank-sync-not-in-kuna"]',
      tap: '[data-testid="spending-bank-account-leave-out"]',
      done: (screen) => screen.spendingBankSync.setup.markedOut,
    }),
    modes: ['drive'],
    queries: { drive: '&spending=statements&banksync=not-in-kuna' },
  },
  {
    name: 'spending-bank-sync-setup-not-in-kuna-croatian',
    viewports: ['phone', 'small-tablet', 'tablet-wide', 'desktop'],
    hash: '#/spending/settings?tab=bank-sync',
    title: 'Postavke',
    run: spendingBankSyncSetupFlowIn('hr', 'spending-bank-sync-setup-not-in-kuna', {
      waitFor: '[data-testid="spending-bank-sync-not-in-kuna"]',
      tap: '[data-testid="spending-bank-account-leave-out"]',
      done: (screen) => screen.spendingBankSync.setup.markedOut,
    }),
    modes: ['drive'],
    queries: { drive: '&spending=statements&banksync=not-in-kuna&lang=hr' },
  },
  {
    name: 'spending-bank-sync-setup-iban',
    viewports: ['phone', 'small-tablet', 'tablet-wide', 'desktop'],
    hash: '#/spending/settings?tab=bank-sync',
    title: 'Settings',
    run: spendingBankSyncSetupFlowIn('en', 'spending-bank-sync-setup-iban', {
      waitFor: '[data-testid="spending-bank-account"][data-kind="fits"]',
      tap: '[data-testid="spending-bank-account-update"]',
      done: (screen) => screen.spendingBankSync.setup.updated,
    }),
    modes: ['drive'],
    queries: { drive: '&spending=statements&banksync=iban-blank' },
  },
  {
    name: 'spending-bank-sync-setup-iban-croatian',
    viewports: ['phone', 'small-tablet', 'tablet-wide', 'desktop'],
    hash: '#/spending/settings?tab=bank-sync',
    title: 'Postavke',
    run: spendingBankSyncSetupFlowIn('hr', 'spending-bank-sync-setup-iban', {
      waitFor: '[data-testid="spending-bank-account"][data-kind="fits"]',
      tap: '[data-testid="spending-bank-account-update"]',
      done: (screen) => screen.spendingBankSync.setup.updated,
    }),
    modes: ['drive'],
    queries: { drive: '&spending=statements&banksync=iban-blank&lang=hr' },
  },
  {
    name: 'spending-bank-sync-keep-mine',
    viewports: ['phone', 'small-tablet', 'tablet-wide', 'desktop'],
    hash: '#/spending/settings?tab=bank-sync',
    title: 'Settings',
    run: spendingBankSyncSetupFlowIn('en', 'spending-bank-sync-keep-mine', { waitFor: '[data-testid="spending-bank-account-keep-mine"]' }),
    modes: ['drive'],
    queries: { drive: '&spending=statements&banksync=kind-differs' },
  },
  {
    name: 'spending-bank-sync-keep-mine-croatian',
    viewports: ['phone', 'small-tablet', 'tablet-wide', 'desktop'],
    hash: '#/spending/settings?tab=bank-sync',
    title: 'Postavke',
    run: spendingBankSyncSetupFlowIn('hr', 'spending-bank-sync-keep-mine', { waitFor: '[data-testid="spending-bank-account-keep-mine"]' }),
    modes: ['drive'],
    queries: { drive: '&spending=statements&banksync=kind-differs&lang=hr' },
  },
  {
    name: 'spending-bank-sync-setup-by-hand',
    viewports: ['phone', 'small-tablet', 'tablet-wide', 'desktop'],
    hash: '#/spending/settings?tab=bank-sync',
    title: 'Settings',
    run: spendingBankSyncSetupFlowIn('en', 'spending-bank-sync-setup-by-hand', {
      waitFor: '[data-testid="spending-bank-account-update"]',
      tap: '[data-testid="spending-bank-account-keep-mine"]',
      done: (screen) => screen.spendingBankSync.setup.keptByHandToast,
      after: 'spending-bank-sync-setup-kept-by-hand',
      openKept: true,
    }),
    modes: ['drive'],
    queries: { drive: '&spending=statements&banksync=by-hand' },
  },
  {
    name: 'spending-bank-sync-setup-by-hand-croatian',
    viewports: ['phone', 'small-tablet', 'tablet-wide', 'desktop'],
    hash: '#/spending/settings?tab=bank-sync',
    title: 'Postavke',
    run: spendingBankSyncSetupFlowIn('hr', 'spending-bank-sync-setup-by-hand', {
      waitFor: '[data-testid="spending-bank-account-update"]',
      tap: '[data-testid="spending-bank-account-keep-mine"]',
      done: (screen) => screen.spendingBankSync.setup.keptByHandToast,
      after: 'spending-bank-sync-setup-kept-by-hand',
      openKept: true,
    }),
    modes: ['drive'],
    queries: { drive: '&spending=statements&banksync=by-hand&lang=hr' },
  },
  {
    name: 'spending-bank-sync-setup-switch-kind',
    viewports: ['phone', 'small-tablet', 'tablet-wide', 'desktop'],
    hash: '#/spending/settings?tab=bank-sync',
    title: 'Settings',
    run: spendingBankSyncSetupFlowIn('en', 'spending-bank-sync-setup-switch-kind', { waitFor: '[data-testid="spending-bank-account-update"]' }),
    modes: ['drive'],
    queries: { drive: '&spending=statements&banksync=by-hand-savings' },
  },
  {
    name: 'spending-bank-sync-setup-switch-kind-croatian',
    viewports: ['phone', 'small-tablet', 'tablet-wide', 'desktop'],
    hash: '#/spending/settings?tab=bank-sync',
    title: 'Postavke',
    run: spendingBankSyncSetupFlowIn('hr', 'spending-bank-sync-setup-switch-kind', { waitFor: '[data-testid="spending-bank-account-update"]' }),
    modes: ['drive'],
    queries: { drive: '&spending=statements&banksync=by-hand-savings&lang=hr' },
  },
  {
    name: 'spending-bank-sync-nothing-to-set',
    viewports: ['phone', 'small-tablet', 'tablet-wide', 'desktop'],
    hash: '#/spending/settings?tab=bank-sync',
    title: 'Settings',
    run: spendingBankSyncSetupFlowIn('en', 'spending-bank-sync-nothing-to-set', {
      waitFor: '[data-testid="spending-bank-account-keep-mine"]',
      tap: '[data-testid="spending-bank-account-keep-mine"]',
      done: (screen) => screen.spendingBankSync.setup.keptMine,
      after: 'spending-bank-sync-nothing-to-set-kept',
    }),
    modes: ['drive'],
    queries: { drive: '&spending=statements&banksync=settled' },
  },
  {
    name: 'spending-bank-sync-nothing-to-set-croatian',
    viewports: ['phone', 'small-tablet', 'tablet-wide', 'desktop'],
    hash: '#/spending/settings?tab=bank-sync',
    title: 'Postavke',
    run: spendingBankSyncSetupFlowIn('hr', 'spending-bank-sync-nothing-to-set', {
      waitFor: '[data-testid="spending-bank-account-keep-mine"]',
      tap: '[data-testid="spending-bank-account-keep-mine"]',
      done: (screen) => screen.spendingBankSync.setup.keptMine,
      after: 'spending-bank-sync-nothing-to-set-kept',
    }),
    modes: ['drive'],
    queries: { drive: '&spending=statements&banksync=settled&lang=hr' },
  },
  {
    name: 'spending-bank-sync-opening-pending',
    viewports: ['phone', 'small-tablet', 'tablet-wide', 'desktop'],
    hash: '#/spending/settings?tab=bank-sync',
    title: 'Settings',
    run: spendingBankSyncSetupFlowIn('en', 'spending-bank-sync-opening-pending', { waitFor: '[data-testid="spending-bank-account-pending"]' }),
    modes: ['drive'],
    queries: { drive: '&spending=statements&banksync=new-pending' },
  },
  {
    name: 'spending-bank-sync-opening-pending-croatian',
    viewports: ['phone', 'small-tablet', 'tablet-wide', 'desktop'],
    hash: '#/spending/settings?tab=bank-sync',
    title: 'Postavke',
    run: spendingBankSyncSetupFlowIn('hr', 'spending-bank-sync-opening-pending', { waitFor: '[data-testid="spending-bank-account-pending"]' }),
    modes: ['drive'],
    queries: { drive: '&spending=statements&banksync=new-pending&lang=hr' },
  },
  {
    name: 'spending-bank-sync-opening-fix',
    viewports: ['phone', 'small-tablet', 'tablet-wide', 'desktop'],
    hash: '#/spending/settings?tab=bank-sync',
    title: 'Settings',
    run: spendingBankSyncSetupFlowIn('en', 'spending-bank-sync-opening-fix', {
      waitFor: '[data-testid="spending-bank-sync-set-opening"]',
      tap: '[data-testid="spending-bank-sync-set-opening"]',
      done: (screen) => screen.spendingBankSync.openingSet,
    }),
    modes: ['drive'],
    queries: { drive: '&spending=statements&banksync=opening-off' },
  },
  {
    name: 'spending-bank-sync-opening-fix-croatian',
    viewports: ['phone', 'small-tablet', 'tablet-wide', 'desktop'],
    hash: '#/spending/settings?tab=bank-sync',
    title: 'Postavke',
    run: spendingBankSyncSetupFlowIn('hr', 'spending-bank-sync-opening-fix', {
      waitFor: '[data-testid="spending-bank-sync-set-opening"]',
      tap: '[data-testid="spending-bank-sync-set-opening"]',
      done: (screen) => screen.spendingBankSync.openingSet,
    }),
    modes: ['drive'],
    queries: { drive: '&spending=statements&banksync=opening-off&lang=hr' },
  },
  {
    name: 'spending-bank-sync-pending',
    viewports: ['phone', 'small-tablet', 'tablet-wide', 'desktop'],
    hash: '#/spending/settings?tab=bank-sync',
    title: 'Settings',
    run: spendingBankSyncPendingFlowIn('en'),
    modes: ['drive'],
    queries: { drive: '&spending=statements&banksync=card-pending' },
  },
  {
    name: 'spending-bank-sync-pending-croatian',
    viewports: ['phone', 'small-tablet', 'tablet-wide', 'desktop'],
    hash: '#/spending/settings?tab=bank-sync',
    title: 'Postavke',
    run: spendingBankSyncPendingFlowIn('hr'),
    modes: ['drive'],
    queries: { drive: '&spending=statements&banksync=card-pending&lang=hr' },
  },
  {
    name: 'spending-bank-sync-older-rows',
    viewports: ['phone', 'small-tablet', 'tablet-wide', 'desktop'],
    hash: '#/spending/settings?tab=bank-sync',
    title: 'Settings',
    run: spendingBankSyncSetupFlowIn('en', 'spending-bank-sync-older-rows', { waitFor: '[data-testid="spending-bank-sync-older-rows"]' }),
    modes: ['drive'],
    queries: { drive: '&spending=statements&banksync=linked' },
  },
  {
    name: 'spending-bank-sync-older-rows-croatian',
    viewports: ['phone', 'small-tablet', 'tablet-wide', 'desktop'],
    hash: '#/spending/settings?tab=bank-sync',
    title: 'Postavke',
    run: spendingBankSyncSetupFlowIn('hr', 'spending-bank-sync-older-rows', { waitFor: '[data-testid="spending-bank-sync-older-rows"]' }),
    modes: ['drive'],
    queries: { drive: '&spending=statements&banksync=linked&lang=hr' },
  },
  { name: 'spending-review-editor', hash: '#/spending/transactions?tab=review', title: 'Entries', run: spendingReviewFlowIn('en'), modes: ['drive'], queries: { drive: '&spending=statements' } },
  { name: 'spending-rule-editor', hash: '#/spending/transactions?tab=review', title: 'Entries', run: spendingRuleFlowIn('en'), modes: ['drive'], queries: { drive: '&spending=statements' } },
  {
    name: 'spending-rules-add',
    hash: '#/spending/settings?tab=rules',
    title: 'Settings',
    run: spendingRulesAddFlowIn('en'),
    viewports: ['phone', 'small-tablet', 'tablet-wide', 'desktop'],
    modes: ['drive'],
    queries: { drive: '&spending=statements' },
  },
  {
    name: 'spending-credit-transfer-editor',
    hash: '#/spending/transactions',
    title: 'Entries',
    run: spendingCreditToTransferFlowIn('en'),
    modes: ['drive'],
    queries: { drive: '&spending=sample', browser: '&fake=browser&spending=sample' },
  },
  { name: 'spending-delete-note', hash: '#/spending/transactions', title: 'Entries', run: spendingDeleteNoteFlowIn('en'), modes: ['drive'], queries: { drive: '&spending=statements' } },
  {
    name: 'spending-entry-editor',
    hash: '#/spending/transactions',
    title: 'Entries',
    run: spendingEntryFlowIn('en'),
    modes: ['drive'],
    queries: { drive: '&spending=sample', browser: '&fake=browser&spending=sample' },
  },
  { name: 'spending-first-account', hash: '#/spending', title: 'Overview', run: spendingFirstAccountFlow, viewports: EVERY_VIEWPORT, modes: ['drive'], queries: { drive: '&spending=drive' } },
  {
    name: 'spending-first-account-croatian',
    hash: '#/spending',
    title: 'Pregled',
    run: spendingFirstAccountFlowIn('hr'),
    viewports: DESIGN_REVIEW_VIEWPORTS,
    modes: ['drive'],
    queries: { drive: '&spending=drive&lang=hr' },
  },
  {
    name: 'spending-first-account-bank',
    hash: '#/spending',
    title: 'Overview',
    run: spendingFirstAccountBankFlowIn('en'),
    viewports: DESIGN_REVIEW_VIEWPORTS,
    modes: ['drive'],
    queries: { drive: '&spending=drive&banksync=saved' },
  },
  {
    name: 'spending-first-account-bank-croatian',
    hash: '#/spending',
    title: 'Pregled',
    run: spendingFirstAccountBankFlowIn('hr'),
    viewports: DESIGN_REVIEW_VIEWPORTS,
    modes: ['drive'],
    queries: { drive: '&spending=drive&banksync=saved&lang=hr' },
  },
  {
    name: 'investments-add-held',
    hash: '#/investments',
    title: 'Overview',
    run: investmentsAddHeldFlow,
    viewports: EVERY_VIEWPORT,
    modes: ['drive'],
    queries: { drive: '&investments=partial-history' },
  },
  {
    name: 'spending-transfer-editor',
    hash: '#/spending/accounts',
    title: 'Accounts',
    run: spendingTransferFlowIn('en'),
    modes: ['drive'],
    queries: { drive: '&spending=sample', browser: '&fake=browser&spending=sample' },
  },
  {
    name: 'spending-category-editor',
    hash: '#/spending/settings',
    title: 'Settings',
    run: spendingCategoryFlowIn('en'),
    modes: ['drive'],
    queries: { drive: '&spending=sample', browser: '&fake=browser&spending=sample' },
  },
  {
    name: 'spending-limit-editor',
    hash: '#/spending/budgets',
    title: 'Limits',
    run: spendingLimitFlowIn('en'),
    modes: ['drive'],
    queries: { drive: '&spending=sample', browser: '&fake=browser&spending=sample' },
  },
  {
    name: 'spending-entry-croatian',
    hash: '#/spending/transactions',
    title: 'Unosi',
    run: spendingEntryDialogFlowIn('hr', 'out'),
    modes: ['drive'],
    viewports: EVERY_VIEWPORT,
    queries: { drive: '&spending=sample&lang=hr' },
  },
  {
    name: 'spending-transfer-croatian',
    hash: '#/spending/transactions',
    title: 'Unosi',
    run: spendingEntryDialogFlowIn('hr', 'transfer'),
    modes: ['drive'],
    viewports: EVERY_VIEWPORT,
    queries: { drive: '&spending=sample&lang=hr' },
  },
  {
    name: 'spending-bank-sync-link-croatian',
    viewports: ['phone', 'small-tablet', 'tablet-wide', 'desktop'],
    hash: '#/spending/settings?tab=bank-sync',
    title: 'Postavke',
    run: spendingBankSyncFlowIn('hr'),
    modes: ['drive'],
    queries: { drive: '&spending=statements&lang=hr' },
  },
  {
    name: 'spending-import-bank-sync-croatian',
    viewports: ['phone', 'small-tablet', 'tablet-wide', 'desktop'],
    hash: '#/spending/settings?tab=bank-sync',
    title: 'Postavke',
    run: spendingBankSyncRowsFlowIn('hr'),
    modes: ['drive'],
    queries: { drive: '&spending=statements&banksync=unknown-account&lang=hr' },
  },
  {
    name: 'spending-bank-sync-failed-croatian',
    viewports: ['phone', 'small-tablet', 'tablet-wide', 'desktop'],
    hash: '#/spending/settings?tab=bank-sync',
    title: 'Postavke',
    run: spendingBankSyncFailedFlowIn('hr'),
    modes: ['drive'],
    queries: { drive: '&spending=statements&banksync=failed&lang=hr' },
  },
  {
    name: 'spending-bank-sync-one-failed-croatian',
    viewports: ['phone', 'small-tablet', 'tablet-wide', 'desktop'],
    hash: '#/spending/settings?tab=bank-sync',
    title: 'Postavke',
    run: spendingBankSyncPartFlowIn('hr', 'spending-bank-sync-one-failed', (words) => words.bankFailed('OTP', 'HTTP 503')),
    modes: ['drive'],
    queries: { drive: '&spending=statements&banksync=otp-failed&lang=hr' },
  },
  {
    name: 'spending-bank-sync-ended-croatian',
    viewports: ['phone', 'small-tablet', 'tablet-wide', 'desktop'],
    hash: '#/spending/settings?tab=bank-sync',
    title: 'Postavke',
    run: spendingBankSyncPartFlowIn('hr', 'spending-bank-sync-ended', (words) => words.sessionEnded('OTP banka')),
    modes: ['drive'],
    queries: { drive: '&spending=statements&banksync=ended&lang=hr' },
  },
  {
    name: 'spending-receipt-matched-croatian',
    viewports: ['phone', 'small-tablet', 'tablet-wide', 'desktop'],
    hash: '#/spending/transactions',
    title: 'Unosi',
    run: spendingReceiptFlowIn('hr', SPENDING_RECEIPT_SAMPLES),
    modes: ['drive'],
    queries: { drive: '&spending=receipts&lang=hr' },
  },
  {
    name: 'spending-receipt-pick-croatian',
    viewports: ['phone', 'small-tablet', 'tablet-wide', 'desktop'],
    hash: '#/spending/transactions',
    title: 'Unosi',
    run: spendingReceiptPickFlowIn('hr', SPENDING_RECEIPT_SAMPLES),
    modes: ['drive'],
    queries: { drive: '&spending=receipts&lang=hr' },
  },
  {
    name: 'spending-receipt-place-croatian',
    viewports: ['phone', 'small-tablet', 'tablet-wide', 'desktop'],
    hash: '#/spending/transactions',
    title: 'Unosi',
    run: spendingReceiptPlaceFlowIn('hr', SPENDING_RECEIPT_SAMPLES),
    modes: ['drive'],
    queries: { drive: '&spending=receipts&lang=hr' },
  },
  {
    name: 'spending-review-near-croatian',
    viewports: ['phone', 'small-tablet', 'tablet-wide', 'desktop'],
    hash: '#/spending/transactions?tab=import',
    title: 'Unosi',
    run: spendingReviewNearFlowIn('hr', SPENDING_IMPORT_SAMPLES),
    modes: ['drive'],
    queries: { drive: '&spending=statements&lang=hr' },
  },
  {
    name: 'spending-import-revolut-croatian',
    viewports: ['phone', 'small-tablet', 'tablet-wide', 'desktop'],
    hash: '#/spending/transactions?tab=import',
    title: 'Unosi',
    run: spendingImportFlowIn('hr', SPENDING_IMPORT_SAMPLES),
    modes: ['drive'],
    queries: { drive: '&spending=statements&lang=hr' },
  },
  {
    name: 'spending-import-refused-croatian',
    viewports: ['phone', 'small-tablet', 'tablet-wide', 'desktop'],
    hash: '#/spending/transactions?tab=import',
    title: 'Unosi',
    run: spendingImportRefusedFlowIn('hr', SPENDING_IMPORT_SAMPLES),
    modes: ['drive'],
    queries: { drive: '&spending=statements&lang=hr' },
  },
  {
    name: 'spending-import-missing-bank',
    viewports: DESIGN_REVIEW_VIEWPORTS,
    hash: '#/spending/transactions?tab=import',
    title: 'Entries',
    run: spendingImportMissingBankFlowIn('en', SPENDING_IMPORT_SAMPLES),
    modes: ['drive'],
    queries: { drive: '&spending=statements&banksync=saved' },
  },
  {
    name: 'spending-import-missing-bank-croatian',
    viewports: DESIGN_REVIEW_VIEWPORTS,
    hash: '#/spending/transactions?tab=import',
    title: 'Unosi',
    run: spendingImportMissingBankFlowIn('hr', SPENDING_IMPORT_SAMPLES),
    modes: ['drive'],
    queries: { drive: '&spending=statements&banksync=saved&lang=hr' },
  },
  {
    name: 'spending-import-missing-croatian',
    viewports: ['phone', 'small-tablet', 'tablet-wide', 'desktop'],
    hash: '#/spending/transactions?tab=import',
    title: 'Unosi',
    run: spendingImportMissingFlowIn('hr', SPENDING_IMPORT_SAMPLES),
    modes: ['drive'],
    queries: { drive: '&spending=statements&lang=hr' },
  },
  {
    name: 'spending-import-synced-lookalike',
    viewports: DESIGN_REVIEW_VIEWPORTS,
    hash: '#/spending/transactions?tab=import',
    title: 'Entries',
    run: spendingImportSyncedLookAlikeFlowIn('en', SPENDING_IMPORT_SAMPLES),
    modes: ['drive'],
    queries: { drive: '&spending=synced' },
  },
  {
    name: 'spending-import-synced-lookalike-croatian',
    viewports: DESIGN_REVIEW_VIEWPORTS,
    hash: '#/spending/transactions?tab=import',
    title: 'Unosi',
    run: spendingImportSyncedLookAlikeFlowIn('hr', SPENDING_IMPORT_SAMPLES),
    modes: ['drive'],
    queries: { drive: '&spending=synced&lang=hr' },
  },
  {
    name: 'spending-import-lookalike-croatian',
    viewports: DESIGN_REVIEW_VIEWPORTS,
    hash: '#/spending/transactions?tab=import',
    title: 'Unosi',
    run: spendingImportLookAlikeFlowIn('hr', SPENDING_IMPORT_SAMPLES),
    modes: ['drive'],
    queries: { drive: '&spending=copied&lang=hr' },
  },
  {
    name: 'spending-import-missing-savings-croatian',
    viewports: ['phone', 'small-tablet', 'tablet-wide', 'desktop'],
    hash: '#/spending/transactions?tab=import',
    title: 'Unosi',
    run: spendingImportMissingSavingsFlowIn('hr', SPENDING_IMPORT_SAMPLES),
    modes: ['drive'],
    queries: { drive: '&spending=statements&lang=hr' },
  },
  {
    name: 'spending-review-editor-croatian',
    hash: '#/spending/transactions?tab=review',
    title: 'Unosi',
    run: spendingReviewFlowIn('hr'),
    modes: ['drive'],
    queries: { drive: '&spending=statements&lang=hr' },
  },
  {
    name: 'spending-rule-editor-croatian',
    hash: '#/spending/transactions?tab=review',
    title: 'Unosi',
    run: spendingRuleFlowIn('hr'),
    modes: ['drive'],
    queries: { drive: '&spending=statements&lang=hr' },
  },
  {
    name: 'spending-rules-add-croatian',
    hash: '#/spending/settings?tab=rules',
    title: 'Postavke',
    run: spendingRulesAddFlowIn('hr'),
    viewports: ['phone', 'small-tablet', 'tablet-wide', 'desktop'],
    modes: ['drive'],
    queries: { drive: '&spending=statements&lang=hr' },
  },
  {
    name: 'spending-credit-transfer-editor-croatian',
    hash: '#/spending/transactions',
    title: 'Unosi',
    run: spendingCreditToTransferFlowIn('hr'),
    modes: ['drive'],
    queries: { drive: '&spending=sample&lang=hr' },
  },
  { name: 'spending-delete-note-croatian', hash: '#/spending/transactions', title: 'Unosi', run: spendingDeleteNoteFlowIn('hr'), modes: ['drive'], queries: { drive: '&spending=statements&lang=hr' } },
  {
    name: 'spending-entry-editor-croatian',
    hash: '#/spending/transactions',
    title: 'Unosi',
    run: spendingEntryFlowIn('hr'),
    modes: ['drive'],
    queries: { drive: '&spending=sample&lang=hr', browser: '&fake=browser&spending=sample&lang=hr' },
  },
  {
    name: 'spending-transfer-editor-croatian',
    hash: '#/spending/accounts',
    title: 'Računi',
    run: spendingTransferFlowIn('hr'),
    modes: ['drive'],
    queries: { drive: '&spending=sample&lang=hr', browser: '&fake=browser&spending=sample&lang=hr' },
  },
  {
    name: 'spending-category-editor-croatian',
    hash: '#/spending/settings',
    title: 'Postavke',
    run: spendingCategoryFlowIn('hr'),
    modes: ['drive'],
    queries: { drive: '&spending=sample&lang=hr', browser: '&fake=browser&spending=sample&lang=hr' },
  },
  {
    name: 'spending-limit-editor-croatian',
    hash: '#/spending/budgets',
    title: 'Ograničenja',
    run: spendingLimitFlowIn('hr'),
    modes: ['drive'],
    queries: { drive: '&spending=sample&lang=hr', browser: '&fake=browser&spending=sample&lang=hr' },
  },
  {
    name: 'spending-start-on-drive',
    hash: '#/spending/start?step=folder',
    title: 'Spending',
    run: firstRunOnDriveFlowIn('spending', 'en'),
    modes: ['drive'],
    queries: { drive: '&spending=other-device' },
  },
  {
    name: 'spending-start-on-drive-croatian',
    hash: '#/spending/start?step=folder',
    title: 'Potrošnja',
    run: firstRunOnDriveFlowIn('spending', 'hr'),
    modes: ['drive'],
    queries: { drive: '&spending=other-device&lang=hr' },
  },
  { name: 'spending-browser', hash: '#/spending', title: 'Spending', run: firstRunBrowserFlowIn('spending', 'en'), modes: ['browser'] },
  { name: 'spending-browser-croatian', hash: '#/spending', title: 'Potrošnja', run: firstRunBrowserFlowIn('spending', 'hr'), modes: ['browser'], queries: { browser: '&fake=browser&lang=hr' } },
  {
    name: 'loans-scenarios-flow-croatian',
    hash: '#/loans/scenarios',
    title: 'Scenariji',
    run: loansScenariosFlowIn('hr', SAMPLE_BANK_LOAN),
    modes: ['drive'],
    queries: { drive: '&loans=sample&lang=hr' },
  },
  { name: 'loans-what-if', hash: `#/loans/bank-loan?loan=${SAMPLE_BANK_LOAN}`, title: 'Home loan', run: loansWhatIfFlow, modes: ['drive'], queries: { drive: '&loans=sample&investments=sample' } },
  {
    name: 'loans-what-if-croatian',
    hash: `#/loans/bank-loan?loan=${SAMPLE_BANK_LOAN}`,
    title: 'Home loan',
    run: loansWhatIfFlowIn('hr'),
    viewports: EVERY_VIEWPORT,
    modes: ['drive'],
    queries: { drive: '&loans=sample&lang=hr' },
  },
  {
    name: 'loans-scenarios-flow',
    hash: '#/loans/scenarios',
    title: 'Scenarios',
    run: loansScenariosFlow,
    viewports: ['phone', 'phone-large', 'desktop'],
    modes: ['drive'],
    queries: { drive: '&loans=sample' },
  },
  {
    name: 'loans-scenario-editor',
    hash: '#/loans/scenarios',
    title: 'Scenarios',
    run: loansScenarioEditorFlow,
    viewports: ['phone', 'phone-large', 'desktop'],
    modes: ['drive'],
    queries: { drive: '&loans=sample' },
  },
  {
    name: 'loans-saved-tries',
    hash: `#/loans/bank-loan?loan=${SAMPLE_BANK_LOAN}`,
    title: 'Home loan',
    run: loansSavedTriesFlow,
    modes: ['drive'],
    queries: { drive: '&loans=sample&investments=sample' },
  },
  {
    name: 'dialog-newer-file-entry',
    hash: '#/spending/transactions',
    title: 'Entries',
    run: newerFileDialogFlowIn('en'),
    viewports: EVERY_VIEWPORT,
    modes: ['drive'],
    queries: { drive: '&spending=newer-file' },
  },
  {
    name: 'dialog-newer-file-entry-croatian',
    hash: '#/spending/transactions',
    title: 'Unosi',
    run: newerFileDialogFlowIn('hr'),
    viewports: EVERY_VIEWPORT,
    modes: ['drive'],
    queries: { drive: '&spending=newer-file&lang=hr' },
  },
  { name: 'dialogs-loans', hash: '#/loans', title: 'Overview', run: loansDialogsFlow, viewports: EVERY_VIEWPORT, modes: ['drive'], queries: { drive: '&loans=sample&investments=sample' } },
  { name: 'dialogs-loans-croatian', hash: '#/loans', title: 'Pregled', run: loansDialogsFlowIn('hr'), viewports: EVERY_VIEWPORT, modes: ['drive'], queries: { drive: '&loans=sample&lang=hr' } },
  { name: 'investments-editor', hash: '#/investments/transactions', title: 'Transactions', run: investmentsEditorFlow, modes: ['drive'], queries: { drive: '&investments=partial-history' } },
  {
    name: 'dialogs-investments',
    hash: '#/investments/transactions',
    title: 'Transactions',
    run: investmentsDialogsFlow,
    viewports: EVERY_VIEWPORT,
    modes: ['drive'],
    queries: { drive: '&investments=partial-history' },
  },
  {
    name: 'investments-import',
    hash: '#/investments',
    title: 'Overview',
    run: investmentsImportFlowIn('en', WORKBOOK_SAMPLES),
    viewports: EVERY_VIEWPORT,
    modes: ['drive'],
    queries: { drive: '&investments=drive&prices=sample' },
  },
  {
    name: 'investments-import-croatian',
    hash: '#/investments',
    title: 'Pregled',
    run: investmentsImportFlowIn('hr', WORKBOOK_SAMPLES),
    viewports: EVERY_VIEWPORT,
    modes: ['drive'],
    queries: { drive: '&investments=drive&prices=sample&lang=hr' },
  },
  {
    name: 'investments-mail',
    hash: '#/investments',
    title: 'Overview',
    run: investmentsMailFlowIn('en', 'plain'),
    viewports: MENU_VIEWPORTS,
    modes: ['drive'],
    queries: { drive: '&investments=mail&prices=sample' },
  },
  {
    name: 'investments-mail-croatian',
    hash: '#/investments',
    title: 'Pregled',
    run: investmentsMailFlowIn('hr', 'plain'),
    viewports: MENU_VIEWPORTS,
    modes: ['drive'],
    queries: { drive: '&investments=mail&prices=sample&lang=hr' },
  },
  {
    name: 'investments-mail-typed',
    hash: '#/investments',
    title: 'Overview',
    run: investmentsMailFlowIn('en', 'typed'),
    viewports: MENU_VIEWPORTS,
    modes: ['drive'],
    queries: { drive: '&investments=mail-typed&prices=sample' },
  },
  {
    name: 'investments-mail-typed-croatian',
    hash: '#/investments',
    title: 'Pregled',
    run: investmentsMailFlowIn('hr', 'typed'),
    viewports: MENU_VIEWPORTS,
    modes: ['drive'],
    queries: { drive: '&investments=mail-typed&prices=sample&lang=hr' },
  },
  {
    name: 'investments-mail-unseen',
    hash: '#/investments',
    title: 'Overview',
    run: investmentsMailFlowIn('en', 'unseen'),
    viewports: MENU_VIEWPORTS,
    modes: ['drive'],
    queries: { drive: '&investments=mail&prices=sample&fake=flex-unseen' },
  },
  {
    name: 'investments-mail-unseen-croatian',
    hash: '#/investments',
    title: 'Pregled',
    run: investmentsMailFlowIn('hr', 'unseen'),
    viewports: MENU_VIEWPORTS,
    modes: ['drive'],
    queries: { drive: '&investments=mail&prices=sample&fake=flex-unseen&lang=hr' },
  },
  {
    name: 'investments-mail-misfit',
    hash: '#/investments',
    title: 'Overview',
    run: investmentsMailFlowIn('en', 'misfit'),
    viewports: MENU_VIEWPORTS,
    modes: ['drive'],
    queries: { drive: '&investments=mail&prices=sample&fake=flex-misfit' },
  },
  {
    name: 'investments-mail-misfit-croatian',
    hash: '#/investments',
    title: 'Pregled',
    run: investmentsMailFlowIn('hr', 'misfit'),
    viewports: MENU_VIEWPORTS,
    modes: ['drive'],
    queries: { drive: '&investments=mail&prices=sample&fake=flex-misfit&lang=hr' },
  },
  {
    name: 'investments-mail-card',
    hash: '#/investments/settings?tab=general#mail',
    title: 'Settings',
    run: investmentsMailCardFlowIn('en'),
    viewports: MENU_VIEWPORTS,
    modes: ['drive'],
    queries: { drive: '&investments=partial-history' },
  },
  {
    name: 'investments-mail-upload',
    hash: '#/investments/settings?tab=general#mail',
    title: 'Settings',
    run: investmentsMailUploadFlowIn('en', FLEX_REPORT_SAMPLES),
    viewports: MENU_VIEWPORTS,
    modes: ['drive'],
    queries: { drive: '&investments=partial-history' },
  },
  {
    name: 'investments-mail-upload-croatian',
    hash: '#/investments/settings?tab=general#mail',
    title: 'Postavke',
    run: investmentsMailUploadFlowIn('hr', FLEX_REPORT_SAMPLES),
    viewports: MENU_VIEWPORTS,
    modes: ['drive'],
    queries: { drive: '&investments=partial-history&lang=hr' },
  },
  {
    name: 'investments-mail-card-croatian',
    hash: '#/investments/settings?tab=general#mail',
    title: 'Postavke',
    run: investmentsMailCardFlowIn('hr'),
    viewports: MENU_VIEWPORTS,
    modes: ['drive'],
    queries: { drive: '&investments=partial-history&lang=hr' },
  },
  {
    name: 'investments-closes-import',
    hash: '#/investments/settings?tab=prices',
    title: 'Settings',
    run: investmentsClosesImportFlowIn('en', CLOSES_SAMPLES),
    viewports: EVERY_VIEWPORT,
    modes: ['drive'],
    queries: { drive: '&investments=partial-history' },
  },
  {
    name: 'investments-closes-import-croatian',
    hash: '#/investments/settings?tab=prices',
    title: 'Postavke',
    run: investmentsClosesImportFlowIn('hr', CLOSES_SAMPLES),
    viewports: EVERY_VIEWPORT,
    modes: ['drive'],
    queries: { drive: '&investments=partial-history&lang=hr' },
  },
  {
    name: 'delete-data-drive',
    hash: '#/investments/settings',
    title: 'Settings',
    run: deleteDataDriveFlowIn('en'),
    viewports: EVERY_VIEWPORT,
    modes: ['drive'],
    queries: { drive: '&investments=sample&keys=other-browser' },
  },
  {
    name: 'delete-data-drive-croatian',
    hash: '#/investments/settings',
    title: 'Postavke',
    run: deleteDataDriveFlowIn('hr'),
    viewports: EVERY_VIEWPORT,
    modes: ['drive'],
    queries: { drive: '&investments=sample&keys=other-browser&lang=hr' },
  },
  {
    name: 'delete-data-copy',
    hash: '#/investments/settings',
    title: 'Settings',
    run: deleteDataCopyFlow,
    viewports: EVERY_VIEWPORT,
    modes: ['drive'],
    queries: { drive: '&investments=partial-history' },
  },
  {
    name: 'delete-data-given',
    hash: '#/investments/settings',
    title: 'Settings',
    run: deleteDataGivenFlowIn('en'),
    viewports: EVERY_VIEWPORT,
    modes: ['drive'],
    queries: { drive: '&investments=given' },
  },
  {
    name: 'delete-data-given-croatian',
    hash: '#/investments/settings',
    title: 'Postavke',
    run: deleteDataGivenFlowIn('hr'),
    viewports: EVERY_VIEWPORT,
    modes: ['drive'],
    queries: { drive: '&investments=given&lang=hr' },
  },
  {
    name: 'delete-data-browser',
    hash: '#/investments/settings',
    title: 'Settings',
    run: deleteDataBrowserFlow,
    viewports: EVERY_VIEWPORT,
    modes: ['drive'],
    queries: { drive: '&investments=browser' },
  },
  {
    name: 'delete-kuna',
    hash: '#/settings',
    title: 'Kuna settings',
    run: deleteKunaFlowIn('en'),
    viewports: EVERY_VIEWPORT,
    modes: ['drive'],
    queries: { drive: '&investments=browser&backups' },
  },
  {
    name: 'delete-kuna-croatian',
    hash: '#/settings',
    title: 'Postavke Kune',
    run: deleteKunaFlowIn('hr'),
    viewports: EVERY_VIEWPORT,
    modes: ['drive'],
    queries: { drive: '&investments=browser&backups&lang=hr' },
  },
  {
    name: 'delete-kuna-fails',
    hash: '#/settings',
    title: 'Kuna settings',
    run: deleteKunaFailsFlowIn('en'),
    viewports: EVERY_VIEWPORT,
    modes: ['drive'],
    queries: { drive: '&investments=given' },
  },
  {
    name: 'delete-kuna-fails-croatian',
    hash: '#/settings',
    title: 'Postavke Kune',
    run: deleteKunaFailsFlowIn('hr'),
    viewports: EVERY_VIEWPORT,
    modes: ['drive'],
    queries: { drive: '&investments=given&lang=hr' },
  },
  {
    name: 'investments-holding-dot-hover',
    hash: `#/investments/holding?instrument=${SAMPLE_SHARE_A}`,
    title: SAMPLE_SHARE_A_PAGE.name,
    run: investmentsHoldingDotHoverFlow,
    viewports: ['desktop'],
    modes: ['drive'],
    queries: { drive: '&investments=partial-history' },
  },
  { name: 'investments-binned', hash: '#/investments', title: 'Overview', run: investmentsBinnedFlow, viewports: EVERY_VIEWPORT, modes: ['drive'], queries: { drive: '&investments=binned' } },
  {
    name: 'investments-instrument-search',
    hash: '#/investments/settings',
    title: 'Settings',
    run: investmentsInstrumentSearchFlowIn('en'),
    viewports: EVERY_VIEWPORT,
    modes: ['drive'],
    queries: { drive: '&investments=partial-history' },
  },
  {
    name: 'investments-instrument-search-croatian',
    hash: '#/investments/settings',
    title: 'Postavke',
    run: investmentsInstrumentSearchFlowIn('hr'),
    viewports: EVERY_VIEWPORT,
    modes: ['drive'],
    queries: { drive: '&investments=partial-history&lang=hr' },
  },
  {
    name: 'investments-instrument-bond',
    hash: '#/investments/settings',
    title: 'Settings',
    run: investmentsBondFlowIn('en'),
    viewports: EVERY_VIEWPORT,
    modes: ['drive'],
    queries: { drive: '&investments=partial-history' },
  },
  {
    name: 'investments-instrument-bond-croatian',
    hash: '#/investments/settings',
    title: 'Postavke',
    run: investmentsBondFlowIn('hr'),
    viewports: EVERY_VIEWPORT,
    modes: ['drive'],
    queries: { drive: '&investments=partial-history&lang=hr' },
  },
  {
    name: 'dialogs-investments-croatian',
    hash: '#/investments/transactions',
    title: 'Transakcije',
    run: investmentsDialogsFlowIn('hr'),
    viewports: EVERY_VIEWPORT,
    modes: ['drive'],
    queries: { drive: '&investments=partial-history&lang=hr' },
  },
  { name: 'category-picker', hash: '#/company/transactions?tab=review', title: 'Transactions', run: categoryPickerFlowIn('en'), viewports: MENU_VIEWPORTS, modes: ['drive'] },
  {
    name: 'category-picker-croatian',
    hash: '#/company/transactions?tab=review',
    title: 'Transakcije',
    run: categoryPickerFlowIn('hr'),
    viewports: MENU_VIEWPORTS,
    modes: ['drive'],
    queries: { drive: '&lang=hr' },
  },
  {
    name: 'menus-company',
    hash: '#/company/transactions?p=all',
    title: 'Transactions',
    run: screenMenusFlow([
      { hash: '#/company/transactions?p=all', title: 'Transactions' },
      { hash: '#/company/transactions?tab=import', title: 'Transactions' },
      { hash: '#/company/invoicing?p=all', title: 'Invoicing' },
      { hash: '#/company/settings', title: 'Settings' },
      { hash: '#/company/settings?tab=categories', title: 'Settings' },
      { hash: '#/company/owner?tab=owed', title: 'Owner' },
    ]),
    viewports: MENU_VIEWPORTS,
    modes: ['drive'],
  },
  {
    name: 'menus-spending',
    hash: '#/spending/transactions',
    title: 'Entries',
    run: screenMenusFlow([
      { hash: '#/spending/transactions', title: 'Entries', dialogs: ['[data-testid="spending-add-entry"]'] },
      { hash: '#/spending/transactions?tab=review', title: 'Entries' },
      { hash: '#/spending/budgets', title: 'Limits' },
    ]),
    viewports: MENU_VIEWPORTS,
    modes: ['drive'],
    queries: { drive: '&spending=statements' },
  },
  {
    name: 'menus-investments',
    hash: '#/investments/transactions',
    title: 'Transactions',
    run: screenMenusFlow([
      { hash: '#/investments/transactions', title: 'Transactions' },
      { hash: '#/investments/holdings', title: 'Holdings' },
      { hash: '#/investments/performance', title: 'Performance' },
      { hash: '#/investments/tax?year=2026', title: 'Tax' },
      { hash: '#/investments/settings', title: 'Settings' },
    ]),
    viewports: MENU_VIEWPORTS,
    modes: ['drive'],
    queries: { drive: '&investments=partial-history' },
  },
  {
    name: 'menus-loans',
    hash: '#/loans',
    title: 'Overview',
    run: screenMenusFlow([{ hash: `#/loans/bank-loan?loan=${SAMPLE_BANK_LOAN}`, shows: '[data-testid="loan-subsidy"]' }]),
    viewports: MENU_VIEWPORTS,
    modes: ['drive'],
    queries: { drive: '&loans=sample' },
  },
  {
    name: 'menus-assets',
    hash: '#/assets',
    title: 'Overview',
    run: screenMenusFlow([{ hash: '#/assets', title: 'Overview', dialogs: ['[data-testid="add-asset"]'] }]),
    viewports: MENU_VIEWPORTS,
    modes: ['drive'],
    queries: { drive: '&assets=sample&loans=sample' },
  },
  {
    name: 'menus-kuna',
    hash: '#/settings',
    title: 'Kuna settings',
    run: screenMenusFlow([{ hash: '#/settings', title: 'Kuna settings' }]),
    viewports: MENU_VIEWPORTS,
    modes: ['drive'],
  },
  { name: 'dialogs-company', hash: '#/company/invoicing?p=all', title: 'Invoicing', run: companyDialogsFlow, viewports: EVERY_VIEWPORT, modes: ['drive'] },
  {
    name: 'dialogs-company-croatian',
    hash: '#/company/invoicing?p=all',
    title: 'Računi',
    run: companyDialogsFlowIn('hr'),
    viewports: EVERY_VIEWPORT,
    modes: ['drive'],
    queries: { drive: '&lang=hr' },
  },
  {
    name: 'dialogs-rows-croatian',
    hash: '#/company/transactions?p=all&q=GADGET',
    title: 'Transakcije',
    run: rowsDialogsFlowIn('hr'),
    viewports: ['phone', 'tablet', 'desktop'],
    queries: { drive: '&lang=hr', browser: '&fake=browser&lang=hr' },
  },
  { name: 'app-menu', hash: '#/loans', title: 'Overview', run: appMenuFlow, queries: { drive: '&loans=drive&start=drive', browser: '&fake=browser&loans=browser&start=drive' } },
  {
    name: 'app-menu-croatian',
    hash: '#/loans',
    title: 'Pregled',
    run: appMenuFlowIn('hr'),
    viewports: EVERY_VIEWPORT,
    queries: { drive: '&loans=drive&lang=hr&start=drive', browser: '&fake=browser&loans=browser&lang=hr&start=drive' },
  },
  { name: 'sidebar-one-app', hash: '#/company', title: 'Overview', run: sidebarAdjustsFlowIn('en', ['company']), modes: ['drive'], queries: { drive: '&start=drive' } },
  { name: 'sidebar-one-app-croatian', hash: '#/company', title: 'Pregled', run: sidebarAdjustsFlowIn('hr', ['company']), modes: ['drive'], queries: { drive: '&lang=hr&start=drive' } },
  { name: 'sidebar-file-opening', hash: '#/company', title: 'Overview', run: sidebarAdjustsFlowIn('en', ['company', 'loans']), modes: ['drive'], queries: { drive: '&loans=opening&start=drive' } },
  { name: 'sidebar-file-failed', hash: '#/company', title: 'Overview', run: sidebarAdjustsFlowIn('en', ['company', 'loans']), modes: ['drive'], queries: { drive: '&loans=failed&start=drive' } },
  {
    name: 'sidebar-file-failed-croatian',
    hash: '#/company',
    title: 'Pregled',
    run: sidebarAdjustsFlowIn('hr', ['company', 'loans']),
    modes: ['drive'],
    queries: { drive: '&loans=failed&lang=hr&start=drive' },
  },
  { name: 'sidebar-dead-address', hash: '#/company/no-such-screen', title: 'All apps', run: sidebarDeadAddressFlow, viewports: ['desktop'], modes: ['drive'], queries: { drive: '' } },
  ...['expanded', 'icons', 'hidden'].flatMap((choice) =>
    [false, true].map((chat) => ({
      name: `sidebar-${choice}${chat ? '-chat' : ''}`,
      hash: '#/company',
      title: 'Overview',
      run: sidebarStateFlowIn(choice, { chat }),
      viewports: SIDEBAR_VIEWPORTS,
      modes: ['drive'],
      queries: { drive: '' },
    })),
  ),
  ...[
    ['expanded', false],
    ['icons', true],
    ['hidden', true],
  ].map(([choice, chat]) => ({
    name: `sidebar-${choice}${chat ? '-chat' : ''}-croatian`,
    hash: '#/company',
    title: 'Pregled',
    run: sidebarStateFlowIn(choice, { chat, language: 'hr' }),
    viewports: SIDEBAR_VIEWPORTS,
    modes: ['drive'],
    queries: { drive: '&lang=hr' },
  })),
  { name: 'sidebar-room-warning', hash: '#/company', title: 'Overview', run: sidebarRoomWarningFlowIn('en'), viewports: ['desktop'], modes: ['drive'], queries: { drive: '' } },
  { name: 'sidebar-room-warning-croatian', hash: '#/company', title: 'Pregled', run: sidebarRoomWarningFlowIn('hr'), viewports: ['desktop'], modes: ['drive'], queries: { drive: '&lang=hr' } },
  { name: 'chat-resize', hash: '#/company', title: 'Overview', run: chatResizeFlow(), viewports: ['wide'], modes: ['drive'], queries: { drive: '' } },
  { name: 'shell-squeeze', hash: '#/company', title: 'Overview', run: shellSqueezeFlow(), viewports: ['wide'], modes: ['drive'], queries: { drive: '' } },
  {
    name: 'menu-lit',
    hash: '#/company',
    title: 'Overview',
    run: menuLitFlow(),
    viewports: ['desktop'],
    modes: ['drive'],
    queries: { drive: '&loans=sample&investments=sample&assets=sample&spending=sample' },
  },
  { name: 'skip-link', hash: '#/company', title: 'Overview', run: skipLinkFlow(), viewports: ['phone', 'desktop'], modes: ['drive'], queries: { drive: '' } },
  { name: 'quick-jump', hash: '#/company', title: 'Overview', run: quickJumpFlowIn('en'), viewports: ['phone', 'desktop'], modes: ['drive'], queries: { drive: '' } },
  { name: 'quick-jump-croatian', hash: '#/company', title: 'Pregled', run: quickJumpFlowIn('hr'), viewports: ['desktop'], modes: ['drive'], queries: { drive: '&lang=hr' } },
  {
    name: 'sidebar-fit',
    hash: '#/company',
    title: 'Overview',
    run: sidebarFitFlowIn('en'),
    viewports: ['laptop'],
    modes: ['browser'],
    queries: { browser: '&fake=browser&loans=sample&investments=sample&assets=sample&spending=sample' },
  },
  {
    name: 'sidebar-fit-croatian',
    hash: '#/company',
    title: 'Pregled',
    run: sidebarFitFlowIn('hr'),
    viewports: ['laptop'],
    modes: ['browser'],
    queries: { browser: '&fake=browser&loans=sample&investments=sample&assets=sample&spending=sample&lang=hr' },
  },
  { name: 'home', hash: '#/', title: 'All apps', run: homeFlow, modes: ['drive'], queries: { drive: '&loans=sample&investments=sample&assets=sample&spending=sample' } },
  { name: 'home-browser', hash: '#/', title: 'All apps', run: homeFlow, modes: ['browser'], queries: { browser: '&fake=browser&loans=sample&investments=sample&assets=sample&spending=sample' } },
  { name: 'home-set-up', hash: '#/', title: 'Welcome to Kuna', run: setUpFlow, modes: ['drive'], queries: { drive: '&fake=empty' } },
  {
    name: 'home-flow-croatian',
    hash: '#/',
    title: 'Sve aplikacije',
    run: homeFlowIn('hr'),
    modes: ['drive'],
    queries: { drive: '&loans=sample&investments=sample&assets=sample&spending=sample&lang=hr' },
  },
  {
    name: 'home-browser-croatian',
    hash: '#/',
    title: 'Sve aplikacije',
    run: homeFlowIn('hr'),
    modes: ['browser'],
    queries: { browser: '&fake=browser&loans=sample&investments=sample&assets=sample&spending=sample&lang=hr' },
  },
  { name: 'home-set-up-croatian', hash: '#/', title: 'Dobrodošli u Kunu', run: setUpFlowIn('hr'), modes: ['drive'], queries: { drive: '&fake=empty&lang=hr' } },
  { name: 'move-browser', hash: '#/company/settings?tab=books', title: 'Settings', run: moveFromBrowserFlow, modes: ['browser'] },
  { name: 'move-browser-croatian', hash: '#/company/settings?tab=books', title: 'Postavke', run: moveFromBrowserFlowIn('hr'), modes: ['browser'], queries: { browser: '&fake=browser&lang=hr' } },
  { name: 'race', hash: '#/company/transactions?tab=review', title: 'Transactions', run: raceFlow, modes: ['drive'], queries: { drive: '&fake=race' } },
  { name: 'race-croatian', hash: '#/company/transactions?tab=review', title: 'Transakcije', run: raceFlowIn('hr'), modes: ['drive'], queries: { drive: '&fake=race&lang=hr' } },
  { name: 'kuna-settings-assist-failed', hash: '#/settings', title: 'Kuna settings', run: assistKeyRefusedFlowIn('en'), modes: ['drive'], queries: { drive: '&ai=key-refused' } },
  { name: 'kuna-settings-assist-failed-croatian', hash: '#/settings', title: 'Postavke Kune', run: assistKeyRefusedFlowIn('hr'), modes: ['drive'], queries: { drive: '&ai=key-refused&lang=hr' } },
  { name: 'kuna-settings-provider-switch', hash: '#/settings', title: 'Kuna settings', run: assistProviderSwitchFlowIn('en'), modes: ['drive'], viewports: DESIGN_REVIEW_VIEWPORTS },
  {
    name: 'kuna-settings-provider-switch-croatian',
    hash: '#/settings',
    title: 'Postavke Kune',
    run: assistProviderSwitchFlowIn('hr'),
    modes: ['drive'],
    viewports: DESIGN_REVIEW_VIEWPORTS,
    queries: { drive: '&lang=hr' },
  },

  {
    name: 'kuna-settings-delete-keys',
    hash: '#/settings',
    title: 'Kuna settings',
    run: deleteKeysFlowIn('en'),
    viewports: EVERY_VIEWPORT,
    modes: ['drive'],
  },
  {
    name: 'kuna-settings-delete-keys-croatian',
    hash: '#/settings',
    title: 'Postavke Kune',
    run: deleteKeysFlowIn('hr'),
    viewports: EVERY_VIEWPORT,
    modes: ['drive'],
    queries: { drive: '&lang=hr' },
  },
  { name: 'owner-figure-ask', hash: '#/company/owner?p=all', title: 'Owner', run: figureAskFlowIn('en', 'owner'), viewports: DESIGN_REVIEW_VIEWPORTS, modes: ['browser'] },
  {
    name: 'owner-figure-ask-croatian',
    hash: '#/company/owner?p=all',
    title: 'Vlasnik',
    run: figureAskFlowIn('hr', 'owner'),
    viewports: DESIGN_REVIEW_VIEWPORTS,
    modes: ['browser'],
    queries: { browser: '&fake=browser&lang=hr' },
  },
  {
    name: 'salaries-figure-ask',
    hash: '#/company/salaries',
    title: 'Salaries',
    run: figureAskFlowIn('en', 'salaries'),
    viewports: DESIGN_REVIEW_VIEWPORTS,
    modes: ['drive'],
    queries: { drive: '&fake=five-employees' },
  },
  {
    name: 'salaries-figure-ask-croatian',
    hash: '#/company/salaries',
    title: 'Plaće',
    run: figureAskFlowIn('hr', 'salaries'),
    viewports: DESIGN_REVIEW_VIEWPORTS,
    modes: ['drive'],
    queries: { drive: '&fake=five-employees&lang=hr' },
  },
  { name: 'pay-figure-ask', hash: '#/company/year?year=2027&tab=pay', title: 'Year', run: figureAskFlowIn('en', 'pay'), viewports: DESIGN_REVIEW_VIEWPORTS, modes: ['browser'] },
  {
    name: 'year-open-items-figure-ask',
    hash: '#/company/year?year=2025',
    title: 'Year',
    run: figureAskFlowIn('en', 'open-items'),
    viewports: DESIGN_REVIEW_VIEWPORTS,
    modes: ['browser'],
  },
  {
    name: 'year-open-items-figure-ask-croatian',
    hash: '#/company/year?year=2025',
    title: 'Godina',
    run: figureAskFlowIn('hr', 'open-items'),
    viewports: DESIGN_REVIEW_VIEWPORTS,
    modes: ['browser'],
    queries: { browser: '&fake=browser&lang=hr' },
  },
  {
    name: 'pay-figure-ask-croatian',
    hash: '#/company/year?year=2027&tab=pay',
    title: 'Godina',
    run: figureAskFlowIn('hr', 'pay'),
    viewports: DESIGN_REVIEW_VIEWPORTS,
    modes: ['browser'],
    queries: { browser: '&fake=browser&lang=hr' },
  },
]
const MODES = [
  { name: 'drive', query: '' },
  { name: 'browser', query: '&fake=browser' },
]

const chosenVisits = VISITS.filter((visit) => selection.takes(visit.name))
const chosenFlows = FLOWS.filter((flow) => selection.takes(flow.name))
const unmatched = selection.unmatched()
if (unmatched !== null) {
  console.error(unmatched)
  process.exit(2)
}
// Screens and flows are dealt out as one list, since a flow takes far longer than a screen.
const shared = selection.share([...chosenVisits, ...chosenFlows].map((checked) => checked.name))
const visits = chosenVisits.filter((visit) => shared.has(visit.name))
const flows = chosenFlows.filter((flow) => shared.has(flow.name))
// A flow that fails fails the run and leaves a `-failed` shot. One left by an earlier run is removed, so a review never reads it as this run's.
for (const stale of readdirSync(SCREENSHOT_DIR).filter((file) => flows.some((flow) => file.includes(`-${flow.name}-failed-`)))) {
  rmSync(join(SCREENSHOT_DIR, stale))
}

const browser = await launch(chromeLaunch(selection.classicScrollbars))
let checked = 0

/**
 * The gutter this browser keeps beside the shell from the phone step up, in px. A docked viewport names the shell's width,
 * so its window is wider by this much, as a person's with a classic scrollbar is. Linux Chrome keeps one even for a hidden scrollbar.
 */
async function shellGutter() {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  if (selection.classicScrollbars) await floatPhoneScrollbars(page)
  await page.setViewport({ width: 1024, height: 768 })
  await page.goto(BASE, { waitUntil: 'load' })
  const kept = await page.evaluate(() => window.innerWidth - document.body.clientWidth)
  await context.close()
  return kept
}
const gutter = VIEWPORTS.some((viewport) => viewport.chatDocked && selection.takesWidth(viewport.width)) ? await shellGutter() : 0

for (const viewport of VIEWPORTS.filter((candidate) => selection.takesWidth(candidate.width))) {
  for (const visit of visits) {
    if (!selection.takesTheme(visit.theme, viewport.theme)) continue
    // A screen that shows what Kuna says without an AI key has no chat to dock.
    if (viewport.chatDocked && visit.keyless) continue
    const scope = `${viewport.name} ${visit.name}`
    const context = await browser.createBrowserContext()
    const page = await context.newPage()
    if (selection.classicScrollbars) await floatPhoneScrollbars(page)
    const errors = watchForErrors(page)
    const foreignRequests = watchForForeignRequests(page)

    if (visit.linkedRule || visit.linkedPart) await slowWebFonts(page)
    // A docked chat needs a key. A visit that keeps a key of its own keeps it alone, so its company stays the one in use.
    const aiKeyKept = PROVIDER_PRESETS.some((preset) => `kuna.secret.${preset.id}` in (visit.stored ?? {}))
    const stored = viewport.chatDocked && !aiKeyKept ? { 'kuna.secret.anthropic': MADE_UP_ANTHROPIC_KEY, ...visit.stored } : visit.stored
    if (stored) {
      await page.evaluateOnNewDocument((entries) => {
        for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value)
      }, stored)
    }
    if (visit.collapsedBefore || visit.expandedBefore) {
      await page.evaluateOnNewDocument(
        (collapsed, expanded) => {
          for (const card of collapsed) localStorage.setItem(`kuna.card.${card}`, 'collapsed')
          for (const card of expanded) localStorage.setItem(`kuna.card.${card}`, 'expanded')
        },
        visit.collapsedBefore ?? [],
        visit.expandedBefore ?? [],
      )
    }
    await page.setViewport({ width: viewport.chatDocked ? viewport.width + gutter : viewport.width, height: viewport.height })
    // Headless Chrome reports a light preference unless told otherwise. The pin makes the theme explicit.
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: visit.theme }])
    await page.goto(`${BASE}?theme=${visit.theme}${visit.query ? `&${visit.query}` : ''}${viewport.chatDocked ? withChatOpen(visit.hash) : visit.hash}`, { waitUntil: 'networkidle0' })

    const drawsCharts = visit.gallery || visit.charts > 0
    const ready = visit.ready ?? (drawsCharts ? '.chart-body canvas' : '[data-testid="screen-title"]')
    let rendered = await page
      .waitForSelector(ready, { timeout: 10_000 })
      .then(() => true)
      .catch(() => false)

    if (visit.upload && rendered) {
      const input = await page.$('input[data-testid="onboarding-file"]')
      await input?.uploadFile(IMPORT_FILE)
      rendered = await page
        .waitForSelector('[data-testid="import-summary"] dl', { timeout: 10_000 })
        .then(() => true)
        .catch(() => false)
      await new Promise((resolve) => setTimeout(resolve, 600))
    }

    if (visit.clickThen && rendered) {
      await page.click(visit.clickThen.click)
      rendered = await page
        .waitForFunction((gone) => document.querySelector(gone) === null, { timeout: 10_000 }, visit.clickThen.gone)
        .then(() => true)
        .catch(() => false)
      await new Promise((resolve) => setTimeout(resolve, 600))
    }

    if (visit.linkedRule && rendered) {
      await page.evaluate(() => document.fonts.ready.then(() => undefined))
      const shown = await page
        .waitForFunction(linkedRuleInView, { timeout: 5_000 }, visit.linkedRule)
        .then(() => true)
        .catch(() => false)
      if (!shown) fail(scope, `the deep link did not open ${visit.linkedRule} in the side panel and bring its line to just below the search bar, marked, once the fonts loaded`)
    }

    // The screenshot and the hole of a donut should show where the bars and rings land.
    if (rendered && (drawsCharts || (await page.$('.donut-ring canvas')) !== null)) {
      await settleCharts(page).catch(() => fail(scope, 'the charts were still moving 10 s after the screen opened'))
    }

    if (visit.linkedPart && rendered) {
      await page.evaluate(() => document.fonts.ready.then(() => undefined))
      const landed = await page
        .waitForFunction(linkedPartLanded, { timeout: 5_000 }, visit.linkedPart)
        .then(() => true)
        .catch(() => false)
      if (!landed) fail(scope, `the deep link to #${visit.linkedPart} did not open its card and bring the part to just below the top`)
    }
    if (visit.linkedCard && rendered) {
      const opened = await page.evaluate((card) => document.querySelector(`[data-card="${card}"]`)?.getAttribute('data-collapsed') === 'false', visit.linkedCard)
      if (!opened) fail(scope, `the link to the tab did not open ${visit.linkedCard}, which this device keeps collapsed`)
    }
    if (visit.linkedRow && rendered) {
      const shown = await page
        .waitForFunction(linkedRowShown, { timeout: 5_000 }, visit.linkedRow)
        .then(() => true)
        .catch(() => false)
      if (!shown) fail(scope, `the deep link did not open the collapsed card and bring ${visit.linkedRow} into view`)
    }

    const report = await readPage(page)
    // A first run draws without the shell, so it has no chat to dock.
    const framed = (await page.$('[data-testid="app-shell"]')) !== null
    if (viewport.chatDocked && rendered && framed && (await page.$('[data-testid="chat-dock"]')) === null) fail(scope, 'the chat did not dock beside the page')
    if (inCroatian(visit.query)) for (const english of await englishLeftOn(page)) fail(scope, english)
    for (const overlap of await textOverlapsOn(page)) fail(scope, overlap)
    if (!rendered) fail(scope, `nothing matched ${ready} within 10 s`)
    if (report.title !== visit.title) fail(scope, `title was ${JSON.stringify(report.title)}, expected "${visit.title}"`)
    if (report.themeClass !== visit.theme) fail(scope, `rendered ${report.themeClass}, expected the ${visit.theme} theme`)
    for (const text of [visit.shows ?? []].flat()) {
      if (!report.text.includes(text)) fail(scope, `"${text}" is missing, so the fake workbook did not reach the screen`)
    }
    for (const text of [visit.lacks ?? []].flat()) {
      if (report.text.includes(text)) fail(scope, `"${text}" shows, though the screen should no longer say it`)
    }
    const expectedCharts = visit.gallery ? GALLERY_CHARTS : visit.charts
    // With the chat open, the charts are the screen's own and those under a pane do not draw, and its cards are the screen's visit's to check.
    if (!visit.chatOpen && report.chartHeights.length !== expectedCharts) fail(scope, `drew ${report.chartHeights.length} charts, expected ${expectedCharts}`)
    const collapsed = report.chartHeights.filter((height) => height < 100)
    if (collapsed.length) fail(scope, `${collapsed.length} chart(s) drew under 100px tall: ${collapsed.join(', ')}`)
    if (visit.gallery && report.iconCount < 10) fail(scope, `only ${report.iconCount} icons rendered as SVG`)
    if (visit.gallery && (report.donutHeights.length !== GALLERY_DONUTS || report.donutHeights.some((height) => height < 150))) {
      fail(scope, `drew donuts ${report.donutHeights.map(Math.round).join(', ')} px tall, expected ${GALLERY_DONUTS} of at least 150 px`)
    }
    if (viewport.alignedCards) for (const row of report.raggedRows) fail(scope, `ragged card row: ${row}`)
    for (const row of report.unevenFieldRows) fail(scope, `uneven form row: ${row}`)
    for (const donut of report.crowdedDonuts) fail(scope, donut)
    for (const problem of [...report.offsetTables, ...report.phoneHeaderActions, ...report.wideLoneCards, ...report.drillLinksOffColour]) fail(scope, problem)
    if (REFLOW_WIDTHS.includes(viewport.width) && !viewport.chatDocked) dashboardGridsSeen.set(`${visit.name} ${viewport.width}`, { grids: report.dashboardGrids, steps: report.containerSteps })
    if (!HAND_BUILT_GRIDS_ALLOWED.some((entry) => visit.name.startsWith(entry.screen))) {
      for (const grid of report.handBuiltGrids) fail(scope, `the grid "${grid}" sets cards side by side without DashboardGrid`)
    }
    for (const wide of report.cardOverflow) {
      const allowed = SIDEWAYS_SCROLL_ALLOWED.find((entry) => entry.card === wide.card && report.contentRoom <= entry.roomUpTo)
      overflowSeen.push({ viewport: viewport.width, room: report.contentRoom, screen: visit.name, theme: visit.theme, ...wide, allowed: allowed !== undefined })
      if (!allowed) fail(scope, `"${wide.title}" is ${wide.content} px wide inside a ${wide.width} px card, by ${wide.by}`)
    }
    if (report.unrenderedIcons) fail(scope, `${report.unrenderedIcons} icon(s) did not render`)
    if (report.scrollWidth > report.clientWidth + 1) {
      fail(scope, `horizontal overflow: scrollWidth ${report.scrollWidth} > clientWidth ${report.clientWidth}`)
      if (report.overflowing.length) fail(scope, `overflowing: ${report.overflowing.join(', ')}`)
    }
    if (errors.length) fail(scope, `console errors: ${errors.slice(0, 3).join(' | ')}`)
    if (foreignRequests.length) fail(scope, `requests to other origins: ${foreignRequests.slice(0, 3).join(' | ')}`)

    await screenshotWholePage(page, join(SCREENSHOT_DIR, `${viewport.name}-${visit.file}.png`))
    if (visit.gallery && viewport.name === 'desktop') {
      const firstChart = await page.$('[data-testid="chart-card"]')
      await firstChart?.screenshot({ path: join(SCREENSHOT_DIR, `${viewport.name}-${visit.file}-chart.png`) })
    }

    // A linked rule opens its side panel over the screen, so the plain visit of that tab collapses its card instead.
    if (viewport.cardFlow && rendered && !visit.linkedRule && !visit.chatOpen) {
      const collapsible = (await page.$('[data-card]')) !== null
      if (visit.cards === false) {
        if (collapsible) fail(scope, 'has a collapsible card, so it should not say cards: false')
      } else if (!collapsible) {
        fail(scope, 'has no collapsible card. Say cards: false if none of its cards holds a long list or table')
      } else {
        await collapseAndExpand(
          page,
          (handle) => handle.click(),
          (card) => card.screenshot({ path: join(SCREENSHOT_DIR, `${viewport.name}-${visit.file}-collapsed.png`) }),
        ).catch((error) => fail(scope, error.message))
        const after = await readPage(page)
        if (after.scrollWidth > after.clientWidth + 1) fail(scope, `horizontal overflow after collapsing a card: scrollWidth ${after.scrollWidth}`)
      }
    }

    checked += 1
    console.log(
      `${`${scope} ${visit.theme}`.padEnd(34)} ${String(viewport.width).padStart(4)}px  ` +
        `scroll=${report.scrollWidth} client=${report.clientWidth}  errors=${errors.length}  ` +
        `foreign=${foreignRequests.length}  icons=${report.iconCount}`,
    )

    await context.close()
  }
}

if (REFLOW_WIDTHS.every((width) => selection.takesWidth(width))) {
  // Two grids of one screen may open with the same title, so each is known by its title and how many came before it with that title.
  const keyed = (grids) => grids.map((grid, index) => [`${grid.name} ${grids.slice(0, index).filter((other) => other.name === grid.name).length}`, grid])
  for (const name of new Set(visits.map((visit) => visit.name))) {
    for (const [narrow, wide] of REFLOW_WIDTHS.slice(1).map((width, index) => [REFLOW_WIDTHS[index], width])) {
      const before = new Map(keyed(dashboardGridsSeen.get(`${name} ${narrow}`)?.grids ?? []))
      const after = dashboardGridsSeen.get(`${name} ${wide}`) ?? { grids: [], steps: [] }
      for (const [key, grid] of keyed(after.grids)) {
        const earlier = before.get(key)
        if (grid.rows.length > 1 && earlier?.rows.join() === grid.rows.join() && after.steps.some((step) => earlier.room < step && step <= grid.room)) {
          fail(
            `${name} ${wide}px`,
            `the ${grid.layout} grid "${grid.name}" keeps ${grid.rows.join(', ')} cards a row from ${narrow} px, though its room grows from ${earlier.room} to ${grid.room} px, so it does not rearrange for the wider screen`,
          )
        }
      }
    }
  }
} else {
  console.log(`\nthe dashboard grids were not compared, which needs the widths ${REFLOW_WIDTHS.join(', ')}`)
}

for (const viewport of VIEWPORTS.filter((candidate) => selection.takesWidth(candidate.width))) {
  for (const mode of MODES) {
    for (const theme of THEMES) {
      if (!selection.takesTheme(theme, viewport.theme)) continue
      for (const flow of flows.filter((candidate) => (candidate.viewports ?? ['phone', 'desktop']).includes(viewport.name) && (candidate.modes ?? ['drive', 'browser']).includes(mode.name))) {
        const scope = `${viewport.name} ${mode.name} ${flow.name} ${theme}`
        const context = await browser.createBrowserContext()
        const page = await context.newPage()
        if (selection.classicScrollbars) await floatPhoneScrollbars(page)
        const errors = watchForErrors(page)
        const foreignRequests = watchForForeignRequests(page)
        await page.setViewport({ width: viewport.width, height: viewport.height })
        await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }])
        const file = (name) => join(SCREENSHOT_DIR, `${viewport.name}-${mode.name}-${name}-${theme}.png`)
        const query = flow.queries?.[mode.name] ?? mode.query
        const toldOnce = new Set()
        const stateCheck = async (when) => {
          const report = await readPage(page)
          if (report.scrollWidth > report.clientWidth + 1) fail(scope, `${when}: horizontal overflow, scrollWidth ${report.scrollWidth} > clientWidth ${report.clientWidth}`)
          for (const row of report.unevenFieldRows) fail(scope, `${when}: uneven form row: ${row}`)
          // A text left in English, an overlap or a card laid out off its rule stays on screen through the states after it, so each is told once.
          const lingering = [
            ...(await textOverlapsOn(page)),
            ...(inCroatian(query) ? await englishLeftOn(page) : []),
            ...report.offsetTables,
            ...report.phoneHeaderActions,
            ...report.wideLoneCards,
            ...report.drillLinksOffColour,
          ]
          for (const problem of lingering.filter((text) => !toldOnce.has(text))) {
            toldOnce.add(problem)
            fail(scope, `${when}: ${problem}`)
          }
        }
        /** A press that opens a menu looks at the open menu too, so every menu any flow opens is checked. */
        const pressLookingAtMenus = async (handle) => {
          const opensMenu = await handle.evaluate((element) => element.matches('[role="combobox"], [aria-haspopup="listbox"]') && element.getAttribute('aria-expanded') !== 'true')
          await handle.click()
          if (!opensMenu) return
          const opened = await page
            .waitForSelector('[role="listbox"]', { visible: true, timeout: 2_000 })
            .then(() => true)
            .catch(() => false)
          if (!opened) return
          await new Promise((resolve) => setTimeout(resolve, 250))
          await stateCheck('an open menu')
        }
        try {
          await page.goto(`${BASE}?theme=${theme}${query}&day=${SAMPLE_DAY}${flow.hash}`, { waitUntil: 'networkidle0' })
          await page.waitForFunction((title) => document.querySelector('[data-testid="screen-title"]')?.textContent?.trim() === title, { timeout: 10_000 }, flow.title)
          await flow.run(page, {
            press: pressLookingAtMenus,
            shoot: async (name) => {
              await stateCheck(name)
              await page.screenshot({ path: file(name) })
            },
            inspect: stateCheck,
          })
          await stateCheck('after the flow')
        } catch (error) {
          fail(scope, error.message)
          await page.screenshot({ path: file(`${flow.name}-failed`) }).catch(() => {})
        }
        if (errors.length) fail(scope, `console errors: ${errors.slice(0, 3).join(' | ')}`)
        if (foreignRequests.length) fail(scope, `requests to other origins: ${foreignRequests.slice(0, 3).join(' | ')}`)
        checked += 1
        console.log(`${scope.padEnd(44)} ${String(viewport.width).padStart(4)}px  errors=${errors.length}  foreign=${foreignRequests.length}`)
        await context.close()
      }
    }
  }
}

await browser.close()
if (checked === 0) fail(selection.summary(), 'checked nothing, since none of these screens or flows runs at these widths')

if (overflowSeen.length) {
  console.log('\ncards wider than their content:')
  for (const seen of overflowSeen) {
    console.log(
      `  ${String(seen.viewport).padStart(4)}px, ${seen.room} px of content, ${seen.screen} ${seen.theme}: "${seen.title}" ${seen.content} in ${seen.width} px, by ${seen.by}${seen.allowed ? ' (allowed)' : ''}`,
    )
  }
}

if (failures.length) {
  console.error(`\n${failures.length} problem(s):`)
  for (const failure of failures) console.error(`  ✗ ${failure}`)
  process.exit(1)
}
console.log(selection.limited ? `\nevery screen and flow of this limited run clean (${selection.summary()}). The full run without options, or all its shards, is the check` : '\nall viewports clean')
