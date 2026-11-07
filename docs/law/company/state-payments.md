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

## Payments not seeded

- The health contribution's revenue codes, the income tax on a dividend and the income tax on a salary were seen only in a summary of the Naputak's page, not in its text. None of them is seeded. The health contribution goes by its account, and the two income taxes by the owner's own rules.
- Code 1686 is the profit tax withheld on a dividend paid to a foreign company under ZPD Art. 31, not the tax on a member's dividend, so it is not seeded.

## Open points

- The part of the Naputak read names 1651 for profit tax and no separate code for the monthly advance. Whether the advance also uses 1651 is `unconfirmed`, so the 1651 rule's note says it covers what the Naputak calls "porez na dobit".
- Whether a d.o.o. may pay an advance on this year's profit (_predujam dobiti_) is not settled. Research of 7 November 2026 found company law silent on it for a d.o.o., and the tax law assumes advances exist without granting them, which needs a court decision or a Porezna uprava opinion. The company acts behind that finding were not loaded in this session, so the point is `unconfirmed` here. The Year tab's Pay part marks the interim payout option as a reading. Whether PravPD Art. 35.a(2) lets the retained profit join the interim amount, as `dividendCapacity.ts` adds it, is also open.
- The amendment of the Naputak in NN 39/26 was not loaded. It may change a code. It is on the [watch list](../sources/watch-list.md#company-classes).

## Sources

- Naputak o načinu uplaćivanja prihoda proračuna, obveznih doprinosa te prihoda za financiranje drugih javnih potreba u 2026. godini, NN 18/26: codes 1201, 1651 and 8168 under head II, points 1.1.2, 1.11 and 1.2.1, with model HR68, and the accounts of heads II, IV and V. https://narodne-novine.nn.hr/clanci/sluzbeni/2026_02_18_197.html, loaded on 4 November 2026. The fetch returned quotes for the first part of the page and a summary for the second.
