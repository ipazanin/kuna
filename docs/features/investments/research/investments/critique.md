# Investments plan: an independent critique

A skeptical check of the investments plan against the five lanes, Kuna at 210875f, the valore clone, the owner's export folder (structure only), the law and live requests to the price sources, as a list of findings with severity, evidence and a fix.

A critique of [the investments plan](../../plan.md), checked on 30 Oct 2026 against lane 1, [lane 2](lane2-kuna-fit.md), [lane 3](lane3-maths-and-tax.md), [lane 4](lane4-price-data.md), [lane 5](lane5-design.md), Kuna at HEAD `210875f` (read with `git show HEAD:`, since another agent has five files modified in the working tree), valore at `6e2fd62`, and the owner's portfolio folder. The folder was read for structure only: column names and row kinds. No quantity, price, amount, date of a trade or account number from it is in this file. Every example figure is made up. My recomputations ran in a scratch script.

## The short version

The arithmetic holds. Every worked figure in the plan reproduces, the tax articles say what the plan says, and the code seam and the CSP claims match HEAD. The plan's trouble is its input. Since the lanes ran, the owner put a consolidated workbook, a Revolut statement and Interactive Brokers activity statements beside the Yahoo export. The owner's own workbook marks many Yahoo rows as real errors, and it holds 17 kinds of transaction where the plan stores six. The roadmap entry already says the workbook becomes the first import format. So the import stage, the record set and decision 2 are built for data the owner has moved past.

- **Critical (4):** the import is built on the Yahoo file instead of the owner's workbook. The six record kinds cannot hold deposits, transfers, FX conversions, fees, withholding rows or the spin-off the owner's history contains. Decision 2 rests on facts that are no longer true, and its recommended option double counts every currency conversion. The time-weighted return and the benchmark break under a trades-only model and a thinned price file.
- **Concern (14):** bond cost is a hundred times too large and leaves out accrued interest. Fee splits do not add up. Split ratios cannot hold 1-for-3. "Last day" counts months of an illiquid price as one day. The tax rate is the wrong day's. The job has untested runtime and Drive assumptions. Drive does not shield the file from the shared origin. A good third of stages 4 to 6 serves holdings the owner does not have. Some stages are out of order or not provable as written.

## What holds up

- **Every worked figure reproduces.** Portfolio: value €2,651.79, total gain €403.83, 16.1% on €2,507.33, XIRR 9.89% a year, last day +€18.25 (+0.69%), Stock B price part +€106.47 and currency part −€44.68. Lane 3: FIFO €347.50 against average cost €297.50, €298.33 tax-free and €49.17 taxable, €5.90 of tax, the FX example €90.91 = +€166.67 − €75.76, TWR +4.5% against XIRR −7.4%, YTM 3.63%, accrued €15.12, T-bill 2.57%, drawdown −25%, volatility 6.48% (sample standard deviation, n − 1), and 500.00 USD at 1.10 = €454.55.
- **The tax facts are right** on zakon.hr's consolidated text ("na snazi od 01.01.2025."), loaded 30 Oct 2026: 12% and the February deadline (Art. 70(4)), FIFO register (70(5)), register in the acquisition currency (70(6)), splits not a disposal (67(4)(3)), Croatian state debt outside (67(4)(6)), two years (67(8)), losses in the same year only (67(11)), bond interest not income (65(2)(4)), HNB middle rate on the day of payment (12(8)). Porezna uprava's notice of 13 Jan 2026 moved 28 Feb 2026 to 2 March 2026 because it was "neradni dan". ZUP Art. 81(2) says a deadline on a Sunday ends "prvoga sljedećega radnog dana", and 28 Feb 2027 is a Sunday, so 1 March 2027 is well supported, though Porezna's own 2027 notice is still to come.
- **The price claims I could test hold.** ECB answered with `access-control-allow-origin: *` and gave 44 series in one call for `D..EUR.SP00.A`. Frankfurter v2 gave XAU 0.0002766 per euro (about €3,615 an ounce as 1 ÷ rate) and a 2015 value. CoinGecko keyless gave 366 daily points and refused 400 days with "limited to querying historical data within the past 365 days". Binance gave BTCEUR from January 2020 (from this machine). ZSE's list gave 116 securities and no CORS header. Tiingo answered 403 with no CORS header and its pre-flight carried none either. Alpha Vantage's documentation describes `TIME_SERIES_MONTHLY` as "covering 25+ years" with no premium tag, and the demo key returned 323 IBM months from 1999-12-31. Tiingo's pricing page says 50 an hour, 1,000 a day, 500 symbols a month, "Internal use".
- **CSP and the seam match HEAD.** `index.html:7` allows only Google hosts in `connect-src`, and the prices file arrives through `www.googleapis.com`, so the recommended shape needs no CSP change. `pageWorkbookStore(app, document, pickFileTitle)` (`pageWorkbookStore.ts:17`), `documentName` gives `kuna-<app>.json` (`driveDocument.ts:42-44`), 100 kept revisions and 30 daily backups (`:33-35`), stored fields keep their text (`storedFields.ts:55-62`), sync runs only for Drive files (`pageSync.ts:106`), `HomeAmount` is cents only (`appContribution.ts:19-22`), and `markLine` and `markPoint` are registered (`echarts.ts:18`). SheetJS reads a CSV with `raw: true` (`src/shared/xlsx/sheetGrids.ts:50`), so imported decimals stay text, as the plan needs.

