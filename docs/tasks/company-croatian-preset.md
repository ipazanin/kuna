---
status: planned
feature: company
summary: A Croatian d.o.o. preset for the company app's categories, roles and rules, taken from the law.
---

# A Croatian company preset

Today the company app's categories, buckets and categorisation rules are made by the user. Much of it is set by Croatian law, so it could ship as a preset for a Croatian d.o.o.

## Findings

- The role names are already fixed by the pack. Settings refuses a role outside core's and the pack's list. What the user makes is which categories exist, which roles each carries, the bucket, the VAT treatment and the owner share.
- New books get a generic freelancer set with no representation, personal-transport, non-deductible, capital-purchase or tax roles, so a new user's corporate tax base adds nothing back. No rules are seeded.
- Role, VAT treatment and bucket are independent columns, so nothing stops a contradiction, and no role carries a citation.
- The law fixes the tax class of a cost (representation, personal car, fines and private costs, capital purchase, donations), the payments to people (salary, non-taxable items, dividend, rent, private use), and the state accounts and revenue codes in the yearly Naputak. No chart of accounts is prescribed, so konto numbers stay the accountant's.

## Proposal

Keep the `roles` column. Add one pack-owned list of tax classes in `packs/hr-doo/preset/domain/`, each with the ruleset rule ids it draws figures from, the VAT treatments and buckets it allows, dates in law, and a `docs/law/company/` anchor. A category carries at most one class. Seed new books with a Croatian set from those classes, report contradictions in existing books, and change nothing in the file format.

1. Classes and citations, with law docs and a spec that ties each class to the ruleset. No figure changes.
2. Guards in the category editor.
3. The Croatian seed for new books.
4. A one-time review of the owner's categories, with `check:figures` before and after.
5. Optional: state-payment rules from the Naputak by year, a preset version with a "new class" notice, and Croatian VAT values moved out of core.

## Open decisions

- A. When a category contradicts its class, the class decides, or the app only warns. Recommended: the class decides.
- B. The class lives in the roles column, or in a new `tax_class` column. Recommended: the roles column.
- C. New books always get the Croatian set, or only with the owner-pay module on. Recommended: always.
- D. The owner's existing categories get one review with suggestions, or only a list of what is missing. Recommended: the review.
- E. The class list covers only what Kuna computes today plus car insurance and interest, or also donations and promotional items. Recommended: the first, donations next.
- F. Company law docs go in `docs/law/company/` alone, or Investments moves to `docs/law/investments/` too. Recommended: move both.
- G. Seed the state-payment rules from the Naputak, or leave rules user-made. Recommended: seed them.

## To reproduce

Three suspected bugs, found by reading the code and not yet reproduced:

- A representation category set to reclaim VAT still counts that VAT in the year's reclaimable input VAT (`accrualYear.ts:200-203`).
- A category with both the representation and the non-deductible role would be added back twice (`accrualYear.ts:304-328`).
- The forecast's representation figure (`forecastYear.ts:347`) leaves out the VAT that the year-end figure puts back.

## Docs

- [A Croatian d.o.o. preset for Company categories](../features/company/research/croatian-preset/preset.md)

The build plan is written and waits for the owner's review: [the Croatian preset plan](../features/company/croatian-preset-plan.md).
