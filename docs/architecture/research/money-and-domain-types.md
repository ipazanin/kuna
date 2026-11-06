# Issue 49 research: domain models, money and percentages

Read at `main` 80eb89d, with the clone left clean. Reproductions ran as scripts in the scratchpad against the real modules. `check:figures` ran with `--fake five-employees --fake-loans sample --fake-investments sample --fake-assets sample --fake-spending foreign`, which gives 269 groups. Scripts are in `/private/tmp/claude-501/-Users-ivan-gdrive/dc726da4-faa8-481a-a296-2ead32e375c9/scratchpad/domain/`.

## Short answer

Keep `Money` and `Percent` as branded primitives. No class, and no currency on `Money`. Brands are erased at runtime, so nearly the whole refactor can land with identical hashes. A class would move 188 of the 269 groups, or with `#private` fields make the digest blind to amounts.

The issue's premise needs two corrections:

- Most hand-written `/ 100` are percent conversions, not money. Of 27 outside the fakes, 17 are percent and 8 are money, and 4 of those 8 are the owner's own lines.
- Assets holds no currency at all. Neither does Loans. Only Investments, Spending and Company's accounts carry one.

The domain's money is in better shape than the counts suggest. The real bugs are in how percentages are read from cells, in one allocation function, and in Company's accounts in another currency.

## Real bugs

Ranked by what they can do to a figure. Each was run unless marked otherwise. None is fixed by this research, and each needs its own decision or commit, since a fix moves a figure.

| #   | Where                                                                                                      | Input                                                                                  | Wrong output                                                                                   | Effect                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `investments/imports/domain/portfolioWorkbook.ts:289` `costShareOf`                                        | Cost share cell `0.8`, meaning 0.8%                                                    | Stored fraction 0.8, so 80%                                                                    | 80% of the parent's cost moves to the spin-off, and FIFO cost and later capital gains follow. `1.2` reads as 1.2% and `1` as 1%, so the scale flips at 1. The app labels the field "in %" and the template uses `5.2051`. When the row names its parent, `answeredByRow` is true (`importChoices.ts:314`), and `ImportQuestionsStep.vue:44` filters that spin-off out, so nothing asks. The filter is read from the code, and the reading of the cell was run. |
| 2   | `company/cash/domain/balances.ts:66`, `company/imports/domain/camtStatement.ts:100`                        | Accounts of EUR 1,000 and USD 1,000                                                    | Cash on hand `€2,000.00`                                                                       | The accounts tab takes a currency per account, and a camt statement in USD is accepted, for a known account and for a new one, with rows filed at face value. Nothing compares it with the book's currency. The only reader of the account's currency is the categorising signal. Latent while every account is in the book's currency.                                                                                                                        |
| 3   | `shared/money/decimal.ts:158` `proportionalParts`, used by `moneyParts`                                    | €0.05 over ten equal lots                                                              | `1,1,1,1,1,1,1,1,1,-4` cents                                                                   | "Each part rounded, last takes the rest" can give the last part a negative share. A sale's fee split runs through this at `holdings/domain/lots.ts:272`, so one lot gets a negative fee. Also `moneyParts(3, six equal)` gives `-2`. Small, and it sits in the tax path.                                                                                                                                                                                       |
| 4   | `company/packs/hr-doo/domain/companyFacts.ts:237` `rateOf`, against `presentation/CompanyFactsCard.vue:97` | Owner loan interest `0.5`, and `1`                                                     | Settings cell: 50% and 100%. Card: 0.5% and 1%                                                 | One fact, two scales by surface. The app writes the cell as a fraction, so this bites a hand-edited cell or an import. `2` is refused with a hint, while `0.5` and `1` pass silently. `yearEndReading.ts:93-96` has the same reading.                                                                                                                                                                                                                          |
| 5   | `shared/money/money.ts:19` `moneyFromAmount`                                                               | `1.005`, `1.255`, `8.325`                                                              | 1.00, 1.25, 8.32. The doc says half away from zero, and `decimalOfNumber(1.005, 2)` gives 1.01 | `amount * 100` is float. Two-decimal inputs are safe. Reachable from a numeric sheet cell with three decimals (`storedFields.ts:38`, `:62`, `tabularStatement.ts:251`, `revolutStatement.ts:56`).                                                                                                                                                                                                                                                              |
| 6   | `loans/scenarios/domain/leftOver.ts:28`                                                                    | A difference of `-250.5` against `+250.5` cents                                        | `-250` against `+251`                                                                          | `Math.round` is not symmetric, against the rule everywhere else. Not run end to end, only `Math.round(-2.5)` is -2. Also float maths on money, which is fine for a what-if but not rounded by the owner.                                                                                                                                                                                                                                                       |
| 7   | `shared/money/moneyFormat.ts:129-132`, `:135`                                                              | `formatCompactMoney(-40)`, `formatPercent(-0.0004)`, `formatPercent(0.0004, 'always')` | `−€0`, `−0%`, `+0%`                                                                            | Display only. `formatShare` and `formatCostShare` already guard this, and `formatPercent` does not. Holdings' gain column calls it with `'always'`.                                                                                                                                                                                                                                                                                                            |
| 8   | `hr-doo/domain/words.ts:26`, `:96`                                                                         | A cell of `2.3`                                                                        | "reads as 229.99999999999997%"                                                                 | Display only, in a refusal message.                                                                                                                                                                                                                                                                                                                                                                                                                            |

