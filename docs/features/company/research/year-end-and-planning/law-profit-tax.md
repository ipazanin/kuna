# Corporate income tax (porez na dobit) for the company, tax years 2025 to 2027

Croatian corporate income tax rules for the company, tax years 2025 to 2027, with citations.

Research lane: corporate income tax for a small Croatian d.o.o. Written 2026-10-18 for the ledgerboard Wave 8 ruleset. These are planning rules to discuss with the accountant. They are not filing advice.

## How to read this

- **Tax year** means the tax period (porezno razdoblje). The return for tax year 2025 is filed in 2026, the return for 2026 in 2027.
- **Confidence marks**
  - HIGH: the primary text was loaded and the wording is direct.
  - MEDIUM: the primary text was loaded, but applying it to the company needs a reading the text does not spell out, or the text came only from the zakon.hr consolidated version.
  - LOW: inference or secondary source only.
  - UNCONFIRMED: could not load or confirm the primary source.
- **Abbreviations used in citations.** ZPD is the Zakon o porezu na dobit. Pravilnik is the Pravilnik o porezu na dobit. ZPDoh is the Zakon o porezu na dohodak. "PD line n" is the numbered line (redni broj) of the PD return form as described in Pravilnik Art. 47(3).

## Sources loaded on 2026-10-18

| Id  | Document                                                                   | NN issue                                                                                                                         | Where loaded                                                                                   | Used for                                                                                       |
| --- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| S1  | ZPD, consolidated text, version in force from 1.1.2026                     | 177/04, 90/05, 57/06, 146/08, 80/10, 22/12, 148/13, 143/14, 50/16, 115/16, 106/18, 121/19, 32/20, 138/20, 114/22, 114/23, 151/25 | zakon.hr/z/99 (base updated 16.10.2026 through NN 109/26)                                      | All ZPD articles. A consolidation aid, checked against S2 to S4 for the amended articles       |
| S2  | Zakon o izmjenama i dopunama ZPD                                           | 151/2025 (15.12.2025), in force 1.1.2026                                                                                         | narodne-novine.nn.hr/clanci/sluzbeni/2025_12_151_2261.html                                     | 2026 changes                                                                                   |
| S3  | Zakon o izmjenama i dopunama ZPD                                           | 114/2023 (4.10.2023), most articles in force 1.1.2024                                                                            | narodne-novine.nn.hr/clanci/sluzbeni/2023_10_114_1613.html                                     | 1,000,000 EUR threshold, 54,000 EUR car cap, 665 EUR asset threshold, filing and payment dates |
| S4  | Zakon o izmjenama i dopunama ZPD                                           | 115/2016 (9.12.2016)                                                                                                             | narodne-novine.nn.hr/clanci/sluzbeni/2016_12_115_2527.html                                     | Representation 70% to 50%, personal transport 30% to 50% from 1.1.2018, Art. 34(1) advances    |
| S5  | Pravilnik, consolidated text                                               | 95/05 ... 156/23, 16/25, 39/26                                                                                                   | zakon.hr/cms.htm?id=60061                                                                      | Pravilnik articles, PD line definitions                                                        |
| S6  | Pravilnik o izmjenama i dopunama Pravilnika                                | 39/2026 (15.4.2026), in force 16.4.2026                                                                                          | narodne-novine.nn.hr/clanci/sluzbeni/2026_04_39_469.html                                       | New PD forms for 2026 onward, transitional rules                                               |
| S7  | Pravilnik o izmjenama i dopunama Pravilnika                                | 156/2023                                                                                                                         | narodne-novine.nn.hr/clanci/sluzbeni/2023_12_156_2396.html                                     | PD form used for tax years 2024 and 2025                                                       |
| S8  | Odluka o objavi kamatne stope na zajmove između povezanih osoba (for 2025) | 151/2024, corrected by 154/2024                                                                                                  | narodne-novine.nn.hr/clanci/sluzbeni/2024_12_151_2486.html, correction loaded on zakon.hr only | 4.38% for 2025                                                                                 |
| S9  | Odluka o objavi kamatne stope na zajmove između povezanih osoba (for 2026) | 150/2025                                                                                                                         | narodne-novine.nn.hr/clanci/sluzbeni/2025_12_150_2236.html                                     | 2.65% for 2026                                                                                 |
| S10 | ZPDoh, consolidated text, in force from 1.1.2025                           | 115/16, 106/18, 121/19, 32/20, 138/20, 151/22, 114/23, 152/24                                                                    | zakon.hr/z/85                                                                                  | Art. 21(3) loan benefit, Art. 64 to 66 capital income                                          |
| S11 | ECB key interest rates table                                               | n/a                                                                                                                              | ecb.europa.eu key_ecb_interest_rates                                                           | Estimating the 2027 related-party rate                                                         |
| S12 | Porezna uprava, call for public consultation (tax package 2026)            | n/a                                                                                                                              | porezna-uprava.gov.hr/hr/poziv-na-javno-savjetovanje-8833/8833                                 | Draft ZPD amendment exists (e-Savjetovanja 10189)                                              |
| S13 | HZZ measure page "Potpora za samozapošljavanje" (archived 2022 version)    | n/a                                                                                                                              | mjere.hzz.hr/mjere/potpora-za-samozaposljavanje/                                               | Grant conditions, de minimis status. Old terms, see R13                                        |
| S14 | RRiF supplement "Kamate" (RRiF 2/26), secondary professional source        | n/a                                                                                                                              | rrif.hr/VIII_KAMATE_-24448C.pdf                                                                | Cross-check of interest rules                                                                  |
| S15 | TEB news on the 2026 consultation, secondary                               | n/a                                                                                                                              | teb.hr/novosti/2026/izmjene-poreznih-zakona-i-zakona-o-doprinosima-otvorena-savjetovanja/      | Content of the draft ZPD amendment                                                             |

Not loadable: the draft text on esavjetovanja.gov.hr/Econ/10189 (the page renders by script and returned no text). Anything taken from the draft is UNCONFIRMED and comes through S15.

## Facts that change the answers

- A company's first tax period runs from the start of business to 31 December of that year (ZPD Art. 29(3)(1)). Two consequences follow, both covered below. The company pays no corporate income tax advances in its first year (ZPD Art. 34(3)). The monthly advance for the second year is the first-year liability divided by the months of operation in the first year, not by 12 (Pravilnik Art. 47(3) PD line 59, ZPD Art. 34(1)). A company that opened in mid-year therefore pays larger advances in its second year, which can produce an overpayment at filing.
- Revenue far below 1,000,000 EUR means the 10% rate applies in all three years.
- A small d.o.o. often has a director who is also the sole owner and owner loans in the ledger. Dealings between the owner and the company, such as loans or a lease, and state grants each have their own rule below.

