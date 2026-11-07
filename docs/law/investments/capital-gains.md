---
checked: 2026-11-04
nn_through: 126/26
summary: Capital gains on shares and fund units by year from 2023, the two-year exemption and its day count, losses, FIFO per ISIN across accounts, fees, converting a gain once, and the year a sale counts in
---

# Capital gains

What a resident individual owes on selling shares, ETF units and other financial assets held at a foreign broker, for income of 2023 to 2026. Kuna works this out on the Tax screen's Year and Sales tabs (`tax/domain/taxYear.ts`, lots in `holdings/domain/lots.ts`). Law as researched on 4 November 2026.

Which HNB rate converts a gain and how the settlement day is estimated is in [HNB rates and settlement](hnb-rates-and-settlement.md). Filing and paying are in [JOPPD for investors](joppd-for-investors.md).

## What a capital gain is

A capital gain is capital income (_dohodak od kapitala_, ZPDoh Art. 64(1)). ZPDoh Art. 67(1): the gain is "razlika između ugovorene prodajne cijene, odnosno primitka utvrđenog prema tržišnoj vrijednosti financijske imovine koja se otuđuje i nabavne vrijednosti". Art. 67(2) covers transferable securities, money market instruments, fund units and derivatives. A disposal is a sale, an exchange, a gift or another transfer (Art. 67(3)).

Not a disposal (Art. 67(4)): an exchange for like securities of the same issuer, an exchange in a corporate reorganisation with no cash flow where the order of acquisition is kept, and a split of the same issuer's shares with no change in capital and no cash flow. After such an exchange the acquisition value is the value on the day of first acquisition (Art. 67(5)). Kuna's splits and spin-offs keep the original lots on that basis.

Mark: `confirmed-consolidated`. Screen: Settled.

## Rates by year

The tax is final. It is not part of the annual income tax return and takes no personal allowance (ZPDoh Art. 12(4)).

| Year | Capital gains | City surtax | Mark                     |
| ---- | ------------- | ----------- | ------------------------ |
| 2023 | 10%           | yes         | `confirmed-consolidated` |
| 2024 | 12%           | no          | `confirmed-nn`           |
| 2025 | 12%           | no          | `confirmed-nn`           |
| 2026 | 12%           | no          | `confirmed-nn`           |

ZPDoh Art. 70(4) (NN 114/23): "obračunati, obustaviti i uplatiti do posljednjeg dana mjeseca veljače tekuće godine za sve kapitalne dobitke ostvarene u prethodnoj godini umanjene za ostvarene kapitalne gubitke ... po stopi od 12%". NN 114/23 Art. 28 replaced "od 10 %" with "od 12 %" in Art. 70(1), (4), (17) and (19), and NN 114/23 Art. 42 put that article in force on 1 January 2024. Both read in the NN text. Porezna uprava's notice for 2025 gains (13 January 2026) applies 12%.

