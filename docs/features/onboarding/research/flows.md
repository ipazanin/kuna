# Kuna onboarding, with and without AI

Research notes and a proposal. No code was changed, nothing was built and the screens were not run. Today's flow is read from the code at `7334910` and from the variants in `scripts/visual-check.mjs`.

## The answer

Build the no-AI onboarding first, because every AI proposal has to land in the same forms and dry runs, and those forms are where the terms get taught. Then put one question at the very start, as the owner asked: talk to an assistant with your own key, or go step by step. Saying "I have no key" leads straight to step by step and never comes back as a prompt.

Two rules keep this small:

- **A file Kuna can already read never goes to a model.** A camt.053, a Revolut export and a portfolio workbook go through today's importers. The model only gets what Kuna cannot read: a loan contract, a broker PDF, a photo of a registration document.
- **The chat never writes.** Each proposal opens the app's existing dialog or dry run, already filled in. The owner saves it there, with the existing Undo. There is no second write path, no second form and no separate glossary.

## Today's flow, from the code

**Home (`src/shell/home`).** Five cards, each with a Set up badge while its app is on first run. There is no Kuna-wide welcome, so nothing says which app to start with or that one depends on another. `shell/overview` says "Nothing to add up until an app is set up". The AI key lives only on the Assistant card in Kuna settings (`shared/ai/presentation/AiAssistCard.vue`), and each app is off until switched on there.

**Company (`src/apps/company/onboarding`).** The only real onboarding, with four paths in `stepsOf`.

- Steps for new books on Drive: welcome ("What brings you here?"), home (Drive or this browser), access (Google scopes, including how statements arrive: by hand, mail or a Drive folder), folder, company, statement.
- The company step asks for name, currency, number style and one question: "Is this a Croatian d.o.o. that pays its owner?".
- The statement step takes a camt.053 or a bank export, shows a dry run, and can be skipped. A table export cannot finish there and is sent on to Transactions, Import.
- Overview then shows `GettingSetUpCard` with up to four lines: first statement, statements folder, categories and invoice details.
- New books start with the Croatian set and the state-payment rules (`packs/hr-doo/preset`), and rows wait in To review, where "Make this a rule" exists. `RuleCoverage` lists confirmed rows no rule repeats.

Problems I would fix regardless of AI:

- The categories line says "Look over the categories", and `categoriesAsNewBooksStart` only clears it when the set of category slugs differs. An owner who looks and agrees cannot clear it. The card's subtitle promises "Each line goes once it is done".
- Nothing teaches first rules. The owner meets them only by opening a review row.
- The company and owner facts (registration day, PD or PD-NN, when VAT falls due) are never asked or listed in Getting set up, though tax figures read them.
- "camt.053" is the main label on the statement drop, with no word on where to get one. Only Erste has a mail preset.
- The sample statement is offered only in the fake build (`VITE_FAKE_WORKBOOK`), so the public has no sample.

**Loans, Investments, Assets, Spending.** Each `onboarding/presentation/StartScreen.vue` is the same `FirstRunScreen`: where the file lives, then folder or find. A person setting up all apps answers the storage question five times. Nothing after it teaches anything. Each then falls to an empty Overview (variants `loans-overview`, `investments-transactions-empty`, `assets-overview-empty`, `spending-overview-empty`).

- **Loans.** Empty state with Add bank loan and Add informal loan. `BankLoanDialog` shows name, lender, amount, repayment kind, instalments, paid out on, first instalment, interim interest and its date, rate, rate type, subsidy and note, all on one form. Some fields carry a one-line help. Fixed and variable have one, and "a yearly rate" has only an example. Nothing separates what a brand new loan needs from what an old one needs.
- **Investments.** Empty state with Add transaction and Import. Import takes only a portfolio workbook with a Transactions tab of 21 columns and a template with a "How to fill" tab. No broker's own export is read. A holding without a price is left out of the value, and prices need a free vendor key or a hand-typed price.
- **Assets.** Empty state, then `AssetDialog`: kind, bought on, price, region or first registration, loan, note. This is the lightest app. "Set up Loans to pick a loan" appears when Loans is not set up.
- **Spending.** The empty state says "Add your bank accounts and your cash on Accounts, then type what comes in and goes out", without naming Import, though `ImportPanel` reads a Revolut export. Bank sync exists but needs a script the owner deploys, so a new user cannot use it. Starter categories are in. Limits are on their own screen and explain carry-over well.

## What the research says

