# Language wave: English and Croatian

How Kuna gets an English and a Croatian UI, from three research lanes checked against 2cafa72, staged so the Loans screens come first in both languages, with the four decisions it needs from the owner.

From three lanes in `research/language/`: [the text Kuna holds](research/language/lane1-codebase.md), [how to build the layer](research/language/lane2-mechanics.md) and [Croatian terms and the setting](research/language/lane3-croatian.md). Read against the repo at `2cafa72`.

## What the research settled

- **A typed dictionary in the app, no vue-i18n.** English is the source object and Croatian is typed against it. A missing Croatian string, an extra key or a wrong parameter fails `vue-tsc`. vue-i18n accepts any string as a key, types parameters loosely and picks Croatian plurals wrongly by default. Zero new dependencies.
- **Plurals through `Intl.PluralRules`.** Croatian has three forms, `one`, `few` and `other` (1 anuitet, 2 anuiteta, 5 anuiteta, 21 anuitet). Each counted phrase becomes a whole sentence per language, because the verb and adjectives change with the count too (2 anuiteta kasne, 5 anuiteta kasni).
- **Intl writes Croatian dates and money correctly.** `28. 10. 2026.`, `28. listopada 2026.`, `listopad 2026.`, `1.480,25 €`. Phrases Intl cannot build, like `od listopada do prosinca`, become dictionary functions.
- **Nuxt UI is one prop.** `App.vue` already renders `UApp`. Binding `:locale` to `hr` or `en_gb` from `@nuxt/ui/locale` covers close buttons, toasts, empty states and select-menu search.
- **The choice lives per device, like the theme.** It defaults to Croatian when the browser's languages start with `hr`, otherwise English. Settings, This device offers Browser language, English and Hrvatski. A `?lang=` query pins it for one visit, the same way `?theme=` does. A file can't hold it, because the first run shows before any file exists and Company and Loans have separate files.
- **The size.** About 6,000 strings: shell 35, shared 250, Loans 440, Company 5,300. Of Company's, about 1,230 sit in domain code (refusals, reasons, labels on computed figures), 520 are ruleset research notes and 150 are notes written into exported files.

## What you will see

- A language choice in Settings, This device. Picking one reloads the app in that language.
- Every screen, toast, refusal and empty state in Croatian, with numbers and dates written the Croatian way.
- The Loans screens say `kredit` for a bank loan, `pozajmica` for a loan between people and `anuitet` for an instalment. `obrok` appears only for the APN subsidy count, which is the law's word. The glossary in lane 3 fixes one Croatian word per concept.
- What you typed stays as you typed it: category labels, loan names, notes, client names.

## What stays English or untouched

- **The files.** Record kinds, field names, setting keys, Sheet tab and column names, export and backup names, and the column notes Kuna writes into the Sheet. A file is a data format every device reads, whatever its language.
- **Bank and mail matching.** camt.053 tags, import column guesses like `isplat` and `uplat`, and mail subjects like `ERSTE Izvadak`, `Plaća za` and `PDV za`.
- **Legal names and codes.** JOPPD, PD-NN, GFI, APN, EKS, act titles, NN issue numbers. On the English screen VAT stays VAT. On the Croatian screen it becomes PDV.
- **Route paths.** `/company/review` and `/loans/bank-loan` keep working on both languages. The browser tab title follows the screen title, so it is translated.
- **Invoices.** They follow each client's `mail_language`, as today. The PDF headings stay English in this wave.
- **The ruleset's research notes.** The long rule notes in the hr-doo pack are legal research prose, which is a writing job, not a translation of screen text. They stay English. Their act titles are already Croatian.

## Settled without asking

- **Switching reloads the app.** You change language rarely. A reload lets the 55 date formatters and every module-level text read the language once at start, instead of turning each into a live value. It works offline, since the service worker already holds every file.
- **Domain text reads the language at start too.** Refusals and reasons stay where they are today, worded per language in the feature's own `wording` module. The shared language module sits in `src/shared/text/`, which domain code may already import, so the import boundaries stay as they are.
- **Record nouns gain gender.** "Added the invoice", "Changed 2 categories and deleted an asset" are built from `RecordNoun`. Croatian needs `Račun je dodan` but `Kategorija je dodana`, so each kind's noun carries its Croatian forms and gender, and the change sentence is written per language.
- **Typed names are quoted, not inflected.** `Uredi „Stambeni kredit”`. The app cannot put a name you typed into the accusative.
- **Tests and checks stay in English.** The vitest setup pins English and the browser checks visit with `?lang=en`, so the 261 English assertions, the browser flows and `check:figures` digests keep passing unchanged. New checks add Croatian on top.

## Stages

Each stage is one commit, checked and pushed, with CI green before the next.