2027 assumed: no enacted change was found through NN 126/26. A 2027 bill adds a Croatian investment account and leaves the 12% alone, see the [watch list](../sources/watch-list.md#bills-and-drafts). Kuna uses the 2026 row for a later year and says so.

Screen: Settled.

### Income of 2023

Income of 2023 is taxed under the act as it stood before NN 114/23. NN 114/23 Art. 40: "Dohodak ostvaren do 31. prosinca 2023. oporezivat će se po Zakonu o porezu na dohodak (»Narodne novine«, br. 115/16., 106/18., 121/19., 32/20., 138/20. i 151/22.)." (`confirmed-nn`). That act had 10% on capital gains, dividends and interest, since NN 138/20 Art. 16 replaced "stope od 12%" with "stope od 10%" across the act, applied from tax year 2021 (Art. 17(1)) (`confirmed-consolidated`).

The city surtax (_prirez_) applied to 2023 income. NN 114/23, item 1610, amending the ZLP, deleted the surtax from the local taxes from 2024 (Art. 5, 6), and its Art. 11(2) says a city's decision under the old act "ostaje na snazi do 31. prosinca 2023." Porezna uprava's notice on capital gains of 2023 (7026, published 15 January 2024) applies it too, working its threshold "primjenom prosječne stope prireza od 12%" (`confirmed-table`). RRiF 2/2024 says the same ("uz još uvijek obvezu obračuna prireza"). Porezna uprava's compiled table "Pregled stopa prireza porezu na dohodak gradova i općina u Republici Hrvatskoj, primjena u 2023. godini" (dated Zagreb, 1 January 2023) gives each city's rate in its last column, "godišnja stopa za 2023. godinu", for example 18% for Zagreb and 13% for Rijeka (`confirmed-table`).

The 2023 surtax is therefore settled in law. The surtax comes off the payout: field 14.2 carries it and field 16.2 is the amount paid out after it. Only the current text of PravPDoh Art. 82(1) item 40 was loaded, and it names the tax and not the surtax, so the 2023 wording of field 16.2 is `unconfirmed` until the version in force in February 2024 is read.

Kuna does not apply it yet because the owner has not decided. It still shows 2023 as tax before surtax and says so, with no stored city or rate. Years before 2023 are not computed.

Screen: Settled. The screen differs from the law here, see the [watch list](../sources/watch-list.md#where-the-screen-and-the-docs-differ).

## The two-year exemption

ZPDoh Art. 67(8): the gain is not taxed "ako je financijska imovina otuđena nakon dvije godine od dana nabave, odnosno stjecanja te imovine". The same paragraph frees disposals between spouses and close family, and inheritance.

Mark: `confirmed-consolidated`. Screen: Settled.

### Counting the two years

ZUP Art. 80(3) ends a period in years on the day with the same number, or on the last day of the month when that day does not exist. "Nakon dvije godine" then means from the day after the second anniversary. A lot bought on 15 January 2024 is free from 16 January 2026. A lot bought on 29 February 2024 has its anniversary on 28 February 2026 and is free from 1 March 2026.

The act does not say whether the trade day or the settlement day counts at either end. Kuna counts trade days at both ends and warns of a sale within five days of the tax-free day, either side, since settlement can move either end.

Mark: `reading`. Screen: A reading.

## FIFO per ISIN across accounts

ZPDoh Art. 70(5): the holder "obvezan je voditi evidenciju istovrsne financijske imovine po metodi uzastopnih cijena (FIFO)". PravPDoh Art. 71(13) explains FIFO: on a disposal the cost is "ona cijena koja je bila prva evidentirana". PravPDoh Art. 71(14): the register is kept "za svaku istovrsnu financijsku imovinu".

The duty sits with the person and the kind of asset. Nothing ties it to an account or a broker. Kuna keeps one queue per instrument, and one ISIN is one instrument, across every account. A transfer between two of the person's own accounts has no counterparty and no proceeds, so Kuna treats it as no disposal and the lots keep their days and costs.

A Porezna uprava opinion of 6 April 2016 (KLASA 410-01/15-01/4725, RRiF copy) describes the register per same-kind asset too.

Example. 10 units bought at broker A in January 2024 at 100.00, 10 at broker B in March 2026 at 120.00, and 10 sold at broker B in July 2026 at 130.00. Across accounts the sale closes the 2024 lot, which is past two years: a 300.00 gain and no tax. Per broker it would close the 2026 lot: a 100.00 gain and 12.00 of tax.

Mark: `reading`. Screen: A reading.

## The register and its currency

ZPDoh Art. 70(6): the register "za financijsku imovinu ostvarenu na inozemnom tržištu može se voditi u valuti stjecanja financijske imovine". PravPDoh Art. 71(14) lists what it holds: the asset, the day and way of acquisition, quantity, acquisition value, the day and way of disposal, quantity sold, selling price, realised yield and the gain or loss. Kuna's Download for Porezna writes that register.

Mark: `confirmed-consolidated`. Screen: Settled.

## Converting a gain once

ZPDoh Art. 12(8): "Dohodak ostvaren u stranoj valuti preračunava se u euro primjenom srednjeg tečaja koji Hrvatska narodna banka objavljuje na dan isplate." The paragraph converts income, which is the gain, and names one day, the day of payment. With a register kept in the currency of acquisition (Art. 70(6)), the gain is worked out in that currency and converted once.

PravPDoh Art. 11(4) converts "oporezivi primici" (taxable receipts) earned abroad in a foreign currency at the same rate of the payment day. That fits the proceeds. It says nothing about converting the cost on the purchase day, which is the other reading and no source supports.

Raiffeisen KAG's guide for 2025 gains works the gain out "u valuti fonda" and converts it at ECB reference rates. Finax's guide for 2024 also states the gain in the fund's or portfolio's currency. Both are secondary.

Kuna converts each lot's gain in the quote currency at HNB's rate of the sale's settlement day, never at the rate the record stores.

Example. 10 shares bought at 100.00 dollars and sold at 120.00, no fees. 1.10 dollars per euro when the purchase is paid and 1.20 when the sale is paid. Converted once: 200.00 / 1.20 = 166.67 euros of gain and 20.00 of tax. Leg by leg it would be 1,000.00 - 909.09 = 90.91 euros of gain and 10.91 of tax.

Mark: `reading`. Screen: A reading.

## Which year a sale counts in

ZPDoh Art. 11(3): "Primici i izdaci utvrđuju se primjenom načela blagajne." Art. 11(1) counts receipts "koja su poreznom obvezniku pritekla u poreznom razdoblju". A sale's proceeds reach the person on the settlement day, so a sale traded in late December that settles in January counts in January's year and goes on the next year's JOPPD. A Xetra sale traded on Wednesday 30 December 2026 settles on Monday 4 January 2027 and counts in 2027.

Mark: `reading`. Screen: A reading.

## Fees

ZPDoh Art. 64(2): "Pri utvrđivanju dohotka od kapitala ne priznaju se izdaci, osim ako je ovim Zakonom drukčije uređeno." Art. 67(1) defines the gain as the agreed selling price less the acquisition value. Art. 67(11) names costs only for a loss: "U kapitalni gubitak uračunavaju se i svi pripadajući troškovi koji su naplaćeni na teret poreznog obveznika."

Kuna takes the gain as proceeds less the sale's fees less the cost, with the buy's fees in the cost. Reading the purchase fee into the acquisition value and the sale fee as lowering the agreed price is a `reading`. A strict reading of Art. 67(1) with Art. 64(2) would tax the gain before the sale fee.

Example. Cost 1,000.00 with its buy fee, sale 1,200.00, sale fee 10.00. Kuna taxes 190.00. The strict reading taxes 200.00.

Mark: `reading`. Screen: A reading.

## Losses

ZPDoh Art. 67(11): "Kapitalni gubici mogu se odbiti samo od dohotka od kapitalnih dobitaka koji je ostvaren u istoj kalendarskoj godini. ... Kapitalni gubitak iskazuje se najviše do visine porezne osnovice." So losses lower only the same year's gains, never below zero, and never carry to another year.

Mark: `confirmed-consolidated`. Screen: Settled.

### Losses on lots past two years

PravPDoh Art. 70(11): losses "priznaju se samo ako su ostvareni temeljem financijske imovine stečene od 1. siječnja 2016. i ako su ostvareni u roku od dvije godine od dana nabave, odnosno stjecanja financijske imovine koja se otuđuje." A loss on a lot past two years lowers nothing. Read in the Porezna uprava consolidation of the Pravilnik through NN 157/25, loaded 4 November 2026, which raises this rule from the earlier `reading`.

Example. In 2026 a three-year-old lot sells at a 200.00 loss, a one-year-old lot at a 500.00 gain and a six-month-old lot at a 100.00 loss. The base is 400.00 and the tax 48.00. The 200.00 is listed apart and lowers nothing.

Mark: `confirmed-consolidated`. Screen: Settled.

## Worked example

A made-up year, 2026, all in euros.

| Lot                                   | Gain or loss | Status              |
| ------------------------------------- | ------------ | ------------------- |
| Bought March 2025, sold June 2026     | 800.00       | taxable             |
| Bought May 2025, sold June 2026       | -300.00      | loss                |
| Bought January 2023, sold April 2026  | 1,000.00     | tax-free            |
| Bought February 2022, sold April 2026 | -150.00      | loss past two years |

Field 11 is 800.00, field 13.1 is 300.00 and the base is 500.00. The tax is 12% of 500.00, 60.00, due on 1 March 2027. Field 16.2 is 800.00 less 60.00, 740.00, see [JOPPD for investors](joppd-for-investors.md#the-capital-gains-joppd). The 1,000.00 goes on the code-02 line. The 150.00 lowers nothing.

## Open points

- The day that counts for the two years, trade or settlement, is a reading.
- Fees in the gain are a reading.
- Kuna holds no 2023 surtax rate and shows 2023 before surtax until the owner decides to apply it. The wording of field 16.2 in 2023 is unconfirmed.
- Gains on an exchange of fund units between two funds of different managers are not covered by Art. 67(4) item 4 and were not researched.

## Sources

- ZPDoh, Zakon o porezu na dohodak: NN 115/16, 106/18, 121/19, 32/20, 138/20, 151/22, 114/23, 152/24. Art. 11 (NN 115/16, 106/18, 121/19, 151/22, 114/23), 12(4), 12(8) (NN 115/16, 151/22), 64, 67 (NN 115/16, 114/23), 70(4) to 70(6) (NN 115/16, 114/23). <https://www.zakon.hr/z/85/Zakon-o-porezu-na-dohodak>, loaded 4 November 2026, current through NN 119/26.
- NN 114/23, item 1609, Zakon o izmjenama i dopunama Zakona o porezu na dohodak, Art. 28, 40, 42. <https://narodne-novine.nn.hr/clanci/sluzbeni/2023_10_114_1609.html>, loaded 4 November 2026.
- NN 138/20, Art. 16 and 17, read in the transitional block of the zakon.hr consolidated ZPDoh, loaded 4 November 2026.
- NN 114/23, item 1610, Zakon o izmjenama i dopuni Zakona o lokalnim porezima, Art. 5, 6, 11. <https://narodne-novine.nn.hr/clanci/sluzbeni/2023_10_114_1610.html>, loaded 4 November 2026.
- PravPDoh, Pravilnik o porezu na dohodak: NN 10/17 to 157/25. Art. 11(4), 70(11), 71(13), 71(14). Porezna uprava consolidation, <https://porezna-uprava.gov.hr/Propisi/GetBasicData/4>, loaded 4 November 2026.
- ZUP, Zakon o općem upravnom postupku: NN 47/09, 110/21. Art. 80(3). <https://www.zakon.hr/z/65/Zakon-o-op%C4%87em-upravnom-postupku>, loaded 4 November 2026.
- Not acts: Porezna uprava notices of 13 January 2026 (8281), 19 January 2023 (6871) and 15 January 2024 (7026, <https://porezna-uprava.gov.hr/hr/oporezivanje-kapitalnih-dobitaka-i-izvjescivanje-putem-obrasca-joppd/7026>, loaded 7 November 2026). Porezna uprava's surtax table for 2023, dated 1 January 2023, <https://porezna-uprava.gov.hr/UserDocsImages/arhiva/obrazac_joppd/Documents/PREGLED%20STOPA%20PRIREZA%20POREZU%20NA%20DOHODAK%20%20GRADOVA%20I%20OP%C4%86INA%20U%20REPUBLICI%20HRVATSKOJ%20PRIMJENA%20U%202023_.pdf>, loaded 7 November 2026. RRiF 2/2024, <https://www.rrif.hr/clanak-22992/>. The 2016 opinion, RRiF copy, <https://www.rrif.hr/oporezivanje_kapitalnih_dobitaka_i_dinamika_placan-3338-misljenje/>. Raiffeisen KAG guide for 2025 gains, <https://a.storyblok.com/f/314998/x/1ac8f064a3/brosura-porez-na-kapitalne-dobitke_2025.pdf>. Finax guide for 2024, <http://www.finax.eu/themes/finax-rebranding/assets/_static_docs/hr/FInax-Brosura-porez-2024.pdf>. All loaded 4 November 2026.