The sources agree more than I expected, and most of it argues for less.

- **Doing beats touring.** NN/g says most apps need no instructional onboarding, that users "should be able to learn the interface by using it", and that it does not recommend deck-of-cards tutorials. Tips work better in context and "when it's actionable" [1].
- **Show few options first.** NN/g's progressive disclosure: "show users only a few of the most important options", and getting the split right is the main job [2].
- **Empty states carry the teaching.** They should state status, give learning cues and offer a direct path to the key task. NN/g calls these cues "pull revelations", which appear only when the user reaches that area [3].
- **Let people stop and return.** YNAB replaced a "locked-in" mobile flow with a checklist: "complete one task, then return later" [4]. A third-party Monarch guide also describes a checklist after the first account [5].
- **Start from a set and a recent start date.** Actual starts with a few default categories, tells people to add more "as your budget evolves", takes the balance on a chosen start date, advises against importing more than a month or two before it, and bases budgets on past spending [6]. Lunch Money offers start fresh, demo, import or a blank slate, seeds basic categories and creates rules from manual categorising [7]. Copilot only suggests a budget from imported history [8].
- **Bookkeeping needs a little more up front.** FreeAgent's webinar page lists accounting dates and opening balances before bank feeds [9]. The Xero and FreeAgent help articles themselves did not load (see Unconfirmed). Ghostfolio's README describes self-hosting and an import API, with no in-app onboarding [10], so it is no model.
- **Trust is calibrated, not won.** Google's PAIR says users should "calibrate their trust correctly", that capabilities and limits should be stated early, and that misleadingly high confidence "may cause users to blindly accept a result" [11]. On failure, explain and offer another path, and "let the user take over" [12].
- **Stay quiet when unsure.** Copilot does not apply a guess it is not confident in, and it waits for 30 reviewed transactions before predicting [8]. Extend says a high score "doesn't guarantee accuracy" and suggests cross-checking critical data [13]. So I would not show a percentage. A sum Kuna works out itself is a better check.
- **A chat needs a concrete opener.** NN/g says a bot should "clearly and concisely indicate what it can do", with suggestions as clickable buttons, and that repeating a suggestion feels "pushy" [14]. Prompt suggestions solve the blank page for new users [15].
- **Xero's JAX** is the nearest big product. Its press release promises "Just Done with your control" and fewer hallucinations through a control system, but states nothing measurable on extraction [16]. I would not copy anything from it. I found no public account of a finance product doing whole setup from documents, so that part of this proposal is my judgement.

## What each app asks, in two columns

### Company

|                         | Without AI                                                                                                                                                              | With AI                                                                                                                                                                                                             |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Must know or decide** | Company name, whether it is a d.o.o. that pays its owner, where to download a statement. Later: facts for tax figures.                                                  | The same decisions, but the chat fills name and registration day from a document.                                                                                                                                   |
| **Smallest flow**       | Storage, then name, then first statement, then "Kuna filed 31 of 48 rows. Teach it your five biggest payees." Those five use today's review row and "Make this a rule". | Name and registration from the document, then the statement goes through the importer as usual. The model sees masked payee groups (the existing `suggestCategories` path) and proposes rules.                      |
| **First useful figure** | Cash on hand and money in and out for the last month, from the statement.                                                                                               | Same figure, plus more rows filed on the first day.                                                                                                                                                                 |
| **Skippable**           | Mail or folder delivery (move to a Getting set up line, see the note below), category review, invoice details, tax facts.                                               | The same, and every proposal.                                                                                                                                                                                       |
| **Stays as help**       | Getting set up lines, a sentence where each statement file comes from, "Kuna counts this as" under each category (exists), `definition` on tiles (exists).              | The chat stays available for "why did this go here", through Explain (exists).                                                                                                                                      |
| **Documents**           | None.                                                                                                                                                                   | Court register extract: name, OIB, registration day. An invoice they issued: what invoices print. Not needed: a statement, which has a reader.                                                                      |
| **How it is confirmed** | Dry run (exists).                                                                                                                                                       | Facts open in Settings filled in. Rules appear as today's rule form with the rows it would file, through `RuleChangeReview`.                                                                                        |
| **Never alone**         |                                                                                                                                                                         | The tax class, the VAT treatment, whether a payment to the owner is pay, a dividend or a loan, and any rule that moves such a row. The screen says "Kuna counts this as" and the owner picks. Nothing from payroll. |

