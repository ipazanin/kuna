# Assets app, lane 2: the domain and the sources

Research for the assets wave (H8 in [the hub proposal](../../../architecture/hub.md)). The starting records are the Asset and Valuation rows in [lane 3](../../../architecture/research/hub-lane3-apps.md), "Personal assets". Every figure in an example is made up. Sources were loaded on 4 Nov 2026 unless marked otherwise. "Unconfirmed" means I saw it only in a search snippet or a page I could not open.

## Summary

- **The flat's value can refresh itself from an official, free, browser-readable source.** The DZS PxWeb API serves the quarterly house price index for Grad Zagreb, Jadran and Ostalo as JSON-stat with `Access-Control-Allow-Origin: *`, and it answers the CORS preflight for POST. No key is needed. Eurostat's API also allows any origin, but for Croatia it has the national series only.
- **The plainest design holds:** a typed valuation with its date, and an estimate that carries the newest typed value forward by the DZS index for the flat's region, labelled as an estimate. Compute it at read time and store nothing derived, because DZS revises history and changed its base year to 2025 = 100 in July 2026.
- **No free source gives price per m² for an address in a form an app can read.** The ISPU price blocks are a map viewer with no documented API. The EIZG annual review has medians per municipality and per Zagreb cadastral municipality, once a year, in a PDF with an annex. Asking-price portals send no CORS headers and offer no public API.
- **A car is best typed, with an optional estimate from the Croatian customs table** of value loss by months since first registration (NN 1/2017). That table is official, needs only a price and a date, and already exists in law.
- **Tax rules give the asset record three fields worth having:** acquisition date and cost (the two-year rule on gains), how the home is used (the gains exemption and the 2025 property tax both turn on permanent residence), and useful floor area in m² (the property tax base).
- **Net worth:** count homes, land, parking, boats and the car if the owner wants, less loans. Keep the company in its own card as today. Show pensions as their own line, since the second pillar can be turned into a first-pillar pension at retirement and then has no cash value to the owner.

## 1. What to record per asset

### Fields every asset needs

| Field                              | Why                                                                                                                                                                                                                                                                                |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| id, label, kind                    | Identity and grouping.                                                                                                                                                                                                                                                             |
| your share (a fraction, default 1) | Croatian homes are often co-owned (suvlasništvo). Kuna Loans already counts a loan by `yourShare` ([overview plan](../../overview/plan.md), "Next payment"). The asset should match, or a half-owned flat with a fully counted mortgage goes wrong.                                |
| acquired on, cost                  | Change since bought, and the two-year rule on gains (part 5).                                                                                                                                                                                                                      |
| acquisition costs (optional)       | Transfer tax, notary and agency. The gains rule lets "troškovi ulaganja" and disposal costs come off, if documented (Zakon o porezu na dohodak, Art. 58(1)). I did not confirm whether the 3% transfer tax counts in the acquisition value, so keep it as its own amount and note. |
| disposed on, sale price (optional) | Closes the asset and keeps its history.                                                                                                                                                                                                                                            |
| note                               | Free text.                                                                                                                                                                                                                                                                         |

### Fields by kind

