# Simpler loan scenarios and equal principal loans

How Kuna Loans gets a four-field New scenario dialog, a comparison that leads with the monthly instalment, saved loan tries on the loan's own page and an equal principal repayment type for bank loans and offers, checked against e8963de with the owner's answers of 2026-11-03.

This builds on [the loan simulations plan](simulations-plan.md), which made the Scenarios screen. Two research lanes (the engine and the editor) were read against the repo at `e8963de`, and every claim below was checked again in the code. Paths are under `src/apps/loans/` unless they say otherwise. Every figure is made up: the owner's round example (100,000.00 at 4% over 10 years) or the fake sample.

## Summary

- **Scenarios keeps to new loans and offers.** New scenario opens one dialog with four fields: amount, rate, term in years and months, and repayment type. Everything else waits in a closed More terms section whose defaults change nothing.
- **The comparison leads with the monthly instalment,** first and last when the instalment changes, then total interest, total paid and paid off. On a phone each scenario is one card. The card row and Against the base go.
- **Tries on a loan you have live on that loan's page,** under the what-if: an extra payment, a rate change and a shorter term, each with Save. Saved tries list there with what they save and Delete. Scenarios already saved against a loan read as they do today and show in that list.
- **Equal principal joins annuity** as a repayment type of bank loans and offers. One branch in the plan engine, one optional stored field, and a file in today's shape reads and saves the same.

## What changes for the owner

**Scenarios screen.** No tabs. It opens on your offers: the picker, Side by side, the two charts folded, then the list. Say Jadran Bank offers 2.95% and Coastal Bank 3.20% then variable. The first row reads "Monthly instalment" with each offer's figure, and Coastal's cell has its last instalment under it, since its rate changes after five years.

**New scenario.** Type 100,000, 4, 10 years and 0 months. The foot reads "€1,012.45 a month, paid off" with the month. Pick Equal principal and it reads "€1,166.67 falling to €836.11". Save without a name and the offer is called "€100,000.00 at 4% over 10 y". Open More terms only to add a payout date, a subsidy, costs, a variable rate after some fixed years, extra payments or the bank's EKS.

**A bank loan's page.** The what-if card gets three choices: Extra payment (as today), Rate change and Shorter term. Try 3% from the next due date on the sample's Home loan and Save. It appears in Saved tries under the card, as "Rate 3% from (date)" with "€1,234.56 less interest" (made-up figure), and Delete with Undo. The sample's three Home loan scenarios (€5,000 next spring, €150 every month, Move to Jadran Bank) show in the same list.

**Bank loan dialog and the offer.** A Repayment choice, Annuity or Equal principal, Annuity picked. An equal principal loan's page, plan and dialogs say "rata" in Croatian where an annuity loan says "anuitet". A subsidy on an equal principal loan says Kuna takes it as the fixed amount typed.

**Nothing else moves.** The Overview, tiles, home card, Your next payment and every figure of an existing annuity loan stay as they are.

## Domain rules

### Equal principal, each instalment rounded once

Each instalment repays a share of principal, the balance it was set from over the instalments it was set for, kept as an exact fraction. The instalment is that share plus the month's interest, both unrounded, rounded half up once. The interest is rounded on its own as today (`bankLoans/domain/yearlyRate.ts:44-46`), the principal is the difference, and the last instalment takes what is left (`bankLoans/domain/loanPlan.ts:121`).