## Findings

### 1. The import is built on the wrong file

- **Severity:** critical.
- **Where:** "What you will see, Import", "Import", stages 9 and 13, "Risks, The Yahoo file is not the whole truth", decision 2.
- **What is wrong:** the plan makes the Yahoo export the backfill and asks which account held which lots by a cut-over date. The owner has since produced better sources, and the roadmap already plans for them.
- **Evidence:** the portfolio folder now holds `portfolio-transactions.xlsx` (sheets Transactions, Yahoo Corrections, Open Items, Checks), a Revolut trading statement CSV and IBKR activity statements. The workbook's Transactions sheet merges the brokers' rows, with Broker, Account, ISIN, quantity and price both as executed and split-adjusted, currency, commission, FX counter currency and amount, Revolut's FX rate, split factor and source file. Its Yahoo Corrections sheet marks each row "Real error" Yes or No. Both brokers have recent buys, so a single cut-over date from one broker to the other is wrong. The roadmap already says a follow-up pass "makes the workbook the first import format, then Interactive Brokers and Revolut".
- **Fix:** make the workbook the first import, keyed on broker, source file and its row facts. Drop the account cut-over question, since every row names its broker. Take executed quantities and prices plus split records, not the split-adjusted columns, so one split model serves all sources. Demote the Yahoo reader to "not planned" and delete its quirks list from the stage proofs.

### 2. The six record kinds cannot hold the owner's history

- **Severity:** critical.
- **Where:** "The records", "Not in this wave", "No Income screen ... Income is entered by hand in this wave, since the Yahoo file has none".
- **What is wrong:** the workbook's Type column has 17 kinds: DIVIDEND 141, BUY 129, DEPOSIT 100, WITHHOLDING TAX 73, SELL 37, FEE 37, TRANSFER IN 27, TRANSFER OUT 27, FX 24, WITHDRAWAL 9, SPLIT 6, INTERNAL CASH TRANSFER 6, REFERRAL CREDIT 4, INTEREST 3, SPINOFF 1, STOCK YIELD INCOME 1, FEE REFUND 1. The plan stores trade, income, split and price, and defers transfers and standalone fees. Without them the import either drops real money or forces it into the wrong kind.
- **Evidence:** an oversold holding in the Yahoo file is explained by a spin-off. Revolut's statement has a sale of the spun-off shares with no buy of them, and the workbook has a SPINOFF row. The plan would leave that sale waiting for a buy that never existed. Art. 67(4)(2) treats a cashless status change as no disposal and 67(5) keeps the first acquisition value, so the new shares need a cost carved out of the old lot. The IBKR statements carry Dividends and Withholding Tax as separate sections, so a dividend and its tax must be paired. An activity statement can hold "Inter-Company" transfers in, which must not become buys. Custody fees are real costs the total gain would leave out.
- **Fix:** before stage 3, map each of the 17 kinds to a record. Suggested: `cash-movement` (deposit, withdrawal, internal transfer), `transfer` (lots move between accounts with their dates and costs, no gain), `spin-off` (new instrument, the share of cost moved from the parent's lots, the parent's dates kept), `account-fee` (and its refund as a negative fee), income gains `other` for stock yield and referral credits until the accountant names the tax, and the import pairs each WITHHOLDING TAX row with its dividend by broker, symbol and day. Income then imports, so the "entered by hand" line goes.

### 3. Decision 2 rests on stale facts, and its recommended option double counts conversions

