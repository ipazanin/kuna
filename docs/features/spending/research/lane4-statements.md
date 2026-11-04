# Lane 4: bank statements for the personal spending app

Research date 2026-11-04. Every claim names its source. "Unconfirmed" means I saw it only in a search snippet or in a third-party tool, or could not load the page. Revolut's help centre and developer portal block both WebFetch and curl with a bot check, and the Chrome tool could not be approved in this background run. So the Revolut pages below were read from Wayback Machine copies (dated per link). EUR-Lex also blocked the fetch, so the RTS change is cited from the EBA's own press release.

## Short answer

- **OTP banka emails its customers a monthly PDF statement** when they choose e-mail delivery. It comes from OTP's notification address, subject "Izvod za eurski račun", attachment `Izvod-eurski racun.pdf`. Company's mail filing can file these the same way it files Erste's. The PDF must then be parsed, and Kuna has no PDF text reader yet.
- **Revolut emails its customers only a notice, never the file.** The statement has to be exported from the app by hand (PDF or Excel, per currency).
- **No bank API can be called straight from the Kuna page.** OTP's and Revolut's own APIs need a licensed provider with an eIDAS certificate. The one aggregator that is free for a private person, Enable Banking, covers both banks but refuses browser calls (no CORS) and needs an RSA private key held somewhere other than the page.
- **Plainest v1:** OTP from the filed PDF, Revolut from a dropped Excel or CSV export, both read in the browser. An Enable Banking sync through a small Apps Script is a good v2 if the monthly Revolut export gets tedious.

## 1. OTP banka Hrvatska, personal accounts

### Formats and how they are downloaded