---

## R1. Tax base starts from accounting profit

**Rule.** The tax base is the profit determined under accounting rules as revenue minus expenses before corporate income tax, increased and decreased under the ZPD (ZPD Art. 5(1)). Expenses not connected to the business, and not a consequence of it, are not expenses of the tax period (ZPD Art. 5(6)). Revenue means gross increases in economic benefits during the period (Pravilnik Art. 9(1)). Expenses mean decreases in economic benefits made to increase revenue or profit (Pravilnik Art. 11(1)). The base is built from the books and the financial statements (balance sheet and income statement) unless the ZPD says otherwise (ZPD Art. 33(1)).

The PD return follows this order (Pravilnik Art. 47(3)): line 1 total revenue, line 2 total expenses, line 3 profit or line 4 loss, lines 5 to 25 increases with their total on line 26, lines 27 to 34 decreases with their total on line 35, line 36 profit or loss after adjustments, line 37 loss brought forward, line 38 tax base, line 43 rate, line 44 tax, lines 45 to 52 reliefs, line 53 liability, line 54 foreign tax credit, line 55 tax to pay, line 56 advances paid, line 57 balance due, line 58 refund, line 59 monthly advance for the next period.

|                 | 2025                                             | 2026                                                                                                                 | 2027                          |
| --------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| Base formula    | Art. 5(1)                                        | same                                                                                                                 | same, no enacted change found |
| PD form version | form from NN 156/23 (applies from tax year 2024) | form from NN 39/26 (applies from tax year 2026). Same line numbers, plus a new line 33.a for qualifying sponsorships | NN 39/26 form unless replaced |

**Source.** ZPD Art. 5(1), 5(6), 33(1) (S1, Art. 33 as amended by NN 151/25, S2). Pravilnik Art. 9, 11, 47(3) (S5). Form versions: NN 156/23 Art. 20 (S7), NN 39/26 Art. 10 and 11 (S6).

**Confidence.** HIGH.

## R2. Rate and revenue threshold

**Rule.** The rate is 10% when revenue in the tax period is up to 1,000,000.00 EUR, and 18% when revenue is equal to or greater than 1,000,000.00 EUR (ZPD Art. 28). The test uses revenue of the **same** period, PD line 1 minus line 28 (Pravilnik Art. 47(3) line 43). Line 28 holds only grants received for "special circumstances" (ZPD Art. 6(6) and 6(7)). A tax-period revenue of exactly 1,000,000.00 EUR is taxed at 18%.

|           | 2023 (context) | 2024             | 2025             | 2026             | 2027                      |
| --------- | -------------- | ---------------- | ---------------- | ---------------- | ------------------------- |
| Threshold | 995,421.06 EUR | 1,000,000.00 EUR | 1,000,000.00 EUR | 1,000,000.00 EUR | 1,000,000.00 EUR, assumed |
| Low rate  | 10%            | 10%              | 10%              | 10%              | 10%, assumed              |
| High rate | 18%            | 18%              | 18%              | 18%              | 18%, assumed              |

**Source.** ZPD Art. 28 (NN 115/16, 138/20, 114/22, 114/23). The threshold change came from NN 114/23 Art. 8, in force 1.1.2024 and applied from tax year 2024 (S3, Art. 13(1) and 15). Advances for 2024 based on the 2023 return were already computed under the new rule (NN 114/23 Art. 13(3)). The 2027 column assumes no change. The 2026 draft amendment does not touch the rates (S15, UNCONFIRMED for the draft itself).

**Confidence.** HIGH for 2025 and 2026. MEDIUM for 2027.

## R3. Optional cash-basis tax base (novčano načelo)

**Rule.** A taxpayer whose revenue in the **previous** period did not exceed 1,000,000.00 EUR may determine the base on the cash principle (ZPD Art. 5(7)). The accrual profit is then adjusted for non-cash items and changes in receivables, payables and inventories (ZPD Art. 5(8) to 5(10), Pravilnik Art. 11.b). Conditions: a statement to the Porezna uprava no later than 15 days after the start of the period (ZPD Art. 5(11)), VAT on the cash basis (oporezivanje prema naplaćenim naknadama) if the company is in the VAT system (ZPD Art. 5(12)), and staying on the method for at least three periods (ZPD Art. 5(13)). The return is the PD-NN form (Pravilnik Art. 46(1)(2), 47.c). Switching back to accrual reverses the adjustments (ZPD Art. 16(4), Pravilnik Art. 41(4)).

This matters because the ledger is cash-based. If the company files PD (accrual), the ledger needs accrual adjustments to estimate the base. If the company files PD-NN, the ledger is closer to the base but still needs the Art. 5(9) list.

|                          | 2025                            | 2026             | 2027                      |
| ------------------------ | ------------------------------- | ---------------- | ------------------------- |
| Prior-year revenue limit | 1,000,000.00 EUR                | 1,000,000.00 EUR | 1,000,000.00 EUR, assumed |
| Election deadline        | 15 days after the period starts | same             | same                      |

**Source.** ZPD Art. 5(7) to 5(14), 16(4) (S1, threshold from NN 114/23 Art. 2, S3). Pravilnik Art. 11.b, 41(4), 46(1), 47.c (S5).

**Confidence.** HIGH for the rule. Which method the company uses is a question for the owner.

## R4. Representation (reprezentacija), 50% not deductible

**Rule.** The base is increased by 50% of representation costs: hospitality, gifts with or without the company logo, holidays, sport, recreation, and hire of cars, vessels, aircraft and holiday houses, to the extent they arise from a business relationship with a business partner (ZPD Art. 7(1)(3)). The amount includes the related VAT (Pravilnik Art. 23(2)). Business partners include expected partners (Pravilnik Art. 23(1)). Tips count as representation (Pravilnik Art. 23(3)). Promotional items with the company name given to consumers are not representation if each is worth up to 22.00 EUR without VAT (ZPD Art. 7(6)). No increase applies when income tax is calculated and paid on the item (ZPD Art. 7(2)). PD line 6.

