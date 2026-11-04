---
status: waiting
feature: investments
summary: The owner tries the fetched fund and company facts with their own vendor keys and reports what comes back.
---

# Check fetched facts with real keys

A holding's Details shows fetched fund and company facts, its domicile from the ISIN and its 52-week range. It warns plainly, naming the vendor, the symbol and what came back, when a vendor sends nothing usable. It shipped without a test against live vendor keys, since none were saved.

## Waiting on

The owner's own try with Alpha Vantage, Twelve Data and Finnhub keys, including whether Alpha Vantage's ETF_PROFILE answers for a European listing. Anything that looks wrong comes back as a fix.

## Docs

- [Investments views plan](../features/investments/views-plan.md)
