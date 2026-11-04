# A Croatian d.o.o. preset for Company categories

Read-only research on kuna main at 0717599, 4 November 2026. Code is cited as file:line. Primary sources were loaded on 4 November 2026 unless a line says otherwise. Anything seen only in a search snippet is marked unconfirmed. The owner's live books were not opened. Where I describe them I go by the fake workbook, which says it mirrors the seed of the owner's Sheet.

## The short answer

The owner's premise is half right. The role vocabulary is already fixed by the pack. A user cannot invent a role, because Settings refuses any role outside core's and the pack's list (`src/apps/company/settings/domain/categoryGuards.ts:58-60`, `src/apps/company/settings/domain/categoryDrafts.ts:102-103`). What is user-made is everything around it:

- which categories exist
- which roles each one carries, in any combination
- the bucket
- the VAT treatment, picked separately from the role
- the owner share

Three things are actually missing:

1. **The seed knows almost no Croatian roles.** New books get a generic freelancer set (`src/apps/company/workbook/infrastructure/emptyWorkbook.ts:17-70`). It has no representation, personal-transport, non-deductible, capital-purchase, owner-pay-tax, profit-distribution or corporate-income-tax roles. So a new user's corporate tax base adds nothing back until they find the roles themselves. `client-meals` is seeded with no role and no VAT treatment (`emptyWorkbook.ts:36`).
2. **Nothing stops a contradiction.** Role, VAT treatment and bucket are three independent columns. A category can be representation and still reclaim 25% VAT. It can also be representation and non-deductible at once, which this reading of `accrualYear.ts:304-328` says adds it back twice.
3. **The roles carry no citation.** The figures behind them do (the ruleset), but nothing says "this role is ZPD Art. 7(1)(3)", and nothing ties a role to `docs/law`.

So the preset is less about making categories static and more about this: one fixed, cited tax class per category that decides the VAT treatment and the allowed buckets, a Croatian seed built from those classes, and a spec that ties each class to a law heading. Category names, payees, detail and the owner share stay the owner's.

The rules engine is not seeded at first run today. `emptyWorkbookTabs` writes `rules: []` (`emptyWorkbook.ts:96`). Rules come only from the user and from rule proposals.

## 1. Today's code

### First-run seed

- `newBooksDocument` (`src/apps/company/workbook/presentation/workbookFiles.ts:94-96`) calls `emptyWorkbookTabs` (`emptyWorkbook.ts:89-110`).
- Categories come from `DEFAULT_CATEGORIES` (`emptyWorkbook.ts:17-70`), described as "A generic set for a freelancer or a small company, which a user renames and extends" (`:16`). It gives six families, one per bucket, with these roles only:
  - `revenue`, `client-refund`, `vat-settlement` twice, `watched` on social contributions
  - `owner-benefit` on `benefits-from-company-costs`
  - `reimbursement` on `owner-reimbursement`
- Rules start empty (`:96`). The pack's tabs start empty (`:100-106`).
- The only pack input to the seed is settings defaults, through `installedPack()` (`emptyWorkbook.ts:2`, `:81-87`). That seam is where a pack-owned category seed would plug in.
- `categoriesAsNewBooksStart` (`workbookFiles.ts:99-102`) compares the user's categories with `DEFAULT_CATEGORY_NAMES`. Changing the seed changes what that check accepts.
- The fake workbook carries the richer Croatian set the owner's own Sheet started from (`src/apps/company/workbook/infrastructure/fake/fakeWorkbook.ts:40-61` for roles, `:69-79` for VAT). Examples: `payroll-contributions: watched, owner-pay-tax, arrears`, `dividend-tax: owner-pay-tax, profit-distribution`, `representation: representation` with `vat: representation`, `equipment: capital-purchase`. It has no personal-transport or non-deductible category.

### What the user can edit

Settings, Categories edits these fields for each category: name (slug), label, family, bucket, colour, roles, VAT and owner share (`src/apps/company/settings/domain/categoryDrafts.ts:16-31`, `src/apps/company/settings/presentation/CategoriesSettingsTab.vue:34,89`). The stored record is `Category` (`src/apps/company/workbook/domain/workbook.ts:23-36`).

The guards are:

- **Roles.** Only known roles are accepted (`categoryGuards.ts:58-60`).
- **Names.** A name in use cannot be changed (`categoryGuards.ts:29-45`).
- **Advances.** A category holding owner advances stays in operating or taxes (`categoryGuards.ts:36-43`).
- **Colours.** Colours come from the palette (`categoryGuards.ts:51-55`).
- **Owner share.** An owner share sits only on operating categories while an owner-benefit category exists (`categoryGuards.ts:75+`).

No guard links a role to a bucket or to a VAT treatment.

