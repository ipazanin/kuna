---
checked: 2026-11-10
nn_through: 129/26
summary: Business trips of a d.o.o.'s employee, the tax-free per diems at home and abroad, private car kilometres, meals provided, the hours and the distance a trip needs, what the travel order holds, and the JOPPD code 17 with its deadlines
---

# Business trips

What the law asks of a business trip (_službeno putovanje_) a d.o.o. sends an employee on, and how Kuna counts it. The Trips screen, the JOPPD code 17 card on Salaries and the rule rows `hr.pit.business-trip`, `hr.pit.foreign-per-diem`, `hr.pit.foreign-per-diem-rate`, `hr.pit.trip-joppd` and `hr.pit.nontaxable-caps` rest on this file. Law as researched on 10 November 2026.

The Pravilnik o porezu na dohodak (PravPDoh) was read in the Porezna uprava consolidation through NN 157/25, "Na snazi i primjenjuje se od 1. siječnja 2026.". The amounts of Art. 7(2) were read in the NN text of NN 16/25, and the JOPPD codes in the NN text of NN 157/25, which changed neither Art. 7 nor Art. 8. A Narodne novine title search of 2025 and 2026 through NN 129/26 found no later amendment of the Pravilnik and no new Odluka on foreign per diems.

The payments below are tax-free only up to the amounts given. What is paid above them is salary (PravPDoh Art. 7(1)). The accountant books the trip, and Kuna only says how it counts it.

## Domestic per diems

| Item | Trip at home                                   | Tax-free up to | Mark           |
| ---- | ---------------------------------------------- | -------------- | -------------- |
| 19   | More than 12 hours a day                       | 30.00 a day    | `confirmed-nn` |
| 20   | More than 8 hours and less than 12 hours a day | 15.00 a day    | `confirmed-nn` |

PravPDoh Art. 7(2) items 19 and 20 (NN 16/25). The wording is "koje traje više od 12 sati dnevno" and "koje traje više od 8 sati, a manje od 12 sati dnevno".

A per diem covers food, drink and local transport at the destination (Art. 7(11)). Public transport from the station or airport to the hotel on the first arrival and back on the last departure is a travel cost and is not paid from the per diem (Art. 7(11)).

## Foreign per diems

| Item | Trip abroad                                    | Tax-free up to                                        | Mark           |
| ---- | ---------------------------------------------- | ----------------------------------------------------- | -------------- |
| 21   | More than 12 hours a day                       | The amount the state budget rules set for the country | `confirmed-nn` |
| 22   | More than 8 hours and less than 12 hours a day | 50% of that amount                                    | `confirmed-nn` |

PravPDoh Art. 7(2) items 21 and 22 (NN 16/25): "do iznosa utvrđenih propisima o izdacima za službena putovanja za korisnike državnog proračuna" and "do 50 % iznosa".

The rule they point to is the Odluka o visini dnevnice za službeno putovanje u inozemstvo za korisnike koji se financiraju iz sredstava državnog proračuna, NN 16/24, item 277, adopted and in force on 8 February 2024 (its item III). It lists 105 states and areas and a row for every other state ("sve druge države"). It replaced the Odluka of NN 8/06 (item II). A title search of 2024 to 2026 through NN 129/26 found no later Odluka.

The Odluka gives 47 amounts in euros and 59 in US dollars. The United Kingdom is 80,00 EUR (row 101), Germany 90,00 EUR (row 72), the United States 100,00 USD (row 88), and every other state 50,00 USD (row 106). Mark: `confirmed-nn`. `hr.pit.foreign-per-diem` holds every row, keyed by the ISO 3166-1 alpha-2 code, XK for Kosovo and `other` for every state not listed, each in its own currency. It is generated from the NN page by `npm run import:foreign-per-diems`.

The Pravilnik and the Odluka do not say how a dollar amount turns into euros. Kuna's reading is the ECB rate of the day the traveller left, which `hr.pit.foreign-per-diem-rate` holds. Mark: `unconfirmed`.

## Per diem days

The Pravilnik sets the per diem by the hours of a trip "dnevno" and does not say how a trip of several days splits into days. Kuna's reading, as the owner decided on 10 November 2026:

- A trip splits into blocks of 24 hours from departure. Each whole block earns a full per diem.
- The last part earns a full per diem when it is longer than 12 hours, and half when it is longer than 8 hours up to and including 12 hours.
- Exactly 12 hours earns half. Exactly 8 hours earns none.

