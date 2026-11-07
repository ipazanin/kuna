# AI chat plan

One docked chat in every app, for anyone who keeps an AI key. It knows the app on screen, reads only what the owner allows, and proposes changes the owner accepts as one write with one Undo. The full research is in [the chat research](research/chat.md).

## The owner's answers, 2026-11-06

These override the recommendations further down wherever the two differ.

- **Who fills IBANs and mail addresses:** the model may, with a warning on the line. Google folder ids and `bank_sync_deployment` stay out of its reach.
- **Reading:** a yes lasts per chat, with Always optional on this device.
- **The web:** search and fetch are allowed, behind a warning. This replaces "no outbound path other than the provider" and the boundary case that offers no model the web. It stays a switch the owner turns on, off by default, and a run with it on says so. A hostile row could try to leak figures in a query, so the switch's text says that plainly.
- **History:** this browser only, kept 30 days, with Clear.
- **Cost:** the panel shows a cost estimate and never stops a chat. The spend limit on the key is the only ceiling.
- **The dock:** the sidebar shrinks to icons while the chat is docked, which docks it from about 1224 px, as [the sidebar plan](../platform/sidebar-plan.md) says. Narrower, the panel takes the page's place.
- **Many proposals:** rules into an existing category go as one group with the rows shown and one Undo. A new category or a tax class goes one at a time.
- **A row that fits no category:** Suggest categories keeps choosing among existing ones until the chat reaches Company. Then a row on To review opens in the chat, tagged with that row, and the model can propose a new category with its name, bucket and tax class, for the owner to accept one at a time.
- **Statements from other banks:** the model can read a statement and fill the import's dry run. Readers and integrations for every Croatian bank are the long-term plan, as [their own task](https://github.com/ipazanin/kuna/issues/34).

## Recommended architecture

```
                       +----------------------------------------------+
  src/shell            |  AppShell: sidebar | main | dock (from 1408) |
                       |  passes appOnScreen and installedApps()      |
                       +----------------------+-----------------------+
                                              |
  src/shared/ai                     ChatPanel, ProposalCard, GrantCard
                                              |
                     runChatTurn ---- runModelLoop ---- runTask (one-shot tasks)
                         |                 |
                 toolDispatcher       ModelPort adapters
           grants, refs, schema       anthropicMessages, openAiResponses,
           6 closed tools             openAiCompatible (OpenRouter)
                         |                 |
                  catalogue.ts        egressGuard, then fetch to a preset host
                         |
  AppAssistant contract  |
                         |
  src/apps/*/assistant   readers, reports, field docs, guides, operations
                         |                                  |
                         | read                             | plan into a UnitOfWork
                         v                                  v
  src/shared/storage     store state                  store.check (dry run)
                                                      store.write (only on Accept)
                                                      store.undo
```

The core properties, in one list:

1. Hidden without a key, and the chunk does not load.
2. One panel in every app, labelled with the app in context.
3. Instructions are generated, so the assistant knows what the app supports in the version running.
4. Reading needs a grant, per app. What was sent is shown exactly.
5. Changes are proposals through existing rules. One tap, one write, one file, one Undo.
6. Secrets are out of reach by construction, tested with a hostile model.
7. No outbound path other than the provider, whom the owner chose.

## What the onboarding lane gets

The other lane designs the flow. This architecture offers it:

- **`AppAssistant.state()`**, reporting no file, opening, or open, so a chat knows an app has nothing yet.
- **Batches with `$` refs**, so "create categories, then rules into them" is one card.
- **Guides** at `kuna_docs('<app>/guide/...')`, hand-written, checked against ids.
- **Attachments** as tool results, for documents and pictures.
- **A file step is a person's step.** `store.write` refuses with `noBooks` until a file exists. The model shows a link to the first run. The first-run screens need a way to continue the chat afterwards.
- **The panel on bare routes.** `src/shell/App.vue` renders a bare `RouterView` during first run and renders no `AppShell` for that path. A chat that sets up an app must mount there too. This is the one shell change the onboarding lane cannot avoid.
- **Consent order.** No read grant is needed to explain setup, since instructions hold no user data. A new user can talk before granting anything.

## Staged build plan

Each stage leaves Kuna working with no key. Each runs `npm run check`, both builds, `check:figures` identical, and targeted `check:visual` at 360, 640 and 1024 px, adding 1440 from stage 2. CI runs the full suites.

### Stage 1. The model layer is ready for chat

No visible chat yet.