| Kind                                       | Extra fields                                                                                                                                            | Belongs in Assets?                                                                                                                                                                                                                                                                  |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home (flat or house)                       | region for the DZS index (Grad Zagreb, Jadran, Ostalo), new or existing at purchase, useful area m², use (own home, rented long term, holiday or other) | Yes. The core of the app.                                                                                                                                                                                                                                                           |
| Parking space or garage                    | same as home, without the region if not wanted                                                                                                          | Yes, as its own asset when it has its own land-registry entry. When it was bought as part of the flat, it stays inside the flat's value. eNekretnine records "garaža", "parkirno-garažno mjesto" and "vanjsko parkirno mjesto" as separate property types (EIZG review, chapter 1). |
| Land                                       | area m², kind (building, farm, forest)                                                                                                                  | Yes. Typed valuations only. EIZG publishes yearly medians per municipality for each land kind.                                                                                                                                                                                      |
| Car                                        | first registration date, purchase price                                                                                                                 | Yes, if the owner wants it counted (decision 3).                                                                                                                                                                                                                                    |
| Boat                                       | year built, purchase price                                                                                                                              | Yes. Typed valuations only. No public index or table fits.                                                                                                                                                                                                                          |
| Second pillar (obvezni mirovinski fond)    | fund and category (A, B, C)                                                                                                                             | As a pension line, decision 4. Typed statement value.                                                                                                                                                                                                                               |
| Third pillar (dobrovoljni mirovinski fond) | fund                                                                                                                                                    | Same, decision 4.                                                                                                                                                                                                                                                                   |
| Cash at home                               | none                                                                                                                                                    | Elsewhere. It is an account of kind `cash` in the planned personal money app (lane 3, Account record). Until that app exists, an "other" asset with a typed value is a fair stand-in, with no special code.                                                                         |
| Bank deposits and savings                  |                                                                                                                                                         | Elsewhere: personal money accounts. Lane 3 listed `deposit` as an asset kind. That puts the same money in two apps once personal money exists, so I would drop it from the asset kinds.                                                                                             |
| ETFs, shares, bonds, gold                  |                                                                                                                                                         | Investments already holds them. Lane 3's `investment account` kind should go for the same reason.                                                                                                                                                                                   |
| Jewellery, art, furniture                  |                                                                                                                                                         | Nowhere in v1. "Other" covers a valuable item if the owner really wants one.                                                                                                                                                                                                        |
| First pillar (HZMO)                        |                                                                                                                                                         | Nowhere. It is a right to a pension, not an account with a balance.                                                                                                                                                                                                                 |

### Valuation

Lane 3's Valuation (id, asset id, date, value, source) fits. Sources in Croatian practice:

- **estimate**: the owner's own figure.
- **appraisal**: a certified valuer's report, for example the bank's when a mortgage is taken (procjembeni elaborat under the Zakon o procjeni vrijednosti nekretnina, NN 78/15, which the EIZG review names as its legal basis).
- **purchase**: the price on the contract. The Porezna uprava takes that as market value unless it is below market (part 5), so the purchase is a fair first valuation.
- **statement**: a pension fund or bank statement.

A typed valuation always wins over an index estimate from its own date on.

## 2. Dating and refreshing a flat's value

### DZS house price index (indeks cijena stambenih objekata)

- Quarterly, published about three months after the quarter. The Q1 2026 release is dated 2 July 2026. The quarterly table on PxWeb was updated 30 Sep 2026 and already holds 2026 Q2.
- Series: total, new, existing, and three areas: **Grad Zagreb, Jadran, Ostalo**. The list of towns and municipalities in each area is a download from the PC-AXIS database under "Cijene". I did not open that list.
- Source data: every residential transaction the Porezna uprava passes on, in euros. Land value is included. Method: hedonic regression, rolling-window time-dummy since 2012, aggregated Laspeyres-type.
- **Revised and rebased in July 2026:** "Revidirani su podaci za razdoblje od prvog tromjesečja 2002. do četvrtog tromjesečja 2025." and the base changes "s 2015. = 100 na 2025. = 100". So stored index values go stale. Compute the ratio from one fresh fetch each time.
- Release: <https://podaci.dzs.hr/media/5wwfeoni/cij-2026-2-1_1-indeksi-cijena-stambenih-objekata-za-prvo-tromjesečje-2026.pdf>, downloaded and read through `pdftotext`.

**The API, checked with curl:**

- Table list: `GET https://web.dzs.hr/PXWeb/api/v1/hr/Cijene/Indeksi%20cijena%20stambenih%20objekata` returns six tables. `ME_PS14.px` is "Tabela 1.4 Indeksi cijena stambenih objekata, po tromjesečjima".
- Its variables: `Kategorije` (0 total, 1 new, 2 existing, 3 Grad Zagreb, 4 Jadran, 5 Ostalo), `Indikatori` (1 quarter-on-quarter rate, 2 year-on-year rate, 3 "indeksi (2025. = 100)"), `Tromjesečje` (2002Q1 to 2026Q2).
- Data: `POST` the same URL with `{"query":[{"code":"Indikatori","selection":{"filter":"item","values":["3"]}}],"response":{"format":"json-stat2"}}` returns JSON-stat 2.
- CORS: the response carries `Access-Control-Allow-Origin: *`. An `OPTIONS` preflight with `Origin` and `Access-Control-Request-Headers: content-type` returns `Access-Control-Allow-Methods: GET, POST` and `Access-Control-Allow-Headers: Content-Type`. I did not run it from Firefox itself, so a browser check in the code lane is still worth one spike.
- Values returned (2025 = 100), for the worked example below: Grad Zagreb 95.05 in 2025Q1 and 113.53 in 2026Q2. Jadran 108.46 and Ostalo 113.34 in 2026Q2.

