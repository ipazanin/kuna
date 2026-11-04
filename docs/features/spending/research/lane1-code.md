# Spending app, lane 1: code and data model

What of the company ledger a personal spending app can reuse, the plainest v1 records, currency, budgets and analytics, the receipt pipeline in code terms, the hub and H7, a staging proposal, a module map and the decisions for the owner.

Checked against the Kuna repo at 0717599 (branch main). Paths are relative to the repo. No real names, amounts or IBANs are used.

## In short

- **Do not reuse the company ledger as the spending ledger.** The company `Transaction` is built around a bank's balance chain, P&L buckets, owner share and camt signals (`src/apps/company/workbook/domain/workbook.ts:66-101`). 117 `src` files import that module. A personal ledger with typed cash rows, receipts and transfers changes for other reasons, so it gets its own small `Transaction` in the spending app.
- **Three pieces really are shared, and they move to `src/shared` only when spending's stage needs them:** the rules engine core, the statement readers (camt and the tabular profile reader), and the vendor key store that Investments syncs through `drive.appdata`. The ECB conversion rule is a fourth, small one. Each is the same rule for the same reason in both apps: how a bank row is matched, how a bank file is read, how a user's secret key reaches every browser, how a foreign amount becomes euros.
- **Company-only stays company-only:** buckets, roles, VAT, owner share, the hr-doo pack, the balance-chain dry run, the Transactions screen, filters and drills, the analytics builders.
- **An app may not import another app** (`README.md:2975`, `tests/importBoundaries.spec.ts:143-145`). So "reuse" means a move to `src/shared` or a copy. There is no third way.
- **v1 needs almost nothing moved.** Accounts, typed entries, categories with a parent, budgets and analytics are new code in a new app, built from the kernel that already exists (money, calendar, storage, UI kit, charts). The extractions come in stage 2 (statements) and stage 3 (receipts), each landing on its own with `check:figures` identical before spending uses it.

## 1. What of the company ledger can be reused

The repo's own rule is structural: an app imports `src/shared` and its own folder, never another app (`README.md:2975`). The owner's rule decides what moves: extract only when both copies change for the same reason.

