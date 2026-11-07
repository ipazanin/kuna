# Spending plan

Build plan for Kuna's Spending app: accounts per currency, typed entries, two-level categories, monthly limits with carry-over and analytics first, then OTP and Revolut statements, then an Enable Banking sync through a small Apps Script, then receipts read by the fiscal QR code and an AI model, checked against Kuna at 0717599.

H6 from [the proposal](../../architecture/hub.md), built to the owner's answers of 4 Nov 2026 and the research in [lane 1, code](research/lane1-code.md), [lane 2, product](research/lane2-product.md), [lane 3, receipts](research/lane3-receipts.md) and [lane 4, statements](research/lane4-statements.md). It follows the shape of [the overview plan](../overview/plan.md) and [the Assets plan](../assets/plan.md), and builds after Assets. Kuna was read at `0717599`, and every `path:line` is against that commit. Every figure is made up.

## Summary

- **Spending is a fifth app** at `#/spending`, with its own file `kuna-spending.json`, first run, Settings, home card and part of Kuna's Overview. It owns the owner's personal bank, cash and savings accounts.
- **One account per currency.** A Revolut card that holds euros and dollars is two accounts. Each amount is kept in its account's currency and shown in euros at the ECB rate of its day.
- **Two-level categories**, seeded with eleven groups and Income, all editable. Three fixed categories sit beside them and never count as spending: Between my accounts, Saved to investments and For the company.
- **Monthly limits with carry-over.** What is left rolls into next month's limit, and overspending lowers it.
- **Kuna's Overview gains bank and cash** and its lead figure becomes Net worth.
- **Statements come as files first:** OTP's mailed PDF, filed from Gmail as Company files its statements, and a dropped Revolut export. Then Enable Banking as a second source into the same import.
- **Receipts split the bank payment they match** into lines with a category each, read by the fiscal QR code and an AI model the owner picks.
- **Each extraction from Company or Investments is its own commit**, with `check:figures` identical before and after, and only then does Spending import it.

## The module map

Every arrow is an import. No arrow points into another app.

```
src/apps/spending
  workbook/     kinds, readers, codecs, store, document, fake seed
  accounts/     accounts, balances
  entries/      typed entries, transfers, the Transactions screen
  categories/   the tree, the starter set, what a row counts as
  budgets/      limits and carry-over
  analytics/    month totals, the month flow, charts
  rates/        the ECB rates of the file's foreign accounts, in memory
  statements/   OTP and Revolut readers, the dry run, review, rules     (stage 2)
  pairing/      same money, transfer pairs                             (stage 2)
  bankSync/     the Apps Script port and adapter                       (stage 3)
  receipts/     QR, matching, photo, the receipt task in assist/       (stage 4)
  home/, overview/, onboarding/, settings/, sync/
        │
        ▼
src/shared  storage, money (+ RateBook), rates (ECB fetch), categorising (rules core),
            mail-filing, text (+ foldRuleText, occurrence keys), charts (+ swatches),
            secrets and ai (the AI-assist plan), ui, app (hub contract, personalNet)
src/shell   reads AppContribution only
```

### What Spending owns

- **Records:** accounts, transactions, categories, budgets, settings, then rules, receipts and receipt lines.
- **Figures:** every account balance, every euro value of a row, every month total, every limit and its carry, the hub parts, the dry run of a statement, the pairing of a typed row or a receipt with a bank row, and the pairing of two transfer legs.
- **Personal accounts.** A loan or an investment account stays in Loans or Investments. Money that leaves a Spending account for one of them is a row in a Spending category, so nothing counts twice on Kuna's Overview.

### Shared modules it needs

Each passes the test that two users change it for the same reason. Each lands as its own commit, in this order, with `npm run check`, the boundary spec and `check:figures` identical on every fake set and the live files before and after.

| Order | Shared module                                 | Holds                                                                                                                                                                                                                                           | From                                                                                                                          | The two users and their one reason                                                                               | Stage    |
| ----- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------- |
| 1     | `src/shared/money/rateBook.ts`                | `RateBook`, `NO_RATES`, `eurosAtEcbRate`                                                                                                                                                                                                        | `src/apps/investments/prices/domain/rateBook.ts:9-26`                                                                         | Investments and Spending: how a foreign amount becomes euros. Two copies would give two euro figures for one row | 0        |
| 2     | `src/shared/rates/infrastructure/ecbRates.ts` | The ECB request and its CSV lines, as `[day, rate]` pairs or a failure                                                                                                                                                                          | `ecbRates` in `src/apps/investments/prices/infrastructure/vendors/ecb.ts:7-58`. Investments' `ecb` vendor (`:60-73`) wraps it | Investments and Spending: what the ECB's data API answers                                                        | 0        |
| 3     | `src/shared/charts/swatches.ts`               | `Swatch` and `SWATCHES`                                                                                                                                                                                                                         | `src/apps/company/workbook/domain/categoryColour.ts:4-24`. The bucket fallback stays                                          | Company and Spending: the chart palette a category may wear, which `ColourSwatchPicker.vue:21-29` offers         | 0        |
| 4     | `src/shared/text/fold.ts`                     | `foldRuleText`                                                                                                                                                                                                                                  | `src/apps/company/rules/domain/transactionFacts.ts:9-11`                                                                      | The rules and the camt reader. Moving it removes the only edge from statements to rules (`camtStatement.ts:6`)   | 2        |
| 5     | `src/shared/categorising/domain/`             | `Rule`, `RuleCondition`, `CONDITION_COLUMNS`, `inTryingOrder`, `categorise`, `Verdict`, `CategorisationContext`, `TransactionFacts`, the IBAN, card, revenue code and foreign currency tests, and `TransactionSignals` as a structural row type | `rule.ts:12-59`, `categorise.ts:9-69`, `transactionFacts.ts:14-140` without the builder at `:30-42`, `workbook.ts:56-63`      | Company and Spending: how a bank row's IBAN, payee text and bank codes decide its category                       | 2        |
| 6     | `src/shared/mail-filing/`                     | Gmail search and window, the filed-file properties, the PDF statement naming, `fileMail`, `MailSource<Books>`, the Gmail and folders adapters and their fakes                                                                                   | `src/apps/company/mail/`, except `useMailSync.ts`, the settings card and the sources                                          | Company and Spending: how a mailed file lands in a Drive folder                                                  | 2        |
| 7     | `src/shared/text/factKey.ts`                  | `occurrenceKeys`: a key of a row's facts with its count among equal rows of the file                                                                                                                                                            | `src/apps/company/imports/domain/tabularStatement.ts:132-138`                                                                 | Company's table reader and Spending's Revolut reader: the same row in a later export gets the same key           | 2        |
| 8     | `src/shared/secrets` and `src/shared/ai`      | `kuna-secrets.json`, the Kuna-wide file grown from Investments' keys file, then the AI keys, the adapters, `useAiTask` and `imagePartOf`                                                                                                        | [The AI-assist plan](../ai-assist/plan.md) makes this move. Spending makes none of its own                                    | Every app with an AI task, and Investments' price keys                                                           | before 4 |

What does not move, and why:

- **The camt reader, the profile reader and the profile guess stay in Company.** Neither personal bank gives camt, and the profile reader cannot read Revolut. It knows no state, fee or second date (`importProfile.ts:23-37`), and it refuses a file whose balances do not follow row by row (`tabularStatement.ts:131`), which a file with its pending rows left out breaks. They move when a second user appears, such as an OTP CSV export (see Unconfirmed).
- **The OTP PDF reader, the Revolut reader and the Enable Banking reader stay in Spending.** One user each. The PDF text reader moves to `src/shared` if Company ever reads a statement PDF.
- **The condition cells' reading stays in Company's `readRules.ts`.** Spending writes only `counterparty_contains` and `counterparty_iban`, so it stores its rules through a small codec of its own (`workbook/domain/ruleReading.ts`) and hands the shared core a `Rule` built from each. The reading moves if Spending ever needs a third condition.
- **The rules tab UI, `proposeRule`, the backtest, drafts, coverage and the context builder stay in Company.** They read the company's clients, settings and buckets (`src/apps/company/rules/domain/categorisationContext.ts`, `proposeRule.ts:20`). Spending writes its own small builder and its own rule list.
- **The QR decoder and the scripts.run adapter stay in Spending.** One user each.
- **The file loader** `loadImportFile` (`imports/infrastructure/importFiles.ts:13-29`) stays in Company. Spending reads a sheet straight through `readFirstSheet`, already shared (`src/shared/xlsx/sheetGrids.ts:48`).
- **No shared ledger.** Spending's transaction shares with Company's only the fields the rules read, and the structural row type in `src/shared/categorising` covers that.

### The published contract

Spending gives the shell one `hub` part through `AppContribution.hub` (`src/shared/app/appContribution.ts:81`, `:107`), with `counts: true`, built in one file, `src/apps/spending/home/presentation/spendingHubFigures.ts`, from its own model:

```ts
/** What Spending adds to Kuna's Overview: what its open accounts hold in euros today, and what the overdrawn ones owe. */
export function spendingHubFigures(book: SpendingBook, rates: RateState, day: CivilDate): HubFigures<CountedHubPart> | 'opening' | null
```

- **Bank and cash**, side `has`: the euro balances of the open accounts at or above zero, linking to `/spending/accounts`. Its caption names how many accounts it adds up.
- **Overdrawn**, side `owes`: the euro balances below zero, shown only when there is one.
- **Notes:** "1 account in USD not converted: the ECB rates did not load".
- `'opening'` while the file opens, or while the rates load for a file with a foreign account. Null for a file with no accounts.

`personalNet` (`src/shared/app/personalNet.ts:34-51`) and the Overview (`src/shell/overview/OverviewScreen.vue:49-56`) take the parts with no change. The money format stays the default euro one, as Loans' does (`src/apps/loans/app.ts:53`), so the currency check at `personalNet.ts:47-48` passes.

Spending publishes nothing to another app. The later H7 matching of the company's payments to the owner with personal credits is not planned here.

### The boundary spec

`tests/importBoundaries.spec.ts` changes, none of them a new kind of rule:

1. `'spending'` joins the apps the first test checks (`:124`), and `src/apps/spending/workbook/application/spendingStore.ts` joins `ADAPTER_WIRING` (`:106-111`).
2. `DOMAIN_SHARED` (`:91`) gains `src/shared/categorising/domain/` and `src/shared/mail-filing/domain/`, so Company's and Spending's domain code may import them. `RateBook` lands in `src/shared/money/`, which is already there.
3. A new case: a shared capability module imports no other capability module, so `categorising`, `mail-filing` and `rates` never grow into one. Moving `foldRuleText` to `src/shared/text` leaves no edge between them.
4. "No app imports another" (`:143-145`) stays as it is. Spending reads no app's `facts.ts`.
5. The AI-assist plan's cases (only `src/shared/ai/infrastructure/` calls an AI host, assist tasks only read) cover `src/apps/spending/receipts/assist/` with no change.

`tests/kindNames.spec.ts` gains a Spending block, as Loans' (`:32-45`).

## What the owner sees