- **Severity:** critical.
- **Where:** decision 2, "Each asset kind, Currencies", "Value over time is set against the cost of what you held".
- **What is wrong:** the cost given for keeping cash is every deposit and withdrawal entered by hand from the monthly PDFs. The workbook and Revolut's CSV already hold the deposits, top-ups and withdrawals. Meanwhile the recommended "trades only" option says "Exchanging €1,000 into dollars is a buy of US dollars", while a later USD share buy is a fresh euro outflow at its rate. Nothing links the two, so the dollars stay in the value after they are spent.
- **Evidence (made up):** exchange €1,000 into $1,100, recorded as a buy of 1,100 USD. Buy 10 shares at $110 at 1.10. Kuna shows $1,100 of dollars (€1,000) plus €1,000 of shares, and €2,000 bought, while the account holds €1,000 of shares. The owner's workbook has 24 FX rows.
- **Fix:** reframe the decision with today's facts: cash per account is now mostly an import, not typing. Recommend cash per account, with FX rows as one record that moves two balances. If the owner still picks trades only, the import must skip FX rows and say so, and the Currencies class holds only money kept outside any trade.

### 4. Time-weighted return and the benchmark break under the plan's own choices

- **Severity:** critical.
- **Where:** "Time-weighted return is chained monthly Modified Dietz", "The figures, Benchmark", "Price history lives in its own Drive file ... the last close of each month before that", stage 11.
- **What is wrong:** under trades only, every sale and buy is an external flow. Monthly Modified Dietz assumes flows are small next to the month's value, and a sell-then-rebuy inside a month breaks it. The benchmark replays flows "at its closes" on the flow days, but closes older than 400 days are thinned to month ends. And replaying a sale larger than the benchmark holding leaves negative units.
- **Evidence (made up):** €1,000 at the start of a 31-day month, all sold on day 1 for €1,000, €1,000 of another fund bought on day 30, worth €1,010 at month end. Modified Dietz gives 10 ÷ (1,000 − 1,000 × 30/31 + 1,000 × 1/31) = 15.5% for a month whose true time-weighted return is about 1%. Benchmark: €10,000 at 100 buys 100 units, a later €16,000 sale at 130 needs 123.08 units and leaves −23.08. The owner's workbook has 37 sells. The "Flows" sentence also gives buys as "out", which is the investor's sign, while Modified Dietz needs flows into the portfolio, so the spec has the sign backwards for TWR.
- **Fix:** with cash per account (finding 3), external flows are only deposits and withdrawals and both problems shrink. Either way, the job keeps every close on a flow day for every instrument and for the benchmark (it reads the trade dates from the Investments file), value is computed exactly at each flow day, and TWR chains those sub-periods. Say what a benchmark sale does past zero units (it sells what is there and the rest stays as benchmark cash). Give `tests/timeWeightedReturn.spec.ts` month-end values and state the flow weight convention, since lane 3's example has three values, not twelve.

### 5. A bond's cost is a hundred times too large and misses accrued interest

- **Severity:** concern.
- **Where:** "Cost includes fees everywhere ... price × quantity + fees", "Bonds held directly", the `trade` and `income` kinds.
- **What is wrong:** a `percent` instrument stores nominal as quantity and price in % of nominal, yet the lot cost is `quantity × price + fees`. The buyer also pays accrued interest, and no field records it. Without it the first coupon counts in full as income, though part of it repays what was paid at purchase.
- **Evidence (made up):** €1,000 nominal at 98.50 gives a lot cost of 98,500 instead of €985.00. With €15.12 accrued paid, the plan's own example says €1,000.12 changed hands, and the next €30 coupon is €15.12 of repayment and €14.88 of income. Accrued interest also runs to the settlement day, usually two working days after the trade, not the trade day.
- **Fix:** cost = quantity × price ÷ 100 for `percent`, plus an optional `accrued` on the trade that joins the cost and is netted from the next coupon. The owner's files hold no bond, so bonds can wait a wave (finding 13).

### 6. Fee and proceeds splits do not add up

- **Severity:** concern.
- **Where:** "Cost includes fees everywhere".
- **What is wrong:** the remainder rule covers a lot's cost only. A sale's fee and proceeds split by quantity across lots are each rounded to cents with no rule, so the parts can miss the whole.
- **Evidence (made up):** a €1.00 fee over three one-unit lots is €0.33 three times, €0.99.
- **Fix:** one rule for every split: round each part, give the last lot the remainder.

### 7. A split ratio as one decimal cannot hold 1-for-3