|                        | 2025      | 2026      | 2027               |
| ---------------------- | --------- | --------- | ------------------ |
| Non-deductible share   | 50%       | 50%       | 50%, assumed       |
| Promotional item limit | 22.00 EUR | 22.00 EUR | 22.00 EUR, assumed |

**Source.** ZPD Art. 7(1)(3) (70% changed to 50% by NN 115/16 Art. 4, S4), Art. 7(2), 7(6) (22.00 EUR from NN 114/23 Art. 4, S3). Pravilnik Art. 23, 24 (S5).

**Confidence.** HIGH.

## R5. Personal transport (cars, vessels, aircraft), 50% not deductible

**Rule.** The base is increased by 50% of the costs of owned or rented motor vehicles and other personal transport (car, vessel, helicopter, aircraft and similar) used by managing and other employed persons, unless the private use is taxed as salary (benefit in kind) (ZPD Art. 7(1)(4) and 7(2)). Excluded from the 50% base: insurance, interest on financing the asset, road motor vehicle tax and vessel tax, and the mandatory registration fees and charges (ZPD Art. 7(1)(4), Pravilnik Art. 25(1)). Included, with VAT: for owned assets, fuel and oil, maintenance and repairs, registration and depreciation. For rent-a-car, the charge plus fuel. For leased vehicles, the lease fee, fuel, maintenance and other costs the lessee bears, and for a finance lease the depreciation (ZPD Art. 7(3)). Vehicles used exclusively in activities such as driving schools, taxi or rental are not "personal transport" (Pravilnik Art. 25(2)). PD line 7.

|                      | 2025                                 | 2026 | 2027         |
| -------------------- | ------------------------------------ | ---- | ------------ |
| Non-deductible share | 50%                                  | 50%  | 50%, assumed |
| Exception            | private use taxed as benefit in kind | same | same         |

**Source.** ZPD Art. 7(1)(4), 7(2), 7(3) (S1). The 30% to 50% change is NN 115/16 Art. 4, in force 1.1.2018 (S4, Art. 15). Note that the zakon.hr consolidated text still prints "za 30%" with the remark "(nakon 01.01.2018. za 50%)". S4 and the 2026 PD line 7 wording ("Svota 50% troškova sredstava za osobni prijevoz") confirm 50%. Pravilnik Art. 25 (S5).

**Confidence.** HIGH. VAT input deduction limits on cars belong to the VAT lane.

## R6. Depreciation: maximum rates, asset threshold, car cap

**Rule.** Depreciation is deductible on the straight-line method at no more than the annual rates below, computed per asset (ZPD Art. 12(1), 12(2), 12(5)). The rates may be doubled (ZPD Art. 12(6)). Lower depreciation booked in the accounts is also the deductible amount (ZPD Art. 12(7)). Depreciation starts on the first day of the month after the asset is put into use (ZPD Art. 12(8)). A long-term asset is an item with a unit cost above the threshold and a useful life over one year (ZPD Art. 12(3)). Depreciation above the allowed rates is added back (ZPD Art. 7(1)(2), PD line 18). Depreciation is not deductible for assets not used in the business (ZPD Art. 12(15)).

Depreciation of a personal car or other personal transport is recognised only up to the cap on cost per asset. Above the cap it is recognised only if the asset serves exclusively a registered rental or transport activity (ZPD Art. 12(13), Pravilnik Art. 22(3), PD line 5). The 50% add-back in R5 then applies to the depreciation that remains.

| Asset group (ZPD Art. 12(5))                                                 | Life     | Max rate | Doubled |
| ---------------------------------------------------------------------------- | -------- | -------- | ------- |
| Buildings, ships over 1000 BRT                                               | 20 years | 5%       | 10%     |
| Basic herd, personal cars                                                    | 5 years  | 20%      | 40%     |
| Intangible assets, equipment, vehicles other than cars, machinery            | 4 years  | 25%      | 50%     |
| Computers, computer equipment and software, mobile phones, network equipment | 2 years  | 50%      | 100%    |
| Other assets                                                                 | 10 years | 10%      | 20%     |

|                                   | 2023 (context) | 2025          | 2026          | 2027                   |
| --------------------------------- | -------------- | ------------- | ------------- | ---------------------- |
| Asset threshold (unit cost above) | 464.53 EUR     | 665.00 EUR    | 665.00 EUR    | 665.00 EUR, assumed    |
| Car depreciation cap per asset    | 53,089.12 EUR  | 54,000.00 EUR | 54,000.00 EUR | 54,000.00 EUR, assumed |

**Source.** ZPD Art. 12 (NN 143/14, 114/22, 114/23) (S1). Thresholds from NN 114/23 Art. 7, in force 1.1.2024 (S3). Pravilnik Art. 22 (S5).

**Confidence.** HIGH.

## R7. Vessels, aircraft, apartments and holiday houses held as company assets

**Rule.** Depreciation of a vessel (a ship, boat or yacht for leisure, sport, recreation or hire, ZPD Art. 12(20)) held as a long-term asset is deductible only if the company is registered for vessel rental and transport **and** earns from using the vessel in the period at least 7% of its acquisition value (5% for apartments and holiday houses) (ZPD Art. 12(16)). If either condition fails, the base is increased by the depreciation **and by all related costs** of using the asset for that period (ZPD Art. 12(17), Pravilnik Art. 22(7)). A leased vessel follows a parallel test: lease costs are deductible only if the vessel earned at least the lease cost (ZPD Art. 12(19)). The company must attach an asset-by-asset schedule to the PD (Pravilnik Art. 22(11)). PD line 5.

|                            | 2025                    | 2026 | 2027        |
| -------------------------- | ----------------------- | ---- | ----------- |
| Vessel revenue test        | 7% of acquisition value | 7%   | 7%, assumed |
| Apartments, holiday houses | 5%                      | 5%   | 5%, assumed |

**Source.** ZPD Art. 12(16) to 12(21) (S1). Pravilnik Art. 22(7) to 22(11) (S5).

**Confidence.** HIGH for the rule. It only matters if a boat or boat costs run through the company.

## R8. Fines and enforcement costs, 100% not deductible

**Rule.** The base is increased by fines imposed by a competent body (ZPD Art. 7(1)(7)). This covers all fines imposed by administrative and judicial bodies (Pravilnik Art. 28). It is also increased by the costs of forced collection of taxes or other levies, meaning the procedure costs, not the tax itself (ZPD Art. 7(1)(6), Pravilnik Art. 27), and by default interest between related persons (ZPD Art. 7(1)(8), Pravilnik Art. 29). PD lines 9 and 11. Late-payment interest charged by the tax authority is not on the Art. 7 list. Reading: it stays deductible unless it falls under Art. 7(1)(13).

