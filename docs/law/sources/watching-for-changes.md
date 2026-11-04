---
checked: 2026-11-04
nn_through: 126/26
summary: How to notice new acts, amendments, forms, treaty steps and settlement changes, and when each yearly item usually appears
---

# Watching for changes

The signals that show the law, a form or a market rule behind the Tax screen has changed, and the calendar of when each usually appears. Open items found this way go on the [watch list](watch-list.md). Sources are described in [Official sources](official-sources.md).

## Detecting change

| Signal                        | How                                                                                                                                                                                        | What it catches                         |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- |
| New NN issue                  | `POST /api/editions`, then the issue listing                                                                                                                                               | Every new act                           |
| Relevant NN item              | Title keywords: "porezu na dohodak", "doprinosima", "Općeg poreznog zakona", "općem upravnom postupku", "izbjegavanju dvostrukog oporezivanja", "Sjedinjenih Američkih Država", "Ispravak" | Amendments, the treaty law, corrections |
| zakon.hr staleness            | The "Baza je ažurirana ... zaključno sa NN x/yy" banner                                                                                                                                    | Lag behind NN                           |
| Porezna uprava consolidations | `GetBasicData/4` (PravPDoh) `Name` with its NN chain                                                                                                                                       | A new Pravilnik version                 |
| JOPPD form                    | The creation date of `JOPPD.pdf` (`pdfinfo`), and the JOPPD schema in `ePorezna_Schemas.zip`                                                                                               | New codes or fields                     |
| Porezna uprava notices        | News filtered to topic 26 (JOPPD) and 21 (Porezi), and the yearly capital gains notice (8281 for 2025 gains)                                                                               | The yearly deadline notice, examples    |
| Treaty map                    | Page 7559, whether the USA is still "čeka se potvrđivanje"                                                                                                                                 | A treaty entering into force            |
| Bills                         | Sabor RSS for new acts, bill pages                                                                                                                                                         | The yearly tax package                  |
| Settlement cycles             | The CSDR text in Cellar, the application date of Regulation (EU) 2025/2075                                                                                                                 | The EU move to T+1                      |
| Exchange rates                | HNB API `datum_primjene` against the ECB `TIME_PERIOD`                                                                                                                                     | A change in which day's rate HNB lists  |

## Yearly calendar

| Item                                  | Publisher and instrument             | Past publication                                                                 | Next expected                                     |
| ------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------- | ------------------------------------------------- |
| Tax law package (ZPDoh amendments)    | Government draft, Sabor, NN          | NN 114/23 (October 2023), NN 152/24 (24 December 2024)                           | November or December, in force 1 January          |
| PravPDoh amendments and JOPPD annexes | MF, Pravilnik in NN, form at Porezna | NN 16/25 (January 2025), NN 157/25 (December 2025), form PDF of 24 December 2025 | December or January                               |
| Capital gains notice                  | Porezna uprava news                  | 19 January 2023 for 2022 gains, 13 January 2026 for 2025 gains                   | January                                           |
| JOPPD and payment for last year       | ZPDoh Art. 70(4)                     | 2 March 2026 for 2025 gains                                                      | 1 March 2027 for 2026 gains                       |
| INO-DOH for last year                 | ZPDoh Art. 81(4)                     | 31 January each year                                                             | 1 February 2027 for 2026 income                   |
| US treaty                             | NN MU, US Senate, exchange of notes  | Croatian law in NN MU 6/2026, in force 7 November 2026                           | After US Senate consent and the exchange of notes |
| EU T+1 settlement                     | Regulation (EU) 2025/2075            | Published in the OJ in October 2025                                              | Applies from 11 October 2027                      |

## Sources

Issue dates and statuses were loaded from Narodne novine, Porezna uprava, EUR-Lex Cellar and a news report on 4 November 2026, as cited in each owning file.
