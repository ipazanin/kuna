# Accountant files without xlsx parsers

What the app loses and keeps when it stops reading the accountant's xlsx, and which fixed-format XML can replace them.

The owner, 2026-10-27: "we shouldnt write parsers for .xlsx files, those could be some files my accountant uses but not other, we can parse .xml files that are in always static format".

## The answer

- **Delete both xlsx readers.** The VAT return reader and the salary workbook reader are the only code that reads the accountant's files. Together with their Drive walk, cache, sync step, cards, fakes, parity script and check flows, that is about 3,500 lines.
- **Payroll needs no accountant file.** The app's payroll engine against the bank already covers the payslip's contributions and tax. In every month on the owner's books, pillar I, pillar II, health and tax in the payment orders equal the workbook to the cent, and the same amounts reach the ledger. What the bank cannot show is the gross and net split and the split of non-taxable payments. Those come from the engine, run from the employees tab and the ruleset.
- **JOPPD is the one fixed-format payroll file worth reading later.** It is the legal monthly filing, with a published Porezna uprava schema (`ObrazacJOPPD/v1-1`), and it carries every payslip line per employee: gross, contributions, tax, surtax, non-taxable code and amount, and the amount paid. The accountant files one for every payout. They don't mail it today.
- **The payment-order XML (pain.001) is not worth a parser.** It is a national standard (sepa.hr, Fina). But it can't give gross or net, and it lumps non-taxable payments into the net transfer. The bank rows already carry the same amounts.
- **VAT has a fixed-format XML, the ePorezna PDV return.** It uses a published schema (`ObrazacPDV` v10 for periods up to 2025, v11 for 2026). It carries the month's totals, the VAT to pay or refund (`Podatak400`) and the refund asked for (`Povrat`). It has no carry-forward balance and no per-invoice sales lines. Anyone with VAT access for the company can download it from ePorezna under "Pregled dostavljenih obrazaca". It's unconfirmed whether the owner's own login lists the returns the accountant submitted.

## What goes and what stays

| Today                                                                              | After                                                                                                |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Year, Taxes, "VAT returns" card: Carry, Refund, Sales per invoice, No return filed | Gone until a PDV XML arrives. The app's own VAT position and the VAT paid and refunded by month stay |
| Year, Taxes, "Payroll from the accountant" card: Bank and Rules badges             | Gone. The Salaries page already checks the engine against the bank                                   |
| Salaries: payslip, app and bank per payday                                         | App and bank per payday. The payslip column goes                                                     |
| `hr_accountant_sync` and the Accountant sync step                                  | Gone                                                                                                 |
| `hr_vat_returns_folder`, `hr_payroll_folder`                                       | Kept as the folders mail files into                                                                  |
| `parity:accountant`                                                                | Gone                                                                                                 |
| Mail filing of the xlsx, IP1 and payment-order files                               | Kept as an archive that nothing reads, behind the per-kind switch                                    |

The Year "Accountant" tab and `parity:year-end` stay. They read the year-end lines typed into the books, not files.

## Decisions for the owner

1. **Payroll's third source.** Engine against bank only, or also the JOPPD XML when the accountant sends it? Recommendation: engine against bank now. Ask the accountant for the JOPPD XML each month, and add a JOPPD reader as its own stage once one arrives.
2. **VAT.** Drop the accountant VAT check, or read the PDV XML? Recommendation: ask the accountant to mail the PDV XML with each return. Until one arrives, the card goes. When it does, Carry is rebuilt from the run of monthly `Podatak400` values, Refund from `Povrat`, and Sales becomes a month total.
3. **The hand-made Sheets.** With no reader, they are copies of the accountant's xlsx. Recommendation: once stage 7 has filed the xlsx from mail, stage the Sheets in `_to-delete/`.

## The owner's answers, 2026-10-27

1. Ledger first: "we should try to have everything on ledger (bank statements) logic and only expand when necessary". Payroll is the engine against the bank. No JOPPD for now.
2. No VAT XML. VAT is derived from the ledger, from each category's VAT treatment and whether it can be reclaimed. The owner checks the app's figures against the accountant's returns himself.
3. Move the hand-made Sheets to `_to-delete/`, after stage 7 has filed the xlsx from mail.

## Found on the way

- One month's workbook total is off by the health amount, because it adds gross I where it should add gross II. The XML is right.
- A bonus paid by its own payment order appears on no workbook.
- A few payroll rows of a few cents have no order behind them.
- Erste statements carry each payroll payment's purpose and HR69 reference, with the revenue code (8168 pillar I, 2283 pillar II, 8486 health, 1880 tax, NN 18/26). Rows from a bank that sends only PDFs don't.

## Sources

- [XML shema obrasca PDV](https://porezna-uprava.gov.hr/hr/xml-shema-obrasca-pdv/8229), [Korisničke upute – Obrazac PDV](https://e-porezna.porezna-uprava.hr/Upute/G2B/Korisni%C4%8Dke%20upute%20-%20Obrazac%20PDV.pdf)
- [JOPPD](https://porezna-uprava.gov.hr/en/joppd/3956), [JOPPD form](https://porezna-uprava.gov.hr/UserDocsImages/Arhiva/HR_obrasci/Documents/POREZ%20NA%20DOHODAK/JOPPD.pdf?vel=1253556)
- [sepa.hr pain.001 guide](https://sepa.hr/wp-content/uploads/2025/12/SCT-Uputa-za-klijente-pain.001-za-5.10.2025-izmjena.pdf), [Naputak NN 18/26](https://narodne-novine.nn.hr/clanci/sluzbeni/2026_02_18_197.html)
