---
checked: 2026-11-04
nn_through: 126/26
summary: Dividends and interest paid from abroad, the Croatian rate by year, the credit for tax withheld abroad up to it, US withholding with no treaty in force, the INO-IZJAVA and INO-DOH route, the 30-day JOPPD route, broker interest and Croatian ISINs
---

# Foreign capital income

What a resident individual owes on dividends and interest a foreign broker pays, for income of 2023 to 2026. Kuna works this out on the Tax screen's Abroad tab (`tax/domain/foreignIncome.ts`). Law as researched on 4 November 2026.

Stock lending and referral credits are in [Other investment income](other-investment-income.md). The JOPPD codes of the 30-day route are in [JOPPD for investors](joppd-for-investors.md#codes), and which HNB rate converts a payment is in [HNB rates and settlement](hnb-rates-and-settlement.md#which-hnb-list).

## Income from abroad

ZPDoh Art. 12(7): "Inozemni dohodak je dohodak iz članka 5. ovoga Zakona koji rezident ostvari u inozemstvu ili iz inozemstva." Dividends are capital income (Art. 64(1), 69(1)). Interest is capital income on "primici od tražbina svake vrste" (Art. 65(1)).

Bond coupons are not interest for this tax: Art. 65(2)(4) excludes "primici od kamata ostvarenih ulaganjem u obveznice, neovisno o izdavatelju i vrsti obveznica". Kuna leaves coupons out of the Abroad tab.

Mark: `confirmed-consolidated`. Screen: Settled.

## Rates by year

The tax is final, on the gross, with no allowance (ZPDoh Art. 12(4), PravPDoh Art. 71(7): "Porez na dohodak od dividendi i udjela u dobiti obračunava se iz ukupnog primitka.").

| Year | Dividends and interest | US withholding | US treaty in force | Mark                     |
| ---- | ---------------------- | -------------- | ------------------ | ------------------------ |
| 2023 | 10%                    | 30%            | no                 | `confirmed-consolidated` |
| 2024 | 12%                    | 30%            | no                 | `confirmed-nn`           |
| 2025 | 12%                    | 30%            | no                 | `confirmed-nn`           |
| 2026 | 12%                    | 30%            | no                 | `confirmed-nn`           |

ZPDoh Art. 70(1) taxes interest and Art. 70(19) dividends "po stopi od 12%", both set by NN 114/23 Art. 28 from 1 January 2024. Income of 2023 stays at 10%, as [Capital gains](capital-gains.md#income-of-2023) sets out, with the city surtax on top, which Kuna does not hold. The mark covers the Croatian rate. The US columns are marked under "US withholding".

Screen: no row of its own. The rates row of capital gains covers the year table.

## US withholding

The US withholds 30% of a dividend paid to a resident of Croatia. The IRS: "Most types of U.S. source income received by a foreign person are subject to U.S. tax of 30%", with a reduced rate where "there is a tax treaty between the foreign person's country of residence and the United States". Read through a summarising fetch with verbatim quotes.

No treaty with the US applies to 2026 income. Porezna uprava's treaty map lists the USA among the states "s kojima se čeka potvrđivanje ugovora". The Croatian law confirming the treaty and its 2026 protocol is NN MU 6/2026, item 23, published on 30 October 2026. Its Art. 6 puts it in force "osmoga dana od dana objave", 7 November 2026, and its Art. 5 says "Na dan stupanja na snagu ovoga Zakona Konvencija i Protokol iz članka 1. ovoga Zakona nisu na snazi". The treaty itself enters into force on the later of the two notes the states exchange (Art. 29(2)), and has effect on taxes withheld at source "za iznose plaćene ili uračunate na ili nakon prvog dana drugog mjeseca koji slijedi nakon datuma na koji ova Konvencija stupa na snagu". The treaty cannot enter into force before the Croatian law does, so its effect on tax withheld starts on 1 January 2027 at the earliest, and no dividend paid in 2026 falls in it. A news report of 3 November 2026 adds that the US Senate has not yet given consent (Treaty Document 119-2).

ZPDoh Art. 80(1) gives a treaty priority only once it is "na snazi", and Art. 80(4) caps the credit at what a treaty in force allows. Until the treaty applies, the US 30% stands and the credit is capped by the Croatian tax alone.

Mark: `confirmed-nn` for no treaty in 2026, from NN MU 6/2026 and the treaty's Art. 29, with the US rate from the IRS page and the Senate's step from a news report. Screen: Settled.

## The credit for tax withheld abroad

ZPDoh Art. 80(2): foreign tax "uračunat će se u tuzemni porez na dohodak za svaki pojedinačni inozemni dohodak zasebno". Art. 80(3): only "na temelju potvrde inozemnog poreznog tijela ili za to ovlaštene osobe o uplaćenom porezu u inozemstvu". PravPDoh Art. 88(1) caps it "najviše do iznosa poreza obračunanog na konačni dohodak koji bi platio u tuzemstvu", and Art. 88(3) works the cap out per payment at the Croatian rate: "Ako je u inozemstvu plaćen niži porez, tada se u tuzemni porez uračunava stvarno plaćeni porez."

So per payment: the credit is the lower of the tax withheld and the Croatian tax. Withholding above the Croatian tax is lost. Porezna uprava's Austrian dividend INO-DOH example converts "po srednjem tečaju HNB-a na dan isplate" and credits only up to the Croatian tax.

Example. A US dividend of 100.00 dollars with 30.00 withheld, at 1.10 dollars per euro: 90.91 euros gross, 10.91 of Croatian 12%, 27.27 withheld. The credit is 10.91, nothing is left to pay, and 16.36 is lost.

Mark: `confirmed-consolidated`. Screen: Settled.

## Tax withheld abroad: INO-IZJAVA and INO-DOH

When tax on a payment is withheld abroad during the year, nothing is paid in Croatia during the year (ZPDoh Art. 81(3)). The person tells Porezna uprava "u roku od osam dana od dana ostvarenog prvog primitka u tekućoj godini". That written statement is the INO-IZJAVA (PravPDoh Art. 89). "Pisana izjava se ne podnosi za dohodak za koji se podnosi Obrazac JOPPD" (Art. 89(4)).

The year is reported on the INO-DOH "do 31. siječnja tekuće godine za prethodnu godinu" (ZPDoh Art. 81(4), PravPDoh Art. 90(8)). A confirmation of the foreign tax not in hand by then can follow "najkasnije do 30. studenog tekuće godine". Porezna uprava then assesses the tax with the credit, and any balance is paid "u roku od 15 dana od dana dostave rješenja" (Art. 81(6)).

Kuna gives the INO-IZJAVA date as eight days after the year's first payment with tax withheld, not moved past a weekend, and the INO-DOH date as 31 January moved past a weekend, with the weekday before as the safe day. The weekend move is in [Filing calendar](filing-calendar.md#weekends-and-holidays). A dividend a broker books net, with no tax withheld typed, counts as withheld abroad for both dates.

Mark: `confirmed-consolidated`. Screen: Settled.

## Nothing withheld: the 30-day JOPPD

When nothing is withheld abroad, ZPDoh Art. 81(1) applies: the person "obvezan je ... na taj dohodak obračunati predujam poreza na dohodak, odnosno konačni porez, i uplatiti ga u roku od 30 dana od dana primitka" and file "propisano izvješće" in the same period. PravPDoh Art. 71(6) says the same for dividends "izravno iz inozemstva". PravPDoh Art. 79(1): such a JOPPD is filed within the 30 days "ali sa oznakom dana i izvješća kada je primitak stvarno ostvaren", and Art. 81(3) item 8 gives it report type 8, "kada fizička osoba podnosi izvješće o obračunanom i uplaćenom predujmu poreza na dohodak po osnovi dohotka ostvarenog izravno iz inozemstva". The mark is written as Art. 81(2) sets out, the year's two digits and the day of the year. Kuna shows the date, the report type, the mark and the codes on the Abroad tab. A payment received on 16 October 2026, day 289 of the year, is marked 26289.

Thirty days from 16 October end on 15 November (ZUP Art. 80(2) starts the count the day after). Kuna does not move the 30th day past a weekend, which is the cautious choice.

Mark: `confirmed-consolidated`. Screen: Settled.

## Interest a broker pays

Interest on cash at a broker is capital income under Art. 65(1). Art. 65(2)(3) frees only "kamate na pozitivno stanje na računu za plaćanje ..., kamate ostvarene po osnovi pologa i štednje po viđenju, koje su ostvarene od banaka, štedionica i drugih financijskih institucija" where the interest is "najviše do 0,5% godišnje". Kuna taxes all broker interest at the year's rate. Reading a broker's cash sweep as outside that exemption, or its rate as above 0.5%, is the cautious reading. Whether broker cash is "štednja po viđenju", which would point to receipt code 1004 rather than 1005, is open.

Mark: `reading`. Screen: A reading.

## Payments of a Croatian ISIN

Income is foreign by where it comes from (Art. 12(7)), not by the ISIN. A Croatian issuer withholds the tax itself (Art. 70(1), 70(19)), so its payment is not income from abroad and has no 30-day duty for the person. Kuna leaves out of the Abroad tab every payment of an instrument whose ISIN starts with HR, as a stand-in for a Croatian payer.

Mark: `reading`. Screen: A reading.

## Open points

- The 2023 credit against the surtax was not researched.
- Whether a dividend paid on a lent share is a dividend or a payment in lieu was not researched. Kuna treats it as the broker books it.
- What counts as the foreign authority's confirmation (Art. 80(3)) for a broker that books a dividend net. A 1042-S or the broker's yearly tax statement is a `reading`.

## Sources

- ZPDoh, Zakon o porezu na dohodak: NN 115/16, 106/18, 121/19, 32/20, 138/20, 151/22, 114/23, 152/24. Art. 12(4), 12(7), 64, 65 (NN 115/16, 151/22, 114/23), 69, 70(1), 70(19), 80, 81 (NN 115/16, 106/18, 151/22, 114/23). <https://www.zakon.hr/z/85/Zakon-o-porezu-na-dohodak>, loaded 4 November 2026.
- NN 114/23, item 1609, Art. 28, 42. <https://narodne-novine.nn.hr/clanci/sluzbeni/2023_10_114_1609.html>, loaded 4 November 2026.
- NN MU 6/2026, item 23, Zakon o potvrđivanju Konvencije između Vlade Republike Hrvatske i Vlade Sjedinjenih Američkih Država o izbjegavanju dvostrukog oporezivanja, Art. 5, 6, and the treaty's Art. 29. <https://narodne-novine.nn.hr/clanci/medunarodni/2026_10_6_23.html>, loaded 4 November 2026.
- PravPDoh, Pravilnik o porezu na dohodak: NN 10/17 to 157/25. Art. 71(6), 71(7), 79(1), 81(2), 81(3), 88, 89, 90(8). <https://porezna-uprava.gov.hr/Propisi/GetBasicData/4>, loaded 4 November 2026.
- ZUP: NN 47/09, 110/21. Art. 80(2). <https://www.zakon.hr/z/65/Zakon-o-op%C4%87em-upravnom-postupku>, loaded 4 November 2026.
- Porezna uprava: treaty map, <https://porezna-uprava.gov.hr/hr/ugovori-o-izbjegavanju-dvostrukog-oporezivanja/7559>. INO-IZJAVA, <https://porezna-uprava.gov.hr/hr/ino-izjava/4526>. INO-DOH, <https://porezna-uprava.gov.hr/hr/obrazac-ino-doh/4524>. Austrian dividend example, <https://porezna-uprava.gov.hr/UserDocsImages/Arhiva/HR_obrasci/Obrasci%20nesvrstani/INODOH/DIVIDENDA%20AUSTRIJA.pdf?vel=497838>. All loaded 4 November 2026.
- IRS, NRA withholding, <https://www.irs.gov/individuals/international-taxpayers/nra-withholding>, loaded 4 November 2026 through a summarising fetch.
- Not acts: croatiansonline.com, 3 November 2026, <https://croatiansonline.com/porezni-ugovor-hrvatska-sad-ratifikacija/>. tportal, 30 July 2026, <https://www.tportal.hr/biznis/clanak/izbjegavanje-dvostrukog-oporezivanja-sa-sad-om-odnosi-se-i-na-mirovine-evo-detalja-20260730>. Both loaded 4 November 2026.
