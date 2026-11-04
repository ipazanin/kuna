---
checked: 2026-11-04
nn_through: 126/26
summary: Every deadline of a resident investor in one table, per payment and per year, with the dates for 2026 income, how a deadline moves past a weekend, and the file that owns each
---

# Filing calendar

Every deadline the other files describe, in one place. This file is an index. Each row names the file that owns the rule. A change is made there first, then copied here. Kuna works the dates out in `tax/domain/taxDeadlines.ts`. Law as researched on 4 November 2026.

## Per payment

| When                                                               | What                                                                                 | Rule                                  | Owner                                                                                          |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | ------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Within 8 days of the year's first payment with tax withheld abroad | INO-IZJAVA, the written statement that nothing is paid in Croatia during the year    | ZPDoh Art. 81(3), PravPDoh Art. 89    | [Foreign capital income](foreign-capital-income.md#tax-withheld-abroad-ino-izjava-and-ino-doh) |
| Within 30 days of a payment with nothing withheld abroad           | Pay the tax and file a JOPPD, type 8, marked with the day received                   | ZPDoh Art. 81(1), PravPDoh Art. 79(1) | [Foreign capital income](foreign-capital-income.md#nothing-withheld-the-30-day-joppd)          |
| Within 30 days of a referral credit                                | Pay the pension contributions and the tax at the city's lower rate, and file a JOPPD | ZDop Art. 115(2), PravPDoh Art. 55(8) | [Other investment income](other-investment-income.md#referral-credits)                         |

## Yearly

Deadlines for income of year Y fall in Y+1.

| When                                    | What                                                                                                                                                 | Rule                                   | Owner                                                                                          |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 31 January                              | INO-DOH for income with tax withheld abroad                                                                                                          | ZPDoh Art. 81(4), PravPDoh Art. 90(8)  | [Foreign capital income](foreign-capital-income.md#tax-withheld-abroad-ino-izjava-and-ino-doh) |
| Last day of February                    | JOPPD for capital gains, report mark of 31 December, and the tax paid. None for lots under two years in a year whose losses on them exceed the gains | ZPDoh Art. 70(4), PravPDoh Art. 77(13) | [JOPPD for investors](joppd-for-investors.md#due-dates)                                        |
| 15 days after the rješenje is delivered | The INO-DOH balance Porezna uprava assesses                                                                                                          | ZPDoh Art. 81(6)                       | [Foreign capital income](foreign-capital-income.md#tax-withheld-abroad-ino-izjava-and-ino-doh) |
| 30 November                             | Last day to send a confirmation of foreign tax not in hand by 31 January                                                                             | ZPDoh Art. 81(4)                       | [Foreign capital income](foreign-capital-income.md#tax-withheld-abroad-ino-izjava-and-ino-doh) |

## Dates for 2026 income

| What                        | Date                                              |
| --------------------------- | ------------------------------------------------- |
| INO-DOH                     | Monday 1 February 2027, safe by Friday 29 January |
| JOPPD and capital gains tax | Monday 1 March 2027                               |
| 30 November proof           | Tuesday 30 November 2027                          |

## Weekends and holidays

OPZ Art. 4 applies ZUP to tax procedure. ZUP Art. 81(2): "Kad zadnji dan roka pada u nedjelju, na blagdan ili u drugi dan kad javnopravno tijelo ne radi, rok istječe prvoga sljedećega radnog dana." Porezna uprava treats a Saturday as such a day. It applied the move to 2025 gains: "do 2. ožujka 2026. (obzirom da je 28. veljače 2026. neradni dan)".

Kuna moves the JOPPD date and the INO-DOH date past a weekend to the next weekday. No Croatian public holiday falls at the end of January, the end of February or on the first days of February and March, so Kuna does not look for one. It gives the weekday on or before 31 January as the safe day for the INO-DOH, which is due whether the move holds or not.

Kuna does not move the 8-day and 30-day dates. Filing on the day itself is never late, so that is the cautious choice.

Mark: `reading`, which Porezna uprava applies to the JOPPD. Screen: A reading.

## Open points

- Whether a payment, as against a filing, moves past a weekend in the same way. Porezna uprava's notice moves both for capital gains.

## Sources

- ZPDoh, Zakon o porezu na dohodak: NN 115/16 to 152/24. Art. 70(4), 81. <https://www.zakon.hr/z/85/Zakon-o-porezu-na-dohodak>, loaded 4 November 2026.
- PravPDoh, Pravilnik o porezu na dohodak: NN 10/17 to 157/25. Art. 55(8), 77(13), 79(1), 89, 90(8). <https://porezna-uprava.gov.hr/Propisi/GetBasicData/4>, loaded 4 November 2026.
- ZDop, Zakon o doprinosima: NN 84/08 to 152/24. Art. 115(2). <https://www.zakon.hr/z/365/Zakon-o-doprinosima>, loaded 4 November 2026.
- OPZ: NN 115/16 to 151/25. Art. 4. ZUP: NN 47/09, 110/21. Art. 81(2). zakon.hr consolidated texts, loaded 4 November 2026.
- Porezna uprava notice for 2025 gains, 13 January 2026, <https://porezna-uprava.gov.hr/hr/oporezivanje-kapitalnih-dobitaka-i-izvjescivanje-putem-obrasca-joppd-8281/8281>, loaded 4 November 2026.