Reading is lenient. An unknown VAT treatment reads as `none` and is reported. A bad share reads as none (`src/apps/company/workbook/domain/categoriesReading.ts:29-50`, `:80-93`).

Rules are rows of the `rules` tab: conditions such as IBAN, counterparty text and the four-digit `revenue_code`, plus a category and a confidence (`src/apps/company/rules/domain/rule.ts:12-54`). All of them are user-made.

### What the hr-doo pack hard-codes

- **Roles.** `PACK_ROLES` holds 19 roles (`src/apps/company/packs/hr-doo/domain/packRoles.ts:6-32`). `TAX_FREE_ROLES` derives one `tax-free:<payment>` role per row of the ruleset's non-taxable caps table (`packRoles.ts:42`). Both are published to core as `categoryRoles` (`src/apps/company/packs/hr-doo/domain/hrDooPart.ts:83`).
- **Buckets.** These are core's, six of them (`src/apps/company/workbook/domain/bucket.ts:5`).
- **VAT treatments.** These are core's too, but they carry Croatian values: `representation` and `car-50` (`src/apps/company/workbook/domain/vatTreatment.ts:5`). The pack computes them (`src/apps/company/packs/hr-doo/domain/vat/vatSplit.ts:29-64`). This is a boundary leak, because core knows Croatian VAT classes.
- **Konto classes.** The pack maps the first two konto digits to profit and loss lines, 40 to 48 (`src/apps/company/packs/hr-doo/domain/accrual/costLines.ts:15-25`). It prefers the accountant's konto lines on the year-end tab and falls back to the bucket (`costLines.ts:32-51`). This is the only chart-of-accounts knowledge in code, and it already treats the accountant's konto as authoritative.
- **Contribution accounts.** The state accounts contributions go to are fixed from the Naputak (`src/apps/company/packs/hr-doo/domain/salaries/contributionAccounts.ts:1-12`).
- **The ruleset.** About 70 dated, cited rules sit in `packs/hr-doo/ruleset/rules/*.ts`, with an act registry in `ruleset/acts.ts`, the schema in `ruleset/schema.ts:97-189` and a spec in `tests/ruleset.spec.ts`.

### Where a figure depends on a user-chosen category or role

| Role                                                                 | What it changes                                                                                       | Where                                                                                        |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `representation`                                                     | CIT add-back of 50% including VAT. Input VAT is put back in even when the VAT column says deductible. | `accrualYear.ts:304-320`, `forecastYear.ts:347`, `closedYear.ts:111-117`, `taxBase.ts:68-76` |
| `personal-transport`                                                 | CIT add-back of 50%                                                                                   | `accrualYear.ts:327`, `forecastYear.ts:348`, `taxBase.ts:72,77`                              |
| `non-deductible`                                                     | CIT add-back of 100% (fines and private costs)                                                        | `accrualYear.ts:328`, `forecastYear.ts:349`, `taxBase.ts:73-78`                              |
| `capital-purchase`                                                   | Capitalised above the asset threshold, then depreciated                                               | `accrualYear.ts:401-404`, `assetRegister.ts:77`                                              |
| `arrears`, `prepaid-annual`                                          | Accrual timing                                                                                        | `accrualBookings.ts:165-168`, `serviceMonth.ts:15`                                           |
| `revenue`, `grant`, `client-refund`                                  | Revenue lines, the effective tax rate, receivables                                                    | `accrualBookings.ts:93-98`, `effectiveTaxRate.ts:26`, `invoiceMatching.ts:80-81`             |
| `corporate-income-tax`, `vat-settlement`                             | Balance-sheet movement, not a cost. Advance matching.                                                 | `accrualBookings.ts:95-96`, `matchCitPayments.ts:49`, `accrualBalanceSheet.ts:109-111`       |
| `profit-distribution`, `owner-pay-tax`                               | Dividend capacity, owner cost, payroll taxes                                                          | `dividendCapacity.ts:496`, `ownerCost.ts:32`, `packRoles.ts:51-60`                           |
| `owner-loan-out`, `owner-loan-repaid`, `reimbursement`, `owner-rent` | Owner take, owed balance, rent tax                                                                    | `ownerTake.ts:64-75`, `ownerLoans.ts:155-175`, `ownerAdvances.ts:136-155`                    |
| `salary`, `tax-free:*`                                               | Payroll reconciliation against the caps                                                               | `salaryReconciliation.ts:123-135`                                                            |
| `watched`                                                            | Whether a monthly tax arrived                                                                         | `payrollCadence.ts:43`                                                                       |
| `owner-benefit` (core)                                               | Where the owner's private share of a cost counts                                                      | `src/apps/company/owner-share/domain/ownerParts.ts:45,105`                                   |
| VAT column                                                           | Input VAT and the cost split                                                                          | `vatSplit.ts:35-62`, `accrualYear.ts:200-203`                                                |
| Bucket                                                               | Every profit and loss figure                                                                          | `bucket.ts:1-40`                                                                             |

