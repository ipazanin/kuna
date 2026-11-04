# H3: bank loans and informal loans

How the Loans app gets its first real records, a bank loan with a computed schedule and an informal loan with dated movements, checked against 1b3a7c9 and the owner's own plan, with the decisions it needs from the owner.

Built from four lanes: [loan mechanics and Croatian law](research/bank-loans/lane1-loan-mechanics.md), the owner's loans reproduced (not published), [what the code has](research/bank-loans/lane3-codebase.md) and [how other tools do loans](research/bank-loans/lane4-product.md). Checked against the repo at 1b3a7c9. The lane reports carry the sources, article numbers and line references.

## What the research settled

- **Kuna can compute the owner's bank plan exactly.** Six terms rebuild all 240 instalments of the housing loan to the cent: principal, drawdown, first instalment date, number of instalments, and two rate periods (a fixed rate for instalments 1 to 120, a variable one after). The rules are the ones three Croatian banks publish: monthly interest is the balance times the yearly rate over 12, rounded to the cent, the principal is the instalment less that interest, the last instalment takes what is left, and a rate change recomputes the instalment on the remaining balance over the remaining months. The same rules also reproduce HPB's published APN example (431.37, 433.57 last, 55,295.40 interest), which becomes the spec fixture, so no figure of the owner's goes into the repo.
- **APN is a fixed monthly amount over a counted number of instalments.** The law has the state pay 30% to 51% of the instalment for five years, and APN's decision fixes the euro amount (Zakon o subvencioniranju stambenih kredita, članak 11 and članak 17). In the owner's plan it is one fixed amount for instalments 1 to 60. It settles interest first and leaves principal and balance alone. Children born during the subsidy add two years each, so the count must be editable.
- **A housing loan has no early repayment fee.** Zakon o stambenom potrošačkom kreditiranju, članak 26 stavak 2. Shorter term or lower instalment is the bank's choice to offer, and HPB offers both.
- **An informal loan is an opening balance and a list of dated movements, with no interest.** The civil code covers advances, repayments, repayment in kind and forgiveness. The owner's private loan also keeps a plan line, a fixed amount a month down from the opening balance, and the gap to it.
- **The storage is ready.** A record kind is a codec plus write rules in `src/shared/storage/domain`. Saving, retry after another device's save, Undo and writes across several kinds work as they are. Field names chosen now are close to permanent, because there is no data migration, only a version gate.
- **No tool on the market starts from the bank's plan.** Ledgers keep a loan as a balance and planners project from today. Kuna computing the bank's own plan exactly is the strength to build on.

## What you will see

- **Loans Overview:** one card per loan. A bank loan shows what you owe today, the next payment with your share and the full instalment, when the subsidy ends and what you pay after, the payoff date, and interest this year and left. An informal loan shows what you owe and the last movement. One line above the cards totals what you owe.
- **A bank loan's page:** the same figures on top, a balance-over-time chart, then the plan grouped by year with yearly totals, the current year open. A phone shows date, your share and balance per row, and a tap shows interest and principal. Below the plan: rate periods, the subsidy, and extra payments.
- **An informal loan's page:** the balance over time, then the movements, newest first, each with its kind and note.
- **Late instalments:** every instalment counts as paid on its due date. When one went out later, you give it the day it was paid, and its row reads "paid 8 Dec, 18 days late".
- **Adding and changing:** dialogs for a bank loan (its terms), a rate period, the subsidy, an extra payment, a late instalment, an informal loan and a movement. Every save has the same toast with Undo as the company screens.
- **What if I pay extra:** a panel on the bank loan's page that never saves. You type an amount and a date, and it shows both effects side by side: a shorter term (new payoff date, months and interest saved) and a lower instalment (new instalment, interest saved). Applying it turns it into an extra payment.
- Interest is the bank's figure. The subsidy shows on its own line, so the year's interest reads like "4,200.00 interest, of which APN paid 1,500.00".

## The model

Six kinds, each with a UUID from its first write, all at schema version 1, since today's Loans files hold no records. Bank loans and informal loans are separate kinds, because they share almost no fields and different children point at them.

