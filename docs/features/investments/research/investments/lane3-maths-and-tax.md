# Investments lane 3: the maths, the metrics and Croatian tax

How Kuna turns buy, sell, income and currency transactions into holdings and gains, which metrics an investor needs with formulas and made-up worked examples, how currency moves split from price moves, how each asset kind behaves, and Croatian tax on capital income for 2026 checked against the law and Porezna uprava.

Read-only research, 2026-10-30. Every web source was downloaded into a scratch folder and searched there, or fetched and quoted, on 2026-10-30. Anything I could not confirm says so. Kuna is cited against `HEAD` at `210875f`, because another agent is editing its working tree. Valore is cited against its shallow clone at `6e2fd62`. The owner's Yahoo export (`portfolio.csv`) was read for its structure only. Every figure in this file is made up, apart from public rates and thresholds.

## The short version

- **Store transactions, derive everything else.** A holding is the sum of its lots. Each buy opens a lot with its date, quantity, price, fees and the euro rate of that day. A sell closes lots in order. Value, gains, income, allocation and tax all come from that one list plus daily prices and daily euro rates.
- **FIFO, one way, everywhere.** Croatian law requires the taxpayer to keep a FIFO register of each kind of financial asset (ZPDoh Art. 70(5)). If Kuna uses FIFO for every realised gain on screen too, the app and the tax report never disagree. "Average price paid" can still be shown, as the cost of the lots still open divided by their quantity.
- **The first screen needs six figures:** value, total gain in euros, total gain as an annual rate (money-weighted, XIRR), the change since the previous close, income received this year, and allocation by asset kind. Everything else belongs one tap deeper.
- **Total gain in % on its own misleads.** "Gain ÷ money put in" ignores when the money went in. The worked example below shows a year with a time-weighted return of +4.5% and a money-weighted return of −7.4% on the same account. Kuna should show the money-weighted rate as "your return" and the time-weighted one beside a benchmark.
- **Split each foreign holding's gain into price and currency.** A USD share can rise 20% in dollars and still earn little in euros. The split needs the euro rate on the buy date and today.
- **Euro rates: one ECB series serves both jobs.** The ECB publishes reference rates around 16:00 CET each working day. The law converts foreign-currency income at the HNB middle rate on the day of payment (Art. 12(8)). HNB's own API shows that the rate HNB applies on a day is the ECB rate of the previous working day (checked for USD, 26 to 30 October 2026). So Kuna can store one ECB series and look one working day back for tax.
- **Croatian tax in 2026, the essentials:**
  - Capital gains on shares, ETFs, funds, foreign bonds and crypto are taxed at **12%**, and only when the asset is sold within **two years** of buying it (Art. 67(8), Art. 70(4)).
  - Losses offset gains only within the **same calendar year**, with fees counted (Art. 67(11)). There is no carry-forward.
  - The taxpayer works out, reports (Obrazac JOPPD) and pays the tax on a year's gains by the **last day of February** of the next year (Art. 70(4)). For 2025 gains that was 2 March 2026, because 28 February fell on a Saturday. Gains realised through a foreign broker always go on your own JOPPD.
  - Dividends and interest are **12%**. Croatian payers withhold it. For income paid from abroad you pay it yourself within 30 days, or, when tax was already withheld abroad, you notify Porezna uprava and report it on INO-DOH by 31 January (Art. 81).
  - **Bond interest is not taxable at all**, from any issuer, and Croatian government bonds and treasury bills are outside capital gains too (Art. 65(2)(4), Art. 67(4)(6)).
  - Porezna uprava treats crypto gains as capital gains. A crypto-to-crypto swap is not a disposal, and since 6 February 2026 it asks for a JOPPD even when the gain is tax-free after two years.
- **What Kuna can prepare:** the FIFO register in the columns Porezna's own example uses, a year sheet with taxable gains, tax-free gains and losses, the figures to type into JOPPD, a list of foreign dividends with the tax withheld for INO-DOH, and a "tax-free from" date on every open lot.
- **Four questions for the owner or the owner's accountant** sit at the end. The biggest: whether a USD share's gain is converted to euros leg by leg or as one dollar figure on the sale date. In the worked example the two readings give €1.81 and €4.96 of tax on the same sale.

## 1. Holdings from transactions

### The transaction kinds

Each row changes up to three things: a quantity of an asset, a cash balance in some currency, and the cost basis (what the open lots cost).

| Kind                          | Asset quantity                     | Cash                                         | Cost basis                                 | Tax meaning                                                                |
| ----------------------------- | ---------------------------------- | -------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------- |
| Buy                           | + units                            | − price × units − fee, in the trade currency | new lot at price × units + fee             | starts the two-year clock for that lot                                     |
| Sell                          | − units                            | + price × units − fee                        | closes lots, oldest first                  | realised gain or loss, taxable within two years                            |
| Dividend                      | none                               | + net amount (gross − tax withheld abroad)   | none                                       | 12% capital income, see section 5                                          |
| Coupon                        | none                               | + coupon                                     | none                                       | bond interest is not income in Croatia                                     |
| Interest on cash              | none                               | + net interest                               | none                                       | 12%, withheld by a Croatian bank                                           |
| Fee (custody, account)        | none                               | − fee                                        | none                                       | counts toward a capital loss only when charged to a disposal (Art. 67(11)) |
| Split or reverse split        | × ratio                            | none                                         | unchanged in total, per unit ÷ ratio       | not a disposal (Art. 67(4)(3))                                             |
| Merger or share swap, no cash | old units out, new units in        | none                                         | carries over, first acquisition date kept  | not a disposal (Art. 67(4)(2), 67(5))                                      |
| Transfer between own accounts | out of one account, into the other | none, or a transfer fee                      | lots move with their dates and costs       | not a disposal, same owner                                                 |
| Gift given                    | − units                            | none                                         | lots close at market value                 | a disposal (Art. 67(3)), tax-free only to close family                     |
| Gift received                 | + units                            | none                                         | the giver's lot dates and costs            | the giver's acquisition date counts (Art. 67(9))                           |
| Deposit or withdrawal         | none                               | ± amount                                     | none                                       | an external flow for return maths, not income                              |
| Currency exchange             | none                               | − EUR, + USD (or the reverse)                | the new currency cash gets a cost in euros | not a sale of financial assets (see section 5)                             |
| Crypto fee paid in coins      | − a few units                      | none                                         | lot cost unchanged, cost per unit rises    | treatment of the fee coins unconfirmed                                     |

