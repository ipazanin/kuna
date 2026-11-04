# Loans simulations lane 2: Croatian loan mechanics

Annuity and rounding, EKS and its formula, fees, variable rates and caps, early repayment, the APN subsidy, refinancing and honest comparisons, checked against Croatian law, HNB rules, EU directives and a bank's published examples.

Read-only research on Kuna HEAD 755e1ed, 2026-10-29. Code paths are relative to the repo at that commit. Every figure in the worked examples is made up, except the HPB representative examples, which are the bank's own public figures. The screens this feeds are in [design-plan.md](../../../platform/design-plan.md) and [lane3-loans-design.md](../../../platform/research/design/lane3-loans-design.md).

## Short version

- **A new law lands on 20 November 2026.** The Zakon o potrošačkim kreditima (NN 86/2026) replaces both the consumer credit law (ZPK) and the housing consumer credit law (ZSPK). Contracts signed before that date stay under the law they were signed under, except for the interest-rate caps. A simulation of an existing loan uses the old rules. An offer signed from 20 November uses the new ones. For a simulation the two laws give nearly the same rules.
- **Kuna's plan maths matches how a Croatian bank prints its plan.** Kuna uses yearly rate over 12, rounds each month's interest to the cent and lets the last instalment take what is left. A Python copy of those rules reproduces all four of HPB's 2025 representative examples to the cent: instalment, total interest and interim interest.
- **Kuna can compute an EKS for an offer.** The formula is the EU APRC equation. HNB says to round it to two decimals. With the same timing assumptions HPB states, the four HPB examples come out at the bank's printed EKS exactly. The inputs Kuna needs are principal, drawdown date, interim interest, rate periods, term and every mandatory fee with its timing. Notary costs stay out.
- **Housing loans signed since 20 October 2017 have no early repayment fee and no processing fee.** Other consumer loans may charge up to 1% (0.5% in the last year), but only during a fixed-rate period and only on the part above EUR 10,000 in 12 months.
- **A variable rate is a reference rate plus a fixed margin, and it is capped.** New contracts may use only EURIBOR, SARON or SOFR. Older ones may still use NRS. For a EUR housing loan the rate may not go above the HNB's average rate on existing housing loans plus one third. That cap is checked at every reset and is 3.84% for 1 July to 31 December 2026. A rate-shock scenario has to clamp at the cap.
- **The APN subsidy is a share of each instalment, by law, for five years plus extensions.** The law only claws it back when repayment stops, the bank calls the loan or the home is sold. It says nothing about voluntary early repayment or refinancing. The 24-month rule Kuna applies comes from the loan contract and could not be confirmed from a public source.
- **Refinancing is honest only from today.** Take the balance owed today, the same remaining term and every one-off cost (notary, valuation, insurance, lost subsidy). Then show the monthly saving and the month the costs are paid back.
- **Total interest across different terms misleads.** At a discount rate equal to the loan's own rate every repayment choice is worth the same today. A "money left in your pocket" view at a rate the user types makes this visible without jargon.

## Which law applies

| Loan                  | Signed                   | Law                                       | Early repayment fee                                 | Processing fee                                         |
| --------------------- | ------------------------ | ----------------------------------------- | --------------------------------------------------- | ------------------------------------------------------ |
| Housing consumer loan | 20.10.2017 to 19.11.2026 | ZSPK (NN 101/17, 128/22, 156/23)          | Not allowed (art. 26)                               | Not allowed (art. 17(4))                               |
| Other consumer loan   | to 19.11.2026            | ZPK (NN 75/09 and amendments to 156/23)   | Up to 1% or 0.5%, fixed-rate periods only (art. 16) | Allowed                                                |
| Housing consumer loan | from 20.11.2026          | Zakon o potrošačkim kreditima, NN 86/2026 | Not allowed (art. 51(2))                            | Not allowed (art. 45(2))                               |
| Other consumer loan   | from 20.11.2026          | same                                      | Up to 1% or 0.5%, fixed-rate periods only (art. 50) | Allowed, tied to the lender's actual cost (art. 45(1)) |