Two code observations matter for the preset. Both come from reading the code, not from running it.

- **Contradictions cost money.** Take a representation category with `deductible-25`. It keeps its CIT add-back right because `accrualYear.ts:305-310` adds the VAT back. But the year's input VAT (`accrualYear.ts:200-203`) still counts that VAT as reclaimable. The cost line uses the net cost, so profit before tax is overstated by the same VAT.
- **The representation figure is worked out two ways.** `accrualYear.ts:310` adds input VAT back. `forecastYear.ts:347` uses the plain role total. One rule computed in two places should get one owner. A preset that derives VAT from the class makes both agree, because a representation category could no longer carry deductible VAT.

### Which roles carry legal meaning and which are the owner's choices

**Legal classes.** Each one changes a tax or statutory figure:

- `representation`, `personal-transport`, `non-deductible`, `capital-purchase`
- `profit-distribution` (dividend), `salary`, `tax-free:*`, `owner-rent`
- `owner-loan-out`, `owner-loan-repaid`, `grant`
- `corporate-income-tax`, `vat-settlement`, `owner-pay-tax`
- `revenue`, as against other income, for the CIT rate test on revenue
- the VAT treatments

**Mechanics or the owner's choices.** None of these is a legal class:

- `arrears` and `prepaid-annual` are payment timing. They are facts about the payee, not about the law.
- `watched` is a reminder.
- `reimbursement` is a balance between the owner and the company. Repaying an advance is not a tax class.
- `client-refund` is matching.
- `owner-benefit` is where the private share counts. The share itself is the owner's estimate.
- The bucket is partly legal and partly a management view. Income, cost, financing and neutral follow accounting. `owner-pay` and the `LoanBucketSwitch` (`packs/hr-doo/presentation/LoanBucketSwitch.vue:17-34`) are views. The law has salary as a personnel cost, not an owner-pay line.

## 2. What Croatian law fixes for a d.o.o.

### Profit tax: Zakon o porezu na dobit (ZPD) Art. 7

Loaded at zakon.hr/z/99, "na snazi od 01.01.2026.", database through NN 119/26, NN 177/04 to 151/25.

Art. 7(1) adds these back to the base:

- **(2)** depreciation above Art. 12.
- **(3)** 50% of representation. The text reads "za 50% troškova reprezentacije (ugošćenja, darova sa ili bez utisnutog znaka tvrtke ili proizvoda, troškova odmora, športa...". It covers hospitality, gifts to business partners and leisure.
- **(4)** the share of costs for own or leased motor vehicles, "osim troškova osiguranja i kamata". zakon.hr still prints 30% with a remark that 50% applies after 01.01.2018. The ruleset records 50% from NN 115/16 (`profit-tax.ts:340-356`).
- **(5)** asset shortages above the chamber's limits.
- **(6)** forced-collection costs.
- **(7)** fines from a competent body.
- **(8)** default interest between related persons.
- **(9)** benefits given to make something happen or not happen.
- **(10)** donations above Art. 7(7) and 7(9), and donations that benefit the company or a related person.
- **(11)** interest that is not deductible under the act.
- **(12)** expenses found in a tax audit, with their VAT, income tax and contributions.
- **(13)** "sve druge rashode koji nisu izravno u svezi s ostvarivanjem dobiti". These are private costs.

The other paragraphs:

- **Art. 7(2).** There is no add-back where income tax was calculated and paid on the item, except for points 9 and 12.
- **Art. 7(3).** The vehicle costs include their VAT.
- **Art. 7(6).** Branded items marked not for sale, and promotional items up to 22.00 without VAT a unit, are not representation.

The ruleset already models (3), (4), (6) to (8), (10) as the donation cap of 2% of revenue, (13), the sponsorship decrease from 2026 under NN 151/25, and the promotional item limit (`profit-tax.ts:303-356`, `:460-541`).

Kuna computes no figure for (5), (9), (10) or (11) today. Donations have a rule but no role.

### Input VAT: Zakon o PDV-u (ZPDV) Art. 61

Loaded at zakon.hr/z/1455, "na snazi od 30.03.2026.", database through NN 119/26, NN 73/13 to 48/26.

- **Art. 61(1).** "Porezni obveznik ne može odbiti pretporez za nabavu dobara i usluga za potrebe reprezentacije". Representation means hosting and gifts to business partners, their leisure and sport, and hire of cars, boats, planes and holiday houses.
- **Art. 61(2).** "ne može odbiti 50% pretporeza obračunanog za nabavu ili najam osobnih automobila, uključujući nabavu svih dobara i usluga u vezi s tim dobrima". A personal car is one with at most eight seats besides the driver's.
- **Art. 61(3).** The exceptions: driving schools, testing, service fleets, passenger and goods transport, hire, resale and some N1 vehicles.

