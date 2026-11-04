# Salaries page

Proposal for a Salaries menu item that splits each employee's pay into net, pension, tax and health, and reconciles payslip, payroll engine and bank per employee and month.

Research only. Nothing is built. Code claims are checked against HEAD `facccb0`, read through `git show` because another workflow is editing the working tree, and `src/packs/hr-doo/domain/companyFacts.ts` is one of the files it has open. The owner's month is shown with made-up, rounded figures.

## The answer

**What it shows.** For each employee and worked month: where the company's money went (net pay, tax-free payments, pension pillars I and II, income tax, health), gross to net as a waterfall, and the same month three times over: the accountant's payslip, the app's payroll engine and the bank. Where the three differ, the page shows a problem with its build-up and a link to the rows. It never picks one source quietly. With one employee the page is a single person's month. With five it adds a People tab and company totals.

**Where it lives.** A ninth menu item, Salaries, added by the hr-doo pack after Owner and Year (`src/shared/routing/screens.ts`, `src/packs/hr-doo/hrDooPack.ts:22-23`). The owner decided on 2026-10-26 that it is its own item and that no source wins (the plan, "Queued by the owner: a salaries page"). The "Payroll from the accountant" card moves here from Year, Accountant, so the payroll check has one home.

**What the app lacks.**

- An employee record. Today the engine's employee is four settings keys about the owner.
- A way to tie a bank row to an employee and to a worked month. The text is already on every payroll row, but no code reads it.
- An accountant source for pay paid outside the monthly payslip, such as the February 2026 bonuses.
- A payroll path for an employee who is not the director. The engine raises every salary to the director floor.
- A reader for workbooks with several employees.

## Findings, gaps first

