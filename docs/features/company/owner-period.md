# Owner page with a time filter

Design for one period filter over both Owner tabs: where the bar sits, what every tile, card, chart and list means under a period with fake-data figures, the elements that need a real change, the decisions the owner makes and the files it touches.

Read-only design on the Owner worktree (`ledgerboard-owner-wt`, detached at facccb0, with the seven Owner changes of 2026-10-26 uncommitted). Taken already follows the filter bar inside its own panel. Who owes whom counts the whole ledger whatever the filters. The aim is one period for both tabs.

Every figure below comes from the fake workbook (newest booking 8 Oct 2026, ledger May 2025 to Oct 2026), worked out by a scratch script that runs the domain functions the screens use. "Last 12 months" is Oct 2025 to Sept 2026. "2025" is Jan to Dec 2025, which the ledger covers from May.

## 1. The filter bar

The bar moves out of `TakenPanel` into the `above` slot of the Owner `PageTabs`, as Analysis does. Both tabs then share one period, and on a phone the Filters button ends the tab row. "Taken" and "Who owes whom" add up to more than 16 characters, so the button keeps its icon and count and drops the word.

It offers the same six presets as Taken today, and so as every other page: last 3 months, last 12 months, year, quarter, custom and all time. The period is the shared one, so Owner opens on whatever period the person last chose elsewhere.

The bar also carries the account, category and other chips. Taken keeps following them. Who owes whom follows the period only (decision 2).

## 2. Every element under a period

Readings: **period rows** counts the rows dated in the period. **State at the end** reads the books as they stood on the period's last day. **All time** ignores the period and says so on the card.

"Today" is what the screen shows now, which for Who owes whom is the same whatever the period.

### Taken

| Element                                              | Reading                                       | Last 12 months, today                        | Last 12 months, proposed | 2025, today                              | 2025, proposed |
| ---------------------------------------------------- | --------------------------------------------- | -------------------------------------------- | ------------------------ | ---------------------------------------- | -------------- |
| Owner take tile                                      | Period rows, no change                        | €22,223                                      | €22,223                  | €14,579                                  | €14,579        |
| Benefits from company costs tile                     | Period rows, no change                        | €385, 14 payments                            | same                     | €766, 9 payments                         | same           |
| Gross cost of the owner tile                         | Period rows, no change                        | €29,274                                      | €29,274                  | €18,459                                  | €18,459        |
| Net share of gross cost tile                         | Period rows, no change                        | 76%                                          | 76%                      | 75%                                      | 75%            |
| Monthly net pay tile                                 | Period rows, no change                        | €1,849 over 12 months                        | same                     | €1,446 over 8 months                     | same           |
| Owner take by type ring                              | Period rows, no change                        | €22,185 without loans, Loans, net €38        | same                     | €11,566 without loans, Loans, net €3,013 | same           |
| Reimbursements line under the ring                   | Period rows, no change                        | €213 to the owner                            | same                     | none, line hidden                        | same           |
| Loan balance beside the ring                         | State at each month's end, no change          | 13 bars, Oct 2025 €13 to Oct 2026 so far €38 | same                     | 8 bars, May €0 to Dec €3,013             | same           |
| Owner pay by month                                   | Period rows, no change                        | 13 months, €22,262 with Oct so far           | same                     | 8 months, €14,579                        | same           |
| Benefits card, ring                                  | Period rows, no change                        | €385                                         | same                     | €766                                     | same           |
| Benefits card, dividend comparison (browser variant) | Period rows, each year at its rate, no change | avoided €80.07, net €304.86                  | same                     | avoided €159.27, net €606.47             | same           |

### Who owes whom

