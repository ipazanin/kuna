# Home currency plan

Let a person keep an app in a currency other than the euro, such as CHF or USD. Read at `main` 704a05c on 7 November 2026. Figures in examples are made up.

The plan stops for the owner's review before anything is built. It needs the [shared rates plan](plan.md) through its stage 3, and adds nothing to its file.

## The owner's answers, 2026-11-07

These override anything below that says otherwise.

- Home currency is per app.
- Net worth converts at the newest rate, and the setting locks once a file has records.
- Croatian tax screens stay, in euros.
- Build every stage, Investments included, right after shared rates.

## Summary

- **Each app's file has its own home currency**, chosen at first run and defaulting to the euro. Every file today reads as euro, with nothing to migrate.
- **Records keep their shape.** A stored `rate` means units of the record's currency per home unit. For a euro file, that is what it already means.
- **Net worth converts** each app's parts into one sum currency at the newest rate.
- **The home currency is fixed once a file has records.** Changing it means a new file.
- **Tax and `hr-doo` stay in euros.** Tax shows euros in any file, and the company's Croatian module needs a euro file.
- **Size.** Large: about 120 files, most of them a rename, and seven stages. Each app can ship alone, because Net worth handles apps that differ.

## What assumes the euro

File counts are from a search of names, not an audit.

| Where                                                                           | What it assumes                                                                                                                                                    | Size                |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------- |
| `shared/money/currencyCode.ts:5` `EURO`                                         | "The only base currency". Investments has it in 21 files, Spending in 9, others in none                                                                            | 30 files            |
| `shared/money/decimal.ts:143` `inEuros`, `rateBook.ts` `unitsPerEuroOnOrBefore` | The conversion and the rate's scale                                                                                                                                | 29 files            |
| Names such as `euros`, `eurosIn`, `EuroRow`                                     | Investments 72 files, Spending 28, Company 12, Assets 3, Loans 2                                                                                                   | About 117 files     |
| `shared/money/moneyFormat.ts:28` `DEFAULT_MONEY_FORMAT`                         | `app.ts` of Loans, Spending, Assets and Investments. Company reads its setting (`moneyFormatOf`)                                                                   | 4 lines to replace  |
| Stored `rate` on `Trade`, `Income`, `CashMovement`                              | "Units of the currency per euro". `investmentFields.ts:59` and `readInvestmentBook.ts:137-138` require one exactly when the currency is not the euro               | One reader          |
| `importDryRun.ts:527`, `:646`, `:682`, `:876`, `workbookRates.ts`               | A euro commission, Revolut's rate per euro, euro as the fallback currency                                                                                          | Investments imports |
| `shell/netWorth/NetWorthScreen.vue:60`, `shared/app/personalNet.ts`             | The sum takes the first app's format, and apps that differ hold it back with "Not added up"                                                                        | Small               |
| Company `settings.currency`                                                     | Already a setting. It changes labels only, and can change on a file with records                                                                                   | Small               |
| `hr-doo`                                                                        | Law in euros: thresholds, VAT, payroll, `ruleWording.ts:134`. `shownPack` looks only at `ownerPayModule`, so a USD company today shows euro law under dollar signs | A guard             |
| Tax in Investments                                                              | Euros by law. `dayRate` treats a euro instrument as needing no rate, and everything else goes through HNB's rate                                                   | A fixed format      |
| Spending                                                                        | `receiptMatch.ts:40`, `:71` matches receipts to euro accounts, since Croatian fiscal receipts are in euros. `spendingCategorisation.ts:22`, `AccountDialog.vue:48` | Small               |
| Loans, Assets                                                                   | They hold no currency at all. A rate or an index is a ratio, so only labels change. The Assets values and the Loans subsidy rest on Croatian sources               | Small               |
| Strings                                                                         | 15 `words.ts` files and 20 files in all name the euro or `€`                                                                                                       | Read per stage      |

`Money` already means cents in the module's base currency, per `kuna-money.md`, so no amount type changes.

## The design

### One setting per file

Each app's file states its home currency. `AppContribution.moneyFormat()` already gives the shell each app's format, so that is the read path.

- Company keeps `settings.currency`.
- Spending and Investments add a row to the settings kind each already has.
- Loans and Assets have no settings kind, so each gains a small one with a name of its own, as `tests/kindNames.spec.ts` asks.
- A missing row reads as `EUR`.
- First run asks only when the person opens Change currency, with the euro filled in. A later app's first run suggests the first app's choice.
- `currencyProblem` already refuses what cents cannot hold, such as KWD. It moves from Company's settings to `shared/money`, and every app uses it for this field.

