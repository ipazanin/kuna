# Enable Banking personal mode

Research date 2026-11-07. File and line references are to the code on that day.

## Direct answer

**Yes for Revolut, and it costs nothing.** The Terms (still dated 2026-01-09) say use "is free of charge" for "the personal use of private individuals". Setup is about an hour by my estimate, plus a bank approval twice and again every 180 days. Do three small Kuna changes first (gaps 1 to 3 below), because Revolut's own API suggests that a file and the sync will double some rows. The browser cannot skip Apps Script: a preflight to `api.enablebanking.com/aspsps` with Kuna's origin answers 401 with no allow-origin header, and a browser refuses that. `/aspsps` also needs a signed token, and the reference says to keep the key away from the client.

## Setup steps

1. **Account.** Enter your email at Enable Banking's sign-in and open the one-time link. No separate signup. Restricted mode describes no identity check. Contract and KYC apply only to unrestricted mode.
2. **Application.** Control Panel, API applications, Production. Give a name, description, data protection email, privacy URL, terms URL and the redirect `https://ipazanin.github.io/kuna/`. The FAQ says the email and links are not checked in this mode. Kuna has no terms page, so `privacy.html` is my suggestion for both. The Apps Script can't be the redirect, since an API executable has no URL, and none is needed because a code is useless without the signed token.
3. **Key.** Keep the default. No certificate is involved. Your browser makes a 4096-bit RSA key and saves `<application id>.pem`. The panel's script writes PKCS#8 under `BEGIN PRIVATE KEY`, about 3.2 KB against the 9 KB property limit.
4. **Activate.** Press Activate by linking accounts and approve **every Revolut account the bank offers**, since the API strips anything unlinked. The app turns Active in restricted mode. Revolut only for now. A later Link accounts button adds more.
5. **Cloud project.** In Kuna's project enable the Apps Script API, add the scope `script.external_request`, and note the project number.
6. **Script.** Make the project, set the Cloud project number, paste `Code.gs` and `appsscript.json`, and add `ENABLE_BANKING_APP_ID` and `ENABLE_BANKING_PRIVATE_KEY`. Deploy as API executable and copy the deployment ID.
7. **Kuna.** Give each Revolut account its real IBAN and opening day **before linking**. An account that doesn't match isn't fetched. Save the deployment ID.
8. **Link Revolut, once, with time to spare.** Approve at Revolut. Tap Finish linking at once if it shows, which Firefox may need. Revolut limits history to 90 days from 5 minutes after consent. The fetch writes straight to the file, so read its result and Undo there if it looks wrong.
9. **Calendar.** Add a reminder at day 165 of the 180. Kuna's home card warns from day 166, but only when you open it.

## Answers to the questions

- **Auth and flow: Kuna's code matches the docs.** RS256, `kid` as app id, `iss` and `aud` as documented, 3600 s (limit 86400). `POST /auth`, `POST /sessions`, `GET /sessions/{id}`, details, transactions and `continuation_key` through empty pages all fit (`Code.gs:14-75`, `:116-120`). Kuna never calls `/balances`.
- **SCA.** The 90-day rule is gone for this route. Regulation 2022/2360, Article 10a requires SCA on first access and when more than 180 days have passed. The list gives Revolut HR 15552000 s, which is 180 days. A bank may still end a session early, and a new session changes the session and account ids. Kuna re-reads the account ids each sync and keys rows on `entry_reference`, which the docs say survives a new session.
- **Revolut.** Listed as `Revolut`, country HR, BIC `REVOLT21`, personal and business, redirect, not beta, no required PSU headers. The list needed no key at `enablebanking.com/api/aspsps`, while the API's own endpoint did. The list names no entity.
- **Currencies.** Revolut's API gives each account one required `Currency` and a sub-type of current, savings or loan. So expect one account per currency, not `XXX`, and savings may appear as accounts (inference). Kuna handles both shapes.
- **Fields.** Revolut's API has `BookingDateTime` (required), `ValueDateTime`, `Amount`, `ChargeAmount`, `CurrencyExchange`, `MerchantDetails`, `TransactionInformation`, `TransactionId`, `Balance`, and **no transaction day**. It filters on booking date. Its `Amount` "includes the amount in `ChargeAmount`". Enable Banking's schema has `exchange_rate`, `bank_transaction_code`, `note` and `balance_after_transaction`, but **no fee field**. So the known "no fee is read" gap has nothing to read: a fee likely sits inside the row's amount.
- **Rate limit.** PSD2 allows four unattended reads in 24 hours. The FAQ says any PSU header marks a fetch as user-present and lifts the limit. Kuna sends none (`Code.gs:99`), so even Sync now counts as background.
- **Read only: yes in practice.** PSD2 Article 4(16) defines account information as information only, and `Code.gs` has no payment call. One nuance: the API also has `POST /payments` on the same key, but its flow sends the end user to confirm the payment, so a stolen key can't silently move money.

