# Croatian d.o.o. preset plan

Build plan for a Croatian d.o.o. preset in the Company app: one cited tax class per category, an editor that refuses a category contradicting its class, a Croatian starting set with seeded state-payment rules for new books, and a one-time review of the owner's existing categories. Checked against Kuna at `0717599`.

The design comes from [the preset research](research/croatian-preset/preset.md), built to the owner's answers of 4 Nov 2026. Every `path:line` is against `0717599`. Paths under `packs/hr-doo/` mean `src/apps/company/packs/hr-doo/`. Every figure is made up.

## Summary

- Each category carries exactly one **tax class**, stored as one role in the existing `roles` column. The other roles stay as modifiers: `arrears`, `prepaid-annual`, `watched`, `owner-pay-tax` and `reimbursement`.
- Each class names the ruleset rules its figures come from, the VAT treatments and buckets it allows, and a heading in `docs/law/company/`. The percentages stay in the ruleset. A spec ties the doc's table to the ruleset.
- The categories editor gets a "Kuna counts it as" column. It offers only the VAT treatments and buckets the class allows, fills the VAT in when the class allows one, and refuses a saved change that contradicts the class.
- Screens say "Kuna counts this as", never "this is". The accountant keeps the books and makes the judgement calls.
- New books always start with the Croatian starting set, and with the state-payment rules of the Naputak for their year, cited in each rule's note and editable like any rule.
- The owner's categories move through a one-time review in the live books, carried out by the lead in the browser with the owner confirming each category. The editor is the only tool it needs.
- Three suspected bugs are reproduced first. Two become unreachable once VAT follows the class and a category has one class. The third, the forecast's representation, also needs the add-back selection to have one owner.
- Only the confirmed review moves figures. Classes, guards and the starting set leave every figure of existing books identical.

## Module map

### What the preset owns

The preset is a feature folder of the hr-doo pack, `packs/hr-doo/preset/`, beside `ruleset/`.

| File                                       | Holds                                                                                                                                     |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `preset/domain/taxClasses.ts`              | `TAX_CLASSES`: per class its role, ruleset rule ids, allowed VAT treatments, allowed buckets and the `docs/law/company/` anchor           |
| `preset/domain/taxClassOf.ts`              | The class a category carries, the VAT treatment Kuna counts it with, and the problems of a category that has none, two or a contradiction |
| `preset/domain/startingCategories.ts`      | The Croatian starting set                                                                                                                 |
| `preset/domain/startingRules.ts`           | The state-payment rules for a year, from the ruleset's revenue codes and `CONTRIBUTION_ACCOUNTS`                                          |
| `preset/presentation/classWords.ts`        | Each class's name and "Kuna counts this as" sentence in English and Croatian, and its link to Settings, Tax rules                         |
| `preset/presentation/categoryClassHelp.ts` | The pack slot the editor reads those through                                                                                              |

`PACK_ROLES` (`packs/hr-doo/domain/packRoles.ts:6-32`) stays the one place a role is spelled. It gains the four new roles, and `taxClasses.ts` refers to its constants. There is one list of role names, not two.

### What depends on what

- The preset imports the ruleset for rule ids and the revenue codes. **The ruleset never imports the preset.** The new revenue-code rule is a law value, so it lives in the ruleset like every other dated value.
- The pack's figures (`accrualBookings.ts`, `accrualYear.ts`, `forecastYear.ts`) read the class through `taxClassOf.ts` from stage 4 on.
- Core gets generic slots and no Croatian knowledge:
  - `PackPart.categoryClasses: readonly CategoryClass[]`, where `CategoryClass` is `{ role, vat: readonly VatTreatment[], buckets: readonly DefinedBucket[] }`, beside `categoryRoles` (`src/apps/company/workbook/domain/packPart.ts:51-52`).
  - `PackPart.startingCategories` and `PackPart.startingRules(on: CivilDate)`, read by `emptyWorkbookTabs`.
  - `PackContribution.categoryClassHelp(role)`, returning a name, a sentence and a link, or null. It follows `costGroupLinks` (`src/apps/company/packs/packContribution.ts:75`), and `NO_PACK` (`:81-93`) returns null.
  - The class guards live in core's `settings/domain`, written against `CategoryClass` without naming any class.

### What it shares with nothing