The ruleset matches this (`vat.ts:195-229`). It also cites Art. 58 from NN 152/24, which I did not load myself.

The pair to take from this: representation means 50% CIT add-back and 0% input VAT. A personal car means 50% CIT add-back on cost plus VAT, and 50% input VAT. Car insurance and loan interest are outside the CIT add-back (ZPD 7(1)(4)). Insurance carries no VAT in any case, so it is a separate legal class from fuel and service.

### Non-taxable payments to employees and the director: Pravilnik o porezu na dohodak Art. 7(2)

Loaded from NN 16/25, document 148, published 31.1.2025. Art. 2 of that act replaces Art. 7(2). Art. 17 puts it in force the day after publication.

- **Item 19.** A domestic trip over 12 hours, and field work: "do 30,00".
- **Item 20.** A domestic trip over 8 and under 12 hours: "do 15,00".
- **Item 25.** Occasional awards such as a Christmas bonus or holiday pay: "do 700,00 godišnje". The page as fetched did not name regres or uskrsnica, and did not mention a gift in kind. Whether a gift in kind counts inside the 700 is unconfirmed from this load.
- **Item 31.** Private car on business: "do 0,50 po prijeđenom kilometru".
- **Item 18.** Performance bonuses: a coefficient of 2.0 a year on the basic allowance, which is 1,200.00 at 600.00.
- **Item 32.** A gift to a child under 15: "do 140,00 godišnje".

The ruleset's table matches these amounts (`owner-pay.ts:812-842`). Its 2027 version is marked pending on bill PZ 339 (`owner-pay.ts:843-874`).

### Owner pay and owner loans

- **Private use by a member.** ZPDoh Art. 66(1) treats it as capital income, "izuzimanja imovine i korištenje usluga od strane članova trgovačkih društava za njihove privatne potrebe". Art. 66(2) treats an advance on profit that the year's profit does not cover the same way. Both were loaded at zakon.hr/z/85. For the company the cost is not deductible (ZPD 7(1)(13)). The ruleset models it as `hr.pit.hidden-distribution`, 36% (`owner-pay.ts:971-993`).
- **Dividends.** Withheld at 12% (ZPDoh Art. 70, quoted in `owner-pay.ts:964`, loaded 2026-10-18 by the ruleset, not by me).
- **Salary.** Contributions on the director floor (`hr.contrib.director-floor`) and income tax brackets. All of this is ruleset content. The owner chooses between salary and dividend, and the law prices each one.
- **Owner loans.** The law does not fix a class for the loan itself. It is a balance-sheet item. What the law fixes:
  - interest at the related-party rate (`hr.cit.related-party-rate`, `profit-tax.ts:583+`)
  - the scope test (`:641`)
  - a written record of sole-member deals (`hr.ztd.sole-member-deals`, `company-law.ts:233`)
  - the benefit of a below-2% loan to an employee (`hr.pit.loan-benefit`, `owner-pay.ts:901-922`)

  My Art. 66 load found no provision that turns an unrepaid loan to a member into income. That is unconfirmed either way.

### Paying the state: the Naputak

The Naputak o načinu uplaćivanja prihoda proračuna for 2026 is NN 18/26, amended by NN 39/26 (the amendment was seen in a snippet only, unconfirmed). It is reissued every year. The 2025 one is NN 22/25 (title seen in a snippet).

Loaded from NN 18/26:

- VAT is revenue code 1201 with model HR68.
- Profit tax is 1651 with HR68.
- Profit tax withheld on dividends is 1686.
- Pension pillar I on employment is 8168.

The full code list is in Prilog 4, which is not on the page. The CIT advance code and the health contribution code were not found in the part I read.

These codes and the state accounts are the same for every Croatian d.o.o. So they are law-defined rules, unlike supplier rules.

### Chart of accounts

No chart of accounts is prescribed by law.

- Zakon o računovodstvu, loaded at zakon.hr/z/118 ("na snazi od 10.06.2026.", NN 85/24 to 59/26):
  - Art. 11(1) requires double-entry books.
  - Art. 11(2) requires a journal, a general ledger and subsidiary ledgers.
  - Art. 11(7) says the ledger runs on "unaprijed pripremljenih konta koja, u skladu s potrebama poduzetnika, osiguravaju podatke za godišnje financijske izvještaje".
  - Art. 16(2) sends micro and small entrepreneurs to HSFI.
- HSFI sets the statements, not the accounts.
- The RRiF chart is a privately published book. The 28th edition, March 2025, is sold at rrif.hr. Its 2024 table of contents names "RAZRED 4 – Troškovi prema vrstama, financijski i ostali rashodi", seen in a PDF snippet only, unconfirmed.