| Capability        | Where it is                                                                                                                                                                                                                                                                                                                                                                                                                            | Company-specific parts                                                                                                                                                                                                                                                                                                          | Verdict for spending                                                                                                                                                                                                   |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Transaction type  | `Transaction` at `workbook.ts:66-101`, stored as `LedgerEntry` (`ledgerReading.ts:22`)                                                                                                                                                                                                                                                                                                                                                 | `sequence` from the balance chain (`workbook.ts:68-74`), a required bank `balance` (`:80-81`), `bucket`, `family`, `ownerShare` (`:91-92`), `split` and `ownerPart` (`:97-100`), camt `signals` (`:56-63`)                                                                                                                      | New type in spending. Different reasons to change.                                                                                                                                                                     |
| Money             | `Money`, integer cents with no currency (`src/shared/money/money.ts:1-5`), `Decimal` and `inEuros` (`src/shared/money/decimal.ts:8`, `:146-151`), `CurrencyCode` (`src/shared/money/currencyCode.ts:1-19`)                                                                                                                                                                                                                             | none                                                                                                                                                                                                                                                                                                                            | Reuse as is. Already shared.                                                                                                                                                                                           |
| Categories        | `Category` (`workbook.ts:23-36`): slug, label, required `family`, `bucket`, colour, `roles`, `vat`, `ownerShare`                                                                                                                                                                                                                                                                                                                       | The six buckets are P&L (`bucket.ts:1-5`, `:14-16`, `:26-39`). Roles exist for receivables, owner share and the pack (`settings/domain/categoryGuards.ts:57-60`, `receivables/domain/invoiceMatching.ts:10-14`, `owner-share/domain/ownerShare.ts:16-20`, `packs/hr-doo/domain/packRoles.ts:6-32`). `vat` (`workbook.ts:32-33`) | New type in spending: a kind (income, spending, transfer) instead of a bucket, an optional parent, no roles, no VAT.                                                                                                   |
| Category colour   | `SWATCHES` (`workbook/domain/categoryColour.ts:13-14`), picker `src/shared/ui/ColourSwatchPicker.vue:21-27`                                                                                                                                                                                                                                                                                                                            | none, it is the chart palette                                                                                                                                                                                                                                                                                                   | Picker reuse as is. The swatch list is design-system data, a candidate to move beside the picker once spending uses it (4 `src` and 18 test importers).                                                                |
| Rules engine      | `Rule`, `RuleCondition` (`rules/domain/rule.ts:12-32`), `categorise` (`categorise.ts:18-29`), `transactionFacts` (`transactionFacts.ts:64-85`)                                                                                                                                                                                                                                                                                         | `counterparty_is_client` and `revenue_code` (`rule.ts:16`, `:18`). The context builder reads the company workbook's clients and settings (`transactionFacts.ts:30-42`). `proposeRule` pairs directions by company roles (`proposeRule.ts:10`, `:33`)                                                                            | Core moves to `src/shared` in stage 2. Same reason in both apps: a bank row's IBAN, merchant text and camt codes decide its category. The context builder, `proposeRule` and the rules tab UI stay per app.            |
| Statement readers | `ImportedRow`, `ImportedStatement`, `StatementSource` (`imports/domain/importedStatement.ts:6-39`), camt reader (`camtStatement.ts:48-58`), tabular reader by profile (`tabularStatement.ts:34-44`), profiles (`importProfile.ts:23-37`), the file loader (`imports/infrastructure/importFiles.ts:13-29`)                                                                                                                              | A profile names one account (`importProfile.ts:26-27`), so a file that mixes currencies needs one profile per currency or a currency column. Profiles live in company settings (`importProfile.ts:17-21`). The camt reader imports `foldRuleText` from the rules (`camtStatement.ts:6`)                                         | Readers move to `src/shared` in stage 2. Same reason: what Erste, OTP or Revolut put in a file. Where profiles are saved stays per app.                                                                                |
| Dedup             | A row is on the ledger when its account holds its reference (`importDryRun.ts:181`, key at `ledgerReading.ts:38-45`). A table row without a reference gets a key of account, date, amount, balance and text (`tabularStatement.ts:40-42`). Investments puts an `importKey` on each imported record (`investments/workbook/domain/cashMovement.ts:26-27`)                                                                               | The dry run also demands a reference on every new row (`importDryRun.ts:211`), no row older than the newest (`:219`) and an opening that meets the ledger's balance (`:229`). A cash wallet or a typed row has none of that                                                                                                     | The reading-side key moves with the readers. The dry run stays company. Spending writes its own dry run: `importKey` per account, like Investments, plus pairing with typed rows (decision A).                         |
| Review queue      | `needsReview` (`workbook/domain/needsReview.ts:13-15`), `confirmation` and `recategorisation` (`transactions/domain/verdictChanges.ts:28-38`), `ReviewQueue.vue`                                                                                                                                                                                                                                                                       | The component reads the company store, filters, pack cards and the split dialog (`transactions/presentation/ReviewQueue.vue:11-30`)                                                                                                                                                                                             | The `Verdict` type moves with the rules (`categorise.ts:9-15`). The predicate is three lines and the UI is company-bound, so spending writes its own.                                                                  |
| Splits            | `SplitPart`, `LedgerSplit`, `splitLedger` (`workbook/domain/splits.ts:21-79`)                                                                                                                                                                                                                                                                                                                                                          | Parts find their row by date, account, amount and balance (`splits.ts:10-19`, stored at `splitsReading.ts:20-28`), which only a bank balance chain makes unique. Parts carry owner share                                                                                                                                        | Not reused. Spending's rows have ids from the first write, so a line names its transaction by id. One line kind serves hand splits and receipt items (section 2).                                                      |
| Mail filing       | `fileMail` and `MailSource` (`mail/application/mailFiling.ts:52-71`), the bank source (`mail/application/statementMailSource.ts:18-46`), naming (`mail/domain/statementMailFiling.ts:21-40`), presets (`mail/domain/bankPresets.ts:10`, Erste only)                                                                                                                                                                                    | Sources take the company `Workbook` for their terms and reading (`mailFiling.ts:2`, `:52-53`, `:69`). The settings that turn it on are company settings                                                                                                                                                                         | Keep in company until a personal bank sends statements by mail. The statements lane decides whether OTP or Revolut do. If one does, the mail code goes generic over the books type and moves (cost in the module map). |
| Analytics domain  | `categoryTotals` (`spending/domain/categoryTotals.ts:29-55`), `costGroups` (`costGroups.ts:36`), `bucketTotals` (`workbook/domain/bucketTotals.ts:49-73`), `monthlyProfitAndLoss` (`trends/domain/monthlyProfitAndLoss.ts:37-57`), `latestBalances`, `balanceSeries` (`cash/domain/balances.ts:47-98`), `topCounterparties` (`topCounterparties.ts:63`)                                                                                | All filter on P&L buckets (`categoryTotals.ts:34-37`, `bucketTotals.ts:52-70`), return company `Figure`s with drills to company Transactions (`filters/domain/drillTarget`, 56 `src` importers), and balances read the bank's balance column (`balances.ts:53-56`)                                                              | Not reused. They answer P&L questions. Spending's figures answer budget questions. Copy the shapes, not the code.                                                                                                      |
| Analytics charts  | Shared: `ChartCard`, `DonutCard`, `KpiTile`, `ProgressMeter`, `SparkLine`, `FigureTable`, `DashboardGrid` in `src/shared/ui`, `bridgeChart` (`src/shared/charts/bridgeChart.ts:42-50`), `markIncomplete`, `incompleteBand`, `moneyAxisLabel` (`src/shared/charts/chartTheme.ts:73-109`). Company builders: `profitAndLossChart` (`trends/presentation/profitAndLossChart.ts:53`), `balanceChart` (`cash/presentation/cashChart.ts:21`) | Builders take company `Settings`, P&L lines and `DrillChart` (`profitAndLossChart.ts:7-12`)                                                                                                                                                                                                                                     | Reuse the shared UI and helpers as is. Write spending's own builders.                                                                                                                                                  |