1. **No employee record exists.** `EmployeeFacts` (`domain/payroll/incomeTax.ts:11-19`, paths relative to `src/packs/hr-doo/`) is filled from `CompanyFacts`, whose doc comment calls them "the owner's own facts" (`domain/companyFacts.ts:32-45`). The pack's record kinds are owner advance, asset, grant, year-end line, plan line and scenario component (`domain/hrDooKinds.ts`). None is a person.
2. **The engine is a director engine.** `grossSalary` pays `max(agreed, floor)` with the director floor (`domain/payroll/payrollMonth.ts:199-212`). An ordinary employee on 1,200.00 would be computed at 1,295.45 in 2026, and every line would fail against a real payslip. `hr.minwage` (`ruleset/rules/owner-pay.ts:1015`) and the annual part of `hr.contrib.max-base` (`:476`) are read by no code.
3. **The workbook reader takes one employee.** A second `Obračun plaće` tab is refused (`domain/accountant/salaryWorkbookReading.ts:66-68`). `SalaryWorkbook` has no employee field (`domain/accountant/salaryWorkbook.ts:16-43`). Files are keyed by period and kind only (`domain/accountant/accountantFile.ts:27`, `filingsByPeriod` at `:43-55`). What the accountant's workbook looks like for two employees is unconfirmed. No example exists.
4. **Pay outside the payslip is invisible to the check.** Two bank rows of 4 Feb 2026, a 1,000 results bonus and a 500 gift, are booked `salary-bonus`. They are in `2026-01-payment-order-non-taxable-income.xml` and in no salary workbook. Today's check only fails on unknown labels, so it does not notice. Under the owner's rule they would be a problem that cannot be resolved.
5. **The accountant's payment orders already carry what the page needs.** I read their structure from a scratch script, with digits masked. Each is an ISO 20022 `pain.001.001.09` file with one transfer per payee. Each transfer has a purpose code: `SALA` net pay, `GOVI` pillar I, `CBFF` pillar II, `HLTI` health, `INTX` income tax, `BONU` bonus. Each also has the remittance text "Plaća za M / YYYY", or the Pravilnik item's name for a bonus. The payroll folder holds one salary order for each month, and a bonus order is one extra file. The app does not read them.
6. **Every payroll bank row names its worked month.** In the live export, each worked month has exactly five rows whose description says "Plaća za M / YYYY": net, pillar I, pillar II, health and tax. The only payroll-category rows without that text are bonus rows and a few small top-ups. Today's check finds rows by amount within ±5 days of payday instead (`domain/accountant/payrollReconciliation.ts:23, 121-128`). Two employees with the same net would collide.
7. **The bank already splits contributions by payee, not by category.** All `payroll-contributions` rows go to one of three payees: the state budget (pillar I), the pillar II account and HZZO (health). Only the category is shared. Purpose codes and creditor references are on the ledger for the two most recent months only, the rows the app imported itself.
8. **Pillar II is counted as the state's.** `stateSteps = [pensionPillarOne, pensionPillarTwo, incomeTax, health]` (`payrollMonth.ts:175`), and the accountant's "- Država" line does the same. ZDop Art. 17(1)(1) puts pillar II into the employee's individual capitalised savings ([ZDop](https://www.zakon.hr/z/365/Zakon-o-doprinosima)). In September 2026 the state's share is 38% with pillar II and 33% without.
9. **The app cannot check a part month.** `accountantView.ts:183` calls `salaryMonthChecks(workbook, salaries)` with no days worked, so a part month shows "part-month, rules not run" (`payrollReconciliation.ts:152`). It passes only with a `--worked` count of days on the parity script. An employee's start date would give the days. A start on Thursday 4 June 2026 is 19 of 22 weekdays.
10. **Accountant reads are not part of the books.** They exist only for a workbook on Drive with a Drive read token, kept on the device under `hr-doo.accountant.1` (`presentation/taxes/useAccountantDocuments.ts:16`). A browser-only workbook has no payslip side.
11. **Only some salary workbooks are xlsx.** The other months are Google Sheets, read through a Drive xlsx export (`infrastructure/googleAccountantFolders.ts:36-38`). The code lane could not exercise that path locally, so it is unconfirmed. The payment orders and the IP1 payslip PDFs exist for every month.
12. **The core has no staff pay.** The empty workbook seeds `owner-salary` in owner-pay and `payroll-tax` and `social-contributions` in taxes, with no category for an employee who is not the owner (`src/features/workbook/infrastructure/emptyWorkbook.ts:50, 56`). Buckets are `income`, `operating`, `taxes`, `owner-pay`, `financing` and `neutral` (`src/features/workbook/domain/bucket.ts:5`).
13. **No input for taxable extras.** `PayrollMonthInput` has `agreedMonthlyGross` and `overCaps` only (`payrollMonth.ts:20-32`). Overtime, night and Sunday supplements and a taxable bonus belong in the month's gross (Zakon o radu Art. 90 and 94, [ZR](https://www.zakon.hr/z/307/zakon-o-radu)), and ZPDoh Art. 24(2) puts a month's receipts into one base ([ZPDoh](https://www.zakon.hr/z/85/zakon-o-porezu-na-dohodak)).
14. **The loan benefit in kind never reaches payroll.** `loanBenefit` gives a yearly figure (`domain/ownerLoanInterest.ts:99`) that Owner and Year show. No payslip has it. Whether it is grossed up is unconfirmed (`owner-pay.ts:938`).
15. **JOPPD codes are mostly missing.** The ruleset holds `0005` and `0006` only (`owner-pay.ts:590-591`). The page does not need them for v1. They matter only if lines are grouped as the state sees them ([JOPPD form PDF](https://porezna-uprava.gov.hr/UserDocsImages/Arhiva/HR_obrasci/Documents/POREZ%20NA%20DOHODAK/JOPPD.pdf?vel=1253556), Prilog 3 and 4).

What already holds:

- **Engine against the accountant.** `npm run parity:accountant` on the live export, with the days worked given for the part month, reads every xlsx workbook and passes the bank check on each. Every rule line passes apart from one known correction, a part-month total that adds gross I instead of gross II (`payrollReconciliation.ts:52-56`).
- **Engine against the bank.** At the owner's agreed pay with its commuting and meal allowances, the engine matches the bank to the cent for 15 months. The exception is January 2026, where the four small rows of 19 Jan add 0.12 to contributions and 0.02 to tax.
- **Engine figures are traced.** Every line is a `TracedFigure` with rule citations, and the pack already has `FigureDialog.vue` and `BuildUpButton.vue` to show one.
- **A waterfall exists.** `presentation/yearEnd/bridgeChart.ts` draws a waterfall on its side as stacked bars on a transparent base. ECharts registers only bar, line and pie (`src/shared/charts/echarts.ts:16`), and none is needed beyond that.
- **The ring is the right size.** `DonutCard` takes at most five parts (`src/shared/ui/DonutCard.vue:34`).

## The proposed page

### Place and tabs

- **Menu:** Salaries, icon `i-lucide-users`, after Year. The pack adds it, so a company without the pack has no Salaries item (see the decision on core or pack).
- **Tabs** through `PageTabs` and `?tab=`:
  - **Month**, the default. Year and month chips, newest settled month first.
  - **Over time**. A year of worked months.
  - **People**. Shown from two employees up.
- **What moves and what stays:**
  - "Payroll from the accountant" (`presentation/taxes/PayrollReturnsCard.vue`) moves from Year, Accountant to the Month tab as its reconciliation card. Year, Accountant keeps VAT and links here.
  - Owner, Taken keeps its owner-take ring, because it answers what the owner took next to dividend and rent. Its salary slice links here.
  - Year, Taxes keeps the payroll cadence, because it answers whether a tax was paid on time.

### Month tab, top to bottom

1. **Tiles** (`KpiTile`): Cost to the company, Paid to employees, To the state, Problems. A month that is not yet paid is hatched and labelled expected.
2. **Person strip**, one employee only: "Gross 2,000 to net 1,400, paid 12 Oct", with "How it is worked out".
3. **Ring "Where the company's money goes"** (`DonutCard`), out of cost to the company. Health sits on top of gross, so cost is the only whole that adds up. It has five parts:

   | Part                                | September 2026, rounded | Share | Who bears it    |
   | ----------------------------------- | ----------------------- | ----- | --------------- |
   | To the employee (net plus tax-free) | 1,550                   | 63%   | the employee    |
   | Employee's pension fund (pillar II) | 100                     | 4%    | withheld        |
   | Pension insurance (pillar I)        | 300                     | 12%   | withheld        |
   | Income tax                          | 200                     | 8%    | withheld        |
   | Health insurance                    | 330                     | 13%   | on top of gross |

   The `below` slot splits the first part into net 1,400 and tax-free 150. It also lists rent and refunds paid in the same order as "Also paid with this payroll, not pay".

4. **Waterfall "Gross to net"** (`bridgeChart`), on its side: Gross II 2,330, minus health 330, Gross I 2,000, minus pillar I 300, minus pillar II 100, minus income tax 200, Net 1,400, plus tax-free 150, Paid 1,550. Personal allowance and taxable income are tax-base steps, not money leaving, so they stay in the build-up.
5. **Reconciliation card**, collapsed when every line agrees. One row per line, with Payslip, App and Bank columns and a verdict. The bank column is filled for the five lines the bank sees. A differing line opens its build-up. A bank figure drills to Transactions.
6. **Problems** list (see the data model), each with its action: re-file the rows, enter a fact, or read the folder again.

### Over time tab

Stacked bars by worked month, out of cost to the company, in the ring's five parts. A bonus or other extra paid in the month adds a sixth layer, "Extras", in the chart only. The legend is a table underneath. A month not yet worked or paid is hatched and left out of averages (Wave 12 rule). A bar drills to that month on the Month tab.

### People tab, from two employees

A table with Name, Gross, Pension, Income tax, Net, Health, Cost to the company, To the state and Problems, plus a total row. Below container width, To the state and Pension drop first. A row opens that person on the Month tab (`?employee=`).

### Wireframes

One employee (the owner, September 2026, made-up figures):

```
Salaries                                  [2026 v]  Sep Aug Jul ...
[Month] [Over time]
-------------------------------------------------------------------
 Cost 2,480    Paid to employee 1,550    To the state 830    Problems 0
-------------------------------------------------------------------
 Gross 2,000 to net 1,400, paid 12 Oct                [How worked out]
-------------------------------------------------------------------
 Where the money goes (ring)        | Gross to net (waterfall)
   To the employee 1,550   63%      |  Gross II   2,330
   Pension fund (II) 100    4%      |  Health      -330
   Pension (I)       300   12%      |  Gross I    2,000
   Income tax        200    8%      |  Pillar I    -300 ...
   Health            330   13%      |  Paid       1,550
-------------------------------------------------------------------
 Payslip, app and bank agree on 14 lines              (collapsed)
```

Five employees:

```
Salaries                                  [2026 v]  Sep Aug Jul ...
[Month] [Over time] [People 5]
-------------------------------------------------------------------
 Cost 8,9xx    Paid to employees 5,xxx   To the state 2,xxx  Problems 2
-------------------------------------------------------------------
 ring (company total)               | waterfall (company total)
-------------------------------------------------------------------
 Problems
  B. Horvat: payslip net 1,102.40, app 1,102.40, bank 1,092.40   [rows]
  Payroll row on 19 Sep tied to no worked month, 0.12             [rows]
-------------------------------------------------------------------
 Reconciliation, company lines (payslip, app, bank)   (collapsed)
```

People tab on desktop:

```
 Name       Gross   Pension   Tax    Net    Health   Cost   State   !
 A. ...     ...
 B. ...     ...                                                    1
 Total      ...
```

### Phone, 390 px

- Two or three tabs share the width equally.
- Tiles are two by two.
- The ring sits above its list.
- The waterfall is already horizontal, one bar per row.
- People becomes one card per person with a total card last, as `PayrollReturnsCard` does per month.
- Over time shows every second month label.
- Problems stay above the reconciliation card.

### Drills

- A worked figure (gross, allowance, tax and so on) opens `FigureDialog` with the rule citations.
- A paid figure opens Transactions on the rows it was compared with.
- A problem opens whichever of the two fits.
- On a phone a tap shows the tooltip with "View rows" or "How it is worked out", and a second tap drills (`DrillChartCard`).

## Data model

### Employees

A new record kind `hr-doo.employee` on an `employees` tab, one row per person:

- `employee`
- `name`
- `iban`, matched through `counterpartyIdentity` (`src/features/workbook/domain/counterpartyIdentity.ts:26`)
- `residence_city`, `pension_pillar_2`, `dependants`, `birth_year`
- `from`, `to`
- `director` (TRUE for a member who is director)
- `agreed_gross`

The owner's four settings keys (`hr_residence_city`, `hr_birth_year`, `hr_pension_pillar_2`, `hr_dependants`) move into the owner's row. Scenarios, the forecast and the marginal euro read the director's row. This changes which record owns the owner's facts, so it waits for the owner's answer (decision 1).

### A pay month

`salaryMonthChecks` (`payrollReconciliation.ts:106-148`) grows from one `SalaryMonthCheck` per workbook to one per employee and worked month. Each line has three values and a verdict, so no new parallel type is needed. Lines:

| Line                              | Payslip (workbook) | App (engine)   | Bank                        |
| --------------------------------- | ------------------ | -------------- | --------------------------- |
| Gross II, health, gross I         | yes                | yes            | health only                 |
| Pillar I, pillar II               | yes                | yes            | yes, by payee               |
| Income, allowance, taxable income | yes                | yes            | no                          |
| Income tax                        | yes                | yes            | yes                         |
| Net                               | yes                | yes            | in "paid to employee"       |
| Tax-free payments                 | yes                | yes, with caps | in "paid to employee"       |
| Paid to employee                  | yes                | yes            | yes, by the employee's IBAN |
| Extras paid outside the payslip   | payment order      | yes, with caps | yes                         |

### How a bank row finds its month and its person

- **Month.** The worked month comes from "Plaća za M / YYYY" in the description, which every payroll row carries (finding 6). Today's ±5-day window stays only as the fallback for a row without the text.
- **Person.** The employee comes from the payee IBAN on the employee's row.
- **Institutions.** The state lines come from the payee. The payment order names each payee's purpose code, so no category change is needed (decision 2).
- **Several employees.** The institution rows of one payday cover everyone, so the bank checks the state lines as a company total per payday. Per employee, those lines are checked payslip against engine only. Whether the accountant pays institutions in one sum for several employees is unconfirmed.

### What counts as a problem

- Two sources give different figures for a line.
- A source is missing for a month that should have it: no payslip read, no bank rows after payday, or the engine not run because a fact such as the city is blank.
- A payroll-category row is tied to no worked month or no employee, such as the four small rows of 19 Jan 2026.
- Pay the bank shows that no accountant document covers.
- The known accountant correction (the part-month total) is shown as "stated correction", as today, and does not count as a problem.

### Rent and refunds

Rent to the owner and cost refunds ride on the same payroll and are in the accountant's "Ukupni trošak". They are not pay. They stay out of every figure on the page and appear as one line under the ring. The reconciliation already subtracts them (`outsidePayroll`, `salaryWorkbook.ts:46`).

## Core and pack

| Part                                                        | Where                                          | Why                                                           |
| ----------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------- |
| Menu item, page, tabs, ring, waterfall, reconciliation card | hr-doo pack                                    | the lines are Croatian payroll lines                          |
| Employees tab and record kind                               | hr-doo pack                                    | the facts it holds (city, pillar II, dependants) are Croatian |
| Engine, ruleset, workbook and payment order readers         | hr-doo pack                                    | already there                                                 |
| Matching a row to a person by IBAN                          | core, existing                                 | `counterpartyIdentity`                                        |
| Worked month from the description                           | hr-doo pack                                    | the text is the Croatian bank's                               |
| `bridgeChart`                                               | pack, moved from `yearEnd/` to `presentation/` | used by two pages                                             |

A company outside the pack gets nothing in v1 (decision 10).

## Decisions for the owner

### 1. Where employees live

Today the owner's city, pillar II, dependants and birth year are four settings keys, and a second person has nowhere to go.

- **Add an employees tab.** Each person is a row, and your four settings become your row. The five-employee view works, and your start date fixes the part-month check. Cost: your live books move four settings into a row, and about 14 files change.
- **Keep the owner only.** The page shows you from the settings, and the People tab is not built. Cost: the same move later, with the page rebuilt around it.

Recommendation: add the tab.

### 2. Where the accountant's side of extras and the pillar split come from

The 4 Feb 2026 bonuses (1,000 and 500) are in a payment order, not a workbook. Contributions sit in one category for three payees.

- **Read the accountant's payment orders too.** Each transfer names its purpose (net, pillar I, pillar II, health, tax, bonus) and its month. The bonuses get an accountant side, the bank lines match by payee, and the nine Google Sheet months get five paid lines even if the Sheet export fails. Cost: one new reader of a format close to the camt statements the app parses, about 5 files.
- **Split the category and mark extras by hand.** Three rules by payee IBAN file contributions as pillar I, pillar II and health, and bonus categories carry a role per kind. Cost: every contribution row re-filed, and an extra has no accountant side, so it stays a problem.

Recommendation: read the payment orders.

### 3. Pillar II: yours or the state's

September 2026: the state takes 930 as the accountant counts it, or 830 without pillar II's 100.

- **Show it as your pension savings.** The ring and "To the state" leave it out. The reconciliation still compares the accountant's 930 with the engine's 930 under the build-up. Cost: two state figures, explained on the card.
- **Keep it in the state's share.** Matches the accountant. Cost: the page overstates what the state takes.

Recommendation: show it as yours.

### 4. Which month a salary belongs to

December 2025 work was paid in mid-January 2026 and is taxed in 2026.

- **By worked month.** Matches the payslip and the IP1. December sits in 2025, with its January payday beside it. Cost: the page's 2025 total is not the 2025 tax year's.
- **By payday.** Matches the bank and the tax year. Cost: every payslip appears a month later than its title.

Recommendation: by worked month.

### 5. What a tile shows while sources differ

Say a payslip and the engine give 700.00 contributions for a month, and the bank says 700.12.

- **Show the payslip's figure with the difference on it.** "700.00, bank 0.12 more". Year totals carry a problem count. Cost: the tile names a source, though visibly.
- **Show a dash until resolved.** Cost: a month vanishes from the totals over 0.12.

Recommendation: the payslip's figure with the difference shown.

### 6. A month with no payslip read

A browser-only workbook, or no Drive read token, has no payslip side.

- **Show app and bank, with "Payslip not read" as one problem.** Cost: none beyond the banner.
- **Hide the page.** Cost: the page disappears whenever Drive has not been read, and for any browser-only workbook.

Recommendation: show it with the banner.

### 7. Move "Payroll from the accountant" to Salaries

Year, Accountant now checks each workbook against the bank, which is the new page's job.

- **Move it.** One home. Year, Accountant keeps VAT and a link. Cost: the accountant check spans two pages.
- **Keep both.** Cost: the same check in two places, against the Wave 12 rule.

Recommendation: move it.

### 8. When the engine gets an ordinary employee path

Your payslips prove only the director path. An employee on 1,200.00 gross would be computed at 1,295.45 today.

- **Build it as the last stage, on synthetic tests.** Cost: unproven against a real payslip.
- **Build it once the accountant sends an anonymised payslip of an ordinary employee.** Cost: waits on the accountant.

Recommendation: ask the accountant for one sample, and build the stage on synthetic tests meanwhile, marked unproven until it passes.

### 9. The loan benefit in kind

An owner loan at 0% interest gives a small benefit in kind (plan, Stage B). No payslip includes it.

- **Show it on Salaries as "owed through payroll, on no payslip".** Cost: a standing problem each year until you or the accountant act.
- **Leave it on Owner and Year.** Cost: none, but the page's figures leave it out.

Recommendation: show it as a problem with a link to Owner, since gross-up is unconfirmed and the accountant should answer it.

### 10. Core or pack

A company outside Croatia opening the app would see no Salaries item.

- **Pack only for v1.** Smallest build. Cost: a core version later needs a neutral line model (who pays, who receives, taxed or not, contributions or not).
- **Core page with pack lines.** Cost: a core employee record and line model now, with no user to check it.

Recommendation: pack only.

## The owner's answers, 2026-10-26

1 yes, an employees tab with the owner's settings in the owner's own row. 2 no payment orders: the page depends on the bank ledger only (the pillar split from each contribution row's payee, bonuses from their category). 3 pillar II counts as the employee's money, shown beside net pay as savings, not with the state's share (the owner, same day). 4 payday, so the page groups by the month the bank paid, and the ledger stays the one centre. 5 and 6 as recommended (the payslip figure with the difference shown, a month without a payslip shown with a problem). 7 wait, the card stays on Year for now. 8 build the ordinary employee path on made-up test data, which never goes into the owner's books. 9 no: no benefit in kind on Salaries for now. 10 Croatian only first.

## Build stages

Each stage ends with typecheck, the unit tests, both builds, the visual and touch checks named, parity on live11, one review and one commit.

| Stage | What                                                                                                                                                                                       | Files, about        | Needs               |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------- | ------------------- |
| 1     | Employees tab, reader, editor on Salaries, the owner's facts moved to the owner's row, scenarios and forecast read the director row, days worked from `from`                               | 14 files, 600 lines | decision 1          |
| 2     | Payment order reader (`YYYY-MM-payment-order-*.xml`), accountant file kinds extended, salary reader names the employee from `Obračun plaće_<name>` and takes N tabs, `hr-doo.accountant.2` | 9 files, 500 lines  | decision 2          |
| 3     | Reconciliation per employee, month and line: bank by worked-month text, payee and employee IBAN, problems list, extras against caps (`nontaxableUsage`)                                    | 6 files, 450 lines  | 1, 2                |
| 4     | Salaries screen: tabs, tiles, ring, waterfall, reconciliation card moved from Year, People tab, phone layout, links from Owner and Year                                                    | 12 files, 900 lines | 3, decisions 3 to 7 |
| 5     | Ordinary employee engine path: no floor, minimum wage warning, annual max base, taxable extras input                                                                                       | 6 files, 350 lines  | decision 8          |
| 6     | Loan benefit line, if decided                                                                                                                                                              | 3 files, 120 lines  | decision 9          |

The first hub wave moves the pack under `apps/company`. If it lands first, every path above moves with it. Stage 1 also touches `companyFacts.ts`, which the current workflow is editing, so it starts after that commit.

## Proof per stage

**Stage 1**

- Unit: an employee starting Thursday 4 June 2026 works 19 of 22 weekdays.
- Unit: a director row at 2026 values gives gross 1,295.45, pillar I 193.98 (base less the 2.28 relief), pillar II 64.77, income 1,036.70, taxable income 436.70.
- Unit: at the no-decision rates of 20% and 30% (ZPDoh Art. 19.a(5)) the same row gives tax 87.34, net 949.36, health 213.75, gross II 1,509.20. With 150 tax-free, the total cost is 1,659.20 and the paid-out amount 1,099.36.
- Unit: a row with no city is reported.
- Live: live11 opens with your row, and `parity:accountant` passes the part month without `--worked`.

**Stage 2**

- Unit: a fixture `pain.001.001.09` with five transfers reads as five lines by purpose code.
- Unit: the bonus order reads as `results-bonus` 1,000 and `occasional-gift` 500 by its remittance text.
- Unit: a two-tab workbook reads as two employees.
- Unit: a tab whose name matches no employee is reported.
- Live: every payment order reads from the payroll folder.

**Stage 3**

- Unit: five synthetic employees on one payday. One without pillar II (pillar I 20%). One part month. One on 13,000.00 gross, capped at 11,958.00 for pension (pillar I 1,793.70, pillar II 597.90, health uncapped 2,145.00). One with two children (allowance 1,320.00 if `hr.pit.allowance` adds 0.5 and 0.7). The director at the floor. The institution rows sum to the five, and a net row 10.00 short is a problem on that employee only.
- Live: on live11, every paid month agrees on every line.
- Live: January 2026 shows the four rows of 19 Jan as tied to no month.
- Live: the 4 Feb 2026 bonuses agree with the payment order and sit within the caps (results bonus 1,200 a year, gifts 700 a year, NN 16/25).

**Stage 4**

- Browser: visual checks at 390, 768 and 1280 px in light and dark, for one employee (live-shaped fake) and five (fake).
- Browser: a touch run for the two-tap drill.
- Browser: no horizontal scroll, and Year, Accountant without the payroll card.
- Colours: the ring's five tones through the dataviz palette validator. Today only `--bucket-taxes` and `--bucket-owner-pay` relate to pay (`src/shared/styles/tokens.css:164-169`).

**Stage 5**

- Unit: a non-director on 1,200.00 with pillar II gives relief 50.00, pillar I 172.50, pillar II 60.00, income 967.50, taxable income 367.50, tax 73.50 at 20%, net 894.00, health 198.00, gross II 1,398.00.
- Unit: 1,000.00 warns below the 1,050.00 minimum wage.
- Unit: an annual base over 143,496.00 stops pension in the month it is reached.

**By hand, against your IP1 and bank, after stage 4**

- September 2026 on the Month tab: gross, both pillars, allowance, taxable income, tax, net and health equal the IP1 PDF to the cent.
- The paid-on date equals the bank row's date.
- A month with bonuses lists them with their payment order.
- The part month passes.
- Rent appears only under the ring.

## Risks

- **No multi-employee payslip exists.** The N-tab reader is a guess from the tab name. Ask the accountant for a two-employee sample before stage 2 is called done.
- **The Drive export path for the nine Google Sheet months is untested here.** The payment orders cover the paid lines, but not gross or allowance.
- **The owner's rule raises standing problems.** The 19 Jan rows, the loan benefit and any rounding cent will show until resolved. That is the point, but the first view will not be clean.
- **The stray rows need a home.** Re-filing them needs a category for late interest on contributions, which is not in the owner's categories. That is unconfirmed.
- **File names drift.** The July 2026 salary order is filed as `2026-07-payment-order-salary (1).xml`, so the reader must accept the suffix or the file needs renaming.
- **Remittance text is the bank's and the accountant's wording.** A change in "Plaća za M / YYYY" breaks the month tie. The fallback window and a reported problem keep it visible.
- **Benefit gross-up and the JOPPD deadline remain unconfirmed.** RRiF snippet only, Pravilnik not loaded.
- **Sick-leave pay is unconfirmed.** The employer pays first and HZZO refunds later, but the rule was not loaded. It stays out of v1.

## Left out of v1

- The annual settlement refund. It is paid by the tax office to the employee, later.
- JOPPD grouping.
- Caps for jubilee awards, severance and other items ordinary employers pay (codes 60, 26, 20, 70, 67, 68, 74).
- Surtax, which is abolished from 2024 ([NN 114/23](https://narodne-novine.nn.hr/clanci/sluzbeni/2023_10_114_1610.html)) and matters only for books before 2024.
- A core version.

## Sources

Loaded by the research lanes on 2026-10-26. I did not reload them.

- Zakon o doprinosima: https://www.zakon.hr/z/365/Zakon-o-doprinosima
- Zakon o porezu na dohodak: https://www.zakon.hr/z/85/zakon-o-porezu-na-dohodak
- Zakon o radu: https://www.zakon.hr/z/307/zakon-o-radu
- Naredba, 2026 contribution bases, NN 150/25: https://narodne-novine.nn.hr/clanci/sluzbeni/2025_12_150_2237.html
- Minimum wage 2026, NN 132/25: https://narodne-novine.nn.hr/clanci/sluzbeni/2025_10_132_1931.html
- Pravilnik amendments with the tax-free caps, NN 16/25: https://narodne-novine.nn.hr/clanci/sluzbeni/2025_01_16_148.html
- Surtax abolished, NN 114/23: https://narodne-novine.nn.hr/clanci/sluzbeni/2023_10_114_1610.html
- JOPPD form: https://porezna-uprava.gov.hr/UserDocsImages/Arhiva/HR_obrasci/Documents/POREZ%20NA%20DOHODAK/JOPPD.pdf?vel=1253556 and https://porezna-uprava.gov.hr/hr/joppd/3956
- Comparable products, none of which mentions a chart:
  - Zoho: https://www.zoho.com/us/spend/help/admin/analytics/payroll-overview
  - Sage: https://gb-kb.sage.com/portal/app/portlets/results/viewsolution.jsp?solutionid=222001000101644
  - AFAS: https://help.afas.nl/help/en/SE/Pay_Report_Annual.htm
  - Minimax: https://hr-minimax.knowledgeowl.com/help/pdfexport/id/5d19f8faed121c6e6b98e5ce
  - Gusto developer docs: https://docs.gusto.com/embedded-payroll/docs/generate-custom-reports
- Unconfirmed: the Gusto support pages (403), the Xero payroll reports page (empty), the RRiF note on benefit valuation (search snippet), and the JOPPD filing deadline (Pravilnik not loaded).