Limitation, not run through a screen: Spending takes any currency Intl knows (`accountReading.ts:29`), including three-decimal ones such as KWD, while Company refuses those (`settings.ts:781`). `Money` holds hundredths, so 1.234 becomes 1.23.

Checked and found correct: `targetMix.ts` percent against placed value, the `portfolioChecks.ts:99` and `checkLines.ts:41` round trip, `projection.ts`, `taxYear.ts:121` (one instrument, so one currency), `receiptMatch.ts:71` (euro accounts only), `transferPairs.ts:46-53`, `spendingHubFigures`, `accountCash.ts` (keyed per currency), `monthlyInterest` and `annuity`.

## 1. Inventory

Layers are by folder. "Fake" is seeds. Counts skip comment lines.

### Money as a plain number

A name-based scan of `number` fields and parameters through the TypeScript AST, with non-money names removed by hand. It is a heuristic with a few false positives left, such as `photoPlace.ts:46`.

| App           | Domain   | Presentation    | Other                        | Fake |
| ------------- | -------- | --------------- | ---------------------------- | ---- |
| hr-doo        | 2        | 36              | 1 (`packContribution.ts:53`) | 1    |
| Company       | 4        | 7               |                              | 14   |
| Investments   | 3        | 8               |                              |      |
| Loans         | 1        |                 |                              | 1    |
| Spending      | 6        |                 |                              | 11   |
| Assets        |          |                 |                              |      |
| Shared        | 4 (`ai`) | 12 (charts, UI) | 9 (`money`, `app`)           |      |
| Shell gallery |          | 4               |                              |      |

Almost all of it is presentation props, such as `yearEnd/KontoTable.vue:6` and `assets/AssetRegister.vue:11`. The root is `formatMoney(cents: number)` (`moneyFormat.ts:124`) and `MoneyText.vue:9`, which accept any number, so a Money loses its brand at the last step. Spending's domain count is the AI's raw answer at the boundary (`receiptDraft.ts:27-46`), which is fine. Charts need plain numbers, so they should keep them behind one chart formatter.

### Hand arithmetic, outside the fakes

| Pattern                        | Count    | Where it goes                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `as Money`, outside `money.ts` | 21       | 12 min, max or abs (`invoiceMatching.ts:197`, `:201`, `taxBase.ts:164`, `reimbursements.ts:41`, `PlanEditor.vue:105`). 4 narrowing a null (`DividendPlanDialog.vue:56`, `CategoryPlanDialog.vue:74`). 2 zero literals (`receiptDraft.ts:206`, `invoicePdf.ts:212`). 2 NaN sentinels (`useInvoiceRun.ts:53`, `InvoicingTermsForm.vue:77`). 1 parser (`tabularStatement.ts:261`). |
| `/ 100`                        | 27       | 17 percent (`packCharts.ts:204`, `scenarioBars.ts:59`, `CostsTab.vue:31`, `TargetMixCard.vue:94`). 4 in the owner. 4 money elsewhere (`recordFields.ts:13`, `settings.ts:822`, which needs no division, `ruleWording.ts:148`, `projection.ts:42`). 2 unrelated (`rateSolver.ts:23`, `workingDays.ts:39`).                                                                       |
| `* 100`                        | 20       | 7 money parsing (`camtStatement.ts:361`, `tabularStatement.ts:260`, `fiscalQr.ts:29`, `growthChart.ts:68`). 9 percent (`effectiveRate.ts:27`, `bankLoanView.ts:50`, `checkLines.ts:41`). 4 CSS widths, which are fine.                                                                                                                                                          |
| `Math.round` on money          | 6        | `money.ts:11`, `moneyFormat.ts:132`, `leftOver.ts:28`, `growthChart.ts:68`, `citedAnswer.ts:120`, `useAiTask.ts:109` (dollars). The other 30 or so are days, pixels and rates.                                                                                                                                                                                                  |
| `toFixed`                      | 3        | Only `plainAmount` touches money. Lint and the baseline already hold this.                                                                                                                                                                                                                                                                                                      |
| Float maths on money in domain | 3 places | `projection.ts:36-41` and `leftOver.ts:11-17`, what-ifs where float is reasonable. `receiptDraft.ts:187`, a check with one cent of slack.                                                                                                                                                                                                                                       |
| Adding across currencies       | 1        | Bug 2. Nothing else found.                                                                                                                                                                                                                                                                                                                                                      |

### Where rounding happens, and by what rule

| Rule                               | Where                                                                            |
| ---------------------------------- | -------------------------------------------------------------------------------- |
| Half away from zero, integer       | `dividedRounded` (19 callers), `decimal.ts` `dividedHalfAwayFromZero`, `inEuros` |
| Half away from zero, through float | `moneyFromAmount`, `divideMoney`                                                 |
| Half up, positive only, BigInt     | `annuity`, `equalPrincipalInstalment` in `yearlyRate.ts`                         |
| `Math.round`                       | `leftOver.ts:28`, `effectiveRate.ts:27` (a rate)                                 |
| Refused rather than rounded        | `camtStatement.ts:359`, finer than a cent                                        |

Moments of rounding: each payroll line (`atRate`), each lot's gain in euros then summed (`taxYear.ts:109`), each payment's tax (`foreignIncome.ts:158`), each loan's interest then summed (`ownerLoanInterest.ts:71`).

Two allocation methods exist:

