---
checked: 2026-11-04
nn_through: 126/26
summary: Treaty steps, bills, settlement changes, readings and unconfirmed points behind the Tax screen, each with what settles it, and every place the screen and the docs differ
---

# Watch list

Every value or matter these docs could not settle on 4 November 2026: steps still to come, bills, readings that an answer from Porezna uprava would settle, and every place where the Tax screen and the docs differ. Each item says what is unknown, what would settle it, and when.

## Coming changes

| Item                   | What is known                                                                                                                                                                                                      | What settles it                                                                                         | Due                           | Mark           | Owning file                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- | ----------------------------- | -------------- | ---------------------------------------------------------------------------- |
| US treaty              | The Croatian law confirming the 2022 treaty and its 2026 protocol is in NN MU 6/2026 and in force on 7 November 2026, by a news report. The US Senate has not consented. Porezna uprava still lists it as awaiting | The exchange of notes and the treaty's own article on when it applies, then Porezna uprava's treaty map | Not before 2027 income        | `pending`      | [Foreign capital income](../foreign-capital-income.md#us-withholding)        |
| EU T+1 settlement      | Regulation (EU) 2025/2075 moves trades on EU venues to T+1 "from 11 October 2027"                                                                                                                                  | Nothing. Kuna's euro estimate must switch to one TARGET day for trades from that day                    | 11 October 2027               | `confirmed-nn` | [HNB rates and settlement](../hnb-rates-and-settlement.md#settlement-cycles) |
| JOPPD annexes for 2027 | The form of 24 December 2025 carries the annexes as amended by NN 157/25                                                                                                                                           | A new PravPDoh amendment or form PDF                                                                    | December 2026 or January 2027 | `unconfirmed`  | [JOPPD for investors](../joppd-for-investors.md#codes)                       |

## Bills and drafts

| Item                               | What is known                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | What settles it                                      | Mark      |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | --------- |
| Bill P.Z. 339, income tax for 2027 | In the Sabor on 11 September 2026, first reading passed on 25 September 2026 (79 for, 3 against, 37 abstained). For capital income it adds only the Croatian investment account (_hrvatski investicijski račun_): a new Art. 67.a and a new Art. 70(21), at 12% on payouts above the owner's deposits when the account's conditions fail. "Dohodak ostvaren do 31. prosinca 2026." stays under the current act, and the act would enter into force on 1 January 2027. It leaves Art. 11, 12, 67(8), 67(11), 70(4) to 70(6), 80 and 81 alone | The final bill, the second reading and the act in NN | `pending` |

## Where the screen and the docs differ

The code was left as it is. Each row is a change for the Tax screen to pick up.

| Rule or field                     | The screen today                                                  | The docs                                                                                                          | Owning file                                                                              |
| --------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Losses on lots past two years     | A reading, citing Art. 67(8) and an opinion                       | Settled by PravPDoh Art. 70(11)                                                                                   | [Capital gains](../capital-gains.md#losses-on-lots-past-two-years)                       |
| Tax-free gains on shares, code 02 | A reading, citing Porezna uprava on crypto                        | Settled by PravPDoh Art. 77(13)                                                                                   | [JOPPD for investors](../joppd-for-investors.md#the-code-02-line)                        |
| European settlement               | Unconfirmed, "No source loaded"                                   | Settled by CSDR Art. 5(2) until 10 October 2027                                                                   | [HNB rates and settlement](../hnb-rates-and-settlement.md#settlement-cycles)             |
| JOPPD field 16.2                  | Shows the tax, "1, tax"                                           | Field 11 less the tax, PravPDoh Art. 82(1) item 40 and both broker guides                                         | [JOPPD for investors](../joppd-for-investors.md#the-capital-gains-joppd)                 |
| A year that nets a capital loss   | Shows a JOPPD date and fields whenever a sale settles in the year | No JOPPD duty for the taxable lines when losses exceed gains, PravPDoh Art. 77(13). Tax-free gains alone are open | [JOPPD for investors](../joppd-for-investors.md#who-files)                               |
| Fees in the gain                  | No rule row. The figures take fees off the gain                   | A reading, Art. 64(2), 67(1), 67(11)                                                                              | [Capital gains](../capital-gains.md#fees)                                                |
| Bond coupons                      | No rule row. The Abroad tab leaves them out                       | Settled, not interest under Art. 65(2)(4)                                                                         | [Foreign capital income](../foreign-capital-income.md#income-from-abroad)                |
| 30-day JOPPD type and mark        | Shows the date and codes only                                     | Report type 8 (PravPDoh Art. 81(3) item 8), marked with the day received (Art. 79(1))                             | [Foreign capital income](../foreign-capital-income.md#nothing-withheld-the-30-day-joppd) |
| Broker interest, source text      | "frees only up to 0.5% a year at banks"                           | The exemption names "banaka, štedionica i drugih financijskih institucija"                                        | [Foreign capital income](../foreign-capital-income.md#interest-a-broker-pays)            |
| Croatian ISIN, source text        | "No source loaded"                                                | A reading of Art. 12(7), 70(1) and 70(19)                                                                         | [Foreign capital income](../foreign-capital-income.md#payments-of-a-croatian-isin)       |
| US treaty, source text            | Porezna uprava's list and tportal of 30 July 2026                 | The rule holds. The news has moved on: the Croatian law is in NN MU 6/2026 and the US Senate is pending           | [Foreign capital income](../foreign-capital-income.md#us-withholding)                    |

## Readings a Porezna uprava answer would settle

| Item                           | What is unknown                                                                       | Mark          | Owning file                                                                   |
| ------------------------------ | ------------------------------------------------------------------------------------- | ------------- | ----------------------------------------------------------------------------- |
| Recipient 1001 or 1003         | Which recipient code gains through a foreign broker take                              | `unconfirmed` | [JOPPD for investors](../joppd-for-investors.md#recipient-1001-or-1003)       |
| Referral credit                | Whether it is other income at all                                                     | `unconfirmed` | [Other investment income](../other-investment-income.md#referral-credits)     |
| Stock lending                  | Interest, or rent of movable property                                                 | `reading`     | [Other investment income](../other-investment-income.md#stock-lending)        |
| Which HNB list                 | The list published on the day of payment, or the one applied on it                    | `reading`     | [HNB rates and settlement](../hnb-rates-and-settlement.md#which-hnb-list)     |
| Converting once                | The gain at the sale day's rate, or each leg at its own day's                         | `reading`     | [Capital gains](../capital-gains.md#converting-a-gain-once)                   |
| FIFO across accounts           | One queue per ISIN across brokers, transfers keeping their lots                       | `reading`     | [Capital gains](../capital-gains.md#fifo-per-isin-across-accounts)            |
| The day the two years count on | Trade or settlement day                                                               | `reading`     | [Capital gains](../capital-gains.md#counting-the-two-years)                   |
| December sales                 | A sale counts in its settlement year                                                  | `reading`     | [Capital gains](../capital-gains.md#which-year-a-sale-counts-in)              |
| Fees                           | Whether a sale fee lowers the gain                                                    | `reading`     | [Capital gains](../capital-gains.md#fees)                                     |
| Broker interest                | Whether broker cash is a demand deposit under Art. 65(2)(3), and receipt 1004 or 1005 | `reading`     | [Foreign capital income](../foreign-capital-income.md#interest-a-broker-pays) |

OPZ Art. 10 provides a paid binding opinion only for future transactions, so a planned sale is the way to ask about conversion, FIFO and fees.

## Not loaded

| Item                               | What is unknown                                                  | What settles it                                |
| ---------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------- |
| The US treaty text in NN MU 6/2026 | Its own entry-into-force and application article                 | Loading the NN MU item                         |
| The 2023 surtax                    | Each city's 2023 rate, and how the foreign credit met the surtax | The 2023 surtax decisions, or a compiled table |
| The budget payment Naputak         | The payment reference for capital gains tax                      | The Naputak for the year in NN                 |
| The UK settlement cycle            | For a dollar line of a fund listed in London                     | The UK rule                                    |

## Sources

- Bill P.Z. 339, <https://www.sabor.hr/sites/default/files/uploads/sabor/2026-09-11/121601/PZ_339.pdf>, and its Sabor page, <https://www.sabor.hr/hr/sjednice-sabora/prijedlog-zakona-o-izmjenama-i-dopunama-zakona-o-porezu-na-dohodak-prvo-citanje-11>. Both loaded 4 November 2026.
- The other items cite the pages their owning files list.
