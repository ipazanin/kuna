---
checked: 2026-11-04
nn_through: 59/26
summary: What the accounting act asks of a d.o.o.'s books, why Kuna ships no chart of accounts, and what the accountant decides that Kuna only estimates
---

# Books and kontos

What the law asks of a d.o.o.'s books, and where Kuna stands beside them. Law as researched on 4 November 2026, in the consolidated text of the Zakon o računovodstvu through NN 59/26, its last amendment. No later issue was checked.

## What the law asks

The Zakon o računovodstvu (ZoR) asks for double-entry books (Art. 11(1)) kept as a journal, a general ledger and subsidiary ledgers (Art. 11(2)). The ledger runs on "unaprijed pripremljenih konta koja, u skladu s potrebama poduzetnika, osiguravaju podatke za godišnje financijske izvještaje" (Art. 11(7)). Micro and small entrepreneurs draw up their statements under the HSFI (Art. 16(2)).

Mark: `confirmed-consolidated`.

## No chart of accounts

No act prescribes a chart of accounts. The HSFI set the statements, not the kontos. The RRiF chart most accountants use is a privately published book. So konto numbers are the accountant's practice, and Kuna ships none.

Kuna reads the accountant's kontos from the year-end tab. Where the year-end lines name a konto, Kuna places a category by its first two digits, and where they do not, on the line its [tax class](tax-classes.md#profit-and-loss-lines) names (`packs/hr-doo/domain/accrual/categoryLines.ts`).

Mark: `confirmed-consolidated`.

## What the accountant decides

Kuna estimates the profit, the taxes and the owner's pay from the bank rows, through the [tax class](tax-classes.md) of each category. The accountant keeps the books and decides:

- the booking and the konto of each document
- the judgement calls: whether a meal with a client is representation, whether a gift goes to a partner or an employee, the private share of a mixed-use cost, and which supplies are personal car costs
- the PD and VAT returns

Where the two differ for a closed year, the Year screen sets Kuna's figures beside the accountant's, and the accountant's figure wins.

## Sources

- Zakon o računovodstvu, consolidated, "na snazi od 10.06.2026.", NN 85/24 to 59/26: Art. 11(1), 11(2), 11(7) and 16(2). https://www.zakon.hr/z/118/zakon-o-racunovodstvu, loaded on 4 November 2026.
- RRiF-ov računski plan za poduzetnike, 28th edition, March 2025, a book sold at https://www.rrif.hr/rrif_ov_racunski_plan_za_poduzetnike-300-knjiga/
