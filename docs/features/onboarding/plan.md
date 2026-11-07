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
- **What a move takes:** "Move only kuna files, dont move anything that is not owned by kuna, so statements fetched from mail can come, my accountant files cant."
- **A picked file:** marked on open with one private property, no new revision and no content change, so a new device cannot make an empty twin of it.

## Built

Stages 1 to 3 are built and work with no AI. Stage 4 adds the AI choice and the key.

- **Set-up lines.** `AppContribution.setUpLines()` publishes what each app still lacks. `GettingSetUpCard` moved to `src/shared/ui`. Company, Investments and Spending show it on Overview, and the home card shows each app's next line.
- **Answers stay on the device.** "These look right" and "My history is complete" live in this browser through `src/shared/app/setUpAnswer.ts`, per file. A new setting or record kind would have moved `read.workbook` and `investments.read.records`. A person's file stays untouched, a second device asks once more, and a lost answer can only hide figures that read past buys, never show a wrong one.
- **Tax without full history.** Until someone says the history is complete, Investments leaves out what reads past buys: the Tax screen's year, sales and tax-free tabs, the JOPPD date on the home card, the tax-free lines on a holding's page and the tax lines in a sale's summary. Income from abroad reads no buys, so its tab, the INO-DOH date and the 30-day payment dates stay. Value, cost and gains stay. An existing file asks too, once, since nothing in a file can show its history is whole.
- **Loans' six fields.** Name, amount, instalments, paid out on, first instalment and rate. Repayment and fixed or variable stay visible with their defaults, because a wrong answer silently gives a wrong figure.
- **Company's five payees.** The line names who appears most among the rows a rule could file, and goes once no such row is left or the books hold five working rules that file on their own. To review keeps its order.
- **A buy without a deposit.** The value adds cash, so a buy with no deposit lowers it. "Add what I hold now" writes the deposit with the buy, and stays offered on Overview until the history is said complete. On any other path a set-up line leads while cash is below zero.

### Stage 3: one start

- **The welcome.** A new device with no app set up sees one card on the home in place of the app cards: which apps, and where the files live. `src/shell/home/KunaWelcome.vue`. It writes one answer to this device through `src/shared/app/kunaStart.ts`, and makes nothing on Drive. The apps left out wait under the others until they have a file, and no app without a file is in the sidebar, whichever list holds its card. Add an app moves focus to the welcome's first app, or once answered to the first card in Set up. An app can suggest an order through `AppContribution.setUpOrder`, which Assets uses to name Loans first.
- **The answer skips the steps.** Said Drive, `useFirstRun` starts on the folder step and Company's `stepsOf` drops the home step. Said this browser, the home step stays as the one tap that makes the file, with no question on it. Someone with no answer, such as a person with files from before who opens an app they never set up, gets the home step once, and that counts as the answer. An app whose file is open and whose Settings leads back to its start still asks, because that person came to change it. Kuna settings says where new files go and offers Ask me again.
- **One Kuna folder.** `Kuna` at the top of My Drive, with a folder inside it named by the app's id, so a second device in another language finds the same one. It is marked with the `kuna` app property and found by search wherever the person puts it, so its id is never stored. Where it goes is asked only until it exists. Nothing is made until a tap on Create the file here. `src/shared/storage/infrastructure/kunaFolder.ts`.
- **Delivery after the first statement.** The access step asks for the books file and invoice drafts only. New books take statements by hand. Once a first statement is in books on Drive, Getting set up offers a line that opens `StatementDeliveryDialog`, with the Erste preset, another bank, or a Drive folder, or "I import by hand", which clears it on this device. The dialog writes the settings, and the next sync asks Google for what they need, so a phone that leaves for Google loses nothing typed. Books that already name a folder or a sender never see the line.

### Stage 4: the AI choice and the key