Gotcha: `src/shared/charts/chartTokens.ts:10` and `:31` already carry the six company bucket tones in the shared kernel. Spending should colour by category swatch or series slot and not add personal kinds to that list.

## 2. The plainest v1 records

All six are new kinds in a new spending file, one document per app like Loans and Investments (`src/apps/loans/workbook/infrastructure/loansDocument.ts:8-26`). Ids come from the first write, as `recordIdOf(KIND, newRecordId())` does in Investments (`investments/imports/domain/importDryRun.ts:700`, `src/shared/storage/domain/recordId.ts:10`, `:24`). Kind names are bare per app (`company/workbook/domain/coreKinds.ts:13-24`, `loans/workbook/domain/loanKinds.ts:10`), so `account` and `category` may be reused as names in the spending file.

```ts
// account: reuses nothing. Company's Account (workbook.ts:43-50) has no kind or opening.
// Investments' InvestmentAccount (investmentAccount.ts:4-8) is name and note only.
interface SpendingAccount {
  readonly id: RecordId
  readonly name: string
  readonly kind: 'bank' | 'cash' | 'savings'
  readonly currency: CurrencyCode // one currency per account, decision D
  readonly opening: Money // in the account's currency
  readonly openedOn: CivilDate // the day the opening balance holds
  readonly iban: string // blank for cash, used by the rules' own-account test
  readonly closed: boolean
}

// transaction: new. Signed in the account's currency, credits positive, as the company ledger is.
interface SpendingTransaction {
  readonly id: RecordId
  readonly account: RecordId
  readonly date: CivilDate
  readonly amount: Money
  readonly payee: string // the rules read it as counterparty
  readonly category: RecordId | null // null waits on review
  readonly note: string // the person's words
  readonly source: 'typed' | 'statement' | 'receipt'
  readonly description: string // the bank's text, blank when typed
  readonly counterpartyIban: string // blank when typed
  readonly importKey: string | null // bank reference or derived key, null when typed
  readonly flaggedBy: 'rule' | 'review' | 'person' | ''
}

// category: new. Kind replaces bucket. One level of parent, decision B.
interface SpendingCategory {
  readonly id: RecordId
  readonly name: string
  readonly kind: 'income' | 'spending' | 'transfer'
  readonly parent: RecordId | null // a parent has the same kind and no parent of its own
  readonly colour: string // a swatch, blank for the kind's colour
}

// budget: new. Shape twin of the pack's PlanLine of kind amount (packs/hr-doo/domain/forecast/plan.ts:23-29).
interface Budget {
  readonly id: RecordId
  readonly category: RecordId // a parent's budget covers its children
  readonly from: MonthKey // holds every month until the next budget of the category
  readonly amount: Money // in euros, 0 ends a budget
}

// rule: reuses the shared Rule once it moves (rule.ts:22-32). Its category holds a spending category id.

// receipt and its lines: new. Lines belong to the transaction, so a hand split is lines without a receipt.
interface Receipt {
  readonly id: RecordId
  readonly transaction: RecordId | null // null until it is matched or a typed row is made for it
  readonly merchant: string
  readonly date: CivilDate
  readonly total: Money
  readonly currency: CurrencyCode
  readonly readBy: string // the model that read it, for trust
  readonly photo: string | null // a Drive file id, decision F
}
interface TransactionLine {
  readonly id: RecordId
  readonly transaction: RecordId
  readonly receipt: RecordId | null
  readonly text: string // "Milk 1 l", or the split's note
  readonly amount: Money // same sign as the transaction, lines add up to it
  readonly category: RecordId
}
```

**Balances are computed, not read.** Opening plus every row since `openedOn`. That works for a cash wallet and for a bank account alike. A statement's own closing balance becomes a check in stage 2, the way the company dry run checks it (`importDryRun.ts:225-248`), and a mismatch is a note, not a refusal.

**A transfer is two rows, one on each account, each in a category of kind `transfer`.** Both rows move their account's balance. No spending, income or budget figure counts kind `transfer`, the way the company's `directionOf` gives `financing` and `neutral` no side (`bucket.ts:26-39`). Example: moving 200.00 from a current account to a savings account is −200.00 on one and +200.00 on the other, both in "Transfer: savings". A Revolut exchange is the same with two currencies. Two rows fit imports, since each bank's statement brings its own side, and each import files its own row with no merge. Typing a transfer by hand writes both rows in one write, which is atomic because both live in one file. A single record with from and to, as Investments has (`investments/workbook/domain/transfer.ts:18-28`), would need the import to merge two bank rows into one, so it is not the plainest here. Pairing the two sides is optional and can be derived (same amount in euros, opposite sign, two of your accounts, within three days). It needs no stored link in v1.

Two follow-ons:

- An account lives in one app. A broker account stays in Investments. Money sent to it from a spending account is a transfer category, so it is neither spending nor double counted on Kuna's Overview.
- A loan repayment is spending in v1 if filed under a spending category. Splitting principal from interest is the loans link lane 3 describes, and it is later work.

## 3. Currency

**Store each amount in its account's currency, and show euros by converting at the ECB rate of the row's day.** Investments does exactly this with `eurosAtEcbRate` over a `RateBook` (`investments/prices/domain/rateBook.ts:8-26`) and keeps a record's own rate where euros really moved (`cashMovement.ts:24-25`). A row the series has no rate for yet is listed, not guessed, as `unrated` (`holdings/domain/accountCash.ts:24-27`).

- A card payment in dollars from a euro account needs no conversion. The bank already booked euros. The foreign amount is information only, which camt carries as `instructedCurrency` (`workbook.ts:62`) and the rules test as `foreign_currency` (`transactionFacts.ts:128-132`).
- Only non-euro accounts convert, such as a Revolut USD pocket. With one account per currency (decision D) the account's currency is the row's currency, so the transaction needs no currency field.
- Budgets are in euros. Actuals are the converted sums.
- Kuna's Overview refuses to add apps that keep different currencies (`src/shared/app/personalNet.ts:38`, `:47-48`). So spending reports its hub parts in euros, converted.

**Where the rates come from.** The ECB fetch is Investments' code (`investments/prices/infrastructure/vendors/ecb.ts:30-73`) and the rates live in Investments' prices file as `ecb:<currency>` series (`README.md` "Investments prices", `prices/domain/pricesFile.ts:9-10`, `:165-167`). Spending may not import either. The plainest path:

1. Move `RateBook`, `NO_RATES` and `eurosAtEcbRate` (26 lines, pure) to `src/shared/money`, since the conversion is one rule with one owner. 20 Investments `src` files and 4 tests change an import path. Figures identical.
2. Move the ECB fetch and its CSV reading to a shared rates module that returns `[day, rate]` lines. Investments keeps its vendor wrapper around it.
3. Spending keeps its rates in a browser cache only, fetched on sync when a non-euro account exists. ECB rates are public and can be fetched again, so they need no Drive file. The CSP already allows `data-api.ecb.europa.eu` (`index.html:7`).

If v1 takes euro accounts only, all three wait for stage 2.

## 4. Budgets and analytics

| Figure                            | What fits                                                                                                                                                                                                                                                                                   | What is new                                                                                                                                                                                                                                                                      |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Spending by category over months  | The month grid and helpers: `monthsFrom`, `monthOf` (`src/shared/calendar/monthKey.ts:25`, `:49`), `isCompleteMonth` and the ledger window (`src/shared/calendar/ledgerWindow.ts`), `markIncomplete` and `incompleteBand` for the month still filling (`chartTheme.ts:98-109`), `ChartCard` | A function like `monthlyBucketTotals` (`bucketTotals.ts:75-82`) keyed by category and rolled up to parents. A stacked bar builder copied from the pattern of `profitAndLossChart.ts:53`.                                                                                         |
| Budget against actual             | `ProgressMeter` (`src/shared/ui/ProgressMeter.vue:2-8`, used by Loans at `loans/bankLoans/presentation/BalanceHero.vue`), `KpiTile` for what is left this month                                                                                                                             | `budgetAgainstActual(month)`: the budget in force for each category (the newest `from` on or before the month), its actual in euros including children, left or over. The pack's `planAgainstActual` runs over a `YearForecast` (`planAgainstActual.ts:36`), so it is not a fit. |
| Income against spending           | The rolling averages idea of `monthlyProfitAndLoss` (`monthlyProfitAndLoss.ts:20-34`, `:59-65`)                                                                                                                                                                                             | A three-line month record: income, spending, net, with 3 and 12 month averages. A bar and line builder.                                                                                                                                                                          |
| A month's cash flow               | `bridgeChart` (`src/shared/charts/bridgeChart.ts:42-50`), already used by Investments (`investments/performance/presentation/gainBridgeChart.ts`)                                                                                                                                           | The bars: opening balance over all accounts, income, each spending parent category, transfers out of the counted accounts, closing.                                                                                                                                              |
| Balances per account and in total | `SparkLine`, `KpiTile`, `FigureTable`                                                                                                                                                                                                                                                       | Computed balances (section 2). Company `latestBalances` reads the bank's column (`balances.ts:53-56`).                                                                                                                                                                           |
| Recurring payees, later           | The `monthly` rhythm idea (`topCounterparties.ts:26-27`, `:59-60`)                                                                                                                                                                                                                          | Copy the idea. The function is bound to the company `Transaction` and drills.                                                                                                                                                                                                    |

Drills: the company `Figure` and `drillToTransactions` belong to the company filters (`filters/domain/drillTarget`). Spending needs its own route query for its Transactions screen. That is presentation, not a shared concern.

## 5. The receipt pipeline in code terms