Note on delivery: moving mail and folder out of onboarding goes against the owner's request of 2026-10-25 that it be part of it. I recommend it because the access step is the heaviest screen and comes before any figure, and Kuna's own research quotes Google asking for scopes in context (`docs/features/platform/onboarding-and-sync.md`). The cost is one more Google screen later. This is decision 5.

### Loans

|                         | Without AI                                                                                                                                                                                                                                                       | With AI                                                                                                                                                       |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Must know or decide** | Amount borrowed, number of instalments, annuity or equal principal, payout day, first instalment day, rate and whether fixed or variable. Sometimes: interest before the first instalment, a subsidy. An old loan also has past rate changes and extra payments. | The same facts, read from the contract. The person still has to know whether the contract is the current state.                                               |
| **Smallest flow**       | The same `BankLoanDialog` with the six needed fields first. Interim interest, subsidy and note stay behind "More". After saving, one line: "Compare Owed today with your bank's figure. If it differs, add the rate changes or extra payments."                  | Drop the contract or repayment plan. The dialog opens filled, with each value's source quoted beside it.                                                      |
| **First useful figure** | Owed today, next payment, total owed, from `BalanceHero` and `BankLoanTiles`.                                                                                                                                                                                    | Same, plus whether Kuna's instalment equals the printed one.                                                                                                  |
| **Skippable**           | Lender, note, subsidy, rate history. Informal loans.                                                                                                                                                                                                             | The same.                                                                                                                                                     |
| **Stays as help**       | A sentence per term, in place, using `help` and the existing `definition`: what an annuity is (same payment, the interest share falls), principal, what variable means for the plan, what EKS is and why it is not the rate.                                     | Questions in the chat, answered from Kuna's rules or marked as the model's own (the existing cited answer).                                                   |
| **Documents**           | None.                                                                                                                                                                                                                                                            | Contract, repayment plan (`otplatni plan`), rate-change notice, offer. Extracts the fields above, plus rate periods from notices and subsidy terms if stated. |
| **How it is confirmed** | Field errors (exist).                                                                                                                                                                                                                                            | The same field errors. Kuna's own plan is compared with the printed instalment, as `offerEks` is compared with the printed EKS. A difference shows a line.    |
| **Never alone**         |                                                                                                                                                                                                                                                                  | Whether a subsidy applies if the document does not say. A guess at past rate changes. Any extra payment not in a document. Advice on repaying early.          |

Terms worth one sentence each: amount borrowed, annuity, equal principal, instalment, payout day, first instalment, interest before the first instalment, yearly rate, EKS, fixed, variable, index and margin, subsidy. Today, `loanDialog` covers some of them. `RateFields` has the best examples.

Plan gap: stage 6's `loans.read-offer` fills `OfferTexts` in Scenarios. Onboarding needs the same read filling `BankLoanDialog`. It should be one task with two targets, not two prompts.

### Investments

|                         | Without AI                                                                                                                                                                                                | With AI                                                                                                                                                  |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Must know or decide** | Which brokers, whether they have the complete history, what each row type means, the Yahoo symbol, a free price key. This is the heaviest burden in Kuna.                                                 | The same brokers and history decision. The rows come from the PDFs.                                                                                      |
| **Smallest flow**       | Two honest choices on the empty state. Add your holdings by hand for a value now, or fill the template for tax figures. The first run should say which needs which. Then one step for the free price key. | Drop broker PDFs. Rows go through the existing dry run with its questions.                                                                               |
| **First useful figure** | What it cost and what it is worth today. An unpriced holding is left out and named (exists).                                                                                                              | Same, across full history, with capital-gains figures.                                                                                                   |
| **Skippable**           | Price key (a hand price works), analysis, tax.                                                                                                                                                            | The same.                                                                                                                                                |
| **Stays as help**       | "How to fill" tab (exists), one sentence on "why full history": gains are worked out from what you paid, so a missing buy gives a wrong gain.                                                             | Explain a tax line (planned).                                                                                                                            |
| **Documents**           | None. A workbook is read without a model.                                                                                                                                                                 | Broker PDF statement into `WORKBOOK_COLUMNS` rows, as stage 6 plans.                                                                                     |
| **How it is confirmed** | Dry run, questions, skipped rows, commission check (exist).                                                                                                                                               | The same screens, with one Undo.                                                                                                                         |
| **Never alone**         |                                                                                                                                                                                                           | The tax treatment of anything, a split ratio or spin-off cost share it cannot source, an FX rate (Kuna uses ECB), whether two accounts are one person's. |