|                | 2025 | 2026 | 2027          |
| -------------- | ---- | ---- | ------------- |
| Fines add-back | 100% | 100% | 100%, assumed |

**Source.** ZPD Art. 7(1)(6) to 7(1)(8) (S1). Pravilnik Art. 27 to 29 (S5).

**Confidence.** HIGH for fines. LOW for the reading on tax late-payment interest.

## R9. Gifts, donations and sponsorships

**Rule.** Donations in cash or kind made in Croatia for cultural, scientific, educational, health, humanitarian, sport, religious, environmental and other public-benefit purposes to associations, public bodies and similar recipients are deductible up to 2% of revenue of the **previous or the current** period (ZPD Art. 7(7)). Payment of a person's medical costs not covered by insurance counts as a donation if paid to the recipient or the health institution against proper documents (ZPD Art. 7(9)). The base is increased by donations above that limit, and by any donation that brings a direct or indirect benefit to the company or a related person (ZPD Art. 7(1)(10)). Sponsorships that come with promotion of the sponsor are not donations (Pravilnik Art. 30(8)). Gifts to business partners are representation (R4). PD line 14.

New from 2026: the base is **decreased** by sponsorships made in Croatia for those public-benefit purposes to subjects listed in a ministry decision (ZPD Art. 6(1)(6), 6(8), PD line 33.a).

|                      | 2025                           | 2026                          | 2027               |
| -------------------- | ------------------------------ | ----------------------------- | ------------------ |
| Donation cap         | 2% of prior or current revenue | 2%                            | 2%, assumed        |
| Sponsorship decrease | not available                  | available for listed subjects | available, assumed |

**Source.** ZPD Art. 7(1)(10), 7(7) to 7(9) (as amended by NN 114/23 Art. 4, S3, and NN 151/25 Art. 3, S2). Art. 6(1)(6) and 6(8) added by NN 151/25 Art. 2 (S2). Pravilnik Art. 30, 47(3) line 33.a (S5, S6).

**Confidence.** HIGH.

## R10. Private and non-business expenses, hidden profit distributions

**Rule.** Expenses not connected to the business are not expenses of the period (ZPD Art. 5(6)). The base is increased by all other expenses not directly connected to earning profit (ZPD Art. 7(1)(13), Pravilnik Art. 31, PD line 24). It is also increased by expenses found in a tax audit, with the related VAT, income tax and contributions, that arose from hidden profit distributions and withdrawals by members (ZPD Art. 7(1)(12), PD line 9). No add-back applies where income tax is calculated and paid under the ZPDoh, except for points 9 and 12 (ZPD Art. 7(2)). The company must keep a record of costs paid for the private needs of natural persons, with date, person, OIB, type and amount (Pravilnik Art. 26.a). Bribes and other illicit benefits are never deductible (ZPD Art. 7.a).

On the owner's side, the use of company assets or services by a member for private needs during the period, charged to current profit, is capital income (a hidden profit distribution) under ZPDoh Art. 66(1). The tax rate on that income belongs to the personal income tax lane.

|      | 2025     | 2026 | 2027          |
| ---- | -------- | ---- | ------------- |
| Rule | as above | same | same, assumed |

**Source.** ZPD Art. 5(6), 7(1)(12), 7(1)(13), 7(2), 7.a (S1). Pravilnik Art. 26.a, 31 (S5). ZPDoh Art. 66 (S10).

**Confidence.** HIGH for the rule. Whether a given ledger item is private is a fact question.

## R11. Other add-backs (listed for completeness)

These are unlikely for the company but belong in a complete ruleset.

- Value adjustments of receivables are deductible only if more than 60 days passed from maturity to period end and the claim was not collected by the 15th day before filing, plus collection steps (ZPD Art. 9(1) to 9(3)). Small time-barred claims can be written off up to 665.00 EUR per business debtor and 40.00 EUR per private debtor (ZPD Art. 9(4), amounts from NN 114/23 Art. 6). PD line 20.
- Provisions are deductible only for the listed purposes (severance, warranty, started lawsuits, unused annual leave and similar) (ZPD Art. 11, Pravilnik Art. 36). PD line 23.
- Unrealised losses on shares are added back (ZPD Art. 7(1)(1), PD line 17).
- Shortages of assets above the chamber's allowed level (ZPD Art. 7(1)(5), PD line 8).
- Benefits given to make an event happen or not happen (ZPD Art. 7(1)(9), PD line 13).

**Source.** S1, S5. **Confidence.** HIGH.

## R12. Decreases of the base

**Rule.** The base is decreased by (ZPD Art. 6(1)): dividends and profit shares received (point 1), unrealised gains on shares previously taxed (point 2), collected written-off receivables previously taxed (point 3), depreciation not recognised in earlier periods up to the Art. 12 amounts (point 4, PD line 33), tax incentives granted as a tax exemption or relief under special laws (point 5), and, from 2026, listed sponsorships (point 6, see R9). It may be decreased by earlier-period expenses that were added back and now qualify (ZPD Art. 6(2), Pravilnik Art. 20, PD line 30). It is decreased by grants received to mitigate the effects of "special circumstances" under the general tax act, and those grants do not count toward the revenue thresholds (ZPD Art. 6(6) and 6(7), PD line 28). Pravilnik Art. 9(7) says this does not include state aid granted in the period regardless of special circumstances. The state aid for education and training and for research and development are listed decreases (Pravilnik Art. 14, 15, PD line 34).

The list is closed. Ordinary grants, such as an HZZ self-employment grant, are not on it (see R13).

**Source.** ZPD Art. 6 (NN 143/14, 32/20, 151/25) (S1, S2). Pravilnik Art. 9(6), 9(7), 12 to 15, 20 (S5).

**Confidence.** HIGH.

## R13. State grants, such as an HZZ self-employment grant

**Rule as read.** The ZPD has no exemption for an HZZ self-employment grant (potpora za samozapošljavanje) received by a d.o.o. The grant is therefore taxable revenue in the period in which accounting rules recognise it in the income statement (ZPD Art. 5(1), Pravilnik Art. 9(1)). None of the Art. 6 decreases applies: point 5 covers only incentives "in the form of a tax exemption or relief", and Art. 6(6) covers only special-circumstance aid, which Pravilnik Art. 9(7) expressly separates from aid granted irrespective of special circumstances. For the same reason the grant counts toward the 1,000,000 EUR revenue test (ZPD Art. 6(7) carves out only special-circumstance aid).