| Element                                  | Reading                                                               | Last 12 months, today                      | Last 12 months, proposed           | 2025, today     | 2025, proposed               |
| ---------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------ | ---------------------------------- | --------------- | ---------------------------- |
| Net owed tile                            | State at the end                                                      | €77, owner owes                            | −€85 at 30 Sept 2026, company owes | €77             | €3,013 at 31 Dec 2025        |
| Reimbursements with no cost on file line | All time, labelled                                                    | 1 waits on Review                          | 1                                  | 1               | 1                            |
| Loans card header                        | Owed at the start, lent and repaid in the period, owed at the end     | Lent €3,038, repaid €3,000, still owed €38 | €0, €3,038, €3,000, €38            | as today        | €0, €3,013, €0, €3,013       |
| Loan list                                | Loans with a balance during the period, as they stood at its end      | 3 loans, 2 open                            | 3 loans, 2 open at 30 Sept         | 3 loans, 2 open | 2 loans, both open at 31 Dec |
| Costs paid privately, header             | Owed at the start, paid and reimbursed in the period, owed at the end | Paid €336, reimbursed €374, owed −€38      | €0, €336, €213, €123               | as today        | none, empty state            |
| Costs paid privately, list               | Costs open during the period, as they stood at its end                | 3 costs                                    | 3 costs                            | 3 costs         | none                         |
| Loans to the owner, by month             | Lent and repaid as period rows, balance at each month's end           | 18 months, last €38                        | 13 months, last €38 (Oct so far)   | 18 months       | 8 months, last €3,013        |

Header buttons stay as they are. Compare pay mixes opens the year after the newest booking. Missing roles says what no category carries. Add advance is in section 3.

The l12 Net owed shows why the period's end matters. The reimbursements to the owner of 5 Oct 2026 come after 30 Sept, so on that day the company owed the owner €123 for costs and the owner owed €38 on loans. That makes −€85. The €77 of today counts October too, and its one unaccounted reimbursement is an October one.

## 3. What needs a real change

- **Net owed, the loan book and the costs paid privately.** Cut the rows and advances at the period's last day, then run the same matching. `owedByOwner` in `domain/dividend/owedByOwner.ts` and the year-end balance sheet in `domain/accrual/accrualBalanceSheet.ts` already do exactly this for a single day. The tile caption names the day, such as "at 30 Sept 2026".
  - One catch: repayments are matched with look-ahead, so a later repayment can steer which loan an earlier one closes. A loan can then read open, or closed by another payment, in the 2025 view, unlike the all-time view. That is what the books said on that day, and the card's subtitle should say so.
- **The loans and costs headers.** Three all-time figures become four that reconcile: owed at the start, lent (or paid by the owner), repaid (or reimbursed), owed at the end. The drills move from `{ preset: 'all' }` to the period, and the two balance figures drill to the rows up to their day. Today `ownerLoans` and `ownerAdvances` build their drills with `preset: 'all'`, so this is a domain change, not only a view change.
- **The loan list and the cost list.** List what was open at any point in the period: lent or paid before its end, and not closed before its start. Each shows its remaining amount and repayments as of the end. A repayment after the end does not show. The empty states say "No loan had a balance in 2025" and "No cost paid privately in 2025".
- **Loans to the owner, by month.** Its months become the period's, as on Taken. Its balance line then repeats the loan balance bars beside the ring for the same months (decision 4).
- **Card subtitles and definitions.** "All time", "since the ledger began" and "whatever the filters" on Who owes whom become the period's words, and `OwedPanel`'s doc comment changes with them.
- **The reimbursements line.** "1 reimbursement with no cost on file waits on Review" is a job, like Overview's waiting card, so it stays all time with "whatever the period" in it (decision 5). The reimbursements under the ring on Taken already follow the period and need nothing.
- **Add advance.** Its default date stays the newest booking. Under a past period the new cost lands outside the view and the Who owes whom list does not show it, so the toast says "Outside the period in view" with a link that opens it (decision 6).
- **Benefits card.** No change. It already reads the period's benefits year by year, with each year's corporate rate from Year's forecast seen on the newest booking. Under "2025" that is 2025's rate.
- **Taken.** Only the bar moves. Every Taken element already follows the period.

## 4. Decisions for the owner

1. **Which day should a rolling period's balances stand on?** On Who owes whom with "last 12 months", Net owed reads −€85 on 30 Sept 2026, the period's last day, or €77 on 8 Oct, the newest booking.
   - _Stand on the period's last day:_ every figure on the page covers the same days, and the caption names the day. The default view then no longer shows what is owed today, and "All time" does.
   - _Stand on the newest booking for rolling periods:_ the default view shows today's balance. The take tiles stop at September while the balance counts October, so the page mixes two ends.
   - Both cost the same. I recommend the period's last day, with the day in the caption.
