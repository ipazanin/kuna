# Onboarding plan

A first useful figure in each app with or without AI, and one question at the start that decides which path a person takes. The full research is in [the flows research](research/flows.md).

## The owner's answers, 2026-11-06

These override the recommendations further down wherever the two differ.

- **Documents:** they go whole after one plain warning. Nothing with employee data goes at all.
- **Storage:** one `Kuna` folder on Drive with a subfolder per app, chosen once. Existing files keep working where they are, and Settings offers a move into Kuna's folder that takes a file with its statements, invoices and receipts.
- **The AI question:** at the very start, with "I have no key" going straight to step by step.
- **Many proposals:** rules into an existing category go as one group, and a new category or a tax class one at a time.
- **Mail and folder delivery:** after the first statement, by hand first.
- **Spending from other banks:** the model can read a statement into the dry run. Readers for every Croatian bank come later, as [their own task](https://github.com/ipazanin/kuna/issues/34).
- **Investments without full history:** allowed, and tax figures are left out until the history is complete. The owner said to ignore them. This plan reads that as not showing them, rather than showing them marked.
- **Which provider is named first:** the better reader on five real Croatian documents, tested with the owner's keys.
- **Add what I hold now:** writes a matching deposit with each buy, only in this path, in one write with one Undo, and the dialog says so. A file's existing deposits are untouched.
- **Taking the history back:** "My history is not complete yet" sits in Investments Settings.
- **Set-up answers:** they stay on the device.

## Built

Stages 1 and 2 are built on the `onboarding` branch and work with no AI.

- **Set-up lines.** `AppContribution.setUpLines()` publishes what each app still lacks. `GettingSetUpCard` moved to `src/shared/ui`. Company, Investments and Spending show it on Overview, and the home card shows each app's next line.
- **Answers stay on the device.** "These look right" and "My history is complete" live in this browser through `src/shared/app/setUpAnswer.ts`, per file. A new setting or record kind would have moved `read.workbook` and `investments.read.records`. A person's file stays untouched, a second device asks once more, and a lost answer can only hide figures that read past buys, never show a wrong one.
- **Tax without full history.** Until someone says the history is complete, Investments leaves out what reads past buys: the Tax screen's year, sales and tax-free tabs, the JOPPD date on the home card, the tax-free lines on a holding's page and the tax lines in a sale's summary. Income from abroad reads no buys, so its tab, the INO-DOH date and the 30-day payment dates stay. Value, cost and gains stay. An existing file asks too, once, since nothing in a file can show its history is whole.
- **Loans' six fields.** Name, amount, instalments, paid out on, first instalment and rate. Repayment and fixed or variable stay visible with their defaults, because a wrong answer silently gives a wrong figure.
- **Company's five payees.** The line names who appears most among the rows a rule could file, and goes once no such row is left or the books hold five working rules that file on their own. To review keeps its order.
- **A buy without a deposit.** The value adds cash, so a buy with no deposit lowers it. "Add what I hold now" writes the deposit with the buy, and stays offered on Overview until the history is said complete. On any other path a set-up line leads while cash is below zero.

## Staged proposal

**Stage 1: the words (built).** Fix empty states, field help and the jargon, with no new concept. Spending names Import. Company explains the statement file. The categories line gains "These look right" or clears on visit. Loans fields say what they mean. _A new user understands each screen and reaches a figure with fewer dead ends._ Files: `words.ts` in each app, `EmptyState`, `gettingSetUp.ts`, `RateFields`, `LoanTermsFields`.

**Stage 2: first figure per app (built).**

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