**Timing follows the accounting.** A grant tied to running costs is usually recognised as those costs arise, and a grant tied to equipment is usually spread over the equipment's depreciation. How the accountant books it decides which tax year it lands in. That is for the accounting lane.

**Repayment risk.** The HZZ grant is de minimis aid with a retention period. The archived 2022 terms (S13) required keeping the business and the beneficiary's employment for 24 months. A breach in the first 12 months meant repaying the whole grant, and in the second 12 months the variable part and 50% of the fixed part, with default interest. A repayment obligation would become an expense when it arises. The terms of each grant contract may differ from the 2022 page.

**What does not apply.** The Porezna uprava opinions that the HZZ grant is not taxable income concern obrtnici under the ZPDoh (for example the opinion of 12.12.2014, class 410-01/1-01/2642, as reproduced by RRiF, and opinion 2155 of 2016). They do not apply to a d.o.o.

|                                  | 2025                                 | 2026 | 2027          |
| -------------------------------- | ------------------------------------ | ---- | ------------- |
| Tax treatment                    | revenue when recognised, no decrease | same | same, assumed |
| Counts toward 1,000,000 EUR test | yes                                  | yes  | yes, assumed  |

**Source.** ZPD Art. 5(1), 6(1)(5), 6(6), 6(7) (S1). Pravilnik Art. 9(1), 9(7) (S5). HZZ conditions: S13 (2022 archive, terms for later grant years UNCONFIRMED).

**Confidence.** MEDIUM. No Porezna uprava opinion on the corporate tax treatment of this grant for a company was found. The reading rests on the closed list in Art. 6.

## R14. Loss carry-forward

**Rule.** A negative base is a tax loss (ZPD Art. 17(1)). It is carried forward and offset against the base in the following five years (ZPD Art. 17(2), Pravilnik Art. 38(1)), oldest loss first (ZPD Art. 17(4)). The right lapses when ownership changes by more than 50% during a period and the company had been inactive for two periods before, or substantially changes its activity within two periods after (ZPD Art. 17(5) and 17(7), Pravilnik Art. 38(4)). PD lines 37, 40, 41 and part IX of the PD (losses by year of origin).

|               | 2025          | 2026          | 2027                   |
| ------------- | ------------- | ------------- | ---------------------- |
| Carry-forward | 5 years, FIFO | 5 years, FIFO | 5 years, FIFO, assumed |
| Carry-back    | none          | none          | none                   |

**Source.** ZPD Art. 17 (S1, consolidated text only). Pravilnik Art. 38, 47(3) and 47(4) (S5).

**Confidence.** MEDIUM. Art. 17 was not checked against an NN issue because it has not been amended since 2004 and the consolidated text marks no amendment.

## R15. Loans from the company to the owner (posudba vlasniku)

**Corporate income tax side.**

- The deemed-interest rule for related-party loans says that interest income on a loan to a related person is computed at least at the rate that would apply between unrelated persons when the loan is granted (ZPD Art. 14(1)). The minister publishes that rate before the period starts (ZPD Art. 14(3), Pravilnik Art. 37(2)). Alternatively the company may use an arm's-length method under Art. 13 for all its contracts (ZPD Art. 14(4)). An interest-free or cheap loan gives an increase of the base equal to the shortfall (PD line 16 covers the expense side, the income shortfall goes on line 25).
- **Scope.** The rule applies to transactions between a resident and a non-resident. Between two residents it applies only if one of them has a preferential tax status (pays at a rate below the prescribed one, or is exempt) or has the right to carry forward a tax loss in that period (ZPD Art. 13(5), 14(5), Pravilnik Art. 37(3)). The owner is a resident natural person. Reading: a company loan to the owner triggers no corporate income tax adjustment **unless the company itself has a tax loss to carry forward in that year**. The 10% rate is itself a prescribed rate, so it is not a "lower rate". RRiF (S14) states the same scope and adds that loans from a company to natural persons fall under income tax rules.
- **Reporting.** Loans to related persons go on the PD-IPO form, part I.2, attached to the PD (Pravilnik Art. 46(2), 47.b). Related persons include members and management (ZPD Art. 13(2), Opći porezni zakon Art. 49). Loans to the same person at the same rate up to 20,000.00 EUR in the period may be reported as one total (Pravilnik Art. 47.b(4)).

**Owner's side (personal income tax lane, cited here for completeness).**

- For an employee, or another person who receives salary-type income from the company, a loan at an interest rate below 2% a year gives a benefit in kind equal to the difference between the agreed rate and 2% (ZPDoh Art. 21(3)). If the owner receives a salary from the company, this rule applies to the owner. RRiF (S14) advises at least 2% for loans to employees, management board members or other natural persons.
- For a member who is not an employee, no explicit rate is set. ZPDoh Art. 66(1) treats a member's private use of company assets charged to current profit as capital income (hidden profit distribution). A loan that is not meant to be repaid, or whose interest benefit is treated as a private benefit, could fall under Art. 66. Older secondary commentary (TEB, 2016) reads favourable interest on a member's loan as hidden profit distribution. UNCONFIRMED. No current Porezna uprava opinion was found.
- Company law limits on loans to members are outside this lane.

|                                         | 2024 (context)                                       | 2025                                           | 2026                                   | 2027                                                                                    |
| --------------------------------------- | ---------------------------------------------------- | ---------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------- |
| Related-party rate, ZPD Art. 14(3)      | 3.25% (secondary, NN 157/23 not loaded, UNCONFIRMED) | 4.38% (NN 151/24, year corrected by NN 154/24) | 2.65% (NN 150/25, in force 31.12.2025) | not yet published. Due as an Odluka before 1.1.2027                                     |
| Benefit-in-kind floor, ZPDoh Art. 21(3) | 2%                                                   | 2%                                             | 2%                                     | 2% unless ZPDoh changes (a 2026 ZPDoh draft exists, e-Savjetovanja 10200, not reviewed) |