Limit found: `MAX_INPUT_TOKENS` is 100,000 in `runTask.ts`. At my estimate of about 4,000 tokens per PDF page, that is about 25 pages, so a long broker statement is refused. Stage 6 only handles an answer that is cut off, by asking to split by year. The input limit needs the same message, and a page count before sending.

### Assets

|                         | Without AI                                                                                                                                          | With AI                                                                                                                                                                                |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Must know or decide** | Kind, day bought, price paid. For a flat, the region. For a car, first registration.                                                                | The same facts, read from a document.                                                                                                                                                  |
| **Smallest flow**       | Today's dialog, offered straight from the empty state. Fine as it is. Add a closing line: "This is an estimate. Add a valuation when you have one." | Photo or PDF opens the same dialog filled.                                                                                                                                             |
| **First useful figure** | Worth today, by the DZS index, the customs table or the price paid.                                                                                 | Same.                                                                                                                                                                                  |
| **Skippable**           | Loan link, valuations, note.                                                                                                                        | The same.                                                                                                                                                                              |
| **Stays as help**       | `indexDefinition` and the valuations lines (exist). A word on the customs table, which is not a market price.                                       | Questions in chat.                                                                                                                                                                     |
| **Documents**           | None.                                                                                                                                               | Purchase contract: name, day, price, region. Registration document (`prometna dozvola`): first registration, make and model. Valuation report: value and date, into `ValuationDialog`. |
| **How it is confirmed** | Field errors (exist).                                                                                                                               | The same dialog. No computed check exists here, so the source quote is the only check.                                                                                                 |
| **Never alone**         |                                                                                                                                                     | What the asset is worth. The AI has no web tool and must not estimate. The link to a loan (it may suggest, the owner picks), and whether the owner holds it alone.                     |

Order: Loans before Assets gives "Yours after the loan" at once. The first-run path should offer that order and not force it.

### Spending

|                         | Without AI                                                                                                                                                                                    | With AI                                                                                                                                            |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Must know or decide** | Which accounts, each one's balance on a chosen day, and whether to type or import. Limits can wait.                                                                                           | The same. Balances may come from a picture.                                                                                                        |
| **Smallest flow**       | One account, its balance on the first of this month, then a Revolut export or five typed entries. The empty state must name Import. Use the existing "Always for this payee" while reviewing. | A banking screenshot opens `AccountDialog` filled. Revolut goes to the importer. Other banks stay typed unless decision 6 adds a statement reader. |
| **First useful figure** | Spent this month by group.                                                                                                                                                                    | Same.                                                                                                                                              |
| **Skippable**           | Extra accounts, categories (starter set exists), rules, limits, bank sync.                                                                                                                    | The same.                                                                                                                                          |
| **Stays as help**       | Offer limits only after a month of data, with the group's average beside the field. The carry-over sentence exists.                                                                           | A proposed limit, from at least a month of actuals.                                                                                                |
| **Documents**           | None.                                                                                                                                                                                         | Screenshot or statement page: name, currency, balance, day. Receipts belong to the later spending plan, not onboarding.                            |
| **How it is confirmed** | Dry run (exists).                                                                                                                                                                             | The same dialog, the review queue.                                                                                                                 |
| **Never alone**         |                                                                                                                                                                                               | A limit (it only proposes one), a transfer between own accounts when unsure, and any row filed without the review queue.                           |

## The choice of AI at the very start

**How it is offered.** One screen on the first visit to home, with two equal choices and neither preselected.

- _Set up by talking._ "Give an assistant your loan contract, statements and photos. It fills in the forms and you check each one. It needs your own AI key, about 2 dollars in all."
- _Set up step by step._ "No key, no cost. About the same result, with more typing."

The answer is remembered. Afterwards the only places AI shows up are the Assistant card in Kuna settings, and the buttons inside an app once a key exists. No badges, no empty-state pitch and no reminders. A person who picks step by step and later wants it finds it in settings.

I would challenge one thing here. A brand new person is being asked about paying for credits before seeing any figure. It is still right to ask first, as the owner wants, if "I have no key" is a one-tap route to the step-by-step path. Decision 3 lets the owner move it.

**Order on the AI path.** AI choice, key, storage, then chat. Storage comes before the chat because a phone leaves the page for Google, and a chat in progress must not depend on surviving that. Google consent and the folder choice stay in the existing steps, not in the chat.