1. **Photo in.** `FileDrop` (`src/shared/ui/FileDrop.vue:10-18`) takes `accept` and `multiple`. A receipt passes `accept="image/*"` and an optional `capture="environment"` prop added to `FileDrop`. Whether Firefox for Android honours `capture`, and whether `accept="image/*"` alone offers the camera there, is unverified here and belongs to the receipt lane. The page shrinks the image on a canvas before sending it, to keep the request small.
2. **CSP.** `connect-src` lists every host the page may call (`index.html:7`). The model vendor's host has to join it. `img-src 'self'` blocks a `blob:` preview of the photo, so `blob:` has to join `img-src` too. Both are edits to the policy and its README table ("Content Security Policy").
3. **The call.** An adapter in `src/apps/spending/receipts/infrastructure/`, behind a port in `application/`, like the price vendors (`investments/prices/application/priceVendor.ts`, `infrastructure/vendors/`). The price vendors put the key in the URL to avoid a CORS preflight (`README.md` "Keys in this browser and in the Google account"). A model API takes its key in a header, so a preflight happens and the vendor must allow browser calls. Unverified here, the receipt lane owns it.
4. **Answer to draft lines.** The model is asked for JSON. A pure domain function, `receiptDraft(answer, categories)`, turns it into `{ merchant, date, total, currency, lines[] }` and checks it as the camt reader checks a statement against its own totals (`camtStatement.ts:48-58`): lines add up to the total, the date reads, the currency is a code `currencyCodeOf` knows (`currencyCode.ts:16-19`), every amount reads as cents. A failed check is a note on the draft, not a refusal. A line's category comes from the model's guess, then the category the same item text had last time. The draft opens in a dialog of editable lines, the shape of the Investments import's steps (`investments/imports/presentation/ImportDryRunStep.vue`). Confirm writes the receipt, its lines and, when no bank row matches, a typed transaction with `source: 'receipt'`, in one write.
5. **Keys.** Investments keeps each vendor key in `localStorage` (`investments/prices/infrastructure/vendorKeys.ts:5-6`, `:9-18`) and syncs them through a file in the hidden app folder, `kuna-investments-keys-<file id>.json` (`prices/domain/keysFile.ts:23-26`, `prices/application/keysSync.ts:27-55`), with a `drive.appdata` token (`prices/infrastructure/googleKeysDrive.ts:6-8`, `src/shared/google/googleScopes.ts:4`, `:15`, `src/shared/google/driveClient.ts:13-14`). The merge rule, newest change per vendor wins, is not price-specific. Spending is its second user, so it moves to `src/shared` in stage 3. The Investments file name must stay as it is, or existing keys files stop being found. The words in `src/shared/google/words.ts:16` say "price keys" and need to become generic.
6. **Matching a receipt to a bank row.** Candidates: rows on a bank account, amount equal to minus the total, date from the receipt's day to five days later (card rows settle late), no receipt yet. One candidate is offered, several are a pick, none makes a typed row that a later import pairs. This is the same pairing the statement import needs for typed rows (decision A), so it is written once in spending's domain and used by both. `fewestMakingUp` (`src/shared/money/settleOpenRows.ts:18`) is not needed, since a receipt matches one row.

## 6. The overview, the hub and H7

- **Kuna's Overview.** An app gives the shell `hub` parts on `AppContribution` (`src/shared/app/appContribution.ts:55-81`). Loans gives what you owe on the `owes` side (`loans/home/presentation/loansHubFigures.ts:12-21`), Investments the portfolio on `has` (`investments/home/presentation/investmentsHubFigures.ts:8-13`), and the company shows beside the sum and never in it (`company/app.ts:71`). Spending counts: one `has` part, the euro balance of its open accounts, opening its Overview. An account below zero, such as an overdrawn current account, goes to an `owes` part so the sum stays honest. Unrated foreign rows become a note, as Investments does with unpriced holdings.
- **Home card.** This month's spending against budget, and "N rows to review" as `waiting` (`appContribution.ts:36-42`).
- **H7 later needs four things:**
  1. Ids on both ledgers. The company rows carry `rowId` once the books are in the Kuna file (`workbook.ts:94-96`). Spending has ids from the first write.
  2. A published contract from the company: the money that went to the owner (date, amount, what it is: salary, dividend, reimbursement, loan), each with its row id. It is a new typed slot beside `hub`, kept separate from the company's internal `Transaction`.
  3. A pure matcher in `src/shared/app/` beside `personalNet` (`personalNet.ts:34-50`), fed by the shell with the company's facts and spending's credits. That keeps the rule that no app imports another (`importBoundaries.spec.ts:143-145`). The hub proposal's `facts.ts` read through a translation file inside the personal app would break that rule, so one of the two has to change when H7 is planned.
  4. A place for a person's "these two are the same money" override, if the computed match is ever wrong. That is a spending record, since it is about personal rows. Not needed until a match is wrong in practice.

## 7. Staging