- **Work:** `openAiResponses.ts`, streaming in both adapters, `ModelTokens` split, `runModelLoop` extracted, `modelAccess.ts`, egress guard.
- **The owner gets:** honest cost lines on today's buttons. Tools that will work on his default OpenAI model. The first real call with his key, which settles `count_tokens` from Firefox, a real stream in Firefox, and OpenRouter's `require_parameters`.
- **Check:** adapter specs with recorded SSE, and the live run replaces the cost estimates here.

Built, waiting for the first run with a real key:

- **Adapters:** `openAiResponses.ts` for OpenAI with `store: false` and every output item replayed, `anthropicMessages.ts` streaming, `openRouterChat.ts` for OpenRouter alone and not streaming yet. The specs' streams are written from each provider's documented events, with made-up data, since no key was at hand to record real ones.
- **Tokens and cost:** `ModelTokens` holds fresh input, cache read, cache write and output, each priced at its own rate from the pricing pages. Under a cent says so instead of rounding up. The price step for long prompts is not modelled: Haiku 5.5 over 100,000 tokens a request, GPT-6 over 272,000. A task stops before that, and a chat stage must price it, as the owner lets a chat run on.
- **One-shot tasks keep:** 6 tool rounds, 100,000 tokens a request with cached ones counted, as Haiku's price step counts them, 16,000 output tokens a request, 5 minutes a run, and 100,000 full-rate tokens a run. The last weighs a fresh token at 1, a cache read at 0.1, a cache write at 1.25 and an output token at 5, so no request starts past it, and a tool loop stays under about $3 even on GPT-6 Astra. Chat passes its own limits to `runModelLoop`, and "estimate, never stop" is for the chat.
- **Egress guard:** `guardedModel` looks at every request before it leaves, for the exact value of each stored secret anywhere in it and for key shapes in readable text. A document's base64, thinking signatures and encrypted reasoning are left out of the shape check, since long opaque strings match by chance. The Google token is only caught by its shape, as the AI module may not import Google.
- **For the later web switch:** both adapters keep blocks and items they do not know in `raw`, replay them and treat only client function calls as calls. The guard never sees a search the provider runs, so that switch needs its own rule and its warning. `pause_turn` still fails as an unknown stop reason until then, and the boundary case that bans web tools changes with the switch.
- **The model field:** free text on every provider with suggestions from the preset, as the owner asked on 2026-11-06. A typed model says "price unknown" on the card and in the usage line, and on OpenRouter the line shows the `usage.cost` its reply reports. An id ending in `:online` is refused with a line on the card and runs the default model, since it turns on OpenRouter's web search with no request field. A list cannot catch every model that searches on its own, such as `openrouter/auto` or Perplexity's, so the card warns about that on any typed OpenRouter model. A run shows the provider's refusal in its words, and so does Test on Anthropic. Test on OpenAI and OpenRouter checks the key only.
- **Reading OpenAI's `phase`:** a `commentary` message is kept to replay and left out of the answer. Chat must also leave commentary out of what it streams, as `onDelta` hears every text delta today.
- **Left for the stage that first uses them:** the `context` turn, a cache breakpoint on the conversation's tail, chat's effort and thinking settings, `eager_input_streaming` and Anthropic's refusal fallback.

### One way in, the owner's decision of 2026-11-07

The chat becomes the one way to use AI, which is simpler on screen and does more.

- Inline suggestions go away. Every AI button opens the chat, including Explain on a figure, Suggest categories on the review queue and the receipt reading.
- The chat shows a tag for the element in context, such as a figure, a row or a receipt, and that element is highlighted in the app while it is in context.
- The inline task goes only once the chat does its job, so Explain moves with stage 3 and Suggest and receipts with stage 4 or their app's turn in stage 5. Nothing goes missing in between.
- A button still sends nothing by itself. Its element goes in as context under the same read grants and switches as a typed question.

### Knows the automations, the owner's request of 2026-11-07

The chat knows the automations Kuna offers, such as filing or parsing mail, bank sync and the IBKR report by mail. It suggests one when asked, and when it relates to what the owner is doing, such as uploading by hand a statement that could arrive by mail. It explains the setup and links the screen.

- Each app declares its automations in the catalogue, so a new one reaches the chat without changing the chat.
- Stage 2's catalogue lists them, which answers a direct question. A suggestion from what the owner is doing follows the read grants of stage 3, or uses only the screen on show.

### Stage 2. The panel, knowing the app