**No key.** Everything in Kuna works without one, except the chat, Explain, suggested categories and document reads. Nothing that computes a figure needs a key.

Options I checked for "no key but still AI", all left out:

- **Free Gemini.** Google's terms allow only Paid Services when making an API client available to users in the EEA, and warn against sending personal information to unpaid ones [17]. Kuna has no Gemini preset either.
- **A key Kuna pays for.** It needs a server, against "No server".
- **Copy a prompt into your own chat.** It is a second way to do the same thing, with a paste-back step that invites errors.
- **A local model.** It needs a developer's setup, and works on one machine.

**Getting a key, for a non-developer.** Use the existing `getKey` link and `keyAddress` values. Text to show:

1. "A key is like a prepaid card number for an AI company. You buy credit there, Kuna sends your document straight to them from this browser, and they charge the credit. Kuna never sees the money or the document."
2. "A paid Claude subscription does not include this, it is billed separately." Anthropic states this [18]. Max, Ultra and Team plans do include a monthly API allotment [18].
3. "Open the Console, make an account, add a card, buy the smallest amount of credit, leave automatic top-up off, make a key, and paste it here." The credit steps are from Anthropic [19, 20]. The key page is the one in `providerPresets.ts`. I did not load a page describing its screens, so someone must walk it once with screenshots.
4. Test the key on the spot, with the existing Test button.

Show one recommended provider and keep the others behind "Other providers". OpenRouter must be hidden from this path, because `readsPdf` is false there.

**The cost in plain money.** List prices loaded today, Sonnet 5.5 at $2 in and $10 out per million tokens, Haiku 5.5 at $0.10 and $0.50 up to 100,000 tokens [21], match `providerPresets.ts`. A PDF page is 1,500 to 3,000 tokens of text plus the page's image [22]. I assumed 4,000 per page. These are my estimates on Sonnet, not measurements:

| What                                          | About                                      |
| --------------------------------------------- | ------------------------------------------ |
| A 15-page loan contract                       | 13 cents                                   |
| A photo of a registration document            | under 1 cent                               |
| A 25-page broker statement                    | 35 cents                                   |
| Rules for 50 payee groups, masked text        | 5 cents                                    |
| 30 chat turns                                 | 60 cents, less with caching                |
| **All five apps, with two broker statements** | **about $2, perhaps $5 with long history** |

On Haiku these are about 20 times lower if it reads documents well enough, which is untested. In practice the bill is the smallest credit purchase, since credit is prepaid, is not refundable and expires after a year [20]. I could not find that minimum, so the sentence "about 2 dollars" must be checked before it ships.

## What onboarding asks of the chat

For the lane designing the chat.

- **Open with what it can do and what to have ready.** Offer buttons: "I have a loan contract", "I have bank statements", "Start with my company". No "Ask me anything".
- **Documents first, questions after.** Ask only what the documents did not answer. No more than three questions before the first proposal, one at a time. This limit is my judgement, not a sourced number.
- **Route files before the model.** XML, Revolut and portfolio workbooks go to the app's importer with no model call. This also saves the most money and exposure.
- **Proposals open the app's own screen.** Filled in, with each value's source quoted beside it (page and text). Save, Undo, field errors and dry run are the app's. This needs a way to prefill `BankLoanDialog`, `AssetDialog`, `AccountDialog`, `ValuationDialog` and the settings facts.
- **Blank beats guess.** A missing field is left blank and shown, as stage 6 already plans for a loan offer.
- **Drop the document after reading it.** Keep the accepted fields in the conversation, not the PDF, or each turn pays for it again.
- **A way out on every screen.** "Do this one by hand" opens the same form with what was read so far.
- **Survive leaving.** A person will stop halfway and return days later to find what was accepted and what is left. The set-up lines are that record, so the chat keeps no second list.
- **One consent, not five.** One screen naming what leaves the device per app, which then sets the existing per-app switches. Today's `AssistConsent` per app would be five dialogs in a row.

When a document fails:

| What happens                                                 | What the person sees                                                                             | Route                     |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ | ------------------------- |
| Password-protected PDF, which Anthropic does not accept [22] | "This PDF has a password. Save a copy without it, or take a photo of the page with the figures." | Photo, or by hand         |
| Blurry photo, missing field                                  | The form with blanks, and "I could not read these."                                              | By hand                   |
| Too long, over `MAX_INPUT_TOKENS` or 10 MB                   | "This is long. Split it by year."                                                                | Split, or the template    |
| Wrong figure, caught by a sum                                | "The contract says 412,30 and the terms give 409,80." Both shown.                                | The owner fixes the field |
| Wrong figure, not caught, which is Assets and most dates     | Source quote beside each value                                                                   | The owner reads it        |
| Provider cannot read PDFs                                    | Existing `noPdf` message                                                                         | Change provider           |
| Out of credit, key refused                                   | Plain message, nothing lost                                                                      | Add credit, or by hand    |
| Model declines                                               | Existing `result.refused`                                                                        | By hand                   |

## What I would leave out

- **Tours, carousels, coach marks and a progress percentage.** NN/g argues against the first and gives nothing for the rest.
- **A glossary page.** Terms stay at their fields.
- **Confidence percentages.** Sums and source quotes do this better.
- **A public demo at the start.** It would be a second deployed build, while the real first figure takes minutes. Revisit if people stall before trying.
- **Payroll, the GFI package and receipts in onboarding.** They are later work, or carry employee data.
- **A statement-from-PDF reader for Company.** Decision 6 covers Spending, where the gap is real.
- **Rule drafting before a statement exists.** It has nothing to work from.
- **Provider and model choice on the first path.** It stays on the Assistant card.

## Flagged as a second way

| If built                                            | Second way of                      | Do instead                                                        |
| --------------------------------------------------- | ---------------------------------- | ----------------------------------------------------------------- |
| AI writing records directly                         | Forms, dry runs, `useRecordWrites` | Prefill and let the owner save                                    |
| A key screen for onboarding                         | Assistant card                     | Reuse `useSecretRows` and its row                                 |
| A chat that picks storage or asks Google            | First-run steps                    | Leave those to the steps                                          |
| PDF statement reading where a file reader exists    | camt and Revolut importers         | Ask for the file, and teach where to get it                       |
| A checklist per app or in the chat                  | `GettingSetUpCard`                 | Move `SetUpLine` to a contract in `shared/app`, one owner per app |
| A loan contract task beside `read-offer`            | Stage 6's task                     | One task with two targets                                         |
| Company's stepper and `FirstRunScreen` side by side | Already two first-run shapes       | One storage answer that both read                                 |

## Staged proposal

**Stage 1: the words.** Fix empty states, field help and the jargon, with no new concept. Spending names Import. Company explains the statement file. The categories line gains "These look right" or clears on visit. Loans fields say what they mean. _A new user understands each screen and reaches a figure with fewer dead ends._ Files: `words.ts` in each app, `EmptyState`, `gettingSetUp.ts`, `RateFields`, `LoanTermsFields`.

**Stage 2: first figure per app.**

- `BankLoanDialog` shows six fields first.
- Company gets "teach it your five biggest payees" after the first import, from `ruleCoverage`, To review and `makeRule`.
- Investments offers its two choices.
- Spending asks for one account.
- Each app publishes set-up lines through `AppContribution`.

_A new user gets one true figure in each app, and knows what is left._

**Stage 3: one start.** Add a home welcome asking which apps and where the files live, once. `FirstRunHomeStep` and `FirstRunFolderStep` skip themselves if answered. _Five storage questions become one, and the order Loans then Assets is suggested._ This also moves delivery to set-up lines if decision 5 agrees.

**Stage 4: the AI choice and the key.** First-screen question, key walk-through, one consent. Before this, make the first real call with a real key, which [issue #41](https://github.com/ipazanin/kuna/issues/41) still lists as open. _A person with a key has it working, with Explain and suggested categories already useful._

**Stage 5: documents one by one, from each app's own screen, no chat needed.** In order: loan contract, asset photo, court extract, broker PDF (the plan's stage 6, plus `imagePartOf`). Test each on real Croatian documents before it ships. _Documents fill forms. This has most of the value, and proves accuracy before a chat depends on it._

**Stage 6: the chat as the front door.** Once the other lane's chat exists, it routes files, asks what is missing and opens the same screens. _The owner's request is met: talk, give documents, all apps set up._

Stages 1 and 2 stand alone even if AI were dropped. Stage 5 also stands alone.

## Decisions only the owner can make

1. **Sending whole documents to the AI company.** A loan contract holds a name, OIB, address, IBAN and the sum owed. Kuna masks IBANs in text, but a PDF or photo goes as it is.
   - _Send whole, with one plain warning before the first document._ Reads everything including scans and photos. Costs nothing extra. The provider holds it for its retention period.
   - _Pull out the text in the browser and mask it first._ Protects more, fails on scans and photos, which is much of what people have, and adds a PDF library.
   - **Recommendation:** send whole with the warning. Nothing with employee data goes at all.