| Stage | What                                                                                                                                                                                                                                                          | Depends on                                                   | Rough size                                                    |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------- |
| 0     | Only if v1 takes non-euro accounts: the ECB rule and fetch to `src/shared`                                                                                                                                                                                    | nothing                                                      | about 25 files, almost all import paths, figures identical    |
| 1     | Spending v1: the app shell (`app.ts`, document, store, codecs, first run, sync group, home and hub), accounts, typed entry with transfers and lines, categories with a parent, budgets, Overview with the four figures, a Transactions list, fake seed, tests | the fourth-app steps the assets lane describes               | about 60 to 75 files, medium to large on the proposal's scale |
| 2a    | Rules engine core to `src/shared`                                                                                                                                                                                                                             | nothing                                                      | about 30 files                                                |
| 2b    | Statement readers to `src/shared`                                                                                                                                                                                                                             | 2a, since camt imports `foldRuleText` (`camtStatement.ts:6`) | about 22 files                                                |
| 2c    | Spending statements: import screen, spending's dry run with `importKey` and typed-row pairing, OTP and Revolut profiles or readers (from the statements lane), rules tab and review queue for spending                                                        | 2a, 2b                                                       | about 25 to 35 files                                          |
| 2d    | Only if a personal bank mails statements: mail filing generic and to `src/shared`, a spending mail source                                                                                                                                                     | 2c                                                           | about 30 files moved or touched, plus the source              |
| 3a    | Vendor key store to `src/shared`                                                                                                                                                                                                                              | nothing                                                      | about 25 files                                                |
| 3b    | Receipts: photo input, model adapter, draft and confirm, matching, CSP                                                                                                                                                                                        | 3a, and the pairing from 2c                                  | about 20 files                                                |

The fourth-app steps follow Loans and Investments: an `app.ts` returning an `AppContribution` (`loans/app.ts:29-75`), a document and schema (`loansDocument.ts:8-26`), a page store (`loans/workbook/application/loansStore.ts:9-14`), codecs (`loansCodecs.ts:12-30`), installation in `main.ts` (`src/main.ts:19-22`), a sync group (`loans/sync/presentation/loansSyncGroup.ts`), its adapter wiring listed in `ADAPTER_WIRING` (`importBoundaries.spec.ts:106-111`) and its id in the spec's app list (`:124`).

## 8. Module map

This answers "think modular monolith". A module owns its records and rules, publishes a small contract that is not its internal model, and imports only what the map allows. The repo already has the frame: the shell, the kernel and apps behind `AppContribution` (`README.md` "The shell and its apps", `appContribution.ts:83-122`).

### The modules after spending lands

| Module                          | Owns                                                                                                                                          | Published contract                                                            | May import                                                                               |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `src/shell`                     | Menu, router, home, Kuna's Overview, Kuna settings, the page's sync                                                                           | nothing to apps                                                               | `src/shared`, and each `app.ts` from `main.ts` only (`importBoundaries.spec.ts:137-141`) |
| `src/apps/company`              | The company ledger, buckets, roles, rules tab, imports and dry run, review, splits, invoicing, receivables, analytics, mail filing (until 2d) | `AppContribution` with `hub` counts false. Later the owner-money facts for H7 | `src/shared`, its own folder. Only `app.ts` imports the pack                             |
| `src/apps/company/packs/hr-doo` | VAT, owner pay, payroll, dividends, owner loans and advances, year end, the ruleset, pack roles                                               | `PackContribution` to the company app (`packs/packContribution.ts:59-79`)     | its own folder, the company app, `src/shared`                                            |
| `src/apps/loans`                | Bank and informal loans, rate periods, scenarios                                                                                              | `hub` owes and has parts                                                      | `src/shared`, its own folder                                                             |
| `src/apps/investments`          | Holdings, trades, prices file, tax, performance                                                                                               | `hub` has part                                                                | `src/shared`, its own folder                                                             |
| `src/apps/assets` (planned)     | Assets and valuations                                                                                                                         | `hub` has part                                                                | `src/shared`, its own folder                                                             |
| `src/apps/spending`             | Accounts, transactions, lines, categories, budgets, receipts, its rules, its dry run, typed-row and receipt pairing                           | `hub` has and owes parts in euros. Later its credits for H7                   | `src/shared`, its own folder                                                             |
| `src/shared` today              | `calendar`, `money`, `text`, `storage`, `google`, `sync`, `ui`, `charts`, `files`, `xlsx`, `app`                                              | types and functions, never records                                            | `src/shared` only (`importBoundaries.spec.ts:133-135`)                                   |

### Capabilities that get one shared owner

Each passes the test that both users change it for the same reason.