- **The home** has a Spending card: spent this month, what is left of the limits, and later "N rows to review".
- **Overview** at `#/spending`: this month's spending by group against its limits, the month's income, spending and saving, twelve months by group, and the accounts with their balances.
- **Entries** at `#/spending/transactions`: rows by day, filtered by month, account and category, with Add. Later a To review tab, Import, and Add a receipt.
- **Limits** at `#/spending/budgets`: each limited category with its limit, what carried in, what is available, spent and left.
- **Accounts** at `#/spending/accounts`, and an account's page at `#/spending/account?account=<uuid>`.
- **Settings:** Categories, the books file, later Statements, Rules, Bank sync and Receipts.

Every save has the toast with Undo.

### The worked example

Made up throughout.

**Accounts on 4 Nov 2026.**

| Account       | Currency | Balance today | In euros  | How                                    |
| ------------- | -------- | ------------- | --------- | -------------------------------------- |
| OTP current   | EUR      | €1,850.00     | €1,850.00 |                                        |
| Revolut EUR   | EUR      | €320.50       | €320.50   |                                        |
| Revolut USD   | USD      | $170.00       | €155.96   | 170.00 ÷ 1.0900, the ECB rate of 4 Nov |
| Cash          | EUR      | €64.00        | €64.00    |                                        |
| Bank and cash |          |               | €2,390.46 | 1,850.00 + 320.50 + 155.96 + 64.00     |

**A dollar row.** $30.00 spent on 10 Oct from Revolut USD, with an ECB rate of 1.0800 that day, counts as €27.78 in October's spending (30.00 ÷ 1.0800 = 27.777…). A row converts at its own day's rate. A balance converts at the rate of the day it is shown for.

**A limit with carry-over.** Food has a limit of €400.00 from September.

| Month     | Limit   | Carried in | Available | Spent   | Carried out |
| --------- | ------- | ---------- | --------- | ------- | ----------- |
| September | €400.00 | €0.00      | €400.00   | €350.00 | +€50.00     |
| October   | €400.00 | +€50.00    | €450.00   | €480.00 | −€30.00     |
| November  | €400.00 | −€30.00    | €370.00   | so far  |             |

**Kuna's Overview**, with Assets as its plan's example:

| Tile              | Figure      | Caption                              |
| ----------------- | ----------- | ------------------------------------ |
| Net worth         | €149,145.26 |                                      |
| Investments value | €40,000.00  |                                      |
| Owed to you       | €500.00     |                                      |
| Assets value      | €256,254.80 | €88,884.80 yours after the Home loan |
| Bank and cash     | €2,390.46   | Across 4 accounts                    |
| You owe in all    | €150,000.00 | Next €650.00: On 15 Dec, Home loan   |

40,000.00 + 500.00 + 256,254.80 + 2,390.46 − 150,000.00 = 149,145.26.

## The rules

### The records

Schema `{ spending: 1 }`. Ids, references, dates and money as Loans and Assets keep them: a UUID from the first write (`src/shared/storage/domain/recordId.ts:10-26`), a reference as a bare UUID, days as `yyyy-mm-dd`, money as amount text read into integer cents (`src/shared/money/money.ts:5`). Kind names are bare, as in Loans.

| Kind          | Fields                                                                                                                                                                                                                    | Read rules                                                                                                                                                       | Stage |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `account`     | `name`, `kind` (`bank`, `cash` or `savings`), `bank` (`otp`, `revolut` or `other`), `currency`, `opening`, `opened_on`, `iban`, `closed`                                                                                  | A name. A currency `currencyCodeOf` knows (`src/shared/money/currencyCode.ts:16`). `iban` blank on cash, and no two accounts with one IBAN and currency          | 1     |
| `category`    | `name`, `kind` (`spending`, `income`, `saving`, `transfer` or `company`), `parent`, `order`, `colour`, `hidden`                                                                                                           | A parent has no parent and the same kind. The three fixed categories are one of each of `saving`, `transfer` and `company`, have no parent and cannot be deleted | 1     |
| `transaction` | `account`, `date`, `amount` (signed in the account's currency, credits positive), `payee`, `category` (blank waits on review), `note`, `source` (`typed`, `statement` or `receipt`), `pair` (the other leg of a transfer) | Names an account and a category that count. `pair` names a row on another account whose `pair` names it back                                                     | 1     |
| `budget`      | `category`, `from` (a month), `amount` (euros, 0 ends it)                                                                                                                                                                 | A `spending` category. One per category and month. No budget on a group and on one of its children at once                                                       | 1     |
| `setting`     | `key`, `value`                                                                                                                                                                                                            | Read into `SpendingSettings` by one reader. An unknown key is listed, not refused. Landed with the bank sync, and OTP's mail adds its keys                       | 3     |
| `transaction` | gains `description`, `counterparty_iban`, `import_key`, `statement` (the label of its file), `categorised_by` (`person` or `rule`), `moved_at` (the time the two legs of an exchange or a pocket move share), `pocket`    | `import_key` once per account                                                                                                                                    | 2     |
| `rule`        | `order`, one of `counterparty_contains` and `counterparty_iban`, `category` a Spending category id                                                                                                                        | Exactly one of the two conditions. Any other condition column is refused. Names a category that counts                                                           | 2     |
| `receipt`     | `transaction`, `merchant`, `merchant_oib`, `buyer_oib`, `issued_at`, `total`, `jir`, `zki`, `read_by` (the model), `photo` (a Drive file id or blank), `latitude` and `longitude` (decimal degrees as text, or blank)     | Names a transaction. `total` above zero                                                                                                                          | 4     |
| `line`        | `transaction`, `receipt`, `printed`, `text`, `amount`, `category`                                                                                                                                                         | The lines of a transaction add up to its amount. Each names a category that counts                                                                               | 4     |

The reader is `readSpendingBook`, shaped like `readLoanBook`. Writes refuse to orphan a row, a budget, a line or a receipt through `dependentRefusalsOf` (`src/shared/storage/application/dependentRefusals.ts:17`). Deleting one leg of a transfer deletes the other in the same write, and one Undo puts both back.

### What a row counts as

**Owner:** `rowSide(row, lines, categories)` in `src/apps/spending/categories/domain/rowSide.ts`. It gives a row's euro amount to the kind of its category, or to each line's category when the row has lines.

- `spending`: money out is spending, money in is a refund that lowers it.
- `income`: counts as income.
- `saving`, Saved to investments: money sent to the broker. It is neither spending nor income, and the month shows it as saved.
- `transfer`, Between my accounts: counts nowhere. It only moves balances.
- `company`, For the company: counts nowhere, in no spending, income or limit figure.
- Blank: waits on review and counts nowhere until it has a category.

A loan instalment is spending under "Loan instalments" in Money and fees. Loans takes the principal off what you owe, and Spending takes the whole instalment off the account, so Net worth moves by the interest only.

### Balances

**Owner:** `accountBalance(account, rows, day)` in `src/apps/spending/accounts/domain/accountBalance.ts`: the opening plus every row from `opened_on` to the day, in the account's currency. The opening may be below zero, for an account that was overdrawn on the day counting starts, which the account dialog takes as an amount and an "Overdrawn on that day" switch, since a phone's number pad has no minus. An account keeps its currency once entries name it, which `ACCOUNT_WRITES` refuses to change. A closed account still counts in Bank and cash while it holds money, so closing it never drops money from Net worth (`countedAccounts` in `rates/domain/euroRows.ts`). Balances are worked out, never read from a bank. A statement's own closing balance is a check in stage 2, and a mismatch is a note, not a refusal.

### Euros

- **A row in euros:** `euroRows(book, rates)` in `src/apps/spending/rates/domain/euroRows.ts` is the one place that gives each row its euro amount, through the shared `eurosAtEcbRate(decimalOfMoney(amount), currency, date, rates)` (`rateBook.ts:20-26`, `src/shared/money/decimal.ts:104`). A euro account passes through. A row the rates do not cover yet is unrated and listed, never guessed.
- **A balance in euros:** the account's balance on the day, converted at that day's rate, by the same `eurosAtEcbRate`.
- **Card spends abroad on a euro account** need nothing: the bank booked euros.
- **Where the rates come from:** `startRates()` in `src/apps/spending/rates/presentation/useRates.ts`, called from Spending's `start()` as Investments starts its prices (`src/apps/investments/app.ts:95`). It fetches each foreign currency of the file once per page load through the shared ECB fetch, from the oldest day it needs, and keeps the answer in memory only, as Assets keeps the DZS index. ECB rates are public and can be fetched again, so they need no file. Its state is loading, or the rates with whether any currency failed (`ratesStateOf` in `rates/domain/ratesState.ts`). A currency the file comes to need waits as loading until its answer arrives. The rate on or before a day is `rateBookOfSeries` in `src/shared/money/rateBook.ts`, which Investments' prices file builds on too. A sync's ECB rates step asks for them again. The CSP already allows the ECB (`index.html:7`).

### Categories

The starter set is seeded on the first run, in Croatian as the owner asked, and in English for a first run in English, from one table. Everything is editable: rename, move a child to another group, reorder, recolour, hide, and delete into another category, which moves its rows, lines and rules and deletes its limits in one write, so one Undo puts it all back. The other category keeps its own limits, whose carry would change if they took on the deleted one's history (the owner's answer of 5 Nov). Hiding keeps history. Income stays its own group of kind `income`.

| Group (EN / HR)                      | Children (EN / HR)                                                                                                                                                                                     |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Food / Hrana                         | Groceries / Namirnice. Restaurants / Restorani. Coffee / Kava. Delivery / Dostava                                                                                                                      |
| Home / Dom                           | Rent / Najam. Utilities / Režije. Building reserve / Pričuva. Internet and phone / Internet i telefon. Maintenance / Održavanje. Household goods / Kućanske potrepštine                                |
| Transport / Prijevoz                 | Fuel / Gorivo. Parking and tolls / Parking i cestarine. Public transport and taxi / Javni prijevoz i taksi. Car service / Servis auta. Car insurance and registration / Osiguranje i registracija auta |
| Boat / Brod                          | Berth / Vez. Fuel / Gorivo. Service and gear / Servis i oprema. Insurance and registration / Osiguranje i registracija broda                                                                           |
| Health / Zdravlje                    | Supplementary insurance / Dopunsko osiguranje. Pharmacy / Ljekarna. Doctor and dentist / Liječnik i stomatolog                                                                                         |
| Personal / Osobno                    | Clothes and shoes / Odjeća i obuća. Care and hairdresser / Njega i frizer. Electronics / Elektronika                                                                                                   |
| Leisure / Slobodno vrijeme           | Sport / Sport. Hobbies / Hobiji. Going out and culture / Izlasci i kultura. Subscriptions / Pretplate                                                                                                  |
| Travel / Putovanja                   | Accommodation / Smještaj. Tickets / Karte. On the trip / Na putu                                                                                                                                       |
| Family and gifts / Obitelj i pokloni | Gifts / Pokloni. Donations / Donacije. Pets / Ljubimci                                                                                                                                                 |
| Money and fees / Novac i naknade     | Bank fees / Bankovne naknade. Taxes and charges / Porezi i pristojbe. Insurance / Osiguranja. Loan instalments / Rate kredita                                                                          |
| Other / Ostalo                       | Other / Ostalo                                                                                                                                                                                         |
| Income / Prihodi                     | Salary / Plaća. Profit payout / Isplata dobiti. Interest / Kamate. Other income / Ostali prihodi                                                                                                       |