- **One question.** The welcome asks whether to set up the AI assistant, with Not now already chosen, so a stranger cannot land on a paid step by accident. A device that already holds a key is not asked. The answer leaves no field in `KunaStart`, because nothing reads it later: Kuna settings' card offers a key whatever was said.
- **The key step.** A yes swaps the same card's body for `AssistSetUp`, with no page and no dialog. The welcome counts as answered only when that step ends, so a reload asks again and a kept key skips the question. "I have no key" needs no path of its own, since the step shows the numbered steps and the field together.
- **One owner for the key's rules.** `useAssistantCard` holds them and `AssistKeyForm` draws the company, the steps, the field and the test for both the card and the step. A typed key is tested before it is kept, a refused one is not kept, and a Save never moves the provider.
- **Which companies.** The step offers only those whose adapter reads a PDF, read from `ProviderPreset.readsPdf`, so OpenRouter stays in Kuna settings. Anthropic comes first only because it is first in the list. The five real documents have not been tried, and that test still decides it.
- **The one consent.** Once a company accepts the key, the step says what it opens, what Kuna sends and what the company keeps, and offers "Send without asking", off by default. It writes the existing switch of each picked app that has an assistant, which each app's Assistant tab can take back. A run with employee data still asks. Left off, each app asks at its first send as before.
- **Not tried with a real key.** Only the fake model has run this step. [Issue #41](https://github.com/ipazanin/kuna/issues/41) still lists the first real call as open.

### The move into Kuna's folder

Settings on each app, on the card that already says where the file is. It is per app and not in Kuna settings because one move touches one file and fails alone, each app alone knows what sits beside its file, and the shell would otherwise need a new contract to see that. The button shows only while the page holds a token and the file sits outside its subfolder. Nothing moves until Move is pressed in the dialog, which first lists what goes and what stays.

A move takes what Kuna itself made, one file at a time, and a folder never moves, since it may hold what Kuna did not make. What the settings reach and how Kuna knows a file is its own, read from the code:

| What                                   | How the code finds it                                      | How Kuna knows it made it                         | On a move                                                                  |
| -------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------- |
| The file itself                        | By id on every device                                      | It is the file                                    | Goes first, id unchanged                                                   |
| Backups                                | By name in `backups` beside the file                       | App-made, and the name is `kuna-<app>-<day>.json` | Go, this app's alone                                                       |
| Statements filed from mail             | Under the statements folder                                | App-made, with `kuna-mail` = `statements`         | Go to `Kuna/<app>/statements`, year folders kept, ids kept                 |
| A statement a script or a person filed | The same folder                                            | No such property                                  | Stays                                                                      |
| The accountant's mail                  | Its own folder from My Drive, or wherever it was filed     | `kuna-mail` names another source                  | Stays, as he asked, even though Kuna filed it                              |
| A receipt's photo                      | The record holds its id, new ones go by name to `Receipts` | App-made                                          | Goes, id kept. A photo Kuna did not make stays                             |
| `kuna-investments-prices.json`         | By name beside the file                                    | App-made                                          | Goes                                                                       |
| `invoice_folder_id`                    | By id                                                      | A folder the person picked, so not Kuna's         | Stays with every invoice in it, including ones Kuna filed. The id finds it |
| A person's other files in the folder   | Nothing points at them                                     | Not Kuna's                                        | Stay                                                                       |

**A statements setting named from My Drive.** With mail on, Kuna's statements land in `Kuna/<app>/statements` and the press rewrites `statements_folder` to `./statements`, as its last step before the move counts as over. With mail off, nothing of Kuna's is there, so the setting and the folder stay, and whatever fills that folder goes on being read. An accountant's folder named `./` from the file cannot follow and may not move, so it holds the move back with a line saying so.

**A Drive script that files into the old folder.** The owner's `shadow-accounting/scripts/Code.gs` can write there. Nothing about the script breaks: its folder stays with its files, and it goes on filing. Kuna stops reading that folder after a move, so a statement only the script filed would go unread. Mail covers that, because the same statements come from the same mail: the next sync sees few files in the new folder, so its window goes back to `mail_since`, and it files them again into `Kuna/<app>/statements`. The result is the same statement in both folders, and each is imported once. A file someone dropped into the old folder by hand, and not yet imported, is not read after a move, which the dialog's count of files that stay is the warning for.

**"Already imported" after a move.** It reads the file's name for the label and account (`statementFilesToRead`), then the rows' `reference`. It reads no id and no folder, and a moved file keeps its name, so it holds. Mail filing's own "already filed" compares names within the folder it lists, which is why the year folders keep their names. A year folder from a statements folder not named `statements` keeps its old name, so mail files that year once more beside it, which changes nothing in the books.

**What Kuna cannot tell.** A file without `kuna-mail` looks like a script's. That includes what Kuna filed before the rename on 2026-10-28, which carries `ledgerboard-mail`. Those stay, and the dialog says it cannot say who made them.

**A refusal moves nothing.** The file goes first, since it is the one request Drive may refuse: Kuna made everything else, or it is a folder the settings name. A refusal then moves nothing, and the dialog's failure line says Google's docs do not settle whether an app may take a file out of a folder it was never given. The only thing left behind is the empty `Kuna/<app>` folder, which the next try uses.

**A move that stops part way.** The request that moves the file also marks it with a `movedFrom` property naming the old folder, in one request, so there is no gap between the two. A later failure leaves the mark. Settings shows Finish the move, on any device, and pressing it brings what is still in the old folder and clears the mark. Until then the backups of that day land in the new folder, older ones sit in the old one, and a `./` folder setting reports its folder missing on a sync. Pressing again merges a folder of the same name. A file whose name is taken stays where it was and is named in the toast, so nothing is overwritten. A folder a setting holds by id is never merged, since that would leave the setting on an empty folder: it stays and is named too.

**The settings are read fresh.** A move reads the file first, so a `./statements` set on another device goes along. A failed read moves nothing.

**A new device.** Drive's search finds a file the app marked. A file someone picked is now marked when it opens, and a file a device already chose is marked on its first read of a page, with one private property, no new revision and no content change. The mark waits while another file holds it, since the search must find one. A file no device has opened since this change is still unseen, so the folder step keeps Open a file I already have beside Create, and says why. A search that fails stops the Create with the error, and makes nothing.

**Another person's Kuna folder.** The search for the Kuna folder takes only a folder the person owns, read from Drive's `ownedByMe` field rather than `'me' in owners`. The [files reference](https://developers.google.com/workspace/drive/api/reference/rest/v3/files) documents that field, while the [search terms](https://developers.google.com/workspace/drive/api/guides/ref-search-terms) list `owners` with no `me` example.

**What Google's docs say, loaded 2026-11-06.**

- Moving: "To add or remove parents for an existing file, use the files.update() method" with "the addParents and removeParents query parameters", and "A file can only have one parent folder" ([Create and populate folders](https://developers.google.com/workspace/drive/api/guides/folder)). [About files](https://developers.google.com/workspace/drive/api/guides/about-files) still says a file on My Drive "can be in multiple folders", and [files.update](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/update) calls adding to several "no longer supported". Kuna always removes the old parent.
- Scope: files.update lists `drive.file`, and "Update requests must use the addParents and removeParents parameters" ([files](https://developers.google.com/workspace/drive/api/reference/rest/v3/files)). `drive.file` covers files an app creates or that a person opens or shares with it through the Picker ([Choose scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)).
- The id: "File IDs are stable throughout the life of the file, even if the file name changes" ([About files](https://developers.google.com/workspace/drive/api/guides/about-files)). No page says in words that a move keeps it. The move samples update the file under the same `fileId`.
- Revisions: a revision is "a change to the file's contents (not metadata)" ([Changes and revisions](https://developers.google.com/workspace/drive/api/guides/change-overview)), so a move leaves the head revision alone, and a save racing it sees nothing moved.
- A new folder: "If the `parents` field isn't specified, the file is placed directly in the user's My Drive folder" ([Create and populate folders](https://developers.google.com/workspace/drive/api/guides/folder)). Kuna names no parent for a Kuna folder at the top, since `root` answers 404 under `drive.file` (spike 4 in the [onboarding and sync spikes](../platform/research/onboarding-and-sync/spikes.md)).

**Unconfirmed, and untested against real Drive.** No page I could read answers these, and only the fake Drive has run them. Try the move on a throwaway file, then the Assets file, before the others.

- Whether `isAppAuthorized` reads true for every file the app made, when listed. [The files reference](https://developers.google.com/workspace/drive/api/reference/rest/v3/files) says "created or opened by the requesting app". If it reads false, the file stays, which is the safe way round.
- Whether `removeParents` works under `drive.file` when the old parent folder is one the app was never granted. A refusal there moves nothing, since the file goes first.
- Whether `files.get` gives `parents` for such a file. Settings then shows no place and no button, and nothing moves.
- Whether `appProperties` merge on update and whether setting one to null removes it. [Properties](https://developers.google.com/workspace/drive/api/guides/properties) says so only of public `properties`. If the clearing fails, Finish the move stays, and pressing it does no harm.
- Whether a search with `appProperties` finds the Kuna folder from a second device. [Search](https://developers.google.com/workspace/drive/api/guides/search-files) describes the query and is silent on `drive.file`, though Kuna's file search already relies on the same thing.

### Where this plan and the code disagreed

The code won in each.

- The answer on storage says a move takes a file "with its statements, invoices and receipts". His later answer narrows that to what Kuna made. The invoice folder is one he picked, and Kuna's invoice PDFs carry no property of their own, so invoices stay.
- Stage 3 says `FirstRunHomeStep` skips itself if answered. It cannot wholly for this browser, since that step makes the file. It stays with no question on it.
- The bank presets and the `./statements` folder lived only on the access step, and Settings has plain fields. Taking delivery out of the stepper would have lost them, so they moved to the delivery dialog.
- The module map's line numbers are against `0717599` and have drifted. This change does not chase them.

### Open questions for the owner

1. **The first real move.** A press changes where Drive for Desktop shows the file, so anything that reads `kuna-*.json` by path on the Mac, such as a `check:figures` command, needs the new path. The recommendation is to move Assets first and look, and Company last, since it is the one that rewrites a setting.

## Staged proposal

**Stage 1: the words (built).** Fix empty states, field help and the jargon, with no new concept. Spending names Import. Company explains the statement file. The categories line gains "These look right" or clears on visit. Loans fields say what they mean. _A new user understands each screen and reaches a figure with fewer dead ends._ Files: `words.ts` in each app, `EmptyState`, `gettingSetUp.ts`, `RateFields`, `LoanTermsFields`.

**Stage 2: first figure per app (built).**

- `BankLoanDialog` shows six fields first.
- Company gets "teach it your five biggest payees" after the first import, from `ruleCoverage`, To review and `makeRule`.
- Investments offers its two choices.
- Spending asks for one account.
- Each app publishes set-up lines through `AppContribution`.

_A new user gets one true figure in each app, and knows what is left._

**Stage 3: one start (built).** Add a home welcome asking which apps and where the files live, once. `FirstRunHomeStep` and `FirstRunFolderStep` skip themselves if answered. _Five storage questions become one, and the order Loans then Assets is suggested._ This also moves delivery to set-up lines if decision 5 agrees.

**Stage 4: the AI choice and the key (built, no real key yet).** First-screen question, key walk-through, one consent. Before this, make the first real call with a real key, which [issue #41](https://github.com/ipazanin/kuna/issues/41) still lists as open. _A person with a key has it working, with Explain and suggested categories already useful._

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
