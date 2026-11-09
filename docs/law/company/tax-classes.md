---
checked: 2026-11-04
nn_through: 119/26
summary: The tax class each Company category carries, how Kuna counts it for the profit tax and VAT, the VAT treatments and buckets it allows, and the act and article behind it
---

# Tax classes

How Kuna counts a Company category for the profit tax (_porez na dobit_) and VAT of a Croatian d.o.o. Each category carries one class as one of its roles, in the categories tab's `roles` column. The class names the ruleset rules its figures come from, the VAT treatments and buckets it allows, and the heading below. The class list is `TAX_CLASSES` in `src/apps/company/packs/hr-doo/preset/domain/taxClasses.ts`. Law as researched on 4 November 2026, in the consolidated texts on zakon.hr, which were current through NN 119/26. No later issue was checked.

A class says how Kuna counts a category for its estimates. It does not say what a cost is. The accountant keeps the books, decides each booking and files the returns, as [Books and kontos](books-and-kontos.md) explains. Where Kuna's figures and the accountant's differ for a closed year, the accountant's figure wins.

The percentages are not copied here from the law alone. Each one is the value of a dated rule on Settings, Tax rules, and the spec checks that the table below says the same.

## Classes

`From` is the day the percentages are read from the ruleset. `CIT add-back` is the share of the cost Kuna adds back to the profit tax base. `Input VAT back` is the share of the VAT inside a purchase that Kuna counts as a claim on the state, for each kind of VAT the class allows, and `none` where the class carries no VAT Kuna splits out.

| Class                                     | CIT add-back | Input VAT back | VAT treatments                                                                                      | Buckets              | From       |
| ----------------------------------------- | ------------ | -------------- | --------------------------------------------------------------------------------------------------- | -------------------- | ---------- |
| `revenue`                                 | 0%           | none           | `none`                                                                                              | income               | 2026-01-01 |
| `client-refund`                           | 0%           | none           | `none`                                                                                              | income               | 2026-01-01 |
| `grant`                                   | 0%           | none           | `none`                                                                                              | income               | 2026-01-01 |
| `other-income`                            | 0%           | none           | `none`                                                                                              | income               | 2026-01-01 |
| `deductible-cost`                         | 0%           | 100%           | `deductible-25`, `deductible-13`, `deductible-5`, `reverse-charge`, `foreign-vat`, `none`           | operating, taxes     | 2026-01-01 |
| `representation`                          | 50%          | 0%             | `representation`                                                                                    | operating            | 2026-01-01 |
| `personal-transport`                      | 50%          | 50%            | `car-50`, `foreign-vat`, `none`                                                                     | operating            | 2026-01-01 |
| `vehicle-insurance-interest-tax-and-fees` | 0%           | none           | `none`                                                                                              | operating            | 2026-01-01 |
| `non-deductible`                          | 100%         | none           | `none`                                                                                              | operating, taxes     | 2026-01-01 |
| `capital-purchase`                        | 0%           | 100% or 50%    | `deductible-25`, `deductible-13`, `deductible-5`, `car-50`, `reverse-charge`, `foreign-vat`, `none` | operating            | 2026-01-01 |
| `corporate-income-tax`                    | 0%           | none           | `none`                                                                                              | taxes                | 2026-01-01 |
| `vat-settlement`                          | 0%           | none           | `none`                                                                                              | operating, taxes     | 2026-01-01 |
| `profit-distribution`                     | 0%           | none           | `none`                                                                                              | owner-pay, taxes     | 2026-01-01 |
| `salary`                                  | 0%           | none           | `none`                                                                                              | owner-pay            | 2026-01-01 |
| `tax-free:*`                              | 0%           | none           | `none`                                                                                              | owner-pay            | 2026-01-01 |
| `owner-rent`                              | 0%           | none           | `none`                                                                                              | owner-pay            | 2026-01-01 |
| `owner-benefit`                           | 0%           | none           | `none`                                                                                              | owner-pay            | 2026-01-01 |
| `owner-loan-out`                          | 0%           | none           | `none`                                                                                              | owner-pay, financing | 2026-01-01 |
| `owner-loan-repaid`                       | 0%           | none           | `none`                                                                                              | owner-pay, financing | 2026-01-01 |
| `outside-profit`                          | 0%           | none           | `none`                                                                                              | financing, neutral   | 2026-01-01 |