Mark: `reading`. Items 19 to 22 give a full per diem for "više od 12 sati" and half for "više od 8 sati, a manje od 12 sati", so the text names nothing for exactly 12 hours. Counting it as half is the owner's choice, not the wording. Exactly 8 hours earns none as the wording reads.

## Private car

Using a private car for the business is tax-free up to 0.50 a kilometre driven (PravPDoh Art. 7(2) item 31, NN 16/25: "do 0,50 po prijeđenom kilometru"). Mark: `confirmed-nn`.

On a trip, the travel order carries the car's make, plate and the odometer at the start and the end (Art. 8(2)). Driving in the place of work or up to 30 km from it (_locco vožnja_) is not a trip and needs a log of its own (Art. 7(34)).

## Meals provided

"Ako je na službenom putovanju odnosno radu na terenu, na teret poslodavca, osiguran jedan obrok (ručak ili večera) neoporezivi iznos dnevnice iz stavka 2. r.br. 19. i/ili r.br. 20. i/ili r.br. 21. i/ili r.br. 22. ovoga članka koji se isplaćuje u novcu umanjuje se za 30% odnosno za 60% ako su osigurana dva obroka (ručak i večera)." (PravPDoh Art. 7(13))

- One meal, lunch or dinner, at the employer's cost cuts the tax-free per diem by 30%. Two meals cut it by 60%.
- The cut applies to the domestic and the foreign per diem alike, since the paragraph names items 19 to 22.
- "Doručak koji je uračunat u cijenu noćenja smatra se troškom noćenja i ne smatra se osiguranom prehranom." Breakfast in the room price does not count.
- A meal also counts as provided when it is in a conference fee, a ship ticket, an air ticket because the journey was interrupted, or paid from the employer's representation funds.

Mark: `confirmed-consolidated`. Which per diem day a meal cuts is Kuna's reading: the block the meal falls in.

## Length and distance

- A trip at home lasts up to 30 days in a row (Art. 7(8)). A trip abroad, from Croatia to another state and back, between states or within one, lasts up to 30 days in a row (Art. 7(14)): "putovanje do 30 dana neprekidno".
- A per diem is paid for a trip from the place of work or of residence to another place "udaljenosti najmanje 30 kilometara", not to the place where the traveller lives (Art. 7(11)).

Mark: `confirmed-consolidated`. Kuna warns when the first leg is under 30 km and refuses a trip longer than 30 days.

## Hours abroad

The foreign per diem runs from the hour the traveller crosses the Croatian border, and back to the hour of crossing it (Art. 7(18)).

- By air, "inozemna dnevnica se obračunava dva sata prije vremena predviđenog polijetanja zrakoplova iz posljednje zračne luke u Republici Hrvatskoj do vremena dolaska zrakoplova u prvu zračnu luku u Republici Hrvatskoj".
- By ship, from the departure from the last Croatian port to the return to the first.
- Through several states, the outward hours earn the first state's per diem and the return hours the last one's. A stay or a transit longer than 12 hours earns that state's per diem, and a shorter one counts in the next state where more than 12 hours were spent.

Mark: `confirmed-consolidated`. Kuna takes one foreign country per trip for now.

## A trip at home and abroad

"Ako se jedan službeni put odnosi na put u tuzemstvo i inozemstvo, prvo se utvrđuje pravo na inozemnu dnevnicu, a nakon toga pravo na tuzemnu dnevnicu, uzimajući u obzir ukupan broj dana/sati provedenih na službenom putu." When the whole trip is over 8 or over 12 hours but less than 8 hours of it are abroad, the domestic per diem is paid on the total hours (Art. 7(20)).

Mark: `confirmed-consolidated`. How the domestic hours before and after the foreign part split into blocks is Kuna's reading under Per diem days.

## Payments that exclude each other

Per diems (items 19 to 22), EU-paid per diems (item 26), travel and lodging costs (items 27 and 28) and private car kilometres (item 31) exclude each other, with Art. 5(12), 5(13), 6(7) and 6(8), where they cover the same transport, food or lodging (Art. 7(29)). The trip per diem, the field-work per diem, the allowance for living apart from the family and the seafarer's allowance exclude each other too (Art. 7(30)).