Two rules keep the maths simple. Cash is a holding like any other, one per currency per account, so a USD balance has a quantity (dollars) and a cost in euros. And every transaction stores its euro rate for its date, so a later rate change never rewrites history.

### FIFO and average cost

**FIFO** (first in, first out) closes the oldest open lot first. **Average cost** pools all lots into one cost per unit. Brokers and Yahoo usually show average cost. Croatian tax uses FIFO: "Porezni obveznik ... obvezan je voditi evidenciju istovrsne financijske imovine po metodi uzastopnih cijena (FIFO)" (ZPDoh Art. 70(5)).

Worked example, one ETF in euros:

| Date        | Row                                               |
| ----------- | ------------------------------------------------- |
| 15 Jan 2024 | buy 10 at €100.00, fee €1.00, lot cost €1,001.00  |
| 10 Jun 2025 | buy 10 at €120.00, fee €1.00, lot cost €1,201.00  |
| 2 Mar 2026  | sell 15 at €130.00, fee €1.00, proceeds €1,949.00 |

- **FIFO:** the sale closes all of lot 1 (€1,001.00) and half of lot 2 (€600.50). Cost €1,601.50, gain **€347.50**. Five units stay open at €600.50, €120.10 each.
- **Average cost:** €2,202.00 ÷ 20 = €110.10 a unit. Cost of 15 is €1,651.50, gain **€297.50**. Five units stay open at €550.50.

Over the life of a holding both methods give the same total gain. They differ in which year it lands, and FIFO decides which lots are past the two-year mark:

- Lot 1 was bought more than two years before the sale. Its gain, €1,300.00 − €0.67 of the sale fee − €1,001.00 = **€298.33, is tax-free**.
- Lot 2's five units were held under a year. Their gain, €650.00 − €0.33 − €600.50 = **€49.17, is taxable**. Tax 12% = **€5.90**.

So FIFO usually helps a long-term holder: the oldest, tax-free lots go first.

**Recommendation:** FIFO for every realised gain Kuna shows, and the sale fee split across closed lots by quantity. Show "average price paid" for the open lots only, computed from the FIFO lots that remain. That is one method, with two views of it.

Open point, my reading: the register is kept per "istovrsna" (same kind of) financial asset, not per account. So the same ETF held at two brokers would form one FIFO queue for tax, while each broker's own statement would run FIFO per account. Unconfirmed.

### Corporate actions, transfers and gifts

- **Splits** change the unit count and the price per unit, never the cost. Yahoo's export already shows pre-split trades in post-split units (see section 6), so an import must not apply a split a second time.
- **Mergers and swaps without cash** keep the first acquisition date and value (Art. 67(5)), so the two-year clock does not restart.
- **Transfers** between the owner's own accounts keep lots, dates and costs. A transfer fee is a cost of the account, not a sale.
- **Gifts given** are a disposal at market value (Art. 67(3)). A gift to a spouse, child or parent is tax-free (Art. 67(8)). A gift to anyone else within two years is taxed as a sale.
- **Gifts received** inherit the giver's acquisition date when sold within two years of it (Art. 67(9)).

### Number types

Kuna's `Money` is a whole number of cents in a JavaScript number (`src/shared/money/money.ts:5`). That stays right for euro amounts. Quantities and unit prices need more: fractional shares in the export carry six decimals, crypto quantities run to eight decimals and beyond, and FX rates have four or more. Valore stores decimal strings and uses decimal.js, with at most 12 decimal places (`src/features/portfolio/domain/decimal.ts:5`). Kuna needs a decimal quantity type of its own, and every euro figure should be rounded to cents only at the edge where it becomes `Money`.

## 2. The metrics

### The worked example portfolio

All figures are made up. The base currency is EUR. "Today" is 29 October 2026.

| Date        | Row                                                                 | Euro rate (USD per EUR) |
| ----------- | ------------------------------------------------------------------- | ----------------------- |
| 2 Jan 2025  | deposit €3,000.00 to the broker                                     |                         |
| 2 Jan 2025  | buy 10 World ETF at €100.00, fee €2.00                              |                         |
| 3 Mar 2025  | exchange €1,000.00 to $1,050.00                                     | 1.05                    |
| 3 Mar 2025  | buy 20 Stock B at $50.00, fee $1.00                                 | 1.05                    |
| 1 Jul 2025  | buy 5 World ETF at €110.00, fee €2.00                               |                         |
| 15 Sep 2025 | Stock B dividend $10.00 gross, $3.00 withheld in the US, $7.00 paid | 1.17                    |
| 2 Feb 2026  | sell 5 Stock B at $60.00, fee $1.00, $299.00 paid                   | 1.18                    |
| 29 Oct 2026 | prices: World ETF €125.00, Stock B $58.00                           | 1.12                    |
| 28 Oct 2026 | previous close: World ETF €124.00, Stock B $57.50                   | 1.115                   |

What is held today:

| Holding   | Quantity | Value             | Cost of open lots | Unrealised gain |
| --------- | -------- | ----------------- | ----------------- | --------------- |
| World ETF | 15       | €1,875.00         | €1,554.00         | €321.00         |
| Stock B   | 15       | $870.00 = €776.79 | $750.75 = €715.00 | €61.79          |
| EUR cash  | €446.00  | €446.00           | €446.00           | none            |
| USD cash  | $355.00  | €316.96           | €306.04           | €10.92          |
| **Total** |          | **€3,414.75**     |                   |                 |

Stock B's lot cost $1,001.00 at 1.05, which is €953.33 for 20 shares, so €715.00 for the 15 still held. The USD cash cost is what its dollars cost in euros when they arrived: $49 left from the exchange (€46.67), the $7 dividend (€5.98) and the $299 from the sale (€253.39).

### Each metric

**Portfolio value.** Σ quantity × last price ÷ euro rate of that price's date, cash included.
Example: €3,414.75.
Misleads when a price is stale (a fund that prices weekly, a delisted share) or missing. Show the date of the oldest price used, and mark the total incomplete when a holding has no price, as valore does (`calculations.ts:62-66`).

**Net invested.** Deposits − withdrawals, in euros on their dates.
Example: €3,000.00.
This is the base for "how much have I made". Cost of open lots is a different figure (€1,554.00 + €715.00 = €2,269.00 here). It answers "what did the shares I still hold cost", which is right per holding and wrong for the whole portfolio, because it forgets sold lots and cash.

**Unrealised gain.** Value − cost of open lots, per holding.
Example: World ETF €321.00, Stock B €61.79.
Misleads after a holding is mostly sold: a small open position shows a small gain while the big gain sits in realised.

**Realised gain.** For each sale, proceeds − fee share − FIFO cost of the lots closed, all in euros on their dates.
Example: Stock B, 5 shares: €253.39 − €238.33 = **€15.06**. In dollars the same sale made $299.00 − $250.25 = $48.75. The dollar fell, so most of the gain went (section 3).

**Income.** Dividends, coupons and interest, shown gross, withheld and net.
Example: dividend $10.00 gross = €8.55, withheld $3.00 = €2.56, net **€5.98**.
Show the withheld part. It is real money lost unless Croatian tax can absorb it (section 5).

**Fees paid.** Σ every fee converted on its date.
Example: €2.00 + €2.00 + $1.00 at 1.05 + $1.00 at 1.18 = **€5.80**.
Fees are already inside costs and proceeds, so this is a figure to show, never to subtract a second time.

**Total gain in euros.** Value − net invested, for the portfolio.
Example: €3,414.75 − €3,000.00 = **€414.75**.
It reconciles exactly with its parts: unrealised €321.00 + €61.79, realised €15.06, net income €5.98, currency gain on the USD cash €10.92. Per holding, total gain is unrealised + realised + net income of that holding.

**Total gain in %.** Total gain ÷ net invested.
Example: €414.75 ÷ €3,000.00 = **13.8%**, over 665 days.
Misleads whenever money arrived at different times. Money added last week counts as if it had been there all along, so a big recent deposit drags the % down. It also says nothing about how long it took.

**Money-weighted return (XIRR).** The annual rate r at which the external flows and today's value balance: Σ flowᵢ ÷ (1 + r)^(daysᵢ ÷ 365) = 0, with deposits negative and today's value positive.
Example: −€3,000.00 on 2 Jan 2025, +€3,414.75 on 29 Oct 2026, so r = **7.4% a year**.
This is "how did my money do", including my timing. Only deposits and withdrawals count as flows. Buys, sells and dividends inside the account are not flows. Over less than a year, an annual rate can look extreme, so show "not annualised" or hide it below about three months.

**Time-weighted return (TWR).** Split the period at every external flow, take each piece's return, and chain them: (1 + r₁) × (1 + r₂) × … − 1, where rᵢ = value just before the next flow ÷ value just after the previous flow − 1.
This is "how did the investments do", whatever I added or took out. It is the figure to set against a fund or a benchmark. It needs a value on every flow date, which daily prices give.

Why both are needed, with made-up figures:

| Date        | Event                                        | Value                  |
| ----------- | -------------------------------------------- | ---------------------- |
| 1 Jan 2025  | deposit €1,000.00                            | €1,000.00              |
| 1 Jul 2025  | value has grown 10%, then deposit €10,000.00 | €1,100.00 + €10,000.00 |
| 31 Dec 2025 | value has fallen 5%                          | €10,545.00             |

TWR = 1.10 × 0.95 − 1 = **+4.5%**. The investments did fine. But €11,000.00 went in and €10,545.00 is there, a loss of €455.00, and XIRR = **−7.4%**. Both are true. The big deposit landed just before the fall.

**Annualised return.** (1 + total return)^(365 ÷ days) − 1, for any of the above. XIRR is already annual. A TWR of 10% over two years is 4.9% a year.

**Return against a benchmark.** Replay the portfolio's own external flows into the benchmark on the same days, then compare the end values or XIRRs.
Example: €3,000.00 into a made-up MSCI World accumulating ETF at €100.00 on 2 Jan 2025 buys 30 units. At €118.00 today that is €3,540.00, so the portfolio is **€125.25 behind**, 7.4% against 9.5% a year.
Misleads when the benchmark is a price index without dividends (use an accumulating ETF or a total-return index), or priced in another currency (use the euro listing).

**Change since the previous close** ("today", given data that lags a day). Value at the last close − value at the close before, with today's quantities, so trades of the day do not count as change.
Example: World ETF +€15.00, Stock B +€3.24, USD cash −€1.42 (the dollar fell), total **+€16.82, +0.5%**.
Period changes (this month, this year, 1 year) are the same sum between other dates, minus the net flows between them. Without taking flows out, a deposit shows up as a gain.

