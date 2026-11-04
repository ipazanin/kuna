# Lane 4: free daily price data

Which free sources can give a once-a-day price for each asset kind in the owner's portfolio, checked with real requests and docs on 2026-10-30, and how Kuna should fetch, map, store and age those prices.

## Short version

No single free source covers everything legally. Yahoo is the only one that covers US shares, European ETFs, FX, crypto and gold in one place. But it has no official API, its terms forbid automated collection, and it answered `429 Too Many Requests` to the very first request from this machine. The plan below avoids it and uses one source per asset kind:

| Asset kind                                      | Primary                                              | Fallback                            | From the browser?                   |
| ----------------------------------------------- | ---------------------------------------------------- | ----------------------------------- | ----------------------------------- |
| Listed shares and ETFs, US and Xetra            | Alpha Vantage, free key                              | Tiingo for US, EODHD free for EU    | Alpha Vantage yes, the fallbacks no |
| Zagreb shares, ETFs, Croatian bonds and T-bills | ZSE REST price list, one call a day                  | manual price                        | no                                  |
| FX                                              | ECB Data Portal API                                  | Frankfurter (ECB route), HNB        | ECB and Frankfurter yes, HNB no     |
| Crypto                                          | CoinGecko (keyless or free Demo key)                 | Kraken OHLC, Binance klines         | yes                                 |
| Gold (XAU)                                      | Frankfurter v2 `XAU`, a blend of central bank prices | NBP gold API, gold-api.com for spot | yes                                 |
| Gold ETC                                        | treat as a listed security                           |                                     |                                     |
| Croatian money market funds                     | manual NAV from the fund manager                     | ZSE if the fund is exchange-listed  | n/a                                 |
| Symbol and ISIN mapping                         | OpenFIGI, keyless                                    |                                     | no                                  |

Run one fetch a day at about 06:30 Europe/Zagreb. By then every market's previous close is out, along with the ECB rates (published around 16:00 CET), the ZSE price list and CoinGecko's daily candle. A Google Apps Script time trigger fits best. It has no CORS limit, keeps API keys out of the PWA, reads the holdings from Drive and writes prices back to Drive. The owner already runs Apps Script for another ledger. Store closes only, one series per instrument, in a prices file separate from the transactions. When a price is missing, keep the last close with its own date and show it as stale.

## What the sample CSV says about symbols

The owner's `portfolio.csv` is Yahoo's portfolio export, with 17 columns: `Symbol, Current Price, Date, Time, Change, Open, High, Low, Volume, Trade Date, Purchase Price, Quantity, Commission, High Limit, Low Limit, Comment, Transaction Type`. Only the symbol formats matter for this lane:

- Symbols come in three formats: plain US tickers (`AAPL`), Xetra listings with `.DE` (`SXR8.DE`) and Euronext Amsterdam listings with `.AS` (`SEMI.AS`). There is also the pseudo-symbol `$$CASH`.
- No crypto, FX, gold, index or fund rows. Their Yahoo formats below come from Yahoo's exchange list, not from the file.
- `Transaction Type` is `BUY`, `SELL`, `SHORT`, or empty (`$$CASH` and watchlist-style rows with no trade date).
- `Date` is `YYYY/MM/DD`, `Time` is `HH:MM` with a zone word (`EDT` or `CET`), and `Trade Date` is `YYYYMMDD`. `Current Price` is a snapshot from the export moment, not history.
- A ticker alone is ambiguous. Tiingo's ticker list has a `SEMI` that is a NYSE ETF in USD, a different fund from `SEMI.AS`. Kuna must key instruments by ISIN plus exchange (MIC) plus currency and keep each source's symbol as a mapping.

## How each candidate checked out

All requests ran from this machine on 2026-10-30 between 07:30 and 08:00 CET with `-H "Origin: https://ipazanin.github.io"`. "CORS" means the `Access-Control-Allow-Origin` header on that response. Where a key was needed, the check used a demo key or a bad key, so the header comes from an error response. Pages were loaded the same day.

### Listed shares and ETFs