Mark: `confirmed-consolidated`. Kuna warns when a trip claims payments that exclude each other.

## The travel order

Every trip cost is settled on a proper travel order (_putni nalog_) with the documents attached (PravPDoh Art. 8(2)). Whatever its form, it holds at least:

- the day it was issued, who travels, where to and why
- how long the trip lasts and when it starts
- the means of transport, and for a car its make, plate and odometer at the start and the end
- the hour of return
- the signature of the person who approved it
- the settlement of costs and its approval (_likvidacija_)
- the report on the trip

The receipts for tolls, parking, tickets and lodging are attached "bez obzira na način podmirenja izdataka", whoever paid them. Mark: `confirmed-consolidated`.

## JOPPD

| What             | Rule                                                                                                                                                                            | Mark                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| Code             | 17, "Dnevnice za službena putovanja i naknade za korištenje privatnog automobila u službene svrhe, do propisanog iznosa isplaćene po osnovi službenih putovanja", in field 15.1 | `confirmed-nn`           |
| Monthly report   | One report per person for the month's payments, by the 15th of the next month (Art. 79(6))                                                                                      | `confirmed-consolidated` |
| Or on the day    | Each payment on the day it is paid (Art. 79(7))                                                                                                                                 | `confirmed-consolidated` |
| An advance       | Reported only after the final settlement of the trip (Art. 79(9))                                                                                                               | `confirmed-consolidated` |
| Paid in December | Reported by 15 January, dated 31 December (Art. 79(10))                                                                                                                         | `confirmed-consolidated` |
| Not reported     | Tickets, lodging, tolls and other trip costs. Only per diems and private car kilometres paid in money are reported (Art. 78(1) item 15)                                         | `confirmed-consolidated` |

Code 17 is in Annex 4 of the JOPPD form as NN 157/25 set it, and field 15.1 holds the code of a tax-free payment (Art. 82(1) point 37). Code 18 is private car kilometres outside a trip. The part of a per diem above the tax-free amount is salary and is reported as salary.

### The month of a trip's line

"Isplaćeni predujmovi dnevnica i/ili naknada za korištenje privatnog automobila u svrhu službenog putovanja iskazuju se na Obrascu JOPPD nakon konačnog obračuna tih primitaka." (PravPDoh Art. 79(9), read in the Porezna uprava consolidation through NN 157/25 on 11 November 2026)

- An advance is reported only after the final settlement. So when the advance covers the whole trip and nothing more is paid out, the line goes in the month of the settled day. The Pravilnik does not say this in so many words, and nothing in it points to another month.
- A trip paid out after its settlement could be read under Art. 79(6), by the month it was paid in. A Porezna uprava opinion of 10 October 2014, KLASA 410-01/14-01/2324, reads it by the settlement instead: per diems and costs the traveller paid "iskazuju se na Obrascu JOPPD do 15. dana mjeseca nakon isteka mjeseca konačnog obračuna putnog naloga", with payment code 0 while the traveller is not yet paid. It was read in RRiF's copy only, <https://rrif.hr/Iskazivanje_troskova_na_Obrascu_JOPPD_za_sluzbena_-2511-misljenje.html>, loaded on 11 November 2026, and predates the 2015 to 2025 amendments.

Kuna puts every settled trip's code 17 line in the month of the settled day, due by the 15th of the next month, whether or not a payout follows. The line holds the per diems and the kilometres at the order's rate or the cap, whichever is lower. `hr.pit.trip-joppd` holds it. Mark: `reading`. Screen: Salaries, JOPPD code 17, `reading`.

## Worked example

Made-up figures. An employee drives a private car from Zagreb to Split, 410 km each way, leaving on 3 March at 06:00 and returning on 4 March at 20:00. The company paid a 100.00 advance. On 4 March a client's lunch is paid from the company's representation. The traveller paid 30.00 of tolls.

| Line                      | Working                                 | Amount |
| ------------------------- | --------------------------------------- | -----: |
| First block, 24 hours     | Full domestic per diem                  |  30.00 |
| Last part, 14 hours       | Over 12 hours, full, less 30% for lunch |  21.00 |
| Kilometres                | 820 km × 0.50                           | 410.00 |
| Tolls the traveller paid  | At cost, not on the JOPPD               |  30.00 |
| Total                     |                                         | 491.00 |
| Less the advance          |                                         | 100.00 |
| Paid out after the return |                                         | 391.00 |