**Allocation.** Each slice ÷ value, by asset kind, currency, account and holding.
Example by kind: ETFs 54.9%, shares 22.7%, cash 22.3%. By currency: EUR 68.0%, USD 32.0%.
Allocation by currency should follow the currency of the risk, not of the listing. A euro listing of a world ETF is mostly dollar assets. Kuna cannot know that without fund data, so label it "listing currency".

**Concentration.** The largest holding's share of the invested part (cash left out).
Example: World ETF is €1,875.00 of €2,651.79, **70.7%**.
Misleads for a broad index fund, which is one line but thousands of companies. Show it per holding, and let the owner mark a holding as diversified so the warning stays quiet.

**Maximum drawdown.** The largest fall from a running peak to a later low, on the time-weighted value series.
Example series 100, 120, 90, 110, 130, 104: peak 120 to 90 is −25%, peak 130 to 104 is −20%, so **−25%**.
Run it on TWR index values, not on account value, or a withdrawal looks like a crash.

**Volatility.** The standard deviation of periodic returns, annualised: monthly σ × √12, daily σ × √252.
Example monthly returns +2%, −1%, +3%, −2%, +1%, 0%: σ = 1.87% a month, **6.5% a year**.
Daily data with gaps (holidays on different exchanges, a day lag) adds noise. Monthly returns are steadier for a personal portfolio, and need two years before the figure means much.

### First screen and detail

| First screen                             | Detail (holding or "Performance" view)                     |
| ---------------------------------------- | ---------------------------------------------------------- |
| Value, with the date of the prices       | Net invested, cost of open lots                            |
| Total gain in €                          | Unrealised and realised gain, per holding                  |
| Your return a year (XIRR)                | TWR, annualised, by period                                 |
| Change since the previous close, € and % | Period changes: month, year to date, 1 year, all time      |
| Income this year, net                    | Income by holding, gross and withheld                      |
| Allocation by asset kind                 | Allocation by currency, account and holding, concentration |
|                                          | Fees paid, by year                                         |
|                                          | Benchmark comparison                                       |
|                                          | Maximum drawdown, volatility                               |
|                                          | Price and currency split of each foreign holding           |
|                                          | Tax year sheet (section 5)                                 |

## 3. Currency effects

### Price gain and currency gain

For a holding priced in a foreign currency, with q units, buy price p₀ and buy rate x₀ (units of currency per euro), price p₁ and rate x₁ today:

- Gain in euros = q × p₁ ÷ x₁ − q × p₀ ÷ x₀
- Price part = q × (p₁ − p₀) ÷ x₁
- Currency part = q × p₀ × (1 ÷ x₁ − 1 ÷ x₀)

The two parts add up to the gain exactly. The price part uses today's rate, so the currency part is what the original euro outlay won or lost from the rate alone. That is the convention to pick and label. Splitting the other way round puts a small cross term in the other bucket.

Example: 10 shares bought at $100.00 when €1 = $1.10 cost €909.09. Today they are $120.00 and €1 = $1.20, worth €1,000.00. Gain **€90.91** = price **+€166.67** + currency **−€75.76**. The share rose 20% in dollars, the holding rose 10% in euros.

In the example portfolio, Stock B's €61.79 unrealised gain is +€106.47 from price and −€44.69 from the dollar (the two parts add up to €61.79 before rounding).

Cash in a foreign currency has only the currency part. In the example, the $355.00 of USD cash gained €10.92 since its dollars arrived.

### Which rates, on which day

- **ECB euro reference rates** cover about 30 currencies against the euro. The ECB says they "are usually updated at around 16:00 CET every working day, except on TARGET closing days", are set at a concertation "around 14:10 CET", and "are published for information purposes only" (ECB reference rates page, loaded 2026-10-30). The ECB data API returns them as CSV without a key (`data-api.ecb.europa.eu`, loaded 2026-10-30).
- **The law** converts foreign-currency income "primjenom srednjeg tečaja koji Hrvatska narodna banka objavljuje na dan isplate" (Art. 12(8)).
- **HNB applies the ECB rate one working day later.** HNB's API (`api.hnb.hr/tecajn-eur/v3`) gave USD middle rates 1.1193, 1.1188, 1.1150, 1.1133 and 1.1130 for application dates 26, 27, 28, 29 and 30 October 2026. The ECB's own rates were 1.1193 on 23 October, 1.1188 on 26, 1.1150 on 27, 1.1133 on 28 and 1.1130 on 29 October. Monday the 26th carried Friday's rate. So "the HNB middle rate on the day" is the ECB rate of the previous ECB working day.

**Recommendation:** store one daily ECB series. Value holdings with the ECB rate of the price's own date, so a US close and the euro rate belong to the same day. For tax, use the rate HNB applies on the trade or payment date, which is the ECB rate of the previous working day. Crypto and gold have no ECB rate, so price them in euros directly.

### The open tax question on currency

Art. 70(6) says the register "za financijsku imovinu ostvarenu na inozemnom tržištu može se voditi u valuti stjecanja financijske imovine". That allows two readings for a USD share:

1. **Each leg in euros.** The cost converts at the buy date's rate, the proceeds at the sale date's rate, and the euro difference is the gain. Currency moves are inside the gain.
2. **Gain in dollars, converted once.** The gain is worked out in dollars and converted at the sale date's rate, per Art. 12(8) for income in a foreign currency. Currency moves on the original outlay stay outside.

In the example portfolio's Stock B sale, reading 1 gives €15.06 of gain and **€1.81** of tax. Reading 2 gives $48.75 ÷ 1.18 = €41.31 and **€4.96**. When the dollar rises instead, reading 1 gives the larger figure.

