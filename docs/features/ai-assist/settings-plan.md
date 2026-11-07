# AI settings: critique, proposal, build path

Read at `main` (80eb89d), with the screenshot `laptop-kuna-settings-assist-dark.png`. Nothing was run. Claims about behaviour come from reading the code, and two outside claims are marked unconfirmed.

## The recommendation in short

The general card becomes one select, one key and one model. The app switches and task lists move to an "Assistant" tab in Company and Spending, and the general card keeps a read-only line per app with a link. An app with no tasks shows nothing. The app switch changes meaning to "Send without asking", because that is what it does today and the only meaning that survives per-chat grants.

## 1. What is wrong today, worst first

1. **A person cannot tell what to do first.** With no key, the card offers about 19 controls: 3 key fields, 3 model fields, 3 Save, 3 Test, 3 Get a key, 2 app switches and 2 greyed employee switches. Nothing says "pick one". The person must work out that only one provider is needed, and that the other two blocks can be ignored.
2. **"Get a key" drops a non-developer on a sign-in page with no warning about what comes next.** Nothing says that a key is a separate paid account, that credit must be bought first, that a chat subscription usually does not cover it, or that the key should be treated like a password. Onboarding research (`docs/features/onboarding/research/flows.md`, "Getting a key") already has this list, and the card has none of it.
3. **The app switch says less than it does, and off does not mean off.** It reads "Company" and nothing more. `AssistButton.vue` still shows the button while the switch is off, and a tap offers to switch it on. So off really means "ask me first", and on means "stop asking". Nobody can learn that from the card.
4. **App matters sit in the wrong place.** Company's task list and employee switches sit in Kuna settings, and take the lower half of the card. `patterns.md` agrees with the owner: Kuna settings "holds only what is the same for every app".
5. **Employee switches frighten without need.** Greyed-out switches with sentences about names and pay show to everyone, even with no key, and even with the app off. "This figure names employees" makes no sense on a settings page, as no figure is on screen. The first-use dialog then shows it as a `warning` alert.
6. **Jargon.** Provider, model, `claude-sonnet-5-5` as the visible value, "In use", "Use this provider", "abuse checks", "hidden from Drive", "Key for Anthropic" beside "Model" on every block.
7. **Density.** The subtitle runs three sentences, including how sync stores keys. Each provider adds two caption lines before any control. In the screenshot this card is about as tall as Sync and the blank space under it, leaving a hole in the left column.
8. **"The key works" promises too much.** `keyTestOf` only separates 401 and 403 from the rest, and `chat-plan.md` says Test on OpenAI and OpenRouter checks the key only. A key with no credit passes, then the first real use fails with the provider's English words. Anthropic's Test is `count_tokens`, and whether it notices missing credit is unverified until the first real-key run (issue #41).
9. **Two traps a person cannot see.**
   - Remove has no Undo and no question, and it writes a removal with a time. The next sync then takes that key from every browser (`newestSecrets`).
   - The subtitle says "every browser you sign in to gets them", but a new browser with no keys and all switches off does not fetch them unless Investments wants its keys. `secretsStep` runs only on `wanted() || secretsHeldHere()`, and Company and Spending's `wanted` is the app switch. This matters more once the switch hides without a key, see section 2.

## 2. The provider select

**Where the choice takes effect.** Picking a company that has a key switches at once. Picking one with no key changes nothing until a key is saved. The card says "Kuna keeps using Anthropic until you save a key for OpenAI". Without this rule, a person who is only looking would silently lose the assistant, since `providerInUse()` returns the pick even without a key. The field's value is local to the card, and `pickProvider` runs only on a switch or a Save.

**A second company's saved key: kept, and visible.**

- Kept, because deleting on switch cannot be undone, a provider often shows a key only once, and the removal would sync to every browser.
- Not silent, because a key left in the Google file is something a person may want gone. The select marks it "Key saved" in the option's description. After a switch, one line under the select says "Your Anthropic key stays saved in case you switch back. Remove it".
- No dialog on switching, as nothing is lost.
- Each company keeps its own model (`kuna.assist-model.<id>`), so a return restores it.
- Half-typed text is cleared on every change of the select, so an OpenAI key never lands on Anthropic's Save.
- The egress guard reads all kept keys (`keptSecrets`), so keeping one also keeps it from leaking.

**Save and Test.** Save keeps the key, then runs Test by itself, so a person needs no second step. Save always keeps the key, since a Test can fail for being offline. The pick moves unless the provider refused the key. Test stays as a button for later. It says "Anthropic accepted the key" and that credit shows at first use. On Anthropic it also tests the model, which `assist-key` relies on, so a typed model's refusal still shows there.

**Remove.** Only for the company shown. It writes at once and shows a toast with Undo for 10 seconds, as "Undo instead of a confirm" asks. `useSecretRows.forget` returns what Undo needs, and the Prices card gets the same, so there is one way to do it. Remove never moves the assistant to another saved key, since data would start going to a different company without a word. That needs one fix: with no stored pick, `providerInUse()` falls back to the first key kept, so Remove must first store the removed company as the pick.

**Model field.** It shows only with a key, as there is nothing to pick before that. It stays the `UInputMenu` with free text the owner asked for. It is one column in a one-column card, with the help line as today. No "advanced" fold: a fold is one more control to hide one control.

**Retention sentence.** One caption directly under the select, always, as it describes the company chosen.

**Get a key.** Beside the key field, wherever the field shows: the no-key state, Replace and a refused key. It is gone once a key is saved and accepted.

**The three states.**

| State     | Shows                                                                                                  | Hides                          |
| --------- | ------------------------------------------------------------------------------------------------------ | ------------------------------ |
| No key    | Select, retention, three numbered steps, key field, Save, Get a key, and on Drive "Get it from Google" | Model, Test, Remove, app lines |
| Key       | Select, retention, key line, Test, Replace, Remove, model, app lines                                   | Key field, steps, Get a key    |
| Key fails | As Key, with the error line and the key field open beside Get a key                                    | Nothing else changes           |

A failure is known only from Test, which is kept in memory as today. No failed state is stored. A later refused run says so in the app that ran it. "Key fails" on a provider that could not be reached shows the provider's words and leaves the field closed, since the key may be fine.

**Merging with the Prices card: no.** Price vendors run together, each covering something else, so a select would be wrong there. They share `useSecretRows`, `PAGE_SECRET_STORE` and the `keyRow` words, which stay shared, so I leave those strings unchanged. The Prices checks at `scripts/visual-check.mjs:3789`, `:3892`, `:3913`, `:3934` and `:3944` then need no edit.

**Merging with "Delete my keys": not into this card.** That action deletes `kuna-secrets.json`, which also holds `twelvedata`, `alphavantage` and `finnhub`. Inside an AI card it would read as AI keys only, and a person would lose price keys from Google by surprise. It is a privacy action, so fold it into "Appearance and privacy" under the privacy paragraph, one card fewer. This is optional, and the last stage.

## 3. App-level copies

**Source of truth.** `src/shared/ai/infrastructure/assistSettings.ts` stays the only state, in its reactive `choices` over `localStorage`. No surface keeps a copy, so two places cannot disagree. Keys `kuna.assist.<app>` and `kuna.assist-task.<id>` do not change, so nobody's choices are lost.

**Is a read-only summary enough in one place? Yes, in Kuna settings.** The controls live in the app, and the general card shows "Company: Asks first. Settings". This narrows the owner's "we can leave it there" and is decision 1. Showing the full block in both costs almost no code but keeps today's height, which is half of the complaint.

**Where it goes.** A new tab "Assistant" in each app that has tasks.

- **Company:** in `CORE_TABS` in `src/apps/company/settings/presentation/SettingsScreen.vue`. It needs books, as `tasks()` reads `shownPack(settings.value)`.
- **Spending:** in `TABS` in `src/apps/spending/settings/presentation/SettingsScreen.vue`.
- **Why a tab and not a card in General:** Company's General holds a long form, the pack's cards and problems, so a link would land far above it. A tab gives the link a real place (`?tab=assistant`), and leaves General as it was.
- **Loans and Assets, once they have tasks:** they have no tabs, so the card simply stacks under the Books card.
- **Investments, once it has tasks:** a fourth tab.

**Employee switches in Company.** Each sits under its task, and only shows while the app switch is on, not greyed. The tone is neutral, with a default stated as a fact: "Left out until you switch this on. Then their names and the amounts paid go to Anthropic." The same sentence goes in the first-use dialog, and that alert moves from `warning` to `neutral`. No warning colour, no icon of people in settings. The switch and the provider's name do the work.

**An app with no tasks: nothing.** Investments, Assets and Loans publish no `assist`, so their Settings stay exactly as they are, and the summary leaves them out. An "assistant does nothing here yet" card would be a dead element on every visit. The tab or card arrives by itself when the app publishes `assist`, which onboarding stage 5 (loan contract, asset photo, broker PDF) and chat stage 5 will do. The summary also leaves out an app in its first run, as nothing there can be sent.

**With no key, an app's tab** lists what the assistant could do, in one line, with a link to Kuna settings. No switches.

**The chat, plainly: the owner's idea and the plan pull apart on what the switch means, not on where it sits.** A per-app switch reads as a standing permission. The owner's answer on 2026-11-06 is "a yes lasts per chat, with Always optional on this device". A real on/off on top of per-chat asks would be two gates, and off could not mean anything a person can predict.

They fit together if the switch is the Always. Research already says "Always" writes `kuna.assist.<app>` (`docs/features/ai-assist/research/chat.md`, "Standing or per chat"), and it matches what the code does today, as off already asks. So: label it "Send without asking", off means Kuna asks. That gives the Always a place to be seen and revoked, which chat needs anyway. Hence a per-app switch still makes sense, in that one meaning. This is decision 2.

**A gap in the chat plan.** Stage 3 lists "`AssistConsent` removed", and research replaces it with an inline grant card. But Suggest categories, Explain and Read a receipt are buttons outside the chat, and onboarding stage 5 adds more "no chat needed". Those would have nothing to ask with. Keep `AssistConsent` for buttons until they all route through the chat, and correct the plan.

**Sync dependency.** Once an app's switches are hidden without a key, a new browser that has no key cannot reach the switch that would fetch the key. So the no-key card on Drive gets "Saved a key in another browser? Get it from Google". This is a tap, so `allowHiddenFolder()` can run in it, then one secrets sync, as `deleteKeysFromGoogle` does. `secretsStep.ts` exports it next to that function. `assistWanted` in `useSync.ts` and `spendingSyncGroup.ts` keeps its logic, which gets a second look at chat stage 3, as "asks first" users have the switch off.

## 4. Alternatives

| Alternative                                       | Verdict                                                                                                       |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Tabs per provider instead of a select             | Drop. Invites setting up all three, the owner's complaint                                                     |
| Delete the other key on switch                    | Drop. Irreversible and syncs everywhere. Offered as an inline Remove instead                                  |
| Guess the provider from the pasted key's prefix   | Drop. Hard-codes key formats and the select is still needed                                                   |
| Sync the pick between browsers                    | Drop for now. The secrets file holds keys only. A second browser falls to the first saved key and shows which |
| Card in General instead of a tab                  | Drop for Company and Spending, for the link reason in section 3                                               |
| A shared key-field component for AI and Prices    | Later, not now. Onboarding stage 4 is the second AI user, so split it out of `AiAssistCard` then              |
| Friendly model names in the field                 | Drop. Free text needs the real id, and the help line already gives the name                                   |
| Remove the app switch and keep only per-chat asks | Considered in decision 2. Leaves Always nowhere to be revoked                                                 |
| Dialog for Remove                                 | Drop. Undo toast fits the pattern, with less friction                                                         |

## 5. Sketches

General card, no key, on Drive (half width on a laptop):

```
AI assistant
Optional. Kuna works without it. Pick one AI company and add your key.

AI company
[ Anthropic                                v ]
Anthropic deletes what Kuna sends within 30 days and does not train on it.

1. Go to Anthropic and make an account.
2. Buy a small amount of credit and leave automatic top-up off.
   A Claude or ChatGPT subscription is separate and usually
   does not include this.
3. Make a key and paste it here. Treat it like a password.

Your key
[ Paste your key                             ]
( Save )   Get a key [^]
You pay Anthropic for what you use. Kuna charges nothing.

Saved a key in another browser?  Get it from Google
```

The select, open, with a key saved for OpenAI:

```
| Anthropic                                  |
|   Makes Claude                             |
| OpenAI                                     |
|   Makes ChatGPT. Key saved                 |
| OpenRouter                                 |
|   Many models on one key. Does not read    |
|   PDFs in Kuna                             |
```

General card, with a key:

```
AI assistant
Runs on your own key, straight from this browser.

AI company
[ Anthropic                                v ]
Anthropic deletes what Kuna sends within 30 days and does not train on it.

A key ending in 0042 is kept in this browser.
A sync also saves it in your Google account, so your other browsers can get it.
( Test )  ( Replace key )   Remove

Model
[ claude-sonnet-5-5                        v ]
Sonnet 5.5 (default)

In your apps
Company    Asks first             Settings
Spending   Sends without asking   Settings
```

The same card when the key fails:

```
A key ending in 0042 is kept in this browser.
(!) Anthropic refused this key. Copy it again, or make a new one.
Your key
[ Paste your key                             ]
( Save )  ( Test )   Remove   Get a key [^]
```

Company, Settings, Assistant tab (Spending looks the same with one task and no employee line):

```
General  Categories  Category rules  Accounts  ...  Assistant  Books file
                                                    =========
AI assistant
Uses your Anthropic key. Nothing is sent until you tap a button.

(o ) Send without asking
     While off, Kuna asks before it sends.

Suggest categories
What leaves this device: names, descriptions, amounts, months and
accounts of the rows waiting for review, and your categories.
IBANs and OIBs are hidden.
(  o) Include rows that name employees
      Left out until you switch this on. Then their names and the
      amounts paid go to Anthropic.

Explain
What leaves this device: how the figure is worked out, its amounts
and the rules behind it.
(  o) Include figures that name employees
      Left out until you switch this on. Then their names and pay
      go to Anthropic.
```

The same tab with no key:

```
AI assistant
The assistant can help here with: Suggest categories, Explain.
Add a key in Kuna settings
```

Phone, 360 px, Croatian, with a key. Everything is one column, buttons wrap, each control at least 44 px:

```
+------------------------------+
| AI asistent                  |
| Radi na vašem ključu, izravno|
| iz ovog preglednika.         |
|                              |
| AI tvrtka                    |
| [ Anthropic               v ]|
| Anthropic briše ono što Kuna |
| pošalje u roku od 30 dana i  |
| ne uči na tome.              |
|                              |
| U ovom pregledniku čuva se   |
| ključ koji završava na 0042. |
| ( Provjeri )                 |
| ( Zamijeni ključ )  Ukloni   |
|                              |
| Model                        |
| [ claude-sonnet-5-5       v ]|
| Sonnet 5.5 (zadano)          |
|                              |
| U vašim aplikacijama         |
| Tvrtka         Prvo pita     |
|                Postavke      |
| Potrošnja      Šalje bez     |
|                pitanja       |
|                Postavke      |
+------------------------------+
```

The app names in that sketch stand for each app's own `name`.

## 6. Words

Unchanged on purpose: `keyRow.placeholder`, `keptEnding`, `kept`, `noKey`, `save`, `forget`, `test`, `works` for Prices, `model`, `defaultModel`, `typedModel`, `searchesWeb`, `getKey`, `retention.anthropic`, `noPdf`, the receipt's `sends`, and every `result` line.

Removed: `card.key`, `card.use`, `card.inUse`, `card.subtitle`, `card.subtitleOnDrive`, `card.apps`.

**`src/shared/ai/presentation/words.ts`**

| Key                         | English                                                                                                                                      | Croatian                                                                                                                               |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `card.title`                | AI assistant                                                                                                                                 | AI asistent                                                                                                                            |
| `card.subtitleNoKey`        | Optional. Kuna works without it. Pick one AI company and add your key.                                                                       | Neobavezno. Kuna radi i bez njega. Odaberite jednu AI tvrtku i dodajte svoj ključ.                                                     |
| `card.subtitleKey`          | Runs on your own key, straight from this browser.                                                                                            | Radi na vašem ključu, izravno iz ovog preglednika.                                                                                     |
| `card.company`              | AI company                                                                                                                                   | AI tvrtka                                                                                                                              |
| `card.keySaved`             | Key saved                                                                                                                                    | Ključ spremljen                                                                                                                        |
| `card.about.anthropic`      | Makes Claude                                                                                                                                 | Izrađuje Claude                                                                                                                        |
| `card.about.openai`         | Makes ChatGPT                                                                                                                                | Izrađuje ChatGPT                                                                                                                       |
| `card.about.openrouter`     | Many models on one key. Does not read PDFs in Kuna                                                                                           | Mnogo modela na jednom ključu. U Kuni ne čita PDF-ove                                                                                  |
| `card.steps.account(p)`     | Go to {p} and make an account.                                                                                                               | Idite na {p} i napravite korisnički račun.                                                                                             |
| `card.steps.credit`         | Buy a small amount of credit and leave automatic top-up off. A Claude or ChatGPT subscription is separate and usually does not include this. | Kupite malo kredita i ostavite automatsku nadoplatu isključenom. Pretplata na Claude ili ChatGPT je zasebna i obično ovo ne uključuje. |
| `card.steps.paste`          | Make a key and paste it here. Treat it like a password.                                                                                      | Napravite ključ i zalijepite ga ovdje. Čuvajte ga kao lozinku.                                                                         |
| `card.pay(p)`               | You pay {p} for what you use. Kuna charges nothing.                                                                                          | Ono što potrošite plaćate izravno tvrtki {p}. Kuna ne naplaćuje ništa.                                                                 |
| `card.yourKey`              | Your key                                                                                                                                     | Vaš ključ                                                                                                                              |
| `card.replace`              | Replace key                                                                                                                                  | Zamijeni ključ                                                                                                                         |
| `card.keepsUsing(old, new)` | Kuna keeps using {old} until you save a key for {new}.                                                                                       | Kuna i dalje koristi {old} dok ne spremite ključ za {new}.                                                                             |
| `card.nowSends(p)`          | The assistant now sends to {p}.                                                                                                              | Asistent sada šalje tvrtki {p}.                                                                                                        |
| `card.otherKept(p)`         | Your {p} key stays saved in case you switch back.                                                                                            | Vaš ključ za {p} ostaje spremljen ako se poželite vratiti.                                                                             |
| `card.removeIt`             | Remove it                                                                                                                                    | Ukloni ga                                                                                                                              |
| `card.employeesReset`       | Employee data is left out again until you allow it.                                                                                          | Podaci o zaposlenicima opet su izostavljeni dok to ne dopustite.                                                                       |
| `card.accepted(p)`          | {p} accepted the key. If you have no credit, the first use will say so.                                                                      | {p} je prihvatio ključ. Ako nemate kredita, to ćete vidjeti pri prvoj upotrebi.                                                        |
| `card.refused(p)`           | {p} refused this key. Copy it again, or make a new one.                                                                                      | {p} je odbio ovaj ključ. Ponovno ga kopirajte ili napravite novi.                                                                      |
| `card.synced`               | A sync also saves it in your Google account, so your other browsers can get it.                                                              | Sinkronizacija ga sprema i na vaš Google račun, pa ga mogu dobiti i drugi vaši preglednici.                                            |
| `card.fetchAsk`             | Saved a key in another browser?                                                                                                              | Spremili ste ključ u drugom pregledniku?                                                                                               |
| `card.fetch`                | Get it from Google                                                                                                                           | Preuzmi ga s Googlea                                                                                                                   |
| `card.fetchNone`            | Your Google account holds no key for Kuna.                                                                                                   | Na vašem Google računu nema ključa za Kunu.                                                                                            |
| `card.inApps`               | In your apps                                                                                                                                 | U vašim aplikacijama                                                                                                                   |
| `card.asksFirst`            | Asks first                                                                                                                                   | Prvo pita                                                                                                                              |
| `card.sendsFreely`          | Sends without asking                                                                                                                         | Šalje bez pitanja                                                                                                                      |
| `card.settings`             | Settings                                                                                                                                     | Postavke                                                                                                                               |
| `appCard.uses(p)`           | Uses your {p} key. Nothing is sent until you tap a button.                                                                                   | Koristi vaš ključ za {p}. Ništa se ne šalje dok ne dodirnete gumb.                                                                     |
| `appCard.switch`            | Send without asking                                                                                                                          | Šalji bez pitanja                                                                                                                      |
| `appCard.switchNote`        | While off, Kuna asks before it sends.                                                                                                        | Dok je isključeno, Kuna pita prije slanja.                                                                                             |
| `appCard.canHelp(titles)`   | The assistant can help here with: {titles}.                                                                                                  | Asistent ovdje može pomoći: {titles}.                                                                                                  |
| `appCard.addKey`            | Add a key in Kuna settings                                                                                                                   | Dodajte ključ u postavkama Kune                                                                                                        |
| `retention.openai`          | OpenAI keeps what Kuna sends for up to 30 days to check for misuse and does not train on it.                                                 | OpenAI čuva ono što Kuna pošalje do 30 dana radi provjere zlouporabe i ne uči na tome.                                                 |
| `retention.openrouter`      | OpenRouter keeps nothing by default. The company behind the model you pick keeps what its own terms say.                                     | OpenRouter prema zadanim postavkama ništa ne čuva. Tvrtka koja stoji iza odabranog modela čuva ono što kažu njezini uvjeti.            |
| `consent.switchOn(a)`       | Allow for {a}                                                                                                                                | Dopusti za {a}                                                                                                                         |

**`src/shared/secrets/presentation/words.ts`**

| Key              | English     | Croatian          |
| ---------------- | ----------- | ----------------- |
| `keyRow.removed` | Key removed | Ključ je uklonjen |
| `keyRow.undo`    | Undo        | Poništi           |

**App words**

| File and key                                                      | English                                                                                                                           | Croatian                                                                                                             |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Company `assist/presentation/words.ts`, `suggest.sends`           | Names, descriptions, amounts, months and accounts of the rows waiting for review, and your categories. IBANs and OIBs are hidden. | Nazive, opise, iznose, mjesece i račune redaka koji čekaju pregled te vaše kategorije. IBAN-ovi i OIB-i su skriveni. |
| Same file, `suggest.employeesWarning(p)`, renamed `employeesNote` | Left out until you switch this on. Then their names and the amounts paid go to {p}.                                               | Izostavljeno dok ovo ne uključite. Tada njihova imena i isplaćeni iznosi idu tvrtki {p}.                             |
| `packs/hr-doo/assist/presentation/words.ts`, `explain.sends`      | How the figure is worked out, its amounts and the rules behind it                                                                 | Kako je iznos izračunat, njegove iznose i pravila iza njega                                                          |
| Same file, `explain.employeesWarning(p)`, renamed `employeesNote` | Left out until you switch this on. Then their names and pay go to {p}.                                                            | Izostavljeno dok ovo ne uključite. Tada njihova imena i plaće idu tvrtki {p}.                                        |
| Company `settings/presentation/words.ts`, new tab name            | Assistant                                                                                                                         | Asistent                                                                                                             |
| Spending `settings/presentation/words.ts`, `tabs.assistant`       | Assistant                                                                                                                         | Asistent                                                                                                             |

**`src/shell/settings/words.ts`**

| Key                                   | English                                                                                                                                                               | Croatian                                                                                                                                                                       |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `description`                         | Sync, the assistant, look and language on this device, for every app. Where an app keeps its books, and what it may send to the assistant, is on that app's Settings. | Sinkronizacija, asistent, izgled i jezik na ovom uređaju, za sve aplikacije. Gdje aplikacija čuva svoju datoteku i što smije slati asistentu, piše u postavkama te aplikacije. |
| `appearance.privacy`, the last clause | ...and to the AI company of your key, when you use the assistant.                                                                                                     | ...i AI tvrtki vašeg ključa kad koristite asistenta.                                                                                                                           |

**Unconfirmed, to check before shipping.**

- `card.steps.credit`: search results from Anthropic's help centre say a Pro plan does not include Console usage and that Max and Team include a monthly API credit. Hence "usually". OpenAI's half came from no page I could load. The fetch of both help centres failed (403 or no answer), so this is from snippets.
- "Leave automatic top-up off": a search snippet of OpenAI's help says auto-reload is on by default and that a prepaid balance is not an instant cutoff. Page not loaded. So the copy does not claim that credit is a hard ceiling.
- `flows.md` already notes that nobody has walked the key screens. Someone should do it once with a real account before step 1 to 3 ship. A Croatian native should read the table too. "Kredit" and "nadoplata" are my picks.
- "Test does not check credit" is from `chat-plan.md` for OpenAI and OpenRouter, and unverified for Anthropic.

## 7. Build path

Each stage leaves Kuna working with no key. Per the repo's checks: `npm run check`, then targeted `check:visual` at 360, 640, 1024 and 1440 px, and targeted `check:touch`, with CI running the full suites. Run `design-reviewer` on each diff.

**Stage 1. One company at a time.** `src/shared/ai/presentation/AiAssistCard.vue`, `words.ts`, `assistSettings.ts`, `useSecretRows.ts`.

- The card renders one provider's fields from a local `shown` value, with `USelect` (it supports `description` on items). The `apps` section stays as it is in this stage.
- `pickProvider` keeps its signature, and when the pick really changes it clears `kuna.assist-task.*` (decision 3). Specs in `tests/assistSettings.spec.ts`.
- Save then test, the Replace state, the no-key steps. `useSecretRows.forget` returns its undo for the toast, and `PriceVendorsCard.vue` gets the toast too.
- Remove stores the pick first, as section 2 says.
- `visual-check.mjs:1364-1445`:
  - `ready: assist-in-use` becomes `assist-key-kept` on `kuna-settings-assist`, `-croatian` and the three `-typed-model` screens.
  - `In use` and `U upotrebi` leave `shows`.
  - `kuna-settings` loses `Key for Anthropic`, and `No key in this browser.` stays only if the steps state keeps a key line. Recommended: drop both, and show the steps instead. The Croatian screen matches.
  - New screens: `kuna-settings-assist-failed`, and a two-keys screen with `kuna.assist-provider` stored.
- `scripts/support/editorFlows.mjs`, `assistKeyFlow`:
  - `ANTHROPIC_ROW` still works if the one block keeps `data-testid="assist-provider"` and `data-provider`.
  - The key field appears only in no-key and Replace states, so `assist-key` is pressed before Save, and the input handle is gone afterward, which changes the "field is empty" check to "field is gone".
  - The in-use wait goes. `The key works.` becomes the accepted line.
  - The OpenRouter part first picks through a new `assist-provider-select`, with a made-up key saved, since the model field needs a key.
  - Add Remove's Undo.

**Stage 2. Apps own their part.**

- New `src/shared/ai/presentation/AppAssistCard.vue`, taking `app`, `appName` and `tasks`, using `assistSettings` directly. It lands with this wording: the switch and employee block move as they are, and stage 3 changes the words.
- `AiAssistCard.vue` drops the task lists and shows the summary. Its `apps` prop gains `to`.
- `AppAssist` in `src/shared/app/appContribution.ts` gains one field, the settings link: `settings: RouteLocationRaw`, as the shell cannot know an app's tabs. `SettingsScreen.vue` in the shell passes it and filters on `firstRun()`.
- Company: move the object at `src/apps/company/app.ts:83` to `assist/presentation/companyAssist.ts` as `COMPANY_ASSIST`, so the tab and the app share it. Add the tab to `CORE_TABS`, in a small `AssistantSettingsTab.vue`, since a tab takes a component.
- Spending: `READ_RECEIPT_SUMMARY` likewise, and add to `TABS`.
- Loans, Assets, Investments: no change.
- Boundaries, `tests/importBoundaries.spec.ts`: shared imports no app, so words and tasks come in as props. The link to Kuna settings is the route `/settings`, which `secretsStep.ts` already spells as `KUNA_SETTINGS_ROUTE`. Export that one rather than writing a second. Apps import the card from `shared/ai/presentation`, as they do `AssistButton`. Nothing new reads a key, which the `storedSecret` boundary at line 305 keeps honest.
- Catalogue: `.agents/skills/kuna-design/components.md`, the `AppCard` row's Shared count goes up by one, or `tests/designCatalogue.spec.ts` fails. Spending and Company's counts change only if a new file of theirs renders one.
- Checks:
  - `kuna-settings` loses `Suggest categories`. `kuna-settings-assist-on` moves `ready` and its employee `shows` to a new `company-settings-assist` at `#/company/settings?tab=assistant`, and to a Croatian twin. Add `spending-settings-assist`.
  - Add `kuna-settings-assist-on` with the summary line.
  - Touch `assist-switch` moves to the Company route at `scripts/touch-check.mjs:2841`. `COMPANY_SWITCH` keeps its testid, and `ANTHROPIC_ROW` is untouched. Its check that an employee switch is disabled while off becomes that it is absent.
  - A spec that Loans, Assets and Investments render no `assist-card`.
- Docs: `patterns.md` "Kuna settings holds only" adds the AI key. README near line 2775. `docs/architecture/modules.md` row for `src/shared/ai`.

**Stage 3. The words of the switch.** Kept apart so that decision 2 can change only this. The `appCard`, `consent.switchOn`, employee and shell strings, `AssistConsent.vue` alert from `warning` to `neutral`. `AssistEmployeeSwitch.warning` becomes `note` in `appContribution.ts`. The flows read words by import, so most follow by themselves. `kuna-settings-assist-on`'s `shows` still hold.

**Stage 4. Get it from Google.** `fetchKeysFromGoogle` in `src/shared/secrets/presentation/secretsStep.ts`, beside `deleteKeysFromGoogle`, the line on the no-key card, specs beside `tests/secretsStep.spec.ts`. A fake-build flow for a key the fake Drive holds.

**Stage 5, optional. Fold "Delete my keys" into Appearance and privacy.** Testids stay, so its flows hold.

**Against chat stage 2.** Stages 1 to 3 go first. They are all in the Settings surfaces, chat stage 2 touches `AppShell.vue` and new panel files, so they barely collide. Stage 2's panel reads `providerInUse()` and `words.retention`, both unchanged. Going first gives the panel one company to name and no leftover "which provider" question. Stage 2 sends no user data, so no app switch logic is waiting on it. Chat stage 3 then adds one thing to `AppAssistCard`, what the assistant may read, and its "Always" writes the same switch. The key steps in this card become onboarding stage 4's walk-through, and that is when the key part splits into its own component.

## Built: stages 1 to 3, with stage 4's Get it from Google

Built on the `chat` branch, issue #50. Delete my keys stays out of the card, and stage 5 is not done. The tables in section 6 show the words as first proposed, and `words.ts` holds the corrected ones listed below.

**The rule since the review.** The provider changes only by a person's act on the select. Saving a key, a Test, Get it from Google, a sync and an Undo never move it. This overrides section 2 where it says Save moves the pick and where it says a saved key is kept whatever the Test says.

- Save tests what was typed first, and a key the company refuses is never kept, so it cannot take over or push out a working key. A Test that only failed, as offline, still keeps the key.
- A key saved for a company not in use goes aside. The card returns to the company in use and says to pick the other on the select.
- Picking a company with no key moves the assistant only while it has no key to lose.
- `holdProviderInUse` stores the company in use as the pick when the shell starts and after each change of a key, so the fallback to the first saved key can no longer move anyone. A new browser takes the first key it gets.
- Replacing a key shows the same 10-second Undo as Remove, on the Prices card too.
- Another tab's change of a switch, the pick or a key arrives through a `storage` listener.
- The card's rules live in `useAssistantCard.ts`, which specs run without mounting the card.

**The dialog, by the owner's answer.** Send once sends this one time, through `allowOnce`, and leaves the switches as they are, so off asks each time. Send, don't ask again turns on the app's switch, and the task's yes on employee data when this run sends it. A run that sends employee data says so plainly in the dialog, naming the company, whatever the switches say. Try again on Explain goes through the same tap, so it asks too.

**Where the code overruled this plan.**

- `pickProvider` could not keep its plain signature and rule alone. The fallback in `providerInUse()` needs the keys, and `assistSettings.ts` may not read them. So `pickProvider` takes back the yeses on a real change and returns whether it did, `pinProvider` stores a pick and takes nothing back, and `switchProvider` in `useAiTask.ts` pins first, so storing the company already in use is no change.
- With no stored pick, a key a sync brought or took could move the assistant, with a yes on employee data still on. The plan's "a second browser falls to the first saved key" misses this. `holdProviderInUse` closes it.
- Suggest categories does not ask for employee data when its yes is off: it leaves those rows out, says so when none are left, and has its own switch on To review naming the company. After a change of company that switch is off and names the new one. With the yes on and the app's switch off, its dialog says the names go.
- `KUNA_SETTINGS_ROUTE` could not be exported from `secretsStep.ts` for the tab's link, because that file loads Google and the AI module may not. It now lives in `pageSecrets.ts`.
- The same rule stops the card calling `fetchKeysFromGoogle` itself, so Kuna settings passes it in as a prop.
- `AppAssistCard` takes `app` and `tasks`. The planned `appName` had no use.
- The Assistant tab sits after the pack's tabs, as the sketch shows, not inside `CORE_TABS`.
- A refused key needs a fake answer to be seen, so `?ai=key-refused` turns away every key on a Test.

**Added beyond this plan.**

- `card.keepKey` closes the Replace field, which otherwise has no way back but Save.
- `card.fetchFailed` says when Google could not be read.

**Croatian corrected from section 6.**

| Key                    | Plan                                                        | Now                                                                     | Why                                                               |
| ---------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `card.about.anthropic` | Izrađuje Claude                                             | Izrađuje Claudea                                                        | Claude is a name and takes the accusative                         |
| `card.steps.account`   | Idite na {p} i napravite...                                 | Otvorite stranicu tvrtke {p} i napravite...                             | "Idite na Anthropic" is not said of a company                     |
| `card.steps.credit`    | Kupite malo kredita... je zasebna                           | Uplatite manji iznos... zasebna je                                      | "Kredit" reads as a bank loan                                     |
| `card.accepted`        | {p} je prihvatio ključ. Ako nemate kredita...               | Tvrtka {p} prihvatila je ključ. Ako nemate uplaćenih sredstava...       | The same loan reading, and the gender of a company name           |
| `card.refused`         | {p} je odbio ovaj ključ                                     | Tvrtka {p} odbila je ovaj ključ                                         | The gender of a company name                                      |
| `card.otherKept`       | ...ako se poželite vratiti                                  | ...za slučaj da se želite vratiti                                       | Says "in case", as the English does                               |
| `appCard.canHelp`      | Asistent ovdje može pomoći: {titles}                        | Asistent ovdje može pomoći s ovim: {titles}                             | The sentence had no object                                        |
| `consent.switchOn`     | Dopusti za {a}                                              | Dopusti u aplikaciji {a}                                                | "Dopusti za Tvrtka" breaks the case of the app's name             |
| `suggest.sends`        | Nazive, opise, iznose...                                    | Nazivi, opisi, iznosi...                                                | It follows "Što napušta ovaj uređaj:", so it takes the nominative |
| `explain.sends`        | Kako je iznos izračunat, njegove iznose i pravila iza njega | Kako je iznos izračunat, brojke od kojih se sastoji i pravila iza njega | The same case, and "iznos... iznosi" repeated                     |

A Croatian native should still read these once. The outside claims in "Unconfirmed, to check before shipping" stay unconfirmed, and nobody has walked the key screens with a real account.

**Left open.** Chat's per-chat grant will need a yes that lasts for one chat. Issue #52 replaces the interim rule on employee data.

## The owner's answers, 2026-11-06

These override the recommendations below wherever the two differ.

- Kuna settings keeps a short line and a link per app, and the controls sit in an Assistant tab in the app.
- An app's switch means Send without asking: off asks, on stops asking, and the chat's Always writes this same switch.
- Sensitive data gets [a task of its own](https://github.com/ipazanin/kuna/issues/52): a setting, on by default, that flags sensitive data and fields and anonymises them across the whole app. Until then, a yes on employee data goes off on a change of AI company and asks again, which is the lead's interim default.
- A saved key for the other provider stays, marked Key saved, with Remove after switching.
- The lead's defaults, as this document recommends: which provider shows first and whether a tab is the right home.

## 8. Decisions for the owner

### 1. Do the app switches stay in Kuna settings too?

Screen: Kuna settings, Assistant card. Today, Company's two tasks and employee switches take half the card.

- **Short line and a link in Kuna settings, controls in the app.** "Company: Asks first. Settings". You see every app at a glance, and turning one off takes one more tap. The card is about half as tall. Costs a summary row and a link.
- **The full block in both places, as you first said.** Turn anything off from either. The card stays long, and the employee lines still show in general settings. Costs almost nothing to build.

Recommendation: the short line. Your words allowed leaving it there, and this leaves the overview but not the weight. Is the short line enough?

### 2. What does an app's switch mean, now that a chat asks per chat? (The hardest one.)

Screen: Company, Settings, Assistant tab, and later the chat. Example today: Company's switch is off, you tap Suggest categories, and Kuna offers to switch it on. So off already means "ask me". Later, in a chat, you allow reading Company for that chat, and tomorrow's chat asks again unless you chose Always.

- **One switch, "Send without asking".** Off asks, on stops asking, and the chat's Always writes this same switch. One idea for buttons and chat, and Always has a place to be seen and revoked. Nothing can say "never" except not tapping, or having no key. Costs a label and a few strings.
- **A real off that hides the assistant in that app, plus the per-chat asks.** Off means gone, and you can promise an app is out of it. A new person with a key sees no buttons until finding the switch, and a person with it on still gets asked in chat, so two gates to explain. Costs a second concept and a change in `AssistButton`.
- **No app switch, only asks.** Least on screen, and the tab lists only what is sent and the employee switches. Each button asks each time, and "Always" from your chat answer has nowhere to be undone. Costs dropping or moving your Always answer.

Recommendation: "Send without asking". Which one?

### 3. When you change AI company, does your yes on employee data carry over?

Screen: Kuna settings' select. Example: you allowed employee names and pay to go to Anthropic, then switch to OpenRouter, where what the model's own company keeps depends on its terms. Today's switch named Anthropic when you said yes.

- **Employee yes goes off on a change, the app switches stay.** The next run with employee data asks once, naming the new company. Costs one extra tap per task, and a line in the card.
- **Everything carries over.** No interruption. Names and pay go to a company you never said yes to for that data.
- **All switches go off, the app's too.** Strictest and simplest to explain. Every app asks again after a change you just made on purpose.

Recommendation: employee yes goes off, the rest stays. Whether this also needs a line in the employer's processing records is unresearched and not legal advice. Which one?

### 4. Does a saved key for the other company stay?

Screen: the select. Example: you tried OpenAI, went back to Anthropic, and an unused OpenAI key sits in this browser and in your Google file. You said "configure that provider only", which can also read as one key at a time.

- **Keep it, marked "Key saved", with a Remove link after switching.** Going back takes one tap. One forgotten key may sit in your Google account until removed. Costs a line.
- **Remove it on switching, after a question.** Exactly one key ever. Going back means making a new key, since providers often show one only once, and the removal syncs to your other browsers. Costs a dialog.

Recommendation: keep it. Which one?

### 5. Which company shows first in the select?

Screen: the select, with no key yet. It starts on the first entry of `PROVIDER_PRESETS`, Anthropic today, which reads as a recommendation. Your onboarding answer says the first named is the better reader on five real Croatian documents, tested with your keys, and that test has not happened.

- **Leave Anthropic first until the test.** One less tap, and a default that may change. No cost now.
- **Start empty, with "Choose an AI company".** No implied recommendation. One more tap for everyone, and a stranger has no basis to choose.

Recommendation: leave it first, reorder after the test. I am an Anthropic model, so do not take my word on the order. Which one?

### 6. Is a tab the right home for Company and Spending?

Screen: each app's Settings. Example: Company's tab row already holds General, Categories, Category rules, Accounts, the pack's tabs and Books file, which is long on a phone.

- **A tab "Assistant".** A clear place for the link to land, and General stays as it is. One more tab to scroll past on a phone.
- **A card at the foot of General.** No new tab. In Company it sits under a long form, and the link lands far above it.

Recommendation: the tab. Say if you would rather not grow the tab row.

## Sources seen only as search snippets (unconfirmed)

- [Anthropic help, paid plans and API billing](https://support.claude.com/en/articles/9876003-i-have-a-paid-claude-subscription-pro-max-team-or-enterprise-plans-why-do-i-have-to-pay-separately-to-use-the-claude-api-and-console): the page gave no answer when fetched.
- [OpenAI help, prepaid billing](https://help.openai.com/en/articles/8264644): fetching it returned 403.
