---
status: planned
feature: assets
summary: A fourth app for a flat, a car and other things the owner has, with values carried forward and the mortgage linked through Loans.
---

# Assets v1

Assets becomes a fourth app at `#/assets`, with its own file `kuna-assets.json`, first run, Settings, home card and part of Kuna's Overview. It keeps two kinds, `asset` and `valuation`, in euros.

## Decisions so far

- A flat's value is carried forward by the DZS house price index for its region, from the newest typed valuation or the price paid. It is worked out on load, shown as an estimate with its quarter, and never stored.
- A car is estimated from its price paid and first registration by the customs table of NN 1/2017, until a valuation is typed. The table's rows go into a `docs/law` file that the law spec compares with the code.
- The mortgage link is in v1. An asset names its bank loan from the list Loans publishes in `src/apps/loans/facts.ts`, the first import across apps the boundary spec allows.
- Kuna's Overview leads with "What you own less what you owe", and its line names bank accounts as left out. It becomes "Net worth" once a spending app brings bank accounts.
- Assets is its own app, with no remove-file action, no deposits or cash and no pension pillars. The company stays in its own card and is never added in.
- v1 counts an asset's full value and its loan in full, with the model left easy to extend with an ownership share.
- The find-or-pick resume that Loans and Investments repeat moves to `src/shared/storage/presentation/resumeFileLookup.ts` in the same commit.

## Open

- The plan is written and answered. The build waits for this docs move, then runs as one commit in seven stages.
- A POST to the DZS from Firefox on the deployed site is still to try before the values stage lands.
- Later amendments to the NN 1/2017 table were not looked for, and the table has no row past 180 months.
- Co-ownership is its own task, [Co-owned assets and loans](assets-ownership-share.md).

## Docs

- [Assets plan](../features/assets/plan.md)
- [Code research](../features/assets/research/lane1-code.md) and [domain research](../features/assets/research/lane2-domain.md)
- [Module map](../architecture/modules.md)