Beside the groups, fixed: Between my accounts / Između mojih računa (`transfer`), Saved to investments / Prijenos u ulaganja (`saving`), For the company / Za tvrtku (`company`).

The repayment of company costs from the company lands in For the company, the same category as the cost, so the pair nets out of every figure.

### Limits with carry-over

**Owner:** `budgetMonths(budgets, totals, month)` in `src/apps/spending/budgets/domain/budgetCarry.ts`.

- A category's limit in a month is the amount of its newest budget with `from` on or before that month. A budget of 0 ends it. From then nothing carries, and a later budget starts a new run.
- Available is the limit plus what carried in. What carries out is available less spent, where spent is the `spending` rows of the category in euros, refunds taken off, and for a group its children's too.
- A carry can go below zero and stays there until later months make it up. Available below zero reads "Over by".
- The month still filling shows left so far. Its carry reaches next month only once it ends.
- `left to spend` on the home card is the sum of available less spent over the limited categories of the month.
- A row the rates do not reach counts as nothing, and `BudgetMonth` counts such rows in the month and in the months its carry comes from. Limits, the Overview's limits card and the home card then say how many entries in another currency are not counted. A month that starts below zero draws its carried debt apart from what it spent.
- A limit's history is worked out on load, never stored, so a later rate, a child moved into a limited group or a category deleted into another changes past months' carry.

### Analytics

| View                               | Owner                                                                                                             | Built from                                                                                                                                   |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Spending by group this month       | `monthTotals(rows, categories, month)` in `analytics/domain/monthTotals.ts`, per category and per group           | `DonutCard`, a drill to the group's children and to Transactions filtered by category                                                        |
| Limits against spent               | `budgetMonths`                                                                                                    | `ProgressMeter` and `KpiTile` in `src/shared/ui`                                                                                             |
| Twelve months by group             | `monthTotals` over `monthsFrom` (`src/shared/calendar/monthKey.ts:49`)                                            | A stacked bar builder of Spending's own, `ChartCard`, the month still filling marked by `markIncomplete` (`src/shared/charts/chartTheme.ts`) |
| Income, spending and saved a month | `monthFlow(totals)` in `analytics/domain/monthFlow.ts`, with the savings rate (income less spending, over income) | A bar and line builder of Spending's own                                                                                                     |
| Balances                           | `accountBalance` and the euro rule                                                                                | `KpiTile`, `FigureTable`, `SparkLine`                                                                                                        |

Spending colours a category by its swatch or its group's, never by Company's bucket tones (`src/shared/charts/chartTokens.ts:10`, `:31`).

## Stages

Each stage is a commit or a small set of commits, checked with lint, format, typecheck, vitest, both builds, `check:figures` on every fake set and the live files, and the targeted visual and touch checks. Locally `npm run check:visual -- --only <pages> --widths 360,640,1024`, since CI keeps catching overflow at 640 and 1024 px. CI runs all nine widths. Touch steps run at 360 and 430 px (`scripts/touch-check.mjs:197`), and every new control is at least 44 by 44 px.

### 0. Groundwork, no behaviour change

Three commits, in this order. Assets' resume move (`src/shared/storage/presentation/resumeFileLookup.ts`) is assumed landed. If it has not, Spending's stage 1 does it as Assets' stage 0 describes.

1. **The ECB conversion rule.** `rateBook.ts` moves to `src/shared/money/rateBook.ts`. 25 files import it today across `src`, `tests` and `scripts` (`grep -rln "rateBook'"`), and each changes one path. `pricesFileRateBook` (`src/apps/investments/prices/domain/pricesFileBooks.ts:100`) stays in Investments.
2. **The ECB fetch.** `ecbRates` and `csvFields` move to `src/shared/rates/infrastructure/ecbRates.ts`, taking a fetch and answering `[day, rate]` lines or a failure. Investments' vendor object keeps its id, limits and words and calls it. Its fake twin moves beside it.
3. **The swatches.** `Swatch` and `SWATCHES` move to `src/shared/charts/swatches.ts`, with their names from a shared words file. Company's `categoryColour.ts` keeps the bucket fallback.

- **Specs:** the moved specs move with their code and assert the same. No new spec.
- **check:figures:** every group identical on every fake set and the live files, `investments.tax.*` and `investments.portfolio` among them, since they read the rates.
- **Visual and touch:** the Investments prices and Settings pages, and Company's category colours, unchanged.

### 1. v1: accounts, typed entry, categories, limits, analytics

One commit.

**The app and its file.** Copied from Loans' and Assets' skeleton: `src/apps/spending/app.ts`, `words.ts`, `workbook/` (the kinds, readers, `readSpendingBook`, codecs, `spendingStore.ts` over `pageWorkbookStore` as `loansStore.ts:9-14` is, write guards, `spendingDocument.ts` as `loansDocument.ts:8-26` is, the file helpers, the local status and export), `onboarding/presentation/StartScreen.vue` over the shared first run, `settings/presentation/` with the books card, Export and Switch storage, `sync/presentation/spendingSyncGroup.ts` with the rates step, `home/presentation/spendingHomeCard.ts` and `spendingHubFigures.ts`.

**Outside the app:**

- `src/main.ts:19-22` installs Spending after Assets.
- `src/shared/styles/tokens.css:79-80`, `:171-172` gain `--app-spending`, and `tests/tokenContrast.spec.ts:22` lists it.
- `tests/designCatalogue.spec.ts:16-22` gains a Spending area.
- `tests/importBoundaries.spec.ts` as in the boundary spec, points 1 and 3.
- `tests/fixtures/writeBack.ts:116-128` gains `SPENDING`, and `tests/recordStorageContract.spec.ts:886-897` its kinds' write rules.
- `index.html:15` and `public/manifest.webmanifest:5` name your spending beside the books, loans, investments and assets.
- `src/shell/overview/words.ts:10-11`, `:22-23`: `net` becomes "Net worth", and `leavesOut` lists only the apps' own notes, since bank accounts now count. The owner chose this name for when a spending app brings bank accounts (the Assets plan, The owner's answers).
- `README.md`: a "Spending" section after Assets', and the Overview and `check:figures` lines.

**Domain, one owner per figure:** `accountBalance`, `euroRows`, `rowSide`, `monthTotals`, `budgetMonths`, `monthFlow`, `spendingHubFigures`, and `starterCategories(language)` in `categories/domain/starterCategories.ts`.

**Screens.** Overview, Entries with the entry dialog, Limits, Accounts and an account's page, Settings with Categories. Built from `PageHeader`, `DashboardGrid`, `KpiTile`, `AppCard`, `FigureTable`, `ChartCard`, `DonutCard`, `ProgressMeter`, `FormGrid`, `AppDialog`, `MoneyInput` and `ColourSwatchPicker` in `src/shared/ui`. No new shared component.

**The entry dialog.** Money out, money in, or between my accounts. Amount, category, account (the last used), date (today), payee, note. Between my accounts takes a second account, and a second amount when the currencies differ, and writes both legs with `pair` set in one write. On a phone the amount field opens the number pad.

**Specs:**

- `tests/spendingReaders.spec.ts`: each read rule in the records table, problems listed by kind.
- `tests/spendingFirstRun.spec.ts`, as `tests/loansFirstRun.spec.ts`, with `kuna-spending.json` and the starter set in both languages.
- `tests/spendingWrites.spec.ts`: a transfer's two legs in one write, deleting one leg takes the other and one Undo restores both, delete-into moves rows, lines and rules and deletes its limits, as Groceries into Restaurants keeps Restaurants' own limit, a budget on a group and its child refused.
- `tests/accountBalance.spec.ts`: the worked example's balances, a row before `opened_on` left out.
- `tests/euroRows.spec.ts`: the $30.00 row at €27.78, a balance at the day's rate, a day with no rate taking the newest earlier one, an unrated row before the series starts.
- `tests/budgetCarry.spec.ts`: the worked example's three months, a budget of 0 ending the carry, a new amount from a month keeping the carry, a refund lowering spent, a group counting its children, a carry staying below zero.
- `tests/monthTotals.spec.ts`: each kind in its place, transfers, saving and company outside spending, the month still filling.
- `tests/spendingHubFigures.spec.ts`: €2,390.46, an overdrawn account as `owes`, rates failed with the note, opening while rates load.
- `tests/personalNet.spec.ts` gains a four-app case with Bank and cash.
- `tests/kindNames.spec.ts` gains Spending's block.

**check:figures:**

- **New inputs:** `--spending <kuna-spending.json>` with an optional `--spending-rates <saved ECB CSV per currency>`, and `--fake-spending <sample, foreign or over>` with the fake rates. A file without rates values its foreign rows as unrated, as an Investments file without its prices file has no rates (`scripts/figure-digest.mjs:13-15`).
- **New groups:** `spending.read.records`, `spending.read.problems`, per account by its place in the file and never its name `spending.account-N.balance`, `spending.months` (income, spending and saved per month), `spending.month.<yyyy-mm>.categories` and `spending.budgets.<yyyy-mm>` for the newest complete month and the month of the day, `spending.hub`.
- **Changes:** `hub.personal` (`:336-345`) when a Spending input is given.
- **Must stay identical:** every Company, `loans.*`, `investments.*` and `assets.*` group, and `hub.personal` without a Spending input.

**Fake variants:** `?spending=` `drive` (an empty file with the starter set), `browser` (kept in this browser nine days past its export), `sample` (the worked example's four accounts, three months of rows, Food's carry and a transfer pair), `foreign` (only the USD account), `over` (two limits overspent), `other-device`, `opening`, `failed`. `?rates=` `opening` and `failed`. Ids `fa4e3000-…`, beside Loans' `fa4e0000-…` and Assets' `fa4e2000-…`.

**Visual pages** at 360, 640 and 1024 px locally, each with a Croatian twin:

- `spending-start`, `spending-overview-empty` on `?spending=drive`, `spending-overview` on `?spending=sample`.
- `spending-transactions`, `spending-entry` (the dialog open), `spending-transfer` (two currencies).
- `spending-budgets` and `spending-budgets-over` on `?spending=over`.
- `spending-accounts`, `spending-account-usd` with the rate line, `spending-rates-failed` on `?spending=sample&rates=failed`.
- `spending-categories` (the tree, the fixed three apart), `spending-settings`, `spending-settings-browser`.
- `spending-opening`, `spending-failed`.
- `kuna-overview` and its twin on `?loans=sample&investments=sample&assets=sample&spending=sample`, replacing their expected text (`scripts/visual-check.mjs:925-940`), `kuna-overview-spending-only`, and `kuna-overview-rates-opening` with the placeholder.
- `home`, `home-croatian` and `home-fresh` with the fifth card.
- Editor flows: add, edit and delete a typed row with Undo, a transfer with Undo, a category renamed, moved and deleted into another with Undo, a limit set and ended.

**Touch steps:**

- `spending-start-on-drive` beside `loans-start-on-drive`, and the first run kept in this browser.
- The home card opens Spending's Overview.
- Add money out by touch: amount on the number pad, a category, save, the row on Transactions, then Undo.
- Add a transfer between two accounts and read both balances.
- Tap a group on the donut and land on its children, then on Transactions filtered by it, then Back.
- Set a limit on Food and read its carry on Limits.
- `kuna-overview` (`scripts/touch-check.mjs:429`) also taps Bank and cash, lands on `#/spending/accounts`, then Back.

