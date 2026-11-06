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

### Stage 2. The panel, knowing the app

- **Work:** dock and pane in `AppShell.vue`, `ChatPanel`, the label and context turn, `catalogue.ts` over screens, settings tables, kinds, words, `kuna_docs` and `show_screen`, first guides for Spending. History in memory.
- **The owner gets:** with a key, a button in every app. "How do I set up rules for my bank?" answered from what this version of Kuna really has, with a chip to the right screen. Without a key, nothing changes. No user data leaves, since nothing can read it yet.
- **Check:** catalogue spec, visual pages with the panel open at 360, 640, 1024 and 1440, touch flow.

### Stage 3. Reading with grants, Spending first

- **Work:** field classes for Spending's six kinds, `find_records`, `get_record`, `read_figures`, refs, `GrantCard`, `SentRow`, hostile-model spec, boundary cases 10 and 11. `AssistConsent` stays for the buttons outside the chat (Suggest categories, Explain, Read a receipt, and onboarding's), and goes only once all of them route through the chat. `GrantCard` asks inside the chat, and its Always writes the same switch as the app's Send without asking.
- **The owner gets:** "What did I spend on food in October, and why was it higher?" with figures Kuna computed, an inline ask before the first read, and the exact text sent one tap away.
- **Check:** hostile model, canaries, `figuresIn`, a live pass with a hostile statement row.

### Stage 4. Proposals with one Undo, Spending first

- **Work:** `store.check`, operations for category, rule, limit, account, entry and settings, `ProposalCard`, settings `undoable: true` for Spending, `$` refs, `never-propose` on `bank_sync_deployment`, IndexedDB history, quick actions, boundary cases 12 to 14.
- **The owner gets:** "Set up categories and rules from these rows" as one card, reviewed, accepted, Undo. This is the first stage that delivers the request in full, for one app.
- **Check:** every operation's example through `checkWrite`, accept and Undo specs, stale proposal refused, touch flow at 360 and 430 px.

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