Porezna's 2018 crypto example worked the gain out in dollars and converted the total once, which points to reading 2. But it converted $255,920.80 into 1,922,898.80 kn, a rate of 7.5136, and HNB's middle rate for USD on 18 December 2017 was 6.391296 (EUR was 7.544925). So the example's arithmetic does not settle which rate or which reading applies. **Unconfirmed, for the owner's accountant or a Porezna uprava question.** Kuna should compute both and let the owner pick one in settings.

## 4. Asset kinds

### Shares and ETFs

Quantity, price per unit and listing currency. A share listed on several exchanges is one instrument with several listings, as valore models it (`types.ts`: `Instrument` and `Listing`). Distributing ETFs pay dividends. Accumulating ETFs pay nothing out and grow in price instead. The three EUR ETFs in the export look like accumulating share classes, unconfirmed here. Tax: ETF units are "jedinice u subjektima za zajednička ulaganja", so the two-year capital gains rule applies (Art. 67(2)(3)).

### Bonds

- **Clean price** is the quoted price, as a % of face value. **Accrued interest** is the coupon earned since the last coupon date, which the buyer pays the seller. **Dirty price** = clean + accrued, which is what the cash leg shows.
- Accrued interest = face × coupon rate × days since the last coupon ÷ days in the coupon period (ACT/ACT for most euro government bonds).
- **Yield to maturity** is the XIRR of paying the dirty price today and receiving every remaining coupon and the face value at maturity. The same solver serves XIRR, YTM and the loans app's EKS.
- Value in the portfolio = face × clean price + accrued interest. On a coupon date the accrued part drops to zero and the coupon lands as cash, so value moves sideways, not down.

Worked example: €1,000 face, 3% annual coupon on 15 March, maturing 15 March 2029, bought 15 September 2026 at clean 98.50. Accrued = €1,000 × 3% × 184 ÷ 365 = **€15.12**. Dirty = €985.00 + €15.12 = **€1,000.12**. YTM over the coupons of €30 in 2027 and 2028 and €1,030 in 2029 = **3.63% a year**.

**Croatian government retail securities.** The Ministry of Finance has sold treasury bills and bonds to citizens through Fina, e-riznica and m-riznica in many rounds since 2023. A February 2026 round, for example, sold 364-day bills at a discount with a minimum of €1,000 (Novi list, 12 February 2026, quoting the Ministry). A treasury bill pays no coupon. It is bought below face and repays face at maturity, so its whole return is the discount. Made-up example: €975.00 for €1,000 in 364 days is (1,000 ÷ 975 − 1) × 365 ÷ 364 = 2.57% a year. The Ministry's day count convention is unconfirmed.

**Bond tax.** Interest on bonds is not income "neovisno o izdavatelju i vrsti obveznica", and neither are debt securities and money market instruments issued by Croatia and its local governments (Art. 65(2)(4)). Selling or redeeming Croatian government and local government debt securities is not a disposal (Art. 67(4)(6)). So Croatian bonds and treasury bills are tax-free throughout. A foreign or corporate bond pays tax-free coupons, but a sale at a gain within two years is taxed like a share. My reading, unconfirmed: holding a foreign bond to maturity is a redemption, so a discount earned on it within two years would count as a capital gain.

### Money market funds

Units and a daily NAV (net asset value per unit). Value = units × NAV. Most Croatian UCITS money market funds accumulate, so the return arrives as a rising NAV (not checked fund by fund). Made-up example: 100 units at NAV €10.00 cost €1,000.00. At NAV €10.30 they are worth €1,030.00, a gain of €30.00. Redeeming within two years makes that a taxable capital gain (Art. 67(2)(3)). Switching between funds of the same management company is not a disposal, and the first acquisition date and value carry over (Art. 67(4)(4), 67(5)). A fund that distributes income in the form of interest is taxed as interest (Art. 65(1)(4)).

### Cash in foreign currencies

Each currency in each account is a holding with a quantity and a euro cost (see section 1). Interest on it is income. My reading, unconfirmed by guidance: a currency is not on the Art. 67(2) list of financial assets, so exchanging dollars back to euros at a gain is not a taxable capital gain. Kuna should still show the currency gain, since it is part of the return.

### Crypto

- Quantities need eight or more decimals. A trade fee is often taken in the coin itself, so the quantity received is smaller than the quantity bought while the euro cost stays the same, and the cost per coin rises.
- A transfer between the owner's own wallets or exchanges is not a sale. The network fee reduces the quantity. Lots keep their dates and costs. Whether the fee coins themselves count as a small disposal is unconfirmed.
- A swap of one coin for another: Porezna's 2018 opinion says no capital income arises "kod zamjene jedne kriptovalute za drugu", because there is no cash flow. The gain arises only when crypto is exchanged for a fiat currency. So Kuna must carry the original lots' dates and costs through a swap to the new coin.
- Prices: no ECB rate exists, so crypto is priced in euros. Porezna accepts the platform's own confirmation as the record, and the average price on a large exchange when no record exists (2018 opinion).
- Mining, staking rewards and payment in crypto are other income or business income, not capital gains (2018 opinion). Out of scope for a first version.

### Gold

- Unit: grams or troy ounces (1 oz = 31.1034768 g). Store grams and convert for display.
- **Physical gold** (bars, coins): value = grams × spot price per gram, less the dealer's buy-back spread if the owner wants a realistic figure. It earns nothing and costs storage.
- **Gold ETC** (an exchange-traded note backed by gold): units × price. Each unit's gold entitlement shrinks yearly by the fee, so price per unit tracks spot slowly less.
- **Tax, my reading, unconfirmed:** physical gold is personal property, and "primici od otuđenja osobne imovine" are not income (Art. 8(2)(4)). An ETC is a transferable security, so the two-year capital gains rule applies.

