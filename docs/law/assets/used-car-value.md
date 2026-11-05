---
checked: 2026-11-04
nn_through: 1/17
summary: The customs table of NN 1/2017 that the Assets app estimates a car by, from its price and first registration, how its months count, and what the table is not
---

# Used car value

How the Assets app estimates what a car is worth while no valuation is typed: by Tablica 1 of the Pravilnik o posebnom porezu na motorna vozila (NN 1/2017), from the price paid, the day it was bought and its first registration. Kuna works this out in `src/apps/assets/carValue/domain/customsTable.ts`. The 2017 text was read on 4 November 2026, and later amendments were not looked for.

## What the table measures

Članak 9. stavak 1: "Posebni porez se za rabljena motorna vozila plaća u iznosu ostatka posebnog poreza utvrđenog prema postotku pada vrijednosti istog motornog vozila na tržištu u Republici Hrvatskoj od čije je prve registracije proteklo isto vremensko razdoblje." Stavak 3 gives Tablica 1 for an owner who asks for the tax to be set by it.

So the table gives the share of a new car's special tax left after each period from first registration, set by how far the value of such a car falls on the Croatian market. Kuna reads that share as the share of its price a car keeps. That is the owner's choice, and the screen calls the figure an estimate.

Mark: `reading`.

## How months count

Članak 9. stavak 4: "U svrhu primjene Tablice 1 smatra se da je protekao mjesec onoga dana sljedećeg mjeseca koji po svom broju odgovara danu kad je motorno vozilo prvi put registrirano. Ako toga dana nema u mjesecu, smatra se da je protekao mjesec posljednjeg dana toga mjeseca."

Kuna counts whole months with `wholeMonthsBetween` in `src/shared/calendar/monthKey.ts`, which counts the same way. A car first registered on 31 January has one month behind it on 28 February. Mark: `confirmed-nn`.

A row covers its months from its lower bound up to, not including, its upper bound, since the next row starts where it ends. 33 months falls in "32 mjeseca do 34 mjeseci", and 34 months in "34 mjeseci do 36 mjeseci". Mark: `reading`.

## Tablica 1

Each row as the Pravilnik writes it ("Razdoblje od prve registracije rabljenog motornog vozila do podnošenja porezne prijave") and the share as Kuna keeps it, in whole hundredths of a percent. Mark: `confirmed-nn`.

| From months | To months | Pravilnik | Share left |
| ----------- | --------- | --------- | ---------- |
| 0           | 1         | 96        | 96.00%     |
| 1           | 2         | 93        | 93.00%     |
| 2           | 3         | 90        | 90.00%     |
| 3           | 4         | 88        | 88.00%     |
| 4           | 5         | 86        | 86.00%     |
| 5           | 6         | 84        | 84.00%     |
| 6           | 7         | 82        | 82.00%     |
| 7           | 8         | 81        | 81.00%     |
| 8           | 9         | 80        | 80.00%     |
| 9           | 10        | 79        | 79.00%     |
| 10          | 11        | 78        | 78.00%     |
| 11          | 12        | 77        | 77.00%     |
| 12          | 13        | 76,04     | 76.04%     |
| 13          | 14        | 75,08     | 75.08%     |
| 14          | 15        | 74,12     | 74.12%     |
| 15          | 16        | 73,16     | 73.16%     |
| 16          | 17        | 72,20     | 72.20%     |
| 17          | 18        | 71,24     | 71.24%     |
| 18          | 19        | 70,28     | 70.28%     |
| 19          | 20        | 69,32     | 69.32%     |
| 20          | 21        | 68,36     | 68.36%     |
| 21          | 22        | 67,40     | 67.40%     |
| 22          | 23        | 66,44     | 66.44%     |
| 23          | 24        | 65        | 65.00%     |
| 24          | 26        | 63,58     | 63.58%     |
| 26          | 28        | 62,16     | 62.16%     |
| 28          | 30        | 60,74     | 60.74%     |
| 30          | 32        | 59,32     | 59.32%     |
| 32          | 34        | 57,90     | 57.90%     |
| 34          | 36        | 56,48     | 56.48%     |
| 36          | 38        | 55,06     | 55.06%     |
| 38          | 40        | 53,64     | 53.64%     |
| 40          | 42        | 52,22     | 52.22%     |
| 42          | 44        | 50,80     | 50.80%     |
| 44          | 46        | 49,38     | 49.38%     |
| 46          | 48        | 47,96     | 47.96%     |
| 48          | 51        | 46,36     | 46.36%     |
| 51          | 54        | 44,76     | 44.76%     |
| 54          | 57        | 43,16     | 43.16%     |
| 57          | 60        | 41,56     | 41.56%     |
| 60          | 64        | 40,06     | 40.06%     |
| 64          | 68        | 38,56     | 38.56%     |
| 68          | 72        | 37,06     | 37.06%     |
| 72          | 78        | 35,26     | 35.26%     |
| 78          | 84        | 33,46     | 33.46%     |
| 84          | 90        | 31,66     | 31.66%     |
| 90          | 96        | 29,86     | 29.86%     |
| 96          | 102       | 28,06     | 28.06%     |
| 102         | 108       | 26,26     | 26.26%     |
| 108         | 114       | 24,46     | 24.46%     |
| 114         | 120       | 22,66     | 22.66%     |
| 120         | 132       | 21,72     | 21.72%     |
| 132         | 144       | 21,12     | 21.12%     |
| 144         | 156       | 20,52     | 20.52%     |
| 156         | 168       | 19,92     | 19.92%     |
| 168         | 180       | 19,32     | 19.32%     |

`tests/lawDocs.spec.ts` compares the "From months", "To months" and "Share left" columns with `CUSTOMS_TABLE`, so keep the header as it is.

## How Kuna estimates a car

The estimate is the price paid times the share on the day over the share on the day the car was bought. A car bought on or before its first registration starts at 100%, so a new car loses value from the table's first row, and a used one only what it lost since it was bought. Shares are whole hundredths, and the division rounds to the cent, half away from zero.

After 180 months the table has no row. Kuna keeps the last share, 19.32%. Mark: `reading`.

A typed valuation always wins over the table.

## Worked example

Made-up figures. A car bought new on 15 January 2024 for 30,000.00 and first registered that day is 33 whole months old on 4 November 2026: 30,000.00 × 57.90% = 17,370.00.

A car bought used at 24 months for 20,000.00 and seen at 36 months: 20,000.00 × 55.06 ÷ 63.58 = 17,319.91.

## Open points

- Later amendments of Tablica 1 were not looked for. The text read is the one of NN 1/2017.
- The table has no row after 180 months, and keeping 19.32% is a reading.
- The table sets a tax, not a price. Using it as a car's value is labelled an estimate.

## Sources

- Pravilnik o posebnom porezu na motorna vozila, NN 1/2017, članak 9. stavci 1, 3 and 4 and Tablica 1. <https://narodne-novine.nn.hr/clanci/sluzbeni/2017_01_1_2.html>, loaded 4 November 2026.
