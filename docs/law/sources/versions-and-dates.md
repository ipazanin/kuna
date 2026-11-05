---
checked: 2026-11-04
nn_through: 126/26
summary: Reading publication, entry into force and application dates, which version of a text applies to a year's income, and the Croatian terms for them
---

# Versions and dates

How to tell which text of an act applied to a given year's income. The dates printed on an NN item are not its entry into force, and the NN metadata does not carry that date either. It has to be read from the act's final articles. Sources are described in [Official sources](official-sources.md).

## Which version applies

Rules from loaded texts:

1. The tax rule. OPZ Art. 5: "U postupku oporezivanja primjenjuju se propisi koji su bili na snazi u vrijeme nastanka činjenica na kojima se temelji oporezivanje." The date of the taxable fact picks the version. For a sale that is the day the proceeds are paid, as [Capital gains](../investments/capital-gains.md#which-year-a-sale-counts-in) sets out.
2. Each amending act decides its own start. Read its last articles, usually under "Prijelazne i završne odredbe". Patterns seen in ZPDoh:
   - Income earned before the change: NN 114/23 Art. 40, "Dohodak ostvaren do 31. prosinca 2023. oporezivat će se po Zakonu o porezu na dohodak (»Narodne novine«, br. 115/16., 106/18., 121/19., 32/20., 138/20. i 151/22.)." NN 152/24 Art. 16 says the same for income up to 31 December 2024.
   - A split start: NN 114/23 Art. 42, "stupa na snagu prvoga dana od dana objave ..., osim članaka 1. do 8. i članaka 10. do 37. ovoga Zakona koji stupaju na snagu 1. siječnja 2024."
   - Applied from a tax year: NN 138/20 Art. 17(1), "Odredbe članaka 4. i 16. ovoga Zakona primjenjuju se pri utvrđivanju poreza na dohodak za 2021. godinu i nadalje."
   - A bylaw follow-up: NN 114/23 Art. 39 gives the Minister 90 days to align the Pravilnik. Until then the old Pravilnik keeps applying where it does not conflict, which is a `reading`.
3. Procedure. OPZ Art. 4 applies ZUP to tax procedure. ZUP Art. 81(2): "Kad zadnji dan roka pada u nedjelju, na blagdan ili u drugi dan kad javnopravno tijelo ne radi, rok istječe prvoga sljedećega radnog dana." [Filing calendar](../investments/filing-calendar.md#weekends-and-holidays) owns how Kuna applies it.
4. A correction (ispravak) is its own NN item and fixes the published text to match the adopted original. Apply the corrected text from the original item's date, which is a `reading`.
5. A treaty applies only once it is in force for both states. The Croatian law confirming it can be in force before that, as with the US treaty in [Foreign capital income](../investments/foreign-capital-income.md#us-withholding).

Recipe for "which text applied to income of year Y":

1. Get the chain from the zakon.hr header or the Porezna uprava Propisi node. Cross-check with an NN title search.
2. Check NN issues after the consolidator's cut-off with `api/editions` and the issue listings.
3. For each amendment, read the final and transitional articles for "stupa na snagu" and "primjenjuje se", including split dates per article.
4. Pick the version in force for income received in Y. Confirm the article in the amending act on NN before marking `confirmed-nn`.

## Croatian terms

| Term                               | Meaning                                                         |
| ---------------------------------- | --------------------------------------------------------------- |
| Narodne novine, br. x/yy           | Official gazette, issue x of year yy                            |
| NN MU x/yy                         | The international part of the gazette, which carries treaties   |
| stupanje na snagu, stupa na snagu  | Entry into force                                                |
| primjena, primjenjuje se od        | Application from a date, which can differ from entry into force |
| prijelazne i završne odredbe       | Transitional and final provisions, the last articles of an act  |
| redakcijski pročišćeni tekst       | Editorial consolidation (Porezna uprava). Not official          |
| ispravak                           | Correction notice, its own NN item                              |
| izmjene i dopune                   | Amendments and additions                                        |
| Pravilnik, Naputak, Odluka         | Ministry bylaw, instruction, decision                           |
| porezno razdoblje                  | Tax period, the calendar year for income tax                    |
| primitak, izdatak, dohodak         | Receipt, expense, income (receipts less expenses)               |
| predujam, konačni porez            | Advance payment, final tax                                      |
| načelo blagajne                    | Cash principle: a receipt counts when it is paid                |
| dan isplate                        | The day of payment                                              |
| prirez                             | City surtax on income tax, abolished from 2024                  |
| P.Z. br.                           | Bill number. Numbers restart with each Sabor term               |
| Mišljenje SU, obvezujuće mišljenje | Central Office opinion, binding ruling (OPZ Art. 10)            |

## Sources

- OPZ, Opći porezni zakon: NN 115/16, 106/18, 121/19, 32/20, 42/20, 114/22, 152/24, 151/25. Art. 4, 5. <https://www.zakon.hr/z/100/Op%C4%87i-porezni-zakon>, loaded 4 November 2026.
- ZUP, Zakon o općem upravnom postupku: NN 47/09, 110/21. Art. 80, 81. <https://www.zakon.hr/z/65/Zakon-o-op%C4%87em-upravnom-postupku>, loaded 4 November 2026.
- ZPDoh amendments: NN 114/23, item 1609, Art. 39, 40, 42, <https://narodne-novine.nn.hr/clanci/sluzbeni/2023_10_114_1609.html>. NN 138/20 Art. 17 and NN 152/24 Art. 16, read in the transitional blocks of the zakon.hr consolidated ZPDoh, <https://www.zakon.hr/z/85/Zakon-o-porezu-na-dohodak>. All loaded 4 November 2026.