- **Severity:** concern.
- **Where:** the `split` kind, "`ratio` (new units for one old, such as `4` or `0.1`)".
- **Evidence (made up):** 300 units after a 1-for-3 reverse split are 300 × 0.333333333333 = 99.9999999999 units, and the holding never closes to zero on a full sale. Revolut's statement and the workbook both carry STOCK SPLIT rows, not always the same ones, and the Open Items sheet names some splits as unresolved.
- **Fix:** store `new` and `old` as whole numbers and multiply then divide.

### 8. "Last day" counts months of an illiquid price as one day

- **Severity:** concern.
- **Where:** "'Last day', never 'Today'", the Last day row of the figures table.
- **What is wrong:** "the last close against the one before" per holding means a holding that did not trade for months shows its whole move on the day it trades.
- **Evidence (made up):** a bond last traded at 98.00 in February trades at 101.00 on 29 Oct, and €10,000 nominal adds +€300 to "Last day". ZSE's 29 Oct list has 48 of 116 lines whose last trade is before that day.
- **Fix:** last day = portfolio value as of the last close date D (each holding at its latest close on or before D) minus the same as of the trading day before D. A stale price then adds nothing.

### 9. The rate stored on a trade is the wrong day's rate for tax

- **Severity:** concern.
- **Where:** "Every foreign trade and income stores its rate ... from the ECB rate of the day", decision 3, stage 12.
- **What is wrong:** Art. 12(8) converts at the HNB middle rate "na dan isplate", and HNB applies the ECB rate of the previous working day.
- **Evidence:** HNB's API for USD gave 1.1193, 1.1188, 1.1150, 1.1133 and 1.1130 for application dates 26 to 30 Oct 2026. ECB's own series gave 1.1193 on 23 Oct, 1.1188 on 26, 1.1150 on 27, 1.1133 on 28 and 1.1130 on 29 Oct. The plan stores the same-day ECB rate, or the broker's.
- **Fix:** the Tax stage reads the ECB series one working day back for every leg and never uses `trade.rate`. Say so in the plan, so nobody reuses the stored rate for JOPPD.

### 10. The price/currency split is undefined in two cases

- **Severity:** concern.
- **Where:** "Currencies ... priced at 1 ÷ the ECB rate", "Each trade names its own currency, so a fund bought on two venues still adds up", the price and currency parts row.
- **What is wrong:** a currency priced in euros at 1 ÷ rate puts its whole FX gain in the "price" part. And the price part q × (p₁ − p₀) ÷ x₁ subtracts a cost per unit in the trade currency from a close in the quote currency, which is meaningless when they differ.
- **Evidence:** a broker can book one fund under one symbol one year and a new symbol the next, and an Amsterdam listing can trade in USD. Today each instrument's trades share one currency, but the plan claims the mixed case works.
- **Fix:** a currency instrument is quoted in its own currency at a price of 1, so its gain is all currency. Refuse a trade whose currency differs from the instrument's quote currency until the split is defined for it.

### 11. The daily job leans on untested runtime and Drive behaviour

- **Severity:** concern.
- **Where:** "The job", stage 6.
- **What is wrong:** the job bundles Kuna's own document reader into Apps Script. That reader would parse decimals into `bigint` and check currencies with `Intl.supportedValuesOf`. Google's V8 runtime pages do not say whether either exists there (unconfirmed, searched 30 Oct 2026). `getFilesByName` matches any file with the name, and whether it includes trashed files is not stated on its reference page (unconfirmed). `File.setContent` "Throws an exception if content is larger than 10MB" and needs the full `https://www.googleapis.com/auth/drive` scope (Apps Script reference, loaded 30 Oct 2026), so the script holds full access to the owner's Drive. The privacy page change does not mention that.
- **Fix:** a ten-line spike in Apps Script before stage 6 (`typeof 1n`, `Intl.supportedValuesOf`). Give the job the two file ids as script properties at setup, which also removes the name search. Have the job read only the fields it needs (instrument source and symbol, currencies, trade dates) rather than running the full reader. Name the full Drive scope in the README and on the privacy page.

### 12. The first import cannot get its rates on the same day

- **Severity:** concern.
- **Where:** "Import, Rates", "The job" step 3.
- **What is wrong:** the import holds back any foreign row whose day the prices file's ECB series lacks, and the job fetches series only for currencies an instrument or trade already names. Before the first import nothing names USD, so all USD rows wait for tomorrow's run. The plan does not say whether instruments are written before their rows wait.
- **Fix:** the job always fetches the full history of a short fixed list (USD, GBP, CHF) plus any currency the file names, and the README tells the owner to run the job once from the editor after setup. Revolut rows can also use their own FX Rate column.

