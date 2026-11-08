# Docs

What Kuna is built on and why, kept beside the code. Every doc here is written for anyone reading the repo: the owner of the books is "the owner", and every figure in an example is made up.

| Folder                       | Holds                                                                                                      |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------- |
| [architecture](architecture) | How the apps fit together: the module map, the hub design, and the research behind them in `research/`     |
| [law](law)                   | The Croatian law the Tax screen rests on, one file per subject with its sources and the day it was checked |

## What goes where

- A design that spans the apps, or a rule about how modules depend on each other, goes in `architecture`.
- A piece of work is a [GitHub issue](https://github.com/ipazanin/kuna/issues). Its plan lives in the issue body, and its research and what was built go in its comments, not in `docs`. The `github` skill says how.
- A rate, code, deadline or rule of law goes in `law/`, which keeps its own conventions and its own check.

`npm test` fails when a relative link in a doc outside `law/` points at a missing file.
