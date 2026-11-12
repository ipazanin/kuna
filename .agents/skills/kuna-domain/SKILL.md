---
name: kuna-domain
description: Load before adding a value type, a brand, a domain model or a shared module in Kuna, before moving a figure between layers, and before any refactor that must keep check:figures identical. Holds how to pick a value type, the table of scales, what belongs in which layer, how the digest reads shapes, and the mechanical checks with their baselines.
---

# Kuna domain

The short rules are in `.claude/rules/kuna-money.md` and `.claude/rules/kuna-domain.md`. This holds the reasoning behind them. The [research](../../../docs/architecture/research/money-and-domain-types.md) holds the evidence and the owner's answers.

## Picking a value type

Use the type that already holds the concept. Add a brand only when all of these hold:

- Two values with the same runtime type can be swapped by mistake, and the swap gives a wrong figure with no error.
- The brand has one maker or a small set of them, in one file, which refuses what is not that value.
- Something reads it. A brand with no function that needs it is noise.

A brand stays a primitive. `===`, `<`, sorting, JSON and `structuredClone` keep working, Vue has nothing to proxy, and the digest's hash stays the same. Declare one in a file `tests/importBoundaries.spec.ts` lists, and add the file to that list in the same change.

Do not build a generic `Scaled<Unit>`, an add or multiply for percents with no caller, a `Fraction` apart from `Share`, or a currency on `Money`. `Money` holds one currency per module. A `CurrencyAmount` is worth adding on the day a function must add foreign amounts across records.

## Scales

| Scale                | Type         | Holds                                                                                         | Applied to money by                    |
| -------------------- | ------------ | --------------------------------------------------------------------------------------------- | -------------------------------------- |
| Basis points         | `Percent`    | Rates the law states, coefficients, VAT                                                       | `moneyAt` and the rest of `percent.ts` |
| Ratio where 1 is all | `Share`      | What `ratioOf` measures, and a return `shareFromRatio` makes. A gain can be below 0 or over 1 | Never. Formatters take it              |
| Millionths           | `YearlyRate` | A bank's rate with four decimals of a percent                                                 | `monthlyInterest`, `annuity`, in Loans |
| Whole percent, 0-100 | `OwnerShare` | An owner's share, whole by that feature's rule                                                | `ownerPartOf`                          |
| Percent, exact       | `Decimal`    | `target.percent`, TER, fund weights, check thresholds                                         | `partOf`, `fundCost`                   |
| Fraction, exact      | `Decimal`    | `spinOff.costShare`, stored 0 to 1                                                            | `lots.ts`                              |

The key `rate` means basis points in hr-doo, millionths in Loans, a fraction in Investments' `portfolio` and an exchange rate in Investments' records. Read the type, never the name. Where two scales meet, convert by a named function, and give the parser a table test.

## Rounding

Each line with a meaning of its own rounds once, and totals add the rounded lines. A payroll line, a lot's gain in euros, a payment's tax and a loan's interest are such lines. Rounding a total and rounding its lines give different cents, so changing which one a figure does moves it.

## What belongs where

| Layer            | Holds                                                         | Never holds                                    |
| ---------------- | ------------------------------------------------------------- | ---------------------------------------------- |
| `domain`         | Records, invariants, every figure a screen shows              | Words on a screen, Vue, adapters, `Math.round` |
| `application`    | Stores and flows that wire a use case together                | Infrastructure, outside the wiring files       |
| `infrastructure` | Adapters to files, Drive, cells and the network               | Business rules                                 |
| `presentation`   | Components, words, and formatting a figure the domain gave it | Rates, parsing a rate, a figure of its own     |
| `src/shared`     | What two modules use and change for the same reason           | An app's records                               |

The [module map](../../../docs/architecture/modules.md) says what each module owns and may import. Models are immutable records with pure functions beside them. That is Evans's side-effect-free functions, and classes add nothing. One write touches one file, so the file is the largest transaction. Keep an invariant in one function that the reader and the write both call, and add no roots or repositories per record kind.

## How the digest reads shapes

`digestOf` in `scripts/figure-digest.mjs` hashes a primitive's JSON, or its digits for a bigint, and an object by its sorted keys, leaving out functions and undefined.

- A brand change is erased at runtime, so it moves nothing.
- A renamed key moves that group, and so does a changed scale.
- A figure that becomes a class with public fields hashes as a record instead of a number, so every group holding it moves. So does nesting an amount and its currency into one object.
- A class with `#private` fields has no keys, so every value hashes alike and the check goes blind without failing.
- A Spending group hashes each row and account, and Company's records each ledger row, without the fields and stored cells `scripts/support/figureFields.mjs` leaves out, wherever they sit. A new field or cell on one fails `tests/figureFields.spec.ts` until it is named a figure or left out.

To check a refactor, run `npm run check:figures` on both trees with the same `--today`, over each fake set and the owner's real exports, and diff the output. The digest sees no words, so a parser or format change also needs a table test.

A change that means to move a figure states it. Land it in a commit of its own, name each group that moves and why, and show one figure before and after. If a filed tax year moves, stop for the owner first.

## Moving a figure out of presentation

`src/apps/assets/values/presentation/assetsOnDay.ts` computes each asset's value and equity, and the digest imports it, so it is a rule in the wrong layer.

1. Move it to `src/apps/assets/values/domain/`, with what it computes unchanged.
2. Domain code imports only domain code, so the boundary spec now names its two outside imports: `HouseIndexState` from `presentation` and `AssetLoan` from `application`. Give the function a small domain type for what it reads, and let `presentation` and `application` hand that in.
3. Leave `LoansOnScreen`'s `'opening'` and `'failed'` as a domain state only if a figure depends on them. Words for them stay in `presentation`.
4. Update the importers, including `scripts/figure-digest.mjs`, and remove the file from `FIGURES_IN_PRESENTATION` in the boundary spec.
5. Compare the digests. No key changed, so every group stays identical.

## The checks

| Rule                                | Check                            | Baseline                                            |
| ----------------------------------- | -------------------------------- | --------------------------------------------------- |
| No cast to a money brand            | `kuna/money-casts`               | `moneyCasts` in `scripts/lint-baseline.json`, empty |
| No hand scaling by 100 or 10,000    | `kuna/money-scale`               | `moneyScale`, empty                                 |
| No `Math.round` in domain code      | `kuna/domain-rounding`           | `domainRounding`, empty                             |
| No `words` import in domain code    | `kuna/domain-words`              | `domainWords`, only shrinks                         |
| Formatters take a brand             | `npm run typecheck`              | None                                                |
| No class in domain code             | `kuna/domain-classes`            | None                                                |
| Brands declared by their owners     | `tests/importBoundaries.spec.ts` | `BRAND_OWNERS`                                      |
| Digest reads no presentation module | `tests/importBoundaries.spec.ts` | `FIGURES_IN_PRESENTATION`, only shrinks             |

`tests/moneyLintRules.spec.ts` plants an example of each lint rule, so a selector that stops matching fails a test. A baseline entry covers a whole file. Take the file off in the change that fixes it, and `tests/lintBaseline.spec.ts` fails if a listed file no longer breaks the rule. Never add a file to a list to get a change through.