### 13. A good part of stages 4 to 6 serves holdings the owner does not have

- **Severity:** concern.
- **Where:** "Each asset kind", the source table, stages 4, 6, 11 and 12.
- **What is wrong:** the owner's files hold only EUR and USD rows and only listed shares and ETFs. There is no Zagreb line, bond, money market fund, crypto or gold. Yet the job ships ZSE, CoinGecko, Binance and Frankfurter gold providers with backfills, and stage 4 builds accrued interest. Binance's API is widely reported to refuse requests from US addresses, which Google's servers often use (unconfirmed, I could test only from Croatia). ZSE's list also has four lines quoted in "% HRK" today and lines with no `trade_date`, which the plan's ZSE notes do not cover.
- **Fix:** first version: Tiingo, Alpha Vantage, ECB and hand prices, stocks and ETFs, currencies as cash, and every other class held by hand price until the owner enters the first such holding. Add each provider in the wave that brings its first holding. Move Performance's drawdown and volatility, the Movers card and split offers after the owner has used the Overview. Keep the six classes in the record so nothing migrates later.

### 14. The IBKR stage assumes a format the owner did not download

- **Severity:** concern.
- **Where:** "Then, in order ... IBKR Activity Flex Query", stage 13.
- **What is wrong:** the files are Activity Statements in CSV, with sections such as Trades, Transfers, Deposits & Withdrawals, Dividends, Withholding Tax, Interest, Fees, Forex Balances and Financial Instrument Information. Their Trades columns are `DataDiscriminator, Asset Category, Currency, Symbol, Date/Time, Quantity, T. Price, C. Price, Proceeds, Comm/Fee, Basis, Realized P/L, MTM P/L, Code`, with no trade id and no ISIN. The ISIN sits in Financial Instrument Information as Security ID, beside Listing Exch. Forex conversions appear as Trades rows with Asset Category Forex. The key `ibkr | trade id` cannot be built.
- **Fix:** read the Activity Statement, join the ISIN by symbol and file, key trades by their facts plus a count as Company's import does, skip Transfers in from "Inter-Company", and map Forex rows to the FX record of finding 3. Or ask the owner for one Flex file if the owner prefers trade ids. Since the workbook already merges these files, decide whether Kuna needs a separate IBKR reader before the next statement at all.

### 15. Drive does not protect the file from the shared origin

- **Severity:** concern.
- **Where:** "Risks, Shared origin".
- **What is wrong:** the risk says a browser-kept file is readable by any page on `ipazanin.github.io`, "Drive is the recommended home". A Drive-kept file is also kept whole in this browser.
- **Evidence:** `workbookCache.ts:18-19` names an IndexedDB database `kuna-workbook-<id>` per workbook, and the plan itself caches the prices file "in its own Dexie table, as `workbookCache.ts` keeps the books".
- **Fix:** reword the risk: any script on the origin can read the holdings, wherever the file lives. The real defences are keeping every project site on that origin free of third-party scripts, or serving Kuna from its own origin (a custom domain for the repo).

### 16. Stages out of order or not provable as written

- **Severity:** concern.
- **Where:** "Stages".
- **What is wrong:**
  - Getting the Tiingo and Alpha Vantage keys gates stage 1, which needs no price. It belongs before stage 5.
  - Stage 4 says "every figure in the table", which includes the time-weighted return, benchmark, largest fall and volatility that stage 11 builds.
  - Stage 5 has "split offers", a prompt with no screen until stage 7.
  - Stage 2 reshapes Loans' and Company's first runs, which language stage 2 translates ("the first runs", [the language plan](../../../platform/language-plan.md)). Done in the wrong order, one of the two rewrites the other's work.
  - Stage 7 is "proved by the visual pages against the mockup", but the visual check tests titles, text and layout rules, not likeness to a mockup. That proof is a reviewer's call.
- **Fix:** move the keys, keep stage 4 to the figures it uses, move split offers to stage 7, run stage 2 after language stage 2 or merge them, and name stage 7's proof as the visual pages' expected text plus a reviewer's sign-off.

### 17. The Yahoo duplicate key can miss a re-adjusted lot