So konto numbers are the accountant's practice, not law. Kuna should keep reading them from the accountant's year-end lines, as `costLines.ts:27-44` does, and not ship a chart.

### What the law defines and what the owner chooses

| Law defines it. It can be a fixed preset with a citation.                                                                                                                                                                                    | Owner's choice. It stays editable.                                                                                                         |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Which tax class a cost is in: deductible, representation, personal car running cost, car insurance and interest, fine or forced collection, private use, donation, capital purchase. Each one's add-back share and VAT deductibility, dated. | The category names, labels, colours and families. How fine-grained the categories are, for example three representation categories or one. |
| Which payments to a person are salary, non-taxable under which item, dividend, rent, or private use. Each one's cap or rate, dated.                                                                                                          | The VAT rate a purchase in a deductible category carries (25, 13 or 5), since that is a fact about the supplier.                           |
| That CIT, VAT and contribution payments are settlements, not costs. Their state accounts and revenue codes, by year.                                                                                                                         | Which payee goes to which category: every supplier and client rule.                                                                        |
| That a grant is income on its schedule and an asset above the threshold is capitalised.                                                                                                                                                      | The owner share of a mixed-use cost: the owner's estimate, within the law's private-use class.                                             |
|                                                                                                                                                                                                                                              | Payment timing (arrears, a year paid ahead), reminders (watched), and whether loans show as owner pay or financing.                        |

## 3. A proposal for the Croatian d.o.o. preset

### The plainest version

Keep the `roles` column and the role names. Add one pack-owned table that turns some roles into exclusive tax classes with citations and constraints. Seed new books from it. Report contradictions in existing books. Change nothing in the file format.

### Tax classes

The pack would get one file, `packs/hr-doo/preset/domain/taxClasses.ts`. It holds a closed list of classes, each with:

- **id.** The existing role name where one exists: `representation`, `personal-transport`, `non-deductible`, `capital-purchase`, `salary`, `profit-distribution`, `owner-rent`, `owner-loan-out`, `owner-loan-repaid`, `corporate-income-tax`, `vat-settlement`, `grant`, `revenue`, and the `tax-free:*` set from the caps table. Plus a plain `deductible-cost` for the ordinary case, and new ones only where the law changes a figure Kuna computes. The likely new ones are `vehicle-insurance-and-interest` (deductible, no VAT, outside ZPD 7(1)(4)) and `donation`.
- **rules.** The ruleset rule ids its figures come from, such as `hr.cit.representation-add-back` and `hr.vat.input-deduction`. The percentages stay in the ruleset, which is already dated and versioned. The class does not copy them.
- **vat.** The VAT treatments the class allows:
  - representation allows only `representation`
  - personal car allows only `car-50`
  - deductible cost allows `deductible-25/13/5`, `reverse-charge`, `foreign-vat` or `none`
  - settlements allow `none`
- **buckets.** The buckets it may sit in, for example representation in operating and settlements in taxes or financing.
- **exclusive.** A category carries at most one class. Timing and reminder roles (`arrears`, `prepaid-annual`, `watched`) stay free modifiers.
- **validFrom / validTo.** The days the class exists in law, so a class the law adds or removes is dated like a ruleset version. The sponsorship decrease from 1 January 2026 under NN 151/25 is a real case.
- **law.** A `docs/law/company/<file>.md#<heading>` anchor.

### User categories map to one class each

A category has exactly one class, and blank means "not classified yet". This does not reuse `unclassified`, which is a bucket state (`bucket.ts:10`).

The VAT column and the bucket become constrained by the class:

- When a class allows one VAT treatment, the editor fills it in and locks it.
- When it allows several, the editor offers only those. The deductible rate stays the owner's choice.
- On read, the pack's `assemble` reports a contradiction as a `categories` problem, the same way an unknown VAT treatment is reported today (`categoriesReading.ts:84-87`). The figure uses the class's treatment.
- On save, the guard refuses a new contradiction, the same way `categoryShareRefusals` refuses an owner share (`categoryGuards.ts:75+`).

### Default categories and rules from the preset

- **A new slot.** Add a pack slot, for example `PackPart.defaultCategories`, that `emptyWorkbookTabs` reads in place of `DEFAULT_CATEGORIES` when a pack is installed. It uses the same `installedPack()` seam as settings (`emptyWorkbook.ts:81-87`). Core keeps its generic set for books without a pack.
- **The categories.** Start from the fake workbook's set (`fakeWorkbook.ts:40-79`), which the owner already uses. Add the missing classes: a car running-cost category on `personal-transport` with `car-50`, a fines category on `non-deductible`, and `client-meals` renamed or kept but on `representation`.
- **Seeded rules.** Only the law-defined payees: the state accounts and revenue codes from that year's Naputak. Examples are CIT 1651, VAT 1201 and contributions from `contributionAccounts.ts`. They are seeded at `review` confidence, so the owner confirms the first match. These are dated by the Naputak's year and checked against Prilog 4. Supplier and client rules stay user-made.