2. **One start for all apps, or one per app.** Today a person setting up everything answers "where does this file live" five times.
   - _One question at home._ Much shorter. Someone who wants Company on Drive and Spending only in the browser picks that later in Settings. It costs work in Company's separate stepper.
   - _Keep it per app._ No rework, and the repetition stays.
   - **Recommendation:** one question.

3. **Where the AI question goes.** Asking at the very start means a stranger reads about buying credit before seeing a figure. Asking after the first figure gets a better-informed answer, but setup has then begun by hand.
   - **Recommendation:** at the start as you asked, with "I have no key" going straight to step by step.

4. **Accepting many proposals at once.** The chat might propose 40 payee rules after a first statement.
   - _One tap each._ Safest, and slow enough that people may stop.
   - _Accept a group, with one Undo._ Fast, and a bad rule files many rows.
   - **Recommendation:** rules into an existing category can go by group, with the rows shown. A new category or a tax class goes one at a time. This also answers the AI plan's open "bulk confirm".

5. **Mail and folder delivery in onboarding, or after the first figure.** The owner asked for it in onboarding on 2026-10-25. It is the heaviest screen, with Google's warning, and comes before any figure.
   - **Recommendation:** ask after the first statement, by hand first. It costs one more Google screen later.

6. **Spending from other banks.** Only Revolut imports today, and bank sync needs a deployed script. A Croatian user at another bank types everything.
   - _Accept that for now._ Spending stays thin for those users.
   - _Let the AI read a statement PDF into the dry run._ Better, but only with a key, and a new thing to test.
   - _Write readers for the common banks._ Works for everyone, at a cost per bank.
   - **Recommendation:** accept for now and look at `personal-bank-statements` when real users appear.

7. **Which provider to recommend to a new person.** The path needs one name, and PDFs in Kuna work only on Anthropic and OpenAI. I am an Anthropic model, so do not take my word on this.
   - **Recommendation:** run both on five real Croatian documents, and list the better one first.

8. **Investments without full history.** A new user may have only this year's statements. Without earlier buys, Kuna would give wrong gains.
   - _Allow it, with a warning on the tax figures._ A value today for everyone, and tax figures that can mislead.
   - _Ask for complete history before showing tax._ Safer, and harder to start.
   - **Recommendation:** allow the value and mark the tax figures until the history is confirmed complete. Tax must not look finished when it is not.

## Unconfirmed

