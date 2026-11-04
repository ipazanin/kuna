---
status: done
feature: investments
summary: A third app for every buy and sell, with FIFO lots, daily prices and returns.
---

# Investments

Investments keeps what the brokers booked in `kuna-investments.json` and works everything else out: FIFO lots, cash per account, exact decimals, and euros at the ECB rate of each day. Prices are fetched once a day from free vendors with the user's own keys, which sync through Drive's hidden app folder. A workbook import, Performance with time- and money-weighted returns, and a benchmark came with it.

## Docs

- [Investments plan](../features/investments/plan.md)
