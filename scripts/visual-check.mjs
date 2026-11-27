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
 * a DrillLink wears the colour of the text class it is given, a row that opens a page has its arrow on its title's first line, and
 * a list where only some rows open a page ends every amount at one edge.
 * A table row that opens its record shows the pointer, and a press on any of its cells without a control of its own reaches the row.
 * On Company's, Spending's and Investments' Overview, Spending's Accounts, an account's page, Entries, its To review tab and a payee's page up to 1440 px, every list row's figure starts within 40rem of its name,
 * and a row of a table under a column heading passes. At 1024, 1440 and 1920 px no row of a dashboard grid leaves more than 16 px empty.
 * On every screen, at every step of a flow and in every menu a flow opens, no text may overlap other text by more than 2 px,
 * no label may be cut to under half its width with no ellipsis, and no placeholder may be cut short, other than what `support/textOverlap.mjs` allows by name.
 * Nor may any text be cut short outside `CutText`, which shows the full text, other than what `CUT_TEXT_ALLOWED` there lists with its reason.
 * The gallery's cut text shows its full text only while cut, on hover and on keyboard focus, and the sidebar shows a long company name cut, with room above the first page and the full name on hover.
 * Transactions grouped by month, by category and by counterparty wraps each group's name below 640 px.
 * Spending's Entries opened over a span of days with a label shows the span and counts the label's total over it, and on a phone no filter chip that fits folds into +N more.
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
 * and a sponsorship to a listed club, Year's PD return shows PD lines 14 and 33.a with a caption that neither is averaged, and Sorting's Categories card,
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
 * Beside the co-owned Loans file (`?assets=co-owned&loans=co-owned`) it renders the Overview with your part of each shared asset, the flat with your part over time,
 * and the flat on the coast with your part of it and of its loan, and again beside a loan that counts whole (`&loans=one-loan`). The co-owned Loans file's Overview
 * and home loan show the bank's balance with your part, and the next payment and the plan's You pay as paid for the whole loan with your part under it (`?loans=co-owned`).
 * Without a shared part the asset and loan pages show no Your part card.
 *
 * The Spending app renders its first run, its empty Overview and its Settings (`?spending=drive`), its Settings for a
 * file kept in this browser, the sample's Overview with the event that runs, Transactions, Limits, Events, Accounts, the dollar account with its ECB rate
 * line and Settings with the categories (`?spending=sample`), Limits with two overspent and Accounts and the home with an account below zero (`?spending=over`), Accounts
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
 * (`?loans=one-loan`), with a house loan, a car loan and an informal loan you owe on a plan (`?loans=house-and-car`), with one equal principal loan (`?loans=equal-principal`), with informal loans alone that leave you owed more than you owe, on the home too (`?loans=lending`) and while its file opens (`?loans=opening`), Scenarios with its offers, its charts opened and with none, the home, Kuna settings, the Loans first run and every Loans screen in Croatian (`?lang=hr`),
 * the Investments first run, its empty Overview and its Settings on an empty file (`?investments=drive`) and its Overview while its file opens (`?investments=opening`), each in Croatian too,
 * the Investments Overview on the sample (`?investments=sample`), on the sample without a deposit so an account's cash is below zero (`?investments=cash-below-zero`) and with late prices whose last
 * fetch failed (`?prices=late-prices`), each in Croatian too and with its figures worked out from the same fake sets, the home with the Investments card's figures and its badge, the nearest tax date or else the late prices,
 * the sample's Holdings with its five mixes and closed positions, also with a late close and on a past close (`?on=`), and two holdings' pages, one in US dollars with a lot partly sold and its trades as dots sized by amount, and one from a spin-off that split, each in Croatian too, a fund with an empty fund profile, a money fund with a whole one and a share whose company profile Finnhub refused, each with its Details and warnings and in Croatian too,
 * the young portfolio's fund, whose Price line runs from before its first buy with that buy marked and opens on the last year (`?investments=young`), a fund set not to fetch its facts in its Change dialog, which puts a typed-only line with a way to Change in place of its Details card's warning and takes its name off the checks, a custom span typed on the Home loan's charts, and the retired share, sold, whose Price chart opens on the days it was held as Custom, each in Croatian too,
 * the sample's Performance over everything against its benchmark and compared with a named fund, over 2024 where it is ahead of the benchmark, in Croatian too, and over a quarter, a portfolio too young for a rate a year with no benchmark chosen (`?investments=young`) and the sample whose
 * benchmark has no closes (`?prices=no-benchmark`), each in Croatian too, its Months, its Sources over everything and over the last year, its Falls, and its Income, Coming, Costs and Saving tabs, in Croatian too,
 * the sample's Tax screen for 2026 with its Year, Sales, Foreign income and Turns tax-free tabs, in Croatian too,
 * the sample's Transactions, in Croatian too, and Transactions on an empty file, the import of the made-up portfolio workbook
 * into an empty Investments file with the fake prices, each step and the dry run in English and Croatian, and the same workbook again adding nothing,
 * the Prices tab of the Investments Settings on the sample with current prices, with made-up keys kept, with a key another browser saved taken by the sync on open, a key this browser kept lost to another browser's newer removal and a key the Investments file's old keys file held (`?keys=`), and with late prices, its General tab, on a file another device left in the Drive bin (`?investments=binned`) in Croatian too, three made-up CSV files of closes imported on it, Remove the Investments file on the sample on Drive asked first, cancelled and removed to the first run in English and Croatian, the same for the sample kept in this browser (`?investments=browser`), the sync on open of the binned file with its steps,
 * IBKR's report by mail read by a sync, reviewed from the Overview, its account answered and accepted with one Undo, with rows not seen yet asked
 * about and one left out (`?fake=flex-unseen`), with a report that no longer fits (`?fake=flex-misfit`) and its Settings card switched on, imported by the sync
 * with nothing to ask and Undo on its step (`?investments=mail-known`), held back by a holding matched by symbol alone (`?investments=mail-symbol`), each in Croatian too,
 * the fetch after the import waiting out the fake vendor's minute and then back at its close, Company's
 * Overview, Transactions with its To review and Import tabs, every tab of Analysis, Invoicing with its Plan and Clients tabs, every tab of Settings and onboarding's first steps in Croatian (`?lang=hr`),
 * Year, Salaries and Owner in Croatian in the fake file on Drive, in this browser and with one and five employees, Salaries for one
 * made-up employee (`?fake=one-employee`) and for five (`?fake=five-employees`), and the summary
 * of an xlsx file it writes from the fake workbook with two problems added.
 *
 * At 360 and 1440 px, in both themes and both modes, it then adds, edits, deletes and undoes a
 * category, with its colour, a label and a role, an asset, an employee on Salaries and an
 * invoice, changes and deletes an owner advance and undoes the delete, and screenshots the editors
 * and the invoice dialog on the way. On Sorting, Categories it searches, filters to a bucket, sorts
 * by a press and the keyboard, and edits, saves and undoes a row while filtered and sorted. On Settings, General it saves the statements folder the
 * settings lack at the path the app uses, then a new path, and adds, refuses and removes card
 * settlement IBANs as tags. On Invoicing, Clients it gives a client a second IBAN, saves it and
 * undoes it, and takes a new IBAN off with its tag's remove button.
 * On Transactions it changes the category of a settled row, which a rule files elsewhere, and undoes it.
 * On Owner, Taken, at 360, 430 and 1440 px, the monthly net with the profit included opens its build-up and
 * Year from it in the workbook kept in this browser, and reads – with a link to the setting in the fake file on Drive.
 * On Year a link to the Statements tab alone keeps the year it opened through two tabs and Back.
 * It also opens an invoice's re-export from a link with its number filled in, makes an invoice through the checks and every step,
 * with the fake Picker picking the invoice and year folders and the month folder made on request, then re-exports it.
 * At 360, 430 and 1440 px it does the same with a pay scenario's component, copies a scenario, and
 * adds the starting scenarios to a workbook without any. On the sample Investments file it adds a buy, reads its summary, changes it, deletes it and
 * brings it back with Undo, has a sale beyond what its account holds refused, and adds a holding from inside the transaction dialog with a price
 * entered by hand. At every width it opens each Loans dialog and each Investments dialog, the holding dialog's search with a made-up key among them,
 * in English and Croatian, the Company dialogs whose fields sit two to a row, the app menu in Croatian
 * and the bank loan's what-if in Croatian. At 360, 768 and 1440 px it opens in Croatian the dialogs
 * and phone sheets of Transactions, its To review tab and Sorting, Categories, and groups Transactions by
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
 * Transactions and fills the rows of a new default share on Sorting, Categories, each undone. At the same widths, in Croatian,
 * it adds and undoes an asset, an employee, an owner advance's change, a pay scenario's component, the starting scenarios, a
 * category's plan and a planned purchase.
 * It plans a category for 2027 on Year, Plan, edits, clears and undoes it, and plans a purchase in a
 * workbook without plan rows. On Transactions it splits a payment, edits the split, deletes it and
 * undoes the delete. On the To review tab it does the same from a row of the queue. In books whose ledger rows have no id yet it follows
 * Waiting for you to Settings, Books file, gives the rows their ids and undoes it, in Croatian too. On Sorting, Rules it dismisses a group of
 * confirmed rows no rule repeats, restores it and undoes the restore. There it also changes a rule's note in the rule's editor and undoes it,
 * then deletes the rule from its editor and brings it back with Undo. On the Import tab of Transactions it drops the sample camt.053 statement and the
 * sample bank export, writes a recipe for the export, reads each dry run, confirms the statement, reads how many
 * new rows wait for review and undoes it, sees the export refused, since the bank's statements fill main, then deletes the recipe, at 360, 430 and 1440 px.
 * In books that still hold an import profile it moves the profile to a recipe with the Move notice and undoes it. With the
 * file on Drive, from Overview, Sync files the sample statement of the fake bank's mail with no
 * toast, its step on Kuna settings says so with Undo, which takes it out, Import lists it,
 * and a last sync finds nothing new. With a held statement in the mail, the sync control says 1
 * problem and opens its steps, a popover at 1440 and a bottom sheet at 360, whose link opens Import,
 * which says why. A slow search of the mail shows the control while its step runs and once it
 * is ready. On Salaries with five employees the one problem opens its build-up and its bank rows,
 * the People tab opens one employee's month and a month of the Over time table opens on the Month
 * tab.
 * The mail step is off until the Mail card on Settings, General saves a sender with the subject it
 * asks for, and the next sync reads the bank's mail. With the fake mailbox it reads the sample
 * statement and files it on the ledger in the same step, the Mail card lists what it read and passed
 * over, and a second sync files nothing new. Mail the books hold already says nothing new, a search
 * that fails gives 1 problem with the steps open, and a token without Gmail read gets Allow access, which runs the step. Saving a sender on the
 * Mail card without Gmail read asks for it in the same tap and syncs, and Allow access whose Google
 * window closed says so beside the button. Gmail asking to slow down fails the step with one plain
 * sentence, which the Mail card says too, and the search starts a week before the newest statement on the books.
 * With no account taking the bank's statements, the Mail card says so and links to the Accounts tab.
 * The first run keeps an empty workbook on the fake Drive and one in this browser, goes back to the
 * step that made them, which shows them made and starts over, and offers to open the books the fake
 * Drive already holds when new books, a move from this browser or the Loans file would make a
 * second file. New books
 * on the fake Drive with statements from mail name the bank. An xlsx file
 * moves to the fake Drive through its summary, Settings, Books file moves a workbook kept in this
 * browser there asking for the books file alone, and a row confirmed on the To review tab while another device files the other row keeps both.
 * Kuna settings' Mail card lists Company's statement mail, stops it with Company's toast and Undo, a held statement on Import is passed over and back,
 * and on Net worth each of two debt slices that share a name opens its own loan.
 *
 * Run on the fake build, which `--serve fake` serves on a free port for the run and stops after:
 *   npm run build:fake && npm run check:visual -- --serve fake
 * or against a preview already running:
 *   npm run preview:fake -- --port 4173
 *   npm run check:visual -- http://localhost:4173/kuna/
 *
 * While working on one screen, `--only billing,owner` limits the run to the screens and flows with exactly those names,
 * `--only 'chat-receipt*'` to those whose names start so, and `--widths 360,1440` to those widths. A limited
 * run replaces the screenshots of what it runs, keeps the others and says it was limited. The full run without options is the check.
 * `--classic-scrollbars` draws 15 px scrollbars from 640 px up, as Linux and Windows do, where a Mac floats them over the page,
 * so a run here finds what a scrollbar's room changes. The docked widths then name the shell's width, without the scrollbar.
 * `--every-theme` shoots both themes at every width, for a design review, which looks at 360, 640, 1024 and 1440 px:
 *   npm run check:visual -- --serve fake --every-theme --widths 360,640,1024,1440 --only chat-read
 *
 * Screenshots go to visual-check/ (gitignored), or to VISUAL_OUTPUT_DIR.
 */