| Shared module                | Holds                                                                                                                                                                                        | Users                 | Why it is one owner                                                                  | When                        |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------ | --------------------------- |
| `src/shared/money` (grows)   | `RateBook`, `eurosAtEcbRate`                                                                                                                                                                 | Investments, spending | One conversion rule. Two copies would give two euro figures for one row              | stage 0 or 2                |
| `src/shared/rates`           | The ECB fetch and its CSV lines                                                                                                                                                              | Investments, spending | The ECB's format is one thing that changes. Each app keeps where it stores the rates | stage 0 or 2                |
| `src/shared/categorising`    | `Rule`, `RuleCondition`, `CONDITION_COLUMNS`, `categorise`, `Verdict`, `TransactionFacts`, `foldRuleText`, the IBAN and card tests, a structural `CategorisableRow` and `TransactionSignals` | company, spending     | How a bank row's IBAN, merchant and camt codes decide a category                     | stage 2a                    |
| `src/shared/bank-statements` | `ImportedRow`, `ImportedStatement`, the camt reader, the tabular reader, profiles as values, the profile guess, the file loader                                                              | company, spending     | What a bank puts in its file                                                         | stage 2b                    |
| `src/shared/vendor-keys`     | The keys file format, the merge, the browser store, the `drive.appdata` adapter                                                                                                              | Investments, spending | How a user's own secret key reaches every browser                                    | stage 3a                    |
| `src/shared/mail-filing`     | Gmail search, window, naming rules, Drive filing, generic over the books                                                                                                                     | company, spending     | How a mailed file lands in a Drive folder                                            | 2d, only with a second user |

What the contract of each shared module is: its exported types and functions. Neither takes an app's books. Each app builds the input from its own model, as `categorisationContextOf` does today for the company (`transactionFacts.ts:30-42`), and that builder stays in the app.

### What stays where it is

- **Company only:** buckets (`bucket.ts`), roles and their guards, VAT treatment (`workbook/domain/vatTreatment.ts`), owner share and owner parts, the hr-doo pack, the balance-chain dry run (`importDryRun.ts`), splits by key, the company `Transaction`, filters and drills, the company analytics builders, onboarding, invoicing.
- **Spending only, until a second user exists:** the receipt reader (only spending reads receipts. If the company later reads supplier invoices by model, extract then), the category tree with parents (the company has `family` and buckets instead, `workbook.ts:27-28`), budgets, typed-row pairing.
- **No shared ledger core.** The two transactions share only the fields the rules read, and a structural type in `src/shared/categorising` covers that. A shared `Transaction` would pull owner share and the balance chain into spending, or strip them from the company.

### Cost of each move

Counted with `grep -rl` at 0717599. Every move is a pure relocation plus import paths, and splits the matching part out of the feature's `words.ts`. `check:figures` reads the books through the app's engines and prints a digest per group (`scripts/figure-digest.mjs:1-16`). It imports company and Investments domain files by path (`:22-32`), so each move edits the script's imports and its digests must stay identical for the fake variants and a real export.

| Move                            | Files moved                                                                                                                                               | Importers to edit                                                                       | Figures                                     |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------- |
| ECB rule to `src/shared/money`  | 1 (`rateBook.ts`)                                                                                                                                         | 20 `src`, 4 tests                                                                       | identical                                   |
| ECB fetch to `src/shared/rates` | 1 plus a helper                                                                                                                                           | Investments' vendor wrapper, 1 test                                                     | identical                                   |
| Rules core                      | 3 (`rule.ts`, `categorise.ts`, `transactionFacts.ts` without the context builder) plus `TransactionSignals` out of `workbook.ts`                          | 11 `src` and 11 tests for the rules files, 4 `src` and 1 test for the signals type      | identical                                   |
| Statement readers               | about 7 (`importedStatement.ts`, `camtStatement.ts`, `tabularStatement.ts`, `importProfile.ts`, `profileGuess.ts`, `statementFiles.ts`, `importFiles.ts`) | 5 `src`, 8 tests                                                                        | identical                                   |
| Vendor keys                     | 4 (`keysFile.ts`, `keysSync.ts`, `vendorKeys.ts`, `googleKeysDrive.ts`) plus their fake                                                                   | 14 `src`, 6 tests                                                                       | identical, and the keys file name unchanged |
| Mail filing, if ever            | about 13 (domain, application, the Gmail and folders adapters)                                                                                            | 10 `src` including 4 in the pack, 7 tests, 1 script (`scripts/support/editorFlows.mjs`) | identical                                   |

### How the boundary spec states the new rules

`tests/importBoundaries.spec.ts` needs four changes, none of them a new kind of rule:

1. Add `'spending'` (and `'assets'`) to the list the first test checks (`:124`), and spending's store to `ADAPTER_WIRING` (`:106-111`).
2. Add `src/shared/categorising/domain/`, `src/shared/bank-statements/domain/` and `src/shared/rates/domain/` to `DOMAIN_SHARED` (`:91`), so an app's domain code may import them. Their adapters go in `infrastructure` folders, which domain code still may not import.
3. Nothing new for "no app imports another" (`:143-145`) or "shared imports no app" (`:133-135`). Those two rules are what force every reuse through `src/shared`.
4. One new test: a shared capability module imports no other capability module except through its domain, so `categorising` and `bank-statements` do not grow into one blob. The only allowed edge is `bank-statements` to `categorising/domain` for `foldRuleText`, or `foldRuleText` moves to `src/shared/text` and the edge disappears. The second is plainer.

`tests/kindNames.spec.ts` (`README.md:2992-2994`) extends to spending's kinds.

### Order of the extractions

Each lands as its own commit with `npm run check`, the boundary spec and `check:figures` identical before and after, and only then does spending import it.