**New strings**, each checked at 360 px, since Croatian runs a third longer:

| English                                                                        | Croatian                                                                                                      |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Spending                                                                       | Potrošnja                                                                                                     |
| Your accounts, what you spend and your monthly limits, in a file of their own. | Vaši računi, potrošnja i mjesečna ograničenja u zasebnoj datoteci.                                            |
| Pick your Spending file                                                        | Odaberite datoteku potrošnje                                                                                  |
| Spending file                                                                  | Datoteka potrošnje                                                                                            |
| Accounts                                                                       | Računi                                                                                                        |
| Add an account                                                                 | Dodaj račun                                                                                                   |
| Bank account, Cash, Savings                                                    | Bankovni račun, Gotovina, Štednja                                                                             |
| Opening balance on                                                             | Početno stanje na dan                                                                                         |
| Money out, Money in, Between my accounts                                       | Isplata, Uplata, Između mojih računa                                                                          |
| Payee or payer                                                                 | Primatelj ili platitelj                                                                                       |
| Amount in {currency}                                                           | Iznos u valuti {currency}                                                                                     |
| No entries yet                                                                 | Još nema unosa                                                                                                |
| Categories                                                                     | Kategorije                                                                                                    |
| Group                                                                          | Skupina                                                                                                       |
| Hide                                                                           | Sakrij                                                                                                        |
| Delete and move its entries to                                                 | Obriši i premjesti unose u                                                                                    |
| Saved to investments                                                           | Prijenos u ulaganja                                                                                           |
| For the company                                                                | Za tvrtku                                                                                                     |
| Counted in no spending, income or limit figure                                 | Ne ulazi ni u potrošnju, ni u prihode, ni u ograničenja                                                       |
| Limits                                                                         | Ograničenja                                                                                                   |
| Monthly limit                                                                  | Mjesečno ograničenje                                                                                          |
| Carried in                                                                     | Preneseno                                                                                                     |
| Available                                                                      | Raspoloživo                                                                                                   |
| Left this month                                                                | Preostalo ovaj mjesec                                                                                         |
| Over by {amount}                                                               | Prekoračeno za {amount}                                                                                       |
| Spent, Income, Saved to investments                                            | Potrošeno, Prihodi, Prijenos u ulaganja                                                                       |
| Savings rate                                                                   | Stopa štednje                                                                                                 |
| Bank and cash                                                                  | Banka i gotovina                                                                                              |
| Across {n} account(s)                                                          | Na {n} računu (računa), through the plural helper                                                             |
| Overdrawn                                                                      | U minusu                                                                                                      |
| At the ECB rate of {date}                                                      | Po tečaju ESB-a od {date}                                                                                     |
| {n} account(s) in another currency not converted: the ECB rates did not load   | {n} račun (računa) u drugoj valuti nije preračunat: tečajevi ESB-a nisu se učitali, through the plural helper |
| Net worth                                                                      | Neto imovina                                                                                                  |

The starter categories' names are in the categories table above.

### 2. Statements: OTP and Revolut

Four commits, in this order.

**2a. The rules core.** `foldRuleText` moves to `src/shared/text/fold.ts` beside `fold`, then the core moves to `src/shared/categorising/domain/`, as in the module map. `CategorisableTransaction` (`transactionFacts.ts:44`) becomes a structural `CategorisableRow` there, and `TransactionSignals` (`workbook.ts:56-63`) moves with it, so `importedStatement.ts:3` and the company workbook import it from there. Company keeps `categorisationContextOf` (`transactionFacts.ts:30-42`), its codec, its tab UI and its drafts. About 14 `src` files and 12 tests and scripts change a path, among them `scripts/figure-digest.mjs:44`, `:46`. **check:figures:** every group identical, `review.queue`, `review.rules` and `review.unaccounted` (`:238-244`) among them.

**2b. Mail filing.** `src/apps/company/mail/` moves to `src/shared/mail-filing/`, generic over the books: `MailSource<Books>` with `terms(books: Books)` (`mailFiling.ts:63-72`, `:69`) and `MailReading<Books>` (`:51-55`). Company's sources, `useMailSync.ts` and `MailSettingsCard.vue` stay, and so do the pack's. About 13 files move and 18 files in `src`, `tests` and `scripts` change a path. **check:figures:** every group identical. **Visual and touch:** Company's mail settings and its sync step unchanged.

**2c. Occurrence keys.** `occurrenceKeys` lands beside `factKey` (`src/shared/text/factKey.ts:2-5`), and `tabularStatement.ts:132-138` calls it. **check:figures:** `read.records` and every group identical, since the keys come out the same.

**2d. Spending's statements.** One commit for everything Revolut needs, built and checked. One more for OTP, which waits for a real statement PDF: its mail with the `setting` kind, the PDF text, its reader, the sync's two steps, Settings' Statements tab and `spending-import-otp`.

- **Records:** the new `transaction` fields and `rule`, as in the records table. OTP's mail adds its keys to `setting`, which landed with stage 3.
- **OTP's mail (waits for OTP).** A Spending `MailSource` in `statements/application/otpMailSource.ts` files OTP's statement mail into the Statements folder below the Spending file's folder, by the sender and subject the owner saves on Settings, Statements, with the shared PDF naming. OTP's file is always `Izvod-eurski racun.pdf`, so it is named `<mail day>-Izvod-eurski racun.pdf` (`statementMailFiling.ts:21-29`), and the period comes from inside the PDF. The bank presets (`src/apps/company/mail/domain/bankPresets.ts:10`, Erste only) gain OTP, with the sender read off a real statement mail at build time.
- **The PDF text (waits for OTP).** `pdfjs-dist` is a new dependency, loaded only on the first PDF as SheetJS is (`src/shared/xlsx/sheetGrids.ts:18`), in `statements/infrastructure/pdfText.ts`, which returns each page's text items with their positions.
- **OTP's reader (waits for OTP):** `otpStatement(pages)` in `statements/domain/otpStatement.ts`, written against one real statement the owner provides and never commits. It reads the period, the account's IBAN, the opening and closing balances and each row's dates, amount, payee, IBAN, description and reference. A PDF with no text refuses with a reason. It hands the dry run the same `StatementRows` as Revolut's reader (`statements/domain/statementRows.ts`), and adds its closing balance to that type then.
- **Revolut's reader:** `revolutStatement(grid, fileName, book)` in `statements/domain/revolutStatement.ts`, over `readFirstSheet`. The file's name is its label, so it takes no hash. It finds the columns by header name (`Type, Product, Started Date, Completed Date, Description, Amount, Fee, Currency, State, Balance`) and refuses a file that lacks one, naming it. Completed rows only, so pending, reverted and declined rows are left out and counted in a note. The date is `Started Date`, and a date or an amount it cannot read refuses the file. The fee is a row of its own in Bank fees, found by its starter name in either language, and it waits on review once that was renamed. Rows of the `Savings` product go to the Revolut savings account of that currency when there is one, and are left out with a note when not. A row of a product other than `Current` or `Savings` is left out with a note naming the product. A `Current` row and a `Savings` row of the opposite amount in the same second are a pocket move: both legs share `moved_at` and carry `pocket`, as an exchange's legs share it. With a Revolut savings account of that currency they pair as a transfer. Without one the current leg counts as a transfer and waits, the dry run and To review saying it wants a savings account, and adding one and importing the file again pairs it. A `Savings` row with no mirror, such as interest, goes to the savings account as ordinary money in, filed by rules or waiting on review, with the note when there is no such account. Each row goes to the open Revolut account of its own `Currency`, or a closed one when no open one fits, so a file with both of an exchange's legs reads whole. A currency with no such account refuses the file, and so do two open accounts it could go to. The key is `occurrenceKeys` over account, started time, amount, fee and description. A closing balance note shows when the file's last `Balance` differs from what its completed rows add up to, as previous + Amount − Fee in `Completed Date` order, per product. It is one line and never refuses. One real export ties on both products.
- **The dry run:** `statementDryRun(book, statement, day)` in `statements/domain/statementDryRun.ts`, which reads the rules from the book. Per row, in order:
  1. A row dated before its account's `opened_on` is left out with a note, as the entry dialog refuses one. Its `import_key` on the account already: skipped.
  2. Same money as a typed or receipt row (below): it fills that row with the bank's date, amount, description, IBAN, key and file label, and keeps the row's id, category, note, lines and receipt.
  3. Else a new row, categorised by the shared `categorise` with Spending's context, `spendingCategorisationContext(book)`: the accounts' IBANs as own, no client IBANs, no card settlement IBANs, each account's currency. `categorised_by` is `rule`, or blank waits on review. A row the reader filed, such as a fee, keeps that category with `categorised_by` blank.
  4. Then transfer pairing over the new rows and the unpaired rows from 30 days before today or before the statement's oldest new row, whichever is earlier, so a backfill of two per-currency files still pairs. A row on the file the pairing changes shows as a line of the dry run.
- **Same money:** `sameMoney(typed, bankRows)` in `pairing/domain/sameMoney.ts`, the one owner for stages 2, 3 and 4. A bank row and a typed row are the same money when they are on one account, the amounts are equal to the cent, and the bank's date is from 3 days before to 7 days after the typed date. Typed rows take their nearest candidate one to one in date order, the earlier on a tie, so two equal coffees on one day stay two. A row that moves money between the owner's accounts, an exchange's leg or one naming an own IBAN, fills only a typed transfer leg, and a row the reader filed, such as a fee, fills nothing. A near match, a different amount within 10% in that window or an equal amount within 14 days either way, is only offered on review, with Same money to join them. Review also offers a typed row of exactly the same money, since one typed after the import never met a dry run.
- **Transfer pairs:** `transferPairs(rows, accounts)` in `pairing/domain/transferPairs.ts`. A debit and a credit on two of the owner's accounts are a pair when one names the other's IBAN and the amounts are equal within 3 days, or when they are a Revolut exchange's two legs with the same started time, which `moved_at` keeps since Revolut exports per currency and the legs can land in two imports. Both legs take Between my accounts and each other's id in `pair`, with `categorised_by` blank. A debit to an own IBAN, or an exchange's leg, whose other leg is not in yet takes Between my accounts and waits. Amount and date alone, such as an OTP card top-up of Revolut, are offered on review with Pair them. Pairing takes only statement rows without a pair and without `categorised_by` `person`, and Not a pair sets that on both legs, so a later import does not pair them again.
- **Rules.** Settings, Rules lists Spending's rules with Delete. Review offers "Always for this payee", which writes a `counterparty_contains` or `counterparty_iban` rule. It tests the row's IBAN when it has one, else its payee's name, and a second one for the same payee moves the rule it has. It first says how many rows it would file, such as "Files 7 rows", and can be cancelled. A rule on an income category holds for money in only, through the shared `direction` condition added when it is tried with nothing more stored, so a later purchase from that payee waits on review. A rule change re-runs the rules over rows with `categorised_by` `rule` and over rows still waiting, in the same write, and never over rows the owner set. A rule row no rule holds any more goes back to review. Delete-into moves a category's rules too. To review offers money in the income categories and then the spending ones as a refund, and either way Between my accounts, which leaves the row a lone leg a later statement can pair. The entry dialog offers the same refund choice. A row a statement brought stays on its account, which `TRANSACTION_WRITES` refuses to change and the dialog locks, since the next export finds it there by its key. To review and the dry run show their first ten rows with Show all, since a first import waits with thousands. A deleted statement row comes back with the next overlapping export, since nothing remembers its key, and the entry dialog says so.
- **Screens.** Transactions gains Import (a `FileDrop` taking `.xlsx,.csv`, and `.pdf` once OTP's reader lands) with the dry run's lines before the write, and a To review tab with the rows waiting and the pairs of the last 30 days, each with Not a pair, which clears both legs and sends them back to review. Settings gains tabs: General and Rules, and Statements (mail sender, subject and folder) once OTP's mail lands.
- **The sync group (waits for OTP)** gains the mail step and the statements step after the books, as Company orders them (`src/apps/company/sync/presentation/useSync.ts:28-38`). The statements step reads the PDFs in the folder whose label no row carries yet, as Company skips filed statements (`src/apps/company/imports/domain/statementFiles.ts:25-32`).
- **The home card** waits with "N rows to review", and `menuCount` opens the To review tab.

**Specs:** the moved specs in 2a to 2c move with their code. New, waiting for OTP: `tests/otpStatement.spec.ts` over a made-up statement PDF that the spec draws with `pdf-lib` in OTP's layout, and `tests/spendingMailSource.spec.ts` on the fake mailbox. New and built: `tests/revolutStatement.spec.ts` (each column missing, pending and reverted left out, a fee row, an exchange's two legs, keys stable across two overlapping exports), `tests/sameMoney.spec.ts` (the window's edges, two equal coffees, a near match offered), `tests/transferPairs.spec.ts` (an OTP debit to the Revolut IBAN paired with a top-up a day later, a friend paid the same amount the same day left as spending, an exchange's legs, a lone leg waiting, Not a pair), `tests/statementDryRun.spec.ts` (each step above, rules re-run on rule rows and rows waiting only).

