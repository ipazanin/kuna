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

## Share capital on the balance sheet

The balance sheet's line Temeljni (upisani) kapital holds the capital the company registered, a fact of the company rather than a figure the other lines work out. The form in Prilog I of the Pravilnik o strukturi i sadržaju godišnjih financijskih izvještaja (NN 107/25, for years that start on 1 January 2025 or later) lists, under "PASIVA A KAPITAL I REZERVE", the line "I TEMELJNI (UPISANI) KAPITAL", and on the other side "AKTIVA A POTRAŽIVANJA ZA UPISANI A NEUPLAĆENI KAPITAL". So the line holds the capital registered, and what is not yet paid in shows as a receivable rather than lowering it. The Pravilnik of NN 95/16, 144/20 and 158/23, which covered the years before 2025, names the line the same way.

A d.o.o. registers at least 2,500.00 euros: "Najniži iznos temeljnog kapitala društva je 2500,00 eura, ako ovim Zakonom nije drukčije određeno" (ZTD Art. 389(2), as NN 114/22 Art. 12 worded it).

Kuna takes the line from the accountant's latest balance sheet on the year-end tab, for that year and the years after, and shows whatever the other lines leave beside it as an unexplained difference on the Year balance sheet card and as an open item on Year end. Before any balance sheet states it, the line shows what the other lines leave for it, with no open item. Screen: Year, balance sheet and open items.

Mark: `confirmed-nn` for the line's name and the receivable beside it, and for the minimum capital. Taking the filed figure over what the other lines leave is how Kuna reads its own books, not a rule of the act.

## Sources

- Zakon o računovodstvu, consolidated, "na snazi od 10.06.2026.", NN 85/24 to 59/26: Art. 11(1), 11(2), 11(7) and 16(2). https://www.zakon.hr/z/118/zakon-o-racunovodstvu, loaded on 4 November 2026.
- Pravilnik o strukturi i sadržaju godišnjih financijskih izvještaja, NN 107/25 of 30 July 2025, Art. 10 (applies to years that start on 1 January 2025 or later), Art. 11 (repeals the Pravilnik of NN 95/16, 144/20 and 158/23), Art. 13 (in force on the eighth day after publication) and Prilog I, Bilanca. https://narodne-novine.nn.hr/clanci/sluzbeni/2025_07_107_1530.html, loaded on 23 November 2026.
- Pravilnik o strukturi i sadržaju godišnjih financijskih izvještaja, NN 95/16 of 20 October 2016, Prilog I, Bilanca, as NN 158/23 of 29 December 2023 Art. 3 replaced it from 1 January 2024 (Art. 6 and 7). https://narodne-novine.nn.hr/clanci/sluzbeni/2016_10_95_2052.html and https://narodne-novine.nn.hr/clanci/sluzbeni/2023_12_158_2517.html, loaded on 23 November 2026. An NN title search of 2025 and 2026 found no amendment of NN 107/25.
- Zakon o izmjenama Zakona o trgovačkim društvima, NN 114/22 of 3 October 2022, Art. 12 (Art. 389(2) to 2,500.00 euros) and Art. 24 (in force on the day the euro was introduced). https://narodne-novine.nn.hr/clanci/sluzbeni/2022_10_114_1712.html, loaded on 23 November 2026. The zakon.hr consolidated ZTD, "na snazi od 04.12.2024.", NN 111/93 to 136/24, marks Art. 389 last changed by NN 114/22, and an NN title search of 2025 and 2026 found no amendment of the act.
- RRiF-ov računski plan za poduzetnike, 28th edition, March 2025, a book sold at https://www.rrif.hr/rrif_ov_racunski_plan_za_poduzetnike-300-knjiga/