### When the law changes

The figure changes in the ruleset, in a new dated version, as today. The class does not change. Only when the law adds or removes a class does the preset get a new dated class and a higher `PRESET_VERSION`.

The books record the preset version they were seeded or last reviewed at, as one pack settings key (`COMPANY_FACT_SETTINGS` pattern, `hrDooPart.ts:76`). When the app's version is higher, Overview's Waiting for you lists "New tax class since <date>: <name>", with Add or Not needed. The app never rewrites categories on its own.

The Naputak codes change every year, so the seeded state rules get a yearly version and the same notice.

### Existing data

Nothing migrates silently. Most of the work is already done, because the owner's categories already use these role names.

1. The first read after the change reports each category that has no class or a contradicting VAT treatment or bucket.
2. A one-time review on Settings, Categories suggests a class for each unclassified category. The suggestion comes from its current role, its VAT treatment and a name match with the seed. The owner accepts or edits the suggestions in one save.
3. Run `npm run check:figures -- --workbook <export>` before and after, on the owner's own export. The digest covers `year.roles` and the accrual year with its tax base (`scripts/figure-digest.mjs:298-309`). The stage that only adds classes and reporting must leave every hash identical. The review save is the one step that may change figures, and the diff shows which groups changed.

### Where the law leaves a choice

These stay editable:

- names, labels, families, colours and granularity
- the deductible rate
- the owner share, within the class that allows it
- timing and reminder roles
- every payee rule
- the loans view

A class where the law needs a judgment, such as whether this meal was representation or a travel meal, stays a choice per category, or per row through a split. The preset fixes what each class means, not which receipts belong in it.

### Tying the preset to docs/law

Add `docs/law/company/`, with files such as `profit-tax-add-backs.md`, `input-vat-limits.md`, `payments-to-people.md`, `state-payments.md` and `chart-of-accounts.md`. Each has a heading per class and a table under a fixed heading, for example "Classes", with the columns `Class | CIT add-back | Input VAT deductible | From`.

A spec beside `tests/lawDocs.spec.ts`, or a `describe` inside it, would fail in these cases:

- a class names a file or heading that is missing (same anchor check as `lawDocs.spec.ts:95-100`)
- the table's percentages differ from `ruleValue(<class.rules>, <From>)`, so the doc, the ruleset and the class cannot drift
- a class has no doc row, or a doc row has no class

`law-index.mjs` already recurses into subfolders (`scripts/law-index.mjs:18-26`), so a `company/` folder gets indexed with no script change.

On placement: the company law belongs under `docs/law/company/`. The README today is titled "Croatian law for Kuna's Tax screen" and scoped to Investments (`docs/law/README.md:1-5`). A matching `docs/law/investments/` move is a choice for the owner, covered under Decisions. The company ruleset already keeps its own act registry (`ruleset/acts.ts`), and Investments keeps one in `docs/law/sources/acts-and-issues.md`. Both change for the same reason, an NN amendment. That makes them candidates for one owner later, not in this change.

## 4. Module boundaries

### What the preset owns

The preset sits in the hr-doo pack, as `packs/hr-doo/preset/domain/`, beside `ruleset/`. It owns:

- the class list
- the class constraints
- the Croatian default categories
- the state-payment rules
- the preset version

It depends on the ruleset for figures and citations. The ruleset never depends on the preset.

`PACK_ROLES` (`packRoles.ts`) either becomes the preset's class list plus the modifier roles, or stays and is referenced by it. Either way there is one list, not two.

Core gets two generic slots and no Croatian knowledge:

- default categories, with optional default rules
- category refusals and problems from the pack

Core's `VatTreatment` keeps its values for now. Moving `representation` and `car-50` out of core, so that core only knows "a pack's treatment", is a cleanup that can follow. It touches `vatTreatment.ts:5`, `workbookTemplate.ts:96-101` and the reader.

### The spending app shares nothing with the preset

The personal spending app planned on 2026-11-04 has two-level categories and Croatian sets for taste. Its tree changes when the owner's habits change, for example when groceries split into two categories. The preset changes when ZPD, ZPDV, PravPDoh or the Naputak change. Different reasons to change mean they stay apart.

The one overlap is mechanics: a category record with a slug, a colour from the palette, and the rules engine core. [Lane 1 of the spending research](../../../spending/research/lane1-code.md) already proposes one shared owner for the rules engine core. A personal "For the company" category maps to nothing here, because the company's books start at the bank row.

### What the import boundary spec would add to `tests/importBoundaries.spec.ts`

These already hold:

- no app imports another (`:143-145`)
- core does not import pack code (`:147-149`)
- a pack stays in its own folder (`:151-162`)
- domain code imports only domain code (`:164-172`)

