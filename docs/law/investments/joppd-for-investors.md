---
checked: 2026-11-04
nn_through: 126/26
summary: The JOPPD a person files for a year's capital gains and within 30 days for income from abroad, its report mark and type, the recipient and receipt codes, the fields Kuna fills, the code-02 line and the due dates
---

# JOPPD for investors

The JOPPD (_Izvješće o primicima, porezu na dohodak i prirezu te doprinosima za obvezna osiguranja_) is the report a person files for a year's capital gains, and for each payment from abroad with nothing withheld. Kuna shows what to type into the yearly one on the Year tab and in the register it downloads (`tax/presentation/YearTab.vue`, `tax/infrastructure/taxRegisterFile.ts`). Law as researched on 4 November 2026.

The figures themselves are in [Capital gains](capital-gains.md). The 30-day route is in [Foreign capital income](foreign-capital-income.md#nothing-withheld-the-30-day-joppd).

## Who files

PravPDoh Art. 77(13): "Porezni obveznik – imatelj financijske imovine Obrazac JOPPD dostavlja do posljednjeg dana mjeseca veljače tekuće godine, s danom i oznakom izvješća dana 31. prosinca prethodne godine, za sve kapitalne dobitke ostvarene u prethodnoj godini umanjene za ostvarene kapitalne gubitke." A domestic intermediary may file for the person (Art. 77(14)), which a foreign broker does not do.

The same paragraph ends: "Ako umanjenje kapitalnih dobitaka za ostvarene kapitalne gubitke rezultira kapitalnim gubitkom ne postoji obveza izvješćivanja putem Obrasca JOPPD." A year whose losses on lots under two years exceed the gains on them owes no JOPPD for those. Losses equal to the gains leave a base of zero, not a loss, so that line is still reported.

Tax-free gains alone still call for a JOPPD. The middle sentence of Art. 77(13) reports them "na isti način", and Porezna uprava's notice of 6 February 2026 says "neovisno o neoporezivosti, porezni obveznik ima obvezu iskazivanja tog primitka putem Obrasca JOPPD", with an example JOPPD that carries only the code-02 line. A year with tax-free gains and no loss on lots under two years files that JOPPD.

Tax-free gains in a year whose lots under two years end in a loss are open. The last sentence frees the year from the JOPPD after the middle sentence asks for tax-free gains, and neither that notice nor the notices for 2022 and 2025 gains address the case. Kuna keeps the date for such a year, for the code-02 line only, and marks it unconfirmed.

Porezna uprava's notice for 2025 gains frees gains under 16.70 euros from a JOPPD, but only for gains through domestic intermediaries that sent a statement. It does not reach a foreign broker.

Mark: `confirmed-consolidated` for a year that ends in a loss and for tax-free gains alone, `unconfirmed` for tax-free gains in a year that ends in a loss. Screen: Settled for a year that ends in a loss, Unconfirmed for its tax-free gains.

## The capital gains JOPPD

| Field                                  | What goes in                                                                                 | Mark                     |
| -------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------ |
| Page A, I. Oznaka izvješća             | The year's two digits and the day of the year of 31 December: 26365 for 2026, 24366 for 2024 | `confirmed-consolidated` |
| Page A, II. Vrsta izvješća             | 11                                                                                           | `confirmed-consolidated` |
| Page A, III.5 Oznaka podnositelja      | 4                                                                                            | `confirmed-consolidated` |
| Page A, V.2                            | The tax, as field 14.1                                                                       | `reading`                |
| Page B, 6.1 and 6.2                    | 1001 and 1006, see "Codes"                                                                   | see "Codes"              |
| Page B, 10.1 and 10.2                  | 1 January and 31 December of the year                                                        | `reading`                |
| Page B, 11 Primitak                    | Gains on lots under two years, before losses                                                 | `reading`                |
| Page B, 13.1 Izdatak                   | Losses on lots under two years, up to field 11                                               | `reading`                |
| Page B, 13.3 Dohodak and 13.5 Osnovica | Field 11 less 13.1                                                                           | `reading`                |
| Page B, 14.1 Porez                     | The year's rate of 13.5                                                                      | `confirmed-consolidated` |
| Page B, 14.2 Prirez                    | 0.00 from 2024. For 2023, the rate of the owner's 2023 city on 14.1                          | `reading`                |
| Page B, 16.1 Način isplate             | 1, payment to a current account                                                              | `reading`                |
| Page B, 16.2 Iznos za isplatu          | Field 11 less the tax. For 2023, less the surtax too                                         | `confirmed-consolidated` |

The report mark. PravPDoh Art. 81(2): the mark is "u obliku GG001 do GG365(366), a sastoji se od kombinacije oznake zadnje dvije znamenke godine i rednog broja dana u godini". With the day of 31 December from Art. 77(13), that is 26365 for 2026 and 24366 for 2024, a leap year. Porezna uprava's crypto example marks a report "na dan 31.12.2025." as 25365, and RRiF 1/2025 gives "24366" for the JOPPD filed in 2025.

The report type. PravPDoh Art. 81(3) item 11: "oznaka 11 kada fizička osoba i/ili financijski posrednik u ime i za račun poreznog obveznika podnosi izvješće o dohotku ostvarenom po osnovi kapitalnih dobitaka". The submitter: annex 1 of the form, "4 Ostale fizičke osobe".

Field 16.2. PravPDoh Art. 82(1) item 40: "Iznos za isplatu (pod 16.2.). – upisuje se iznos ukupnog primitka (oporezivog primitka i/ili neoporezivog primitka) umanjenog za iznos uplaćenih doprinosa iz primitka, te uplaćenog predujma poreza". Raiffeisen KAG's guide enters "iznos oporezivog primitka umanjen za uplaćeni porez", and Finax's 13.5 less 14.1, which differs from field 11 only when there are losses. Kuna writes field 11 less the tax, as item 40 has it. Item 40 names only the tax, so taking the city's surtax of field 14.2 off as well for 2023 is a `reading`.

The remaining field rules come from the two broker guides and the crypto example, since the Pravilnik's field list is written for salaries. They are a `reading`.

Screen: A reading.

## Codes

| Line                                        | Field    | Code | Kuna key                      | Mark                     |
| ------------------------------------------- | -------- | ---- | ----------------------------- | ------------------------ |
| Capital gains report                        | II.      | 11   | `gainsReportType`             | `confirmed-consolidated` |
| Submitter, a private person                 | III.5    | 4    | `submitter`                   | `confirmed-consolidated` |
| Capital gains, recipient                    | 6.1      | 1001 | `gains.recipient`             | `unconfirmed`            |
| Capital gains, receipt                      | 6.2      | 1006 | `gains.receipt`               | `confirmed-consolidated` |
| Gains past two years, non-taxable receipt   | 15.1     | 02   | `taxFree.nonTaxable`          | `confirmed-consolidated` |
| Gains past two years, recipient and receipt | 6.1, 6.2 | 0000 | `taxFree.recipientAndReceipt` | `confirmed-consolidated` |
| Dividend from abroad, recipient             | 6.1      | 1003 | `dividend.recipient`          | `reading`                |
| Dividend from abroad, receipt               | 6.2      | 1001 | `dividend.receipt`            | `confirmed-consolidated` |
| Interest from abroad, recipient             | 6.1      | 1103 | `interest.recipient`          | `reading`                |
| Interest from abroad, receipt               | 6.2      | 1005 | `interest.receipt`            | `reading`                |
| Referral credit, recipient                  | 6.1      | 4002 | `referral.recipient`          | `reading`                |
| Referral credit, receipt                    | 6.2      | 4025 | `referral.receipt`            | `reading`                |
| A 30-day report of income from abroad       | II.      | 8    | `foreignReportType`           | `confirmed-consolidated` |

The wording of each code in the form's annexes:

- Recipient 1001: "Stjecatelj primitka od kojega se utvrđuje dohodak od kapitala". 1003: the same "ostvaren iz inozemstva ili druge države članice Europske unije". 1103: capital income "po osnovi prihoda od kamata ostvaren iz inozemstva ili druge države članice Europske unije". 4002: "Osiguranik/stjecatelj primitka od kojega se utvrđuje drugi dohodak, a po osnovi kojeg postoji obveza doprinosa".
- Receipt 1001: "po osnovi dividendi i udjela u dobiti na temelju udjela u kapitalu". 1005: "Ostali primici od kapitala (uključujući i dohodak od kapitala po osnovi kamata osim kamata na štednju)". 1006: "po osnovi kapitalnih dobitaka". 4025: other income "a primatelj ga ostvari neposredno iz inozemstva".
- Non-taxable 02: "Primici po osnovi kapitalnih dobitaka od otuđenja financijske imovine ako to nije djelatnost poreznog obveznika koje ne podliježu oporezivanju sukladno odredbi članka 67. stavka 8."

The codes exist as worded (`confirmed-consolidated`, the form of 24 December 2025 that carries the annexes as amended by NN 157/25). Which code fits a dividend, interest or referral credit is a reading of that wording, marked per row. `tests/lawDocs.spec.ts` compares this table with `JOPPD_CODES` in `taxRules.ts`, by the "Kuna key" column.

Screen: Settled for 1006 and 02, A reading for the 30-day codes.

### Recipient 1001 or 1003

Gains through a foreign broker are capital income from abroad, which the wording of 1003 fits. Both broker guides tell their clients to use 1001, and one of them is Finax, a Slovak firm. Porezna uprava's capital gains page names no code, and its crypto example has no taxable line. No source picks between them. The tax and the deadline are the same either way. Kuna writes 1001.

A difference does exist in the form. PravPDoh Art. 82(1) item 7 (JOPPD field 3, "Šifra općine/grada rada") says that for recipient codes "1003, 1004, 1103, 1104" and others "upisuju se prve dvije znamenke 99 te oznaka države u kojoj je primitak ostvaren". Under 1003 the line would carry 99 and one country code, so one yearly line could name only one country, and gains through a foreign broker can span several. Kuna shows no field 3 for gains. Only a written answer from Porezna uprava or a current logical check set would settle the code. Read in the Porezna uprava consolidation, loaded 7 November 2026.

Mark: `unconfirmed`, waiting for Porezna uprava in writing. Screen: Unconfirmed.

### The code-02 line

Gains on lots past two years go on the same JOPPD. PravPDoh Art. 77(13): "Na isti način izvještava se i o kapitalnim dobicima koji sukladno odredbi članka 67. stavka 8. Zakona ne podliježu oporezivanju." That covers all financial assets, shares and fund units included. Porezna uprava reminded holders of crypto assets of the same duty on 6 February 2026.

The line, from PravPDoh Art. 82(4) and the crypto example: 6.1 and 6.2 are 0000, the fields from 7.1 to 14.2 are zero, 15.1 is 02, and 15.2 and 16.2 carry the tax-free gains. Page A, VII. "Isplaćeni neoporezivi primici" carries the same amount. The amount is the gain, not the proceeds.

Read in the Porezna uprava consolidation of the Pravilnik through NN 157/25, loaded 4 November 2026, which raises the duty for shares from the earlier `reading`.

Mark: `confirmed-consolidated`. Screen: Settled.

## Due dates

ZPDoh Art. 70(4): the tax is worked out and paid "do posljednjeg dana mjeseca veljače tekuće godine" for the previous year's gains. PravPDoh Art. 77(13) files the JOPPD by the same day. A last day on a weekend moves to the next working day, as [Filing calendar](filing-calendar.md#weekends-and-holidays) sets out. Porezna uprava applied this to 2025 gains: "do 28. veljače 2026. odnosno do 2. ožujka 2026. (obzirom da je 28. veljače 2026. neradni dan)".

| Gains of | JOPPD and payment by      |
| -------- | ------------------------- |
| 2023     | Thursday 29 February 2024 |
| 2024     | Friday 28 February 2025   |
| 2025     | Monday 2 March 2026       |
| 2026     | Monday 1 March 2027       |

The 30-day JOPPD is due 30 days after the payment, with the mark of the day received (PravPDoh Art. 79(1)).

Mark: `confirmed-consolidated`, with the weekend move a reading Porezna uprava applies. Screen: Settled.

## Paying

Raiffeisen KAG's guide pays the tax to the account of the city of residence, model HR68, with reference 1910, the OIB and the report mark. The Naputak on budget payments that sets those details was not loaded, so they are `unconfirmed` here. Kuna shows no payment details.

## Open points

- Recipient 1001 or 1003 for gains through a foreign broker.
- Whether tax-free gains in a year whose lots under two years end in a loss still call for a JOPPD.
- The payment reference, from the budget Naputak.

## Sources

- ZPDoh, Zakon o porezu na dohodak: NN 115/16 to 152/24. Art. 67(8), 70(4). <https://www.zakon.hr/z/85/Zakon-o-porezu-na-dohodak>, loaded 4 November 2026.
- PravPDoh, Pravilnik o porezu na dohodak: NN 10/17 to 157/25. Art. 77(13), 77(14), 79(1), 81(2), 81(3), 82(1) items 19 to 40, 82(4). <https://porezna-uprava.gov.hr/Propisi/GetBasicData/4>, loaded 4 November 2026.
- Porezna uprava, JOPPD form with annexes 1 to 5, created 24 December 2025, <https://porezna-uprava.gov.hr/UserDocsImages/Arhiva/HR_obrasci/Documents/POREZ%20NA%20DOHODAK/JOPPD.pdf?vel=1253556>. JOPPD page, <https://porezna-uprava.gov.hr/hr/joppd/3956>. Crypto example of 6 February 2026, <https://porezna-uprava.gov.hr/hr/primjer-podnosenja-obrasca-joppd-za-primitke-po-osnovi-trgovanja-kriptoimovinom/8342> and its PDF. Notice for 2025 gains of 13 January 2026, <https://porezna-uprava.gov.hr/hr/oporezivanje-kapitalnih-dobitaka-i-izvjescivanje-putem-obrasca-joppd-8281/8281>. All loaded 4 November 2026.
- Not acts: RRiF 1/2025 abstract, <https://www.rrif.hr/clanak-23629/>. Raiffeisen KAG guide for 2025 gains, <https://a.storyblok.com/f/314998/x/1ac8f064a3/brosura-porez-na-kapitalne-dobitke_2025.pdf>. Finax guide for 2024, <http://www.finax.eu/themes/finax-rebranding/assets/_static_docs/hr/FInax-Brosura-porez-2024.pdf>. All loaded 4 November 2026.