## Other banks and business accounts

| Bank                         | List today                            | Personal | Note                                                    |
| ---------------------------- | ------------------------------------- | -------- | ------------------------------------------------------- |
| OTP banka                    | beta, BIC OTPVHR2X, asks for `userId` | yes      | See below                                               |
| PBZ                          | not beta                              | yes      | PSU IP required only for user-present fetches           |
| Zagrebačka banka             | beta                                  | yes      | Same, m-zaba mToken only                                |
| Erste & Steiermärkische Bank | beta                                  | yes      | Hardware token or mBanking mToken, George doesn't do it |

**OTP conflict: probably usable, not proven.** The FAQ says beta means only low traffic, "You can use these normally". The changelogs list OTP banka (HR) under improved integrations in February, March and May 2026. The undated Croatia page says "not yet supported". That page also notes a March 2026 event, so it isn't simply old. Only a real link settles it, and trying costs one approval.

**Business accounts:** technically listed, but the Terms grant no right to "accessing account information belonging to businesses". They allow it only as evaluation until written notice. `Code.gs:18` also hard-codes `personal`, and `:26` holds one session per bank name, so a business link would replace a personal one at the same bank.

## Security

- **Key.** Script Properties is right. `kuna-secrets.json` is browser-readable and would gain nothing, since CORS blocks the browser anyway.
- **Who can call the script.** There is no public URL. `scripts.run` needs the owner's Google token from Kuna's own Cloud project, and `executionApi.access` is `MYSELF`. Someone with only the deployment ID can do nothing. XSS on Kuna with his token could read bank rows, as it already can read his Sheets. Anyone inside his Google account, or an editor he adds to the script, can read the key.
- **Google limits.** 6 minutes per run, 20,000 fetches a day, 50,000 property operations, 9 KB a value. Plenty, except that a very long history has no time guard (`Code.gs:67`) and a timeout loses that account's fetch until a retry. `urlFetchWhitelist` stops the script sending anything to another host.
- **Not sure.** Google says `_` functions are private for `google.script`. The `scripts.run` page doesn't say. It matters little, since a caller needs his token and could get at most a one-hour JWT, never the key.

## Gaps in Kuna

**Right already:** the flow above, pending rows left out, per-bank failure lines, ended sessions, `state` check, 14-day reminder (`bankLinks.ts:13`), Undo, and six-hour hold.

**Before the first real run**

1. **The trial can't show its answers, small.** `transactionOf_` (`Code.gs:77-93`) drops fields, and `README.md:67` says "tell Claude which fields it carries". Add a function run from the script editor that logs field names and counts only, never values.
2. **File and sync double rows, small to medium.** `sameBooking` needs equal account, amount and day (`sameMoney.ts:118-120`). Sync's day falls back to booking (`bankSyncRows.ts:23`), a file uses Started Date (`revolutStatement.ts:201`), and a file splits the fee into its own row (`:220-230`). Both mismatches look likely now. A doubled row nothing marks still moves the balance, and a rule files it into spending. See the first decision.
3. **README is out of date, tiny.** `:13` omits description and terms URL, `:16` and `:46` start with OTP, `:46` says first hour where Revolut gives 5 minutes, and `:65` can go since the key is PKCS#8.

**Soon after, cheap** 4. **User-present header, small.** Pass `Psu-User-Agent` on the first fetch and Sync now (`Code.gs:99`). Worth doing before the run if several currency accounts might use up the limit. 5. **No balance check, small.** A file gets `balanceNotes` (`revolutStatement.ts:82`), and a sync gets nothing. Rows lost after 90 days away, or a wrong opening balance, stay silent. `/balances` would catch both for one more call. 6. **Endless first fetch, tiny.** If a file already holds every row, none gets a sync key, so each sync repeats `longest` from the opening day (`bankLinks.ts:72-82`), which may make extra bank calls.

**After the trial shows the shape** 7. **Exchange and pocket pairing, medium.** Rows have blank `movedAt` and `pocket` (`bankSyncRows.ts:37-38`), so `transferPairs.ts:53` never pairs and `:68` doesn't hold them as transfers. They wait on review, so the balance is right and spending is right once filed. Enable Banking's dates appear to carry no time (unconfirmed), so a file's same-second rule likely can't carry over. It needs a new rule from `exchange_rate` and the day. A file dropped later is skipped as other-source and can't repair them. 8. **Fee stays inside the row, small.** With sync-only rows the balance is right, but Bank fees reads low. Accept it, or split it if the trial shows a field. 9. **An account with no IBAN can't be mapped, small.** `Code.gs:60` and `bankLinks.ts:51-53`. Foreign-currency rows would never come. Fix only if the trial shows it. 10. **Other banks, small to medium each.** `LINKABLE_BANKS` is OTP and Revolut (`spendingSettings.ts:22`, `bankAnswer.ts:56`).