- Last part takes the rest: `moneyParts` and `decimalParts`, in `lots.ts`, `holdingMix.ts`, `targetMix.ts`, `taxFreeCalendar.ts`.
- Rounding a running sum, which cannot go negative: `daySpread.ts:24`, `grantRelease.ts:194`, `depreciationSchedule.ts:149`, `rowSide.ts:41`.

### Rates, shares and percentages by scale

| Scale                           | Type               | Where                                                                                                                            | Applied to money by                                    |
| ------------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Fraction 0 to 1, float          | `number`           | `ratioOf` results: `weight`, `gainShare`, `share`, `netShare`, `savingsRate`, `projection.ts:18`. Everything the formatters take | Not applied, except `leftOver` and `projection` growth |
| Whole percent 0 to 100, number  | `OwnerShare` brand | `ownerShare.ts:14`                                                                                                               | `ownerPartOf`                                          |
| Whole percent 0 to 100, number  | `number`           | `taxRules.ts:82-86`                                                                                                              | `percentOf`                                            |
| Percent with one decimal, float | `number`           | `scenarioBars.ts:29`                                                                                                             | Charts only                                            |
| Whole percent, floored          | `number`           | `bankLoanView.ts:22` `paidBackPercent`                                                                                           | Words only                                             |
| Basis points                    | `Rate` brand       | `ruleset/schema.ts:8`                                                                                                            | `atRate`                                               |
| Basis points                    | `number`           | `companyFacts.ts:35`, `yearEnd.ts:17`, `customsTable.ts:10`, `citedAnswer.ts:83`, `projection.ts:5`                              | `atRate`, `dividedRounded`                             |
| Millionths                      | `YearlyRate` brand | `yearlyRate.ts:5`                                                                                                                | `monthlyInterest`, `annuity`                           |
| Percent, Decimal                | `Decimal`          | `target.percent`, `ter`, fund weights, check thresholds                                                                          | `partOf`, `fundCost`                                   |
| Fraction, Decimal               | `Decimal`          | `spinOff.costShare`, stored 0 to 1                                                                                               | `lots.ts:350`                                          |
| Index in hundredths             | `number`           | `houseIndex.ts:17`                                                                                                               | `dividedRounded`                                       |
| Percentage points, by context   | `number`           | `portfolioChecks.ts:83` `measured`, `ChangeRateFields.vue:33`                                                                    | Words only                                             |

Places two scales meet:

- A percent and a fraction meet in Investments' spin-off (`importChoices.ts:294-296`) and its cell reader (bug 1).
- A fraction and a percent meet in the settings cell against the card (bug 4).
- A percent and a formatter's fraction meet at the 17 hand-written `/ 100`.

The key `rate` means basis points in hr-doo, millionths in Loans, a fraction in Investments' `portfolio` and an exchange rate as a Decimal in Investments' records. `RateBook` is exchange rates. So `Rate` is a poor shared name.

Parsers of a typed or written rate, with three different ideas of scale: `rateOf`, `yearEndReading.ts:93`, `costShareOf`, `basisPointsOf`, `recordDrafts.ts:72` and `:95`, `typedRate` in Loans, `typedRate` in `SavingTab.vue:57`, `typedOwnerShare`.

### Foreign currency

- **Investments:** `Decimal` amount with a `CurrencyCode`. The currency sits on the record, the account or the instrument, and `*InCurrency` fields beside euros in `Money` (`lots.ts:40-63`, `accountCash.ts:15`). No bug found. Field names differ (`balance`, `gross`, `costInCurrency`).
- **Spending:** `Transaction.amount` and `Account.opening` are typed `Money`, but hold cents of the account's currency, and the currency is only on the account (`transaction.ts:16`, `account.ts:23`). `euros: Money | null` sits beside it on `EuroRow`. Both have the same type, so a leak would compile. Today's screens keep them apart by name and I found no leak. This is the real type hole.
- **Assets and Loans:** euros only, no currency field.
- **Company:** one book currency from settings, and a currency per account that no figure reads (bug 2).
- **Conversion:** one owner, `eurosAtEcbRate` (`rateBook.ts:21`), which is good. `decimalOfMoney` documents "euros" but also carries foreign cents in `euroRows.ts:33`.

### Other value concepts

| Concept                                                                   | State                                                                                                                                        | Verdict                                                         |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `CivilDate`, `MonthKey`, `RecordId`, `CurrencyCode`, `Country`, `Quarter` | Branded or a template type with one maker. The boundary spec guards record ids                                                               | Fine                                                            |
| `Decimal` for quantity, price, foreign amount                             | One brand, exact, no scale mix found                                                                                                         | Fine                                                            |
| `Decimal` for percent and fraction                                        | Two scales under one brand, told apart by field name                                                                                         | Smell, with no bug from the type. Bug 1 is the parser. Leave it |
| IBAN                                                                      | Plain string, blank allowed, `normaliseIban` one owner, `isIban` in Company and a separate one in `ai/maskIdentifiers.ts` for another reason | Fine                                                            |
| OIB                                                                       | Plain string, read in Spending only (`oib.ts:5`)                                                                                             | Fine, brand when a second reader appears                        |
| Year as `number`                                                          | `taxYear` and others                                                                                                                         | Fine                                                            |

### Models, rules and size

Anemic is the wrong label here. Fowler's objection is to bags of getters with logic moved into service objects. Kuna has immutable records with pure functions in the same domain folder, which matches Evans's "side-effect-free functions". Classes would add nothing.

The real problems:

- **Figures computed in presentation.** `scripts/figure-digest.mjs` imports 21 modules from `presentation/`: Loans 9, hr-doo 5, Assets 2, Investments 2, Spending 2, Company 1. Examples are `bankLoanView.ts`, `salariesView.ts` (540 lines), `scenariosView.ts` and `loansHubFigures.ts`. The digest's own imports are a ready list of rules in the wrong layer. Some are words, so each needs a look.
- **Rules in components.** `CompanyFactsCard.vue:95-102` and `SavingTab.vue:57-61` parse rates. `useInvoiceRun.ts:53` uses NaN as a state.
- **God files in domain.** `investments/imports/domain/importDryRun.ts` 1031, `company/settings/domain/settings.ts` 875, `hr-doo/domain/forecast/forecastYear.ts` 816, `dividendCapacity.ts` 526, `accrualYear.ts` 483, `pricesFile.ts` 476.

Duplicated rules:

| Rule                        | Copies                                                                                                                                                                                                                        |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A percent of money, rounded | `atRate`, `percentOf`, `ownerPartOf`, `partOf`, `fundCost`, `customsEstimate`, `projection.ts:49`, `depreciationSchedule.ts:169`, `ownerLoanInterest.ts:71`                                                                   |
| The constant 10,000         | 6 `BASIS_POINTS_PER_WHOLE`, `WHOLE` in `marginalEuro.ts:22`, `BASIS_POINTS` in `projection.ts:7`, and literals in `customsTable.ts:96`, `valueCaption.ts:18`, `ruleWording.ts:146`, `incomeTax.ts:54`, `yearEndReading.ts:53` |
| Min, max and abs of money   | The 12 casts above                                                                                                                                                                                                            |
| Reading a rate              | The 8 parsers above                                                                                                                                                                                                           |

## 2. Primary sources

### Money and allocation

- **Fowler, catalog page.** Money "isn't actually a first class data type in any mainstream programming language", warns of "adding your dollars to your yen", and says "it's easy to lose pennies". The page does not cover integer storage or allocation.
- **Fowler's allocate method in the book (PoEAA).** Unconfirmed. I could not load the text. Verraes's post, secondary and loaded, says the remainder is handed out "until all money is spent".
- **dinero.js.** The amount is "expressed in the smallest subdivision of the currency, as an integer", and non-integers throw. "You can only add objects that share the same currency", which typed currencies enforce at compile time. `add` normalises to the highest scale. `allocate` spreads the rest "as evenly as possible". Fractional ratios go as scaled amounts, not floats.
- **moneyphp.** "The remainder fractions are allocated one by one to the targets", and order matters: 5 cents over 70/30 gives 4 and 1, and 30/70 gives 2 and 3. This is moneyphp, not Moneta.
- **JSR-354 and Moneta.** Rounding is a separate operator, `MonetaryRounding extends MonetaryOperator`. Moneta's `Money` is backed by `BigDecimal`, `FastMoney` by "a single long" at scale 5. `add` calls `checkAmountParameter`, which throws `MonetaryException("Currency mismatch...")`. No allocation was found in the pages loaded, so whether Moneta offers one is unconfirmed.

What this says for Kuna: every library pairs currency with amount because they serve many currencies in one program. Kuna's Money is one currency per module, with foreign amounts held apart, and integer cents already match dinero and `FastMoney`. Allocation in all three never loses a cent and adjusts by whole units, which Kuna's `moneyParts` does not always do well (bug 3).

### Branded types against classes

Checked against this code, run where marked.

| Concern           | Branded primitive                                                                                                                                 | Class                                                                                                                                                                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript        | Workaround the TS FAQ names, "branded primitives", made by assertion. "These can still be aliased" and lose safety, so the cast needs a lint rule | Structural unless it has `private` members                                                                                                                                                                                                   |
| Vue               | Primitive, nothing to proxy                                                                                                                       | `reactive` makes nested objects proxies. `#private` throws through a proxy: run, "Cannot read private member #c from an object whose class did not declare it". MDN explains why. Vue's fix is `markRaw` per object, with "identity hazards" |
| `===`, `<`, sort  | Work                                                                                                                                              | Break. Code such as `row.amount === asTyped.amount` and `amount < 0` is everywhere. Fowler notes JS compares objects by reference                                                                                                            |
| JSON              | Number, or bigint which throws, which `decimalText` already handles                                                                               | `#private` gives `{}`: run. Files are unaffected, since `amountText` writes them                                                                                                                                                             |
| `structuredClone` | Fine                                                                                                                                              | "The prototype chain is not walked", "Class private elements are not duplicated". Run: the prototype is gone                                                                                                                                 |
| `check:figures`   | Erased, so identical                                                                                                                              | See below                                                                                                                                                                                                                                    |

How the digest reads shapes (`figure-digest.mjs:713-731`): a primitive hashes its JSON or `${value}n`. An object hashes sorted `Object.keys`, leaving functions and undefined out. So:

- A brand change moves nothing.
- A renamed key moves that group. So does a changed scale.
- A class with a public field becomes a record, so every group with money moves: 188 of 269 hold money-named numbers.
- A class with `#private` gives `Object.keys` empty: run. Every Money then hashes the same, and the check goes blind to amounts without failing. This is the worst outcome.
- `currency` fields already appear in 72 groups. Nesting amount and currency into one object moves those.
- `basisPoints` as a key appears in 5 groups, `rate` as a number in hr-doo in 3 more.

### Value objects and aggregates

