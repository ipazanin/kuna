---
paths:
  - 'src/apps/**'
  - 'src/shared/money/**'
  - 'src/shared/app/**'
---

# Money and percentages

- Amounts are `Money`, whole cents in the module's base currency. A foreign amount is a `Decimal` beside a `CurrencyCode`. Spending's rows hold cents of the account's own currency, kept apart from `euros`. `eurosAtEcbRate` is the only conversion.
- A rate applied to money is a `Percent`, in basis points. A measured ratio is a `Share`, where 1 is the whole. Formatters take a `Share`. Loans keeps `YearlyRate`, and `OwnerShare` and `Decimal` percents stay as they are.
- Round only through `src/shared/money`, half away from zero to the cent, once per business line, and let totals add rounded lines. Half away from zero is Kuna's convention, since `docs/law` states no rounding rule.
- Every split rounds a running sum, so no cent is lost and no part goes below zero. `moneyParts` owns that. Never write another split.
- Float is fine for measured ratios and what-ifs, ending in one rounding through the owner.
- Never cast to `Money`, `Percent`, `Share` or `Decimal`, and never write `/ 100`, `* 100` or `10_000` outside `src/shared/money`. Lint refuses both (`kuna/money-casts`, `kuna/money-scale`).
- A cell or a field states its scale. Never guess a scale from the size of a number. Each parser of a rate gets a table test that names `0.8`.
- A brand stays a primitive. Never give a figure a class, since `check:figures` reads object shapes.
- A refactor keeps `check:figures` identical. Renaming a key or changing a scale moves it.
