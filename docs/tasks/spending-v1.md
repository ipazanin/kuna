---
status: planned
feature: spending
summary: A personal spending app with accounts, typed spending, two-level categories, budgets and analytics.
---

# Spending v1

A fifth app for personal money: several accounts (bank, cash and savings), spending typed by hand, categories with subcategories, budgets and analytics. Receipts and bank statements come later, as [receipt reading](receipt-reading.md) and [personal bank statements](personal-bank-statements.md).

## What the research found

- Spending gets its own small transaction type rather than the company's bank-statement ledger, which 117 files import. A shared ledger core would pull owner share and the balance chain into spending.
- Six records: account, transaction, category with a parent, budget from a month on, rule, and receipt with its lines. A transfer is two rows in a transfer category.
- v1 imports none of the company's code. What both apps change for the same reason moves into `src/shared` first, each move in its own commit with `check:figures` identical. The [module map](../architecture/modules.md) lists the moves and their order.
- Analytics ranked by use: by category with drill-down, budget against actual, 12-month trends, income against spending with the savings rate, and top payees. Entry starts from the amount, and cash is an account of its own.

## Decisions answered

- A two-level starter set of about 11 groups with Croatian names.
- Monthly limits with carry-over. What is left rolls into next month's limit, and overspending lowers it.
- One account per held Revolut currency, so an exchange is a transfer.
- A loan instalment counts as spending in v1, and money sent to the broker counts as saving.

## Open

- Typing on a bank account before statements exist. The research recommends typing anywhere and letting the statement import pair a row of the same amount within five days.
- Which rate turns another currency into euros. The research recommends the ECB rate of the day, the rule Investments uses.
- Who owns a personal account. The research recommends that spending owns bank, cash and savings accounts while Loans and Investments keep their own records.
- More decisions to ask, then the plan, which stops for the owner's review.

## Docs

- [Code and data model](../features/spending/research/lane1-code.md)
- [Product research](../features/spending/research/lane2-product.md)
- [Module map](../architecture/modules.md)

The build plan is written and waits for the owner's review: [the spending plan](../features/spending/plan.md).