- **Severity:** concern, and moot if finding 1's fix drops the Yahoo import.
- **Where:** "Import, The key".
- **Evidence (made up):** 100 units at $100.01 are $10,001.00. Re-adjusted for a 3-for-1 split and rounded to four places, 300 units at $33.3367 are $10,001.01, and `round(quantity × price, 2)` differs. Whether Yahoo rounds re-adjusted prices to four places is unconfirmed. The export does carry prices with up to four places.
- **Fix:** compare the value within a cent per original unit, as the plan already does for IBKR pairing, instead of hashing it.

### 18. Smaller points

- **Severity:** concern.
- The pre-push grep "for every symbol of the real export" needs that list somewhere. It must live outside the repo, and common tickers will match the made-up fixtures. Keep the list in a private scratch folder and grep for figures from the real files as well, not only symbols.
- `documentRecordStorage.ts:108-111` refuses a write to a file saved by a newer app. It does not show that an older app keeps kinds it does not know. That behaviour lives in `changedDocument` copying every kind's records, so cite that.
- Volatility should name the sample standard deviation. Lane 3's 6.5% uses n − 1, and n gives 5.9%.
- Frankfurter's XAU rate has four significant figures (0.0002766), about €0.65 an ounce of rounding. That is fine for value, but say so beside a gram figure.

## What the plan misses from the owner's folder

Most of it sits in findings 1 to 3. In one place:

- The consolidated workbook as the source of record, with its own Yahoo Corrections, Open Items (the spin-off's cost, commissions worked out from totals, dividends booked net, unconfirmed cash, splits) and Checks sheets. Its Open Items are the import's first questions.
- 141 dividend and 73 withholding rows, so income need not be typed.
- Deposits and withdrawals for both brokers, so the % can rest on money put in.
- Transfers, FX conversions, custody fees, a spin-off, referral credits, stock yield income and interest.
- Two brokers active at once, so accounts come from the rows, not a date.

The folder also holds `yahoo-portfolio-import.csv`, written at 08:15 with Yahoo's 17 columns. I read only its header and did not work out who made it or why.

## Sources checked, 30 Oct 2026

- Zakon o porezu na dohodak, consolidated, [zakon.hr](https://www.zakon.hr/z/85/Zakon-o-porezu-na-dohodak), Articles 12, 65, 67 and 70 read in full.
- Zakon o općem upravnom postupku, [zakon.hr](https://www.zakon.hr/z/65/Zakon-o-op%C4%87em-upravnom-postupku), Art. 81(2).
- Porezna uprava, [Oporezivanje kapitalnih dobitaka i izvješćivanje putem Obrasca JOPPD](https://porezna-uprava.gov.hr/hr/oporezivanje-kapitalnih-dobitaka-i-izvjescivanje-putem-obrasca-joppd-8281/8281), the 2 March 2026 deadline and 12%.
- Live requests: ECB `data-api.ecb.europa.eu` (`D.USD.EUR.SP00.A` and `D..EUR.SP00.A`), HNB `api.hnb.hr/tecajn-eur/v3` per application date, Frankfurter `v2/rates?quotes=xau` and `v2/providers/ecb/rates`, CoinGecko `market_chart` for 365 and 400 days, Binance `klines` BTCEUR from 2020, ZSE `price-list/XZAG/2026-10-29/json`, Tiingo with a bad token and a pre-flight, Alpha Vantage `TIME_SERIES_MONTHLY` with the demo key. All with `Origin: https://ipazanin.github.io`.
- [Alpha Vantage documentation](https://www.alphavantage.co/documentation/), [Tiingo pricing](https://www.tiingo.com/about/pricing), [Tiingo end-of-day documentation](https://www.tiingo.com/documentation/end-of-day) (`divCash` and `splitFactor` per day, which could also suggest dividends and splits for US holdings).
- Apps Script reference for [DriveApp](https://developers.google.com/apps-script/reference/drive/drive-app) and [File](https://developers.google.com/apps-script/reference/drive/file). BigInt and `Intl.supportedValuesOf` in Apps Script V8: unconfirmed.
- Binance refusing US addresses: unconfirmed, not tested from a US or Google address.
- Kuna at `210875f`: the files named above, `src/shared/xlsx/sheetGrids.ts`, `src/shared/storage/infrastructure/workbookCache.ts`, `src/shared/storage/infrastructure/documentRecordStorage.ts`, `tests/recordStorageContract.spec.ts`, `tests/fixtures/writeBack.ts`, `tests/importBoundaries.spec.ts`, `tests/tokenContrast.spec.ts`, `src/shared/styles/tokens.css`, `src/main.ts`. valore at `6e2fd62`: `docs/plan.md:176-178`, `:208`, `decimal.ts`, `calculations.ts`.
