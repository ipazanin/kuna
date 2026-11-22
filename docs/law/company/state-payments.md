---
checked: 2026-11-04
nn_through: 18/26
summary: How a d.o.o. pays the state, the Naputak's revenue codes with model HR68, the contribution accounts, and the category rules new books start with for each
---

# State payments

How a Croatian d.o.o. pays its taxes and contributions, and the category rules Kuna seeds in new books so those payments file themselves. Each year the Ministry of Finance issues a Naputak o načinu uplaćivanja prihoda proračuna, obveznih doprinosa te prihoda za financiranje drugih javnih potreba, which names the account, the model and the revenue code of each payment. The 2026 one is NN 18/26. Law as researched on 4 November 2026, in NN 18/26 alone: its amendment in NN 39/26 was not loaded, and no later issue was checked.

The codes are the same for every d.o.o., so they are law, not the owner's choice of payee. The seeded rules are ordinary rows of the rules tab at review confidence: the owner confirms the first match, and edits or deletes a rule like any other. A later Naputak reaches new books through a new version of the ruleset's rule, and existing books by hand on Settings, Category rules.

## Revenue codes

The reference of a payment to the state budget reads `HR68 <revenue code>-<OIB>-<period>`. Kuna reads the four-digit revenue code from it and files the row by the code. The ruleset holds the codes as `hr.state.revenue-codes`, shown on Settings, Tax rules.

| Year | Payment                     | Code | Model | Category                |
| ---- | --------------------------- | ---- | ----- | ----------------------- |
| 2026 | VAT                         | 1201 | HR68  | `vat`                   |
| 2026 | Profit tax                  | 1651 | HR68  | `corporate-income-tax`  |
| 2026 | Pension insurance, pillar I | 8168 | HR68  | `payroll-contributions` |

Kuna strips the model from the reference before it reads the code, so a rule cannot require HR68. The model is in each rule's note and in this table.

Mark: `confirmed-nn`.

## Contribution accounts

Pillar I goes to the state budget's account, which VAT and profit tax share, so its rule goes by the revenue code. Pillar II and health insurance have accounts of their own, so their rules go by the counterparty's IBAN.

| Payment                      | Account                 | Category                |
| ---------------------------- | ----------------------- | ----------------------- |
| Pension insurance, pillar II | `HR7610010051700036001` | `payroll-contributions` |
| Health insurance             | `HR6510010051550100001` | `payroll-contributions` |

The accounts are `CONTRIBUTION_ACCOUNTS` in `src/apps/company/packs/hr-doo/domain/salaries/contributionAccounts.ts`, from heads II, IV and V of the Naputak.

Mark: `confirmed-nn`.

## Interest on late payments

Interest on a tax or contribution paid late goes to the same account under the same revenue code as the payment itself. The Naputak names no code of its own for it: the only interest codes in NN 18/26 are for other kinds of income, such as 5401 060 "Prihodi za zatezne kamate iz obveznih odnosa za obvezno zdravstveno osiguranje", which is interest under the law of obligations and not on a contribution. OPZ Art. 128(1) collects interest out of a payment for the same kind of tax first: "iz uplaćenog iznosa, najprije se naplaćuju kamate i troškovi ovrhe, a nakon toga glavni porezni dug iste vrste poreza".

So the account and the code cannot tell the interest from the payment, and only the payment's description can. Kuna seeds a rule ahead of each state payment rule that files a debit to the same account or code as late payment interest when its description holds "kamat", as in "kamata" or "zatezne kamate". The rule waits on review like the others. A description that names no interest files as the payment itself, and the owner moves the row by hand.

The category `late-payment-interest` is a deductible cost in the taxes bucket, with neither the `arrears` nor the `owner-pay-tax` modifier, so the payday's reconciliation and the accruals leave it alone. ZPD Art. 7(1)(8) adds back default interest only between related parties: "za zatezne kamate između povezanih osoba". The state is not a related party, so the interest stays an allowed cost. A cost in the taxes bucket counts on other costs, as [Profit and loss lines](tax-classes.md#profit-and-loss-lines) says, and the accountant's konto lines move it to another line. Whether accountants book default interest on financial expenses, group 47 of the RRiF chart, was not checked in the chart, so that is `unconfirmed`.