### Records

A euro file does not change. In a USD file, a trade in USD has no rate, and a trade in EUR stores euros per dollar. Spending rows stay in their account's currency.

### Rates

`homeRates(book, home)` in `shared/money/rateBook.ts` answers units of a currency per home unit, by crossing through the euro from the shared file: CHF per USD is CHF per euro over USD per euro, each on or before the day. For a euro home it returns the book itself, so no digest moves. A day with no rate for the home or the other currency leaves that amount unconverted and listed, as today.

Needed from the shared plan:

- The file, with the euro as its base.
- `ratesDemand`, which now also names the home currency when it is not the euro.
- The two books. Tax keeps reading `official`, which is never crossed.

### Net worth

`personalNet` takes each app's currency, which it already reads, and the sum currency. Each part converts once at the `everyday` rate on or before today, through one function in `shared/money`, and the sum adds the rounded parts. A converted part shows its own amount under it, and a line gives the rate's day. With no rate for an app's currency, the sum holds back and names the currency, replacing "Not added up". The company stays apart, in its own format, as today.

The sum currency is the first counted app's, as `sumFormat` works today, unless the person picks another. That choice lives on this device with the language.

### Croatian screens

- **Tax.** It keeps computing in euros at the official rate, and shows in a fixed euro format whatever the home currency. A trade's gain in its own currency converts by HNB's rate as now, and does not use the file's home.
- **A dollar instrument in a USD file** still gets euros on the Tax screen, because the law asks for them.
- **`hr-doo`.** `ownerPayModule` can only be on with a euro company. Choosing another currency in first run or Settings says why it turns the module off. A file that holds both reads, with a problem line and the module hidden.
- **Receipts.** They match euro accounts only, as Croatian fiscal receipts are in euros.

### Changing it later

The field is editable while the file has no records, then locked with a sentence pointing to a new file. Company's setting takes the same lock, since today a change there relabels every figure without converting one.

## Size

| Stage | App                                 | Size            | Why                                                                  |
| ----- | ----------------------------------- | --------------- | -------------------------------------------------------------------- |
| 1     | Net worth, `homeRates`              | Small           | One screen, one function                                             |
| 2     | Spending                            | Medium          | 28 files, mostly names                                               |
| 3     | Loans, Assets                       | Small           | Labels, a kind each, first run                                       |
| 4     | Company core and the `hr-doo` guard | Small to medium | The setting exists. The guard and lock are new                       |
| 5     | Investments                         | Large           | 72 files, imports, stored-rate rules, performance and tax kept apart |
| 6     | Renaming what remains               | Medium          | Moves digests, see below                                             |

**The rename moves digests.** `kuna-money.md` warns that renaming a key changes `check:figures`, and `euros` is a key on many figures. Stages keep those names until stage 6, even where they are by then misleading. Stage 6 renames them in one commit, with a proof script that maps old keys to new and compares values, and the commit declares every group that moved.

## Stages

Each leaves Kuna working, and euro files behave as today. Everything starts after stage 3 of the shared plan.

### 0. Groundwork

`homeRates`, the setting's reader in each app's own record kind, `EURO` still the default. `AppContribution.moneyFormat()` reads the setting. No screen changes. Digests identical.

### 1. Net worth converts

As above, with the sum picker. A fake set where Spending is set to CHF by its setting adds groups. Existing groups identical. **This is the first stage a person sees, and it is also what lets each later app ship alone.**

### 2. Spending

`ratesNeeded` skips the home instead of the euro, `euroRows` uses `homeRates`, first run and Settings show the field. `--fake-spending home-chf` adds groups.

### 3. Loans and Assets

Labels and the field. `--fake-loans home-chf`, `--fake-assets home-chf` add groups. A flat's DZS estimate stays a ratio on the typed value. A note in the car estimate says its table is Croatian.

### 4. Company

Lock the setting, guard `ownerPayModule`, hide the module's menu when it is off. Digests identical, since `--fake one-employee` and the others are euro. `--fake home-usd` adds core groups.

### 5. Investments

`rateFor` and `readInvestmentBook` compare against the file's home. `inEuros` callers take the home book. Imports refuse Revolut's per-euro rate outside a euro file and use the file's cross. Tax stays on `official` in a fixed euro format. `--fake-investments home-usd` adds groups, among them tax groups equal to a euro file's for the same trades.

### 6. Names

`inEuros` to `inHome`, `EuroRow` to `HomeRow`, `euros` keys to `home`, the `EURO` docs, in one commit with the proof script.

## Specs

