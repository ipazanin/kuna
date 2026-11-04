# Tasks

One file per task, named by its slug. A task is a piece of work on Kuna: a feature being researched or planned, a follow-up waiting on something, an idea, or a shipped feature kept here with a link to its plan. The plans and research behind a task live under [features](../features) or [architecture](../architecture), and the task links to them.

Every task file starts with frontmatter that the index below is generated from:

```yaml
---
status: researching
feature: spending
summary: One sentence on what the task is
---
```

`status` is one of `researching`, `planned`, `waiting`, `idea` and `done`. `feature` is a folder name under `docs/features`, or `architecture` for work across the apps. After the frontmatter comes a `# Title` line, then what the task is, the decisions so far, what is open and links to its docs.

After adding a task or changing its frontmatter, run `npm run tasks-index`. `npm test` fails while the index is stale, while a task's frontmatter is wrong, and while a relative link in any doc outside `docs/law` points at a missing file.

<!-- TASKS-INDEX:START -->

### Planned

| Task                                                    | Feature   | Summary                                                                                                                           |
| ------------------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------- |
| [AI help across the apps](ai-assist.md)                 | ai-assist | One AI module and one key shared by every app, to help enter data and explain figures.                                            |
| [Assets v1](assets-v1.md)                               | assets    | A fourth app for a flat, a car and other things the owner has, with values carried forward and the mortgage linked through Loans. |
| [A Croatian company preset](company-croatian-preset.md) | company   | A Croatian d.o.o. preset for the company app's categories, roles and rules, taken from the law.                                   |
| [Personal bank statements](personal-bank-statements.md) | spending  | OTP and Revolut statements read into the spending app.                                                                            |
| [Receipt reading](receipt-reading.md)                   | spending  | A receipt photo read by an AI model with the user's own key, its lines sorted into the spending categories.                       |
| [Spending v1](spending-v1.md)                           | spending  | A personal spending app with accounts, typed spending, two-level categories, budgets and analytics.                               |

### Waiting

| Task                                                           | Feature     | Summary                                                                                                    |
| -------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------- |
| [Check fetched facts with real keys](fetched-facts-check.md)   | investments | The owner tries the fetched fund and company facts with their own vendor keys and reports what comes back. |
| [Open points in investment tax](investment-tax-open-points.md) | investments | Tax readings that stay unconfirmed until a source settles them.                                            |

### Ideas

| Task                                                      | Feature      | Summary                                                                                                |
| --------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------ |
| [Co-owned assets and loans](assets-ownership-share.md)    | assets       | Co-owned assets and loans, counted by the owner's share.                                               |
| [Company facts for the personal apps](company-facts.md)   | company      | The company app publishes owner facts, such as the owner loan, for the personal apps to read live.     |
| [Matching company and personal money](ledger-matching.md) | architecture | Money that crosses between the company and the owner, matched across the company and personal ledgers. |
| [Node 26 script warning](node-26-warning.md)              | platform     | The Node scripts print one ExperimentalWarning on Node 26.                                             |
| [Overview follow-ups](overview-followups.md)              | overview     | Three small things left on Kuna's Overview after it shipped.                                           |

### Done

| Task                                                                | Feature     | Summary                                                                                                        |
| ------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------- |
| [Accountant files from the ledger](accountant-files-from-ledger.md) | company     | The xlsx readers for the accountant's files deleted, with payroll and VAT taken from the ledger.               |
| [Accountant workbooks](accountant-workbooks.md)                     | company     | The accountant's VAT and salary workbooks read from Drive, later replaced by figures from the ledger.          |
| [Bank and informal loans](bank-loans.md)                            | loans       | Bank loans computed from their terms, and informal loans kept as dated movements.                              |
| [One row per client](clients.md)                                    | company     | One clients row per client, with several IBANs.                                                                |
| [Everything configurable](configurable-settings.md)                 | company     | Category colours and everything else configurable inside the app.                                              |
| [Data audit and split rows](data-audit-and-splits.md)               | company     | An audit of the live books and split rows for payments that cover several costs.                               |
| [Design wave](design.md)                                            | platform    | A Kuna home, a sidebar per app, one design library and the redesigned Loans screens.                           |
| [Hub shell](hub-shell.md)                                           | platform    | The company app became the first app inside a thin shell, with the shared kernel and the boundary rules.       |
| [Investments tax](investments-tax.md)                               | investments | A Tax screen with the year's JOPPD figures, sales at HNB's rate, foreign income and the Porezna register.      |
| [Investments views](investments-views.md)                           | investments | Mixes, charts, performance and income views chosen from a study of portfolio apps.                             |
| [Investments](investments.md)                                       | investments | A third app for every buy and sell, with FIFO lots, daily prices and returns.                                  |
| [JSON storage](json-storage.md)                                     | platform    | The books moved from a Google Sheet to one JSON file per app on Drive or in the browser.                       |
| [English and Croatian](language.md)                                 | platform    | English and Croatian through a typed dictionary, chosen per device.                                            |
| [Loan simulations](loan-simulations.md)                             | loans       | Scenarios that try changes to a loan and compare offers side by side.                                          |
| [Onboarding and sync](onboarding-and-sync.md)                       | platform    | A first run that sets the books up, one sync on open and mail filed by the app.                                |
| [Kuna Overview](overview.md)                                        | overview    | Kuna's own Overview, leading with Investments less loans and what the owner could take out of the company now. |
| [Owner benefit from company costs](owner-benefit.md)                | company     | The owner's share of shared company costs as a shadow figure, with official tax figures untouched.             |
| [Owner monthly net](owner-monthly-net.md)                           | company     | The owner's monthly net with what is left in the company.                                                      |
| [Owner page with a time filter](owner-period.md)                    | company     | One time filter for both tabs of the Owner page.                                                               |
| [Rename to Kuna](rename.md)                                         | platform    | The app, its address, its repo and its stored names became Kuna.                                               |
| [Salaries](salaries.md)                                             | company     | A Salaries screen comparing the payslip, the payroll engine and the bank for each month.                       |
| [Second storage](second-storage.md)                                 | platform    | A shared store, one sync over every file and Loans as an empty second app with its own file.                   |
| [Simpler loan simulator](simple-loan-simulator.md)                  | loans       | A four-field scenario dialog, equal principal loans and tries saved on a loan's page.                          |
| [A simpler UI](simpler-ui.md)                                       | platform    | Nineteen menu items became eight, with tabs inside pages and one home per figure.                              |
| [Statements in the app](statements-in-the-app.md)                   | company     | Bank statements parsed by the app, with the script only fetching and filing them.                              |
| [Storage boundary](storage-boundary.md)                             | platform    | Repositories per record kind, one unit of work per write, record ids and the pack seam.                        |
| [Year end and planning](year-end-and-planning.md)                   | company     | The year-end cross-check, the Croatian ruleset as an app module, the forecast and pay scenarios.               |

<!-- TASKS-INDEX:END -->