import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as XLSX from 'xlsx'

import { fakeWorkbookDocument } from '../src/apps/company/workbook/infrastructure/fake/fakeWorkbook.ts'
import { tabsOfDocument } from '../src/apps/company/workbook/infrastructure/spreadsheetDocument.ts'
import { templateColumnNames } from '../src/apps/company/workbook/infrastructure/workbookTemplate.ts'
import { PROVIDER_PRESETS } from '../src/shared/ai/domain/providerPresets.ts'
import { installHrDooPack } from './support/installPack.mjs'
import { chromeLaunch, floatPhoneScrollbars, withBrowser } from './support/browsers.mjs'
import { collapseAndExpand } from './support/cardFlows.mjs'
import { englishLeftOn } from './support/englishLeft.mjs'
import { textOverlapsOn } from './support/textOverlap.mjs'
import { writeChatAttachmentSamples } from './support/chatAttachmentFiles.mjs'
import { MADE_UP_ANTHROPIC_KEY } from './support/chatFlows.mjs'
import { SAMPLE_DAY, writeFlexReportSamples, writeImportSamples, writeSpendingImportSamples, writeSpendingReceiptSamples } from './support/importSampleFiles.mjs'
import { writeClosesSamples } from './support/closesSampleFiles.mjs'
import { writeWorkbookSamples } from './support/workbookSampleFile.mjs'
import { runSelection } from './support/runSelection.mjs'
import { servePreview } from './support/servePreview.mjs'
import { shotIndex } from './support/shotIndex.mjs'
import { settleCharts } from './support/settleCharts.mjs'
import { screenshotWholePage } from './support/wholePage.mjs'
import { shellScreens, shellSourceScreens } from './support/shellScreens.mjs'
import { shellVisualFlows } from './support/shellVisualFlows.mjs'
import { spendingSourceScreens } from './support/spendingScreens.mjs'
import { spendingVisualFlows } from './support/spendingVisualFlows.mjs'
import { companyScreens, companySourceScreens } from './support/companyScreens.mjs'
import { companyVisualFlows } from './support/companyVisualFlows.mjs'
import { investmentsScreens, investmentsSourceScreens } from './support/investmentsScreens.mjs'
import { investmentsVisualFlows } from './support/investmentsVisualFlows.mjs'
import { loansScreens, loansSourceScreens } from './support/loansScreens.mjs'
import { loansVisualFlows } from './support/loansVisualFlows.mjs'
import { assetsScreens, assetsSourceScreens } from './support/assetsScreens.mjs'
import { assetsVisualFlows } from './support/assetsVisualFlows.mjs'
import { VIEWPORTS } from './support/visualCommon.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SCREENSHOT_DIR = process.env.VISUAL_OUTPUT_DIR ?? join(ROOT, 'visual-check')