- `tests/homeRates.spec.ts`: a euro home returns the book, CHF per USD on one day, on or before with two different days, a home with no rate gives null, and a table test that names `0.8`.
- `tests/personalNet.spec.ts`: two homes convert and add rounded parts, a missing rate holds the sum and names the currency, one home needs no rate.
- `tests/homeCurrencySetting.spec.ts`, per app: a missing row reads as euro, the field locks with a first record, KWD is refused.
- `tests/investmentHome.spec.ts`: in a USD file a USD trade with a stored rate is refused and a EUR trade without one is refused. Tax groups match a euro file's.
- `tests/hrDooGuard.spec.ts`: the module cannot be on with USD, and a file holding both reads with a problem line.

## Checks

- Every stage: `npm run check`, both builds and `check:figures` compared with a fixed `--today` on `--fake five-employees --fake-loans sample --fake-investments sample --fake-assets sample --fake-spending foreign`. Existing groups stay identical until stage 6, which declares what moves and proves the values did not.
- The owner's real exports stay identical, by the owner, at stages 2, 4 and 5, since all are euro.
- Each stage with a screen: targeted `check:visual` at 360, 640, 1024 and 1440 px in both languages and themes, with `design-reviewer`.

## Decisions for the owner

### Per app or one for all of Kuna

Someone lives in Zurich with personal money in CHF, and runs a Croatian d.o.o. in euros.

- **One per app.** The person has both, and Net worth converts. Someone wanting CHF everywhere picks it once per app, with first run suggesting it. It fits the one-file-per-app rule, and Company already has its setting. Net worth carries the conversion work.
- **One for all of Kuna.** One choice, and no conversion in Net worth. The Zurich case cannot be kept, unless the company stays apart by exception. A Kuna-wide setting needs a synced home, which no file holds today.

I recommend one per app.

### How Net worth adds apps that differ

Spending is in CHF and Investments in euros. Today it would say "Not added up".

- **Convert at the newest rate.** The person sees one number, whose foreign part moves with the rate each day, with each part's own amount shown under it. Stage 1 above.
- **Keep holding it back.** Nothing is converted, and there is no sum. It costs nothing, and those people lose the screen's lead figure, while later stages can no longer ship one app at a time without that loss.

I recommend converting.

### What changing the home currency later does

Someone started in euros, moved to Switzerland two years on, and wants CHF.

- **Locked once there are records.** They keep their old file or start a new one with an import. Nothing can go quietly wrong. It costs almost nothing.
- **Convert the whole file.** One write rewrites each record's stored rate from that day's rates, each Loans and Assets amount at one rate, and each past figure in their new currency, with a dry run. A loan contracted in euros would be misstated, and the conversion needs its own rules per kind. Large.

I recommend locking it, and raising conversion as its own issue if someone asks.

### What the Tax screen does outside a euro file

A USD file holds a sale on the Tax screen, and the person is not Croatian. Kuna does not know where anyone lives, and a euro person in Germany sees the screen today too.

- **It stays, in euros.** Nothing to build beyond the fixed format. The person sees a screen that may not apply, as now.
- **Hide it outside a euro file.** Less on screen, and that person never sees Croatian tax. A Croatian resident with a USD home loses it, and the rule claims something about residence that the currency does not say.

I recommend it stays, in euros.

### How much to build, and when

No one has asked for this but you, and Investments is the bulk of the work.

- **Stages 0 to 4, then wait.** A person can hold Spending, Loans, Assets and a company outside `hr-doo` in another currency, and Net worth adds them to a euro Investments file. A CHF person's portfolio still shows in euros. About half the work.
- **All of it.** Every app works, and it takes the whole plan, with Investments and the rename as the longest stages.
- **Wait until someone asks.** Only the shared rates plan lands. The cost comes later, and nothing is lost, because that plan keeps the euro as a base home currencies can cross through.

I recommend waiting until the shared rates plan has landed, then building stages 0 to 4 if someone real wants it.

## Sources

Read in the repo at `main` 704a05c: the files named above, [the money research](../../architecture/research/money-and-domain-types.md), [the module map](../../architecture/modules.md) and `.claude/rules/kuna-money.md`. No outside source is needed beyond those of the [shared rates plan](plan.md), since this plan changes no rule of law. In a non-euro file, tax rests on the same ZPDoh Art. 12(8) rate as a euro file.

## Unconfirmed

- The file counts are a name search.
- Whether a person outside Croatia would want the Assets estimates at all. They are Croatian by source, and this plan only keeps them working.
- `Intl` lists of currencies across browsers. `currencyProblem` reads the running browser's list, so a file can in theory read differently on another browser. This was not tested in Firefox.