- **Evans, DDD Reference:** value objects: "Treat the value object as immutable. Make all operations Side-effect-free Functions." A brand with functions in one module meets that. Nothing asks for a class.
- **Evans:** aggregates: "Define properties and invariants for the aggregate as a whole", and "Use the same aggregate boundaries to govern transactions". **Fowler:** "Transactions should not cross aggregate boundaries."
- **Vernon's "Effective Aggregate Design":** unconfirmed. The PDF was encrypted and did not read.

In Kuna one write touches one file (`modules.md`), so the file is the largest possible transaction. Invariants live in readers such as `readSpendingBook.ts:205` and in writes. That is enough. Roots and repositories per record kind would be ceremony.

### What Croatian tax rounding requires, from `docs/law`

`docs/law` states no rounding rule for tax, contributions or VAT. A search for rounding terms finds only these:

- `assets/used-car-value.md:94`, "the division rounds to the cent, half away from zero". That is Kuna's estimate, marked `reading`, not law.
- Worked results in `investments/capital-gains.md:90` (200.00 / 1.20 = 166.67) and `hnb-rates-and-settlement.md:26` (178.91). They show two decimals and do not say how to round a tie.

`payrollArithmetic.ts:14` says "as the accountant rounds each payroll line", but no rule row carries that, and `confidence-and-citations.md` has a `practice` mark that no rule file uses. So half away from zero is Kuna's convention, supported in payroll only by a comment. The owner's rule should say so, and the question belongs on `docs/law/sources/watch-list.md`. I have not asserted anything from general knowledge here.

## 3. Recommendation

### Percentage type

`Percent` in `src/shared/money/percent.ts`, a branded whole number of basis points. It is `Rate` moved and renamed, with the same runtime value.

```ts
export type Percent = number & { readonly __unit: 'basis-points' }

export function percentFromBasisPoints(points: number): Percent
export function percentFromWhole(whole: number): Percent
export function moneyAt(amount: Money, rate: Percent): Money
export function moneyInside(gross: Money, rate: Percent): Money
export function restOf(rate: Percent): Percent
export function shareOfPercent(rate: Percent): Share
export function percentText(rate: Percent): string
```

`moneyAt` is today's `atRate`, and `moneyInside` is `vatInside`. `percentText` moves from `payrollArithmetic.ts`, where it would otherwise stop being reachable from other apps.

How it replaces `Rate`: `schema.ts` imports it, `basisPoints()` still makes rule rows, so no rule file changes. `RateTerm.basisPoints` keeps its key, because renaming moves 5 groups. The 8 copies of the constant go, and so do `percentOf` and the literals. `CapitalTaxRules` keeps whole numbers and applies `moneyAt(gross, percentFromWhole(rate))`, so the 8 tax groups do not move.

What stays apart, and why:

- **`YearlyRate` stays in Loans.** Its four decimals of a percent are a bank's wording, its exact annuity maths is its own, and nobody else needs it. It changes for a different reason. `fractionOf` stays.
- **`OwnerShare` stays.** "A whole number from 0 to 100" is a rule of that feature. It gains `percentOfOwnerShare`, so `ownerPartOf` uses the one owner.
- **`Decimal` percents stay.** Vendor weights and TERs need many places, and moving them to basis points would change figures. `HUNDRED_PERCENT` and the file's field names already say the scale.

And one more brand, since it is free:

```ts
export type Share = number & { readonly __unit: 'share-of-one' }
```

A measured ratio, 0 to 1 and float, never multiplied back into money. `ratioOf` returns it, and `formatPercent`, `formatShare`, `formatCostShare` and `formatPercentChange` take only it. The 17 hand-written `/ 100` become `shareOfPercent` or a `shareFromPercent` for chart scales. The runtime value is identical, and a percent passed to a formatter stops compiling.

Ceremony, not to build: a generic `Scaled<Unit>`, an `add` or `multiply` for percents with no caller, a `Fraction` separate from `Share`, or moving Target and TER to `Percent`.

### Money and currency

|                        | Currency on `Money`              | Separate `CurrencyAmount` object                                  | Brand for the hole, currency stays beside           |
| ---------------------- | -------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------- |
| Shape                  | `{ cents, currency }` everywhere | `{ amount: Decimal, currency }` where it varies                   | `AccountMoney` brand in Spending, the rest as today |
| Catches                | Mismatch at runtime              | Mismatch at runtime, only in its own functions                    | Foreign cents passed as euros, at compile time      |
| Digest                 | 188 of 269 groups move           | Up to 72 move if nested. Flat is impossible since the keys differ | None                                                |
| Vue, `===`, sort       | All break, as a class does       | Breaks at those sites                                             | Fine                                                |
| Bug it would fix today | None found                       | None found                                                        | The one real type hole                              |

Recommend the third. `Money` means cents in the module's base currency. `AccountMoney` means cents in an account's own currency, in `src/apps/spending`, converted only through `eurosAtEcbRate`. The first would be ceremony for an app whose every sum is in one currency. A `CurrencyAmount` is worth adding on the day a function must return or add foreign amounts across records, and no such function exists today. Spending should also refuse three-decimal currencies, as Company does, by moving `currencyProblem` to `currencyCode.ts`.

### Rounding and allocation, with one owner: `src/shared/money`