Housing loans signed before 20 October 2017 fell under the ZPK. The new law's article 109(1) keeps it off older contracts, except article 41(4) and articles 43(1)-(4) and 44(1)-(4), which are the nominal-rate caps. Article 119 sets entry into force on 20 November 2026, and article 118 repeals the ZPK and the ZSPK.

## Annuity maths and rounding

**The instalment.** With balance P, yearly rate i, monthly rate r = i / 12 and n instalments, the instalment is P × r × (1 + r)^n / ((1 + r)^n − 1), rounded half up to the cent. HPB writes this as "dekurzivne metode i proporcionalnog kamatnjaka": interest at the end of each period, at the yearly rate divided by 12. Kuna does the same in exact integers (`src/apps/loans/bankLoans/domain/yearlyRate.ts:37-54`). Some banks may use the conforming monthly rate, (1 + i)^(1/12) − 1, but no current Croatian sheet that does so turned up. That stays unconfirmed.

**Each row.** The month's interest is the balance times i / 12, rounded to the cent. The rest of the instalment repays principal. The last instalment takes whatever balance is left, so it differs from the others by a few cents. This is `loanPlan.ts:111-116`.

**Check against a bank.** HPB's 2025 fixed-rate housing loan sheet prints four representative examples for EUR 120,000 over 360 instalments. A Python copy of Kuna's rules gives the same figures to the cent:

| Rate  | Instalment | Interest over the term | Interim interest | EKS printed | EKS computed |
| ----- | ---------- | ---------------------- | ---------------- | ----------- | ------------ |
| 2.89% | 498.83     | 59,580.75              | 289.00           | 3.38%       | 3.38%        |
| 3.09% | 511.77     | 64,235.92              | 309.00           | 3.21%       | 3.21%        |
| 3.49% | 538.18     | 73,747.32              | 349.00           | 3.98%       | 3.98%        |
| 3.69% | 551.66     | 78,598.28              | 369.00           | 3.80%       | 3.80%        |

These four rows make good unit tests for `loanPlan` and for a future EKS function. The figures are public and are not the owner's.

**Interim interest.** It covers the days from drawdown to the start of repayment. HPB's examples assume drawdown on 1 January and interim interest on 1 February, which comes to exactly one month at i / 12 (120,000 × 2.89% / 12 = 289.00). How banks count the days for a drawdown mid-month was not confirmed. Kuna stores the amount the bank charged (`src/apps/loans/workbook/domain/bankLoan.ts:5-9`), which sidesteps the question for real loans. A simulated offer needs either the bank's figure or an estimate of balance × i × days / 365, clearly labelled as an estimate.

**Grace period (poček).** HPB's terms allow a grace period inside the term during which only interest is paid. Kuna has no such row kind. A simulation of an offer with a poček would need one.

**A rate change.** When a rate period starts, the bank works the instalment out again on the balance over the instalments left, so the end date stays. Kuna does this at `loanPlan.ts:106-110`. The law asks the bank to send the new number and amount of instalments and a new plan with the notice (new law art. 40(2)).

**How a plan is stated.** The plan (otplatni plan) lists each due date with the instalment, its principal, its interest and the balance left. The EU Consumer Credit Directive requires that breakdown and a note that the figures hold only until the rate changes (Directive 2008/48/EC art. 10(2)(i)). The ZSPK gives the borrower a free plan on request at any time, with the EKS as of that day (art. 12(2)).

## The effective interest rate (EKS)

**Definition.** The EKS expresses the total cost of the credit to the consumer as a yearly percentage of the credit amount. It equates the present value of everything the consumer receives with everything they pay (ZSPK art. 17(1), ZPK art. 2(1)(9), new law art. 11(1)(5)).

**Formula.** HNB's Odluka o efektivnoj kamatnoj stopi (NN 105/2017) uses the EU equation:

Σ C_k × (1 + X)^(−t_k) = Σ D_l × (1 + X)^(−s_l)

X is the EKS. C_k are drawdowns and D_l are payments of instalments and charges. t_k and s_l are the times from the first drawdown in years. A year is 365 days (366 in a leap year), 52 weeks or 12 equal months, and an equal month is 30.41666 days. An interval that is not a whole number of months is a whole number of months plus days (Directive 2014/17/EU Annex I). HNB asks for two decimals (Odluka art. 5(2)(d)). The EU minimum is one.

