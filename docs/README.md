# Docs

What Kuna is built on and why, kept beside the code. Every doc here is written for anyone reading the repo: the owner of the books is "the owner", and every figure in an example is made up.

| Folder                       | Holds                                                                                                                                                                                     |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [architecture](architecture) | How the apps fit together: the module map, the hub design, and the research behind them in `research/`                                                                                    |
| [features](features)         | One folder per feature, such as `company`, `loans` or `investments`. Its plans and proposals sit at the top of the folder, and the research lanes they were built from sit in `research/` |
| [law](law)                   | The Croatian law the Tax screen rests on, one file per subject with its sources and the day it was checked                                                                                |

## What goes where

- A design that spans the apps, or a rule about how modules depend on each other, goes in `architecture`.
- A plan or proposal for one feature goes in `features/<feature>/`, and the research it rests on goes in `features/<feature>/research/`. A feature with several waves keeps them side by side, each plan with its own research folder.
- A piece of work is a [GitHub issue](https://github.com/ipazanin/kuna/issues) that links to its feature docs. The `github` skill says how.
- A rate, code, deadline or rule of law goes in `law/`, which keeps its own conventions and its own check.

`npm test` fails when a relative link in a doc outside `law/` points at a missing file.