## Risks and limits

- Free personal use can change. Terms changes bind by continued use, and fees won't be retroactive. "The number of Linked Accounts per Application may be limited" with no number given.
- Only accounts of the panel user. Any other Kuna user needs their own application.
- The panel link's lifetime isn't documented. If it lapses at 180 days, Kuna's Link again alone may not bring rows back.
- Sync runs only when Kuna opens. After 90 days away, older rows are gone and only a file can fill them, and gap 5 is what would reveal that.
- The six-hour hold is per device, in local storage (`bankSyncStep.ts:24`), and Sync now ignores it.

## Decisions for the owner

1. **How should the sync and Revolut files overlap?** Screen: Spending's account balance and Transactions. Example: a €12.00 purchase on Friday, booked Monday with a €0.50 fee. The file writes −12.00 and −0.50 on Friday, and the sync likely writes −12.50 on Monday. Kuna keeps all three, so the balance is off by €12.50.
   - **Switch on a date (recommended).** Files up to a set day and the sync after it, so nothing doubles and old rows keep their fee and pocket detail. Costs a small setting and a filter.
   - **Keep matching day and amount.** Nothing to build, and doubles appear on fee and late-booked rows until the trial leads to a fix.
   - **Widen the match to a few days and offer doubtful rows on review.** Files stay usable for backfill at any time. Costs the most, and equal purchases near each other need a person.
2. **Try OTP, or stay on its PDF?** Recommended: finish Revolut first, then try one OTP link. If it fails, the PDF route stands and only one approval is lost. Erste, PBZ and ZABA follow the same way, only for accounts you want in Spending.
3. **Bring Company's business accounts in?** Recommended: no. The current bank files already work, and the Terms allow it only as evaluation that can end on notice.

## Sources and what is unconfirmed

**Loaded 2026-11-07:** Enable Banking [API reference](https://enablebanking.com/docs/api/reference/), [quick start](https://enablebanking.com/docs/api/quick-start/), [control panel](https://enablebanking.com/docs/api/control-panel/), [linked accounts](https://enablebanking.com/docs/api/linked-accounts/), [FAQ](https://enablebanking.com/docs/faq/), [Croatia](https://enablebanking.com/docs/markets/hr/), [widgets](https://enablebanking.com/docs/api/widgets/), [bank list](https://enablebanking.com/api/aspsps), [changelogs](https://enablebanking.com/blog/tag/Changelog) from December 2025 to September 2026 searched by keyword, [Terms](https://enablebanking.com/terms/) and panel form read from the site's script. [Actual Budget](https://actualbudget.org/docs/advanced/bank-sync/enable-banking). Google [quotas](https://developers.google.com/apps-script/guides/services/quotas), [Utilities](https://developers.google.com/apps-script/reference/utilities/utilities), [execute how-to](https://developers.google.com/apps-script/api/how-tos/execute), [`scripts.run`](https://developers.google.com/apps-script/api/reference/rest/v1/scripts/run), [private functions](https://developers.google.com/apps-script/guides/html/communication). EU [2022/2360](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32022R2360), [2018/389](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32018R0389), [PSD2](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32015L2366). **Wayback, since Revolut's site answers 403:** [transactions, 2025-02-14](https://web.archive.org/web/20250214171835/https://developer.revolut.com/docs/open-banking/get-accounts-account-id-transactions), [accounts, 2026-01-15](https://web.archive.org/web/20260115145427/https://developer.revolut.com/docs/open-banking/get-accounts), [FAQ, 2025-12-14](https://web.archive.org/web/20251214173556/https://developer.revolut.com/docs/guides/build-banking-apps/faqs). **Observed:** curl with Kuna's origin on the API and site list, neither with an allow-origin header.

**Unconfirmed until a real run:**

- How Enable Banking maps Revolut: `transaction_date`, the fee inside `transaction_amount`, `entry_reference`, one account or `XXX`, savings, pockets, and whether an exchange fills `exchange_rate`. Revolut's pages describe its API, not Enable Banking's output, and the transactions copy is old.
- Whether Enable Banking keeps Revolut's 5-minute limit.
- Whether Revolut honours the PSU header, and what counts toward its four reads.
- Whether Apps Script accepts a 4096-bit key. Its docs say only "PEM formatted".
- Whether the panel form enforces each field.
- The rest stays as the plan and README list it: `script.storage`, the consent screen, one or several sessions at Revolut.

**Not loaded:** Firefly III's tutorial (403). There is no public pricing page (404), and I found no Revolut-specific page at Enable Banking.