The modifiers `arrears`, `prepaid-annual`, `watched`, `owner-pay-tax` and `reimbursement` are no class. They say when a cost is paid, which tax Kuna waits for, which cost counts in the owner's cost and which balance an advance settles. A category takes any of them beside its class.

## Revenue

Kuna counts this as sales revenue, from the invoices by the days they deliver. The profit tax base starts from the accounting profit (ZPD Art. 5(1)), which the accounts state on the accrual basis (ZoR Art. 15, HSFI). Revenue is also what the rate test reads: below the threshold the lower rate applies (ZPD Art. 6(6) and 6(7)).

Mark: `confirmed-consolidated`. The rate test's revenue, which leaves grants for special circumstances out, is a `reading`.

## Client refund

Kuna counts this as a refund of sales, matched to the client's invoices. It lowers revenue and so the profit the base starts from (ZPD Art. 5(1)).

Mark: `reading`.

## Grant

Kuna counts this as a grant, income as it is used: a fixed part when it is received, and the rest as the funded costs and assets are booked (HSFI 14.20 to 14.22, 15.37 and 15.38). The profit tax takes it as revenue when the accounts recognise it (ZPD Art. 5(1), 6(1)(5)).

Mark: `reading`.

## Other income

Kuna counts this as other operating income, such as interest on the company's account. It enters the profit the base starts from (ZPD Art. 5(1)) but is not sales revenue.

Mark: `confirmed-consolidated`.

## Deductible cost

Kuna counts this as a cost the profit tax allows (ZPD Art. 5(1)). The VAT on a purchase for the business is deducted as input VAT (ZPDV Art. 57(1) and 58(1)). A service from abroad is self-charged and deducted on the same return (ZPDV Art. 75(1)(6)), and VAT paid abroad is never reclaimed in Croatia, so it stays in the cost. Which rate a purchase carries is the supplier's fact, so the owner picks it per category.

Payroll taxes and contributions are deductible costs too. They carry the `owner-pay-tax` modifier, so Kuna also counts them in the owner's cost.

Mark: `confirmed-consolidated`.

## Representation

Kuna counts this as representation: half of it added back to the profit tax base, with no VAT back.

ZPD Art. 7(1)(3) adds back "za 50% troškova reprezentacije (ugošćenja, darova sa ili bez utisnutog znaka tvrtke ili proizvoda, troškova odmora, športa...". The add-back takes the cost with its VAT, as the ruleset's representation rule records (ZPD Art. 7(1)(3), PravPD Art. 23). ZPDV Art. 61(1): "Porezni obveznik ne može odbiti pretporez za nabavu dobara i usluga za potrebe reprezentacije". Branded items not for sale and promotional items up to 22.00 a unit without VAT are not representation (ZPD Art. 7(6)).

Whether a meal or a gift is representation is the accountant's call.

Mark: `confirmed-nn`.

## Personal transport

Kuna counts this as personal car running costs: half added back to the profit tax base, and half of the VAT back.

ZPD Art. 7(1)(4) adds back the share of the costs of a car the company owns or leases, "osim troškova osiguranja i kamata", "ako se na osnovi korištenja sredstava za osobni prijevoz ne utvrđuje plaća". The consolidated text on zakon.hr prints "za 30% troškova" with "(nakon 01.01.2018. za 50%)" after it, and the ruleset records the 50% under NN 115/16. ZPD Art. 7(3) counts the costs with their VAT and names them: for a car the company owns "troškovi goriva i ulja, održavanja i popravaka, registracije i amortizacije" (point 1), and for a leased car the rent, fuel and upkeep, "a kod financijskog najma trošak amortizacije" (point 3). ZPDV Art. 61(2): the company "ne može odbiti 50% pretporeza obračunanog za nabavu ili najam osobnih automobila, uključujući nabavu svih dobara i usluga u vezi s tim dobrima". A personal car has at most eight seats besides the driver's. VAT paid abroad is never reclaimed in Croatia, so `foreign-vat` stays a cost. A supplier outside the VAT system charges none, so the class takes `none` too.

