---
checked: 2026-11-04
nn_through: 126/26
summary: Where the acts, bylaws, forms, guidance, exchange rates and foreign rules behind the Tax screen are published, how each is dated, and how to reach it
---

# Official sources

Where to read the law and official guidance for a resident investor, which source binds, how each source dates its content, and what an agent hits when it fetches it. Every page cited here was loaded on 4 November 2026 unless it is marked unconfirmed. [Versions and dates](versions-and-dates.md) explains which text applies on a date, and [Watching for changes](watching-for-changes.md) how to notice a new one.

Narodne novine is the only binding text for Croatian law, and the Official Journal for EU law. zakon.hr and the Porezna uprava consolidations are unofficial, Porezna uprava pages and opinions are guidance, and professional journals and broker guides are leads only. Fetches worked with `curl -A "Mozilla/5.0 ... Chrome/126.0"` and redirects followed.

## Summary table

| Source                                      | Authority                                                        | What to read there                                                             | How content is dated                                          | Access notes                                                                                   |
| ------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Narodne novine (narodne-novine.nn.hr)       | Official gazette. The only binding Croatian text                 | Every act, bylaw, amendment and correction, treaties in the international part | Issue date. Entry into force only in the act's final articles | Free, no login. API limit 3 requests per second                                                |
| zakon.hr                                    | Private, unofficial consolidations                               | Consolidated ZPDoh, ZDop, OPZ, ZUP with each article's NN tags                 | Banner "Baza je ažurirana ... zaključno sa NN x/yy"           | Cloudflare, but curl works. Historical versions are paid. Through NN 119/26 on 4 Nov 2026      |
| Porezna uprava (porezna-uprava.gov.hr)      | Tax administration. Consolidations are editorial. Pages guidance | Propisi JSON with every version, the JOPPD form and annexes, examples, notices | Pages carry "Objavljeno" dates. Propisi carries the NN chain  | Free. Propisi endpoints need `X-Requested-With: XMLHttpRequest`                                |
| Hrvatski sabor (sabor.hr)                   | Legislature                                                      | Bills (P.Z. numbers), readings, votes                                          | Dates of entry into procedure, debate and vote                | Free. Bill PDFs are often scans                                                                |
| HNB (api.hnb.hr)                            | Central bank                                                     | The exchange rate list for HNB clients                                         | `datum_primjene`                                              | Free JSON                                                                                      |
| ECB (data-api.ecb.europa.eu)                | European Central Bank                                            | Euro reference rates by day                                                    | `TIME_PERIOD`                                                 | Free CSV and JSON                                                                              |
| EUR-Lex and Cellar (publications.europa.eu) | Official EU law                                                  | CSDR and its amendments                                                        | OJ date, the act's own application article                    | EUR-Lex challenges automated fetches. Cellar works                                             |
| SEC, IRS                                    | US regulators                                                    | US settlement cycle, US withholding on income paid abroad                      | Release date                                                  | sec.gov refuses curl without a declared agent. A summarising fetch with verbatim quotes worked |
| RRiF, TEB, broker guides, news              | Secondary                                                        | Practice, worked examples, early news                                          | Article date                                                  | Mostly paywalled past the first paragraph                                                      |

## Narodne novine

- The official part (službeni dio) has issues numbered from 1 each year, and item numbers that run on through the year. Treaties appear in the international part (međunarodni ugovori), numbered on its own, as NN MU 6/2026.
- `POST https://narodne-novine.nn.hr/api/editions` with `{"part":"SL","year":2026}` lists the year's issues. It returned issues 1 to 126 on 4 November 2026.
- Issue listing: `https://narodne-novine.nn.hr/search.aspx?sortiraj=4&kategorija=1&godina=2026&broj=126&rpp=200&qtype=1&pretraga=da` gives each item's title.
- Title search: `search.aspx?upit=%22porezu+na+dohodak%22&naslovi=da&sortiraj=1&kategorija=1&godina=2026&rpp=50&qtype=3&pretraga=da`. On 4 November 2026 it found one 2026 item, a local rate decision of NN 118/26, and no amendment of ZPDoh or PravPDoh.
- Item pages: `https://narodne-novine.nn.hr/clanci/sluzbeni/{year}_{month}_{issue}_{item}.html`, for example `2023_10_114_1609.html` for the ZPDoh amendment of NN 114/23.
- The international part has its own issue listing, `search.aspx?sortiraj=4&kategorija=2&godina=2026&broj=6&rpp=200&qtype=1&pretraga=da`, and item pages under `clanci/medunarodni/`, as `2026_10_6_23.html` for the US treaty law.
- NN metadata does not carry entry into force. Read it in the act's final articles.

## zakon.hr

- `https://www.zakon.hr/z/85/Zakon-o-porezu-na-dohodak` is the consolidated ZPDoh. Each article lists the NN issues that set its wording, and the page ends with the transitional articles of every amendment, such as "Prijelazne i završne odredbe iz NN 138/20".
- The banner read "Baza je ažurirana 01.11.2026. zaključno sa NN 119/26" on 4 November 2026. Check the issues after that stamp in NN.
- The site says of itself "Zakon.hr nije službeni izvor propisa". Use it for the chain and the article, and confirm a value in NN where it matters.

## Porezna uprava

### Propisi

`https://porezna-uprava.gov.hr/Propisi/GetBasicData/{node}` answers a plain GET with the header `X-Requested-With: XMLHttpRequest`, and returns JSON whose `Description` holds the act's full HTML text. Node 4 is the Pravilnik o porezu na dohodak. On 4 November 2026 it was the "redakcijski pročišćeni tekst" through NN 157/25, "Na snazi i primjenjuje se od 1. siječnja 2026.". `GetHistory/{node}` lists earlier versions by their NN chain.