- **Work:** dock and pane in `AppShell.vue`, `ChatPanel`, the label and context turn, `catalogue.ts` over screens, settings tables, kinds, words, `kuna_docs` and `show_screen`, first guides for Spending. History in memory.
- **The owner gets:** with a key, a button in every app. "How do I set up rules for my bank?" answered from what this version of Kuna really has, with a chip to the right screen. Without a key, nothing changes. No user data leaves, since nothing can read it yet.
- **Check:** catalogue spec, visual pages with the panel open at 360, 640, 1024 and 1440, touch flow.

Built, waiting for the first run with a real key:

- **The layout:** from 1224 px the panel docks as a third column and the sidebar shrinks to icons, with a 56 px rail, the page's 784 px and a 384 px panel. Narrower it takes the page's place and the page stays mounted. There `?chat=1` is a step in the history, so Back closes it, and any link to a screen does too. The chunk loads only when the panel opens with a key kept. Open or closed is not remembered, since a reload loses the chat anyway.
- **What it knows:** `catalogueOf` builds the instructions and the pages once, from each app's `assistant()` and its `screens`. It takes every screen but a first run and those marked `needsRecord`, and it reads no `menu()`, as Company's menu depends on the books. So the pack's screens, kinds and settings are always listed, also for a company with owner pay off.
- **Tools:** `kuna_docs` and `show_screen`, closed and looked up in two maps. `show_screen` also takes `issues`, which puts the bare link to the issues page under the answer.
- **The context turn:** app, screen name, the tab when the app declares it as a place, the address, and the tag's label. The query is read only to match a declared place, and nothing else of it goes, as filters can hold names. It goes at the start of a person's message, only when it changed.
- **The tag:** `useChatTagging` opens the panel about one element, a `RemovableChip` shows it, and `chatTagAttrs` marks the element through `data-chat-tagged`, one rule in `app.css`. Only the gallery's specimen calls it so far, since the buttons stay as they are until the chat can do their jobs.
- **Sends:** by the owner's answer, a chat asks once, in a card above the prompt that says what is sent and what the company keeps, and stage 3's grant card can grow from it. The yes lasts until a new chat or a change of AI company, held in memory with nothing stored. Where the app's switch is on, it does not ask. Always allow writes that switch and shows only where a switch can be seen, so not in Loans, Investments, Assets or outside the apps. `AssistConsent` stays for the buttons outside the chat.
- **Cost:** a line in the panel adds up what each message reports. A chat has no budget, no prompt limit and a limit of 8 lookups a message.

### Stage 3. Reading with grants, Spending first

- **Work:** field classes for Spending's six kinds, `find_records`, `get_record`, `read_figures`, refs, `GrantCard`, `SentRow`, hostile-model spec, boundary cases 10 and 11. `AssistConsent` stays for the buttons outside the chat (Suggest categories, Explain, Read a receipt, and onboarding's), and goes only once all of them route through the chat. `GrantCard` asks inside the chat, and its Always writes the same switch as the app's Send without asking.
- **The owner gets:** "What did I spend on food in October, and why was it higher?" with figures Kuna computed, an inline ask before the first read, and the exact text sent one tap away.
- **Check:** hostile model, canaries, `figuresIn`, a live pass with a hostile statement row.

Built, waiting for the first run with a real key:

- **What it reads:** `AppAssistant.reader`, which `app.ts` builds over its own store. Spending offers seven kinds, the plan's six and the receipt lines the figures count, each with a `FieldDocs` table with no default. Settings stay out, as a value can route bank data. Fields of the `never-read` class never reach the chat's code: `importKey`, the fiscal codes, the photo's Drive id, the position and a category's colour.
- **Tools:** `find_records`, `get_record` and `read_figures` join the two of stage 2, closed and with no path, address or key among their arguments. Refs are handed out per chat, and a made-up one reaches nothing. A page holds 20 records unless the model asks, and 50 at most.
- **Figures:** `read_figures` calls the functions the screens use, through four reports: `month`, `categories` with the month before and the change, `limits` and `balances`. An amount written as `[f3]` shows through `MoneyText`. Any other amount in an answer must equal one a tool returned, or the line is flagged. An amount in a stranger's text does not count as returned.
- **The one card:** the stage 2 card is now `GrantCard`. Its yes covers sending and reading the app on screen, so a first question asks once. A read of another app, or from outside the apps, pauses the turn on the same card. A yes lasts the chat and the company it named. Always writes the app's Send without asking. A no goes back to the model, which cannot ask again within the message. The run's five minutes stop while the card waits.
- **What went:** `SentRow` opens to the exact text of the tool result, taken from the request itself. A request the egress guard refused shows no row.
- **Anonymising:** [the anonymising plan](anonymising-plan.md).
- **Automations:** `AppAssistant.automations`, listed on each app page with a page of their own, and a line in the instructions that a suggestion uses only the screen on show or what was read with leave. Declared so far: bank sync in Spending, statement mail, statement folder and the accountant's mail in Company, daily closes in Investments. The IBKR report by mail is not in this version of Kuna, so it is not listed.
- **Explain did not move.** It is a Company task of the hr-doo pack, and Company has no reader until stage 5, so it moves with that turn, as do its button and `AssistConsent`.
- **Left for later:** thinking settings, `eager_input_streaming` and the refusal fallback. Stage 4 took the price step and the tail cache breakpoint.