The planned spending app's categories are a two-level tree for the owner's habits. They change when groceries split in two. The preset changes when ZPD, ZPDV, PravPDoh or the Naputak change. The two change for different reasons, so they share no code, no class and no seed. The class table is not a category tree and does not go to `src/shared`. The seeded state rules are ordinary company rules rows. The planned `src/shared/categorising` ([module map](../../architecture/modules.md#extractions-planned-for-spending)) moves the matching engine only and never sees a class.

### Boundary spec cases

New cases in `tests/importBoundaries.spec.ts`:

1. **The ruleset stays off the preset.** No file under `packs/hr-doo/ruleset/` imports `packs/hr-doo/preset/`.
2. **The preset's rules are domain code.** Every file of `packs/hr-doo/preset/` outside `presentation/` sits under `domain/`. `isDomain` (`:87-89`) then covers it unchanged, and the domain rule (`:164-172`) keeps it off presentation and Vue.
3. **The new class names have one home.** `linesHolding` (`:63-69`) finds the quoted strings `'deductible-cost'`, `'other-income'`, `'outside-profit'` and `'vehicle-insurance-and-interest'` in no file but `packRoles.ts` and the fake seeds.
4. **Core names no pack role.** After stage 3 deletes core's generic seed, no file of `src/apps/company` outside `packs/` and the fake seeds holds a quoted value of `PACK_ROLES`, except `'revenue'`, which core's `RECEIVABLE_ROLES` also spells (`src/apps/company/receivables/domain/invoiceMatching.ts:11-14`).

The existing rule that a pack imports only its own folder, its app and `src/shared` (`:151-162`) already keeps the preset inside the pack.

## The tax classes

The scope is what Kuna computes today, plus car insurance and interest split out of running costs. Every category needs exactly one class, so three classes name what Kuna already does with a category that has no add-back role: count it as an ordinary cost, as other income, or outside profit. They change no figure.

| Class                            | New | Kuna counts it as                                              | VAT it allows                                                                                       | Buckets              | Rules                                                                          |
| -------------------------------- | --- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------ |
| `revenue`                        |     | Sales revenue, from invoices by delivery                       | `none`                                                                                              | income               | `hr.cit.base`, `hr.cit.rate-test-revenue`, `hr.acc.accrual-basis`              |
| `client-refund`                  |     | A refund of sales                                              | `none`                                                                                              | income               | `hr.cit.base`                                                                  |
| `grant`                          |     | A grant, income as it is used                                  | `none`                                                                                              | income               | `hr.acc.grant-recognition`, `hr.cit.grant-revenue`                             |
| `other-income`                   | yes | Other operating income                                         | `none`                                                                                              | income               | `hr.cit.base`                                                                  |
| `deductible-cost`                | yes | A cost the profit tax allows                                   | `deductible-25`, `deductible-13`, `deductible-5`, `reverse-charge`, `foreign-vat`, `none`           | operating, taxes     | `hr.cit.base`, `hr.vat.input-deduction`, `hr.vat.reverse-charge`               |
| `representation`                 |     | Representation, half added back, no VAT back                   | `representation`                                                                                    | operating            | `hr.cit.representation-add-back`, `hr.vat.input-deduction`                     |
| `personal-transport`             |     | Personal car running costs, half added back, half the VAT back | `car-50`, `foreign-vat`                                                                             | operating            | `hr.cit.personal-transport-add-back`, `hr.vat.input-deduction`                 |
| `vehicle-insurance-and-interest` | yes | Car insurance and loan interest, allowed, no VAT               | `none`                                                                                              | operating            | `hr.cit.personal-transport-add-back`, `hr.cit.base`                            |
| `non-deductible`                 |     | Fines and private costs, all added back                        | `none`                                                                                              | operating, taxes     | `hr.cit.fines-add-back`, `hr.cit.private-cost-add-back`                        |
| `capital-purchase`               |     | An asset above the threshold, depreciated                      | `deductible-25`, `deductible-13`, `deductible-5`, `car-50`, `reverse-charge`, `foreign-vat`, `none` | operating            | `hr.acc.capitalisation`, `hr.cit.asset-threshold`                              |
| `corporate-income-tax`           |     | Profit tax paid or refunded, not a cost                        | `none`                                                                                              | taxes                | `hr.cit.balance-due`, `hr.cit.monthly-advance`                                 |
| `vat-settlement`                 |     | VAT paid or refunded, not a cost                               | `none`                                                                                              | operating, taxes     | `hr.vat.credit`                                                                |
| `profit-distribution`            |     | A profit payout or the tax withheld on it, not a cost          | `none`                                                                                              | owner-pay, taxes     | `hr.ztd.distributable-profit`, `hr.pit.dividend`                               |
| `salary`                         |     | An employee's net salary                                       | `none`                                                                                              | owner-pay            | `hr.contrib.rates`, `hr.pit.brackets`                                          |
| `tax-free:*`                     |     | One tax-free payment, one class per payment                    | `none`                                                                                              | owner-pay            | `hr.pit.nontaxable-caps`                                                       |
| `owner-rent`                     |     | Rent paid to the owner                                         | `none`                                                                                              | owner-pay            | `hr.pit.rent`                                                                  |
| `owner-benefit`                  |     | The owner's private share of company costs                     | `none`                                                                                              | owner-pay            | `hr.pit.hidden-distribution`, `hr.cit.private-cost-add-back`                   |
| `owner-loan-out`                 |     | A loan to the owner                                            | `none`                                                                                              | owner-pay, financing | `hr.cit.related-party-rate`, `hr.pit.loan-benefit`, `hr.ztd.sole-member-deals` |
| `owner-loan-repaid`              |     | The owner repaying a loan                                      | `none`                                                                                              | owner-pay, financing | `hr.cit.related-party-rate`                                                    |
| `outside-profit`                 | yes | Outside profit: transfers, bank loans, capital, reimbursements | `none`                                                                                              | financing, neutral   | `hr.cit.base`                                                                  |

How the table was set:

- **Representation and the car** follow ZPD Art. 7(1)(3), 7(1)(4) and 7(3), and ZPDV Art. 61(1) and 61(2). `foreign-vat` is allowed on a car cost because VAT paid abroad is never reclaimed in Croatia, which `vatSplit` already counts as a cost (`packs/hr-doo/domain/vat/vatSplit.ts:41-42`).
- **Car insurance and interest** sit outside the ZPD Art. 7(1)(4) add-back ("osim troškova osiguranja i kamata"). Insurance and credit are exempt from VAT under ZPDV Art. 40(1)(a) and (b), so the class allows only `none`. No code reads the new role, so Kuna counts it as an ordinary cost, which is what the law asks.
- **Owner pay tax is a modifier, not a class.** The dividend tax carries `owner-pay-tax, profit-distribution` (`src/apps/company/workbook/infrastructure/fake/fakeWorkbook.ts:48`), and the code reads that pair (`packs/hr-doo/domain/packRoles.ts:51-60`, `:73-75`, `packs/hr-doo/domain/ownerCost.ts:32`). Making `owner-pay-tax` a modifier that says "count it in the owner's cost" keeps one class per category with no code change. Payroll taxes become `deductible-cost` with `owner-pay-tax`, which is how the profit tax treats them.
- **Loans allow both buckets**, since Settings' loan switch writes them through the same guard (`packs/hr-doo/presentation/LoanBucketSwitch.vue:25-27`, `:34-38`).
- **VAT settlement allows operating and taxes.** Today's books keep a VAT refund in operating (`fakeWorkbook.ts:159`), and the accrual takes it out whatever the bucket (`packs/hr-doo/domain/accrual/accrualBookings.ts:90-99`). Allowing both moves no figure.

## The three suspected bugs

Read from the code. Stage 0 reproduces each one before anything else is built. The figures below are worked out by hand from the `exampleStudio` fixture (`tests/fixtures/exampleStudio.ts:26-45`, `:60-66`) and the 2025 totals its spec asserts (`tests/accrualYear.spec.ts:37-67`).

### 1. Reclaimed VAT on representation

A representation category set to `deductible-25` splits 80.00 into a cost of 64.00 and 16.00 of input VAT (`vatSplit.ts:45-52`). The year's input VAT counts the 16.00 as a claim on the state (`packs/hr-doo/domain/accrual/accrualYear.ts:200-204`), and the cost line keeps only 64.00 (`:250-265`). The add-back puts the 16.00 back into the representation figure (`:304-313`), so the add-back is right at 40.00, but profit before tax is 16.00 too high.

- **Expected in the fixture:** input VAT 707.25 in place of 691.25, material costs 602.25 in place of 618.25, profit before tax 8,897.70 in place of 8,881.70.
- **What the preset does:** the editor refuses the contradiction, and from stage 4 Kuna counts a category with the VAT its class allows (`taxClassOf.ts`, called in `vatSplit` at `vatSplit.ts:35`). A representation category then never splits VAT, wherever its VAT cell says otherwise.
- **What still needs its own fix:** nothing. The VAT put back at `accrualYear.ts:306-313` becomes zero for every category, so stage 4 deletes it.

### 2. Representation and non-deductible on one category

`representationOurs` selects by the `representation` role (`accrualYear.ts:304-313`) and `costOfRole` by `non-deductible` (`:315-320`, `:328`). A category with both is added back at 50% and again at 100%.

- **Expected in the fixture:** with `representation` given both roles, the 2025 increases (PD line 26) are 80.00 higher than with one.
- **What the preset does:** the editor refuses a second class, the read reports one, and from stage 4 the add-backs select through `taxClassOf.ts`, which gives a category one class, the first its roles list. A hand-edited file can no longer add one cost back twice.
- **What still needs its own fix:** nothing beyond the stage 4 selection.

### 3. The forecast's representation

The forecast adds back the plain role total of its lines (`packs/hr-doo/domain/forecast/forecastYear.ts:337-349`). Its lines hold each booking's cost net of deductible VAT (`accrualBookings.ts:163-172`, `forecastYear.ts:662-665`), while the accrual puts the VAT back.

- **Expected in the fixture:** with `deductible-25` on representation, the forecast of 2025 adds back 32.00 and the accrual 40.00. With `representation` VAT both add back 40.00, so the gap needs a contradiction.
- **What the preset does:** once VAT follows the class, the two agree on every category.
- **What still needs its own fix:** the rule "which categories feed which add-back" is computed in two places, `accrualYear.ts:304-320` and `forecastYear.ts:337-349`. Stage 4 gives it one owner: both select through `taxClassOf.ts`, and each still sums its own figures, since one reads the ledger and the other the forecast lines. The accountant-booked judgement (`packs/hr-doo/domain/accrual/closedYear.ts:116`) stays in the accrual, where the year-end lines are.

## Stages

One commit per stage, each checked with `npm run check`, both builds, `check:figures` on every fake set and the owner's export, and the targeted visual and touch checks. Locally the visual check runs `--widths 360,640,1024`, and CI runs all nine. The touch check runs at 360 and 430 px (`scripts/touch-check.mjs:197`).

### 0. Reproduce the bugs

- Changed: `tests/accrualYear.spec.ts`, two cases on `exampleStudio` with the `representation` category changed:
  - with `deductible-25`: profit before tax is 8,881.70 and input VAT 691.25, as with `representation` VAT.
  - with roles `representation, non-deductible`: the increases equal those of the unchanged fixture.
- Changed: `tests/forecastYear.spec.ts`: with `deductible-25`, the forecast of 2025 seen after its year end adds back the same representation as `accrualYear` for 2025.
- Each case is written as `it.fails` with the right figure, so CI stays green and the case fails loudly the day the bug goes. Stage 4 turns each into `it`.
- If a case passes as written, the bug is not there. The plan then drops that bug's fix and says so in the commit.
- No source change. `check:figures` identical everywhere.

### 1. Classes and their law docs

- New: `packs/hr-doo/preset/domain/taxClasses.ts`, the table above, with `law` anchors such as `company/tax-classes.md#representation`. `tax-free:*` is one entry made from `TAX_FREE_ROLES` (`packRoles.ts:42`).
- Changed: `packs/hr-doo/domain/packRoles.ts`: `deductibleCost`, `otherIncome`, `outsideProfit` and `vehicleInsuranceAndInterest`. They reach `categoryRoles` through `hrDooPart.ts:83` with no change there, so Settings accepts them.
- New: `docs/law/company/`, each file with the law README's frontmatter and shape:
  - `tax-classes.md`, a heading per class with its citation and its "Kuna counts this as" reading, and a table under "Classes" with the columns `Class | CIT add-back | Input VAT back | VAT treatments | Buckets | From`.
  - `state-payments.md`, the Naputak's revenue codes, model HR68 and the contribution accounts, with a table under "Revenue codes" (`Year | Payment | Code | Model | Category`). Stage 3 fills it.
  - `books-and-kontos.md`: ZoR Art. 11 and 16(2), why Kuna ships no chart of accounts, and what the accountant decides.
- Moved: the Investments law files go to `docs/law/investments/` in the same commit: `capital-gains.md`, `filing-calendar.md`, `foreign-capital-income.md`, `hnb-rates-and-settlement.md`, `joppd-for-investors.md` and `other-investment-income.md`. `sources/` stays at the root, shared by both, and the moved files' links to it gain `../`.
  - Changed: the 35 `law` paths of `TAX_RULES` (`src/apps/investments/tax/domain/taxRules.ts:17` on) gain `investments/`.
  - Changed: `tests/lawDocs.spec.ts`: the five `tableUnder` and `screenSentenceOf` file names (`:111-144`) gain `investments/`.
  - Changed: `docs/law/README.md`: titled "Croatian law for Kuna", its intro covers both apps, its table of files points into the two folders, and "Tied to the code" names both specs. `npm run law-index` regenerates the index. `scripts/law-index.mjs` already recurses (`:18-26`) and groups by folder (`:66-80`), so it needs no change. Its "Rules" heading for root files goes away with them.
  - Every other link into the moved files is swept with a grep over `docs/`, `README.md` and `src`. The link case (`tests/lawDocs.spec.ts:146-160`) covers `docs/law`, and the docs index spec covers the rest.
- Changed: `tests/lawDocs.spec.ts` gains a `describe('company law docs')`:
  - each class's `law` names a file and heading that exist, as `:95-100` does for `TAX_RULES`
  - the "Classes" table has one row per class and no other
  - each row's add-back equals `ruleValue(<add-back rule>, <From>).value.addBackShare` and is `0%` for a class with none
  - each row's input VAT back follows from its VAT treatments and `hr.vat.input-deduction` on `From`: `0%` for `representation`, `personalCarDeductibleShare` for `car-50`, `100%` for a deductible rate, and `none` for a class that carries no VAT
  - each row's VAT treatments and buckets equal the class's
- Specs: `tests/taxClasses.spec.ts`: every class's rule ids exist in `RULES`, every role is a known role, no two classes share a role, and every allowed VAT treatment and bucket is one core knows.
- `check:figures`: every group identical on every fake set and the owner's export. No code reads the table yet.
- Visual and touch: none. No screen changes.
- New strings: none on screen.

### 2. The editor's guards

- Changed: `src/apps/company/workbook/domain/packPart.ts`: `CategoryClass` and `PackPart.categoryClasses`.
- Changed: `src/apps/company/packs/packContribution.ts`: `categoryClassHelp(role)` and its `NO_PACK` answer.
- Changed: `packs/hr-doo/domain/hrDooPart.ts`: `categoryClasses` from `TAX_CLASSES`, and `assemble` (`:84-115`) adds `tabProblems('categories', classProblems(core.categories))`. Kuna's figures still follow the stored VAT in this stage, so the problems say what to change and not what Kuna does instead.
  - one line naming every category with no class
  - one line per category with two classes, a VAT treatment its class does not allow, or a bucket its class does not allow
- New: `packs/hr-doo/preset/domain/taxClassOf.ts` and `packs/hr-doo/preset/presentation/classWords.ts`, `categoryClassHelp.ts`. Changed: `packs/hr-doo/hrDooPack.ts:23-52`: the new slot.
- Changed: `src/apps/company/settings/domain/categoryDrafts.ts`. `categoryDraftErrors` (`:77-123`) takes the classes and checks rows that are added or changed. Its errors are whole-tab today, so checking untouched rows would block every save until the review is done. An untouched row with no class or a contradiction gets a hint instead, and the read reports it.
  - a row with no class: "Pick how Kuna counts this category."
  - two classes, a VAT treatment or a bucket the class does not allow: one error each, on that field
- Changed: `src/apps/company/settings/domain/categoryGuards.ts`: `categoryClassRefusals(edits, classes)`, beside `categoryShareRefusals` (`:75-101`). It refuses an edit that changes roles, VAT or bucket and leaves the category with no class, two classes, or a VAT treatment or bucket its class does not allow.
- Changed: `src/apps/company/settings/application/namedRecordWrites.ts:115-125`: calls it with the other refusals. Undo skips them, as it skips the role and share guards today, so Undo can put a contradiction back. The read then reports it.
- Changed: `src/apps/company/settings/presentation/CategoriesEditor.vue`:
  - A **Kuna counts it as** column before Roles, a select of the classes whose buckets hold the row's bucket. Under it the class's sentence and a link to its rule on Settings, Tax rules, from `categoryClassHelp`.
  - Picking a class writes its role into the roles text in place of any other class, and keeps the modifiers.
  - The VAT select (`:256-263`) offers only the class's treatments (`vatItems`, `:101`). With one it is filled in and disabled, with "Set by how Kuna counts it" under it.
  - The bucket select (`:228-236`) offers only the class's buckets (`bucketItems`, `:100`).
  - `RolesSelect` (`:251`) lists the modifiers only.
  - An untouched row with no class shows "Not classified yet. Kuna counts it by its bucket and VAT until you pick."
- Changed: `src/apps/company/settings/presentation/CategoriesSettingsTab.vue:34`, `:89`: passes the classes beside the roles. The card's subtitle gains the accountant line.
- Specs:
  - `tests/categoryChange.spec.ts` and `tests/categoryChanges.spec.ts`: the class refusals, the untouched-row rule, Undo letting a contradiction back, and the loan switch moving a loan category between owner-pay and financing.
  - New `tests/taxClassOf.spec.ts`: one class, none, two (the first in the roles list wins), and each contradiction gives its problem line.
  - Every spec that saves a category through `CATEGORY_WRITES` gives it a class.
- `check:figures`: every figure group identical on every fake set and the owner's export. `settings.problems` (`scripts/figure-digest.mjs:221`) moves, since the fake sets and the owner's books have no classes yet. Its new lines are listed in the commit.
- Visual, at 360, 640 and 1024 px:
  - `company-settings-categories` and its Croatian twin (`scripts/visual-check.mjs:1002-1020`) show the new column and the "Not classified yet" hints. Their `shows` gain "Kuna counts it as" and "Kuna to broji kao".
  - `company-settings` shows the problems card open with the class lines.
  - The `categories` flow (`scripts/support/editorFlows.mjs:370-420`) adds stationery with no class and gives it `representation` while its VAT is `none`. It changes to pick `deductible-cost` for stationery, then switch it to `representation` and read the VAT select filled in and disabled. New shots: `categories-class` and `categories-class-vat-locked`.
- Touch, at 360 and 430 px (`scripts/touch-check.mjs:1147`, `:1177`):
  - In the categories flow, tap the new row's "Kuna counts it as" select and pick deductible cost, save, and read the toast.
  - Pick representation, read the VAT select disabled at Representation, and open the bucket menu to find only Operating.
  - Change the bucket of a representation row to Taxes and read the field error.
  - Undo each save.
  - The select is at least 44 px tall.

New strings:

| English                                                                                               | Croatian                                                                                                      |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Kuna counts it as                                                                                     | Kuna to broji kao                                                                                             |
| Pick how Kuna counts it                                                                               | Odaberite kako je Kuna broji                                                                                  |
| Pick how Kuna counts this category.                                                                   | Odaberite kako Kuna broji ovu kategoriju.                                                                     |
| Not classified yet. Kuna counts it by its bucket and VAT until you pick.                              | Još nije razvrstano. Kuna je broji po skupini i PDV-u dok ne odaberete.                                       |
| Kuna counts a category one way, and this one has {classes}.                                           | Kuna kategoriju broji na jedan način, a ova ima {classes}.                                                    |
| Kuna counts {class} with {treatments} only.                                                           | Kuna {class} broji samo uz {treatments}.                                                                      |
| Kuna counts {class} in {buckets} only.                                                                | Kuna {class} broji samo u skupini {buckets}.                                                                  |
| Set by how Kuna counts it                                                                             | Određeno time kako je Kuna broji                                                                              |
| The accountant keeps the books and decides each booking. Kuna uses these classes for its estimates.   | Knjige vodi računovođa i on odlučuje o svakom knjiženju. Kuna ove porezne tretmane koristi za svoje procjene. |
| {n} categories have no tax class yet: {names}. Pick one for each on Settings, Categories.             | {n} kategorija još nema porezni tretman: {names}. Odaberite ga za svaku u Postavkama, Kategorije.             |
| Kuna counts "{slug}" as {class}, but its VAT reads {vat}. Change one of them on Settings, Categories. | Kuna "{slug}" broji kao {class}, ali PDV glasi {vat}. Promijenite jedno od toga u Postavkama, Kategorije.     |
| Kuna counts {class} in {buckets}, and "{slug}" sits in {bucket}.                                      | Kuna {class} broji u skupini {buckets}, a "{slug}" je u skupini {bucket}.                                     |
| Rule on Tax rules                                                                                     | Pravilo u Poreznim pravilima                                                                                  |

The class names and sentences, with `{share}` and `{vatShare}` read from the ruleset on the newest booking's day:

| Class                            | English                                                                | Croatian                                                                            |
| -------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `revenue`                        | Sales revenue                                                          | Prihod od prodaje                                                                   |
| `client-refund`                  | A refund of sales                                                      | Povrat prodaje                                                                      |
| `grant`                          | A grant, income as it is used                                          | Potpora, prihod kako se troši                                                       |
| `other-income`                   | Other income                                                           | Ostali prihod                                                                       |
| `deductible-cost`                | A cost the profit tax allows                                           | Trošak koji porez na dobit priznaje                                                 |
| `representation`                 | Representation: {share} added back to the profit tax base, no VAT back | Reprezentacija: {share} se dodaje poreznoj osnovici, bez odbitka PDV-a              |
| `personal-transport`             | Personal car costs: {share} added back, {vatShare} of the VAT back     | Troškovi osobnog automobila: {share} se dodaje osnovici, odbija se {vatShare} PDV-a |
| `vehicle-insurance-and-interest` | Car insurance and loan interest: allowed, no VAT                       | Osiguranje i kamate za automobil: priznato, bez PDV-a                               |
| `non-deductible`                 | Fines and private costs: all added back                                | Kazne i privatni troškovi: sve se dodaje osnovici                                   |
| `capital-purchase`               | An asset above {threshold}, depreciated                                | Imovina iznad {threshold}, amortizira se                                            |
| `corporate-income-tax`           | Profit tax paid or refunded, not a cost                                | Plaćeni ili vraćeni porez na dobit, nije trošak                                     |
| `vat-settlement`                 | VAT paid or refunded, not a cost                                       | Plaćeni ili vraćeni PDV, nije trošak                                                |
| `profit-distribution`            | A profit payout or its tax, not a cost                                 | Isplata dobiti ili porez na nju, nije trošak                                        |
| `salary`                         | An employee's net salary                                               | Neto plaća zaposlenika                                                              |
| `tax-free:*`                     | Tax-free payment: {payment}                                            | Neoporezivi primitak: {payment}                                                     |
| `owner-rent`                     | Rent paid to the owner                                                 | Najamnina plaćena vlasniku                                                          |
| `owner-benefit`                  | The owner's private share of company costs                             | Vlasnikov privatni dio troškova tvrtke                                              |
| `owner-loan-out`                 | A loan to the owner                                                    | Zajam vlasniku                                                                      |
| `owner-loan-repaid`              | The owner repaying a loan                                              | Vlasnik vraća zajam                                                                 |
| `outside-profit`                 | Outside profit: transfers, loans and capital                           | Izvan dobiti: prijenosi, zajmovi i kapital                                          |

### 3. The Croatian starting set and seeded rules

- New: `packs/hr-doo/preset/domain/startingCategories.ts`, spelled with `PACK_ROLES` constants:

| Family    | Bucket    | Categories, with class, modifiers and VAT                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| income    | income    | `revenue` revenue, `grant-income` grant, `client-refund` client-refund, `other-income` other-income, `interest-income` other-income                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| operating | operating | `software-subscriptions` deductible-cost reverse-charge, `equipment` capital-purchase deductible-25, `contractors` deductible-cost deductible-25, `accounting-and-legal` deductible-cost watched deductible-25, `office-rent` deductible-cost arrears deductible-25, `office-supplies` deductible-cost deductible-25, `telecom` deductible-cost deductible-25, `travel` deductible-cost, `representation` representation representation, `car-costs` personal-transport car-50, `car-insurance-and-interest` vehicle-insurance-and-interest, `insurance` deductible-cost prepaid-annual, `training` deductible-cost deductible-25, `marketing` deductible-cost deductible-25, `bank-fees` deductible-cost, `fines` non-deductible, `other-costs` deductible-cost |
| taxes     | taxes     | `vat` vat-settlement, `corporate-income-tax` corporate-income-tax, `payroll-contributions` deductible-cost owner-pay-tax watched arrears, `payroll-tax` deductible-cost owner-pay-tax arrears, `dividend-tax` profit-distribution owner-pay-tax, `local-fees` deductible-cost                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| owner     | owner-pay | `salary-net` salary arrears, `dividend` profit-distribution, `rent-owner` owner-rent watched arrears, `benefits-from-company-costs` owner-benefit                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| financing | financing | `owner-loan-out` owner-loan-out, `owner-loan-repaid` owner-loan-repaid, `loan-received` outside-profit, `loan-repayment` outside-profit, `reimbursement-to-owner` outside-profit reimbursement, `reimbursement-from-owner` outside-profit reimbursement                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| neutral   | neutral   | `internal-transfer` outside-profit, `share-capital` outside-profit                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

A VAT left out is `none`. A deductible rate is the supplier's fact, so the owner changes it per category. Colours are the generic seed's per family (`src/apps/company/workbook/infrastructure/emptyWorkbook.ts:17-70`).

- New rule in the ruleset: `hr.state.revenue-codes` in `packs/hr-doo/ruleset/rules/state-payments.ts`, a new area `state-payments` (`packs/hr-doo/ruleset/schema.ts:122`), with a 2026 version citing a new act `Naputak2026` (`ruleset/acts.ts:3-35`): VAT 1201, profit tax 1651, pension pillar I 8168, each with model HR68. The codes stay in the ruleset as dated law values and show on Settings, Tax rules. A new Naputak is a new version.
- New: `packs/hr-doo/preset/domain/startingRules.ts`. `startingRules(on)` gives `review`-confidence rules (`src/shared/categorising/domain/rule.ts:4`) for the version in force on `on`, each with `direction: debit`. The note reads, for example, "Naputak 2026 (NN 18/26): VAT, revenue code 1201, model HR68".
  - `revenue_code` 1201 files to `vat`
  - `revenue_code` 1651 files to `corporate-income-tax`
  - `revenue_code` 8168 files to `payroll-contributions`
  - `counterparty_iban` of pillar II and of health insurance from `CONTRIBUTION_ACCOUNTS` (`packs/hr-doo/domain/salaries/contributionAccounts.ts:7-11`) file to `payroll-contributions`. Pillar I shares the state budget's account with VAT and profit tax, so it goes by its code.
- Changed: `src/apps/company/workbook/domain/packPart.ts`: `startingCategories` and `startingRules(on)`. Changed: `packs/hr-doo/domain/hrDooPart.ts`: both.
- Changed: `src/apps/company/workbook/infrastructure/emptyWorkbook.ts`:
  - `emptyWorkbookTabs` (`:90-110`) takes the categories and the rules for the day from `installedPack().workbook`.
  - `DEFAULT_CATEGORIES` (`:17-70`) is deleted. The pack is always installed, in the app (`src/apps/company/app.ts:47`) and in the tests (`tests/setup/installPack.ts`), so nothing would read it. Without a pack, new books start with no categories, as every other `NO_PACK` slot answers nothing.
  - `DEFAULT_CATEGORY_NAMES` (`:73`) becomes the names of the installed pack's set.
- Changed: `src/apps/company/workbook/presentation/workbookFiles.ts:94-96` passes the day from `savedAt`. `categoriesAsNewBooksStart` (`:99-102`) compares with the new names, so the onboarding line (`src/apps/company/onboarding/presentation/gettingSetUp.ts:29`) shows for the Croatian set untouched.
- Changed: `src/apps/company/workbook/domain/words.ts:37-77`: Croatian names for the new slugs, for example `car-costs` "Troškovi automobila", `car-insurance-and-interest` "Osiguranje i kamate za automobil", `fines` "Kazne", `dividend-tax` "Porez na dividendu", `share-capital` "Temeljni kapital". Names of slugs that left the seed are deleted, such as `client-meals`, `owner-drawings` and `owner-capital`.
- Changed: `docs/law/company/state-payments.md` fills its "Revenue codes" table. `tests/lawDocs.spec.ts` checks it against `ruleValue('hr.state.revenue-codes', <1 January of the year>)`.
- Specs:
  - `tests/workbookFile.spec.ts` (`:42`, `:109`), `tests/templateDownload.spec.ts:46` and `tests/newBooks.spec.ts`: new books and the template hold the Croatian set and the year's rules, and read back with no problem, so no starting category contradicts its class.
  - `tests/croatianSentences.spec.ts:178-188`: every seeded slug and family has a Croatian name, `marketing` still the one that reads the same.
  - `tests/ruleset.spec.ts`: the new rule and act.
  - `tests/startingRules.spec.ts`: a 2026 day gives the five rules, and a 2027 day gives the 2026 version until a 2027 one exists.
  - `tests/onboarding.spec.ts`: the categories line on untouched new books.
- `check:figures`: every group identical on every fake set and the owner's export. Only new books change.
- Visual, at 360, 640 and 1024 px: `company-settings-categories-browser` and its Croatian twin (`scripts/visual-check.mjs:1222-1223`) on `?fake=browser` show the Croatian set. The onboarding pages that end on new books show it too. `company-settings-category-rules` on new books shows the five state rules.
- Touch: none new. The onboarding flow already lands on new books.
- New strings: the category names above. The rule notes stay in English, as rule notes are the owner's text once seeded.

### 4. The migration review in the owner's books

The review needs only stages 1 and 2, so it can run as soon as stage 2 is live. The app needs no migration screen. The editor's class column, its hints and the read's problem lines carry it, and so do two existing tools: Transactions' change of category for moving rows, and Settings, Category rules for the state rules. One thing is not checked: whether Transactions moves many rows to another category in one step. Without it, rows move one by one, which suits the handful a car category holds.

#### First, a digest that sees figures and not roles

`check:figures` hashes whole objects (`scripts/figure-digest.mjs:532-549`), and the accrual and forecast results hold `Category` records (`accrualYear.ts:68`, `packs/hr-doo/domain/forecast/forecastLines.ts:53-54`). Adding a class to a category would move `year.<year>.accrual` and `year.<year>.forecast` even when no figure moves. Before the review, `digestOf` hashes a category record by its slug, bucket, VAT and owner share only. That commit moves no figure but changes those groups' hashes once, so before and after are both taken with the new script.

#### What the lead does in the live books

1. Exports the books from Settings, Books file, to a folder outside the repository, and runs `npm run check:figures -- --workbook <export> --today <a fixed day>` for the before digest.
2. Opens Settings, Categories and builds the review table with the owner, one row per category: its name, roles, VAT and bucket now, the suggested class, the VAT and bucket that class leaves, and which figures the change would move.
   - A category that already carries a class role keeps it. A dividend tax with `owner-pay-tax, profit-distribution` keeps both and changes nothing, since `owner-pay-tax` is a modifier.
   - A category with two classes: the owner picks one.
   - A category with none:
     - income bucket: `other-income`
     - operating or taxes: `deductible-cost`
     - financing or neutral: `outside-profit`
     - owner-pay: the owner picks `salary`, a `tax-free:*` payment or `owner-rent`
   - A name that matches the starting set's car, fines or representation categories gets that set's class as the suggestion.
   - A refund of tax goes with the tax it refunds. A profit tax refund is `corporate-income-tax`, and a refund of a deductible tax is `deductible-cost`.
   - A VAT or bucket the class does not allow gets the class's.
3. The owner confirms or changes each row. Only then does the lead type them into the editor, and one Save writes them all, with one Undo.
4. For each `personal-transport` category, the lead lists its rows by payee. With the owner confirming, insurance and loan-interest rows move to a new `car-insurance-and-interest` category, and any rule that files them is pointed there.
5. With the owner confirming each one, the lead adds the stage 3 state rules on Settings, Category rules, skipping any the books already have.
6. Exports again and runs the after digest with the same `--today`.

Nothing is written before step 3's Save, and nothing in steps 4 and 5 before the owner says yes to that row or rule.

#### The digest groups to compare

| Group                                                                                           | After the review                                                                                                       |
| ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `read.records`, `read.workbook`                                                                 | Move. The category rows changed.                                                                                       |
| `settings.problems`                                                                             | Moves. The class lines are gone.                                                                                       |
| `review.queue`, `review.rules`                                                                  | Move only if state rules were added                                                                                    |
| `year.<year>.accrual`, `year.<year>.taxes`, `year.<year>.forecast`, `year.<year>.pay-scenarios` | Move only where a category gained or lost an add-back class, a VAT treatment changed, or rows moved off a car category |
| `owner.<period>.*`                                                                              | Move only where an owner-pay category changed class or bucket                                                          |
| `overview.*`, `analysis.<period>.*`, `transactions.<period>.*`                                  | Move only where a bucket changed or rows moved                                                                         |
| Every other group                                                                               | Identical                                                                                                              |

Each moved figure group is matched to a confirmed row of the review table. A group that moves without one stops the review and is undone. For a closed year, the Year screen's year-end comparison then sets Kuna's figures beside the accountant's PD, and the accountant's figure wins.

#### The code that follows the review

- Changed: `packs/hr-doo/domain/vat/vatSplit.ts:35`: the treatment comes from `taxClassOf.ts`, so a category with a VAT its class does not allow counts with the class's first treatment. Bug 1 goes.
- Changed: `accrualYear.ts:304-320` and `forecastYear.ts:337-349`: both select the add-back categories through `taxClassOf.ts`. The VAT put back at `accrualYear.ts:306-313` is deleted, and so is the comment that explains it. Bugs 2 and 3 go.
- Changed: `packs/hr-doo/domain/hrDooPart.ts`: the problem lines say what Kuna now does: "…so Kuna uses {treatment}" and "…so Kuna counts it as {class}".
- Changed: the fake books (`fakeWorkbook.ts:41-62`, `:70-80`) take the classes the review would give them, so the fake mirrors classified books. Most add no figure change. Two do, and their groups are listed in the commit:
  - `salary-bonus` becomes `tax-free:results-bonus`, which moves the salary reconciliation.
  - `tax-refund` becomes `corporate-income-tax`, which takes the refund out of profit.
- Changed: `tests/fixtures/exampleStudio.ts` and `tests/fixtures/hrDooCategories.ts` take classes where their specs save categories.
- Specs: the three stage 0 cases turn from `it.fails` to `it`. `tests/vatSplit.spec.ts` gains a representation category stored with `deductible-25`.
- `check:figures`: identical in every group on the reviewed export, since it has no contradiction left. On the fake sets, only the groups the fake's classes move.
- Visual, at 360, 640 and 1024 px: `company-settings-categories` and its Croatian twin show every row classified and no hints. `company-settings` shows the problems card closed. `year-taxes` and its twin keep their figures.
- Touch: none new.
- New strings: the problem endings "so Kuna uses {treatment}" ("pa Kuna koristi {treatment}") and "so Kuna counts it as {class}" ("pa je Kuna broji kao {class}").

## Where the code fights an answer

- **One class per category.** The dividend tax carries two would-be classes, and the code reads the pair (`packRoles.ts:51-60`, `:73-75`, `ownerCost.ts:32`). `owner-pay-tax` becomes a modifier, so nothing in the code changes.
- **Every category needs a class.** Plain costs, other income and transfers carry no role today. Three behaviour-free classes name what Kuna already does with them.
- **The editor refuses a contradiction.** Its draft errors are whole-tab (`categoryDrafts.ts:77-123`), so refusing untouched rows would block every save until the review. The errors cover added and changed rows, and untouched rows get a hint.
- **Undo.** Undo skips every category guard (`namedRecordWrites.ts:115-125`), so it can put a contradiction back. The read reports it, and from stage 4 Kuna counts the class's treatment.
- **The Croatian set belongs to the preset, but its Croatian names live in core.** `SEEDED_NAMES` (`src/apps/company/workbook/domain/words.ts:37-77`) sits in core's domain, which may not import the pack. The names stay there, and the seed spec keeps the two in step.
- **Model HR68.** Kuna strips the model from the reference before it reads the code (`src/shared/categorising/domain/transactionFacts.ts`, `budgetRevenueCode`), so a rule cannot require HR68. The model goes in the rule's note and the law doc.
- **Only the review moves figures.** The digest hashes whole category records (`scripts/figure-digest.mjs:532-549`), so a role-only change would look like a figure change. The digest changes first.
- **The read stays lenient until the review.** Kuna's figures follow the stored VAT through stages 2 and 3, so no figure moves before the owner confirms. The class decides only from stage 4.
- **The loan switch** writes buckets through the category guard (`LoanBucketSwitch.vue:34-38`), so the loan classes allow both of its buckets.
- **The fake's VAT refund** sits in operating (`fakeWorkbook.ts:159`), so `vat-settlement` allows operating and taxes.
- **Core still knows Croatian VAT treatments.** `representation` and `car-50` stay in core's `VAT_TREATMENTS` (`src/apps/company/workbook/domain/vatTreatment.ts:5`). Moving them out of core is a separate cleanup.
- **The generic starting set.** The research kept it for books without a pack. The pack is always installed, so stage 3 deletes it rather than keeping code nothing reads.

## Unconfirmed

- **Revenue codes not seeded.** The Naputak's health contribution codes (8486 and the range around it), the dividend income tax (1570) and the salary income tax (1406 or 1880) were seen only in the fetch tool's summary of the page, not in its text. Stage 3 seeds none of them. The health contributions go by their account, and the dividend and salary taxes by the owner's own rules. Code 1686 is profit tax withheld on dividends paid to foreign companies under ZPD Art. 31, not the tax on a member's dividend, so it is not seeded either.
- **The profit tax advance.** The part of the Naputak read names 1651 for profit tax and no separate code for the monthly advance. Whether the advance also uses 1651 is unconfirmed. Until it is, the 1651 rule's note says it covers what the Naputak calls "porez na dobit".
- **The NN 39/26 amendment of the Naputak** was not loaded. It may change a code.
- **The private share.** Kuna counts the owner's private share as owner pay with no tax on it (`packs/hr-doo/domain/ownerBenefits.ts:37`). ZPD Art. 7(1)(13) adds private costs back unless income tax was paid on them (Art. 7(2)). The `owner-benefit` class keeps today's figure, and `tax-classes.md` marks it `reading` and lists it on the watch list.
- **A personal car's depreciation.** ZPD Art. 7(1)(4) covers all costs of the car. Whether Kuna adds back half of a personal car's depreciation, beyond the cost cap (`packs/hr-doo/domain/assets/assetBooks.ts:79-80`), was not checked.
- **The add-back base of car costs.** Kuna adds back half of the cost after the deductible VAT. ZPD Art. 7(3) says the costs include their VAT. Reading it as the VAT that stays a cost matches the code, but that is a reading.
- **Gifts in kind inside the 700.00 a year** (PravPDoh Art. 7(2) item 25) were not confirmed by the research.
- **The bugs** are read from the code and worked out by hand on the fixture. Stage 0 confirms or drops each.
- **Digest identity** of the groups that must stay the same is expected from the code, not run.
- **Moving many rows at once** on Transactions was not checked.

## Sources

Loaded on 4 Nov 2026 for this plan:

- Zakon o porezu na dobit, consolidated, "na snazi od 01.01.2026.", NN 177/04 to 151/25: Art. 5(1), Art. 7(1) points 3, 4, 7 and 13, Art. 7(2), Art. 7(3). https://www.zakon.hr/z/99/zakon-o-porezu-na-dobit. The page still prints 30% in Art. 7(1)(4). The ruleset records 50% from NN 115/16 (`packs/hr-doo/ruleset/rules/profit-tax.ts:340-356`).
- Zakon o porezu na dodanu vrijednost, consolidated, "na snazi od 30.03.2026.": Art. 40(1)(a) and (b), Art. 61(1) and 61(2). https://www.zakon.hr/z/1455/zakon-o-porezu-na-dodanu-vrijednost
- Naputak o načinu uplaćivanja prihoda proračuna, obveznih doprinosa te prihoda za financiranje drugih javnih potreba u 2026. godini, NN 18/26: codes 1201, 1651 and 8168 with model HR68, quoted from the page. https://narodne-novine.nn.hr/clanci/sluzbeni/2026_02_18_197.html. Read through the fetch tool, which returned quotes for the first part of the page and a summary for the second.

Loaded by [the preset research](research/croatian-preset/preset.md) on the same day and not reloaded here:

- Zakon o porezu na dohodak, Art. 66(1) and 66(2). https://www.zakon.hr/z/85/zakon-o-porezu-na-dohodak
- Pravilnik o izmjenama i dopunama Pravilnika o porezu na dohodak, NN 16/25, Art. 2 replacing Art. 7(2), items 18, 19, 20, 25, 31 and 32. https://narodne-novine.nn.hr/clanci/sluzbeni/2025_01_16_148.html
- Zakon o računovodstvu, Art. 11(1), 11(2), 11(7) and 16(2). https://www.zakon.hr/z/118/zakon-o-racunovodstvu

Cited from the ruleset, loaded on 18 Oct 2026: ZPDV Art. 58 (NN 152/24), ZPDoh Art. 70, PravPD Art. 23, 25 and 27 to 31, and the contribution accounts of NN 18/26 (`contributionAccounts.ts:1-6`).

## The owner's answers, 2026-11-04

- Each category gets exactly one cited tax class.
- The editor refuses a category that contradicts its class, and offers only the VAT treatments and buckets the class allows.
- Screens say "Kuna counts this as", never "this is". The accountant keeps the books and makes the judgement calls.
- New hr-doo books always start with the Croatian starting set.
- State-payment rules are seeded per year from the Naputak (revenue codes, model HR68), cited and still editable.
- The owner's existing categories move through a one-time review, carried out by the lead in the owner's live books through the browser, with the owner confirming each suggestion. Nothing changes until confirmed.
- Think modular monolith, good separation and reusability.
- The lead's defaults:
  - the class lives in the existing roles column
  - the scope is the classes Kuna computes today, plus car insurance and interest split out of running costs
  - company law docs go in `docs/law/company`, with a spec tying each class's percentages to the ruleset, and the Investments law docs move to `docs/law/investments` in the same wave
  - untouched rows get a hint, not an error
  - figures follow the stored VAT until the review, and the class decides after it
  - a category with two classes counts as the first its roles list
  - later Naputak versions reach new books through the ruleset, and existing books by hand on the rules tab