New rules:

- **Ruleset off the preset.** Files under `packs/hr-doo/ruleset/` never import `packs/hr-doo/preset/`.
- **Preset is domain code.** `packs/hr-doo/preset/` outside `presentation/` counts as domain. This means extending `isDomain` (`:87-89`) the way it already treats the ruleset.
- **Class constants have one home.** Only the preset and `packRoles.ts` define class or role string constants. A `linesHolding` check (`:63-70`) for quoted class names outside those files would catch a second list.

## 5. Risks

### Figures that would change for the owner's live books

- **Stage one changes nothing.** Adding classes and reporting changes no figure. `check:figures` before and after must be identical, apart from any new problem-count group the digest prints.
- **The review save may change figures.** In order of likely size:
  - a category that gains `personal-transport` or `non-deductible`: CIT base up, CIT liability, dividend capacity and forecast down
  - a representation category whose VAT was deductible: input VAT down, cost up, profit before tax down, add-back unchanged
  - a category that loses a second class it carried by mistake: add-back down

  The digest groups `year.<y>.accrual` and the forecast groups show which ones moved. The owner should compare them with the accountant's PD for a closed year. The year-end comparison already does this (`yearEndComparison.ts`).

- **The seed check.** `categoriesAsNewBooksStart` (`workbookFiles.ts:99-102`) and any onboarding step that reads it change meaning when the seed changes.

### The owner's custom categories

They keep their names, rows and rules. A name in use cannot be renamed anyway (`categoryGuards.ts:29-35`). The risk is a suggestion the owner accepts without looking, so the review should show each suggested change with the figure it moves.

Categories the preset has no class for, such as `ai-services` with an owner share, get `deductible-cost` and keep the share.

### What Kuna must not claim

Kuna does not keep the books, and the accountant does. Under ZoR Art. 11 the books are the journal and the general ledger on the accountant's kontos. Kuna's classes are estimates on bank rows, for forecasts and checks.

**What the preset decides:**

- which class Kuna uses for its own estimates
- the cited meaning of each class
- the defaults for new books

**What stays the accountant's:**

- the actual booking and konto
- the judgment calls: was a meal with a client representation, is a gift to a partner or to an employee, the private-use share for VAT and CIT, which supplies count as personal-car costs
- the PD and VAT returns

Where the two differ, Kuna shows the difference on the Year screen, and the accountant's figure wins for a closed year. The code already works this way for konto lines (`costLines.ts:27-44`, `closedYear.ts:111+`).

Kuna should word classes as "Kuna counts this as" and never as "this is". The owner's personal tax is researched from the law directly. The company's books are not, and the preset must not imply otherwise.

## 6. Staging and decisions

### Plainest staging

1. **Classes and citations, no figure change.** Add the preset's class table over the existing roles, its law docs in `docs/law/company/`, and the spec. Add pack-reported problems for contradictions and missing classes. `check:figures` stays identical.
2. **Guards.** The category editor offers only the VAT treatments and buckets each class allows, and refuses a second class.
3. **The Croatian seed.** Add the pack slot for default categories, the Croatian set, and the change to `categoriesAsNewBooksStart`. New books only.
4. **The owner's review.** A one-time suggestion pass on Settings, Categories. Run `check:figures` on the owner's export before and after, and compare with the accountant's last PD.
5. **Optional.** State-payment rules seeded from the Naputak by year. Preset version and the "new class" notice. Move Croatian VAT values out of core.

### Decisions only the owner can make

**A. What happens when a category contradicts its class**

Settings, Categories and every tax figure are affected. Example: a made-up `client-dinners` category marked representation with 25% VAT. A €100 dinner today counts €20 as reclaimable VAT and €80 as cost, so input VAT and profit are each €20 too high.

- **Let the class decide.** The figure uses the representation treatment, a problem line names the category, and the editor refuses the contradiction on the next save. Figures change only for books that have contradictions.
- **Only warn.** The figure follows the VAT column as today, and a problem line flags it. Nothing changes until the owner edits it.

I recommend letting the class decide. The VAT column is a detail of the class, and the law gives representation no deduction.

**B. Where the class is stored**

This affects the categories tab and every export. Example: `fuel` today reads `roles: personal-transport, arrears`.

- **Keep the roles column.** Some roles become the class (at most one), and the others stay modifiers. No file change and no migration.
- **Add a `tax_class` column.** Clearer to read in an export. It is a new core field, a schema bump, a migration that moves roles across, and changes to the template and its notes.

I recommend keeping the roles column. The owner's books already use these names, and a column can come later if the mix confuses anyone.

**C. Which categories new books start with**

This affects new books and onboarding. Example: a new user's books today have `client-meals` with no role, so their first year's CIT estimate adds nothing back.