**Assumptions.** The contract runs to its end and both sides pay on time. A variable rate and variable costs stay at their level on the day of calculation. For a fixed period followed by a variable rate, the rate after the fixed period is the rate on the day of calculation, but never lower than the fixed rate (Odluka art. 6(3) and 7(1)(5), new law art. 41(3)).

**What goes in.** Interest, interim interest, fees the lender knows about, taxes, mandatory ancillary services such as insurance, account costs when the account is a condition, and property valuation where it is needed (new law art. 11(1)(51)). Insurance counts as mandatory unless the consumer can choose and cancel it at no extra cost (Odluka art. 6(7)).

**What stays out.** Notary fees (ZPK art. 2(1)(7), new law art. 11(1)(51)(f)), property transfer tax (Odluka art. 6(8)), fees for breaking the contract (ZPK art. 20(2)) and optional services.

**The HPB check.** The four examples above reproduce exactly with these timings: drawdown at t = 0, interim interest at one month, 360 instalments from month two, property insurance of EUR 33.18 at the start of each of 30 years, a EUR 2.00 payment order at t = 0, the EUR 1.89 monthly account fee from month one for 361 months (client rates only) and the 4.56% credit protection premium at t = 0 (CPI rates only). An older HPB sheet from 2023 came out 0.02 points below the bank's printed figure with the same method. A bank does not always print every input behind its EKS.

**What Kuna can show.** Kuna can show an EKS for any offer the user enters. It needs:

- principal and drawdown date
- interim interest, or the date repayment starts
- rate periods (fixed rate, or index plus margin for the variable part, held at today's value)
- number of instalments
- each mandatory fee with its timing: one-off at drawdown, monthly or yearly

Call it "Kuna's estimate" and show the bank's printed EKS beside it when the user types one in. Leave the APN subsidy out, because the bank's EKS is the cost of the whole loan. A rate on the user's own share is a different figure and needs a different name. The EKS also assumes the loan is held to the end, so it is the wrong figure for someone who expects to sell or refinance in seven years.

**Legal caps.** The EKS of a housing loan may not exceed the statutory default interest rate. For other consumer loans the cap is that rate plus two points (ZPK art. 20a, new law art. 42). HNB's table for 1 July to 31 December 2026 gives 5.40% and 7.40%. Kuna could flag an entered offer above the cap, but that is a nicety.

## Fees

| Fee                                           | When                              | In the EKS                              | Notes                                                                                        |
| --------------------------------------------- | --------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------- |
| Processing fee (naknada za obradu)            | One-off at drawdown               | Yes                                     | Banned for housing loans since 2017. Allowed for other consumer loans, tied to actual cost.  |
| Property valuation (procjena)                 | One-off before drawdown           | Yes, when required                      | HPB's 2025 terms say the bank pays for one valuation, except when refinancing its own loans. |
| Property insurance                            | Yearly                            | Yes, mandatory with a mortgage          | HPB uses an average of EUR 33.18 a year.                                                     |
| Credit protection insurance (CPI)             | One-off at drawdown in HPB's case | Yes, when it is a condition of the rate | HPB: 4.56% of the principal for a 0.20-point lower rate.                                     |
| Account fee                                   | Monthly                           | Yes, when the account is a condition    | HPB's client rate needs the salary paid into an HPB account.                                 |
| Payment order                                 | Per payment or one-off            | Yes                                     | Small.                                                                                       |
| Notary (solemnizacija, zadužnica)             | One-off at signing                | No                                      | Usually the borrower's.                                                                      |
| Mortgage release letter (brisovno očitovanje) | One-off at payoff                 | No                                      | Capped at the bank's actual cost.                                                            |
| Default interest                              | On late amounts                   | No                                      | At the statutory default rate.                                                               |

**Conditional rate discounts.** HPB's client rate is 0.60 points below its regular rate. If salary payments into the HPB account stop for three months in a row, the borrower loses the discount for the rest of the term. A simulation should model this as a rate period from a chosen date, the way Kuna already models any rate change. The HPB table also shows why the nominal rate alone misleads: 2.89% with CPI has a higher EKS (3.38%) than 3.09% without it (3.21%).

## Variable rates

**Structure.** The rate is the agreed reference value plus a fixed margin, and the margin may not rise during repayment. In one reference period the rate may not change by more than the reference value changed, in percentage points, up or down (ZSPK art. 24, new law art. 38(3) and 38(5)).

**Reference rates.**

- New contracts may use only EURIBOR, SARON, SOFR, a legal replacement or another index under Regulation (EU) 2016/1011 (ZSPK art. 24(2) as consolidated, ZPK art. 11a(2), new law art. 38(2)).
- The 2017 ZSPK also allowed NRS, Ministry of Finance treasury bill yields and LIBOR. Existing contracts keep them (ZPK art. 11a(5)). Which amendment removed NRS for new contracts was not confirmed.
- EURIBOR is set by EMMI every TARGET2 day around 11:00 CET for 1 week and 1, 3, 6 and 12 months.
- NRS is the average funding cost of Croatian banks. HNB has published it quarterly since the 31 March 2020 reporting date (HUB did before). It comes in NRS1, NRS2 and NRS3 by deposit base, each for 3, 6 and 12 months.

**Resets.** The contract sets them. HPB's terms use 6-month EURIBOR, reset after 1 January and 1 July, with the value from 20 November and 20 May. In Kuna each reset is a rate period starting at the first instalment after it. The model already fits.

**Notice.** At least 15 days before the new rate applies. If the notice is late, the increase moves to the next period (ZSPK art. 27, new law art. 40(1) and 40(5)). For a non-housing consumer loan, a rate increase opens three months in which the borrower may repay with no fee (ZPK art. 11a(6), new law art. 40(4)).

**Caps.** The nominal rate of a variable-rate EUR housing loan may not exceed the average weighted rate on existing EUR housing loans plus one third of it. For other consumer loans the cap is that average plus one half. HNB publishes the averages in January and July. The cap is checked at signing and again at every reset, using the cap in force on that day (new law art. 44(3)-(4), which applies to existing contracts too). HNB's table for 1 July to 31 December 2026 lists 3.84% for variable EUR housing loans and 8.00% for other variable EUR consumer loans. After a fixed period the variable rate may not exceed the cap that applied on the signing date (art. 44(5)).

**What banks must disclose.** For a variable-rate housing loan without a cap, the ESIS shows an illustrative EKS and a worst-case instalment at the highest borrowing rate in at least the last 20 years (Directive 2014/17/EU Annex II, Part B, sections 4 and 6). With a cap, it shows the instalment at the cap. ECB monthly averages since 2005 put the 20-year highs at 5.22% for 6-month EURIBOR (September 2008) and 5.39% for 12-month EURIBOR (July 2008). The lows were about −0.54% and −0.50% in 2021. 6-month EURIBOR averaged 2.92% in September 2026. How a contract treats a negative index (a floor at zero or not) depends on the contract and was not confirmed.

**How a rate-shock simulation should work.**

1. Start the shock at the first reset after the fixed period ends, never in the middle of a period.
2. At each reset, rate = min(reference path + margin, cap). Recompute the instalment on the balance over the instalments left.
3. Offer a few named paths: rates stay, +1 point, +2 points and the 20-year high. Let the user type a custom path.
4. Show the new instalment, the change from today and the total still to pay.
5. Say that the cap moves twice a year and follows market rates with a lag. Today's cap is a ceiling for the next half-year, not for the life of the loan.

A made-up example: EUR 100,000 over 300 months at 6-month EURIBOR 2.50% plus a 1.20 margin, so 3.70%. The instalment is 511.41. If EURIBOR is 2 points higher at the first reset a year later, the uncapped rate of 5.70% would give 622.15. A cap of 3.84% holds it at 518.79 until the cap moves.

## Early repayment

**Caps.**

- Housing loans signed since 20 October 2017: no fee, partial or full, whatever the rate type (ZSPK art. 26(2), new law art. 51(2)).
- Other consumer loans: a fee only during a fixed-rate period. It is at most 1% of the amount repaid if more than a year is left and 0.5% if less. It applies only to the part above EUR 10,000 repaid in 12 months and never exceeds the interest the borrower would have paid until the end (ZPK art. 16, new law art. 50).
- No fee when an insurance policy repays the loan, for overdrafts, or where no fixed rate applied in the period repaid.

**Notice.** Neither law sets a notice period. The bank must give the figures promptly when asked in writing (ZSPK art. 26, new law art. 49(2)-(4)). Banks' own forms may ask for a written request some days ahead. That was not confirmed for any one bank.

**Shorter term or lower instalment.** The law only says early repayment lowers the cost for the remaining term. Whether the borrower keeps the instalment and ends sooner, or keeps the end date and pays less each month, is the bank's procedure and the contract's. Kuna models both (`src/apps/loans/workbook/domain/extraPayment.ts:5-6`).

**Framing the choice honestly.** A made-up example: EUR 10,000 extra on a EUR 100,000 balance with 240 instalments left at 3.5%.

| Choice           | Instalment | Instalments left | Interest saved |
| ---------------- | ---------- | ---------------- | -------------- |
| Shorter term     | 579.96     | 207              | 9,191.13       |
| Lower instalment | 521.96     | 240              | 3,918.56       |

At 3.5%, the loan's own rate, both payment streams are worth exactly EUR 90,000 today. The bigger interest saving of the shorter term only reflects paying the bank sooner. It is the better deal only when the borrower's spare money would earn less than the loan costs. The What if panel prints "Interest saved" for each choice (`WhatIfPanel.vue:88` and `:101`). That is true, but it should not read as a ranking.

## APN subsidised housing loans

Zakon o subvencioniranju stambenih kredita, NN 65/17, 61/18, 66/19 and 146/20. Public calls under it took applications until 31 December 2023 (art. 1(2)).

**How it works.**

- The state pays part of each monthly instalment for the first five years. The share depends on the development group of the town: 51%, 48%, 45%, 42%, 39%, 36%, 33% or 30% (art. 11(1)).
- Only the part of the loan up to EUR 100,000 is subsidised (art. 9), with a repayment term of at least 15 years. Only the price up to EUR 1,500 per square metre counts (art. 8).
- The EKS may not exceed 3.75% in the first five years (art. 11(2)). In the next two years it may rise by at most 10% of the first-period EKS, so a 3.50% EKS could go to 3.85% (art. 11(3)).
- Extensions: one year per child under 18 at APN's decision (art. 13(1)), two years per child born or adopted during the subsidy (art. 13(2)) and two years for a disability of at least 50% (art. 12).
- APN pays the bank a year ahead, within eight days after the first instalment of the year falls due (art. 14(1)).

**When it has to be paid back.** If the borrower stops repaying, the bank calls the loan, or the home is sold during repayment, the bank returns the subsidy paid to APN within a month (art. 24(1)). This does not apply once two years after the subsidy period have passed, or when the home is sold to buy or build a bigger one (art. 24(2)). The home may not be rented out until two years after the subsidy ends (art. 22).

**What the law does not say.** The word for early repayment does not appear in the law, and neither does refinancing. Kuna's 24-month window (`src/apps/loans/bankLoans/domain/whatIf.ts:15-16`) follows the loan contract. It lines up with the two years in art. 24(2), but no public source confirms that a voluntary early repayment triggers the return. Treat the contract as the authority and say so on screen.

**Interest first.** The law says the subsidy pays part of each instalment. It does not say it pays interest first. Kuna's split (`loanFigures.ts:38-47`) only changes how a payment is labelled, never the balance, so it is harmless.

**What this means for simulations.**

- An extension for a child born during the subsidy adds instalments to the subsidy. The user needs a way to try that.
- The subsidy is a share of the instalment. If the instalment changes inside the subsidy period, for example a variable rate in an extended year, the amount changes too. Kuna stores a fixed monthly amount (`bankLoan.ts:11-19`). How APN recalculates was not confirmed.
- Repaying in full or refinancing inside the window makes the subsidy received so far a cost of that move, on top of losing the subsidy still to come.

## Refinancing

**Costs.**

- Old bank: an early repayment fee (none for housing loans since 2017) and the mortgage release letter.
- New bank: processing fee (none for housing loans), valuation (often paid by the bank), notary for the pledge agreement and the zadužnica, land registry entries, new insurance policies or assignments, CPI when the rate needs it, account fees when the rate needs client status.
- An APN loan: the subsidy to come, and possibly the subsidy received.

Notary and land registry amounts were not confirmed and should be user inputs.

**Comparing honestly.**

1. Start from today's balance and today's date. Interest already paid is sunk and plays no part.
2. Use the same remaining term, unless the user deliberately changes it, and then show that separately.
3. Add every one-off cost to the new loan.
4. Show the monthly saving, the month the one-off costs are paid back and the total still to pay on each side.
5. Run a variable offer under the same rate paths as the current loan.

A made-up example: EUR 120,000 left, 216 instalments at 4.2%, against an offer at 3.4% with EUR 1,500 of one-off costs. The instalment falls from 792.69 to 743.55, a saving of 49.14 a month. The costs are paid back after 31 months. Interest still to pay falls from 51,222.18 to 40,607.01. Stretching the new loan to 300 instalments would lower the instalment much more but pay more interest, which is the trap step 2 prevents.

## Honest and misleading comparisons

**Honest:**

- Same balance, same start date, same term: compare instalment and total to pay.
- EKS between offers of the same term and type, taken from the bank's sheet or worked out by Kuna with all mandatory fees.
- Total cost from today, with one-off fees and any subsidy lost or repaid.
- Variable offers under named rate paths, capped, including the 20-year high.
- The payback month for refinancing.
- Present value or "money left in your pocket" at a rate the user can see and change.

**Misleading:**

- Total interest across different terms. A 30-year loan always shows more interest than a 20-year one.
- The nominal rate alone. The HPB example above has the lower rate with the higher EKS.
- Comparing from the loan's first day instead of today.
- Treating a variable rate as fixed at today's level. The EKS does this by law, which is why the rate paths matter.
- "Interest saved" by an extra payment, without what that money could have earned.
- An EKS over the full term when the user plans to sell or refinance early. Up-front fees weigh much more over a short horizon.
- Counting the subsidy as cheaper interest while ignoring that it can be clawed back.

**Does a discount rate help?** Yes, as a second view next to the plain totals. A made-up example: EUR 150,000 at 3.5% over 20 or 30 years.

|                        | 20 years  | 30 years  |
| ---------------------- | --------- | --------- |
| Instalment             | 869.94    | 673.57    |
| Interest over the term | 58,785.57 | 92,483.30 |
| Worth today at 2%      | 171,965   | 182,232   |
| Worth today at 3.5%    | 150,000   | 150,000   |
| Worth today at 5%      | 131,818   | 125,473   |

The "money left in your pocket" version says the same thing in plainer words. Take the 30-year loan and put the 196.37 difference into savings each month. After 20 years the 30-year loan still owes 68,114.58. At 2% the savings pot is about 57,900, which leaves the borrower about 10,200 worse off than with the 20-year loan. At 3.5% the two come out even. At 5% the pot is about 80,700, so the borrower is about 12,600 better off.

The pocket view needs only one number from the user, "what your spare money earns after tax", and it answers the question people actually ask. Default that rate to empty, never to a guessed number, and show the plain totals until the user fills it in.

## Unconfirmed

- Day counting for interim interest on a mid-month drawdown.
- Whether any Croatian bank uses the conforming monthly rate today.
- Which ZSPK amendment removed NRS from the list for new contracts.
- That a voluntary early repayment or refinancing of an APN loan triggers the subsidy's return. Only the contract says so.
- How APN recalculates the subsidy if the instalment changes.
- Notary, land registry and release letter amounts.
- How each bank handles a negative reference rate, and its written-request lead time for early repayment.
- EUR-Lex refused automated access. The directive texts were read from the legislation.gov.uk copies of Directives 2014/17/EU and 2008/48/EC.

## Sources

All loaded on 2026-10-29.

- [Zakon o potrošačkim kreditima, NN 86/2026](https://narodne-novine.nn.hr/clanci/sluzbeni/2026_08_86_1071.html): arts. 11, 38, 40, 41, 42, 44, 45, 49, 50, 51, 109, 118, 119.
- [Zakon o stambenom potrošačkom kreditiranju, NN 101/2017, original](https://narodne-novine.nn.hr/clanci/sluzbeni/2017_10_101_2318.html): arts. 12, 17, 23, 24, 26.
- [ZSPK consolidated text on zakon.hr](https://www.zakon.hr/z/945/Zakon-o-stambenom-potro%C5%A1a%C4%8Dkom-kreditiranju) (a private consolidation, not the official gazette): arts. 17, 24, 25, 26, 27.
- [ZPK consolidated text on zakon.hr](https://www.zakon.hr/z/517/Zakon-o-potro%C5%A1a%C4%8Dkom-kreditiranju): arts. 2, 11, 11a, 11b, 11c, 16, 20, 20a.
- [HNB Odluka o efektivnoj kamatnoj stopi, NN 105/2017](https://narodne-novine.nn.hr/clanci/sluzbeni/full/2017_10_105_2417.html): arts. 4 to 7. The equation is an image there, and the symbols and rules are in the text.
- [HNB table of maximum rates, 1 July to 31 December 2026](https://hnb.hr/documents/d/guest/h-tablica_max-nks-eks-1)
- [HNB NRS page](https://www.hnb.hr/nrs)
- [Zakon o subvencioniranju stambenih kredita on zakon.hr](https://www.zakon.hr/z/925/Zakon-o-subvencioniranju-stambenih-kredita): arts. 1, 8, 9, 11 to 14, 21, 22, 24.
- [HPB terms, fixed-rate housing loan, 2025](https://hpb.hr/UserDocsImages/krediti/2025/Uvjeti%20o%20stambenom%20kreditu_FIX_KS.pdf?vel=93777): representative examples, fees, interest method, client discount.
- [HPB terms, APN housing loan, 2023](https://www.hpb.hr/UserDocsImages/krediti/APN/Uvjeti%20o%20stambenom%20potro%C5%A1a%C4%8Dkom%20kreditu%20na%20temelju%20Zakona%20o%20subvencioniranju%20stambenih%20kredita_03_2023.pdf): 6-month EURIBOR reset dates, EKS assumptions.
- [Erste methodology for variable rates, 2022](https://cdn0.erstegroup.com/content/dam/hr/ebc/www_erstebank_hr/misc/opci-uvjeti-poslovanja/gradjani/2652022-metodologija-utvrdivanja-promjene-kamatnih-stopa-na-kredite-u-primjeni-od-1062022.pdf): NRS definition and the move from HUB to HNB.
- [Directive 2014/17/EU, Annex I](https://www.legislation.gov.uk/eudr/2014/17/annex/I), [Annex II](https://www.legislation.gov.uk/eudr/2014/17/annex/II), [art. 17](https://www.legislation.gov.uk/eudr/2014/17/article/17) and [art. 25](https://www.legislation.gov.uk/eudr/2014/17/article/25)
- [Directive 2008/48/EC, art. 10](https://www.legislation.gov.uk/eudr/2008/48/article/10)
- [EMMI, Euribor](https://www.emmi-benchmarks.eu/benchmarks/euribor/)
- [ECB data API, monthly EURIBOR 3M, 6M and 12M](https://data-api.ecb.europa.eu/service/data/FM/M.U2.EUR.RT.MM.EURIBOR6MD_.HSTA?format=csvdata&startPeriod=2005-01) (series EURIBOR3MD_, EURIBOR6MD_, EURIBOR1YD_)
- [tportal guide to early repayment, May 2026](https://www.tportal.hr/biznis/clanak/prijevremena-otplata-kredita-kada-se-isplati-i-koju-opciju-odabrati-20260503): a secondary source, used only to confirm that the choice of shorter term or lower instalment is set by the bank and the contract.