### Stage 4. Proposals with one Undo, Spending first

- **Work:** `store.check`, operations for category, rule, limit, account, entry and settings, `ProposalCard`, settings `undoable: true` for Spending, `$` refs, `never-propose` on `bank_sync_deployment`, IndexedDB history, quick actions, boundary cases 12 to 14.
- **The owner gets:** "Set up categories and rules from these rows" as one card, reviewed, accepted, Undo. This is the first stage that delivers the request in full, for one app.
- **Check:** every operation's example through `checkWrite`, accept and Undo specs, stale proposal refused, touch flow at 360 and 430 px.

Built, waiting for the first run with a real key:

- **The dry run:** `store.check` runs `checkWrite` on the copy on screen, with nothing queued, written or asked of Drive. Accept writes the same changes through `store.write`, so a record changed since is refused for that card alone and the file's other writes go on.
- **Operations:** 13 in `src/apps/spending/assistant/operations/`, each calling the write functions the screens use: add, change and delete a category, add, fix and delete a rule, set a limit, add and change an account, add, change and delete an entry, and set a setting. `propose_changes` is the sixth tool. A step names records by ref, or by a `$` name of an earlier step. An alias in a step's text goes back to what it stands for before it is written.
- **The owner's rule on many proposals:** rules go together on one card with the rows they file, and one Undo. A new category goes one to a card, and a rule on that card can file into it by its `$` name. Spending has no tax class, so Company brings that with stage 5.
- **Never proposed:** `bank_sync_deployment` and the bank links are outside the `set-setting` schema's list, so a step naming them never reaches a write. The app page says only a person sets them.
- **`ProposalCard`:** a count, the model's title apart, and lines in Kuna's words from the dry run, grouped by verb and kind, with a warning on a line that says where money or mail goes. Over four lines a group shows three and Show all. Accept and Not now, then Done and Undo. There are no checkboxes per line, to keep less on screen.
- **Settings keep Undo** in Spending. A write with several rule changes re-runs the rules once, through `writeRules`.
- **History:** IndexedDB, this browser only, 30 days. Only the last chat stays, a new chat replaces it, and Kuna settings has Clear chat history. It keeps what was said and how cards ended, and never a tool result, a ref or the alias map.
- **After a reload:** answers show their aliases as they were written, as nothing can map them back, and a figure ref is written out when it is kept. One line says the assistant no longer sees these messages and names show as aliases. Cards show their outcome and can no longer write. The model starts fresh, so a hostile row does not come back.
- **Quick actions:** one tap in an empty chat, which only a person can start.
- **Cost:** each request is priced on its own, with Haiku 5.5 five times dearer over 100,000 tokens a request and GPT-6 twice for input and one and a half times for output over 272,000, from each pricing page on 7 Nov 2026. Anthropic requests of a chat carry a cache breakpoint on the tail of the conversation.
- **Receipt reading stays where it is.** The chat has no way to take a photo until stage 6, and the screen's QR read and split draft have no chat path yet, so moving the button now would lose the job. It moves with stage 6, and `AssistConsent` stays for it.

### Stage 5. The other apps, one at a time

Order: Assets (2 kinds, a small check of the contract), Loans, Investments, Company, then the hr-doo pack with employee rules and ruleset pages. Each is its own wave and can run in parallel worktrees after the contract settles.

- **The owner gets:** the same chat with the context changing as he moves. Tax and law questions with cited sources, replacing the plan's Ask boxes.
- **Check:** per app as stages 3 and 4, plus `person-fills` on client IBANs and invoice mail, and the salary and employee cases.

### Stage 6. Documents in the chat