PravPD Art. 25(1) leaves some car costs out of the add-back: "U troškove iz članka 7. stavak 1. točka 4. Zakona za koje se povećava porezna osnovica ne spadaju troškovi osiguranja, kamata povezana s nabavom imovine (sredstva) i plaćeni porez na cestovna motorna vozila i porez na plovila, te naknade i pristojbe koje se obvezno prema posebnim propisima plaćaju pri registraciji sredstva za osobni prijevoz." Those go in a category of the class under [Vehicle insurance, interest, tax and fees](#vehicle-insurance-interest-tax-and-fees), not here. ZPD Art. 7(3)(1) still names "registracije" among the costs, so Kuna reads the paid registration service, such as the technical inspection with its VAT, as a running cost of this class, and only the fees and charges the law requires at registration as left out. That split is a `reading`. Text read on 9 November 2026 in the consolidated PravPD on zakon.hr, through NN 39/26. NN 16/25 and 39/26 leave Art. 25 alone.

A car's depreciation is a running cost too, by Art. 7(3)(1) and 7(3)(3). Kuna adds half of it back from the asset books, as under [Capital purchase](#capital-purchase).

Mark: `confirmed-nn`. Kuna adds back half of the cost that remains after the deductible VAT, which reads ZPD Art. 7(3)'s VAT as the VAT that stays a cost. That base is a `reading`.

Where the private use of the car is taxed as the employee's salary, the add-back does not apply. A class cannot say whether that is so, so Kuna adds the half back on every personal transport category. Whether it should for a given car is the accountant's call.

## Vehicle insurance, interest, tax and fees

Kuna counts this as car insurance, car loan interest, vehicle tax and registration fees: allowed in full, with no VAT. ZPD Art. 7(1)(4) leaves insurance and interest out of the car add-back, and PravPD Art. 25(1) adds the road motor vehicle tax (_porez na cestovna motorna vozila_) and the fees and charges the law requires at registration (_naknade i pristojbe koje se obvezno prema posebnim propisima plaćaju pri registraciji_), as quoted under [Personal transport](#personal-transport). Insurance and credit are exempt from VAT (ZPDV Art. 40(1)(a) and 40(1)(b)). A tax and a fee the state charges carry no VAT, so the class allows no VAT treatment but `none`.

Mark: `confirmed-consolidated`. Which registration costs are fees the law requires and which are a paid service is a `reading`, as under [Personal transport](#personal-transport).

## Non-deductible

Kuna counts this as fines and private costs, all of it added back. ZPD Art. 7(1)(7) adds back fines a competent body imposes, and Art. 7(1)(13) "sve druge rashode koji nisu izravno u svezi s ostvarivanjem dobiti". Art. 7(2) adds nothing back where income tax was paid on the item.

Mark: `confirmed-consolidated`.

## Capital purchase

Kuna counts this as an asset above the threshold, depreciated over its life. An item costing more than 665.00 a unit and lasting longer than a year is a long-term asset (ZPD Art. 12(3), HSFI 6.19 and 6.20). Below the threshold it is small inventory, written off when put in use. A personal car bought as an asset keeps half of its VAT, as under personal transport.

Mark: `confirmed-nn`.

A personal car's depreciation counts only up to a cost of 54,000.00 per car (ZPD Art. 12(13), PravPD Art. 22(3)), and Kuna adds the rest back in full on PD line 18. ZPD Art. 7(3)(1) and 7(3)(3) count the depreciation of an owned or finance-leased car among the costs of which Art. 7(1)(4) adds half back, and PravPD Art. 25(3) keeps a car whose depreciation the cap cuts in that count: "U obračun troškova iz stavka 1. ovoga članka uključuju se i troškovi prijevoznih sredstava za koje se ne priznaje trošak amortizacije u smislu članka 22. stavak 3. ovoga Pravilnika." So Kuna adds back half of the depreciation the cap allows on PD line 7, beside the car's running costs, for every asset in the car group. Text read on 9 November 2026 in the consolidated ZPD and PravPD on zakon.hr, through NN 128/26 for the database, NN 151/25 for the act and NN 39/26 for the Pravilnik.

Mark: `confirmed-consolidated`. Taking the half from the allowed depreciation alone, and not from the part above the cap that is already added back in full, is a `reading`. So is adding it back for every car: PravPD Art. 25(2) leaves out a car used only for an activity such as a driving school, a taxi or rental, and ZPD Art. 7(1)(4) a car whose private use is taxed as salary, and the assets tab says neither.

## Corporate income tax

Kuna counts this as profit tax paid or refunded, not a cost. The base is the profit before the tax. The monthly advances (ZPD Art. 34(1)) and the balance due or refunded on the return (ZPD Art. 35) settle the liability with the state.

Mark: `confirmed-consolidated`.

## VAT settlement

Kuna counts this as VAT paid or refunded, not a cost. A VAT payment settles the return, and a credit is refunded on request or carried forward (ZPDV Art. 66(1) and 66(2)). Kuna takes it out of profit whatever its bucket, so operating and taxes are both allowed.

Mark: `confirmed-consolidated`.

## Profit distribution

Kuna counts this as a profit payout, or the tax withheld on it, not a cost. Only distributable profit may be paid out (ZTD Art. 406(1)). The dividend tax is withheld at payout (ZPDoh Art. 69 and 70). The tax's category carries the `owner-pay-tax` modifier beside this class.

Mark: `confirmed-consolidated`.

## Salary

Kuna counts this as an employee's net salary, from which it works out the contributions and income tax (ZDop Art. 13(1) and 14(1)(1), ZPDoh Art. 19 and 24(3)).

Mark: `confirmed-consolidated`.

## Tax-free payments

Kuna counts this as one tax-free payment to an employee, one class for each payment of the caps table, such as `tax-free:results-bonus` (ZPDoh Art. 9(1)(9), PravPDoh Art. 7(2) as replaced by NN 16/25). What is paid above a cap is salary.

Mark: `confirmed-nn`. Whether a gift in kind counts inside the 700.00 a year of item 25 is `unconfirmed`.

## Owner rent

Kuna counts this as rent paid to the owner. The owner pays income tax on it at 12% after a flat 30% of expenses (ZPDoh Art. 57(1) and 62(1)).

Mark: `confirmed-consolidated`.

## Owner benefit

Kuna counts this as the owner's private share of company costs, in the owner-pay bucket. ZPDoh Art. 66(1) taxes a member's private use of the company's assets and services as capital income. ZPD Art. 7(1)(13) adds private costs back to the profit tax base, unless income tax was paid on them (Art. 7(2)).

Mark: `reading`. Kuna adds nothing back for the private share and counts no tax on it. Whether that holds depends on the income tax being paid, so it is on the [watch list](../sources/watch-list.md#company-classes).

## Owner loan out

Kuna counts this as a loan to the owner. The interest has to reach the related-party rate (ZPD Art. 14(3)), a rate below 2% is a benefit in kind (ZPDoh Art. 21(3)), and a sole member's deal with the company needs a written record (ZTD Art. 426(8)). Settings' loan switch shows loans in owner-pay or financing, so both are allowed.

Mark: `confirmed-nn`.

## Owner loan repaid

Kuna counts this as the owner repaying a loan, with its interest at the related-party rate (ZPD Art. 14(3)). Owner-pay and financing are both allowed, as for the loan out.

Mark: `confirmed-nn`.

## Outside profit

Kuna counts this as outside profit: transfers between the company's accounts, bank loans and their repayment, share capital, and reimbursements between the owner and the company. None of them is income or an expense, so none enters the profit the base starts from (ZPD Art. 5(1)).

Mark: `reading`.

## Worked example

Made-up figures, on the rules of 2026:

- A client dinner of 100.00 in a representation category. Kuna counts the whole 100.00 as a cost with no VAT back, and adds 50.00 back to the tax base.
- A fuel bill of 125.00 in a personal transport category, with 25.00 of VAT inside. Kuna counts 12.50 as input VAT, 112.50 as the cost, and adds 56.25 back.
- An insurance policy of 400.00 and a registration fee of 60.00 for the same car, in a vehicle insurance, interest, tax and fees category. Kuna counts the whole 460.00 as an allowed cost and adds nothing back.
- The same car on the assets tab at a cost of 40,000.00, put in use in December 2025. At 20% it depreciates 8,000.00 in 2026, all of it under the 54,000.00 cap. Kuna adds 4,000.00 back on PD line 7, which is 400.00 of profit tax at 10%.

## Open points

- The owner's private share, as under [Owner benefit](#owner-benefit).
- Half of a personal car's depreciation, taken from what the cap allows and for every car, as under [Capital purchase](#capital-purchase).
- Which registration costs the add-back leaves out, as under [Personal transport](#personal-transport).
- The car add-back where private use is taxed as salary, as under [Personal transport](#personal-transport). The class cannot express it.
- The base of the car add-back, as under [Personal transport](#personal-transport).
- Gifts in kind inside the 700.00 a year, as under [Tax-free payments](#tax-free-payments).

## Sources

- Zakon o porezu na dobit (ZPD), consolidated, "na snazi od 01.01.2026.", NN 177/04 to 151/25: Art. 5(1), 6(6), 6(7), 7(1)(3), 7(1)(4), 7(1)(7), 7(1)(13), 7(2), 7(3), 7(6), 12(3), 14(3), 34(1) and 35. https://www.zakon.hr/z/99/zakon-o-porezu-na-dobit, loaded on 4 November 2026.
- Zakon o porezu na dobit (ZPD), consolidated, same text: Art. 7(1)(4), 7(3) and 12(13), and NN 151/25, which changes Art. 7 only in paragraph 9. Reloaded on 9 November 2026, the database "ažurirana 08.11.2026. zaključno sa NN 128/26".
- Pravilnik o porezu na dobit (PravPD), consolidated, NN 95/05 to 39/26: Art. 22(3), 25(1), 25(2) and 25(3). https://www.zakon.hr/cms.htm?id=60061, loaded on 9 November 2026. NN 16/25 (https://narodne-novine.nn.hr/clanci/sluzbeni/2025_01_16_151.html) and NN 39/26 (https://narodne-novine.nn.hr/clanci/sluzbeni/2026_04_39_469.html) were read for the articles they amend, and touch neither Art. 22 nor 25. No 2026 issue through NN 129/26 carries a further amendment of the act or the Pravilnik, by an NN title search of 9 November 2026.
- Zakon o porezu na dodanu vrijednost (ZPDV), consolidated, "na snazi od 30.03.2026.": Art. 40(1)(a) and (b), 57(1), 58(1), 61(1), 61(2), 66(1), 66(2) and 75(1)(6). https://www.zakon.hr/z/1455/zakon-o-porezu-na-dodanu-vrijednost, loaded on 4 November 2026.
- Zakon o porezu na dohodak (ZPDoh): Art. 9(1)(9), 19, 21(3), 24(3), 57(1), 62(1), 66(1), 69 and 70. https://www.zakon.hr/z/85/zakon-o-porezu-na-dohodak
- Pravilnik o izmjenama i dopunama Pravilnika o porezu na dohodak, NN 16/25, Art. 2 replacing Art. 7(2). https://narodne-novine.nn.hr/clanci/sluzbeni/2025_01_16_148.html
- Zakon o doprinosima (ZDop): Art. 13(1) and 14(1)(1), as the ruleset cites them.
- Zakon o trgovačkim društvima (ZTD): Art. 406(1) and 426(8), as the ruleset cites them.
- Zakon o računovodstvu (ZoR) Art. 15, and the HSFI as the ruleset cites them.

The ruleset on Settings, Tax rules gives each rule's act, issues and article, with the day it was loaded.