### Eurostat HPI (prc_hpi_q)

- `GET https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/prc_hpi_q?geo=HR&purchase=TOTAL&unit=I25_Q` returns JSON-stat with `Access-Control-Allow-Origin: *`. Units offered: `I15_Q`, `I25_Q`, `RCH_Q`, `RCH_A`. Purchases: `TOTAL`, `DW_NEW`, `DW_EXST`.
- For Croatia it is national only. The 2026Q2 value 111.24 (2025 = 100) matches DZS exactly and is flagged provisional (`"status":{"9":"p"}`). Updated 2026-10-01.
- So Eurostat adds nothing over DZS for the owner, except as a fallback if the DZS server is down.

### Porezna uprava's market value estimates

There is no public table. The Porezna uprava assesses one property at a time, only when a sale price looks below market. Zakon o porezu na promet nekretnina, Art. 9(5): "Procjenu tržišne vrijednosti nekretnine ... utvrđuje službenik Porezne uprave na temelju usporednih podataka o kretanju tržišnih vrijednosti sličnih nekretnina s približno istog područja u približno isto vrijeme." It is useful to Kuna only as a dated valuation that a buyer already has on the tax decision. <https://www.zakon.hr/z/69/zakon-o-porezu-na-promet-nekretnina>

### Price per m² by city or area

| Source                                                             | What it gives                                                                                                                              | Readable by a browser app?                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ISPU price blocks (Plan približnih vrijednosti, stanovi/apartmani) | Average realised prices per price block, layer as of 1 Jan 2025 for the whole country (EIZG review, chapter 1)                             | No documented API. The ISPU page is an Angular map app. I found no WMS or WFS endpoint at the usual paths (`/geoserver/wms` returned 404), and its bundle names no service URL. Treat it as a page the owner looks at by hand. <https://ispu.mgipu.hr/>                                            |
| EIZG and MPGI, Pregled tržišta nekretnina 2025                     | Median €/m² per municipality, town and large city from 2012 to 2025, and for Zagreb per cadastral municipality, in an annex                | A yearly PDF plus an electronic annex. I did not confirm the annex's file format. Fine for a typed reference, not for a live figure. <https://eizg.hr/userdocsimages/publikacije/serijske-publikacije/pregled%20tr%C5%BEi%C5%A1ta%20nekretnina/pregled_trzista_nekretnina_2025/PTN_2025_final.pdf> |
| DZS, Cijene prodanih novih stanova                                 | Average €/m² of **new** flats, half-yearly, for Croatia, Zagreb and "Ostala naselja". H2 2025: Zagreb 3,428, other places 2,624, all 2,861 | A PDF only. New flats only, so it does not describe an existing flat. <https://podaci.dzs.hr/media/jq5jobax/grad-2025-4-1_2-cijene-prodanih-novih-stanova-u-2025.pdf>                                                                                                                              |
| tportal guide to ISPU                                              | Says ISPU "nudi pregled realiziranih cijena po kupoprodajnim ugovorima u gotovo svakom naselju"                                            | A news article, loaded, secondary. <https://www.tportal.hr/biznis/clanak/gradani-ovako-mogu-provjeriti-stvarne-cijene-stanova-potrebno-je-nekoliko-klikova-20250401>                                                                                                                               |

### Asking-price portals (Njuškalo, Index Oglasi, Crozilla)

Not usable. The pages returned no `Access-Control-Allow-Origin` header, so a browser app cannot read them. Index Oglasi sits behind Cloudflare. None offers a public API that I found. Asking prices also run above transaction prices, and that gap is exactly what the DZS index avoids. I could not load Njuškalo's terms, so whether they forbid scraping is unconfirmed.

### The plainest way