1. An amount rounds to the cent half away from zero, everywhere, in integers. Doc comments call this Kuna's convention until the law research says more.
2. Each business line rounds once, and totals add rounded lines. Lines with a meaning of their own, such as a payroll line, a lot's gain or a payment's tax, are the unit.
3. Only `money.ts`, `decimal.ts` and `percent.ts` divide. `dividedRounded` becomes internal once callers move to `moneyAt` and a `prorated` moved from `payrollArithmetic.ts`.
4. Splitting money goes through one function that never loses a cent and never gives a part below zero. See decision 4.
5. `moneyFromAmount` reads through `decimalOfNumber`, so `1.005` is `1.01`, as its doc says. Two-decimal inputs do not move, and the digest should confirm it.
6. Float is allowed for measured ratios and what-ifs, ending in one rounding through the owner.

### Rules and skill

**`.claude/rules/kuna-money.md`**, with paths `src/apps/**`, `src/shared/money/**`, `src/shared/app/**`:

```markdown
# Money and percentages

- Amounts are `Money`, in the module's base currency. A foreign amount is a `Decimal` beside a `CurrencyCode`. Spending's account rows are `AccountMoney`. `eurosAtEcbRate` is the only conversion.
- A rate applied to money is a `Percent`, in basis points. A measured ratio is a `Share`, from 0 to 1. Formatters take a `Share`.
- Round only through `src/shared/money`, half away from zero to the cent, once per business line.
- Never cast to `Money` or `Percent`, and never write `/ 100`, `* 100` or `10_000` outside that folder.
- A cell or a field states its scale. Never guess a scale from the size of a number.
- A brand stays a primitive. Never give a figure a class: `check:figures` reads object shapes.
- A refactor keeps `check:figures` identical. Renaming a key or changing a scale moves it.
```

**`.claude/rules/kuna-domain.md`**, with paths `src/apps/**/domain/**`, `src/apps/**/ruleset/**`:

```markdown
# Domain code

- A model is an immutable record with pure functions in the same feature folder. No classes, no services around bags of fields.
- A figure on a screen comes from `domain`. `presentation` formats it and holds no rule.
- An invariant has one function, called from the reader and from the write. The file is the transaction.
- Name it in the business's language. A published type is not the internal type.
- Read the `kuna-domain` skill before adding a type, a brand or a shared module.
```

**`.agents/skills/kuna-domain/SKILL.md`** holds what does not fit a rule: how to pick a new value type, when a brand earns its place, the scale table above, how the digest reads shapes and how to prove a declared move, and one worked example of moving a figure out of presentation. Rules load by path and stay short. The skill holds reasoning that would otherwise rot in every rule.

### Mechanical checks

The existing pattern fits: `scripts/lint-baseline.json`, `tests/lintBaseline.spec.ts` and `linesHolding` in the boundary spec. Inline disables have no effect.

| Rule                                                      | Check                                                                                                                                                                                                          |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No `as Money`, `as Percent`, `as Share` outside the owner | `no-restricted-syntax`, `TSAsExpression[typeAnnotation.typeName.name=/^(Money\|Percent\|Share\|Decimal)$/]`, with `ignores: src/shared/money/**`, as a new baseline `moneyCasts`                               |
| No `/ 100`, `* 100`, `10000`                              | `BinaryExpression[operator=/^[*\/]$/][right.value=/^(100\|10000)$/]`, as baseline `moneyScale`, with charts and fakes ignored. CSS widths in the 4 baseline files move to a `shareWidth` helper or stay listed |
| No `Math.round` in domain                                 | `CallExpression[callee.object.name='Math'][callee.property.name='round']` in `**/domain/**`, as a baseline for days and the like                                                                               |
| No class in domain                                        | `ClassDeclaration` in `**/domain/**`, except `Error` subclasses such as `StatementRefused`                                                                                                                     |
| Brand declared only by owners                             | Boundary case with `linesHolding(/__unit/, allowed)`, listing today's 7 files                                                                                                                                  |
| Figures come from domain                                  | Boundary case: `figure-digest.mjs` imports nothing from `presentation/`, except a list that only shrinks                                                                                                       |
| Formatters take brands                                    | `npm run typecheck`, once the signatures change                                                                                                                                                                |
| Scale stated                                              | No lint can see this. A table test per parser, so `0.8` is named in a test                                                                                                                                     |
| One Money per amount                                      | No check beyond the type. `AccountMoney` makes it a compile error                                                                                                                                              |

Gotcha: flat config replaces a rule's options rather than merging them. `kuna/design` already sets `no-restricted-syntax` to `scriptColourStrings`, so the new entries must spread that list, and `.vue` templates need `vue/no-restricted-syntax` too.

### Refactor order

Each commit runs `check:figures` before and after, over every fake set and the owner's real exports, with identical output. The digest sees no words, so parser and format changes also need table tests. File counts are estimates from importers.