const selection = runSelection(VIEWPORTS.map((viewport) => viewport.width))

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
const SCREENS = [...shellScreens, ...companyScreens, ...investmentsScreens, ...loansScreens, ...assetsScreens]

/** The gallery's chart cards that draw a chart. The loading card counts, the empty one does not. */
const GALLERY_CHARTS = 8

/** The gallery's donut cards, each of which must draw its ring. */
const GALLERY_DONUTS = 3

/** Screens outside the fake workbook on Drive. `query` picks the fake variant, `upload` drops the import file on the page. */
const SOURCE_SCREENS = [...shellSourceScreens, ...spendingSourceScreens, ...companySourceScreens, ...investmentsSourceScreens, ...loansSourceScreens, ...assetsSourceScreens]

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
    card: 'company-sorting.categories',
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

/**
 * The screens whose list cards keep each row's figure near its name up to a laptop's 1440 px. From 1920 px two cards side by side
 * are wide enough to spread again.
 */
const NEAR_FIGURE_SCREENS = [
  'spending-sorting',
  'spending-sorting-croatian',
  'spending-labels',
  'spending-labels-croatian',
  'overview',
  'overview-croatian',
  'spending-accounts',
  'spending-accounts-croatian',
  'spending-overview',
  'spending-overview-croatian',
  'investments-overview',
  'investments-overview-croatian',
  'spending-shortcut-dialog',
  'spending-shortcut-dialog-croatian',
  'spending-payees',
  'spending-payees-croatian',
  'spending-payee-page',
  'spending-payee-page-croatian',
  'spending-payee-page-long-name',
  'spending-payee-page-long-name-croatian',
  'company-labels',
  'company-labels-croatian',
  'spending-transactions',
  'spending-transactions-croatian',
  'spending-transaction-lines',
  'spending-transaction-lines-croatian',
  'spending-entries',
  'spending-entries-croatian',
  'spending-review',
  'spending-review-croatian',
  'spending-account-transfers',
  'spending-account-transfers-croatian',
  'spending-account-receipts',
  'spending-account-receipts-croatian',
  'spending-account-usd',
  'spending-account-usd-croatian',
  'spending-account-usd-by-hand',
  'spending-account-usd-by-hand-croatian',
  'spending-account-cash',
  'spending-account-cash-croatian',
]
const NEAR_FIGURE_WIDEST = 1440