1. The owner types a valuation with a date. The purchase price is the first one.
2. A home with a region shows **"Estimated €X, carried forward from your €Y of {date} by the DZS index for {region}, to {quarter}"**.
3. Estimate = newest typed value × index(newest published quarter) ÷ index(quarter of the valuation date), both from one fetch of `ME_PS14.px`.
4. When the valuation's quarter is not published yet, the estimate equals the typed value and says so.
5. A failed fetch shows the typed value with its date. Nothing breaks.

Worked example, made up: the owner types €200,000.00 on 15 Mar 2025 for a flat in Grad Zagreb. 2025Q1 is 95.05 and 2026Q2 is 113.53, so the estimate is 200,000.00 × 113.53 ÷ 95.05 = €238,884.80, shown as an estimate to 2026 Q2.

Why the regional total and not new or existing: DZS gives the region split only on the total. New or existing is national only. A choice between "region total" and "national existing" is a small extra knob. I would offer region only.

Caveat to show in the caption: the index follows the market as a whole. It knows nothing of the building, the floor or a renovation.

## 3. A car's value over time

- **What tools do:** Monarch says it values vehicles automatically, and Kubera says it uses VIN lookups for the US and Canada (both unconfirmed: Monarch's help page returned 403 and the Kubera claim is from a review). Monarch's feature page, loaded, only says vehicles count as assets in net worth. These lookups are US data, so they do not help the owner. YNAB has no car feature. You keep a tracking account and adjust it.
- **An official Croatian curve exists.** The Pravilnik o posebnom porezu na motorna vozila (NN 1/2017), Art. 9(3), Tablica 1, gives the share of value left by months since first registration, for the special tax on used cars. A few rows: 77 after 11 to 12 months, 65 after 23 to 24 months, 41.56 after 57 to 60 months, 22.66 after 114 to 120 months, and 19.32 after 168 to 180 months. It has no mileage rows. Art. 9(5) says the customs office may instead use market data. <https://narodne-novine.nn.hr/clanci/sluzbeni/2017_01_1_2.html>. I did not check whether later amendments changed the table.
- **Straight-line** (say 15% a year) is the other plain rule. It has no Croatian basis for a private car. The company's 20% a year for cars is a tax rule, as lane 3 says.
- Selling a private car is not income: the income tax law excludes "otuđenje osobne imovine" except property under Art. 59 (Zakon o porezu na dohodak, Art. 8(2)(4), read through the fetch tool's extract).

**Recommendation:** typed valuations, and optionally an estimate from the customs table using purchase price and first registration. Example, made up: a car bought new for €30,000.00 and first registered in January 2024 is 34 months old in November 2026. The table leaves 56.48%, an estimate of €16,944.00. The car would then have no index fetch, only a fixed table, which is small code.

## 4. What net worth counts and how to show it

### How established tools do it

| Tool                       | Home                                                                                                                                                | Mortgage against home                                                             | Car                          | Source                                                                                                                                          |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| YNAB                       | An unlinked tracking account of type Asset, value from an estimate, adjusted "every three months or so"                                             | A separate mortgage account, updated at the same time                             | Same as any tracking account | <https://www.ynab.com/blog/tracking-our-home-value>                                                                                             |
| YNAB Net Worth report      | "based on your account balances", a snapshot on the last day of each month. Filters can exclude tracking accounts                                   |                                                                                   |                              | <https://support.ynab.com/en_us/net-worth-BkwQO5WA5.md>                                                                                         |
| Monarch                    | "Include your real estate property values by syncing with Zillow Zestimates", or a manual account                                                   | Liabilities "credit cards and loans" are subtracted                               | Counted as an asset          | <https://www.monarch.com/features/net-worth>                                                                                                    |
| Kubera                     | "Gold, Real Estate, Vehicles ... Live price feeds plus AI appraiser". It lists "Holding companies, subsidiaries, trusts" and private stocks         | Not addressed                                                                     | Counted                      | <https://www.kubera.com/how-kubera-works>                                                                                                       |
| Kubera, adjusted net worth | Total assets − liabilities − depreciation − intangibles, plus unrealised gains. No tax on gains is deducted                                         |                                                                                   |                              | <https://kubera.com/blog/adjusted-net-worth>                                                                                                    |
| Firefly III                | "The monetary value of your house can't be added to your net worth (to compensate for your mortgage). If you want to do this, use GNUCash instead." | A liability of type mortgage, with start, amount and rate, but no computed result | No                           | <https://docs.firefly-iii.org/explanation/more-information/what-its-not/>, <https://docs.firefly-iii.org/references/firefly-iii/account-types/> |

None of the tools links a mortgage to a home or shows equity per home. They show the home as one asset and the mortgage as one liability, and net worth is the difference. Kuna's equity per home (value less the loan secured by it) is a small extra the others lack.

### What to count

- **Homes, parking, land, boats:** count at the estimate or the newest typed value, times your share.
- **Loans:** Loans' balances today, as the overview already reads them (`owedTotals`).
- **Equity per home:** value × share, less the balance of each loan that names the asset, by `yourShare`. Show it on the asset, not as a second total.
- **Car:** decision 3.
- **Company:** decision 2. Today the overview shows "what you could take out now" apart and "never added to the personal figure" (overview plan, Summary). One trap if it ever joins: that figure already settles the owner's loan to the company first. If Loans also lists that loan as a debt, it is subtracted twice.
- **Pensions:** decision 4. The second pillar is "osobna imovina" used "isključivo za isplatu mirovine". It is inherited only when no family member qualifies for a survivor's pension. At retirement the member may pick Option A, a first-pillar pension only, "uz prijenos sredstava iz II. stupa u I. stup", after which the money is gone from the owner's balance sheet. REGOS: <https://regos.hr/app/uploads/2025/12/Osnovne-informacije-o-II.-stupu-mirovinskog-osiguranja.pdf>. The third pillar can pay out from 55 (50 for contracts before 2019), with a lump sum of up to 30%, and it is inherited. The state adds 15% of payments up to €99.54 a year. HANFA: <https://www.hanfa.hr/media/h3qiwthr/dobrovoljna-mirovinska-%C5%A1tednja_.pdf>.
- REGOS lists the daily unit values of each OMF category on its site, and Moj račun-REGOS in e-Građani shows the balance (REGOS PDF). I did not look for a machine-readable unit value file, so a typed statement value is the v1 path.

## 5. Croatian tax and legal points

All from zakon.hr consolidated texts, which are not the official gazette, and the Porezna uprava's page.

**Real estate transfer tax (porez na promet nekretnina).** The buyer pays it: "Obveznik poreza na promet nekretnina je stjecatelj nekretnine" (Art. 6(1)). The base is "tržišna vrijednost nekretnine u trenutku nastanka porezne obveze" (Art. 9(1)), normally the contract price (Art. 9(2)). The Porezna uprava may assess a higher value (Art. 9(4) and (5)). The rate is 3% (Art. 12, as amended by NN 106/18). The page shows no amendment after NN 106/18. <https://www.zakon.hr/z/69/zakon-o-porezu-na-promet-nekretnina>. For Kuna this is a one-off acquisition cost to note, not a running figure.

**Property tax (porez na nekretnine), from 1 Jan 2025.** It replaced the holiday home tax (Porezna uprava). Owners on 31 March of the tax year pay it (Art. 25(1)). It falls on "svaka stambena zgrada ili stambeni dio stambeno-poslovne zgrade ili stan" (Art. 2(1) point 12). It is €0.60 to €8.00 per m² of useful area a year, set by each municipality, with €0.60 as the default (Art. 26). Exempt: homes "koje služe za stalno stanovanje" and homes rented "na temelju ugovora o najmu za stalno stanovanje", the second meaning at least ten months in the year (Art. 27(1) and (5)). A registered address alone does not prove permanent residence (Art. 27(3)). Law: <https://www.zakon.hr/z/875/zakon-o-lokalnim-porezima>, consolidated to NN 152/24. Porezna uprava: <https://porezna-uprava.gov.hr/hr/porez-na-nekretnine-4816/4816>. For Kuna: a flat's use and useful area decide whether it costs tax every year. The amount is the municipality's rate times m², so v1 needs no figure. A note on a non-exempt home is enough.

**Gain on selling within two years.** Zakon o porezu na dohodak, Art. 58 (amended by NN 115/16, 114/23, 152/24):

- The gain is the market-value receipt less the acquisition value "uvećane za rast proizvođačkih cijena industrijskih proizvoda", less documented investment and sale costs (Art. 58(1)).
- It is not taxed if the property is sold "nakon dvije godine od dana nabave", or two years after it became usable when built or rebuilt (Art. 58(2)).
- It is taxed anyway if more than three properties of the same kind are sold within five years (Art. 58(3)).
- It is never taxed if the property "služila za stanovanje poreznom obvezniku ili uzdržavanim članovima njegove uže obitelji", on transfers within close family or on divorce, on expropriation, or on inheritance (Art. 58(4)). A registered address is not enough proof (Art. 58(5)).
- The rate is 24%, assessed by decision and paid within 15 days (Art. 62(3)).
- <https://www.zakon.hr/z/85/zakon-o-porezu-na-dohodak>, Articles 58 and 62 read verbatim from the downloaded page.

For Kuna: with acquired on and use recorded, the asset can say "Sold before {acquired + 2 years}, a gain may be taxed at 24% unless this was your home". That is a caption, not a calculation. Computing the tax needs the PPI uplift, which is beyond v1.

## Proposal, plainest first

1. **Records.** Lane 3's Asset and Valuation, with `share`, `region` (homes only), `useful area` and `use` (homes and parking), `first registration` (cars), and an optional `acquisition costs` amount. Kinds: home, parking, land, vehicle, boat, pension, other. Drop `deposit` and `investment account`, which belong to personal money and Investments.
2. **Value today.** The newest typed valuation, or for a home with a region, that value carried forward by the DZS index, labelled an estimate with its quarter. Optional car estimate from the customs table. Nothing derived is stored.
3. **Equity.** Per home, value × share less the loans that name it.
4. **Net worth.** Investments plus assets less loans, plus what others owe, as the overview adds today. The company stays in its own card. Pensions are a line below the total, outside it, until the owner says otherwise.
5. **Tax captions.** On a home: the two-year date while it runs, and "may owe property tax" when its use is not own home or long-term rental. No tax figures.
6. **Spike for the code lane:** one POST to the DZS PxWeb table from Firefox on the deployed origin, to see the preflight pass in a real browser.

## Decisions only the owner can make

### 1. Carry the flat's value forward by the DZS index?

On a home's card and in net worth. Today nothing values a flat. Example: you type €200,000.00 for March 2025. In November 2026 the card can either show that figure with its date, or show about €238,900 as an estimate from the Zagreb index.

- **Carry it forward by the index.** The figure moves every quarter with no typing. It follows the whole Zagreb market, not your building. Costs one fetch from DZS and a caption.
- **Show only what you typed.** Simplest and never wrong about what you said. The figure ages, and the card shows its date so you see when.

Recommendation: carry it forward, shown as an estimate, with the typed value and its date in the caption.

### 2. Does the company join net worth?

On the overview. Today the personal figure leaves the company out, and the company card shows what you could take out now after the 12% dividend tax. Example: the company could pay out €4,224.00 net, of which €3,000.00 settles your loan to it, so €1,224.00 reaches you.

- **Keep it apart.** As today. Net worth stays personal and nothing is counted twice. You see both side by side.
- **Add what you could take out now.** Net worth answers "what would I have if I emptied the company today". The figure drops each time you pay yourself and jumps when the year-end figures arrive. Your loan to the company must then not appear in Loans too.
- **Add the company's equity after dividend tax.** Bigger and steadier, but it includes money the company cannot pay out yet, such as this year's profit and cash it needs.

Recommendation: keep it apart.

### 3. Count the car?

In net worth and on the assets list. Example: a car bought for €30,000.00 in January 2024 is worth about €16,900 by the customs table in November 2026, and keeps falling.

- **Count it.** Net worth includes everything you could sell. It drifts down every month, which can hide real saving.
- **List it but leave it out of the total.** You see its value. Net worth tracks money and property that hold value.
- **Do not record cars.** Less to build. You never see it.

Recommendation: count it, with the customs-table estimate, since Monarch and Kubera both count cars and a loan on a car would otherwise show as debt with no asset against it.

### 4. Where do the pension pillars sit?

In net worth. Example: your second pillar statement says €25,000.00 and your third pillar €4,000.00.

- **A line below net worth, outside the total.** You see them. The total stays money you can reach. The second pillar may turn into a first-pillar pension at retirement and then has no balance at all.
- **Inside the total.** The total is larger and fuller. It mixes in money you cannot touch for decades.
- **Leave them out.** Less to type. You lose sight of them.

Recommendation: a line below the total, outside it, with typed statement values.

### 5. Should Assets hold bank deposits and cash at home before a personal money app exists?

On the assets list. Example: €3,000.00 in a savings deposit and €500.00 in cash at home. Today no app keeps them, and the overview says so.

- **Hold them as "other" assets for now.** Net worth is complete sooner. When personal money arrives, you move them by hand or they are counted twice.
- **Leave them for personal money.** Each app keeps one kind of thing. Net worth stays partial until then, with a caption naming the gap.

Recommendation: leave them for personal money, and keep the caption that says bank accounts are left out.

## Sources loaded

- DZS PxWeb API, house price index tables: <https://web.dzs.hr/PXWeb/api/v1/hr/Cijene/Indeksi%20cijena%20stambenih%20objekata/ME_PS14.px>
- DZS release Q1 2026: <https://podaci.dzs.hr/media/5wwfeoni/cij-2026-2-1_1-indeksi-cijena-stambenih-objekata-za-prvo-tromjesečje-2026.pdf>
- DZS new flat prices H2 2025: <https://podaci.dzs.hr/media/jq5jobax/grad-2025-4-1_2-cijene-prodanih-novih-stanova-u-2025.pdf>
- Eurostat API: <https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/prc_hpi_q?geo=HR&purchase=TOTAL&unit=I25_Q>
- EIZG and MPGI, Pregled tržišta nekretnina 2025: <https://eizg.hr/userdocsimages/publikacije/serijske-publikacije/pregled%20tr%C5%BEi%C5%A1ta%20nekretnina/pregled_trzista_nekretnina_2025/PTN_2025_final.pdf>
- ISPU: <https://ispu.mgipu.hr/> (the app shell only)
- tportal on ISPU: <https://www.tportal.hr/biznis/clanak/gradani-ovako-mogu-provjeriti-stvarne-cijene-stanova-potrebno-je-nekoliko-klikova-20250401>
- Zakon o porezu na promet nekretnina: <https://www.zakon.hr/z/69/zakon-o-porezu-na-promet-nekretnina>
- Zakon o lokalnim porezima: <https://www.zakon.hr/z/875/zakon-o-lokalnim-porezima>
- Porezna uprava, porez na nekretnine: <https://porezna-uprava.gov.hr/hr/porez-na-nekretnine-4816/4816>
- Zakon o porezu na dohodak: <https://www.zakon.hr/z/85/zakon-o-porezu-na-dohodak>
- Pravilnik o posebnom porezu na motorna vozila, NN 1/2017: <https://narodne-novine.nn.hr/clanci/sluzbeni/2017_01_1_2.html>
- REGOS, second pillar basics: <https://regos.hr/app/uploads/2025/12/Osnovne-informacije-o-II.-stupu-mirovinskog-osiguranja.pdf>
- HANFA, voluntary pension savings: <https://www.hanfa.hr/media/h3qiwthr/dobrovoljna-mirovinska-%C5%A1tednja_.pdf>
- YNAB: <https://www.ynab.com/blog/tracking-our-home-value>, <https://support.ynab.com/en_us/net-worth-BkwQO5WA5.md>
- Monarch: <https://www.monarch.com/features/net-worth>. Help article <https://help.monarch.com/hc/en-us/articles/4404739126548> returned 403, so its Zillow and VinAudit details are unconfirmed.
- Kubera: <https://www.kubera.com/how-kubera-works>, <https://kubera.com/blog/adjusted-net-worth>
- Firefly III: <https://docs.firefly-iii.org/explanation/more-information/what-its-not/>, <https://docs.firefly-iii.org/references/firefly-iii/account-types/>

Unconfirmed: Njuškalo's terms on automated access, the DZS list of towns per region, the EIZG annex format, later amendments to the NN 1/2017 car table, and whether the transfer tax counts in the acquisition value for the gains rule.