**Estimating the 2027 rate.** Pravilnik Art. 37(1) sets the rate as the arithmetic mean of the ECB main refinancing operations rate as published by the HNB in the current calendar year. The 2026 figure of 2.65% equals the simple mean of the five MRO rates in force during 2025 (3.15, 2.90, 2.65, 2.40, 2.15). The 2025 figure of 4.38% does not match that method on 2024 rates, so the method is not reproducible from the text. For planning, a simple mean of the 2026 MRO rates so far (2.15 from 11 June 2025, 2.40 from 17 June 2026, 2.65 from 16 September 2026, per S11) gives about 2.40%. Treat that as a placeholder, LOW confidence, and replace it with the Odluka when it is published in December 2026.

**Source.** ZPD Art. 13(2), 13(5), 14 (S1, Art. 14 checked against NN 115/16, S4). Pravilnik Art. 37, 46(2), 47.b (S5, S6). S8, S9, S11, S14. ZPDoh Art. 21(3), 66 (S10).

**Confidence.** HIGH for the published rates. MEDIUM for the scope reading. UNCONFIRMED for the member-not-employee case.

## R16. Loans from the owner to the company

**Rule.** Interest the company pays on a loan from a member holding at least 25% is not deductible to the extent the loan exceeds four times the member's share in capital (average of paid-in capital, retained earnings and reserves at each month end) (ZPD Art. 8, Pravilnik Art. 32(1) to 32(3), PD line 15). The add-back does not apply if income tax on capital income is paid on that interest (Pravilnik Art. 32(5)). Interest paid by the company on related-party loans is deductible only up to the arm's-length rate where Art. 14 applies (ZPD Art. 14(2), scope as in R15). A natural person may lend to the company interest-free (S14). Interest paid to the owner is capital income under ZPDoh Art. 65(1)(3) and is taxed by withholding (rate in the personal income tax lane). Report the loan on PD-IPO part I.1.

|                   | 2025                       | 2026 | 2027          |
| ----------------- | -------------------------- | ---- | ------------- |
| Thin-cap multiple | 4 times the member's share | same | same, assumed |
| Member threshold  | 25%                        | 25%  | 25%, assumed  |

**Source.** ZPD Art. 8 (S1). Pravilnik Art. 32, 47.b (S5). ZPDoh Art. 65 (S10).

**Confidence.** HIGH for the rule. The capital-income withholding rate is outside this lane.

## R17. Related-party report (PD-IPO)

**Rule.** If the books record any transactions with related persons during the period, the PD-IPO report is attached to the PD (Pravilnik Art. 46(2), 47.b(1)). It has four parts: loans received (I.1), loans given (I.2), purchases of goods and services (II.1), supplies of goods and services (II.2). For a small owner-run company this usually covers owner loans and any lease from the owner. From tax year 2026, transactions shown in eRačuni with domestic related persons who are themselves in eRačun fiscalisation are left out of parts II.1 and II.2 (Pravilnik Art. 47.b(5), added by NN 39/26). Reading: a lease from the owner as a private landlord who does not issue eRačuni stays in II.1.

**Source.** Pravilnik Art. 46(2), 47.b (S5, S6). **Confidence.** HIGH for the rule. MEDIUM for the eRačun reading.

## R18. Filing: deadline, form, electronic filing, attachments

**Rule.** The return is filed no later than four months after the end of the tax period (ZPD Art. 35(1)). For a calendar year that is 30 April. The form is PD (accrual) or PD-NN (cash basis) (Pravilnik Art. 46(1)). The balance sheet and income statement are attached (ZPD Art. 35(6)), and those filed with FINA on time count as attached (Pravilnik Art. 46(5)). Other attachments depend on content: PD-IPO, schedules for reliefs, the vessel schedule, the loss table (Pravilnik Art. 46(2)). If no return is filed, the tax is assessed by estimate (ZPD Art. 35(8)).

**Electronic filing.** Until 2025 the ZPD required electronic filing only from large and medium entrepreneurs. NN 151/25 Art. 10 removed that limit from 1 January 2026, so every taxpayer files the PD electronically through ePorezna (ZPD Art. 35(3)). The Pravilnik followed in NN 39/26 Art. 4 (Pravilnik Art. 46(3)). Reading: the PD for 2025, filed in 2026, already falls under the new wording.

|                   | Tax year 2025                     | Tax year 2026          | Tax year 2027                    |
| ----------------- | --------------------------------- | ---------------------- | -------------------------------- |
| Filing deadline   | 30 April 2026 (Thursday)          | 30 April 2027 (Friday) | 30 April 2028 (Sunday, see note) |
| Form              | PD per NN 156/23                  | PD per NN 39/26        | PD per NN 39/26 unless replaced  |
| Electronic filing | mandatory for all (from 1.1.2026) | mandatory              | mandatory                        |

Note: when a deadline falls on a weekend or holiday it is commonly moved to the next working day. That rule was not found in the Opći porezni zakon text loaded and is UNCONFIRMED here (it likely comes from the general administrative procedure act).

**Source.** ZPD Art. 35 (NN 114/23, 151/25), checked against S2 (Art. 10) and S3 (Art. 12). Pravilnik Art. 46 (S5, S6).

**Confidence.** HIGH for deadline and form. MEDIUM for applying the electronic-filing change to the 2025 return.

## R19. Paying the annual tax, refunds and credits

**Rule.** The tax liability or balance due shown in the return falls due on the last day of the filing deadline (ZPD Art. 35(2)), also restated in ZPD Art. 32(2) as amended by NN 151/25 Art. 8. The tax to pay is reduced by the advances paid (ZPD Art. 35(4)). An overpayment is established on the last day of the filing deadline and is refunded on request or credited to the next period (ZPD Art. 35(5)). The choice is made in part XI of the PD (Pravilnik Art. 47(3) line 58 and 47(6)). Late payment carries interest from the due date (Opći porezni zakon, consolidated text, "Kamate se obračunavaju od dana dospijeća porezne obveze"). The default interest rate is outside this lane.

PD arithmetic: line 55 = line 53 minus line 54 (not below zero). Line 57 = line 55 minus line 56. Line 58 = line 56 minus line 55.

|          | Tax year 2025 | Tax year 2026 | Tax year 2027               |
| -------- | ------------- | ------------- | --------------------------- |
| Due date | 30 April 2026 | 30 April 2027 | 30 April 2028, see R18 note |

**Source.** ZPD Art. 32(2), 35(2), 35(4), 35(5) (S1, S2, S3). Pravilnik Art. 47(3), 47(6) (S5, S6).

**Confidence.** HIGH.

## R20. Monthly advance payments (predujmovi)