/** The widths at which every row of a dashboard grid must be filled by its cards, the docked chat's 1920 px too. */
const GRID_ROW_WIDTHS = [1024, 1440, 1920]

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
      emptyGridRows: emptyGridRows(),
      containerSteps: containerSteps(),
      handBuiltGrids: handBuiltGrids(cardSelector),
      crowdedDonuts: crowdedDonuts(cardSelector),
      offsetTables: offsetTables(),
      phoneHeaderActions: phoneHeaderActions(),
      wideLoneCards: wideLoneCards(),
      drillLinksOffColour: drillLinksOffColour(),
      misplacedRowArrows: misplacedRowArrows(),
      recordRowsMissed: recordRowsMissed(),
      raggedRowAmounts: raggedRowAmounts(),
      raggedRowDetails: raggedRowDetails(),
      farRowFigures: farRowFigures(),
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
     * A table row that opens its record takes a press anywhere on it: the centre of each of its cells with no control of
     * its own reaches the row and shows the pointer. A cell under a sticky or fixed bar is not measured.
     */
    function recordRowsMissed() {
      const found = []
      // An open menu or dialog takes presses away from the whole page, and a drag of the chat's edge shows its own cursor everywhere.
      if (getComputedStyle(document.body).pointerEvents === 'none' || document.documentElement.classList.contains('chat-resizing')) return found
      const recordRowControls =
        'a, button, input, select, textarea, label, summary, [contenteditable], [role="button"], [role="checkbox"], [role="combobox"], [role="link"], [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], [role="option"], [role="radio"], [role="slider"], [role="spinbutton"], [role="switch"], [role="tab"], [role="textbox"]'
      const pinned = (element) => {
        for (let at = element; at !== null; at = at.parentElement) if (['sticky', 'fixed'].includes(getComputedStyle(at).position)) return true
        return false
      }
      for (const row of document.querySelectorAll('tr[data-record-row]')) {
        if (row.getClientRects().length === 0) continue
        const name = (row.querySelector('th')?.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 32)
        if (getComputedStyle(row).cursor !== 'pointer') found.push(`the row "${name}" opens its record but shows no pointer`)
        for (const cell of row.querySelectorAll(':scope > td')) {
          const box = cell.getBoundingClientRect()
          if (box.width === 0 || cell.querySelector(recordRowControls) !== null) continue
          const x = box.left + box.width / 2
          const y = box.top + box.height / 2
          if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) continue
          const hit = document.elementFromPoint(x, y)
          if (hit === null || row.contains(hit) || pinned(hit)) continue
          found.push(`a press on a cell of the row "${name}" lands on ${hit.tagName.toLowerCase()} outside the row`)
        }
      }
      return found
    }

    /** In a row-list where a row opens a page, the figures under each row end at one edge, whether or not the row opens a page, as on the Salaries People tab on a phone. */
    function raggedRowDetails() {
      const found = []
      for (const list of document.querySelectorAll('.row-list')) {
        if (list.querySelector('[data-row-arrow]') === null) continue
        const rows = [...list.querySelectorAll('.list-row-details')]
          .filter((details) => details.getClientRects().length > 0)
          .map((details) => ({ title: details.closest('.list-row-lines')?.querySelector('.list-row-title')?.textContent.trim().slice(0, 32) ?? '', end: details.getBoundingClientRect().right }))
        const edge = rows[0]?.end
        for (const other of rows.filter((row) => Math.abs(row.end - edge) > 1))
          found.push(`the figures under the row "${other.title}" end ${Math.round(other.end - edge)} px from the other rows of its list`)
      }
      return found
    }

    /** A ListRow that opens a page has its arrow on its title's first line, whatever the number of lines under it. */
    function misplacedRowArrows() {
      const found = []
      for (const arrow of document.querySelectorAll('[data-row-arrow]')) {
        const title = arrow.parentElement.querySelector('.list-row-title')
        if (title === null || arrow.getClientRects().length === 0) continue
        const range = document.createRange()
        range.selectNodeContents(title)
        const firstLine = range.getClientRects()[0]
        if (firstLine === undefined) continue
        const placed = arrow.getBoundingClientRect()
        const apart = placed.top + placed.height / 2 - (firstLine.top + firstLine.height / 2)
        if (Math.abs(apart) > 2) found.push(`the arrow of the row "${title.textContent.trim().slice(0, 32)}" sits ${Math.round(apart)} px off its title's first line`)
      }
      return found
    }

    /**
     * Rows whose amount starts more than 40rem from where their title starts, so the eye loses the line between the name and the figure.
     * A row of a table under a column heading, as a newest-rows card shows once it spans a wide row, reads down its columns and is not measured.
     */
    function farRowFigures() {
      const most = 40 * parseFloat(getComputedStyle(document.documentElement).fontSize)
      const found = []
      const rows = [...document.querySelectorAll('.list-row-lines')].map((lines) => [lines.querySelector('.list-row-title'), lines.querySelector(':scope > .list-row-amount > :first-child')])
      for (const [title, amount] of rows) {
        if (title === null || amount === null || amount.getClientRects().length === 0) continue
        const apart = amount.getBoundingClientRect().left - title.getBoundingClientRect().left
        if (apart > most) found.push(`the amount of the row "${title.textContent.trim().slice(0, 32)}" starts ${Math.round(apart)} px from its title`)
      }
      return found
    }

    /**
     * A list where some ListRows open a page and others do not sits in a `row-list`, and a `row-list` with a row that opens a
     * page ends every amount, and every figure it marks `row-list-edge`, at one edge.
     */
    function raggedRowAmounts() {
      const found = []
      const shown = (element) => element !== null && element !== undefined && element.getClientRects().length > 0
      const opens = (lines) => lines.closest('a')?.querySelector(':scope > [data-row-arrow]') != null
      const titleOf = (lines) => lines.querySelector('.list-row-title')?.textContent.trim().slice(0, 32) ?? ''
      for (const list of document.querySelectorAll('ul')) {
        const rows = [...list.children].flatMap((item) => {
          const lines = item.querySelector('.list-row-lines')
          return lines === null || lines.closest('ul') !== list || !shown(lines) ? [] : [lines]
        })
        if (rows.some(opens) && !rows.every(opens) && list.closest('.row-list') === null)
          found.push(`the list with the row "${titleOf(rows[0])}" mixes rows that open a page with rows that do not outside a row-list`)
      }
      for (const list of document.querySelectorAll('.row-list')) {
        const rows = [...list.querySelectorAll('.list-row-lines')].flatMap((lines) => {
          const amount = lines.querySelector(':scope > .list-row-amount > :first-child')
          return shown(amount) ? [{ what: `the amount of the row "${titleOf(lines)}"`, opens: opens(lines), end: amount.getBoundingClientRect().right }] : []
        })
        const edge = rows.find((row) => row.opens)?.end
        if (edge === undefined) continue
        const figures = [...list.querySelectorAll('.row-list-edge')]
          .filter(shown)
          .map((figure) => ({ what: `the figure "${figure.textContent.trim().replace(/\s+/g, ' ').slice(0, 32)}"`, end: figure.getBoundingClientRect().right }))
        for (const other of [...rows, ...figures].filter((candidate) => Math.abs(candidate.end - edge) > 1))
          found.push(`${other.what} ends ${Math.round(other.end - edge)} px from the other amounts of its list`)
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
        if (!['grid', 'flex'].includes(getComputedStyle(grid).display)) continue
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

    /**
     * Rows of a dashboard grid whose parts leave more of the row empty than a sliver of 16 px, as a lone card in half a row
     * does. A row's parts share it, so a card with no partner spans the row.
     */
    function emptyGridRows() {
      const sliver = 16
      const found = []
      for (const grid of document.querySelectorAll('[data-layout]')) {
        const style = getComputedStyle(grid)
        if (!['grid', 'flex'].includes(style.display)) continue
        const gap = parseFloat(style.columnGap) || 0
        const rows = new Map()
        for (const part of [...grid.children].filter((child) => child.getClientRects().length > 0)) {
          const placed = part.getBoundingClientRect()
          const top = Math.round(placed.top)
          const row = [...rows.keys()].find((start) => Math.abs(start - top) <= 1) ?? top
          rows.set(row, [...(rows.get(row) ?? []), placed.width])
        }
        const name = (grid.dataset.testid ?? grid.querySelector('h2, h3, p')?.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 32)
        for (const widths of rows.values()) {
          const empty = grid.clientWidth - widths.reduce((sum, width) => sum + width, 0) - gap * (widths.length - 1)
          if (empty > sliver) found.push(`the ${grid.dataset.layout} grid "${name}" leaves ${Math.round(empty)} px of a row of ${widths.length} empty`)
        }
      }
      return found
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

const shots = shotIndex(SCREENSHOT_DIR, selection.limited)

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

/** The files the flows drop on a page, of which each app's flows take the ones they use. */
const SAMPLES = { IMPORT_FILE, IMPORT_SAMPLES, SPENDING_IMPORT_SAMPLES, SPENDING_RECEIPT_SAMPLES, CHAT_ATTACHMENT_SAMPLES, WORKBOOK_SAMPLES, FLEX_REPORT_SAMPLES, CLOSES_SAMPLES }

/** The editors' flows, each on a fresh load, so the fake file on Drive and the workbook kept in this browser start from their seed. */
const FLOWS = [
  ...shellVisualFlows(SAMPLES),
  ...spendingVisualFlows(SAMPLES),
  ...companyVisualFlows(SAMPLES),
  ...investmentsVisualFlows(SAMPLES),
  ...loansVisualFlows(SAMPLES),
  ...assetsVisualFlows(SAMPLES),
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
const served = selection.serve === null ? null : await servePreview(selection.serve)
const BASE = served?.base ?? selection.base
/** How many times a screen opens again after Chrome says the frame navigating to it was detached. */
const DETACHED_RETRIES = 2

/**
 * Opens the address, and opens it again up to twice when Chrome says the frame navigating there was detached, a failure of Chrome's own
 * that says nothing about the screen. Any other failure throws as it came, and so does that one once the retries are spent.
 */
async function openScreen(page, url, options) {
  for (let retry = 0; ; retry += 1) {
    try {
      return await page.goto(url, options)
    } catch (failure) {
      if (retry === DETACHED_RETRIES || !String(failure?.message ?? failure).includes('Navigating frame was detached')) throw failure
    }
  }
}

// Screens and flows are dealt out as one list, since a flow takes far longer than a screen.
const shared = selection.share([...chosenVisits, ...chosenFlows].map((checked) => checked.name))
const visits = chosenVisits.filter((visit) => shared.has(visit.name))
const flows = chosenFlows.filter((flow) => shared.has(flow.name))
let checked = 0

await withBrowser(chromeLaunch(selection.classicScrollbars), async (browser) => {
  /**
   * The gutter this browser keeps beside the shell from the phone step up, in px. A docked viewport names the shell's width,
   * so its window is wider by this much, as a person's with a classic scrollbar is. Linux Chrome keeps one even for a hidden scrollbar.
   */
  async function shellGutter() {
    const context = await browser.createBrowserContext()
    const page = await context.newPage()
    if (selection.classicScrollbars) await floatPhoneScrollbars(page)
    await page.setViewport({ width: 1024, height: 768 })
    await openScreen(page, BASE, { waitUntil: 'load' })
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
      shots.begin(visit.name)
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
      await openScreen(page, `${BASE}?theme=${visit.theme}${visit.query ? `&${visit.query}` : ''}${viewport.chatDocked ? withChatOpen(visit.hash) : visit.hash}`, { waitUntil: 'networkidle0' })

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
      for (const problem of [...report.offsetTables, ...report.phoneHeaderActions, ...report.wideLoneCards, ...report.drillLinksOffColour, ...report.misplacedRowArrows, ...report.raggedRowAmounts])
        fail(scope, problem)
      for (const problem of report.recordRowsMissed) fail(scope, problem)
      for (const problem of report.raggedRowDetails) fail(scope, problem)
      if (NEAR_FIGURE_SCREENS.includes(visit.name) && viewport.width <= NEAR_FIGURE_WIDEST) for (const far of report.farRowFigures) fail(scope, far)
      if (GRID_ROW_WIDTHS.includes(viewport.width)) for (const row of report.emptyGridRows) fail(scope, row)
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

      await screenshotWholePage(page, shots.path(`${viewport.name}-${visit.file}.png`))
      if (visit.gallery && viewport.name === 'desktop') {
        const firstChart = await page.$('[data-testid="chart-card"]')
        await firstChart?.screenshot({ path: shots.path(`${viewport.name}-${visit.file}-chart.png`) })
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
            (card) => card.screenshot({ path: shots.path(`${viewport.name}-${visit.file}-collapsed.png`) }),
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
          shots.begin(flow.name)
          const context = await browser.createBrowserContext()
          const page = await context.newPage()
          if (selection.classicScrollbars) await floatPhoneScrollbars(page)
          const errors = watchForErrors(page)
          const foreignRequests = watchForForeignRequests(page)
          await page.setViewport({ width: viewport.width, height: viewport.height })
          await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }])
          const file = (name) => shots.path(`${viewport.name}-${mode.name}-${name}-${theme}.png`)
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
              ...report.misplacedRowArrows,
              ...report.raggedRowAmounts,
              ...report.recordRowsMissed,
              ...report.raggedRowDetails,
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
            await openScreen(page, `${BASE}?theme=${theme}${query}&day=${SAMPLE_DAY}${flow.hash}`, { waitUntil: 'networkidle0' })
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
}).finally(() => served?.stop())
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