The JOPPD line under code 17 holds 461.00, the per diems and kilometres, reported once the trip is settled. Had the last part been exactly 12 hours, it would earn 15.00 less 30%, which is 10.50.

## Open points

- **Exactly 12 hours.** The wording gives no per diem for exactly 12 hours. Kuna counts half. Mark: `reading`.
- **Days of a long trip.** The 24-hour blocks from departure, and which block a meal cuts. Mark: `reading`.
- **Foreign amounts in dollars.** The Odluka sets 59 amounts in US dollars. Kuna turns them into euros at the ECB rate of the day the traveller left, which no text was found to settle. Mark: `unconfirmed`.
- **A board member who is not employed.** Art. 7(2) speaks of payments "svojim radnicima", to the employer's own employees. Whether a board member who is not employed gets the same tax-free per diems was not settled. Kuna allows it with a warning. Mark: `unconfirmed`.
- **The month of the code 17 line.** Kuna puts it in the month of the settled day, as Art. 79(9) and the 2014 opinion read. Mark: `reading`.
- **2027 amounts.** Bill PZ 339 asks the Minister in its Art. 15 to align the Pravilnik within 90 days of the act. In its consultation table the ministry did not take up a proposal to raise the domestic per diem from 30 to 50 euros, saying the amounts are set by the Pravilnik. Kuna assumes the same amounts and rules in 2027. Mark: `pending`.

## Sources

- Pravilnik o porezu na dohodak, Porezna uprava consolidation, NN 10/17 to 157/25, "Na snazi i primjenjuje se od 1. siječnja 2026.": Art. 7(1), 7(2), 7(8), 7(11), 7(13), 7(14), 7(18), 7(20), 7(29), 7(30), 7(34), 8(2), 78(1) item 15, 79(6), 79(7), 79(9), 79(10), 82(1) point 37. <https://porezna-uprava.gov.hr/Propisi/GetBasicData/4>, loaded on 10 November 2026.
- Pravilnik o izmjenama i dopunama Pravilnika o porezu na dohodak, NN 16/25, item 148, of 31 January 2025: Art. 2 with the new Art. 7(2) items 19 to 22 and 31, Art. 11, Art. 16 and Art. 17. <https://narodne-novine.nn.hr/clanci/sluzbeni/2025_01_16_148.html>, loaded on 10 November 2026.
- Pravilnik o izmjenama i dopunama Pravilnika o porezu na dohodak, NN 157/25, item 2365: Art. 1 to 6 and Annex 4 with code 17. <https://narodne-novine.nn.hr/clanci/sluzbeni/2025_12_157_2365.html>, loaded on 10 November 2026.
- Odluka o visini dnevnice za službeno putovanje u inozemstvo za korisnike koji se financiraju iz sredstava državnog proračuna, NN 16/24, item 277, of 9 February 2024: items I to III. <https://narodne-novine.nn.hr/clanci/sluzbeni/2024_02_16_277.html>, loaded on 10 November 2026.
- Porezna uprava opinion of 10 October 2014, KLASA 410-01/14-01/2324, on reporting trip costs on the JOPPD. Read in RRiF's copy, <https://rrif.hr/Iskazivanje_troskova_na_Obrascu_JOPPD_za_sluzbena_-2511-misljenje.html>, loaded on 11 November 2026. Secondary.
- JOPPD form with its annexes, PDF created 24 December 2025, Annex 4. <https://porezna-uprava.gov.hr/UserDocsImages/Arhiva/HR_obrasci/Documents/POREZ%20NA%20DOHODAK/JOPPD.pdf?vel=1253556>, loaded on 10 November 2026.
- Narodne novine title searches of 2024, 2025 and 2026 for "dnevnic", "putovanj", "inozemstvo", "porezu na dohodak" and "Pravilnika o porezu na dohodak", and the list of 2026 issues through 129, from `https://narodne-novine.nn.hr/search.aspx` and `https://narodne-novine.nn.hr/api/editions`, run on 10 November 2026.
- Bill P.Z. 339, Art. 15, its explanation and the consultation table, row 18. <https://www.sabor.hr/sites/default/files/uploads/sabor/2026-09-11/121601/PZ_339.pdf>, loaded on 10 November 2026.