**Yahoo Finance chart endpoint** (`query1/query2.finance.yahoo.com/v8/finance/chart/SXR8.DE`). Every request returned `429 Too Many Requests`, with a curl user agent or a browser one, on query1 or query2, and also from the `fc.yahoo.com` cookie and crumb route. The 429 response had no CORS header. Yahoo's help page lists suffixes `.DE` Xetra, `.F` Frankfurt, `.AS` Amsterdam, `.PA` Paris, `.MI` Milan, `.L` London, `.SW` SIX, `.VI` Vienna and `.WA` Warsaw. It lists FX as `=X` (`EURUSD=X`) and crypto with no suffix. Zagreb and Ljubljana are not listed. Quotes are 15 to 30 minutes delayed. ([Yahoo exchanges help](https://help.yahoo.com/kb/SLN2310.html)) The terms forbid accessing or collecting data "using any automated means … without our express, prior permission" ([Yahoo terms](https://legal.yahoo.com/xw/en/yahoo/terms/otos/index.html)). **Terms forbid this use.** The response format and the `BTC-EUR` style crypto symbols could not be checked today, so they are unconfirmed.

**Stooq CSV.** The old quote URL `stooq.com/q/l/?s=sxr8.de…` now returns 404. The history URL `stooq.com/q/d/l/?s=sxr8.de&i=d` returns an HTML page that runs a JavaScript proof-of-work check instead of CSV, and the same happens for `xauusd`. A pandas-datareader issue from 2026-04-13 reports that since March 2026 Stooq wants an API key that is handed out behind a captcha ([issue 1012](https://github.com/pydata/pandas-datareader/issues/1012)). Not usable from a script or a browser.

**Alpha Vantage.** The free key gives "25 API requests per day" ([premium page](https://www.alphavantage.co/premium/)). `TIME_SERIES_DAILY` is free, but "The 'compact' outputsize is available to both free and premium API keys. The 'full' outputsize is available to premium keys". Compact means the latest 100 data points, so free history is about five months. `TIME_SERIES_DAILY_ADJUSTED` is premium. The docs give non-US examples `TSCO.LON`, `MBG.DEX` (Xetra), `SHOP.TRT` and others. They give no Euronext Amsterdam example, so `SEMI.AS` coverage is unconfirmed. `FX_DAILY`, `DIGITAL_CURRENCY_DAILY`, `GOLD_SILVER_SPOT` and `GOLD_SILVER_HISTORY` exist with no premium label ([documentation](https://www.alphavantage.co/documentation/)). The demo key returned IBM's daily series with the 2026-10-29 close and `access-control-allow-origin: *`. It refused a second Xetra symbol, because the demo key only serves its fixed examples. The terms allow "personal, non-commercial use", which includes "investment analysis, research, testing, monitoring" that is "private and individual in nature" ([terms PDF](https://www.alphavantage.co/terms_of_service/)). It suits Kuna, but 25 calls a day is one call per open listing, and the history is short.

**Twelve Data.** The Basic plan is free with 800 credits a day and 8 a minute ([pricing](https://twelvedata.com/pricing)). Its help page says Basic gives "real-time data for all US markets, forex, and cryptocurrencies" ([plan article](https://support.twelvedata.com/en/articles/5335783-trial)). The public `/exchanges?show_plan=true` call settles it: `XETR`, `XFRA`, `XAMS` and `XLON` need the paid Grow plan, while `XNAS` and `XNYS` are Basic. Demo calls for `AAPL`, `EUR/USD` and `BTC/USD` worked with `access-control-allow-origin: *`. Fine for US, FX and crypto, but no free European ETFs.

**Financial Modeling Prep.** The free Basic plan has 250 calls a day, end-of-day data and 5 years of history. US coverage comes with Starter, UK and Canada with Premium, and "Global Coverage" only with Ultimate. The page also says "Displaying or redistributing data sourced from FMP requires a specific Data Display and Licensing Agreement" ([pricing](https://site.financialmodelingprep.com/pricing-plans), fetched with a browser user agent because WebFetch got a 403). CORS `*`. No European listings on the free plan.

**EODHD.** The free plan has 20 calls a day and one year of history ([pricing](https://eodhd.com/pricing)). Tickers are `SYMBOL.EXCHANGE` with EODHD's own codes, for example `SAP.XETRA`, `.PA`, `.FOREX`, `.CC` and `.US`. US closes update within 15 minutes of the close and other exchanges "2-3 hours after the market closes" ([EOD docs](https://eodhd.com/financial-apis/api-for-historical-data-and-volumes)). The demo key served `AAPL.US` and `EURUSD.FOREX`, and a Xetra symbol got 403 because demo is limited to six tickers. The response had `access-control-allow-credentials: true` but **no** `Access-Control-Allow-Origin`, so the browser blocks it. The cheapest paid plan is $19.99 a month for 30+ years of worldwide EOD data with 100,000 calls a day. If the owner ever wants to pay for one clean source, this is the one.

**Tiingo.** The free Starter plan has 50 requests an hour, 1,000 a day, 500 unique symbols a month and "30+ Years" of history. Its license is "Internal Use Only", meaning "you may only use the data for your own personal use" and "you may not display or share the data with another person or organization" ([pricing](https://www.tiingo.com/about/pricing)). US closes are ready around 5:30 PM EST ([EOD docs](https://www.tiingo.com/documentation/end-of-day)). The public [supported tickers file](https://apimedia.tiingo.com/docs/tiingo/daily/supported_tickers.zip) lists only US, OTC and Chinese exchanges plus 11 LSE rows, with no Xetra or Euronext. A bad-token request returned no CORS header. It is the best free source for full US history, but only from a server-side job.

**Marketstack.** The free plan has "100 Requests / mo", "1 Year History", end-of-day data only and "Non-Commercial Use" ([pricing](https://marketstack.com/pricing)). The v2 docs need a login, so symbol format, symbols per request and European coverage are **unconfirmed**. CORS `*`. With 100 calls a month it only works if one call can carry many symbols.

**Finnhub.** The free plan is "Personal Use" with "60 API calls/minute". International market data (Euronext, Deutsche Börse and others, "end-of-day data only") is shown under the paid All-In-One plan ([pricing](https://finnhub.io/pricing), read in Chrome because the page is rendered by JavaScript). Whether free keys get daily candles is **unconfirmed**. CORS `*`.

**Massive (formerly Polygon.io).** Stocks Basic is free with "5 API Calls / Minute", "2 Years Historical Data", "End of Day Data", "All US Stocks Tickers" and a personal license ([pricing](https://massive.com/pricing), read from the page's embedded plan data). `api.polygon.io` and `api.massive.com` both answer with the same error format. CORS echoes `https://ipazanin.github.io`. US only.

**Leads from the valore plan.** [TickerInside](https://tickerinside.com/api/) serves US ETF holdings under CC BY 4.0, not prices. That could be useful later for look-through exposure, but not here. [Stocklake](https://api.stocklake.dev/docs) is a tool server for AI agents with 25 guest calls a day, and its coverage is unconfirmed. Neither is a price source for this app.

### Zagreb Stock Exchange (shares, ETFs, bonds, T-bills)

The ZSE website loads its data from `https://rest.zse.hr/web/Bvt9fe2peQ7pwpyYqODM/`. The key in that path belongs to the website and is not a personal key. Two calls work with no sign-up:

- `price-list/XZAG/2026-10-29/json` returns the whole exchange for one day in one call: 116 securities, of which 69 are ordinary shares, 17 state bonds, 14 corporate bonds, 6 ETFs, 5 T-bills (`BILL`), 4 preferred shares and 1 municipal bond. Each row has `symbol`, `isin`, `close_price`, `trade_date` (the date of the last trade), `price_currency` and, for debt, `debt_maturity_date` and `debt_interest_rate`. Bonds are priced in `"% EUR"`, so value is nominal × price / 100 with accrued interest on top. Illiquid lines carry an old `trade_date`. For example, one state bond's close on the 2026-10-29 list came from a trade on 2026-02-16, which is exactly the "stale with its date" signal Kuna needs. InterCapital's six ETFs are listed here, including a money market ETF `7CASH`.
- `security-history/XZAG/{ISIN}/{from}/{to}/json` returns daily OHLC, VWAP and volume for one ISIN. A 2010 request worked. Prices before 2023 are in `HRK`, so convert at the fixed 7.53450.

Both calls return no CORS header. ZSE says end-of-day and 15-minute delayed data are on its website "without any fees" ([data to end users](https://zse.hr/en/data-distribution-to-end-users/720)). Its terms grant a "licence to view, print, or copy the content" for "personal non-commercial use only" and forbid commercial use and redistribution. They say nothing about automated access ([terms of use](https://zse.hr/en/terms-of-use/1732)). One call a day for personal tracking fits the wording. The endpoint is undocumented and can change without notice, so keep manual entry as the fallback. Yahoo has no Zagreb suffix. OpenFIGI knows ZSE shares (it maps `HRKOEIRA0009` to `KOEI`).

### FX

**ECB Data Portal.** `data-api.ecb.europa.eu/service/data/EXR/D.USD.EUR.SP00.A?lastNObservations=3&format=csvdata` returned USD per EUR for 2026-10-27 to 2026-10-29. `D.USD+GBP+CHF.EUR.SP00.A` returns several currencies in one call. No key, CORS `*`, parameters `startPeriod`, `endPeriod`, `updatedAfter`, `lastNObservations` and `detail` ([API data docs](https://data.ecb.europa.eu/help/api/data)). Rates come out "around 16:00 CET" on TARGET days for 29 currencies. The ECB says they are "for information purposes only" and that using them "for transaction purposes is strongly discouraged" ([reference rates](https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html)). That is fine for valuation.

**Frankfurter.** No key, CORS `*`, no daily caps, "Rates update daily and go back to 1948", and storing data locally "is encouraged" ([frankfurter.dev](https://frankfurter.dev/)). v2 blends 106 central banks by default. Its EUR/USD for 2026-10-29 (1.1159) differed from the ECB's (1.113). For figures that match the ECB, use the ECB route `v2/providers/ecb/rates?quotes=usd`, which returned 1.113. v1 (`/v1/latest`) is ECB-based, deprecated and still served. `api.frankfurter.app` redirects to `api.frankfurter.dev/v1`.

**HNB.** `api.hnb.hr/tecajn-eur/v3?valuta=USD` works with no key, but has **no** CORS header. The list is published between 15:30 and 17:00 on TARGET days and applies from the next day ([api.hnb.hr](https://api.hnb.hr/)). Its middle rate matched the ECB figure (1.113000 for application date 2026-10-30). Use HNB only where a Croatian rule names the HNB middle rate, for example in a tax lane, and do it from the job.

### Crypto

**CoinGecko.** Keyless `simple/price?ids=bitcoin,ethereum&vs_currencies=eur,usd` worked with CORS `*`. The preflight allows the `x-cg-demo-api-key` header. `market_chart?days=365&interval=daily` returned 366 daily points. `days=400` and `/history?date=01-01-2020` returned 401 with "Public API users are limited to querying historical data within the past 365 days". The free Demo key plan has 100 calls a minute, 10,000 a month, one year of daily history and "Attribution required" ([pricing](https://www.coingecko.com/en/api/pricing)). The key goes in the `x-cg-demo-api-key` header against `api.coingecko.com/api/v3/` ([Demo auth](https://docs.coingecko.com/demo/reference/authentication.md)). The last completed UTC day "is available 10 minutes after midnight (00:10 UTC)" ([market chart](https://docs.coingecko.com/reference/coins-id-market-chart)). The keyless tier's limits are not published, so they are unconfirmed.

**CoinCap.** `api.coincap.io` (v2) no longer resolves in DNS. `rest.coincap.io/v3/assets/bitcoin` returns 401 without a key. The docs page renders nothing without JavaScript, so its free tier terms are unconfirmed. Drop it.

**Kraken.** Public `0/public/OHLC?pair=XBTEUR&interval=1440` needs no key. CORS echoes the origin. It "Returns up to 720 of the most recent entries", about two years of daily candles ([OHLC docs](https://docs.kraken.com/api/docs/rest-api/get-ohlc-data/)).

**Binance.** `api/v3/klines?symbol=BTCEUR&interval=1d&startTime=…` worked with no key and CORS `*`. BTCEUR candles go back to 2020-01-03, with up to 1,000 per call ([market data docs](https://developers.binance.com/docs/binance-spot-api-docs/rest-api/market-data-endpoints)). This is the deepest free crypto history found, so it is the backfill source.

### Gold

- **LBMA** `prices.lbma.org.uk/json/gold_pm.json` returned a Cloudflare 403 page. Not usable.
- **Frankfurter v2** has `XAU`. `v2/rates?quotes=xau&expand=providers` showed a blend of 14 central banks (NBP, BNR, CBR and others) with an outlier excluded. History reached back to at least 2015-01-05 in the test. The rate is XAU per EUR, so EUR per troy ounce is `1 / rate`. No key, CORS `*`, and blended rates "are Frankfurter's own calculation and free to use". This is the primary source for a physical gold holding valued in EUR.
- **NBP** `api.nbp.pl/api/cenyzlota/last/2?format=json` worked with CORS `*`. It returns "the price of 1g of gold (of 1000 millesimal fineness)" from 2013-01-02, at most 93 days per query ([NBP API](https://api.nbp.pl/en.html)). The currency is not named on the page, but it is PLN in practice, so convert with ECB EUR/PLN. It is a primary-source fallback.
- **gold-api.com** `price/XAU/EUR` gave a live spot price with no key and CORS `*`. History needs a key: "10 API requests/hour to the price history API" on the free plan ([pricing](https://gold-api.com/pricing)). Good for a "now" value, not for daily history.
- **Alpha Vantage** `GOLD_SILVER_HISTORY` is a free-key option that shares the 25-a-day budget.
- **ECB** publishes no gold price in `EXR`.
- A **gold ETC** such as a Xetra-listed one is a listed security. Price it like any Xetra ETF, and do not convert it from XAU.

### Croatian money market funds

There is no free API or central NAV feed. Croatian UCITS fund managers calculate and publish unit prices themselves, and HANFA regulates the method but does not publish a daily price list. Of the manager sites probed, Erste AM returned a JavaScript-rendered page with no data endpoint in the HTML. The ZB Invest and PBZ Invest hosts did not connect from here. InterCapital and Raiffeisen show no price feed in their HTML. Recommendation: enter the NAV by hand from the statement or the manager's page, monthly or when it matters. A money market fund moves slowly, so a month-old price with a visible date is honest and close. If the owner holds an exchange-listed money market ETF, such as InterCapital's `7CASH` on ZSE, it comes free with the ZSE price list.

### Mapping: OpenFIGI

`POST api.openfigi.com/v3/mapping` with no key allows 25 requests a minute and 10 jobs per request ([docs](https://www.openfigi.com/api/documentation)). The response headers confirmed `ratelimit-limit: 25`. Results from today:

- One Irish-domiciled ETF's ISIN returned 179 listings across exchanges.
- `TICKER SXR8` with `exchCode GR` mapped to Xetra. The same ticker with `GY` returned nothing, so Xetra is `GR` in OpenFIGI.
- `TICKER SEMI` with `exchCode NA` mapped to Euronext Amsterdam.

Neither the POST nor the preflight returned an `Access-Control-Allow-Origin`, so call it from the job, or once when an instrument is added through the job.

## CORS and Kuna's own policy

Even a source with `*` will not load in Kuna today. `index.html:7` at HEAD `210875f` sets `connect-src 'self' https://www.googleapis.com https://gmail.googleapis.com https://openidconnect.googleapis.com https://oauth2.googleapis.com`. Another agent is editing the working tree, so this reference is against HEAD. Every browser-side source would need a line in that policy. That is a second reason to fetch from a job and let the PWA read only Drive.

| Source            | Key              | CORS for ipazanin.github.io           |
| ----------------- | ---------------- | ------------------------------------- |
| Yahoo chart       | none             | none on the 429 response, unconfirmed |
| Alpha Vantage     | free key         | `*`                                   |
| Twelve Data       | free key         | `*`                                   |
| FMP               | free key         | `*`                                   |
| EODHD             | free key         | none                                  |
| Tiingo            | free key         | none                                  |
| Marketstack       | free key         | `*`                                   |
| Finnhub           | free key         | `*`                                   |
| Massive (Polygon) | free key         | origin echoed                         |
| ZSE REST          | none             | none                                  |
| ECB               | none             | `*`                                   |
| Frankfurter       | none             | `*`                                   |
| HNB               | none             | none                                  |
| CoinGecko         | none or Demo key | `*`                                   |
| Kraken, Binance   | none             | echoed, `*`                           |
| gold-api.com, NBP | none             | `*`                                   |
| OpenFIGI          | none             | none                                  |

A real browser check was attempted from a GitHub Pages 404 page on `ipazanin.github.io`. Every fetch failed, including sources that send `*`, so that page's own policy blocked them and the test proves nothing. The table rests on curl headers.

## Recommendations

### One fetch a day, from a job

- **Where:** a standalone Google Apps Script with a daily time trigger, under the owner's account. Consumer accounts get "20,000 / day" URL fetches, "6 min / execution" and "90 min / day" of trigger runtime ([quotas](https://developers.google.com/apps-script/guides/services/quotas)). A daily trigger fires at a time Apps Script picks within the chosen hour and then keeps it ([triggers](https://developers.google.com/apps-script/guides/triggers/installable)). The job reads the investments file from Drive to learn which instruments are open, fetches, and writes the prices file. Keys (Alpha Vantage, Tiingo, CoinGecko Demo) live in the script's properties, never in the PWA bundle or the synced JSON.
- **Why not GitHub Actions:** a public repo would publish the owner's holdings. Scheduled runs "can be delayed during periods of high loads", and in a public repo they are "automatically disabled when no repository activity has occurred in 60 days" ([events docs](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)).
- **When:** 06:00 to 07:00 Europe/Zagreb, every day including weekends, because crypto never closes. By then:
  - US closes are out (22:00 CET plus Tiingo's 5:30 PM EST, EODHD's 15 minutes)
  - Xetra and Amsterdam closes are out (EODHD says 2 to 3 hours after close)
  - the ZSE list for the previous day is out (the 2026-10-29 list was there at 07:36 on 10-30)
  - the ECB rates from the previous afternoon are out
  - CoinGecko's previous UTC day is out (00:10 UTC)

  The result lags a day, which the owner said is fine.

- **What:** only instruments with an open position, plus FX pairs for every currency held, plus XAU if gold is held. Closed positions need no new prices. A "Refresh now" in the app can call the same script as a web app endpoint later. That is a later choice.
- **Budget check:** Alpha Vantage at 25 a day covers about 20 open listings with room for retries. ZSE is 1 call for the whole exchange, ECB 1 call for all currencies, CoinGecko 1 call for all coins and Frankfurter 1 call for gold.

### Source per kind, with symbol mapping from Yahoo

| Yahoo symbol                | Kuna instrument key           | Primary request                             | Fallback                          |
| --------------------------- | ----------------------------- | ------------------------------------------- | --------------------------------- |
| `AAPL` (no suffix)          | ISIN + `XNAS`/`XNYS` + USD    | Alpha Vantage `AAPL`                        | Tiingo `aapl`                     |
| `SXR8.DE`                   | ISIN + `XETR` + EUR           | Alpha Vantage `SXR8.DEX`                    | EODHD `SXR8.XETRA`                |
| `SEMI.AS`                   | ISIN + `XAMS` + EUR           | Alpha Vantage, suffix unconfirmed           | EODHD `SEMI.AS` (unconfirmed)     |
| `.F`, `.PA`, `.MI`, `.L`    | ISIN + MIC                    | check per listing                           | EODHD `.F`, `.PA`, `.MI`, `.LSE`  |
| none (ZSE share, ETF, bond) | ISIN + `XZAG` + EUR           | ZSE price list by ISIN                      | manual                            |
| `EURUSD=X`                  | currency pair                 | ECB `D.USD.EUR.SP00.A`                      | Frankfurter `providers/ecb`       |
| `BTC-EUR`                   | coin + EUR                    | CoinGecko id `bitcoin`, `vs_currencies=eur` | Kraken `XBTEUR`, Binance `BTCEUR` |
| `GC=F` (futures, USD)       | metal XAU, troy ounce         | Frankfurter `quotes=xau`, invert            | NBP grams in PLN                  |
| `$$CASH`                    | cash balance, no price        | none                                        | none                              |
| `^GSPC` and other indexes   | benchmark only, not a holding | an ETF that tracks it, for example `SXR8`   | none                              |

Rules for the mapping:

- Resolve each new instrument once to ISIN + MIC + currency through OpenFIGI, then store the per-source symbols on the instrument. Translate Yahoo suffixes with a fixed table (`.DE` to `XETR`/`GR`, `.AS` to `XAMS`/`NA`, `.F` to `XFRA`, no suffix to US).
- Never match on the bare ticker. `SEMI` alone resolves to a different fund on NYSE.
- Prefer the listing the owner actually bought on. Do not price a Xetra holding with its NAV or with another venue's price. The valore plan made the same rule.

Before building, the owner should claim a free Alpha Vantage key and try a Xetra listing such as `SXR8.DEX` and an Amsterdam listing (the `.AMS` suffix is a guess). If Amsterdam fails, EODHD free (20 a day) covers the Amsterdam listings.

### History

- Metrics like total gain, % gain, value and money-weighted return (XIRR) need only today's prices plus the transactions. Daily history is only for the value-over-time chart and time-weighted return.
- Start the history from the first fetch and let it grow. Each buy and sell already carries a price on its trade date, so the chart has those points from day one.
- Optional backfill:
  - Tiingo for US listings, 30+ years free
  - ZSE `security-history` for Zagreb, back to at least 2010, HRK before 2023
  - Binance for crypto, BTCEUR from 2020
  - Frankfurter for gold and FX
  - for Xetra and Amsterdam, only about one year free (EODHD) or 100 days (Alpha Vantage). Deeper EU history means one month of EODHD's $19.99 plan or living without it.

### Storage

Keep prices out of the transactions file. Prices can be fetched again, but transactions cannot. A separate Drive file, for example `kuna-invest-prices.json`, also keeps the daily writes from touching the owner's records:

```json
{
  "fetchedAt": "2026-10-30T06:41:00+01:00",
  "series": {
    "IE00B5BMR087:XETR": {
      "currency": "EUR",
      "source": "alphavantage",
      "closes": [
        ["2026-10-28", 512.3],
        ["2026-10-29", 515.1]
      ]
    },
    "XAU": { "currency": "EUR", "unit": "troy-oz", "source": "frankfurter", "closes": [["2026-10-29", 3590.0]] },
    "FX:USD": { "base": "EUR", "source": "ecb", "closes": [["2026-10-29", 1.1]] }
  },
  "manual": {
    "HRXXXXXXXXXX:FUND": [["2026-09-30", 10.1234, "statement"]]
  }
}
```

(Made-up figures.) Store closes only, with no OHLC or volume, and only on trading days. Thirty instruments × 252 days × about 20 bytes is about 150 KB a year, so no compression is needed for years. If it ever grows, thin closes older than two years to month-end.

Keep manual prices in their own list so a later automatic series never overwrites them. Prefer an automatic close over a manual one for the same date. Bonds store the clean price in percent, and Kuna adds accrued interest when valuing.

### Missing or late prices

- Value with the latest close on or before the valuation date, and always show that close's date next to the value.
- Mark a price stale when its date is older than the instrument's last expected trading day. A simple rule that is good enough: for listings, older than the previous weekday, with exchange holidays tolerated by allowing three weekdays. For crypto, older than yesterday UTC. For manual NAVs, older than 35 days.
- Stale prices still count in totals, but the total shows "includes N stale prices" and each row shows its date. An instrument that has never had a price shows its cost basis with an "unpriced" label, and totals say they are incomplete.
- ZSE hands over the date of the last trade (`trade_date`) separately from the list date. Store the trade date as the price date. An illiquid bond then reads as stale honestly.
- On a failed fetch, keep everything and retry the next day. The job logs which sources failed. Nothing is deleted.

## Sources whose terms rule out this use or limit it

- **Yahoo Finance:** forbids automated collection without permission. The unofficial endpoint was also rate-limiting this machine.
- **Stooq:** now requires a captcha-issued key and a JavaScript check. Not usable unattended.
- **FMP:** display needs a separate licensing agreement, and non-US data costs money.
- **Tiingo:** personal use only. You "may not display or share the data", which is fine for the owner alone. It would rule out sharing a portfolio view.
- **Marketstack and Finnhub** are non-commercial or personal, and **Massive** is "Individual use only". All fine for the owner.
- **ZSE:** website content is for "personal non-commercial use only", with no redistribution. Fine for the owner's own tracking. Never republish ZSE prices in a public file.
- **CoinGecko** Demo requires attribution. Put a "Crypto prices by CoinGecko" line in the app's About or data-source note.
- **ECB:** rates are "for information purposes only". Fine for valuation, not for tax conversions where HNB applies.
