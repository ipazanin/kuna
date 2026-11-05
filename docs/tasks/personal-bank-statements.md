---
status: building
feature: spending
summary: OTP and Revolut statements read into the spending app.
---

# Personal bank statements

Fetch and parse personal bank statements into spending, starting with OTP and Revolut.

## What the research found

- No bank API can be called from the page. OTP's PSD2 API and Revolut's open banking API both need a regulated licence and certificate.
- OTP mails a monthly PDF statement with the same file name every month. A CSV or camt export for private customers is unconfirmed.
- Revolut exports per currency as PDF or Excel, with the columns Type, Product, Started Date, Completed Date, Description, Amount, Fee, Currency, State and Balance. It has no transaction id, an exchange is two rows, and it mails only a notice.
- Of the aggregators, only Enable Banking covers OTP Croatia (in beta) and Revolut, with consent for 180 days, and allows individual non-commercial use. It cannot be called from a browser, since it has no CORS and wants a signed JWT, so it would need a small Apps Script or Worker. GoCardless has taken no new accounts since July 2025.

## Proposal

OTP from the mailed PDF, with a new `pdfjs-dist` dependency and a parser built against real statements. Revolut from a dropped Excel export, completed rows only. Transfers and exchanges are paired automatically. Enable Banking comes later if the export becomes a chore. The rules engine core moves to `src/shared` first, as the [module map](../architecture/modules.md) orders, and the company's camt and spreadsheet readers stay in Company.

## Where it stands

Built: a dropped Revolut export read as a dry run with one Undo, typed rows filled, transfer and exchange pairs, the To review tab, rules with Always for this payee, Settings' Rules tab and the home card's waiting line. No real export has been read yet.

Waits for a real OTP statement PDF: `pdfjs-dist`, `pdfText.ts`, `otpStatement`, the OTP mail source with the `setting` kind, the sync's mail and statements steps, Settings' Statements tab and `spending-import-otp`. OTP's reader hands the dry run the same `StatementRows` as Revolut's.

## Open

- Whether OTP's web banking offers an export for private customers.

## Docs

- [Statement research](../features/spending/research/lane4-statements.md)

The build plan: [the spending plan, stages 2 and 3](../features/spending/plan.md).