| Kind              | Fields                                                                                                                                                                                                        | Notes                                                                                                                                                                                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `bank-loan`       | name, lender (text), principal, drawdown date, first instalment date, instalments, interim interest (amount and date, optional), subsidy per month, first subsidised instalment, subsidised instalments, note | Always money you owe. Instalments fall monthly on the first instalment's day, clamped to the month's end. The interim interest is the amount the bank charged, typed, not recomputed.                                                                        |
| `rate-period`     | loan, from (the first instalment date at this rate), yearly rate, fixed or variable, note                                                                                                                     | The first period starts at the first instalment. Periods may not overlap or leave a gap. The rate is text with up to four decimals ("3.10", "2.143"), read into an exact integer. Index and margin go in the note. The rate the bank applied is what counts. |
| `extra-payment`   | loan, date, amount, shorter term or lower instalment                                                                                                                                                          | Recomputes the plan from its date. No fee field, since the law bans one on a housing loan.                                                                                                                                                                   |
| `late-instalment` | loan, due date of the instalment, the day it was paid                                                                                                                                                         | Only for an instalment that went out late. It changes when the row counts as paid, not the plan. Late interest the bank charges is not modelled.                                                                                                             |
| `informal-loan`   | name, counterparty (text), you owe or owed to you, opening balance, start date, note                                                                                                                          | No plan and no interest.                                                                                                                                                                                                                                     |
| `movement`        | loan, date, borrowed, borrowed in kind, repaid, repaid in kind, or forgiven, amount, note                                                                                                                     | Borrowed and borrowed in kind (the lender paid for something of yours) raise the balance, the others lower it. A balance below zero reads as "they owe you".                                                                                                 |

Deleting a loan removes its rate periods, extra payments, late instalments or movements in the same write, and one Undo puts them all back.

The schedule is computed every time, never stored. It is a pure function in the Loans domain over a bank loan and its children, in integer cents. The figures the Overview, a later dashboard tile (H4) and net worth (H8) need are pure functions beside it: balance on a day, next payment, payoff date, interest per year, subsidy left.

## Stages, one commit

0. **Shared moves, no behaviour change.**
   - `dividedRounded` moves from the hr-doo pack to `src/shared/money` (7 callers).
   - `useRecordWrites` and `rowsInWords` move to `src/shared/storage/presentation` and take the store as a parameter (25 files). Loans and company then save the same way.
   - A day stepped by whole months, clamped to the month's end, joins `src/shared/calendar`. `overlapOf` moves to `dateRange.ts` (3 callers).
   - Company figures identical, by `check:figures` on the four fake sets and the live file.
1. **The Loans domain.** The six kinds with codecs, readers and write rules (a child names a loan the file has, periods don't overlap, a date isn't before the loan starts, delete takes the children). The rate type. The schedule: interim interest row, annuity per rate period at fixed maturity, extra payments with either effect, the subsidy split, the last instalment taking the rest. Paid so far, counting a late instalment from its paid day. The informal balance. Specs with HPB's published example and hand-worked figures: a rate change mid-term, an extra payment both ways, an instalment on the 31st, a subsidy larger than the month's interest, borrowing back.
2. **Screens.** The Overview cards, the two loan pages, the dialogs and the what-if panel, from the shared cards, tabs, tiles, `ChartCard` and the billing dialog's shape. The plan table drops columns by container width, so nothing scrolls sideways on a phone. An empty Loans file keeps today's empty state and its `loans-empty` test id.
3. **Checks.** A fake seed with made-up loans of both kinds, a rate change, a subsidy and borrowing back, plus the empty file. The visual check adds the Overview with loans, both loan pages and an editor flow (add, change, delete, Undo). The touch check adds the pages and an extra payment entered and undone by touch. `check:figures` learns `--loans <file>`. The storage contract suite takes any app's document, so the Loans kinds join it.

Size: medium to large, about 70 files, a third of them the toast move.

## Proof

- `check:figures` on the company sets is identical after stage 0 and at the end.
- The schedule from the owner's six terms equals the bank's plan on all 240 rows, compared from the session scratch copy of the Sheet. Nothing of it is committed.
- HPB's published example reproduces exactly in the specs.
- On the fake build: add a loan, see its plan, add a rate period and an extra payment, see the plan change, mark an instalment late, undo each.
- Quick checks locally, the full visual and touch suites in CI.
- Last, with your yes, you enter both loans on your real Drive file locally, and the Overview shows what each owes today.

## The owner's loan, from the contract

Read from the loan contract, 2026-10-28, and the owner's answers the same day:

- A bank housing loan of 240 monthly annuities. Part of it is subsidised.
- A fixed rate for the first 10 years. After that 3M EURIBOR plus a fixed margin, reset quarterly (2 January, 1 April, 1 July, 1 October). The later rate in the bank's plan is EURIBOR at signing plus the margin, so the plan after the fixed years is the bank's guess.
- APN pays 30% of the annuity of the subsidised part, a fixed amount a month, for the first 60 instalments. The owner pays the rest of the instalment and the bank collects the subsidy from APN. A child born or adopted during the subsidy adds two years.
- No fee for early repayment. Repaying early during the subsidy, or within two years after it ends, means paying the subsidy back (article 6.5 of the contract).
- No extra payments made so far.

What this changes in the build:

- A variable rate period marks the rows it computes as an estimate, and the rate period's note holds the index and margin.
- The what-if panel warns when the date falls within the subsidy or two years after it, since the subsidy would have to be paid back.
- The four negative months of the private loan are the lender paying for things of the owner's (two purchases), so they are `borrowed in kind`.

## Settled without asking

- **Bank loans are annuities only.** Linear, grace periods and bullet loans are out, since none of your loans use them and no Croatian housing offer the research loaded does. Adding one later is a new choice value on the loan, not a new kind.
- **Interest is rounded half up**, which is what `moneyFromAmount` already does for positive amounts. Your plan never lands on a half cent, so it can't tell, and HPB's example agrees.
- **Monthly views use calendar months.** Your Sheet sums the private loan from the 21st to the 20th. The balance on any day is the same either way.
- **No currency setting yet.** Both loans are in euros.
- **Left out of this wave:** statement matching (H6), the company's loans to you (H5), dashboard tiles (H4), the asset link (H8), reminders (they live in Calendar), saved scenarios, a target-date solver, PDF import, interest on informal loans, and refinancing as a flow.

## Decisions for the owner

The owner, 2026-10-28:

- A bank loan gets in by typing its terms, and Kuna computes the plan.
- Every instalment counts as paid on its due date by default, and the owner can enter a delay when one went out late.
- The private loan keeps only movements and a balance, with no plan.
- The language wave goes after H3.

The questions as asked:

1. **How a bank loan gets in.** Today the plan sits pasted in your Sheet. Kuna can compute it from the terms, and does so exactly for your loan.
   - _Type the terms, and Kuna computes the plan_ (recommended). One dialog, and what-ifs and rate changes work from the same engine. Cost: a bank that rounds differently would show cents of difference with nothing to compare against.
   - _Also paste the bank's plan, and Kuna checks the two agree._ Catches a wrong term the day you enter it. Cost: a paste reader, a stored copy of the bank's rows and a comparison view, about a stage more.
2. **Which instalments count as paid.** In this wave Kuna reads no bank statements.
   - _Each instalment counts as paid on its due date_ (recommended). Nothing to enter each month, right for a direct debit. Statements confirm them from H6.
   - _You mark each payment._ Kuna knows a missed or late one. Cost: twelve entries a year.
3. **The private loan's plan.** Your Sheet tracks a fixed amount a month down from the opening balance and how far ahead you are.
   - _Keep an optional plan per month and show ahead or behind_ (recommended), since you track it today.
   - _Only movements and a balance._ Simpler, and the plan gap goes.
4. **Where the language wave goes.** Below.

Facts, answered by the owner on 2026-10-28 and in the section above:

- The private loan's dated movements sit on another tab of the Sheet. The owner said to read what is needed. They go into the owner's Loans file at the end of the wave, with the owner's yes.

## The language wave: English and Croatian

The owner, 2026-10-28: add a wave for several languages, English and Croatian first.

What it covers, to be researched before planning:

- A translation layer for every screen's text (184 Vue files today, plus toasts, refusals, problem texts and chart descriptions in TypeScript), a language choice on This device, and the browser's language as the default.
- Number and date formats follow the language, while each app's money format stays its own.
- What stays untranslated: the stored file (field names, kinds, record text), the Croatian legal and accounting terms the hr-doo pack cites, and names in your data.
- Plurals and word order in Croatian ("1 red", "2 reda", "5 redova"), which rules out gluing strings together.
- How the checks prove it: a missing-key check in CI, and the visual check run in Croatian at least at 360 px, since Croatian text runs longer.

Where it goes in the queue changes its cost:

- _After H3_ (recommended). The wave sweeps every screen once, the Loans screens with them. H3 lands sooner.
- _Before H3._ The Loans screens are written in both languages from the start. Loans waits a wave, and the sweep is as large either way.