- OTPgo is both the mobile app and the web bank. OTP's product sheet lists "Preuzimanje izvoda po računu u PDF obliku" (statement download as PDF) and "Ugovaranje kanala dostave dokumenata" (choosing the delivery channel for documents) among OTPgo features. It also says not every feature is on both channels. Source: [Opće informacije o usluzi OTPgo](https://www.otpbanka.hr/sw/static/file/OI_OTPGo_0.pdf), linked from [otpbanka.hr/gradani/otpgo](https://www.otpbanka.hr/gradani/otpgo).
- **CSV, XLS, camt.053 or MT940 for a private customer: unconfirmed.** I found no OTP Croatia retail page that names an export format other than PDF. An older eLEMENT@ guide for companies and sole traders mentions Excel, TXT and camt.053 downloads, but that is the business channel and was seen only in a search snippet ([eLEMENT@ upute za tvrtke i obrtnike](https://www.otpbanka.hr/sites/default/files/doc/pdf/UPUTE%20ZA%20KORISNIKE_sve.pdf), unconfirmed). The owner can settle this in a minute by opening a personal account's transaction list in OTPgo web and looking for an export button.

### Email statements

- OTP's consumer payment terms say statements go out through the channel the customer agreed: a postal address, a verified e-mail address, the online banking app, or a branch (clause 19.4 of [Opći uvjeti pružanja usluga platnog prometa za potrošače, od 25.09.2026.](https://www.otpbanka.hr/sw/static/file/OpciuvjetipruzanjauslugaplatnogprometazapotrosaceOTPbanked.d._25.09.2026.pdf)).
- What OTP's statement mail looks like:
  - Sender: OTP's notification address, display name "OTP banka d.d.", subject "Izvod za eurski račun".
  - One attachment, `Izvod-eurski racun.pdf`, sent as `application/octet-stream`.
  - The body says the statement is attached "sukladno ugovorenoj dostavi dokumenta putem elektroničke pošte" and links a guide to checking the document's electronic signature ([upute za provjeru digitalnog potpisa](https://www.otpbanka.hr/sites/default/files/dokumenti/upute/upute_za_provjeru_digitalnog_potpisa_dokumenta.pdf), the link now returns an HTML page, not the PDF).
  - Rhythm: monthly, in the first days of the next month.
  - The same sender also mails "Obavijest o eksternom priljevu" (notice of an incoming payment). These are per-payment notices, not statements.
- **Password protection: unconfirmed, probably none.** The mail mentions only a digital signature, not a password. The PDF itself was not opened for this research. A signed PDF opens without a password but must not be rewritten if the signature should stay valid.
- **Attachment name has no date.** Every month's file is called `Izvod-eurski racun.pdf`. Company's `statementPdfNaming` falls back to `<mail day>-<bank name>` when the name lacks `IZV_yyyy_mm_dd`, so the filed name would be `<mail day>-Izvod-eurski racun.pdf`. That works, but the statement period must come from inside the PDF.

### PSD2 developer portal

- OTP's PSD2 page says the API portal opened on 14 March 2019 and production on 14 September 2019. It states: "TPP mogu biti samo pružatelji usluga platnog prometa koji su tražili ili već imaju licencu HNB-a" (only payment service providers that have or have applied for an HNB licence can be TPPs). The customer must have internet or mobile banking and approve each account with a token. Source: [otpbanka.hr/psd2](https://www.otpbanka.hr/psd2). The linked production host `api.otpbanka.hr` returned HTTP 503 to a plain request today.
- Standard: "OTP bank PSD2 API follows standards described in the Berlin Group standard version 1.3", with a pre-step OAuth flow and redirect or decoupled SCA. Consents carry `validUntil` and `frequencyPerDay`, and the transactions call takes `bookingStatus` of booked, pending or both. Source: [OTP Identity Access Manager: TPP User Guide v1.6, 08.07.2026](https://www.otpbanka.hr/sw/static/file/User_Guide_Produkcija_v1.6.pdf).
- Production registration is `POST /connect/register` over mutual TLS, and the TPP's role and authorisation number are read from its QWAC certificate. Source: same guide, and [Sandbox guide v1.2](https://www.otpbanka.hr/sw/static/file/User_Guide_Sandbox_v1.2.pdf).
- Sandbox: anyone can register at `apiportal.sandbox.otpbanka.hr/portal/` and generate self-signed test QWAC and QSEAL certificates. It returns "a small set of static data", never real accounts. Source: Sandbox guide v1.2.
- **Conclusion:** an unlicensed person cannot use OTP's production API for their own account. The sandbox is useless for real data. The only API route is through a licensed aggregator.

### PDF layout for parsing

- No public sample or layout description of an OTP Croatia retail PDF statement turned up. The nearest open-source work is a beancount importer for OTP Bank Hungary's PDF ([otpbank_pdf.py](https://git.marussy.com/beancount-extras-kris7t/tree/beancount_extras_kris7t/importers/otpbank/otpbank_pdf.py), seen only in a search result, a different bank and layout).
- A real filed statement is the only sample. Before building, put one month's PDF through a text extraction and check that it is text, not a scanned image, and that the columns come out in a stable order.
- Kuna has `pdf-lib`, which writes PDFs. Reading text needs a new dependency such as `pdfjs-dist`.

## 2. Revolut personal

### Statement exports

- In the mobile app: Home, tap Accounts, pick the currency, More, Statement, then "Select the timeframe, choose a document type (PDF or Excel), and tap 'Generate'". The statement includes "Pending, completed, and reverted transactions" and Pocket transactions. Source: [Revolut help, account statement per chosen currency](https://help.revolut.com/help/profile-and-plan/managing-my-account/account-statement-per-chosen-currency/), read from the [Wayback copy of 2025-08-04](https://web.archive.org/web/20250804000041/https://help.revolut.com/help/profile-and-plan/managing-my-account/account-statement-per-chosen-currency/).
- So the export is **per currency account**. Someone with EUR and USD pockets exports twice.
- The statement's closing balance is "available funds to spend plus pending transactions", which is why it can differ from the app balance. Source: [why is the balance on my statement different](https://web.archive.org/web/20231206005552/https://help.revolut.com/help/profile-and-plan/managing-my-account/why-is-the-balance-on-my-statement-different-from-the-balance-shown-in-my-app/) (Wayback, 2023-12-06).
- Whether the "Excel" choice delivers `.xlsx` or `.csv` is unconfirmed. Kuna's `loadImportFile` reads both through SheetJS, so it does not matter for the reader.
- Web app: unconfirmed. I could not load a current help page about statements from `app.revolut.com`.
- Business help pages list PDF, CSV, camt.053 and MT940 for Revolut Business only (search snippet, unconfirmed). That does not apply to a personal account.

### CSV columns

Revolut publishes no column definition. Two open-source parsers agree on the personal header:

`Type, Product, Started Date, Completed Date, Description, Amount, Fee, Currency, State, Balance`

- Source: the Revolut plugin of ledger-autosync in Debian, which I loaded ([revolut.py](https://sources.debian.org/src/ledger-autosync/1.2.0-1/examples/plugins/revolut.py)). It treats `State == "COMPLETED"` as cleared and `Type == "TOPUP"` as money in.
- A tax tool shows a variant with `Fiat amount`, `Fiat amount (inc. fees)` and `Base currency` columns, and offers a flag to "Merge two lines of a currency exchange into a single trade" ([revolutax README](https://github.com/brucify/revolutax)). So the layout has changed over time and an exchange is two rows.
- Types seen in these parsers: `CARD_PAYMENT`, `TOPUP`, `TRANSFER`, `EXCHANGE`. `Product` is `Current` or `Savings`. `State` values seen: `COMPLETED`, `PENDING`, `REVERTED`.
- There is **no transaction id column** in the personal export. A row key has to be built from the row's own fields.
- Kuna's Company import profile (`import_profile_<name>` in `src/apps/company/imports/domain/importProfile.ts`) already reads a CSV or XLSX by header names, a signed amount column, a balance column and a date format. It has no column for state, type, fee or a second date, which Revolut needs.

### Does Revolut email statements

No file. Revolut sends monthly "Your account statement is available" and "Your statement is ready" mails from its no-reply address, both with no attachment. One tells you to open Documents and Statements in the app, the other links to `revolut.com/app/statement`. Mail filing cannot pick up a Revolut statement.

### Open Banking API

- Revolut's Open Banking API is "the gateway for third-party providers". For production "you will need to use a valid OBIE or eIDAS transport certificate from a regulated Certificate Authority". Source: [Open Banking API reference](https://developer.revolut.com/docs/open-banking/open-banking-api), [Wayback copy of 2025-11-13](https://web.archive.org/web/20251113204842/https://developer.revolut.com/docs/open-banking/open-banking-api).
- Going live means uploading "your OBIE/eIDAS transport certificate" and a publicly resolvable JWKS URL. Source: [Set up production environment](https://web.archive.org/web/20251016005944/https://developer.revolut.com/docs/guides/build-banking-apps/get-started/setup-prod-environment) (Wayback, 2025-10-16).
- Consent in the EU lasts 180 days. A transactions call made "later than 5 minutes after the user authorised the consent" returns at most 90 days of history. Source: [Open Banking FAQs](https://web.archive.org/web/20251214173556/https://developer.revolut.com/docs/guides/build-banking-apps/faqs) (Wayback, 2025-12-14).
- **Conclusion:** an individual without a licence and a qualified eIDAS certificate cannot use it.

### Business API, and why it does not apply

The Business API is set up by uploading your own certificate "on the Business API settings page of the Revolut Business app" and consenting in that app. Source: [Make your first API request](https://web.archive.org/web/20251020150832/https://developer.revolut.com/docs/guides/manage-accounts/get-started/make-your-first-api-request) (Wayback, 2025-10-20). It works only on a Revolut Business account. A personal account has no such settings page, so the Business API cannot read it. It would only help if the owner moved personal spending to a Business account, which is not what the spending app is about.

## 3. Aggregators

| Aggregator                   | OTP Croatia             | Revolut                        | From a browser                           | Consent                               | Price for one person                              |
| ---------------------------- | ----------------------- | ------------------------------ | ---------------------------------------- | ------------------------------------- | ------------------------------------------------- |
| Enable Banking               | Yes, marked beta        | Yes                            | No, needs a function holding the RSA key | Up to 180 days                        | Free restricted mode for your own linked accounts |
| GoCardless Bank Account Data | Not checked             | Not checked                    | No (secret)                              | Docs say 90 days of continuous access | No new sign-ups since July 2025                   |
| Salt Edge                    | Not checked             | Not checked                    | No (App-id and Secret headers)           | Not checked                           | Company KYB, Test status ends after 90 days       |
| Tink                         | Croatia unconfirmed     | Not checked                    | No                                       | Not checked                           | Sales only                                        |
| TrueLayer                    | No Croatian bank listed | Yes in 14 EU countries plus UK | No                                       | Not checked                           | Sales only                                        |
| Yapily                       | Not checked             | Not checked                    | No                                       | Not checked                           | Sales only                                        |

### Enable Banking

- Coverage: the public list behind its site (`https://enablebanking.com/api/aspsps`, fetched today) has "OTP banka" in HR for personal and business, `beta: true`, `maximum_consent_validity` 15552000 seconds (180 days). Its personal login asks for a `userId` titled "Username", described as "Token serial number". "Revolut" in HR is listed for personal and business, not beta, also 180 days.
- Restricted mode: a production app is activated "by linking your own accounts to it", which allows "evaluation in real-life scenarios before a contract ... as well as individual non-commercial use". Only linked accounts return data. Source: [Whitelisting own accounts for restricted API usage](https://enablebanking.com/docs/api/linked-accounts/). The FAQ adds that "applications can't be made available to the public before a contract is signed" ([Enable Banking FAQ](https://enablebanking.com/docs/faq/)). For Kuna this means only the owner's linked accounts would work, never another user's.
- Price: Enable Banking's own FAQ gives only volume-based pricing through sales. That restricted mode is free comes from [Firefly III's Enable Banking tutorial](https://docs.firefly-iii.org/tutorials/data-importer/eb/) ("a free restricted mode that allows you to access your own bank accounts without a paid subscription"), a third party. Treat "free" as likely but not stated by Enable Banking itself.
- Auth: every call carries a JWT signed RS256 with the application's private key, valid at most 24 hours. The API reference says to keep the key secret and not expose it "to the client" ([API reference](https://enablebanking.com/docs/api/reference/)). The FAQ adds that one token reaches "all account information sessions" of the app.
- Browser: I sent a CORS preflight to `https://api.enablebanking.com/aspsps` with an `Origin` of `https://ipazanin.github.io`. The reply was HTTP 401 with no `Access-Control-Allow-Origin` header. So a page cannot call the API even if it held the key. A function in between is required.
- History: many banks give full history only for about an hour after consent, then 90 days (FAQ, "Why is only 90 days of transactions history available?"). The first sync should run right after the owner approves.
- Consent is set per session through `valid_until`, capped by the bank's `maximum_consent_validity`, which is 180 days for both banks here.

### GoCardless Bank Account Data (formerly Nordigen)

- Actual Budget's docs: "From July 2025 onwards, GoCardless has stopped accepting new Bank Account Data accounts" ([Actual, GoCardless setup](https://actualbudget.org/docs/advanced/bank-sync/gocardless/)). Its bank sync page labels GoCardless "not accepting new accounts" ([Actual bank sync](https://actualbudget.org/docs/advanced/bank-sync/)). GoCardless's own `gocardless.com/bank-account-data/` now redirects to a general open banking page. I found no GoCardless notice that states the closure in its own words, so the closure date is third-party.
- GoCardless docs say the API needs a "user secret" from its portal and gives "up to 24 months of transaction history as well as up to 90 days of continuous access" ([GoCardless Bank Account Data docs](https://docs.gocardless.com/docs/bank-account-data)). A CORS preflight to its token endpoint returned 200 with no `Access-Control-Allow-Origin`, so it is server-only too.
- Not usable for a new Kuna setup.

### Salt Edge

- Every request sends `App-id` and `Secret` headers, so it needs a server ([Salt Edge API v6 docs](https://docs.saltedge.com/v6/)).
- A new client is Pending with fake banks only. Moving on requires company information, and the Test status allows live banks for up to 100 connections but "is valid for 90 days". Live needs a legal and technical review. Same source.
- Not a fit for one private person.

### Tink

- Tink's pricing page: listed prices are "applicable exclusively to our existing customers", and new prospects "should contact our sales team" ([Tink pricing](https://tink.com/pricing/)). Croatian coverage: unconfirmed, no official market list found.

### TrueLayer

- Its public providers list (`auth.truelayer.com/api/providers`, fetched today) has 96 providers in 15 countries. Croatia is not among them. Revolut appears for the UK and 14 EU countries, including Lithuania where Revolut Bank UAB is registered. OTP Croatia is not covered. Pricing page returned 404.

### Yapily

- Pricing is "Tailored", through "Talk to an expert" ([Yapily pricing](https://www.yapily.com/pricing)). Enterprise sales, not personal use. Coverage not checked.

### Self-hosted tools and what they rely on

- **Actual Budget** supports GoCardless, SimpleFIN, Pluggy, Akahu and Enable Banking, and "The integration only works if you are using actual-server" ([Actual bank sync](https://actualbudget.org/docs/advanced/bank-sync/)). Enable Banking there is experimental and needs the App ID, the key file and an HTTPS redirect on your own domain ([Actual, Enable Banking](https://actualbudget.org/docs/advanced/bank-sync/enable-banking)).
- **Firefly III Data Importer** lists CSV, camt.05x, basiq.io, Enable Banking, FinTS, GoCardless, Sophtron, Lunch Flow, SimpleFIN and teller.io ([Firefly III Enable Banking tutorial](https://docs.firefly-iii.org/tutorials/data-importer/eb/), side menu). Its Enable Banking guide uses restricted mode and a production app with the key generated in the browser.
- **actual-ai** categorises transactions already in Actual with an LLM. It fetches nothing from banks itself. Unconfirmed: I did not load its repository.
- In Europe, every self-hosted path that reaches OTP and Revolut ends at Enable Banking today, always behind a server the user runs.

## 4. What fits a static browser app, ranked

### 1. Manual file import, by drag-and-drop or from a Drive folder

- Revolut: the owner exports each currency's Excel statement monthly and drops it in, or saves it to a Drive folder that Kuna reads. Company's tabular reader, SheetJS and header-found-by-name profiles already do most of it. New work: read `State`, `Type`, `Fee` and both dates, and build a row key.
- OTP: only PDF is confirmed, so this needs a PDF reader (new dependency) and a parser for one layout. If OTPgo web turns out to offer CSV or XLSX, the existing profile reader covers it with no PDF work.
- Setup for the owner: none for Revolut beyond a monthly export (about two minutes per currency). Cost: free.
- Weakness: it is manual, and a forgotten month leaves a hole.

### 2. Email statements filed from Gmail, as Company does

- OTP: works today. The mail arrives monthly with the PDF. Kuna's `statementMailSource` pattern (sender plus subject, then file into a year folder) can be copied for a personal statements folder. Setup for the owner: choose e-mail delivery with OTP, if it is not on already. Cost: free. The PDF parser from option 1 is still needed.
- Revolut: does not work. The mail has no attachment.

### 3. An aggregator behind a tiny serverless function

- Only Enable Banking fits (covers both banks, free restricted mode for own accounts, 180-day consent).
- **Google Apps Script, called with `scripts.run`.** The browser calls the Apps Script API with the owner's own Google token, which is a normal Google API call. The script keeps the RSA key in Script Properties, signs the JWT with `Utilities.computeRsaSha256Signature` ("A PEM formatted key", [Utilities reference](https://developers.google.com/apps-script/reference/utilities/utilities)), and calls Enable Banking with `UrlFetchApp`. Requirements, quoted from [Execute functions with the Apps Script API](https://developers.google.com/apps-script/api/how-tos/execute): deploy "as an API executable", the script and the OAuth client "share a common Google Cloud project" which must be "a standard Cloud project", and the token "must cover all the scopes used by the script". Kuna's Cloud project already exists, so this fits. Kuna would ask for the script's scopes, including outgoing requests, as another incremental grant.
- **Apps Script web app (`doGet`/`doPost`)** is the other Apps Script path. Its output is "redirected to a one-time URL at script.googleusercontent.com" ([Content Service guide](https://developers.google.com/apps-script/guides/content)). Running it "as me" for "anyone" makes a public URL that hands out bank data, so it needs its own secret check. Cross-origin behaviour of that redirect was not tested here. I would use `scripts.run`.
- **Cloudflare Worker:** the free plan gives "100,000 per day" requests and "10 milliseconds of CPU time per invocation" ([Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)). It holds the key as a secret and adds CORS headers for the Kuna origin. It needs a Cloudflare account and a way to check that the caller is the owner, for example by verifying the owner's Google ID token. That is new infrastructure Kuna does not have.
- Setup for the owner in either case: an Enable Banking account, a production application with a redirect URL on the Kuna site, linking the OTP and Revolut accounts in Enable Banking's panel (bank login and SCA for each), then the same bank SCA again for the API session. The owner repeats the bank approval every 180 days per bank. Cost: free, as far as the sources show.
- Risks: OTP is beta at Enable Banking. History beyond 90 days is only available in the first hour after consent. A free restricted mode can change terms, and Kuna can never offer this to another user without a contract.

## 5. Parsing rules

### Dedup between a statement and typed or receipt transactions

- A statement row is the truth for money that left the account. A typed or receipt entry is a claim about it. Match a statement row to a typed entry on the same account, the same amount to the cent, and a date window (the typed date between 3 days before and 7 days after the statement's transaction date). Prefer a counterparty text match when several qualify.
- Matching keeps the statement row and attaches the typed entry's category, note and receipt. A typed entry never becomes a second spending row once matched.
- Leave a near match (amount differs because of a tip, or the window is wider) for the owner to confirm. Never auto-merge two rows with different amounts.
- Re-imports: a row's key must survive a second export of an overlapping period. OTP's PDF probably carries a reference per row (unconfirmed until a sample is read). Revolut's export has none, so key it on account, currency, `Started Date` with time, amount, fee and description, plus a count among equal rows in the file, the way `readTabularStatement` already keys rows without a reference.

### Card payments that show days later

- Revolut gives `Started Date` (when the card was used) and `Completed Date` (when it settled). Use the started date as the spending date and the completed date for the balance.
- OTP's statement shows the booking day. A card payment can book two or three days after the purchase (unconfirmed for OTP's layout until a sample is read). If the PDF also prints the transaction day, use it for spending. Otherwise use the booking day and let the dedup window absorb the gap.
- Month edges: a purchase on 31 October that books on 2 November belongs to October's spending if the transaction date is known.

### Pending transactions in Revolut

- The export includes pending and reverted rows (Revolut help). A pending row has no completed date, and its amount can change when it settles (hotels, fuel, currency conversion).
- Simplest rule: import only `COMPLETED`. Skip `PENDING`, `REVERTED` and `DECLINED`. A pending row then appears in a later export as completed.
- Pending rows also sit inside the statement's closing balance, so a balance check must use the same rule Revolut uses or skip the check for Revolut.

### Currency exchange in Revolut, two legs

- An exchange is two `EXCHANGE` rows, one in each currency's statement, with the same started time ("Exchanged to USD" on the EUR side). The revolutax tool exists partly to merge these two lines.
- Treat the pair as a transfer between two of the owner's own accounts, not as spending. Pair them on the same started timestamp and opposite sign. If only one currency was exported, keep the single leg as an unpaired transfer and do not count it as spending.
- The fee, if any, is in the `Fee` column of the source leg. It is real spending (bank fees).

### Internal transfers between OTP and Revolut

- Example: the owner sends 200.00 EUR from OTP to the owner's Revolut EUR account. OTP shows a 200.00 debit to a Lithuanian IBAN with Revolut's name. Revolut shows a 200.00 `TOPUP` or `TRANSFER` credit a few minutes to a day later.
- Rule: a debit on one of the owner's accounts and a credit of the same amount on another of the owner's accounts within 3 days is a transfer. It is excluded from spending and income. The owner's own IBANs, held on the accounts tab, make this more certain than amount alone.
- An unmatched leg (the other statement not imported yet) stays marked "transfer, waiting for the other side" rather than counted as spending.
- A card top-up of Revolut from the OTP card shows on OTP as a card payment to Revolut. Treat it the same way, matched on amount and date.

## Proposal for OTP and Revolut v1, plainest first

1. **OTP from the PDF it already mails.** Copy Company's statement mail source for a personal statements folder (OTP's notification sender, subject "Izvod"). Add a PDF text reader and one OTP layout parser, built against real statement PDFs. If OTPgo web offers CSV or XLSX, drop the PDF parser and use the existing profile reader instead.
2. **Revolut from a dropped Excel export.** Drag-and-drop or a Drive folder, read by an extended tabular profile that knows `State`, `Type`, `Fee` and both dates. Completed rows only.
3. **Transfers and exchanges** are paired by rule and kept out of spending.
4. **Typed and receipt entries** attach to statement rows by account, exact amount and date window, with near matches left for the owner.
5. **Later, if the monthly Revolut export is a chore:** Enable Banking restricted mode behind an Apps Script called with `scripts.run`.

## Decisions only the owner can make

### How Revolut gets into Kuna

Situation: the Spending screen shows October, but Revolut has no file for October until the owner exports it. Today, a 12.40 EUR lunch paid with the Revolut card on 15 October is missing from the screen until the owner does.

- **Export by hand each month.** The owner exports each currency's Excel statement and drops it in. Nothing to set up. Two minutes a month per currency, and a skipped month leaves a gap until the owner catches up.
- **Sync through Enable Banking.** Kuna fetches new Revolut rows when opened, through a small Apps Script that holds the key. About an hour of setup, a bank approval every 180 days, and a dependency on a free tier that Enable Banking describes only for evaluation and individual non-commercial use. Works only for the owner's own linked accounts.

Recommendation: export by hand in v1. Add the sync if the export turns out to be a chore after two or three months.

### How OTP gets into Kuna

Situation: OTP mails the October statement as a PDF in the first days of November. A 45.00 EUR grocery bill paid with the OTP card on 28 October shows up in Kuna only after that mail is filed and read.

- **Read the mailed PDF.** No work for the owner. Data arrives once a month, a few days after the month ends. Costs a new PDF dependency and a parser that breaks if OTP changes its layout.
- **Export a CSV from OTPgo web, if it exists.** Same reader as Company's imports, no PDF work. The owner exports by hand each month, the same chore as Revolut.
- **Sync through Enable Banking.** Daily data, same setup and approval cycle as Revolut, and OTP is marked beta there, so it may break.

Recommendation: read the mailed PDF. First ask the owner to check OTPgo web for an export button, since a CSV would make this simpler.

### What happens to Revolut rows that are still pending

Situation: the owner exports on 1 November. A 60.00 EUR hotel hold from 31 October is still pending and may settle at 58.20 EUR on 3 November.

- **Skip pending rows.** October's total is short by 60.00 until the November export, which then lists the payment as completed at the real amount, possibly dated October. Nothing to reconcile.
- **Show pending rows as provisional.** October looks complete straight away, but Kuna must replace the provisional row when the completed one arrives with a different amount, and the export gives no id to link them.

Recommendation: skip pending rows.

### How sure a transfer match must be before Kuna hides it from spending

Situation: on 5 October OTP shows a 200.00 EUR payment to a Revolut IBAN, and on 6 October Revolut shows a 200.00 EUR top-up. On the same day the owner also paid a friend 200.00 EUR from OTP.

- **Pair automatically on the owner's own IBANs and amount within 3 days.** No clicks, and the friend's payment stays spending because the IBAN is not the owner's. A transfer to an IBAN Kuna does not know is counted as spending until the owner adds that account.
- **Suggest the pair and let the owner confirm.** Never wrong, but a click per transfer, and unconfirmed transfers inflate spending in the meantime.

Recommendation: pair automatically on own IBANs, and list the pairs on a review screen so a wrong pair can be undone.