1. ECB rule and fetch, if v1 shows non-euro accounts. Otherwise it moves at the start of stage 2.
2. Spending v1, which imports none of the moved company code.
3. `foldRuleText` to `src/shared/text`, then the rules core.
4. The statement readers.
5. Spending's statements stage.
6. The vendor keys.
7. Spending's receipts stage.
8. Mail filing, only when a personal bank mails statements.

## 9. Decisions for the owner

### A. Typing on a bank account when statements come later

Affects the spending Transactions screen and the statement import. Example: on Monday you type "Bakery 4.20" on your current account. Friday's statement brings "BAKERY X 4,20" for the same money.

- **Type only on cash accounts.** Bank accounts fill from statements alone. Nothing to pair. Cost: bank spending shows only after the statement arrives, and v1, which has no statements, cannot track a bank account at all.
- **Type anywhere, and the import pairs.** A statement row of the same amount within five days of a typed row on that account takes the typed row's place and keeps its category and note. Cost: a pairing step in spending's dry run, which receipts need anyway.

Recommendation: type anywhere, pair on import.

### B. How deep categories go

Affects the categories editor and every chart. Example: "Food" with "Groceries" and "Eating out" under it.

- **One level of parent.** A chart shows parents and opens to children. A budget sits on either. Cost: small.
- **A free-text group like the company's `family`.** Cost: a group is not a category, so it can hold no budget, and two spellings make two groups.
- **Any depth.** Cost: roll-ups, pickers and charts get harder for little gain.

Recommendation: one level.

### C. What a budget is

Affects the budget screen and the home card. Example: groceries 400.00 a month, and in November you spend 350.00.

- **One amount per category, from a month on.** December starts at 400.00 again. Cost: the smallest.
- **Envelopes.** The 50.00 left carries into December, which then has 450.00. Cost: a running balance per category, a rule for overspending, and a start month.

Recommendation: one amount from a month on.

### D. A Revolut account with several currencies

Affects the accounts list and imports. Example: Revolut holds euros and a dollar pocket for travel.

- **One account per currency**, named "Revolut EUR" and "Revolut USD". Each balance is in one currency, and an exchange is a transfer. Cost: two rows in the accounts list for one card.
- **One account holding several currencies**, as Investments' accounts do (`accountCash.ts:14-27`). Cost: every transaction carries its currency, and every balance becomes a list.

Recommendation: one account per currency. Whether Revolut's export is per currency is for the statements lane to confirm.

### E. Which rate turns a dollar into euros

Affects euro totals for non-euro accounts. Example: you exchanged 110.00 EUR into 120.00 USD in March, then spent 30.00 USD in June.

- **The ECB rate of the day the money was spent.** The same rule Investments uses. Cost: the spend in euros differs a little from what the euros cost you.
- **The rate you exchanged at.** The 30.00 USD counts as 27.50 EUR. Cost: a cost basis per pocket, first in first out, which is Investments-grade work.

Recommendation: the ECB rate of the day.

### F. Keeping the receipt photo

Affects receipts and Drive. Example: a 120.00 kettle with a two-year warranty.

- **Keep the photo on Drive** beside the spending file, uploaded with `drive.file` as invoice PDFs already are (`company/invoicing/infrastructure/googleInvoiceDrive.ts:15-31`). Cost: a folder and an upload per receipt.
- **Keep only the read lines.** Cost: no proof for a warranty or a return.

Recommendation: keep the photo. It is cheap and the code already exists for invoices.

### G. Who owns a personal account

Affects spending, loans and investments. The hub proposal left it open ("which app owns a personal account that budgeting and loans both use", proposal decision 2). Example: the account a mortgage instalment leaves from.

- **Spending owns bank, cash and savings accounts. Loans and Investments keep their own records.** A loan may name a spending account later through a published contract. Cost: none now.
- **A shared accounts module every app writes.** Cost: a cross-app record with two writers, which the one-storage-per-write rule forbids.

Recommendation: spending owns them.

## Found while checking

- The hub proposal cites `src/features/...` and `src/packs/...` paths (proposal "Decisions left to each app's own discussion"). The code moved to `src/apps/company` and `src/apps/company/packs`. Its `bucket.ts` count, 36 importers, is 38 `src` files today.
- The proposal says kind names start with their app's id (`company.invoice`). They are bare per app (`coreKinds.ts:13`, `loanKinds.ts:10`), and only pack kinds carry a prefix (`README.md:2992-2994`). That is fine, since each app has its own file.
- Lane 3 says the rule columns mirror the Apps Script for `parity:rules`. `package.json` has no `parity:rules` script today, so nothing ties the rules tab to the Apps Script any more, and moving the rules core is freer than lane 3 assumed.
- Company bucket tones sit in the shared kernel (`src/shared/charts/chartTokens.ts:10`, `:31`). Not harmful, but not something to grow.
- The shared Google words call the `drive.appdata` grant "price keys" (`src/shared/google/words.ts:16`). They need a generic wording once receipts use the same grant.