| 100,000.00, 120 instalments, 4% | Annuity (today's engine)      | Equal principal |
| ------------------------------- | ----------------------------- | --------------- |
| First instalment                | 1,012.45                      | 1,166.67        |
| Second                          | 1,012.45                      | 1,163.89        |
| Last                            | 1,012.70 (takes the rounding) | 836.11          |
| Total interest                  | 21,494.25                     | 20,166.67       |
| Principal repaid                | 100,000.00                    | 100,000.00      |

These come from the engine lane's integer copy of the rules (re-run for this plan), not from the app. Stage 1's specs are the first run through the real engine. Whether Croatian banks round this way is **unconfirmed** until a real equal principal plan is compared.

### Changes on an equal principal plan

These are the owner's rules, the natural reading of the type, and **unconfirmed against bank practice**. The repo's research covers annuities only.

| Change                          | Annuity (today)                                                               | Equal principal                                                                     | Example, equal principal                                                                |
| ------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| New rate from a due date        | Instalment recomputed over the instalments left (`loanPlan.ts:115-119`)       | The share stays, only the interest follows the rate                                 | 6% from instalment 61: 61 is 1,083.33, last 837.49, interest 22,708.33                  |
| Extra payment, shorter term     | Instalment kept, count of months recomputed (`loanPlan.ts:110-111`, `:30-40`) | The share stays, the plan ends after the shares the balance still holds, rounded up | 10,000.00 after instalment 24: 108 instalments, 25 is 1,066.67, interest 17,150.00      |
| Extra payment, lower instalment | Annuity recomputed over the instalments left (`loanPlan.ts:108`)              | The share is recomputed over the instalments left                                   | Same payment: 25 is 962.50, 120 instalments, interest 18,550.01                         |
| Subsidy                         | Fixed monthly amount, capped at the payment (`loanPlan.ts:43-46`)             | The same. The screen says it is taken as fixed.                                     |                                                                                         |
| EKS                             | Solved from dated flows (`scenarios/domain/effectiveRate.ts:25-28`)           | No change                                                                           | 4.07% for both with no costs. With 1,000.00 up front, 4.31% against the annuity's 4.30% |

At 0% the instalment is the share alone. A loan with no type stored is an annuity, and the annuity branch is today's code untouched.

### When an instalment "changes"

A plan's instalment changes when any instalment before the last differs from the first. The last of an annuity only takes the rounding, so an annuity at one rate shows one figure. An equal principal plan and a fixed-then-variable annuity show the first and the last.

### Shorter term on a loan you have

The earlier plan said a term change is a move with no costs. The code says otherwise for a loan like the sample's Home loan. A move builds the new loan with no subsidy (`scenarios/domain/scenarioPlan.ts:217`), keeps only the loan's own rate periods up to the move (`:187`), and counts as an early repayment, so it raises the subsidy payback warning (`:197`). See the first open question.

## The stored field

- **Domain.** `REPAYMENTS = ['annuity', 'equal-principal'] as const` and `readonly repayment` on `BankLoan` (`workbook/domain/bankLoan.ts:22-33`), always set, `'repayment'` added to `LoanTerms` (`:36`), so `OfferTerms` (`scenarios/domain/loanScenario.ts:20`) gets it too. The doc comment at `bankLoan.ts:21` names both types.
- **Reader and codec.** `repayment` joins `LOAN_TERM_FIELDS` (`workbook/domain/bankLoanReading.ts:48-60`). `loanTermsOf` (`:68-83`) reads blank as `annuity`, otherwise `requiredChoice(fields, 'repayment', REPAYMENTS, 'repayment type')` (`src/shared/storage/domain/storedFields.ts:165`), so an unknown word is refused with its reason. `loanTermsFields` (`:85-99`) writes `null` for an annuity, which `filledFields` leaves out, so an annuity loan's record is byte for byte what it is today.
- **Offers and loan scenarios.** An offer reads and writes it through `OFFER_FIELDS` (`workbook/domain/loanScenarioReading.ts:23`). A loan scenario with it filled is refused like any offer field (`:46-47`). Saved loan scenarios keep `kind: 'loan'`, their reader, the cross-record rule (`workbook/domain/readLoanBook.ts:200-209`) and the delete cascade (`bankLoans/application/bankLoanWrites.ts:16-22`, `:51-57`). Nothing is migrated.
- **Plans.** `offerBase` copies `repayment` (`scenarios/domain/scenarioPlan.ts:60-63`). The loan after a move takes the old loan's type (`:208-219`).
- **Schema** stays `{ loans: 1 }` (`workbook/infrastructure/loansDocument.ts:11`). An older app keeps the field through a write and shows an equal principal loan as an annuity until it updates.

## Found in the code that the notes or the earlier plan miss

- A shorter term built as a move drops the subsidy and the loan's later rate periods (above).
- The figure digest leaves out undefined keys (`scripts/figure-digest.mjs:520`). `repayment` must be set on every `BankLoan` for the digests to show the new key the owner expects. Left optional in the type, they would not change at all.
- A `loan-scenario` must have a name (`workbook/domain/loanScenarioReading.ts:43`). The optional name is filled from the figures when left blank, so the record keeps its shape and older apps still read it.
- The screen's alerts for scenarios Kuna cannot work out come from the card view (`scenarios/presentation/ScenarioCompare.vue:140`). Deleting the cards moves them to the worked scenarios.
- `words.card.paidOff` and `words.card.same` also serve the editor (`scenarios/presentation/ScenarioEditor.vue:192`, `:208`). Only words the cards alone use go.
- `ChoiceButtons` has no Loans user yet (`.agents/skills/kuna-design/components.md`, Controls). Using it changes the catalogue counts that `tests/designCatalogue.spec.ts` checks.
- The two lanes stated the "instalment changes" rule two ways (second-to-last against first, or any before the last). This plan uses any before the last.

## Stages

Each stage is one reviewable step, checked with `npm run check`, both builds, `check:figures` and the targeted visual and touch flows. The design reviewer reports no Critical finding on stages 3 and 4.

### 1. The engine

| File                                                                      | Change                                                                                                             |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `workbook/domain/bankLoan.ts`                                             | `REPAYMENTS`, `repayment` on `BankLoan` and `LoanTerms`, doc comment                                               |
| `bankLoans/domain/yearlyRate.ts`                                          | `equalPrincipalInstalment(shareBalance, shareCount, balance, rate)` beside `annuity()` (`:53-65`), exact in BigInt |
| `bankLoans/domain/loanPlan.ts`                                            | One branch at `:79`, `:106-113` and `:116-119` by `loan.repayment`, doc comment at `:57-68`                        |
| `scenarios/domain/scenarioPlan.ts`                                        | `offerBase` and the moved loan carry the type                                                                      |
| `scenarios/domain/scenarioOutcome.ts`                                     | `lastInstalment` and `instalmentChanges` beside `nextInstalment` (`:10-36`)                                        |
| `workbook/infrastructure/fake/fakeLoans.ts`, `tests/fixtures/loans.ts:23` | `repayment: 'annuity'` on every literal                                                                            |

Proof:

- `tests/loanPlan.spec.ts`: both types on the example, every figure in the tables above, the 6% from instalment 61, shorter-term and lower-instalment cases, a subsidy on an equal principal loan, and 0%.
- `tests/scenarioOutcome.spec.ts`: first 1,166.67, last 836.11, changes. An annuity at one rate reports no change.
- `tests/effectiveRate.spec.ts`: 4.07% for both types, 4.31% against 4.30% with 1,000.00 up front.
- `tests/loanWhatIf.spec.ts`: 10,000.00 after instalment 24 on the equal principal example, 3,016.67 less interest and 12 instalments fewer, or 962.50 next and 1,616.66 less.
- `tests/loansTogether.spec.ts`: an equal principal loan beside an annuity, its falling payments in upcoming payments and outgoing by month.
- `check:figures` on `--fake-loans sample`, `house-and-car` and the live file: only the groups in "Figure digests" change, by new keys.

### 2. The stored field and the bank loan's copy

| File                                                                                                              | Change                                                                                                                                                                                                                                                                           |
| ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `workbook/domain/bankLoanReading.ts`, `workbook/domain/words.ts`                                                  | The field, the reader, the codec, the refusal reason                                                                                                                                                                                                                             |
| `bankLoans/presentation/LoanTermsFields.vue`                                                                      | `repayment` in `LoanTermsTexts` (`:12`), `loanTermsTexts` (`:25`), `typedLoanTerms` (`:40`) and a `ChoiceButtons` row, so `BankLoanDialog.vue` gets it                                                                                                                           |
| `bankLoans/presentation/words.ts`, `bankLoanView.ts`, `BankLoanTiles.vue`, `WhatIfPanel.vue`, `SubsidyFields.vue` | Strings that state annuity behaviour take the type: the extra payment effects (`words.ts:11-17`), `subsidyThen` (`:59`), `ratePeriodsSubtitle` (`:129`), `whatIf.shorterNote` (`:229`), and the Croatian instalment word on one loan's page and dialogs. The fixed-subsidy note. |
| `overview/presentation/words.ts:109`, `BankLoanCard.vue:55`                                                       | The subsidy caption for a falling instalment                                                                                                                                                                                                                                     |
| `README.md`                                                                                                       | `bank-loan` row (line 2252), `extra-payment` row (2254), `loan-scenario` row (2258), the plan paragraph, the glossary (1912-1920) for `rata`                                                                                                                                     |

Proof:

- `tests/loanReaders.spec.ts`: blank reads as annuity, `equal-principal` reads, `linear` is refused with its reason, an offer reads it, a loan scenario with it is refused.
- `tests/recordStorageContract.spec.ts` (`:489`, `:504`): Car loan stores `equal-principal`, Boat loan none, the offer stores it, both round trip. The kind count stays eight.
- `tests/bankLoanView.spec.ts`: the subsidy caption for both types.
- `check:figures` unchanged against stage 1.
- Visual: `dialogs-loans` and `-croatian` show the Repayment row. Touch: the bank loan dialog's flows unchanged.

### 3. The new scenario dialog and the comparison

| File                                                                                                    | Change                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `scenarios/presentation/OfferTermsFields.vue`                                                           | Rebuilt: amount (`MoneyInput`), yearly rate, years and months, Repayment (`ChoiceButtons`), then More terms as a bordered toggle like `ChangeBlock.vue:51-65`. It keeps `typedLoanTerms` as the one parser and writes `years × 12 + months` into `instalments`.                            |
| `scenarios/presentation/ScenarioEditor.vue`                                                             | Offers open straight in it. The facts and the foot lead with the instalment (`:188-196`, `:216-224`). A blank name is filled from the figures. Move leaves the Add row on offers but a saved one still opens.                                                                              |
| `scenarios/presentation/scenarioComparison.ts`                                                          | Offers' lines: Monthly instalment (first, the last under it when it changes), Interest, You pay in all, Paid off, then Extra you put in, Costs, Subsidy pays, Kuna's EKS, the bank's EKS and Ahead by, each only when a column has a figure. Highest instalment and Instalments in all go. |
| `src/shared/ui/ScenarioComparison.vue`                                                                  | Below 768 px one card per column, its mark and name, then its lines in order (`:88-122` today). Lines in place of groups. A cell takes an optional second figure under the first.                                                                                                          |
| `scenarios/presentation/ScenarioCompare.vue`, `scenariosView.ts`                                        | Picker, Side by side, charts folded by `start-collapsed` with `collapse-id` `loans.scenarios.owed` and `loans.scenarios.interest`, then the list. Refusals from the worked scenarios.                                                                                                      |
| Deleted                                                                                                 | `AgainstBaseCard.vue`, `ScenarioCard.vue`, `scenarioCards`, `againstBase`, `cardFacts` and their types in `scenariosView.ts`, the `against.*` words and the card-only `card.*` words in both languages                                                                                     |
| `src/shell/gallery/ScenarioSpecimens.vue`, `.agents/skills/kuna-design/components.md`, `README.md:2300` | The phone cards and the two-figure cell, the catalogue row and counts, "two by two" replaced                                                                                                                                                                                               |

The loan tabs keep their own lines until stage 4.

Proof:

- `tests/loanScenarioComparison.spec.ts`: line order, the instalment's second figure for an equal principal offer and none for a one-rate annuity, optional lines dropping when every column has none.
- `tests/loanScenariosView.spec.ts`: the card and bar cases (`:99-120`) go, refusals come from worked scenarios.
- `tests/designCatalogue.spec.ts` with the new counts.
- `check:figures`: `loans.scenarios` changes by design. Every `loans.scenario-N` is unchanged.
- Visual pages `loans-scenarios-offers` and `-croatian` (`scripts/visual-check.mjs:1585-1600`) expect "Monthly instalment" first and no "Against the base". `loans-scenarios` and its Croatian page (`:1576-1583`, `:1621-1627`) drop "Against the base" and "U odnosu na polazni".
- `loansScenarioEditorFlow` (body in `scripts/support/editorFlows.mjs`, run at `visual-check.mjs:3382` and `touch-check.mjs:2412`) becomes: amount, rate, years and months, read the foot, switch to Equal principal, read "€1,166.67". At 360 px for touch.
- `loansDialogsFlowIn` shoots the new dialog with More terms closed and open.
- The gallery at 360, 768 and 1440 px, light, dark and Croatian.

### 4. Saved tries on the loan's page

| File                                         | Change                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bankLoans/domain/whatIf.ts`                 | `whatIfRateChange(book, from, rate, rateType)` beside `whatIfExtraPayment` (`:35-55`), through `scenarioPlan` with one `rate-change`. The shorter term try waits on the first open question.                                                                                                                                                                               |
| `bankLoans/presentation/WhatIfPanel.vue`     | `ChoiceButtons` for Extra payment, Rate change and Shorter term. Save writes a loan scenario at once with a name from the try (`saveScenario`, `newLoanScenario` in `scenarios/application/scenarioWrites.ts`), with an Undo toast. The Compare scenarios link goes.                                                                                                       |
| `bankLoans/presentation/savedTries.ts` (new) | Each loan scenario of the loan worked from today against the loan as it stands, with `workedScenario` and `standing` (`scenarios/presentation/scenariosView.ts:103`, `:126`): its changes in a line, then less interest and how much sooner, or its refusal.                                                                                                               |
| `bankLoans/presentation/ChangeListCard.vue`  | An optional remove mode, Delete in place of Change, so Saved tries reuses the card. Delete goes through `removeScenario` with Undo.                                                                                                                                                                                                                                        |
| `bankLoans/presentation/BankLoanScreen.vue`  | Saved tries under the what-if (`:187`), collapse id `loans.saved-tries`. `ScenarioEditor` and `scenarioSaved` leave (`:13-15`, `:135-146`, `:244`).                                                                                                                                                                                                                        |
| `scenarios/presentation/*`                   | Loan tabs, `PageTabs`, `?tab=`, A as it stands, Try extra, the loan empty state, `NewScenarioDialog.vue`, the editor's loan branch (`ScenarioEditor.vue:93-98`, `:122-171`, `:197-233`), `ScenarioTab` and the loan lines in `scenarioComparison.ts:175-202` go. `scenarioTabOf` and the loan argument of `scenariosLink` go (`overview/presentation/loanLinks.ts:23-31`). |
| Words                                        | In `scenarios/presentation/words.ts` the loan-tab and start-dialog words go, such as `asItStands`, `paidOff`, `picker.loan`, `picker.locked`, the loan `empty.*`, `start.*`, `list.loan*`, `lines.nextInstalment`, `lines.instalmentsLeft`, `lines.interestLeft`, `editor.loanDescription`, `editor.against` and `whatIf.compare`. New words below.                        |

Proof:

- `tests/loanWhatIf.spec.ts`: a rate change try on the example and on a subsidised loan.
- A new `tests/savedTries.spec.ts`: the sample's three Home loan scenarios read, work out and show what they save, a refused one shows its reason.
- `tests/loanReaders.spec.ts:292-330` and `tests/loanWrites.spec.ts:172-230` pass unchanged, which proves old files still read and a loan's delete still takes its scenarios.
- `tests/loanScenariosView.spec.ts` and `tests/loanScenarioComparison.spec.ts` lose their loan-tab cases.
- `check:figures`: `loans.scenarios` changes by design. A new `loans.bank-loan-N.saved-tries` group and a `.what-if-rate` group appear. `.what-if` is unchanged.
- Visual: `loans-scenarios-empty` and `-croatian` (`visual-check.mjs:1603-1619`) move to an offers-free set (stage 5). `loansScenariosFlow` and `loansScenariosFlowIn` move to the offers. `loansTryExtraFlow` and `CAR_LOAN_SCENARIOS` go. `loansWhatIfScenarioFlow` (`visual-check.mjs:3391`) saves a rate change try and finds it in Saved tries. `loansDialogsFlowIn` drops the Move editor shot.
- Touch (`scripts/touch-check.mjs:2411-2413`, imports at `:119-121`, description at `:23`): `loans-try-extra` becomes `loans-saved-tries`, a rate change saved at 360 px, then deleted and undone.

### 5. Sample data and checks

- **An equal principal offer** in every set, "Lighthouse Bank offer": 100,000.00 at 4% over 120 instalments, so Side by side shows a falling instalment beside Jadran and Coastal.
- **A new fake set `equal-principal`** with one equal principal bank loan (the example, a 150.00 subsidy for 24 instalments) and no scenarios. No existing set's loan figures change, the bank loan page and Croatian "rata" get visual pages, and the Scenarios empty state gets its page.
- Files: `workbook/infrastructure/fake/fakeLoans.ts` (`FakeLoansSet` at `:250`), `scripts/figure-digest.mjs:9`, `:167`, `:172` for the new set, `scripts/support/englishLeft.mjs:155`, `scripts/visual-check.mjs` pages `loans-equal-principal` and `-croatian`, `README.md` for the set.
- Proof: `check:figures` gains `loans.scenario-6` on every set and a changed `loans.scenarios`. Every other group matches stage 4. `--fake-loans equal-principal` runs clean. Visual pages at 360, 768, 1440 and 1920 px.

## Figure digests

For existing loans no figure changes. What changes, stage by stage:

| Group                                            | Stage      | Why                                                                                                  |
| ------------------------------------------------ | ---------- | ---------------------------------------------------------------------------------------------------- |
| `loans.read.records`                             | 1          | Every bank loan and offer carries `repayment`                                                        |
| `loans.scenario-N.plan`                          | 1          | `ScenarioPlan.loan` is a whole `BankLoan`                                                            |
| `loans.scenario-N.outcome`                       | 1          | New keys `lastInstalment` and `instalmentChanges`                                                    |
| `loans.scenarios`                                | 1, 3, 4, 5 | Worked plans hold a loan (1). Cards, bars and lines change (3). Loan tabs go (4). The new offer (5). |
| `loans.totals`                                   | 1          | Each upcoming bank payment carries its `loan` (`overview/domain/loansTogether.ts:84`)                |
| `loans.bank-loan-N.saved-tries`, `.what-if-rate` | 4          | New groups                                                                                           |
| `loans.scenario-6`                               | 5          | The new offer                                                                                        |

The `bank-loan-N` plan, figures, years, payments, months, what-if and moves groups, the informal groups, `loans.closed`, Company and Investments stay identical. Each stage diffs the digest against the one before and shows only these.

## New strings

Croatian to check at 360 px. Where a Croatian string names one loan's instalment it has an annuity form and a "rata" form (rata: 1 rata, 2 rate, 5 rata).

| English                                                                                                           | Croatian, annuity                                                  | Croatian, equal principal                                           |
| ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------- |
| Repayment                                                                                                         | Način otplate                                                      |                                                                     |
| Annuity, the same every month                                                                                     | Anuitet, isti svaki mjesec                                         |                                                                     |
| Equal principal, falling each month                                                                               | Jednake rate glavnice, svaki mjesec manja                          |                                                                     |
| Term                                                                                                              | Rok otplate                                                        |                                                                     |
| Years / Months                                                                                                    | Godine / Mjeseci                                                   |                                                                     |
| More terms                                                                                                        | Više uvjeta                                                        |                                                                     |
| Nothing here changes a figure until you fill it in.                                                               | Ništa ovdje ne mijenja izračun dok ga ne ispunite.                 |                                                                     |
| Paid out on (help: Today unless you change it.)                                                                   | Datum isplate (Danas, osim ako ga promijenite.)                    |                                                                     |
| Fixed for, years (help: Blank keeps it fixed to the end.)                                                         | Fiksna, godina (Prazno znači fiksna do kraja.)                     |                                                                     |
| Then variable, %                                                                                                  | Zatim promjenjiva, %                                               |                                                                     |
| Name, optional                                                                                                    | Naziv, nije obavezan                                               |                                                                     |
| €100,000.00 at 4% over 10 y                                                                                       | 100.000,00 € uz 4 % na 10 g.                                       |                                                                     |
| Monthly instalment                                                                                                | Mjesečni anuitet                                                   | Mjesečna rata                                                       |
| last €836.11                                                                                                      | posljednji 1.012,70 €                                              | posljednja 836,11 €                                                 |
| €1,012.45 a month, paid off (month)                                                                               | 1.012,45 € mjesečno, otplaćen (mjesec)                             |                                                                     |
| €1,166.67 falling to €836.11, paid off (month)                                                                    |                                                                    | 1.166,67 € pa sve manje do 836,11 €, otplaćen (mjesec)              |
| Lower instalment                                                                                                  | Niži anuitet                                                       | Niža rata                                                           |
| The instalment stays the same. (equal principal: The share of principal stays, and the instalment keeps falling.) | Anuitet ostaje isti.                                               | Glavnica u svakoj rati ostaje ista, a rata se i dalje smanjuje.     |
| A new rate works the instalment out again. (equal principal: A new rate changes only the interest.)               | Nova stopa iznova izračunava anuitet.                              | Nova stopa mijenja samo kamatu, a glavnica u rati ostaje ista.      |
| then from €X a month, falling, N instalments to go                                                                |                                                                    | zatim od X mjesečno i sve manje, još N rata                         |
| Kuna takes the subsidy as this fixed amount, even as the instalment falls.                                        |                                                                    | Kuna subvenciju uzima kao ovaj fiksni iznos, iako se rata smanjuje. |
| Extra payment / Rate change / Shorter term                                                                        | Izvanredna uplata / Promjena kamatne stope / Kraći rok otplate     |                                                                     |
| Save this try                                                                                                     | Spremi izračun                                                     |                                                                     |
| Saved tries                                                                                                       | Spremljeni izračuni                                                |                                                                     |
| Against the loan as it stands, from today.                                                                        | U odnosu na kredit kakav je sada, od danas.                        |                                                                     |
| Nothing saved yet. Save a try above to keep it here.                                                              | Još ništa nije spremljeno. Spremite izračun iznad da ostane ovdje. |                                                                     |
| Rate 3% from (date)                                                                                               | Stopa 3 % od (datum)                                               |                                                                     |

The refusal for an unknown type goes in `workbook/domain/words.ts`. Cross-loan strings on the Overview (`overview/presentation/words.ts:159-229`) keep "anuitet" until the second open question is answered.

## Open

1. **How a shorter term is tried on a loan you have.** Say you try 15 years left in place of 20 on the sample's Home loan. Built as a move, Kuna drops the APN subsidy and the 2028 variable rate from that day and warns that the subsidy is paid back, so the try shows the wrong instalment and a false warning.
   - **Add a term change.** A new kind of scenario change (from a due date, instalments left) that keeps the subsidy and the loan's rate periods and recomputes the instalment or the share. Cost: one value in the change kind list, its reader, one input to `loanPlan`, an older app on another device listing such a try as unreadable until it updates.
   - **Build it as a move and refuse it where it misleads.** No new kind. Cost: no shorter term try on a subsidised loan or one with rate periods still to come, which is the sample's Home loan and most housing loans.
   - Recommendation: add a term change.
2. **The Croatian word where loans of both types sit together,** such as the Overview's interest definitions and the comparison's first row with offers of both types. Recommendation: "anuitet" while every loan in view is an annuity, "rata" once one is not.
3. **Savings rate and Extra you put in on Scenarios.** The owner's list of rows does not name them. This plan keeps both as rows that show only when they have a figure. Say if they should go.
4. **Editing a saved loan try.** The owner asked for what it saves and Delete. Old loan scenarios with several changes or a move cannot be edited after stage 4, only deleted. Say if Edit should stay.
5. **Unconfirmed against banks:** the rounding, the rate change and extra payment rules for equal principal, the word "rata", and how APN treats a falling instalment. One real equal principal plan from a bank would settle the first three.

## The owner's answers, 2026-11-03

Saved loan scenarios list on the loan's page with what they save and Delete, and new tries save there. Scenarios keeps to new loans and offers. Side by side first, the charts folded, then the list, with the cards and Against the base deleted. Each equal principal instalment rounded once. "Anuitet" on annuity loans, "rata" on equal principal ones. The APN subsidy stays the fixed amount typed, and the screen says so. One dialog with four fields and a closed More terms section, the name optional. The instalment leads the comparison, one card per scenario on a phone. The type is one optional field on `LoanTerms`, annuity when blank, written only for equal principal.

## The owner's answers on the open points, 2026-11-03

1. A shorter term on a loan you have is a new term change (from a due date, instalments left) that keeps the subsidy and the rate periods and works the instalment or the share out again. It joins stage 4, with its reader and a spec on the subsidised sample loan.
2. Where loans of both types sit together (the Overview, a mixed comparison), the Croatian word is always "rata". Only one annuity loan's own page and dialogs say "anuitet".
3. The savings rate line and Extra you put in stay as rows that show only when some column has a figure.
4. A saved try has Delete with Undo and no Edit. The editor's loan branch goes in stage 4.