- **Work:** attachments on the prompt, `read_attachment`, downscale through `imagePartOf`, results as tool results, the existing dry runs and checks in the path.
- **The owner gets:** "Here is my loan offer" or "here is a statement", then a card, checked by EKS or the import dry run. The onboarding lane relies on this.
- **Check:** hostile PDF fixtures, the live pass, cost per page.

### Later, only if asked

A visible history file on Drive. A lower dock threshold through container queries. Device settings by card. A screen on tool results for documents. WebMCP behind feature detection.

### Plan documents to update when this is agreed

`docs/features/ai-assist/plan.md`, `docs/architecture/modules.md` (the `src/shared/ai` row and `AppContribution`), `work/products/kuna/plan.md`.

## Decisions only the owner can make

### 1. May the assistant fill in where money and mail go?

Screens: Clients, company settings, Spending accounts, the Accounts tab. Today a person types these. With chat, a supplier's PDF could say "our new IBAN is HR12..." and the model could propose it on a client, and from then on an invoice points at the wrong account. A card would show it, but a person tired after 40 lines may not catch it.

- **Only you type those.** The model can suggest everything else, and the card shows an empty field for IBANs and mail addresses. Costs some typing during setup, on perhaps ten fields, and "set up from this statement" stops for you at those lines.
- **The model may fill them, with a warning on the line.** Setup flows run straight through. A wrong value depends on you catching one line.

Recommendation: only you type those. `bank_sync_deployment` and Google folder ids stay out of reach either way. Which option do you want?

### 2. How long does a yes to reading last?

Screen: the chat, first time it needs to read an app. Example: you ask about Spending on Monday and allow it. On Thursday you ask something else, and a hostile row in a new statement now reaches the model with no new ask.

- **Ask once per chat, with Always available.** A new chat asks again unless you chose Always on this device. Costs one tap per chat. A hostile row still reaches the model after that tap, but it can only produce a card.
- **Ask once per app, for good on this device.** Fewest taps, and matches the plan's switch per app. You stop noticing what is being read, though the row showing what was sent remains.
- **Ask on every read.** What OpenAI's guide suggests for tools. Safest in principle, and likely five taps a turn, which trains you to tap without reading.

Recommendation: once per chat, with Always available. Which one?

### 3. Does the web stay off?

Your answer of 4 Nov was no web. Screens: law and tax answers, new vendor or bank questions. Example: a question about a rule changed last week gets an answer from the ruleset and the model's own older knowledge, marked as such, and it cannot look anything up.

- **Stay off.** Nothing the model reads can send your data anywhere, which is the strongest property this design has. Answers on recent changes are limited to what Kuna ships.
- **Allow search and fetch.** Fresher answers. A hostile statement row could then try to leak figures inside a search query, and no card would stand in the way, since the search runs on the provider's side.

Recommendation: stay off. Say if you want it reopened.

### 4. Where does a chat's history live?

Screen: the panel, after a reload. Example: you sort rows on your laptop, and on the phone the chat is not there. The changes themselves are in the file, so nothing real is lost.

- **This browser only, kept 30 days.** Clear button included. Private by default and simple. Does not follow you between devices.
- **A file on your Drive.** Follows your account, and you can see and delete it. One more file holding financial text, with a merge to build.

Recommendation: this browser only, for now. Which do you want?

### 5. What does a chat cost before it stops?

Screen: the panel's usage line. Example: on Sonnet 5.5 a normal turn is 2 to 5 cents by estimate, and a long setup could reach a dollar or two.

- **Stop and ask at $1 per chat, changeable.** A runaway loop costs at most a dollar. A big setup pauses once.
- **Show the cost, never stop.** No interruption. The spend limit on the key is the only ceiling.

Which model is the default also lands here. Sonnet 5.5 stays the default as you chose. Haiku 5.5 is about twenty times cheaper and may be enough for chat at low effort. I would test both on real questions in stage 2 before changing it. Recommendation: $1, changeable, and keep Sonnet until tested.

### 6. How wide must the window be for the dock?

Screen: every app with the panel open. Example: on a 1280 px laptop, the panel would leave 656 px for screens built for 784 px or more, so tables overflow.

- **Dock from 1408 px, otherwise the panel takes the page's place.** No screen needs changing, and it ships sooner. On a 1280 px laptop you switch between chat and screen, and cannot see both.
- **Dock from 1280 px.** You see both on a laptop. It costs a pass over every screen with the panel open, likely a wave of its own.

Recommendation: start from 1408 px and lower it later, once you have used it. What is your laptop's usual window width?