### Forms, examples and pages

- The JOPPD form with its annexes: `https://porezna-uprava.gov.hr/UserDocsImages/Arhiva/HR_obrasci/Documents/POREZ%20NA%20DOHODAK/JOPPD.pdf?vel=1253556`. PDF created 24 December 2025. `pdftotext -layout` extracts the code lists.
- The crypto JOPPD example, 6 February 2026: `https://porezna-uprava.gov.hr/hr/primjer-podnosenja-obrasca-joppd-za-primitke-po-osnovi-trgovanja-kriptoimovinom/8342` and its PDF `https://porezna-uprava.gov.hr/UserDocsImages/Dokumenti%20vijesti/Obrazac%20JOPPD%20-%20kriptovalute%20neoporezivo.pdf?vel=249761`.
- The capital gains notice for 2025 gains, 13 January 2026: `https://porezna-uprava.gov.hr/hr/oporezivanje-kapitalnih-dobitaka-i-izvjescivanje-putem-obrasca-joppd-8281/8281`. The one for 2022 gains, 19 January 2023: `https://porezna-uprava.gov.hr/hr/oporezivanje-kapitalnih-dobitaka-i-izvjescivanje-putem-obrasca-joppd/6871`.
- The JOPPD page with the report mark rule: `https://porezna-uprava.gov.hr/hr/joppd/3956`.
- INO-IZJAVA (4526), the INO-DOH form (4524) and filling it in (4525): `https://porezna-uprava.gov.hr/hr/ino-izjava/4526`, `.../obrazac-ino-doh/4524`, `.../popunjavanje-obrasca-ino-doh/4525`.
- The Austrian dividend INO-DOH example: `https://porezna-uprava.gov.hr/UserDocsImages/Arhiva/HR_obrasci/Obrasci%20nesvrstani/INODOH/DIVIDENDA%20AUSTRIJA.pdf?vel=497838`.
- The treaty map: `https://porezna-uprava.gov.hr/hr/ugovori-o-izbjegavanju-dvostrukog-oporezivanja/7559`.

### Opinions

The Mišljenja SU list is at `https://porezna-uprava.gov.hr/hr/misljenja-su/3951`, searchable by `Query`, `CategoryId` (4 is income tax) and dates. Opinions are not law. OPZ Art. 10 provides a binding opinion (obvezujuće mišljenje) only on a taxpayer's paid written request about future transactions. Mark a value resting on an opinion `reading`.

## HNB

- `https://api.hnb.hr/` documents the API and says: "Tečajna lista za klijente HNB-a objavljuje se svakoga radnog dana platnog sustava TARGET u periodu između 15:30 i 17 sati, a ne objavljuje se na neradne dane platnog sustava TARGET, što uključuje subote i nedjelje, 1. siječnja, Veliki petak, Uskrsni ponedjeljak, 1. svibnja te 25. i 26. prosinca."
- `https://api.hnb.hr/tecajn-eur/v3?datum-primjene-od=2026-10-28&datum-primjene-do=2026-11-04` returns one row per currency and `datum_primjene`, weekends included, with decimal commas. Rates are per 1 EUR.
- How a list's `datum_primjene` relates to the ECB day is set out in [HNB rates and settlement](../hnb-rates-and-settlement.md#which-hnb-list).

## ECB

`https://data-api.ecb.europa.eu/service/data/EXR/D.USD.EUR.SP00.A?startPeriod=2026-10-27&endPeriod=2026-11-04&format=csvdata` returns the USD reference rate by `TIME_PERIOD`. Kuna's prices file stores ECB rates under that day.

## EUR-Lex and Cellar

EUR-Lex challenges automated fetches. Cellar returns the text without a challenge: `http://publications.europa.eu/resource/celex/32014R0909` (CSDR) and `.../32025R2075` (its T+1 amendment), with `Accept: application/xhtml+xml` and `Accept-Language: eng`.

## US sources

- SEC press release 2023-29 of 15 February 2023 on T+1: `https://www.sec.gov/newsroom/press-releases/2023-29`. curl got "Request Rate Threshold Exceeded", since sec.gov wants a declared user agent. A summarising fetch returned the verbatim sentences.
- IRS, "NRA withholding": `https://www.irs.gov/individuals/international-taxpayers/nra-withholding`, read through a summarising fetch with verbatim quotes.

## Professional secondary sources

| Source                          | What it is                                                         | Access                                        |
| ------------------------------- | ------------------------------------------------------------------ | --------------------------------------------- |
| RRiF (rrif.hr)                  | Journal and opinion copies. Abstracts and opinions often load free | Full articles by subscription                 |
| TEB (teb.hr)                    | News                                                               | First paragraph free, the rest "pretplatnici" |
| Raiffeisen KAG and Finax guides | Broker brochures on filling in the capital gains JOPPD             | Free PDFs                                     |
| News sites                      | Treaty status and bills                                            | Free                                          |

Use them as leads: to learn that a bill exists, or how practice fills in a field. Never as the source of a rate, date or code. They support at most `reading`, and a value known only from them stays `unconfirmed`. A search snippet is not verification.

## Open points

- The US Senate's step on the treaty comes from a news report, since congress.gov refused an automated fetch.
- sec.gov was read only through a summarising fetch.

## Sources

Every URL in this file was loaded on 4 November 2026 unless marked unconfirmed above.