| Step     | Work                                                                                                                                                              | Files       | Digest          | Parallel                                                                                                                                  |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 0        | Add `percent.ts`, `Share`, `absMoney`, `minMoney`, `maxMoney`, then lint and boundary rules with a full baseline, so new code stops adding to it. Rules and skill | 8 to 10     | None            | First, alone. `kuna-sidebar` has uncommitted edits in `lint-baseline.json` and `figure-digest.mjs`, so this waits for it or rebases on it |
| 1        | hr-doo: `Rate` to `Percent`, `atRate` to `moneyAt`, constants gone, `companyFacts`, `yearEnd.ts:17`, 12 `as Money`                                                | 35 to 40    | None            | Worktree. Highest duplication and tax. `kuna-onboarding3` touches 2 pack files                                                            |
| 2        | Investments and Assets: `percentOf`, `projection`, `customsTable`, `partOf`, hand `/ 100`, `Share` on the 20 domain fields                                        | 25 to 30    | None            | Worktree                                                                                                                                  |
| 3        | Loans: figures out of presentation (9 digest imports), `leftOver` left for its own decision                                                                       | 15 to 20    | None            | Worktree                                                                                                                                  |
| 4        | Company: `Share`, `as Money` in receivables and filters, `settings.ts:822`, `OwnerShare` through the owner                                                        | 15 to 20    | None            | Worktree, after `kuna-onboarding3`, which has 20 Company files open                                                                       |
| 5        | Spending: `AccountMoney`                                                                                                                                          | 20 to 30    | None            | Worktree, after `kuna-onboarding3` (5 files)                                                                                              |
| 6        | hr-doo figures out of presentation (`salariesView` and 4 more)                                                                                                    | 10 to 15    | None            | After step 1                                                                                                                              |
| 7        | `formatMoney`, `MoneyText`, `HubPart.cents` take `Money`, plus props and a chart formatter. Baseline empties                                                      | 60 to 80    | None            | Last, alone. Touches shell and `appContribution.ts`, which `kuna-sidebar` has open                                                        |
| Separate | The bugs, one commit each, with declared moves. See decisions                                                                                                     | 1 to 5 each | Moves, declared | Any time                                                                                                                                  |

Steps 1, 2 and 3 can run at once, since their folders are disjoint and step 0 froze `src/shared/money`. In flight now:

- `kuna-chat` shows no uncommitted files, and sits at 0d20a0a.
- `kuna-onboarding3` has 85 files open, mostly `shared/storage` (20) and Company (20), plus 6 in the shell.
- `kuna-sidebar` has 41 open, 14 in the shell.

Leave `src/shared/ai` (`citedAnswer.ts:116`, `:120`, `useAiTask.ts:109`, which are dollars and read-backs) in the baseline until the chat work lands, as well as `src/shell` and first-run code. `citedAnswer`'s `basisPoints` is a text check, and it may stay a number.

Not in this issue, name as tasks: splitting `importDryRun.ts`, `settings.ts` and `forecastYear.ts`. Size alone is no reason to touch them now.

## The owner's answers, 2026-11-06

These override the recommendations below wherever the two differ.