**check:figures:**

- **New:** `spending.import.revolut`, the dry run over the fake export of `?spending=statements` (`--fake-spending statements`), `spending.read.statements` (the rule kind and the fields stage 2 added, so `spending.read.records` keeps hashing stage 1's fields), `spending.review`, `spending.rules`. `spending.import.otp` waits for OTP.
- **Must stay identical:** every group of stage 1 on `sample`, `foreign` and `over`, and every Company, Loans, Investments and Assets group.

**Fake variants:** `?spending=statements` (typed rows a Revolut export pairs, rows waiting on review, a pair, a lone leg, a rule, and a sample export with a pending row). Waiting for OTP: a filed OTP PDF, and `?mail=` on the shared fake mailbox with an OTP statement mail.

**Visual pages**, each with a Croatian twin: `spending-import-revolut` (the dry run), `spending-review` (rows waiting and pairs), `spending-settings-rules`, `spending-import-refused` (a Revolut file missing a column), `home-spending-review` with the waiting line. Editor flows: import, a typed row paired, undo a pair, make a rule from review. Waiting for OTP: `spending-import-otp` and `spending-settings-statements`.

**Touch steps:** drop the fake Revolut file, read the dry run, import, then Undo. Open To review, tap Not a pair on a pair, give the leg a category, then Undo. Make "Always for this payee" and read the rule on Settings, Rules.

**New strings:**

| English                                                                                               | Croatian                                                                                           |
| ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Import a statement                                                                                    | Uvezi izvod                                                                                        |
| Drop a Revolut export (OTP's statement joins it with its reader)                                      | Ispustite Revolutov izvoz                                                                          |
| {n} new, {m} already in, {k} paired with what you typed                                               | Novih: {n}, već unesenih: {m}, spojenih s vašim unosima: {k}                                       |
| {n} pending row(s) left out. They come with the next export.                                          | Izostavljeno transakcija na čekanju: {n}. Stižu sa sljedećim izvozom.                              |
| The file is in {currency}, and no Revolut account keeps {currency}                                    | Datoteka je u valuti {currency}, a nijedan Revolutov račun ne vodi tu valutu                       |
| The file has no {column} column                                                                       | Datoteka nema stupac {column}                                                                      |
| The PDF holds no text, so it cannot be read                                                           | PDF ne sadrži tekst pa se ne može pročitati                                                        |
| To review                                                                                             | Za pregled                                                                                         |
| {n} row(s) to review                                                                                  | Za pregled: {n}                                                                                    |
| Same money, Pair them                                                                                 | Isti novac, Spoji ih                                                                               |
| Maybe the same money: you typed it on {date}                                                          | Možda isti novac: unijeli ste ga {date}                                                            |
| Maybe a transfer with {account}                                                                       | Možda prijenos s računom {account}                                                                 |
| {n} reverted or declined row(s) left out.                                                             | Izostavljeno poništenih ili odbijenih transakcija: {n}.                                            |
| {n} row(s) before the account opened left out.                                                        | Izostavljeno redaka prije otvaranja računa: {n}.                                                   |
| Paired transfers                                                                                      | Spojeni prijenosi                                                                                  |
| Not a pair                                                                                            | Nije par                                                                                           |
| Waiting for the other side                                                                            | Čeka drugu stranu                                                                                  |
| Maybe the same money: the amount differs by {amount}                                                  | Možda isti novac: iznos se razlikuje za {amount}                                                   |
| Always for this payee                                                                                 | Uvijek za ovog primatelja                                                                          |
| Files {n} row(s)                                                                                      | Razvrstava {n} stavku (stavke, stavki)                                                             |
| {n} row(s) of the product "{product}" left out.                                                       | Izostavljeno redaka proizvoda „{product}”: {n}.                                                    |
| A statement brought this entry. If you delete it, the next export that covers its day brings it back. | Ovaj je unos došao iz izvoda. Ako ga obrišete, vratit će ga sljedeći izvoz koji obuhvaća taj dan.  |
| Rules                                                                                                 | Pravila                                                                                            |
| Statements                                                                                            | Izvodi                                                                                             |
| Statement mail from, Subject, Folder                                                                  | Pošta s izvodima od, Predmet, Mapa                                                                 |
| The statement's closing balance is {a}, the account shows {b}                                         | Završno stanje izvoda je {a}, a račun pokazuje {b}                                                 |
| The export's last {product} balance is {a}, but its rows add up to {b}, so a row may be missing.      | Zadnje stanje izvoza za {product} je {a}, a njegovi retci daju {b}, pa možda neki redak nedostaje. |

### 3. The Enable Banking sync

One commit. A second source into stage 2's dry run, for OTP and Revolut alike. Built against fakes and inert until the owner saves a deployment. The real path gets its first trial when he deploys the script, by [its how-to](../../../apps-script/bank-sync/README.md).

- **The script,** in `apps-script/bank-sync/` with `Code.gs` and `appsscript.json`, deployed by the owner as an API executable in Kuna's own Cloud project, which `scripts.run` requires. Its manifest names one scope, `script.external_request`, one host in `urlFetchWhitelist`, `executionApi.access` of `MYSELF` and no exception logging. It keeps the Enable Banking application id and RSA private key in Script Properties, signs each request's JWT with `Utilities.computeRsaSha256Signature`, and calls Enable Banking with `UrlFetchApp`. Five functions for Kuna: `startLink(bank, redirectUrl, state)`, `finishLink(code)`, `accounts()`, `transactions(accountUid, from, strategy)` and `balances(accountUid)`, the last three with the browser's `psuUserAgent` when a person started the fetch. `logBankFields()`, run by hand from the editor, logs field names and counts and no value. It stores one session id per bank, and no bank data stays in it. A new link closes the session it replaces with `DELETE /sessions/{id}`, and `accounts()` answers `FAILED` with a reason for a bank it could not ask, so one bank never takes the others down. It follows `continuation_key` until none is named, through empty pages, as the FAQ says.
- **The port and adapter:** `BankSyncPort` in `bankSync/application/bankSync.ts` and `bankSync/infrastructure/appsScriptBankSync.ts`, which posts to `https://script.googleapis.com/v1/scripts/{deploymentId}:run` with the owner's Google token. Its fake twin, `infrastructure/fake/fakeBankSync.ts`, answers from a saved made-up answer under `VITE_FAKE_WORKBOOK`, so the fake build sends nothing to another origin.
- **Google:** `GoogleScope` gains `script.external_request`, asked only while a deployment is saved, with its `notGranted` line in `src/shared/google/words.ts`. `connect-src` in `index.html` gains `https://script.googleapis.com`, and the README's CSP table and `public/privacy.html` name it.
- **The reader:** `bankSyncRows(answer, account)` in `bankSync/domain/bankSyncRows.ts` turns booked transactions in the account's currency into the same statement rows. The key is `bank-` and `occurrenceKeys` over `entry_reference`, day and amount, or for a blank or missing reference over day, amount, payee and description. The day and amount are in it because some banks repeat a reference on other money, and a number by position alone would name another row once a later fetch's window moved. Pending rows are left out with a note, as in Revolut's files, and so is a row whose day or amount cannot be read, since a bank repeats such a row on every fetch and a file's way out, fixing the file, does not exist here. The row's day is `transaction_date`, else `booking_date`, else `value_date`.
- **Across sources:** each account's days belong to one source, and the two are never matched row by row, since a sync may date a row by its booking and hold inside it a fee a file splits off. A sync row on or before the last day a file brought a row is left out, and so is a file's row from the first day the sync brought one. Both days come from the rows on the file, so there is no setting to keep or get wrong, and Undo moves them back. The dry run owns this, and the key's `bank-` start tells the sources apart. The outcome is `other-source` with one note per account naming the day, and any other row goes on to fill a typed row or become new, by the same steps as a file's row. An income rule, a pocket and an exchange from a file are untouched.
- **Accounts:** a linked bank account goes to the Spending account of its bank with its IBAN and currency. Enable Banking gives `XXX` for a multi-currency account, which then goes to each currency Kuna keeps under that IBAN, by each row's own currency. One with no such account is listed with Add an account. Current accounts come before savings under one IBAN. Two linked accounts of a session that fit one Spending account, as a pocket under the current account's IBAN might, are neither read, with a line saying so, since which is which cannot be told.
- **The link.** Settings, Bank sync takes the script's deployment ID and has Link OTP and Link Revolut. Linking leaves for the bank's approval and comes back to `https://ipazanin.github.io/kuna/?code=...&state=...`. The app's `install()` takes the answer out of the address and notes what it came to in this browser, which outlives the silent trip to Google. `start()` then opens Settings' tab once for that return, and no later open is redirected. The tab trades the code with `finishLink`, at once when the page holds the access and by a tap on Finish linking when it does not. What the code was traded for is kept until the date is written, so a failed write retries alone, and a code the script refuses is forgotten. The first fetch runs right after, since a bank gives more than 90 days only just after an approval: Revolut for 5 minutes, many others for an hour.
- **One fetch,** `bankImporter` in `application/bankSync.ts`, shared by the step and Sync now, so a second caller gets the running fetch. Each account fetches from its opening day while nothing on the file came from a file or a sync, then from 14 days back of its newest such row, never past yesterday since the API reads the day in UTC and refuses a future one. `strategy` is `longest` on that first fetch and from 89 days back, where the FAQ says `default` answers `WRONG_TRANSACTIONS_PERIOD`. A bank or account that fails is a line on the result and leaves the others' rows in one write. The dry run reads the file as it stands once the banks answered, after waiting for it to be idle. The first fetch and Sync now send `Psu-User-Agent`, and any such header tells the bank a person is there, which lifts the limit of four unattended reads. Each account's `/balances` is read after its rows, a booked balance first, and a note says when the balance differs from the file's once the rows are in, as a file's `balanceNotes` does. A balance the bank refuses is a note too and costs no rows.
- **A link that ended early:** a session in `EXPIRED`, `REVOKED`, `CLOSED`, `CANCELLED` or `INVALID`, or `EXPIRED_SESSION` from either call, is a line, and its `bank_link_` day becomes yesterday, so the home card, Settings and the step all treat it as over. The bank gives no day of its own.
- **The sync step** runs after the rates step while a link is live, and six hours after the banks last answered on a device, since the FAQ says many banks allow four background fetches a day. A call that never reached the script holds nothing. While it holds back the step repeats what the last fetch left wanting, and waits with a link to Settings, so a failure is not hidden. Sync now on Settings asks whenever tapped. A file kept in this browser has no page sync, so Sync now is its only way. The home card waits with "The link to OTP ends on {date}" from 14 days before its 180 days run out.
- **Settings:** `setting` lands here rather than with OTP's mail, as `key` and `value` read into `SpendingSettings`: `bank_sync_deployment`, `bank_link_otp` and `bank_link_revolut`. An unknown key is listed, not refused.

**What the docs say:**

- **The JWT** is RS256 with the application id as `kid`, `iss` of `enablebanking.com`, `aud` of `api.enablebanking.com`, and at most 86400 seconds between `iat` and `exp`. A new token per request is allowed ([API reference](https://enablebanking.com/docs/api/reference/), [FAQ](https://enablebanking.com/docs/faq/)).
- **`POST /auth`** takes `access.valid_until`, `aspsp`, `state`, `redirect_url` and `psu_type`, and `valid_until` cannot pass now plus the bank's `maximum_consent_validity`, so the script reads that from `GET /aspsps`. **`POST /sessions`** takes `code` and answers `session_id`, `accounts`, `aspsp` and `access`. `GET /sessions/{id}` and `GET /accounts/{id}/details` give the rest ([API reference](https://enablebanking.com/docs/api/reference/), [quick start](https://enablebanking.com/docs/api/quick-start/)).
- **`entry_reference`, not `transaction_id`, is the row's key.** The FAQ says `transaction_id` "should not be used as a unique reference" since it "may change if the list of transactions is retrieved again", and `entry_reference` is immutable for accounts with the same identification hash and usually present only on booked rows. A bank may give none or repeat one, and it is not unique across accounts, which Kuna's key per account already allows.
- **Statuses:** `BOOK` and `PDNG` among `CNCL`, `HOLD`, `OTHR`, `RJCT` and `SCHD`. `transaction_status` filters, and `strategy` of `longest` is recommended for a first fetch. A `continuation_key` is valid only in its session, with the other parameters unchanged ([API reference](https://enablebanking.com/docs/api/reference/), [FAQ](https://enablebanking.com/docs/faq/)).
- **`scripts.run`** is `POST /v1/scripts/{deploymentId}:run` with `function` and `parameters`, answering `response.result` or `error.details[0].errorMessage`. `script.external_request` is among the scopes it accepts ([`scripts.run`](https://developers.google.com/apps-script/api/reference/rest/v1/scripts/run)). The token must cover every scope of the script, parameters are basic types, and a script may run six minutes ([Execute functions](https://developers.google.com/apps-script/api/how-tos/execute)).
- **`computeRsaSha256Signature(value, key)`** takes "A PEM formatted key" and returns bytes, and `base64EncodeWebSafe` takes bytes or a string ([Utilities](https://developers.google.com/apps-script/reference/utilities/utilities)). The page does not say the result is unpadded, so the script strips any `=`.
- **`urlFetchWhitelist`** is "required for deployments", so the manifest names the host ([manifest](https://developers.google.com/apps-script/manifest)), and `executionApi.access` of `MYSELF` lets only the deploying user run it ([API executables](https://developers.google.com/apps-script/manifest/web-app-api-executable)).

**Specs:** `tests/bankSyncRows.spec.ts` over made-up answers, `tests/bankSyncDryRun.spec.ts` (each source's days left out either way round, again the same on the next sync, an exchange's and a pocket move's legs on review, a typed row filled, a rule and an income rule, an exchange's legs, the accounts and fetch days), `tests/appsScriptBankSync.spec.ts` asserting the request's shape as the Google request-shape tests do, `tests/bankLinkEnds.spec.ts`, `tests/bankReturn.spec.ts` (the code from the address, a forged state, a bank's refusal past the silent trip, one redirect per return), `tests/bankImport.spec.ts` (the file read after the banks answered, one fetch at a time, the hold, a link that ended, a failed date write retried alone, a refused code forgotten, the step's line, the privacy page) and `tests/bankSyncScript.spec.ts`, which runs `Code.gs` over fakes of the three Apps Script services with a key made for the run: the JWT verified with node's crypto, the pages, and no bank data in the properties.

**check:figures:** new `spending.import.bank-sync` over the saved answer on `--fake-spending statements`. Every other group identical.

**Fake variants:** `?banksync=` `saved`, `linked`, `ending` (13 days left), `failed` (the script answers an error), `unknown-account`, `otp-failed` (OTP does not answer and Revolut does), `ended` (OTP's approval is over early), `balance-differs` (Revolut states a balance Kuna does not reach).

**Visual pages,** each with a Croatian twin: `spending-settings-bank-sync` not saved and `-linked`, `spending-bank-sync-ending` on the home, `spending-bank-sync-failed`, `spending-bank-sync-one-failed`, `spending-bank-sync-ended`, `spending-import-bank-sync` with rows skipped as already brought by a file, and the flow `spending-bank-sync-link`.

**Touch steps:** save a deployment, tap Link Revolut and come back on the fake return, read the synced rows on Transactions, then Undo the import.

**New strings:**

| English                                                                           | Croatian                                                                                          |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Bank sync                                                                         | Sinkronizacija s bankom (the tab: Banke)                                                          |
| Script deployment ID                                                              | ID implementacije skripte                                                                         |
| Link {bank}, Link {bank} again                                                    | Poveži {bank}, Ponovno poveži {bank}                                                              |
| Finish linking {bank}                                                             | Dovrši povezivanje {bank}                                                                         |
| Linked until {date}, Not linked                                                   | Povezano do {date}, Nije povezano                                                                 |
| The link to {bank} ends on {date}. Link it again.                                 | Veza s bankom {bank} istječe {date}. Povežite je ponovno.                                         |
| The link to {bank} ended on {date}. Link it again.                                | Veza s bankom {bank} istekla je {date}. Povežite je ponovno.                                      |
| A bank came back to a browser that did not start the link, so nothing was linked. | Banka se vratila u preglednik koji nije započeo povezivanje, pa ništa nije povezano.              |
| The bank sync script did not answer: {reason}                                     | Skripta za sinkronizaciju s bankom nije odgovorila: {reason}                                      |
| {bank} did not answer, so its rows wait for a later sync: {reason}                | {bank} nije odgovorila, pa njezini retci čekaju sljedeću sinkronizaciju: {reason}                 |
| The link to {bank} ended early. Link it again.                                    | Veza s bankom {bank} prekinuta je prije roka. Povežite je ponovno.                                |
| {n} row(s) already brought by a file                                              | Već uneseno iz datoteke: {n}                                                                      |
| {n} row(s) already brought by the bank sync                                       | Već uneseno sinkronizacijom s bankom: {n}                                                         |
| {bank} has an account Kuna does not keep: {iban}                                  | {bank} ima račun koji Kuna ne vodi: {iban}                                                        |
| Script access to other sites was not allowed, so the bank sync cannot run.        | Skripti nije dopušten pristup drugim stranicama, pa se sinkronizacija s bankom ne može pokrenuti. |

### 4. Receipts, with the QR reader and the AI read

Two commits. 4b needs the AI-assist plan's stages 1 and 2 landed: `src/shared/secrets` with `kuna-secrets.json`, and `src/shared/ai` with `useAiTask`, the model picker and `AppAssist`.

**4a. Receipts, the QR code and matching.** Built. As built, it differs from the lines below in these ways:

- **`rowSide(row, categories)` keeps its two parameters,** since `EuroRow` now carries the row's `lines`, so every reader of the row has them.
- **Only euro accounts.** A fiscal total is in euros, so `receiptMatches` offers only rows on euro accounts and a new row goes only on an open euro account. A row on a foreign account would read as the same number in another money.
- **A second receipt on a row is refused,** as a read rule the records table did not name, and a line must name a receipt of its own row. So is a second receipt with the same JIR or ZKI, since they name one fiscal receipt, and the dialog says which entry holds it. The lines of a row count all or none.
- **A row a receipt split** holds its amount and account, and its dialog lists the lines and has Remove the receipt, which keeps the row under its category. Deleting the row takes its receipt and lines in the same write. A photo kept on Drive stays there after either, and after an Undo.
- **A photo with no code, or one the browser cannot decode,** asks for the date and total by hand, so it never dead-ends.
- **A near bank row joined on To review** adds a Difference line to a row a receipt made, so its lines keep adding up.
- **A cash row's wording:** a match on a cash account says "Matches the cash payment of {date}" beside the plan's card wording, and the Croatian says "Odgovara plaćanju gotovinom od {date}".
- **A row filled by a later import** keeps its `source` of `receipt`, as a typed row keeps `typed`.
- **Fakes and checks in 4a:** `?spending=receipts`, and photos the checks write with a real made-up QR code (`receipts/infrastructure/fake/sampleReceiptPhoto.ts`), so the page's own decoder reads them. The pages are `spending-receipt-take`, `spending-receipt-review`, `spending-receipt-pick`, `spending-receipt-no-match`, `spending-receipt-no-code` and `spending-transaction-lines`, each with a Croatian twin. `?receipt=`, `spending-receipt-sum-off`, `spending-receipt-r1` and `spending-settings-receipts` wait for 4b.

- **Records:** `receipt` and `line`.
- **The photo:** `FileDrop` (`src/shared/ui/FileDrop.vue:10-18`) gains an optional `capture` prop. Take a photo passes `accept="image/*" capture="environment"`, Upload passes `accept="image/*"`. `img-src` (`index.html:7`) gains `blob:` for the preview. The photo is used at three sizes, each by its one owner: the QR decoder draws it on a canvas at most 1,600 px on its long edge, the AI read sends `imagePartOf(file)` from `src/shared/ai` (4b), and a kept photo is the file as taken.
- **The QR code:** `jsqr`, a new dependency, pure JS, which fits the CSP, decodes it from the same photo in `receipts/infrastructure/qrDecode.ts`. Firefox has no `BarcodeDetector` on any platform, so the library is needed there. `fiscalQr(text)` in `receipts/domain/fiscalQr.ts` reads `jir` or `zki`, `datv` and `izn` from a Porezna uprava check address, and nothing from any other address.
- **Matching:** `receiptMatches(receipt, book)` in `receipts/domain/receiptMatch.ts`, over `sameMoney`'s window. Candidates are rows on the owner's accounts with no receipt, not a transfer, whose amount is minus the total. The QR total wins over a read total. They rank by the merchant's folded words found in the row's payee and description, then by the nearest date. One clear candidate is offered ready, several are a pick, none makes a row of `source` `receipt` on the account the owner picks, which stage 2's import later pairs.
- **The split:** confirming writes the receipt, its lines and either the matched row's lines or the new row, in one write. The lines add up to the row. A near match the owner accepts, such as a tip, adds one Difference line in the receipt's main category.
- **Keep the photo:** a switch per receipt, off by default, uploads the photo as taken to a Receipts folder beside the Spending file through `createFile` (`src/shared/google/driveClient.ts:201`) with `drive.file`, as invoice PDFs are uploaded (`src/apps/company/invoicing/infrastructure/googleInvoiceDrive.ts:30-32`). Off, the photo is gone once the dialog closes. A file kept in this browser has the switch disabled with its reason.
- **Without the AI read** this commit takes the QR's date and total and one category for the whole receipt.

**4b. The AI read.** Built against the fake model, and no real key has run it. As built, it differs from the lines below in these ways:

- **The task's path** follows Company's: `receipts/assist/application/readReceipt.ts`.
- **The category `enum` holds short refs,** `c1` and on, in the file's order, not record ids, as Company's rows use `r1`. A UUID costs more tokens twice over for each category, and the check maps the ref back.
- **A category has no meaning field,** so the request sends each one's name, group and kind.
- **Examples need a merchant known before the read:** one typed, or the payee of the payment picked. With neither, the request sends none. The memory after the read, by OIB or name, always runs.
- **The strict schema's type list** gains `number`, for a quantity or price that is null.
- **Lines that do not add up** stay as read. Save adds one Difference line for what is left, which the review shows first, since the read rule wants the lines to add up to the row.
- **A new category** goes in as a group of its own with no parent, once you accept it, and you can move it on Settings.
- **`?receipt=`** is only `sum-off` and `r1`. No key is the QR-only path, and which photo is uploaded decides `no-match`.
- **Only spending categories go to the model.** For the company comes only from the R1 rule, and a line remembered under a category the picker no longer offers starts from the model's pick.
- **`paymentMethod` and the VAT `rate`** are gone from the schema, since nothing read them. A discount above zero gets a note, so `kind` stays.
- **A receipt marked R1 with no buyer's OIB,** the schema's `markedR1` or a buyer field with no 11 digits, asks on the review, For the company or Personal, and Save waits. Nothing goes to For the company until he answers. An R1 with its OIB behaves as above. The owner's answer of 6 Nov.
- **The place.** When the photo is a JPEG with GPS in its Exif, the receipt stores its latitude and longitude as text, whether or not the photo is kept, read from the original file before any canvas, and never sent to the model. The entry links it to OpenStreetMap, which leaves only on a tap, with no reverse geocoding, and the CSP does not change. The owner's answer of 6 Nov.
- **The photo** goes at about 1.8 megapixels and at most 2,576 px on the long edge, as a JPEG under 600 KB when a quality step can reach it, since `runTask` counts a photo's bytes against its input cap.
- **Refused and cut-off reads** say so on the dialog with what they spent, and the owner can still file the receipt whole.

- **The task:** `receipts/assist/readReceipt.ts`, an `AiTask` in the AI-assist plan's shape, run through `useAiTask` (its "What spending will call"). `imagePartOf(file)` lands in `src/shared/ai/presentation/` with this task, as that plan says, since its size rules follow each provider's image limits. Its input is the photo, the category list with each one's meaning, and up to ten recent confirmed lines of the same merchant. Its output schema is lane 3's (merchant with OIB, buyer OIB, date and time, JIR, ZKI, lines with printed and plain text, kind, quantity, unit price, line total and a category from an `enum` of the file's category ids plus `new`, VAT table, total, payment method, unreadable parts). It runs on the model the owner picks in Kuna settings, a medium model such as Sonnet by default. A receipt costs about $0.03 on Sonnet at lane 3's prices.
- **The draft:** `receiptDraft(answer, categories)` in `receipts/domain/receiptDraft.ts` turns amounts into cents at once and checks in code: the lines add up to the total within a cent a line, each line's quantity times price, the VAT table against the total, the QR total and time, and the OIB's check digit. A failed check is a note on the draft with the difference, never a fix. A line's category comes from the newest confirmed line with the same folded printed text at the same merchant, then the model's pick. A `new` category is a suggestion to accept, rename or map, never made silently.
- **No new rule kind.** Confirmed lines are the receipt memory, read back by merchant OIB, or name when there is none, and folded printed text.
- **R1:** a receipt whose buyer OIB equals the Company OIB on Settings, Receipts sets every line to For the company and says so. With no Company OIB saved, any receipt carrying a buyer OIB is flagged the same way.
- **Review:** lines grouped by category, so a long receipt is three or four groups to confirm. Each line can change category. Confirm writes as in 4a.
- **The contract and the sync group:** `spendingApp.assist` lists the task with what it sends, the whole photo, for the Assistant card. The sync group lists `secretsStep(wanted)`.

**Specs:** `tests/fiscalQr.spec.ts` (the made-up `izn=2349` as €23.49, a total with a comma, another address refused), `tests/receiptMatch.spec.ts` (one candidate, a pick of two, none making a receipt row that a later import fills, a transfer never a candidate), `tests/receiptDraft.spec.ts` (the sum, quantity, VAT and QR checks, a discount line, the memory before the model), `tests/oib.spec.ts`, `tests/receiptWrites.spec.ts` (one write, Undo, lines adding up), `tests/readReceiptTask.spec.ts` (the schema passes the AI-assist plan's subset check, the category `enum` follows the file).

**check:figures:** new `spending.receipts.matches` and the stage 1 month groups on a new `receipts` variant. Every group of `sample`, `foreign`, `over` and `statements` identical, so receipts change no figure of a file without them.

**Fake variants:** `?spending=receipts` (a card payment of €23.49 and a cash day), the AI-assist plan's fake adapter answering made-up reads, `?receipt=` `qr-only`, `sum-off` (lines €22.99 against €23.49), `r1`, `no-match`.

**Visual pages,** each with a Croatian twin: `spending-receipt-take` (the two buttons), `spending-receipt-review` (grouped lines), `spending-receipt-sum-off`, `spending-receipt-pick` (two candidates), `spending-receipt-r1`, `spending-settings-receipts`, `spending-transaction-lines` (a row split by its receipt).

**Touch steps:** Add a receipt by touch on the fake photo, read the matched payment, move one line to Household, confirm, read the row's lines on Transactions, then Undo. The R1 fake lands every line in For the company. The keep-photo switch at 44 px.

**New strings.** Croatian "račun" is both an account and a receipt, so a receipt is "fiscal receipt", fiskalni račun, wherever both could be meant.

| English                                                                  | Croatian                                                                                |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| Add a receipt                                                            | Dodaj fiskalni račun                                                                    |
| Take a photo, Upload                                                     | Fotografiraj, Učitaj                                                                    |
| Reading the receipt                                                      | Čitanje računa                                                                          |
| Matches the card payment of {date}                                       | Odgovara plaćanju karticom od {date}                                                    |
| Pick the payment it belongs to                                           | Odaberite plaćanje kojem pripada                                                        |
| No payment matches yet. It is kept as an entry the next statement pairs. | Još mu ne odgovara nijedno plaćanje. Sprema se kao unos koji će spojiti sljedeći izvod. |
| The lines add up to {a}, the receipt says {b}                            | Stavke daju {a}, a na računu piše {b}                                                   |
| The QR code says {a}                                                     | QR kod kaže {a}                                                                         |
| Difference                                                               | Razlika                                                                                 |
| An R1 receipt for the company, so every line is For the company          | R1 račun za tvrtku, pa su sve stavke pod Za tvrtku                                      |
| Keep the photo on Drive                                                  | Spremi fotografiju na Drive                                                             |
| The photo is kept only with the file on Drive                            | Fotografija se sprema samo uz datoteku na Driveu                                        |
| Company OIB                                                              | OIB tvrtke                                                                              |
| The OIB's check digit is wrong                                           | Kontrolna znamenka OIB-a nije ispravna                                                  |
| New category suggested: {name}                                           | Predložena nova kategorija: {name}                                                      |
| The photo could not be read                                              | Fotografija se ne može pročitati                                                        |

## Settled without asking

The lead's defaults, open to the owner's change:

- **Pending Revolut rows are skipped.** A pending row comes with the next export as completed, at its real amount.
- **Transfers pair automatically,** on an own IBAN or a Revolut exchange, with the pairs on review and Not a pair to undo one.
- **Receipt lines get a category each,** grouped by category on review.
- **A typed entry pairs with the statement row when it arrives,** by `sameMoney`, and keeps its category and note.
- **Spending owns the personal accounts.** Loans and Investments keep their own records.
- **A fixed provider list** for the AI read, from the AI-assist plan. Kuna's CSP keeps naming every host.
- **The starter set seeds in the language of the first run,** Croatian for the owner.
- **Limits sit on a group or on its children, never both,** so no euro is counted against two limits.
- **The Company OIB is typed in Spending's settings.** Kuna keeps no company OIB anywhere today.
- **The ECB rates are kept in memory only,** as Assets keeps the DZS index. Offline, a foreign account shows in its own currency with the note.
- **Spending is installed after Assets,** so Bank and cash follows Assets value on the home and the Overview.

## Left out

Payee memory on typed entry, cash balance adjustments, recurring payments, yearly-cost categories, needs and wants, tags, trips, a hand split of a row without a receipt, shared spending with a partner, foreign amounts of a card spend shown beside the euros, receipts as PDF, and the H7 matching with the company's payments to the owner.

## Unconfirmed

Carried from the research, for the owner to check where marked:

- **Whether OTPgo web offers a CSV, XLS, camt.053 or MT940 export for a personal account.** Only PDF is confirmed. The owner can settle it in a minute by opening an account's transaction list in OTPgo web and looking for an export button. A CSV or XLSX would move the profile reader to `src/shared` and drop the PDF reader.
- **Revolut's other exports.** One real `.xlsx` export has been read: its header is the one above, its dates are serial numbers, and it holds only euros on `Current` and `Savings`. A `.csv`, a multi-currency export and a `Fiat amount` variant have not been seen.
- **A row completed in one export and reverted in a later one.** One real export of about six years shows no such case: all of its 28 reverted rows have no `Completed Date` and no `Balance`, so they never completed. That is one export, so the reader still only counts a reverted row as left out, and a completed row that did turn reverted would stay on the file.
- **Whether OTP's statement PDF has a password.** The mail names only a digital signature. To check on the first real statement.
- **OTP's PDF layout:** that it is text and not a scan, that its columns come out in a stable order, whether each row carries a reference and a transaction day beside the booking day, and how many days a card payment books after the purchase. Built and checked against one real statement before 2d lands.
- **Whether Revolut's Excel choice gives `.xlsx` or `.csv`.** SheetJS reads both. Also whether its web app exports statements at all.
- **Revolut's column set.** No column definition is published. The header comes from two open-source parsers, and a variant with `Fiat amount` columns exists. Also whether `Savings` product rows appear in the current account's export.
- **Enable Banking's terms:** that restricted mode is free comes from a third party. Its own FAQ gives only volume-based pricing through sales, and says restricted applications read only linked accounts. OTP is marked beta there.
- **How Enable Banking shows Revolut.** Its docs say a multi-currency account comes with the currency `XXX`, and Kuna splits such an account by each row's own currency. Whether Revolut comes that way, as one account per currency, or with pockets as accounts was not seen, nor whether a Revolut card row carries `transaction_date`. A row made before and booked after the switch from files can double or go missing at that one edge, and the balance note shows it. An exchange or a pocket move from the sync has no `moved_at`, so it waits on review instead of pairing, unless a rule you wrote matches its text. [The bank sync's README](../../../apps-script/bank-sync/README.md) lists what the first run must answer.
- **The Apps Script path,** read on 5 Nov 2026 and not yet tried with a real deployment:
  - **Scopes.** Google's [Properties reference](https://developers.google.com/apps-script/reference/properties/properties) names no scope for Script Properties, where [`UrlFetchApp`'s](https://developers.google.com/apps-script/reference/url-fetch/url-fetch-app) names `script.external_request`, and neither [Utilities](https://developers.google.com/apps-script/reference/utilities/utilities) nor the [scopes page](https://developers.google.com/apps-script/concepts/scopes) mentions `script.storage`. So one scope is expected, but no page says outright that Properties need none. `scripts.run`'s accepted list does include `script.storage`. **Unconfirmed until the first deployment**, whose Overview lists the scopes. A project with no scope cannot run through the API at all, which does not apply here.
  - **CORS on `scripts.run`.** Google's pages say nothing of CORS, and the how-to's browser sample uses `gapi.client`. On 5 Nov 2026 a preflight to `script.googleapis.com/v1/scripts/fake:run` with Kuna's origin and `authorization, content-type` answered 200 with `access-control-allow-origin: https://ipazanin.github.io`, and an unauthorised POST answered 401 with the same header. **Observed with curl, not from a browser and not with a real token.**
  - **The `code` on a hash-routed page.** Enable Banking's [quick start](https://enablebanking.com/docs/api/quick-start/) and [FAQ](https://enablebanking.com/docs/faq/) say the `code` comes in the query string, and the [API reference](https://enablebanking.com/docs/api/reference/) lists `code`, `state`, `error` and `error_description` as query parameters. So the redirect is the app's bare address with no `#`, and the query sits before the hash where the router does not look. Whether Enable Banking would accept a `#` in `redirect_url` was not read and does not matter. **That it adds `?code=` to an address ending in `/` is read, not tried.**
- **`scripts.run`'s id.** The [reference](https://developers.google.com/apps-script/api/reference/rest/v1/scripts/run) names the path parameter `deploymentId`, while the [how-to's samples](https://developers.google.com/apps-script/api/how-tos/execute) pass a variable named script id. Kuna asks for the deployment ID, as the reference says. To confirm on the first run.
- **Whether OTP or Revolut allows more than one session.** The FAQ says a bank that does not will expire the earlier session on a new one, so the approval in Enable Banking's panel may end when Kuna's starts, or the reverse. A session that ended shows as such.
- **Whether `scripts.run` sends `[]` or no result for an empty list.** Kuna reads both as empty.
- **Revolut's fee through the sync.** A file writes a fee as a row of its own. If the sync's amount is the total with the fee, the balance is right and Bank fees reads low.
- **Which day `date_from` filters on.** If a bank filters on the transaction day, a card row booked more than 14 days after the purchase falls outside the overlap.
- **Whether adding `script.external_request` to the consent screen** shows a new unverified-app screen for a production client.
- **Whether `GET /accounts/{id}/details` counts against a bank's four background fetches a day.** The FAQ says "data fetches". The sync asks for details on every fetch since the script keeps no account data, so a limit may bite sooner than six hours would.
- **Whether Apps Script signs with the 4096-bit key** the panel saves. It is PKCS#8, and Google's docs say only "PEM formatted".
- **The fiscal QR's form** on real receipts. No real receipt has been scanned. On 6 Nov 2026 the check page's own script (`porezna.gov.hr/rn/assets/index-CU4QgkZ0.js`) still reads `jir`, `zki`, `datv` split on `_`, and `izn`, and takes a comma or a dot in `izn`. The Pravilnik says "minimalno", so extra parameters are possible, and `fiscalQr` ignores them. That `https://porezna.gov.hr/rn` is the address every till prints comes from lane 3's reading, not from a receipt.
- **Whether a phone photo's QR code decodes at 1,600 px on the long edge.** A small code on a tall receipt may not. Only the made-up sample codes have gone through the page's decoder.
- **The OIB check digit,** ISO 7064 MOD 11,10, was not read from a primary source.
- **The Croatian receipt words** in lane 3 come from general knowledge.
- **Firefox:** whether Firefox for Android offers the camera for `capture="environment"` in the installed app as MDN's data says, and whether Firefox desktop decodes an uploaded HEIC.
- **`pdfjs-dist` under Kuna's CSP:** whether it runs with `worker-src 'self'` and without `eval`.
- **Whether a phone hands the page a photo's GPS.** Browsers and phones often strip it from a picked photo, and a HEIC or PNG is not read at all, as a HEIC reader would be a dependency. Only made-up Exif bytes have been tried. A receipt whose photo held none simply stores no place.
- **The first run with a real key,** none of it tried yet: that each provider takes the schema, as Anthropic names limits on strict schemas that lane 3 could not place on `output_config.format`. What a photo really costs, read off the dialog's usage line, against the $0.03 worked for Sonnet from list prices and token estimates. Whether effort `low` reads Croatian thermal paper well enough, and whether a long receipt fits the 16,000 output tokens with thinking on. Whether the model copies `R1` and the buyer's OIB into `buyerOib`. Lane 3's test on 20 real receipts has not been run.
- **Lending money to someone** has no category. Loans keeps what is owed to you, but the money that leaves an account for a friend can only be spending or income, so the month's spending is off while Net worth is right. A fourth fixed kind, or Between my accounts on a lone leg, would cover it.
- **A transfer with a fee in one currency**, such as €100.00 out of OTP and €99.50 into Revolut, cannot be typed as one pair, since the dialog takes a second amount only when the currencies differ.
- **The Croatian strings** have not been checked at 360 px.
- **Digest identity** of the groups that must stay the same is expected from the code, not run.

## Sources

- [Lane 1, code and data model](research/lane1-code.md), its module map and staging.
- [Lane 2, product](research/lane2-product.md), the category sets, budgeting methods and transfers.
- [Lane 3, receipts](research/lane3-receipts.md), the browser calls, the fiscal QR, the schema and the checks.
- [Lane 4, statements](research/lane4-statements.md), OTP's mail, Revolut's export, Enable Banking and the parsing rules.
- [Enable Banking](research/enable-banking.md), personal mode, setup and what the first run must show.
- [The module map](../../architecture/modules.md) and [the hub design](../../architecture/hub.md).
- [The overview plan](../overview/plan.md) and [the Assets plan](../assets/plan.md), the hub contract and the owner's answer on Net worth.
- [The AI-assist plan](../ai-assist/plan.md), the shared AI module and the secrets file.
- Enable Banking, all loaded on 5 Nov 2026: [API reference](https://enablebanking.com/docs/api/reference/), [FAQ](https://enablebanking.com/docs/faq/), [quick start](https://enablebanking.com/docs/api/quick-start/), [restricted mode](https://enablebanking.com/docs/api/linked-accounts/).
- Google, all loaded on 5 Nov 2026: [`scripts.run`](https://developers.google.com/apps-script/api/reference/rest/v1/scripts/run), [Execute functions](https://developers.google.com/apps-script/api/how-tos/execute), [Utilities](https://developers.google.com/apps-script/reference/utilities/utilities), [UrlFetchApp](https://developers.google.com/apps-script/reference/url-fetch/url-fetch-app), [Properties](https://developers.google.com/apps-script/reference/properties/properties), [scopes](https://developers.google.com/apps-script/concepts/scopes), [manifest](https://developers.google.com/apps-script/manifest), [API executables](https://developers.google.com/apps-script/manifest/web-app-api-executable), [deployments](https://developers.google.com/apps-script/concepts/deployments).

## The owner's answers on receipts, 2026-11-06

- A rule-filed bank row near a receipt or typed row waits on To review as maybe the same money, with the rule's category as a suggestion, so it can be joined or filed. Stage 2's import does this for rows it brings, and `rulesRerun` leaves such a row waiting.
- A receipt marked R1 with no buyer's OIB depends: the draft asks, For the company or Personal.
- The same fiscal receipt a second time is refused, and the dialog names the entry.
- A photo's location is useful: the receipt stores it as text when the photo has one, whether or not the photo is kept.

## The owner's answers on statements, 2026-11-05

- A statement row before its account's opening day stays left out with a note.
- A rule on an income category applies to money in only, so a later purchase from that payee waits on To review.
- A deleted statement row comes back on the next overlapping export, and the delete dialog says so.
- "Always for this payee" says how many waiting rows it would take before it writes, and can be cancelled.
- A Revolut row of a product other than `Current` or `Savings` is left out with a note naming the product.
- A row reverted after it was completed waits for more exports. One real export shows none.
- The Revolut dry run notes a last balance its completed rows do not add up to, and never refuses. Bulk filing waits until he has tried the first import.
- A pocket move is a transfer to a savings account, and with no such account the row waits on To review saying it wants one.

## The owner's answer, 2026-11-05

- Deleting a category into another deletes its limits in the same write, and one Undo restores both. The target category keeps its own limits.

## The owner's answers, 2026-11-04

- Two-level starter categories: about 11 groups with Croatian names (Food, Home, Transport, Boat, Health, Personal, Leisure, Travel, Family and gifts, Money and fees, Other, plus Income), editable.
- Monthly limits with carry-over. Leftover rolls into the next month's limit, and overspending lowers it.
- One account per held Revolut currency. Euro values at the ECB rate of the day.
- A loan instalment counts as spending in v1. Money sent to the broker counts as saving.
- A receipt that matches a bank payment splits that payment. Receipts are matched to transactions by an algorithm over the account's rows: amount, date window, the merchant and the fiscal QR total.
- The receipt photo is discarded after reading, with a keep-photo switch that stores it on the owner's Drive.
- Company costs paid from a personal card go to a For the company category that no spending or budget figure counts. A receipt with the company's OIB, an R1 receipt, is flagged for it.
- Statements come as files first. OTP's mailed PDF is filed from Gmail as Company's statement mail is, and read with a PDF reader. A dropped Revolut Excel or CSV export, completed rows only. Dedup and transfer pairing come with them. Then Enable Banking follows as a second source into the same pipeline, through a small Apps Script called with `scripts.run`, holding the key in Script Properties.
- AI: the user picks the model, with a medium model such as Sonnet as the default. Keys live in the existing Investments keys file, which expands into one Kuna-wide secrets file. A separate AI-assist plan owns the shared AI module and that secrets file. Spending's receipt stage uses that module and does not define it.
- Standing direction: "since amount of business logic is growing, I want you to be well organized, to have good separation and reusability, think modular monolith".