**Rule.** The taxpayer pays advances based on the return for the previous period. An advance is paid monthly, by the end of the month, for the past month. Each advance is the previous period's tax liability divided by the number of months of that period (ZPD Art. 34(1)). The PD computes it on line 59 as line 53 divided by the number of months of operation in the period (Pravilnik Art. 47(3)). The new amount is set as of the last day of the filing deadline (Pravilnik Art. 48(1)). A taxpayer that starts business pays no advances until its first return (ZPD Art. 34(3)), but may pay voluntarily (Pravilnik Art. 48(9)). The Porezna uprava may change the advance by decision, on request or after an audit, and the decision binds until the next return (ZPD Art. 34(2), Pravilnik Art. 48(2)). A request for a lower advance states the reasons and, for a significant drop in activity, attaches the balance sheet and income statement for the past and current period (Pravilnik Art. 48(5)). Not paying an advance on time is a misdemeanour (ZPD Art. 38(1)(4)).

**For a company that started in 2025.**

- Tax year 2025, for a company that started in 2025: no advances, because 2025 was the first period (ZPD Art. 34(3)).
- Tax year 2026: advance = 2025 liability (PD 2025 line 53) divided by the months of operation in 2025. Whether the month of registration counts as a full month is UNCONFIRMED. The accountant's PD line 59 shows the figure used.
- Which month is the first one paid at the new amount is UNCONFIRMED. Pravilnik Art. 48(1) fixes the amount as of 30 April. The likely reading is that the first new advance is the one for April, due by 31 May (which in 2026 was a Sunday). The bank ledger can settle this: the first 2026 payment to the profit tax advance account shows the start month.
- Advances counted on 2026 PD line 56 are those for the months of 2026. Reading: the December 2026 advance, paid by 31 January 2027, belongs to 2026.
- Tax year 2027: advance = 2026 liability divided by 12, from the month fixed by the 2026 return.

|                               | 2025                | 2026                                              | 2027                                             |
| ----------------------------- | ------------------- | ------------------------------------------------- | ------------------------------------------------ |
| Basis                         | none (first period) | PD 2025 line 53 / months of operation in 2025     | PD 2026 line 53 / 12                             |
| Due                           | n/a                 | by the end of the month after the month it covers | same                                             |
| Start month at the new amount | n/a                 | UNCONFIRMED, probably the advance for April 2026  | UNCONFIRMED, probably the advance for April 2027 |

**Source.** ZPD Art. 34 (S1, Art. 34(1) checked against NN 115/16 Art. 12, S4). Art. 38(1)(4) (S1). Pravilnik Art. 47(3) line 59, Art. 48 (S5). Secondary deadline calendars (TEB 2019 and 2020) list the advance "za travanj" due by 31 May, which supports the reading but does not state the start month.

**Confidence.** HIGH for the formula and the first-year exemption. MEDIUM for the 7-month divisor. UNCONFIRMED for the start month.

## R21. Interim profit distribution shortfall (predujam dobiti)

**Rule.** If a natural person receives an advance on profit during the period and the period's profit turns out insufficient to cover it, the difference is a receipt taxed under the ZPDoh (ZPD Art. 10.a, Pravilnik Art. 35.a, ZPDoh Art. 66(2)). The company should pay advances on profit only up to the amount shown in an interim income statement (Pravilnik Art. 35.a(2)). Company law conditions for interim dividends are outside this lane.

**Source.** S1, S5, S10. **Confidence.** HIGH.

## R22. Withholding tax on payments to non-residents

**Rule.** When the company pays a foreign legal person interest, dividends, or fees for copyright and other intellectual property rights (licences and similar rights), the company must calculate, withhold and pay withholding tax at 15% (ZPD Art. 31(1) to 31(4), 31(6), 31(11)). The rate is 25% for payments, including market research, tax and business consulting and audit services, to residents of jurisdictions on the EU list of non-cooperative jurisdictions with which Croatia applies no tax treaty (ZPD Art. 31(12)). Treaties and the EU directives can reduce or remove it. Whether software and SaaS subscriptions the company buys from non-EU providers are "licences" in this sense is not settled by the text and is a question for the accountant.

**Source.** ZPD Art. 31 (NN 114/23 rates, S1, S3). **Confidence.** HIGH for the rule. LOW for its application to subscriptions.

## R23. Announced changes for 2027

- No ZPD amendment after NN 151/25 is enacted. The zakon.hr consolidated text, updated 16.10.2026 through NN 109/26, shows NN 151/25 as the latest amendment (S1).
- A draft amendment was put to public consultation from 31 July to 30 August 2026 (S12, e-Savjetovanja 10189, draft text not loadable, UNCONFIRMED). Per S15 (secondary) it adds a one-off 50% tax on "excessive profit margins" for tax period 2026, payable in 2027, only for **large and medium** entrepreneurs under the accounting act that earned more than 50% of 2026 revenue in Croatia. It does not change the 10% and 18% rates, the threshold, the advances, or the representation and vehicle rules. A micro or small d.o.o. such as the company would be outside it. Watch for the final act in NN before the end of 2026.
- The 2027 related-party interest rate will be published as an Odluka in December 2026 (R15).

**Confidence.** MEDIUM for "no enacted change". UNCONFIRMED for the draft content.

## R24. Penalties (context)

Failing to determine the base correctly, to pay the tax on time, to pay an advance on time, or to withhold tax is a misdemeanour with a fine from 260.00 to 26,540.00 EUR for the company and 260.00 to 2,650.00 EUR for the responsible person (ZPD Art. 38(1), 38(2)), higher for repeat offences (ZPD Art. 38(3)). These fines are themselves not deductible (R8).

**Source.** ZPD Art. 38 (NN 115/16, 114/22) (S1). **Confidence.** HIGH.

---

## How the planning estimate uses these rules (2026 year end)

1. Accounting profit 2026 (accrual) from the ledger plus accrual adjustments (receivables, payables, depreciation, grant release). Cash-to-accrual belongs to the reconciliation lane.
2. Add back: 50% representation (R4), 50% personal transport (R5), depreciation above limits and over the car cap (R6), vessel costs if any (R7), fines (R8), excess donations (R9), private and non-business costs (R10).
3. Deduct: listed decreases (R12), loss brought forward (R14).
4. Rate from 2026 revenue (R2): 10% below 1,000,000 EUR.
5. Liability 2026 = base x rate (PD lines 42 to 44, 53).
6. Advances paid for 2026 = number of 2026 months paid at the new amount x (PD 2025 line 53 / months of operation 2025) (R20).
7. Due on 30 April 2027 = liability minus advances. A negative figure is a refund or credit (R19).
8. Monthly advance from the 2026 return = liability 2026 / 12, the 2027 cash-out profile (R20).
9. Profit after tax = accounting profit minus the corporate income tax expense, the input to the dividend-capacity rule in the company-law lane.