2. **Should Who owes whom follow the account, category and text filters?** With an account filter, Net owed would count loans paid from one account only, which is not a debt anyone owes.
   - _Follow the period only:_ the chips stay set for Taken, and a line on Who owes whom says they do not apply there. This is a small view change.
   - _Follow every filter:_ the balances can be partial and misleading.
   - I recommend following the period only.
3. **What should the loan list hold under a period?** A loan lent in Dec 2025 and repaid in May 2026 shows as open in the 2025 view.
   - _Loans with a balance during the period, as at its end:_ the list and the header reconcile, and the lists change with the period.
   - _Loans lent in the period, as they stand today:_ simpler, but an older loan still open in the period is missing, and "still owed" no longer adds up with the tile.
   - I recommend the first option, the same for the costs list.
4. **The month-end loan balance would show twice.** It is the bars beside the ring on Taken and the line in "Loans to the owner, by month" on Who owes whom, over the same months.
   - _Drop the line from the Who owes whom chart:_ that chart keeps lent and repaid as bars, and Taken keeps the balance. One line of chart code goes, and the legend loses one entry.
   - _Keep both:_ the two tabs each read on their own, at the cost of the same figure in two places.
   - I recommend dropping the line.
5. **Should the "waits on Review" line follow the period?** At 30 Sept 2026 it would read nothing, though a reimbursement waits today.
   - _Keep it all time, saying "whatever the period":_ it stays a to-do.
   - _Count it at the period's end:_ it matches Net owed, but it hides work that waits.
   - I recommend keeping it all time.
6. **Where should a new advance land under a past period?**
   - _Default to the newest booking, and say in the toast when the advance falls outside the period:_ this is a small change in `AdvanceDialog`.
   - _Default to the period's last day:_ a cost typed while looking at 2025 lands in 2025. That is easy to do by mistake.
   - I recommend the first option.

The owner's answers, 2026-10-26: yes to all six recommendations.

## 5. Files it touches

| File                                                                | Change                                                                                       | Size                   |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------- |
| `src/packs/hr-doo/presentation/OwnerScreen.vue`                     | Bar into the `above` slot                                                                    | Small                  |
| `src/packs/hr-doo/presentation/TakenPanel.vue`                      | Bar out                                                                                      | Small                  |
| `src/packs/hr-doo/presentation/OwedPanel.vue`                       | Period on every figure, four-figure headers, list cuts, chart months, wording, filters note  | Large, about 120 lines |
| `src/packs/hr-doo/domain/ownerLoans.ts`                             | The book at a day with the period's flows and drills, the list of loans open during a period | Medium, about 80 lines |
| `src/packs/hr-doo/domain/ownerAdvances.ts`                          | The same for the costs paid privately                                                        | Medium, about 60 lines |
| `src/packs/hr-doo/domain/dividend/owedByOwner.ts`                   | Shares the cut at a day with the above, or is replaced by it                                 | Small                  |
| `src/packs/hr-doo/presentation/packCharts.ts`                       | Drop the balance line from `loanTimelineChart` if decision 4 says so                         | Small                  |
| `src/packs/hr-doo/presentation/AdvanceDialog.vue`                   | Toast for an advance outside the period                                                      | Small                  |
| `src/packs/hr-doo/presentation/LoanList.vue`, `AdvanceList.vue`     | Empty states that name the period                                                            | Small                  |
| `tests/hrDooOwnerLoans.spec.ts`, `tests/hrDooOwnerAdvances.spec.ts` | Worked figures at a day and over a period, the look-ahead case                               | Medium                 |
| `scripts/visual-check.mjs`, `scripts/touch-check.mjs`               | Who owes whom with `p=all`, a year and l12, the Filters button on the tab row                | Small to medium        |
| `README.md`                                                         | Owner paragraphs, phone layout list                                                          | Small                  |

That is about 14 files and 400 to 500 changed lines, in one wave after the seven changes land. `accrualBalanceSheet`, `yearEndOpenItems` and dividend capacity call `ownerLoans` and `ownerAdvances` as they are, so the new functions sit beside the old ones and those callers do not change.