## 5. Croatian tax on capital income, as it stands for 2026

### The law in force

Zakon o porezu na dohodak (ZPDoh), NN 115/16, 106/18, 121/19, 32/20, 138/20, 151/22, 114/23 and 152/24. The consolidated text on zakon.hr is "na snazi od 01.01.2025." and that database says it is updated through NN 110/26 (20 October 2026), with no later amendment listed. NN 152/24 (in force 1 January 2025) does not touch Articles 64 to 70, checked on its Narodne novine text. NN 114/23, Article 28, raised the capital income rates from 10% to 12% ("U stavcima 4. i 17. riječi: »od 10 %« zamjenjuju se riječima: »od 12 %«", and the same for paragraphs 1 and 19), and the same act deleted the surtax (prirez) from the income tax act, both from 1 January 2024. I did not look for a bill for 2027 that may be in Parliament now.

### Rates, exemptions, who pays and when

| Income                                                                  | Rate                      | Not taxed when                                                                            | Who works it out and pays                                                                                                                                           | Deadline                                   | Form                     |
| ----------------------------------------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------ |
| Capital gain on shares, ETFs, funds, foreign bonds, derivatives, crypto | 12% (Art. 70(4))          | sold more than two years after acquisition, or to close family, or inherited (Art. 67(8)) | the taxpayer, unless a Croatian intermediary or SKDD does it (Art. 70(4), (7), (8))                                                                                 | last day of February for the previous year | Obrazac JOPPD            |
| Dividend from a Croatian company                                        | 12% (Art. 70(19))         |                                                                                           | the paying company, withheld                                                                                                                                        | at payment                                 | (payer's JOPPD)          |
| Dividend or interest paid from abroad                                   | 12%                       |                                                                                           | the taxpayer, within 30 days of receipt (Art. 81(1))                                                                                                                | 30 days                                    | JOPPD                    |
| Same, with tax withheld abroad                                          | 12%, less the foreign tax |                                                                                           | no payment during the year, notify within 8 days of the first receipt in the year (Art. 81(3)), report by 31 January (Art. 81(4)), Porezna uprava issues a decision | 31 January                                 | INO-IZJAVA, then INO-DOH |
| Interest on savings at a Croatian bank                                  | 12% (Art. 70(1))          | sight deposits and payment account balances at no more than 0.5% a year (Art. 65(2)(3))   | the bank, withheld                                                                                                                                                  | at payment                                 |                          |
| Bond interest, any issuer                                               | none                      | always (Art. 65(2)(4))                                                                    |                                                                                                                                                                     |                                            |                          |
| Croatian government and local debt securities, treasury bills           | none                      | interest and disposal both outside tax (Art. 65(2)(4), 67(4)(6))                          |                                                                                                                                                                     |                                            |                          |
| Physical gold                                                           | none, my reading          | personal property (Art. 8(2)(4))                                                          |                                                                                                                                                                     |                                            |                          |

Capital gains count only on assets acquired from 1 January 2016 (Art. 94(3)).

The two-year rule is "ako je financijska imovina otuđena nakon dvije godine od dana nabave" (Art. 67(8)). How a sale exactly on the second anniversary counts is unconfirmed, so Kuna should show "tax-free from" as the day after the anniversary and warn about a sale planned within a few days of it.

### Losses

"Kapitalni gubici mogu se odbiti samo od dohotka od kapitalnih dobitaka koji je ostvaren u istoj kalendarskoj godini. U kapitalni gubitak uračunavaju se i svi pripadajući troškovi ... Kapitalni gubitak iskazuje se najviše do visine porezne osnovice" (Art. 67(11)). So:

- Taxable gains − losses of the same calendar year, never below zero.
- No carry-forward to a later year and no carry-back.
- Fees charged on the deals count toward the loss.
- **Unconfirmed:** whether a loss on a lot held more than two years can offset a taxable gain. My reading is no, since that disposal is outside capital gains tax altogether. Kuna should leave such losses out and say why.

### Crypto

- Gains from trading crypto are capital gains, because Porezna treats crypto as the equivalent of money market instruments, and tax is due on "razliku između nabavne i prodajne cijene umanjenoj za možebitne troškove trgovanja" (Porezna uprava opinion of 19 March 2018). The rate in that opinion (12% plus surtax) is out of date. Today it is 12% with no surtax.
- Swaps between coins: no gain until exchange into a fiat currency (same opinion).
- A lost wallet or a fraud can be a capital loss "u iznimnim slučajevima" (same opinion).
- Since 6 February 2026 Porezna uprava requires a JOPPD "i u slučajevima kada ostvareni kapitalni dobitak od trgovanja kriptoimovinom ne podliježe oporezivanju", that is, for a tax-free sale after two years too. Its example JOPPD for a 2025 sale has report mark 25365 (the year and day 365), report type 11, submitter mark 4, recipient and receipt codes 0000, and the €5,000.00 as a non-taxable receipt on page A (section VII) and page B (fields 15.2 and 16.2), with code 2 in the code fields beside them.

### Who files, and the deadlines

- The owner files without an intermediary for anything sold through a foreign broker or exchange. A Croatian broker can take this over (Art. 70(7)), or the owner can choose SKDD to keep the register and work out the tax for all the owner's financial assets (Art. 70(8)).
- For 2025 gains, Porezna uprava's notice of 13 January 2026 confirms the 12% rate and the deadline: "do 28. veljače 2026. odnosno do 2. ožujka 2026. (obzirom da je 28. veljače 2026. neradni dan)". It exempts from filing only gains under €16.70 (tax up to €2.00) realised through Croatian intermediaries who sent a notice. That exemption does not cover a foreign broker.
- For 2026 gains, the last day of February 2027 is Sunday the 28th, so the deadline should move to Monday 1 March 2027. Unconfirmed until Porezna uprava publishes its notice.
- INO-DOH for 2026 is due 31 January 2027, which is also a Sunday. Whether it moves to 1 February is unconfirmed.
- Income from abroad also needs a one-time registration in the income tax register (Obrazac RPO) within eight days of the first receipt (Art. 87(2)(6), 87(4)). The owner may have done this already.
- The tax on capital income is final. It does not enter the annual income tax return (Art. 12(4), and the 2018 opinion: "neće uzeti u obzir u godišnjem obračunu").

### Foreign tax withheld

- Croatia credits foreign tax "za svaki pojedinačni inozemni dohodak zasebno", only on the foreign tax authority's or payer's confirmation (Art. 80(2), (3)), and through INO-DOH (Art. 80(5)).
- The credit cannot exceed the Croatian tax. In Porezna's INO-DOH example for an Austrian dividend, Austria withheld 15% and only the Croatian amount was credited (14,160.00 kn of the 15,000.00 kn paid, at the 2017 rate with surtax).
- **USA:** Porezna's treaty page lists the USA among states "s kojima se čeka potvrđivanje ugovora", so no treaty applies yet. The IRS says "Most types of U.S. source income received by a foreign person are subject to U.S. tax of 30%". With 30% withheld in the US and 12% due in Croatia, no Croatian tax is left to pay, and the extra 18% is lost. That is why the example dividend's withheld part should stay visible in Kuna.

### What records Porezna uprava expects

- A FIFO register per kind of financial asset (Art. 70(5)), which may be kept in the acquisition currency for assets bought abroad (Art. 70(6)). The 2018 opinion's example register has these columns: number, financial asset, date, description (buy or sell), amount per unit, quantity, total value, acquisition value of what was sold, costs, net gain or loss. Several small same-day trades in one asset may be one line for that day (same opinion, on crypto).
- Trustworthy documents for each buy and sale: broker or platform confirmations, contracts for private deals, gift contracts with the giver's acquisition date and value (same opinion).
- The foreign tax confirmation for any credit (Art. 80(3)). A confirmation not available by 31 January can be sent by 30 November (Art. 81(4)).
- Porezna uprava may set the gain itself at market prices when it was not reported at market prices (Art. 67(12)).

### What Kuna could prepare

1. **The register.** A per-year export of every disposal with the lots it closed, in the 2018 example's columns, plus the euro rates used. CSV first, a printable page second.
2. **The year sheet.** Taxable gains, tax-free gains after two years, losses offset, the tax at 12%, and the deadline. Both currency readings until the owner picks one.
3. **The JOPPD figures.** The values to type into ePorezna: report mark, receipt amount, tax, and the non-taxable amount for tax-free crypto sales. The current codes for a taxable capital gain are unconfirmed (the 2018 example used recipient code 1001 and receipt code 1006), so Kuna should name the fields and leave the codes to Porezna's current JOPPD annex until someone checks it.
4. **Foreign income list.** Dividends and interest from abroad with date, gross, tax withheld, euro rates, whether a tax confirmation is in hand, and the 30-day or 31 January route each one takes.
5. **"Tax-free from" on every open lot,** and on the sell form: "Selling 15 now: 10 units tax-free, 5 taxable, about €5.90 of tax."
6. **A waiting item in January and February** on the Kuna home card, the way the Company app flags its deadlines.

## 6. What the owner's Yahoo export means for the maths

Structure only, no figures.

- 17 columns: `Symbol, Current Price, Date, Time, Change, Open, High, Low, Volume, Trade Date, Purchase Price, Quantity, Commission, High Limit, Low Limit, Comment, Transaction Type`. The first nine are the quote at export time, repeated on every row of a symbol. The trade itself is `Trade Date`, `Purchase Price`, `Quantity`, `Commission` and `Transaction Type`.
- Some rows have no trade date, price, quantity or type, such as a watched symbol or `$$CASH` (Yahoo's cash placeholder). An import should skip them or offer them as a watchlist.
- Symbols are US-listed shares with no suffix (quote times in EDT) and EUR-listed ETFs with a suffix such as `.DE` for Xetra or `.AS` for Euronext Amsterdam (quote times in CET). There is **no currency column**. Kuna must infer the currency from the suffix and should ask once per symbol.
- No bonds, funds, crypto, gold, cash movements, dividends or currency exchanges. Yahoo's list holds only trades in shares and ETFs, so everything else is entered in Kuna.
- Dates: `Trade Date` is `YYYYMMDD`. The quote `Date` is `YYYY/MM/DD`.
- `Commission` can be empty, on sells too. Read empty as zero and flag it, since a missing fee overstates the gain.
- Quantities can be fractional, with six decimals.
- **Split-adjusted already.** Buys from before a large stock split carry purchase prices far below what the share traded at before that split. So Yahoo restates old trades in today's units, presumably quantities too (unconfirmed). An import must not apply those splits again, and should record the export date as the point from which Kuna applies splits itself.
- A `Transaction Type` of SHORT could be a real short sale or a mislabelled sell. Short positions need negative quantities and their tax treatment is unconfirmed, so the import should stop on such a row and ask.
- Whether a sale closed lots under two years old depends on the FIFO order, which is exactly what Kuna would work out.

## 7. Valore and Kuna today

- **Valore** values a holding as the latest quantity observation × the latest price observation (`src/features/portfolio/domain/calculations.ts:23-36`). There are no trades, no cost basis and no gains, by design: "Track net worth and changes in wealth, without presenting them as investment returns" (`docs/plan.md:35`). It adds every account's cash and investments without converting currencies (`calculations.ts:52-84`), which is right only because Phase 1 has one currency (`docs/plan.md:56`). Worth keeping: decimal strings and the instrument and listing split. Its maths does not carry over.
- **Kuna** has `Money` in integer cents (`src/shared/money/money.ts:5`) and `CivilDate` (`src/shared/calendar/civilDate.ts:5`). It has no rate solver at `HEAD` (no IRR, Newton or bisection function in `src`). The loans scenarios plan adds an EKS solver. XIRR and bond YTM are the same root-finding over dated flows, so the investments app should share it once it lands.

## Questions for the owner

1. **Converting a foreign share's gain for tax.** On the Stock B sale in section 2, converting each leg on its own day gives €1.81 of tax, and converting the dollar gain on the sale day gives €4.96. Kuna can compute both. Ask your accountant which one they use, and Kuna defaults to it.
2. **Losses on lots older than two years.** Leaving them out of the offset is the cautious reading and may cost a little tax. Including them may be wrong. Recommendation: leave them out until the accountant says otherwise.
3. **One FIFO queue per asset or per account.** If you hold the same ETF at two brokers, should Kuna run FIFO across both (my reading of the law) or per broker (what the brokers do)?

## Sources

All loaded and checked on 2026-10-30.

- Zakon o porezu na dohodak, consolidated text, zakon.hr, https://www.zakon.hr/z/85/Zakon-o-porezu-na-dohodak. Articles 8, 12, 64 to 70, 80, 81, 87 and 94 quoted from it. A consolidation is not the official gazette. The amendments below were checked on Narodne novine.
- NN 114/23, Zakon o izmjenama i dopunama Zakona o porezu na dohodak, https://narodne-novine.nn.hr/clanci/sluzbeni/2023_10_114_1609.html. Article 28 (10% to 12%), surtax deletions, entry into force 1 January 2024.
- NN 152/24, Zakon o izmjenama i dopunama Zakona o porezu na dohodak, https://narodne-novine.nn.hr/clanci/sluzbeni/2024_12_152_2505.html. Articles amended, none of 64 to 70. In force 1 January 2025.
- Porezna uprava, "Oporezivanje kapitalnih dobitaka i izvješćivanje putem Obrasca JOPPD", published 13 January 2026, https://porezna-uprava.gov.hr/hr/oporezivanje-kapitalnih-dobitaka-i-izvjescivanje-putem-obrasca-joppd-8281/8281. 12%, the 2 March 2026 deadline, the €16.70 exemption.
- Porezna uprava, "Dohodak od kapitala po osnovi kapitalnih dobitaka", https://porezna-uprava.gov.hr/hr/dohodak-od-kapitala-po-osnovi-kapitalnih-dobitaka/4653. Restates Art. 67 and 70 at 12%.
- Porezna uprava, "Primatelj kamata", https://porezna-uprava.gov.hr/hr/primatelj-kamata/4471. Interest at 12%, the exempt kinds of interest.
- Porezna uprava, opinion "Porezni tretman kapitalnih dobitaka po osnovi trgovanja kriptovalutama", 19 March 2018, class 410-01/17-08/29, https://porezna-uprava.gov.hr/Misljenja/Detaljno/2335. Crypto as capital gains, swaps, records, the FIFO register example, the JOPPD example.
- Porezna uprava, "Primjer podnošenja Obrasca JOPPD za primitke po osnovi trgovanja kriptoimovinom", published 6 February 2026, https://porezna-uprava.gov.hr/hr/primjer-podnosenja-obrasca-joppd-za-primitke-po-osnovi-trgovanja-kriptoimovinom/8342, with its PDF example.
- Porezna uprava, INO-DOH pages and FAQ, https://porezna-uprava.gov.hr/hr/inozemni-dohodak-ino-doh/3960 and https://porezna-uprava.gov.hr/hr/opcenita-pitanja-i-odgovori/4529, and the example "Dividenda Austrija" (PDF linked from https://porezna-uprava.gov.hr/hr/primjeri-izvjestaja-i-obracuna-inozemnog-dohotka/4527).
- Porezna uprava, "Ugovori o izbjegavanju dvostrukog oporezivanja", https://porezna-uprava.gov.hr/hr/ugovori-o-izbjegavanju-dvostrukog-oporezivanja/7559. USA awaiting ratification. The page shows no date.
- Porezna uprava, "Oporezivanje kapitala", https://porezna-uprava.gov.hr/hr/oporezivanje-kapitala/4745. An EU comparison page, consistent with the 12% rates, not used as guidance.
- IRS, "NRA withholding", https://www.irs.gov/individuals/international-taxpayers/nra-withholding. The 30% rate.
- ECB, euro foreign exchange reference rates, https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html, and the ECB data API series `EXR/D.USD.EUR.SP00.A`.
- HNB exchange rate API, `https://api.hnb.hr/tecajn-eur/v3` (USD, 26 to 30 October 2026) and `https://api.hnb.hr/tecajn/v2` (USD and EUR, 18 December 2017). HNB's page "Referentni tečajevi ESB-a" loaded, but its body text is drawn by script, so the one-day lag rests on the API comparison only.
- Novi list, "Od ponedjeljka građani mogu upisivati nove trezorce, objavljeni uvjeti", 12 February 2026, https://www.novilist.hr/novosti/gospodarstvo/od-ponedjeljka-gradani-mogu-upisivati-nove-trezorce-objavljeni-uvjeti/. A news report, not the Ministry's notice.
- Valore at `6e2fd62` and Kuna at `210875f`, read from Git without touching either working tree.
