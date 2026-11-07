# Anonymising plan

What leaves the browser when the chat reads a person's books. The core is built with stage 3 of [the AI chat plan](chat-plan.md), on Spending. The task is [issue 52](https://github.com/ipazanin/kuna/issues/52).

## What is built

A setting in Kuna settings, on the AI assistant card: **Hide names and identifiers**, on by default and kept per device. While it is on, what the chat's tools return goes with sensitive values replaced by aliases such as `Person 3`, and the screen shows the real value in their place.

Each stored field has a class, and a new field fails the typecheck until someone gives it one. The class says what happens to the field:

| Class               | With the setting on                                                                  | With it off           |
| ------------------- | ------------------------------------------------------------------------------------ | --------------------- |
| `plain`             | As stored                                                                            | As stored             |
| `ref`               | A ref that lasts one chat, such as `transaction-4`                                   | The same              |
| `money`             | The amount, with its currency                                                        | The same              |
| `counterparty`      | An alias if it names a person, or else as stored, with any identifier in it replaced | As stored             |
| `person`, `address` | An alias                                                                             | As stored             |
| `iban`, `oib`       | An alias                                                                             | Cut short by the mask |
| `free-text`         | As stored, with anything that reads as a name, an address or an identifier replaced  | As stored, masked     |
| `never-read`        | Never. The reader does not hand it over                                              | The same              |

`maskIdentifiers` still runs over everything the model loop sends, so with the setting off a whole IBAN or OIB leaves no more than it did before.

## What was chosen, for review

- **Amounts are ordinary data for reading,** as the owner asked about figures. They go as they are. Sending amounts is what lets Kuna's figures be quoted and checked.
- **Pay.** A salary reaching the owner's own account is an income row in Spending, an amount like any other, and the payer's name follows the `counterparty` rule. Employee pay in Company's records stays behind the existing employee switch, off by default, and when that switch is on it goes as an amount under the employee's alias. Stage 5 builds that part with Company's reader, and it adds an `employee` class that leaves a field out while the switch is off.
- **Merchants stay readable, people do not.** A payee or a merchant is aliased when it reads as a person's name: two to four capitalised words of letters and no sign of a business. A single word stays (`Konzum`), as does anything with a digit, a mark or a lower-case word (`BOLT.EU`, `PAYPAL *SPOTIFY`, `Corner market`), a legal form (`d.o.o.`), a business word (`Example Bank`), or one word and a place (`LIDL HRVATSKA`, `KONZUM ZAGREB`). A place hides nobody, so `ANA HORVAT ZAGREB` is a person. A wrong yes costs the model a hint for sorting that row, and the screen shows the real name anyway. A wrong no sends a person's name. A given name alone, such as `Ana`, stays, as it names nobody on its own.
- **Names the owner gave.** Category and account names are `plain`, as the owner chose them and an answer is useless without them.
- **Free text** is scrubbed rather than withheld, since the bank's text often tells what a row was. It catches runs of capitalised words, which over-matches on purpose, so `UPLATA HORVAT ANA STANARINA` and even `Kartica Konzum` go as one alias each, and the screen shows the real words.
- **What the person types goes as typed.** The card says so. A name typed in a question reaches the model next to rows that use the alias, so the model can link the two. The search takes the real name and the alias, since the person's own question needs it. IBANs and OIBs are not searchable, so a search cannot guess one digit by digit.
- **Secrets in a row.** The egress guard refuses a request that holds a stored key or the shape of one. A row with a key in its text stops the read with that message.

## How the pieces keep working

- **A stable alias per chat.** One person has one alias whichever way a statement spells the name, so `HORVAT ANA` and `Ana Horvat` are both `Person 1`. The word stays in English in every language, and the screen also maps it back when a Croatian sentence wrote `Osobi 1`. The prompt tells the model to copy it exactly.
- **Memory only.** The map lives in the chat's memory, and a new chat or a reload forgets it. The chat kept in this browser holds answers as the model wrote them, so after a reload they show `Person 3`, with one line saying so. Nothing real is lost, since the names stay in the file on screen. While the setting is on, no name from a read reaches the chat's store. What the person typed is kept as typed, and with the setting off an answer is kept with the names it wrote.
- **Proposals.** A model writes an alias in a step, and Kuna turns it back before anything is written, so a rule holds the real name. The card shows real values, and what the model hears of a card holds none of them. A refusal it hears goes through the same scrub as free text.
- **Refs and citations.** Refs stand for ids and aliases stand for values, and neither is in the other's way. A search by alias finds every spelling. The figure check leaves aliases and refs out before it reads a text for amounts, so `Person 3 €40` reads as one amount.
- **No third gate.** This sits inside the read grant. The card says in one line what goes as an alias, and the row under an answer shows the exact text that went.

## What this does not cover yet

- **Documents and photos** still go whole after one warning, in the receipt reading and in Company's tasks. Stage 6 brings them to the chat and decides what the setting means for them. The setting's note says they go whole.
- **One-shot tasks** (Suggest categories, Explain, Read a receipt) keep today's masking and the employee switch. They go when the chat does their job, as "One way in" says, so they get this path then.
- **Exports and other integrations.** The issue asks for one idea of sensitive across the whole app. Only the chat's read path uses it so far.
- **A person flagging a row or a counterparty** by hand is not built. The issue lists it to research. A wrong guess on a name has no fix but the setting until then.
- **Apps other than Spending.** Each brings its field classes with its turn in stage 5.

## The law

Unresearched. It did not change this core: the owner's own Spending data is the only thing read so far, and employee data stays behind its own switch, off by default. Whether a hosted model reading employee pay needs a line in the employer's processing records, and how far an alias counts as protection under EU rules, are questions for Company's turn in stage 5, from primary sources. Nothing here is legal advice.

## What needs a real key

Whether a real model copies aliases exactly in both languages, how often it declines them in a Croatian sentence, and whether it can still sort rows well with names aliased. The fake model only shows that Kuna's side holds.