- **Did not load:** FreeAgent's setup article (403), Monarch's own help (403), YNAB's step-by-step support page (404), Xero Central (empty). Xero's method is therefore not covered. Search snippets on them were not used as evidence.
- **Monarch's checklist** comes from a third party's page [5].
- **Smallest Anthropic credit purchase**, and whether a Croatian individual pays VAT on it. The article gives no amount [20].
- **The Console's key screens**, and OpenAI's own billing and key steps, were not walked.
- **All cost figures** are my estimates from list prices. The 4,000 tokens per page is an assumption, since I did not load Anthropic's image-cost page.
- **Reading accuracy on Croatian contracts, handwriting and bank layouts** is untested, and so is Haiku against Sonnet. Everything in stage 5 depends on this.
- **A real provider call from Kuna.** Still open per [issue #41](https://github.com/ipazanin/kuna/issues/41), including whether `count_tokens` answers from a browser.
- **HEIC photos** and phone camera capture in Firefox, listed as open in [issue #46](https://github.com/ipazanin/kuna/issues/46).
- **Whether Anthropic's and OpenAI's retention lines in Kuna's words are current.** I did not reload them, that is the other lane's job.
- **Screens were read, not seen.** Layout judgements such as "heaviest screen" come from the code and may look different on the page.

## Files to reuse

- **First run:** `src/shared/storage/presentation/FirstRunScreen.vue`, `FirstRunHomeStep.vue`, `FirstRunFolderStep.vue`, `fileFirstRun.ts`, `src/shared/ui/EmptyState.vue`, `StepCard.vue`.
- **Company:** `onboarding/domain/onboardingSteps.ts`, `onboarding/presentation/gettingSetUp.ts`, `GettingSetUpCard.vue`, `StatementStep.vue`, `transactions/presentation/ReviewQueueItem.vue`, `rules/domain/ruleCoverage.ts`, `rules/presentation/RuleChangeReview.vue`, `packs/hr-doo/preset/`, `assist/application/suggestCategories.ts`.
- **Loans:** `bankLoans/presentation/BankLoanDialog.vue`, `LoanTermsFields.vue`, `RateFields.vue`, `SubsidyFields.vue`, `scenarios/domain/effectiveRate.ts`.
- **Investments:** `imports/presentation/useWorkbookImport.ts`, `ImportFileStep.vue`, `imports/domain/importDryRun.ts`, `portfolioWorkbook.ts`, `imports/infrastructure/portfolioTemplate.ts`, `prices/presentation/words.ts`.
- **Assets:** `asset/presentation/AssetDialog.vue`, `ValuationDialog.vue`, `values/presentation/words.ts`.
- **Spending:** `accounts/presentation/AccountDialog.vue`, `statements/presentation/ImportPanel.vue`, `ReviewPanel.vue`, `budgets/presentation/LimitDialog.vue`, `categories/domain/starterCategories.ts`.
- **AI:** `src/shared/ai/presentation/AiAssistCard.vue`, `AssistConsent.vue`, `application/runTask.ts`, `domain/maskIdentifiers.ts`, `infrastructure/providerPresets.ts`, `src/shared/app/appContribution.ts`.
- **Plans:** `docs/features/ai-assist/plan.md` (stage 6 and 7), `docs/features/company/croatian-preset-plan.md`, `docs/features/platform/onboarding-and-sync.md`, [issue #41](https://github.com/ipazanin/kuna/issues/41).

## Sources

All loaded on 2026-11-06 unless the Unconfirmed section says otherwise.

1. NN/g, Mobile-App Onboarding: https://www.nngroup.com/articles/mobile-app-onboarding/
2. NN/g, Progressive Disclosure: https://www.nngroup.com/articles/progressive-disclosure/
3. NN/g, Designing Empty States: https://www.nngroup.com/articles/empty-state-interface-design/
4. YNAB, Set Up YNAB at Your Own Pace: https://www.ynab.com/whats-new/set-up-ynab-at-your-own-pace
5. SLP Wealth, Getting Started with Monarch (third party): https://slpwealth.helpscoutdocs.com/article/176-getting-started-with-monarch
6. Actual Budget, Starting Fresh: https://actualbudget.org/docs/getting-started/starting-fresh
7. Lunch Money, Getting Started: https://support.lunchmoney.app/getting-started.md
8. Copilot Money, Copilot Intelligence for Spending: https://help.copilot.money/en/articles/8182433-copilot-intelligence-for-spending. The line on suggesting a budget from imported history came from a search result on Copilot's Quick Start Guide, which I did not load, so treat that one line as unconfirmed.
9. FreeAgent, Getting Started webinar: https://www.freeagent.com/small-businesses/events/getting-started/
10. Ghostfolio README: https://github.com/ghostfolio/ghostfolio
11. Google PAIR, Explainability + Trust: https://pair.withgoogle.com/chapter/explainability-trust/
12. Google PAIR, Errors + Graceful Failure: https://pair.withgoogle.com/chapter/errors-failing/
13. Extend, Confidence Scores: https://docs.extend.ai/extraction/confidence-scores
14. NN/g, 10 Guidelines for Site AI Chatbots: https://www.nngroup.com/articles/ai-chatbots-design-guidelines/
15. NN/g, Prompt Suggestions: https://www.nngroup.com/articles/prompt-suggestions/
16. Xero, JAX media release: https://www.xero.com/uk/media-releases/xeros-ai-financial-superagent-jax-launches-powerful-new-features/
17. Google, Gemini API Additional Terms: https://aistudio.google.com/docs/terms
18. Anthropic, why API usage is billed separately: https://support.claude.com/en/articles/9876003-i-have-a-paid-claude-subscription-pro-max-team-or-enterprise-plans-why-is-claude-api-usage-billed-separately-from-my-paid-claude-plan
19. Anthropic, starting with the API after creating a Console organization: https://support.claude.com/en/articles/8114531-i-created-a-claude-console-organization-how-do-i-start-using-the-claude-api
20. Anthropic, paying for API usage: https://support.claude.com/en/articles/8977456-how-do-i-pay-for-my-claude-api-usage
21. Anthropic, Pricing: https://platform.claude.com/docs/en/about-claude/pricing
22. Anthropic, PDF support: https://platform.claude.com/docs/en/build-with-claude/pdf-support