- **Always the Croatian set.** The hr-doo pack is always installed (`src/apps/company/app.ts:47`), so every new book gets the cited classes, whatever the owner-pay switch says.
- **The Croatian set only with the owner-pay module on.** A user who answers No at onboarding keeps the generic set and gets no add-backs.

I recommend always the Croatian set. CIT add-backs apply with or without paying the owner.

**D. The owner's existing categories**

This affects the owner's live books. Example: those books have a `representation` category and no car or fines category. The suggestion pass might propose `deductible-cost` for twenty categories and nothing for car costs.

- **One review with suggestions.** Everything is shown on one screen and nothing is written until the owner saves. `check:figures` runs before and after.
- **Leave them, and show only what is missing.** The existing missing-roles line (`packs/hr-doo/presentation/MissingRoles.vue`, `accrualRoles.ts:7-23`) grows to cover classes. The owner fixes them when they show up.

I recommend the review. It is one sitting, and it settles the double add-back and VAT risks in the owner's books.

**E. How far the class list goes now**

This affects the Year screen and the forecast. Example: a made-up €500 donation, which today counts as an ordinary cost with no 2% cap check.

- **Only what Kuna computes today, plus car insurance and interest split from running costs.** The other ZPD Art. 7(1) items (shortages, benefits, donations above the cap, non-deductible interest) are listed on the watch list.
- **Also add donations, with the 2% cap the ruleset already holds, and promotional items up to 22.00.** That means one more add-back line in `taxBase.ts` and a test each.

I recommend the first option, with donations as the next step if the company gives any.

**F. Where the company law docs go**

This affects the docs/law layout and its spec. Example: the README today opens "Croatian law for Kuna's Tax screen".

- **Add `docs/law/company/` and leave Investments at the root.** One new folder, nothing moved.
- **Move Investments into `docs/law/investments/` as well.** Both apps are symmetric, and the README covers both. `TAX_RULES` law paths and the `tableUnder` file names in `lawDocs.spec.ts` change in the same commit.

I recommend moving both. It is a one-commit rename, and the README stops being wrong for the company.

**G. Seed the state-payment rules or not**

This affects Settings, Category rules and To review. Example: a made-up CIT advance to the state budget with revenue code 1651, which today waits in To review until the owner writes a rule.

- **Seed them by year from the Naputak.** They are seeded at review confidence, with a yearly update notice.
- **Leave rules user-made.** The codes go in the docs as reference.

I recommend seeding them. They are the same for every Croatian d.o.o., and the rules tab already has a `revenue_code` condition (`rule.ts:18`, `rule.ts:48`).

## Sources loaded on 4 November 2026

- ZPD consolidated text: https://www.zakon.hr/z/99/zakon-o-porezu-na-dobit (Art. 7(1) points 1 to 13, 7(2), 7(3), 7(6). Na snazi od 01.01.2026, through NN 119/26.)
- ZPDV consolidated text: https://www.zakon.hr/z/1455/zakon-o-porezu-na-dodanu-vrijednost (Art. 61(1) to 61(3). Na snazi od 30.03.2026, through NN 119/26.)
- ZPDoh consolidated text: https://www.zakon.hr/z/85/zakon-o-porezu-na-dohodak (Art. 66(1), 66(2))
- Pravilnik o izmjenama i dopunama Pravilnika o porezu na dohodak, NN 16/25: https://narodne-novine.nn.hr/clanci/sluzbeni/2025_01_16_148.html (Art. 2 replacing Art. 7(2), items 18, 19, 20, 25, 31, 32, Art. 17)
- Zakon o računovodstvu: https://www.zakon.hr/z/118/zakon-o-racunovodstvu (Art. 11(1), 11(2), 11(7), 16(2). Na snazi od 10.06.2026.)
- Naputak 2026, NN 18/26: https://narodne-novine.nn.hr/clanci/sluzbeni/2026_02_18_197.html (codes 1201, 1651, 1686, 8168, model HR68. Prilog 4 not on the page.)
- RRiF-ov računski plan za poduzetnike: https://www.rrif.hr/rrif_ov_racunski_plan_za_poduzetnike-300-knjiga/ (28th edition, March 2025, sold book)

Unconfirmed, seen in snippets only:

- the NN 39/26 amendment of the Naputak: https://narodne-novine.nn.hr/clanci/sluzbeni/2026_04_39_470.html
- the 2025 Naputak, NN 22/25
- the RRiF class 4 heading in the 2024 table of contents: https://cdn.shopify.com/s/files/1/0844/9392/6741/files/RRIF-ov_racunski_plan_za_poduzetnike-XXVII_izdanje-Strucnaknjizara-Sajema-Predgovor-Sadrzaj.pdf

Ruleset sources cited but not reloaded by me: ZPDV Art. 58 (NN 152/24), ZPDoh Art. 70, PravPD Art. 23, 25, 27 to 31.
