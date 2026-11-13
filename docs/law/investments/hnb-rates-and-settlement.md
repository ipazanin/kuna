---
checked: 2026-11-04
nn_through: 126/26
summary: Which HNB list converts a sale or a payment in a foreign currency, how it relates to the ECB rate of the day, the settlement day as the day of payment, US and EU settlement cycles, and TARGET closing days
---

# HNB rates and settlement

Which exchange rate turns a dollar gain or dividend into euros, and which day that rate is of. Kuna works this out in `tax/domain/hnbRate.ts`, `settlementDay.ts` and `workingDays.ts`, from the ECB rates in the prices file. Law as researched on 4 November 2026.

## Which HNB list

ZPDoh Art. 12(8) converts at "srednjeg tečaja koji Hrvatska narodna banka objavljuje na dan isplate", and PravPDoh Art. 11(4) repeats "kojeg Hrvatska narodna banka objavljuje na dan isplate". The rate is the one HNB publishes on the day of payment.

HNB's API documentation: "Tečajna lista za klijente HNB-a objavljuje se svakoga radnog dana platnog sustava TARGET u periodu između 15:30 i 17 sati". Each list carries a `datum_primjene`, the day it applies, which is the next day. The rows loaded on 4 November 2026 match the ECB's USD reference rate of the TARGET day before their `datum_primjene`:

| HNB `datum_primjene`    | HNB USD middle rate | ECB USD rate | ECB day    |
| ----------------------- | ------------------- | ------------ | ---------- |
| Fri 30 Oct 2026         | 1.113000            | 1.1130       | Thu 29 Oct |
| Sat 31 Oct to Mon 2 Nov | 1.117200            | 1.1172       | Fri 30 Oct |
| Tue 3 Nov 2026          | 1.121600            | 1.1216       | Mon 2 Nov  |
| Wed 4 Nov 2026          | 1.117900            | 1.1179       | Tue 3 Nov  |

So the list HNB publishes in the afternoon of day D carries the ECB rate of D. Reading "objavljuje na dan isplate" as the list published on D, Kuna converts at the ECB rate of D, which its prices file stores under D. A weekend or TARGET holiday has no list of its own and takes the last one before it. The other reading is the list applied on D, which is the ECB rate of the TARGET day before.

Example from these rates. A 200.00 dollar gain settling on Tuesday 3 November 2026 converts at 1.1179, the list HNB published on 3 November, and gives 178.91 euros. The list applied on 3 November, 1.1216, would give 178.32.

While the prices file has no rate for D yet, Kuna uses the newest rate and marks the euros as approximate.

Mark: `reading`. Screen: A reading.

## The settlement day as the payment day

The rate is of the "dan isplate", the day the proceeds are paid, and ZPDoh Art. 11(3) counts receipts by the cash principle. For a sale that is the settlement day, which also picks the sale's tax year, see [Capital gains](capital-gains.md#which-year-a-sale-counts-in). A dividend or interest payment converts at its own payment day.

A trade read from IBKR's report keeps the day the report gives, its `settleDateTarget`. That is the day IBKR means to settle, so a settlement that fails would pay later. Kuna estimates the settlement day of every other trade from its trade day by the cycles below, and the Sales tab says so.

Mark: `reading`. Screen: A reading.

## Settlement cycles

- **US markets.** The SEC "adopted rule changes to shorten the standard settlement cycle for most broker-dealer transactions in securities" "from two business days after the trade date (T+2) to one (T+1)", with "The compliance date for the final rules is May 28, 2024" (press release 2023-29, 15 February 2023). Kuna settles a dollar instrument one weekday after a trade from 28 May 2024, and two before. Mark: `confirmed-table`.
- **EU trading venues.** CSDR Art. 5(2): for transferable securities executed on trading venues, "the intended settlement date shall be no later than on the second business day after the trading takes place." Regulation (EU) 2025/2075 replaces that with "no later than on the first business day after the trading takes place", and "It shall apply from 11 October 2027." Kuna settles a euro instrument two TARGET working days after a trade before 11 October 2027 and one after a trade from that day. A Xetra trade of Friday 8 October 2027 settles on Tuesday 12 October, and one of Monday 11 October on Tuesday 12 October too. Both read in the Official Journal texts through Cellar. Mark: `confirmed-nn`.

| Market            | Currency | Kuna counts | One day from | Mark              |
| ----------------- | -------- | ----------- | ------------ | ----------------- |
| US markets        | USD      | weekdays    | 2024-05-28   | `confirmed-table` |
| EU trading venues | EUR      | TARGET days | 2027-10-11   | `confirmed-nn`    |

`tests/lawDocs.spec.ts` compares the "One day from" column with `ONE_DAY_SETTLEMENT_FROM` in `settlementDay.ts`. Trades before that day settle in two of the days Kuna counts.

Kuna knows no exchange holidays, so the estimate can be a day early. A dollar instrument listed in Europe, such as a dollar line of an Irish ETF in London, settles on its venue's cycle, which Kuna does not know. It gives every dollar instrument the US cycle. The UK cycle was not researched.

Screen: Settled.

## TARGET days

HNB publishes no list "na neradne dane platnog sustava TARGET, što uključuje subote i nedjelje, 1. siječnja, Veliki petak, Uskrsni ponedjeljak, 1. svibnja te 25. i 26. prosinca." Kuna treats those days as TARGET closing days for both the rate day and the euro settlement count, with Easter by the Gregorian computus. Croatian public holidays that are TARGET working days, such as 30 May, still have an HNB list.

Mark: `confirmed-table`, from HNB's own page. Screen: part of the rate day row.

## Open points

- Which HNB list "objavljuje na dan isplate" means, the one published on the day or the one applied on it. HNB's written rule on `datum_primjene` was not loaded.
- The day the two years count from and to, see [Capital gains](capital-gains.md#counting-the-two-years).
- Settlement cycles of non-EU European venues such as London.

## Sources

- ZPDoh, Zakon o porezu na dohodak: NN 115/16 to 152/24. Art. 11(3), 12(8). <https://www.zakon.hr/z/85/Zakon-o-porezu-na-dohodak>, loaded 4 November 2026.
- PravPDoh, Pravilnik o porezu na dohodak: NN 10/17 to 157/25. Art. 11(4). <https://porezna-uprava.gov.hr/Propisi/GetBasicData/4>, loaded 4 November 2026.
- CSDR, Regulation (EU) No 909/2014, Art. 5(2), <http://publications.europa.eu/resource/celex/32014R0909>. Regulation (EU) 2025/2075, <http://publications.europa.eu/resource/celex/32025R2075>. Both loaded 4 November 2026 through Cellar.
- HNB API documentation, <https://api.hnb.hr/>, and rows <https://api.hnb.hr/tecajn-eur/v3?datum-primjene-od=2026-10-28&datum-primjene-do=2026-11-04>. ECB USD rates, <https://data-api.ecb.europa.eu/service/data/EXR/D.USD.EUR.SP00.A?startPeriod=2026-10-27&endPeriod=2026-11-04&format=csvdata>. All loaded 4 November 2026.
- SEC press release 2023-29, <https://www.sec.gov/newsroom/press-releases/2023-29>, loaded 4 November 2026 through a summarising fetch.