- Every split rounds a running sum, in a commit of its own, after a diff on the owner's real Investments file. If a filed year moves, it stops for him first.
- A number below 1 in a percent cell with no percent sign is asked in the import's question step, showing both readings. The settings cell refuses it and asks for a sign. His existing spin-offs get checked first.
- A company statement in another currency needs currency conversion, as [a task of its own](https://github.com/ipazanin/kuna/issues/51) with research on providers and keys. It stays as it is until then, since all accounts are in euros.
- `Percent` in basis points replaces `Rate`, `Share` covers 0-to-1 ratios, and Loans keeps `YearlyRate`. All branded numbers.
- The lead's defaults: the rounding rule gets one `law-research` lane without holding the refactor, and `AccountMoney` follows the report's recommendation.

## 4. Decisions for the owner

### 1. How a fee or a cost is split across lots (hardest)

A sale closes several lots and a fee is shared among them. Today €0.05 over ten equal lots gives nine lots a cent and the last −€0.04, and €1.00 over three gives 33, 33, 34.

- **Round a running sum everywhere.** One method, already used for depreciation, grants and day spreads, and it never goes negative. The sale's total stays the same, but €1.00 over three becomes 33, 34, 33, so a cent can move between lots. If those lots fall on different sides of the two-year line, a year's taxable gain moves by cents, including years already filed. Cost: one commit, a declared move in lot, tax and mix groups, and a diff on your real file.
- **Keep the method, and patch only the broken case.** Nothing moves except the rare negative. Two rules for one job stay, and the last lot keeps absorbing up to half a cent per part. Cost: small.
- **Hand out the rest by largest remainder, as dinero and moneyphp do.** Fairest split. It moves as much as the first option and adds a third method. Cost: as the first.

Recommendation: round a running sum, in a commit of its own, after diffing the owner's real Investments file. If a filed year moves, stop and look at it before landing.

### 2. A cell that says 0.8 where a percent belongs

A spin-off row says Cost share `0.8`. You mean 0.8%, Kuna reads 80%, and most of the parent's cost moves to the new holding. The owner loan cell does the same with `0.5`.

- **Ask when it is unclear.** A number below 1 with no percent sign goes to the import's question step showing both readings. A percent-formatted cell looks the same in the file, so it gets asked too. The settings cell refuses it and asks for a sign. Cost: one more question on some imports, and a small change in two readers.
- **Always read the column as a percent.** Simple and matches the label. A cell formatted as a percent, which holds 0.052, then reads as 0.052%. Cost: smallest, and a new silent error in the other direction.
- **Leave it and show the share in the dry run.** No code risk, and the error still depends on someone noticing.

Recommendation: ask when it is unclear. Check your existing spin-offs first, since a stored cost share read this way is wrong today.

### 3. A company bank statement in another currency

A camt statement in USD arrives for the company's account. Today it files at face value, and $1,000 beside €1,000 shows €2,000.00 in cash on hand.

- **Refuse it.** A statement or account not in the book's currency is refused with a sentence that says why, and the currency column goes or becomes a check. Nothing wrong can reach a figure. Cost: small. A company with a foreign account cannot import it yet.
- **Convert at the ECB rate.** Foreign rows get euro figures, as Spending does. This is the real feature, and it brings a balance chain per currency, exchange gains and a question about the accountant's rate. Cost: a feature of its own, not this issue.
- **Leave it.** It stays latent while all accounts are in euros.

Recommendation: refuse now, and raise converting as a new issue if DSS ever holds such an account.

### 4. One percent scale, or two

A loan's 3.1825% does not fit basis points, while VAT's 25% and every other exact rate do.

- **`Percent` in basis points, with Loans keeping `YearlyRate`.** Mixing them is a compile error, and no hash moves. Two types stay, and a conversion is needed the day they meet, which no feature needs yet. Cost: the plan above.
- **One `Percent` in millionths.** One type, and Loans is unchanged. hr-doo values grow by 100, so at least 8 groups move, more if tax rules and shares follow. `amount * rate` nears the safe integer limit in depreciation (`base * rate * months` passes 2^53 near a €4M asset), so the owner needs BigInt. Cost: one declared move and a proof script, plus a slower hot path.

Recommendation: basis points with `YearlyRate` apart. It meets the issue's identical-hash bar, and the two change for different reasons.

### 5. What Kuna claims about rounding

A payroll line comes to a half cent, and Kuna rounds away from zero. A comment says the accountant does so, while `docs/law` has no rule and nothing is marked `practice`.

- **Research it, then write it down.** One `law-research` lane on income tax, contributions, VAT and the euro changeover, adding a short file and a watch-list row. The rule then cites a source or says that none exists. Figures do not change unless the law disagrees. Cost: one lane. For the company the accountant's filed figures can confirm it, and personal tax goes by primary sources only.
- **State it as Kuna's convention and move on.** Honest and free. A cent's difference from a filing stays possible and unexplained.

Recommendation: research it, and don't hold the refactor for it, since the rule's wording is the only thing waiting.

### 6. Spending's foreign cents

A row in dollars holds `Money`, the same type as the euros beside it. Nothing is wrong today, but passing `amount` where `euros` belongs compiles and shows dollars as euros.

- **A brand, `AccountMoney`.** A leak stops compiling, with no runtime or hash change. Cost: 20 to 30 files.
- **Leave it, and rely on the names.** No cost now. The risk grows with Personal bank statements (issue 45).

Recommendation: the brand, after onboarding lands.

## Sources

### Loaded

- Fowler, Money: https://martinfowler.com/eaaCatalog/money.html
- Fowler, Value Object: https://martinfowler.com/bliki/ValueObject.html
- Fowler, DDD Aggregate: https://martinfowler.com/bliki/DDD_Aggregate.html
- Fowler, Anemic Domain Model: https://martinfowler.com/bliki/AnemicDomainModel.html
- Evans, DDD Reference, pages 12 and 16: https://www.domainlanguage.com/wp-content/uploads/2016/05/DDD_Reference_2015-03.pdf
- dinero.js, amount: https://www.dinerojs.com/docs/core-concepts/amount
- dinero.js, allocate: https://www.dinerojs.com/docs/api/mutations/allocate
- dinero.js, add: https://www.dinerojs.com/docs/api/mutations/add
- moneyphp, allocation: https://www.moneyphp.org/en/stable/features/allocation.html
- JSR-354, MonetaryAmount: https://javamoney.github.io/apidocs/javax/money/MonetaryAmount.html
- JSR-354, MonetaryRounding: https://javamoney.github.io/apidocs/javax/money/MonetaryRounding.html
- Moneta, Money: https://github.com/JavaMoney/jsr354-ri/blob/master/moneta-core/src/main/java/org/javamoney/moneta/Money.java
- Moneta, FastMoney: https://github.com/JavaMoney/jsr354-ri/blob/master/moneta-core/src/main/java/org/javamoney/moneta/FastMoney.java
- Moneta, MoneyUtils: https://github.com/JavaMoney/jsr354-ri/blob/master/moneta-core/src/main/java/org/javamoney/moneta/spi/MoneyUtils.java
- TypeScript FAQ: https://github.com/microsoft/TypeScript/wiki/FAQ
- Vue, reactivity fundamentals: https://vuejs.org/guide/essentials/reactivity-fundamentals.html
- Vue, reactivity advanced, `markRaw`: https://vuejs.org/api/reactivity-advanced.html
- MDN, Proxy, no private field forwarding: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy
- MDN, structured clone: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm
- MDN, JSON.stringify: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify
- Verraes, Fowler's Money in PHP, secondary: https://verraes.net/2011/04/fowler-money-pattern-in-php/
- In the repo: `docs/law/README.md`, `investments/capital-gains.md`, `investments/foreign-capital-income.md`, `investments/hnb-rates-and-settlement.md`, `assets/used-car-value.md`, `sources/confidence-and-citations.md`, `sources/watch-list.md`

### Unconfirmed

- Fowler, PoEAA, Money and allocate, p. 488: the book text was not available. The page reference comes from a search snippet only.
- Vernon, Effective Aggregate Design: the PDF is encrypted and did not read. https://www.dddcommunity.org/wp-content/uploads/files/pdf_articles/Vernon_2011_1.pdf
- TypeScript Playground, nominal typing: the example's text did not load. https://www.typescriptlang.org/play/?q=305#example/nominal-typing
- Whether Moneta offers allocation: none in the pages loaded. https://javamoney.github.io/ri.html is a landing page.
- BigInt in structured clone: MDN's page does not mention it. `structuredClone(5n)` returned `5n` when run in Node 26.
- What Croatian law says on rounding: not in `docs/law`, and not researched elsewhere, as asked.
