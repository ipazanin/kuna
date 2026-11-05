---
checked: 2026-11-04
nn_through: 126/26
summary: Stock lending income read as interest at the capital income rate, and referral credits read as other income from abroad, with their 30 days, pension contributions and the city's lower rate
---

# Other investment income

Two kinds of payment a foreign broker makes that are neither a dividend nor a sale: income from lending out shares, and a credit for referring a new client. No source names either, so both rest on readings. Kuna shows both on the Abroad tab (`tax/domain/foreignIncome.ts`), each with its 30-day date. Law as researched on 4 November 2026.

## Stock lending

A broker that lends out a client's shares pays the client part of the lending fee. ZPDoh Art. 65(1) counts as interest "primici od tražbina svake vrste, a osobito: ... 3. primici od kamata po osnovi danih zajmova". Lending a share is a loan of a fungible thing, so the fee reads as interest, taxed at the capital income rate of the year (12% from 2024, Art. 70(1)). The other reading is renting movable property (Art. 57(1)), property income at 12% after a flat 30% expense. The interest reading costs slightly more, so it is the cautious one.

With nothing withheld abroad it takes the 30-day route of [Foreign capital income](foreign-capital-income.md#nothing-withheld-the-30-day-joppd), with the interest codes of [JOPPD for investors](joppd-for-investors.md#codes). No Porezna uprava opinion on stock lending was found.

Example. A 10.00 dollar lending payment with nothing withheld, at 1.10 dollars per euro: 9.09 euros of income and 1.09 of tax within 30 days.

Mark: `reading`. Screen: A reading.

## Referral credits

A credit a broker pays for referring a new client is not capital income. It reads as other income (_drugi dohodak_): ZPDoh Art. 39(3) item 11 covers "ostali posebno nenavedeni primici koje fizičkim osobama isplaćuju ili daju pravne i fizičke osobe ... i drugi isplatitelji i davatelji". JOPPD receipt code 4025 is "Primici od kojih se utvrđuje drugi dohodak, a primatelj ga ostvari neposredno iz inozemstva".

The advance tax on other income is "primjenom niže stope utvrđene prema članku 19.a" (ZPDoh Art. 40(1)), the lower rate of the person's city, with no allowance. Art. 40(2) puts it on payers, which a foreign broker is not. For income straight from abroad the person pays it within 30 days under Art. 81(1), and PravPDoh Art. 55(8) says the same: "obračunava i uplaćuje porezni obveznik stjecatelj primitka u roku od 30 dana od dana naplate primitka, ... ako je dohodak ostvario izravno u inozemstvu bez posredovanja tuzemnog isplatitelja."

Other income is not final income (ZPDoh Art. 12(3)), so it also belongs to the year's income tax, which Kuna does not compute. Kuna shows the date, the codes and the contributions in words, with no figure, since the Investments file holds no city.

That no source names a referral credit leaves the classification `unconfirmed`. The route and the rate follow from the loaded texts once the classification holds.

Mark: `unconfirmed`. Screen: Unconfirmed.

### Contributions on a referral credit

Other income received straight from abroad carries pension contributions that the person works out and pays. ZDop Art. 112(1): for other income "a primatelj ga ostvari neposredno iz inozemstva ..., obveznik doprinosa te obveznik obračunavanja i plaćanja doprinosa jest primatelj". Art. 113(2): only the pension contributions from the base, no health contribution. Art. 13(3): 10% for a person in the first pillar alone, 7.5% for a person also in the second. Art. 17(2): 2.5% to the second pillar. Art. 115(2): due "u roku od trideset dana od dana kada je primitak ostvaren". Art. 117 applies the same to a person insured on another basis, such as an employee.

The contributions are the expense of other income (ZPDoh Art. 39(4)), so the tax is on what is left.

Example, for a made-up city whose lower rate is 20%. A 40.00 euro credit for a person in both pillars: 3.00 to the first pillar and 1.00 to the second, both within 30 days. Tax at 20% of 36.00 is 7.20, also within 30 days. Recipient code 4002, receipt code 4025.

Mark: `confirmed-consolidated`, once the classification as other income holds. Screen: Settled.

## Open points

- Whether a referral credit is other income or something else, such as a discount on fees. A Porezna uprava answer would settle it.
- Whether stock lending is interest or rent of movable property.
- The referral credit's place in the annual income tax.

## Sources

- ZPDoh, Zakon o porezu na dohodak: NN 115/16, 106/18, 121/19, 32/20, 138/20, 151/22, 114/23, 152/24. Art. 12(3), 39 (NN 115/16, 106/18, 121/19, 138/20, 114/23), 40 (NN 115/16, 121/19, 138/20, 114/23, 152/24), 57(1), 65(1), 70(1), 81(1). <https://www.zakon.hr/z/85/Zakon-o-porezu-na-dohodak>, loaded 4 November 2026.
- PravPDoh, Pravilnik o porezu na dohodak: NN 10/17 to 157/25. Art. 55(8). <https://porezna-uprava.gov.hr/Propisi/GetBasicData/4>, loaded 4 November 2026.
- ZDop, Zakon o doprinosima: NN 84/08, 152/08, 94/09, 18/11, 22/12, 144/12, 148/13, 41/14, 143/14, 115/16, 106/18, 33/23, 114/23, 152/24. Art. 13(3) (NN 148/13, 115/16, 106/18), 17(2) (NN 115/16), 112 (NN 148/13), 113, 115 (NN 115/16, 152/24), 117. <https://www.zakon.hr/z/365/Zakon-o-doprinosima>, loaded 4 November 2026, current through NN 119/26.
- Porezna uprava, JOPPD form with annexes, created 24 December 2025, annexes 2 and 3. <https://porezna-uprava.gov.hr/UserDocsImages/Arhiva/HR_obrasci/Documents/POREZ%20NA%20DOHODAK/JOPPD.pdf?vel=1253556>, loaded 4 November 2026.