1. **The language layer.** `src/shared/text/language.ts` with the choice, the `?lang=` pin, storage under `kuna.language`, `<html lang>`, the Intl tag, the `plural()` helper and the `Translation` type. The picker on This device. `UApp :locale`. The 55 hard-coded `en-GB` date formatters, the `en` collator and the English currency names go through shared helpers that read the Intl tag. A vitest lists keys present in one language only and calls each Croatian plural with 1, 2, 5, 21 and 1.5. Nothing visible changes in English.
2. **Shell, shared and Loans in both languages.** About 725 strings, the record nouns, sync status, the first runs and every Loans screen. The visual check adds `?lang=hr` visits for the Loans screens and the shell at every width, since Croatian runs longer.
3. **Stop for your review.** You read the Loans screens in Croatian on the live site. Wording you change goes into the glossary before Company starts, so the bulk follows one set of words.
4. **Company, screen by screen.** One commit per group of features, each with its domain text. The visual check adds `?lang=hr` for each group as it lands. The groups:
   - transactions, review, categories and rules
   - imports, sync and mail
   - invoicing and billing
   - settings and onboarding
   - the hr-doo screens: salaries, taxes, assets, year end, pay scenarios
5. **A Croatian pass over everything.** The visual check at `?lang=hr` on every screen, and a scan for English left on Croatian screens: a check visits each screen in Croatian and lists text nodes that match an English word list.

## Proof

- `vue-tsc` fails on a missing or extra Croatian key or a wrong parameter.
- The key-parity and plural vitest passes.
- In English, the five company figure sets give identical `check:figures` digests before and after every stage, and every existing check passes unchanged.
- The visual and touch checks pass at `?lang=hr` for every screen a stage covers, with no text overflowing its card.
- On your device, picking Hrvatski shows the Loans Overview with `1.480,25 €` and `28. 10. 2026.`, and picking English brings back `1,480.25` and `28 Oct 2026`.

## The owner's answers, 2026-10-28

- **Number format: keep the setting as an override.** Dates always follow the language. Amounts follow the language unless the Company file's `number_locale` names a format. A blank `number_locale` means follow the language, and new files start blank, with "Follow the language" as the first choice at onboarding and in Settings. A file that stores `en-GB` keeps writing `1,480.25` until the setting is cleared. The owner's live file stores no `number_locale`, so it follows the language. Loans has no setting, so its amounts follow the language. The setting's note changes to say the blank default follows the language and that dates always do. Invoices keep their own per-client format.
- **Seeded names:** translate what the owner hasn't typed.
- **Register:** `vi` in sentences, the short form on buttons.
- **Mixed app:** show Croatian as each part lands.

## Decisions for the owner

### Numbers and dates follow the language

Today the Company file's number format setting decides how amounts are written, with the note "Dates and text stay in English". On a Croatian screen with that setting on `en-GB` you would see `1,480.25` next to Croatian text.

- **Let the language decide.** Croatian writes `1.480,25 €` and `28. 10. 2026.`, English writes `1,480.25` and `28 Oct 2026`. The number format row is dropped from the file and its setting disappears. Currency stays in the file. Cost: no English text with Croatian numbers, and no `de-DE` style.
- **Keep the setting as an override.** Any mix stays possible. Cost: two settings for one thing, and a note explaining which wins.

Recommendation: let the language decide.

### Names Kuna seeds into a new file

A new Company file starts with English category slugs like `office-rent`, shown as "office rent", and English bucket labels like "Operating cost". On a Croatian screen these would stay English.

- **Translate what you haven't typed.** A blank label shows Kuna's Croatian name (`najam ureda`). A bucket label still equal to the English default counts as untouched and shows in Croatian. Your typed labels always win, so your live file reads as today. Cost: about 40 names in the dictionary.
- **Write the language into the file at creation.** A file made on a Croatian screen gets Croatian labels as data. Older files and switching later change nothing.

Recommendation: translate what you haven't typed.

### How buttons and sentences address you

Croatian bank and government sites all use `vi`, written lowercase in a sentence.

- **`vi` in sentences, short form on buttons.** Buttons read `Spremi`, `Poništi`, `Obriši`. Sentences read `Ništa se ne sprema dok ne primijenite`. This is how Croatian software menus usually read.
- **`vi` everywhere.** Buttons read `Spremite`, `Poništite`. Matches the bank sites, but buttons read long.
- **`ti` everywhere.** Personal, close to Erste George's slogans. No bank uses it in running text.

Recommendation: `vi` in sentences, short form on buttons.

### Croatian while Company is still English

After stage 2 the Loans screens and the shell are in Croatian, but the Company screens stay English until stage 4 lands, over several commits.

- **Show Croatian as each part lands.** You can switch to Hrvatski right after stage 2 and read the Loans screens in Croatian. Company screens stay English until their group lands. Cost: a mixed app for a while.
- **Hide the choice until Company is done.** You see Croatian only at the end, through `?lang=hr` before that. Cost: your review of the wording waits, and the stage 3 stop has to use the query.

Recommendation: show Croatian as each part lands.