The 2027 plan repeats steps 1 to 8 with forecast inputs and the 2027 rule versions.

## Rules the ruleset should encode

Each rule is versioned by `effectiveFrom` (tax period start) with its source. Inputs and outputs are per tax period unless stated.

| Rule id                                 | Inputs                                                                                                                                            | Outputs                                                                                | Versions                                                                            |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `hr.cit.base`                           | accounting revenue, accounting expenses, increases list, decreases list, loss brought forward                                                     | PD lines 3/4, 26, 35, 36, 38                                                           | 2024 onward (single version)                                                        |
| `hr.cit.rate`                           | period revenue (PD line 1), special-circumstance grants (line 28)                                                                                 | rate (10% or 18%)                                                                      | 2023: 995,421.06 threshold. 2024 onward: 1,000,000.00                               |
| `hr.cit.cashBasisEligibility`           | prior-period revenue, VAT cash-basis flag, election date, years on method                                                                         | eligible yes/no, form PD or PD-NN                                                      | 2024 onward: 1,000,000.00                                                           |
| `hr.cit.representationAddBack`          | representation costs incl. VAT, amounts taxed as income                                                                                           | add-back = 50% of untaxed amount (PD line 6)                                           | 2017 onward: 50%                                                                    |
| `hr.cit.personalTransportAddBack`       | personal transport costs by type incl. VAT, excluded items (insurance, interest, vehicle and vessel tax, registration fees), benefit-in-kind flag | add-back = 50% of the included costs, 0 if taxed as salary (PD line 7)                 | 2018 onward: 50%                                                                    |
| `hr.cit.depreciationLimit`              | asset class, cost, in-use date, booked depreciation, doubling flag                                                                                | allowed depreciation, add-back (PD line 18)                                            | rates table, single version                                                         |
| `hr.cit.assetThreshold`                 | unit cost, useful life                                                                                                                            | long-term asset yes/no                                                                 | 2023: 464.53. 2024 onward: 665.00                                                   |
| `hr.cit.carDepreciationCap`             | car or personal transport cost, rental/transport activity flag                                                                                    | add-back above cap (PD line 5)                                                         | 2023: 53,089.12. 2024 onward: 54,000.00                                             |
| `hr.cit.vesselAssetTest`                | vessel cost, revenue from its use, rental registration flag, depreciation and related costs                                                       | add-back of depreciation and all related costs if the test fails (PD line 5)           | 7% vessels, 5% apartments                                                           |
| `hr.cit.finesAddBack`                   | fines, forced-collection costs, related-party default interest                                                                                    | add-back 100% (PD lines 9, 11)                                                         | single version                                                                      |
| `hr.cit.donationCap`                    | donations, prior-period revenue, current revenue                                                                                                  | allowed = min(donations, 2% x max(prior, current)), add-back (PD line 14)              | 2024 onward wording                                                                 |
| `hr.cit.sponsorshipDecrease`            | sponsorships to listed subjects                                                                                                                   | decrease (PD line 33.a)                                                                | 2026 onward only                                                                    |
| `hr.cit.privateExpenseAddBack`          | costs flagged private or non-business, income tax paid flag                                                                                       | add-back (PD line 24 or 9)                                                             | single version                                                                      |
| `hr.cit.grantRevenue`                   | grant amount, recognition schedule from accounting, special-circumstance flag                                                                     | taxable revenue by period, threshold revenue                                           | single version, MEDIUM                                                              |
| `hr.cit.lossCarryForward`               | losses by year of origin, current base                                                                                                            | offset used (FIFO), losses expiring after 5 years, remaining (PD lines 37, 40, 41)     | single version                                                                      |
| `hr.cit.relatedPartyRate`               | tax year                                                                                                                                          | rate                                                                                   | 2025: 4.38%. 2026: 2.65%. 2027: placeholder about 2.40% (estimate) until the Odluka |
| `hr.cit.relatedPartyLoanAdjustment`     | loan balance and days, agreed rate, counterparty residency, own loss-carry-forward flag                                                           | deemed interest add-back (0 for a resident natural person unless the loss flag is set) | 2025, 2026                                                                          |
| `hr.cit.thinCapOwnerLoan`               | owner loan balance by month, owner's share in capital by month end, interest paid, capital-income tax paid flag                                   | non-deductible interest (PD line 15)                                                   | single version                                                                      |
| `hr.pit.loanBenefitInKind` (cross-lane) | loan to an employee or salaried director, agreed rate                                                                                             | taxable benefit = balance x (2% minus agreed rate)                                     | 2% from ZPDoh 152/24 text                                                           |
| `hr.cit.filingDeadline`                 | period end date                                                                                                                                   | filing and payment due date (period end + 4 months)                                    | 2023 returns onward                                                                 |
| `hr.cit.balanceDue`                     | liability (line 53), foreign tax credit (54), advances paid (56)                                                                                  | balance due (57) or refund (58)                                                        | single version                                                                      |
| `hr.cit.monthlyAdvance`                 | previous-period liability (line 53), months of operation in that period, first-period flag                                                        | monthly advance (line 59), zero in the first period                                    | single version                                                                      |
| `hr.cit.advanceSchedule`                | monthly advance, filing date, start-month rule                                                                                                    | advance due dates and amounts per calendar month                                       | start month UNCONFIRMED                                                             |
| `hr.cit.profitAdvanceShortfall`         | interim dividend paid, final profit                                                                                                               | taxable shortfall to the owner                                                         | single version                                                                      |
| `hr.cit.withholding`                    | payment to a non-resident, payment type, country, treaty flag                                                                                     | withholding rate (15%, 10% dividends, 25% listed jurisdictions)                        | 2023-10-12 onward                                                                   |
| `hr.cit.excessMarginTax2026`            | size class, domestic revenue share                                                                                                                | applies yes/no (no for micro and small)                                                | draft only, UNCONFIRMED                                                             |

## Not covered here (other lanes)

Personal income tax and contributions on salary, dividend tax for a resident owner, VAT, accounting recognition of the grant and depreciation, company-law rules on dividends, reserves and loans to members, and the GFI filing with FINA.