Mark: `confirmed-consolidated` for OPZ Art. 128(1) and ZPD Art. 7(1)(8), read in the zakon.hr consolidated texts on 22 November 2026. The Naputak's lack of a code is `confirmed-nn`, read in NN 18/26 the same day. Reading a payment's description for "kamat" is a `reading`, since no act says what a payer writes there.

## Payments not seeded

- The health contribution's revenue codes, the income tax on a dividend and the income tax on a salary were seen only in a summary of the Naputak's page, not in its text. None of them is seeded. The health contribution goes by its account, and the two income taxes by the owner's own rules.
- Code 1686 is the profit tax withheld on a dividend paid to a foreign company under ZPD Art. 31, not the tax on a member's dividend, so it is not seeded.

## Open points

- The part of the Naputak read names 1651 for profit tax and no separate code for the monthly advance. Whether the advance also uses 1651 is `unconfirmed`, so the 1651 rule's note says it covers what the Naputak calls "porez na dobit".
- Whether a d.o.o. may pay an advance on this year's profit (_predujam dobiti_) is not settled. Research of 7 November 2026 found company law silent on it for a d.o.o., and the tax law assumes advances exist without granting them, which needs a court decision or a Porezna uprava opinion. The company acts behind that finding were not loaded in this session, so the point is `unconfirmed` here. The Year tab's Pay part marks the interim payout option as a reading. Whether retained profit from earlier years may join the advance is also open. Kuna takes the cautious reading, and the interim option pays no more than the year's profit after tax so far. The tie to this year's profit rests on ZPD Art. 10.a, which weighs an advance against the profit made in the tax period ("istekom tog poreznog razdoblja ostvarena dobit"). PravPD Art. 35.a adds that the advance goes up to the amount an interim income statement shows, but on its own it does not say whose profit that is. The shortfall that Art. 10.a taxes as the owner's income is measured the same way: the year's own profit after tax covers the advance, and profit retained from earlier years does not. What the year paid out comes off retained profit first, since the ledger does not tell a dividend from an earlier advance, and only the rest, with any losses brought forward, comes off the year's profit, in both the cap and the cover. Retained profit from earlier years is paid out now through the Pay part's kept profit option.
- Which paragraph of PravPD Art. 35.a holds the interim statement wording is `unconfirmed`. The overview research notes put it in paragraph 3 of the NN 123/10 text, the year-end profit tax research cites paragraph 2, and the current consolidated wording was not loaded. Kuna cites the article without a paragraph, as the shortfall rule's source does.
- The amendment of the Naputak in NN 39/26 was not loaded. It may change a code. It is on the [watch list](../sources/watch-list.md#company-classes).

## Sources

- Opći porezni zakon, Art. 128(1), the order in which a payment settles interest and the tax of the same kind. https://www.zakon.hr/z/100/Op%C4%87i-porezni-zakon, consolidated text, loaded on 22 November 2026.
- Zakon o porezu na dobit, Art. 7(1)(8), default interest between related parties added back. https://www.zakon.hr/z/99/Zakon-o-porezu-na-dobit, consolidated text, loaded on 22 November 2026.
- Naputak o načinu uplaćivanja prihoda proračuna, obveznih doprinosa te prihoda za financiranje drugih javnih potreba u 2026. godini, NN 18/26: codes 1201, 1651 and 8168 under head II, points 1.1.2, 1.11 and 1.2.1, with model HR68, and the accounts of heads II, IV and V. https://narodne-novine.nn.hr/clanci/sluzbeni/2026_02_18_197.html, loaded on 4 November 2026. The fetch returned quotes for the first part of the page and a summary for the second.
