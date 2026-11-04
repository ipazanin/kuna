# Language lane 3: Croatian terms and the language setting

A sourced English-to-Croatian glossary for Kuna's Company and Loans screens, the register and grammar Croatian UI text needs, where the language choice should live, and what must never be translated.

Code claims cite the kuna repo at `2cafa72`, with paths relative to its root. No name, IBAN, account number or loan figure from fixtures or Drive files appears here. Sources marked "loaded" were opened this session and say what is quoted. Anything else is labelled unconfirmed.

## Findings first

- **Instalment.** Croatian law says `obrok` and `anuitet`, never `rata`. Bank product pages say `anuitet`. Bank repayment tables and HNB consumer pages also say `rata`. Kuna computes equal payments, so the screens should say **anuitet** for a bank loan's instalment. Use `obrok` only where a subsidy counts covered instalments, because that is the APN law's wording.
- **Loan.** Use **kredit** for a bank loan, since the Civil Obligations Act (ZOO) defines `ugovor o kreditu` as a bank's contract. Use **pozajmica** for an informal loan between people. Its legal form is `ugovor o zajmu`, so `zajmodavac` and `zajmoprimac` fit only formal wording.
- **Consumer credit law changes on 20 November 2026.** The new `Zakon o potrošačkim kreditima` (NN 86/26) replaces both the consumer credit act and the housing consumer credit act. It keeps `obrok odnosno anuitet`, `otplatni plan` and `prijevremena otplata`. It renames the variable-rate index from `parametar` to `referentna vrijednost`.
- **Register.** Every Croatian bank site and gov.hr page loaded this session uses the plural `vi`, written lowercase mid-sentence. That includes Revolut's Croatian site. Erste uses `ti` only in George brand slogans. Recommendation: lowercase `vi` in sentences, bare imperatives on buttons (decision below).
- **Language setting.** Store it per device in `localStorage`, defaulting to the browser language, like the theme. First-run screens appear before any file exists, and there are two files (Company and Loans) with no shell-level home. Lanes 1 and 2 reach the same shape.
- **Open decisions for the owner.** There are three: whether the language replaces the `number_locale` setting, how seeded category and bucket names show in Croatian, and the button register.

## 1. Glossary

Tags point to the sources at the end. "Coined" means no source term was found, so the word is a proposal. "Practice" means common accounting or banking usage that no loaded primary source states.

### Loans: bank loans

| Kuna English                           | Croatian                                                    | Note                                                                                                                           |
| -------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Loans (app name)                       | Krediti                                                     | The word users look for. Informal loans sit inside it as `pozajmice`.                                                          |
| Bank loan                              | kredit                                                      | [ZOO] čl. 1021 defines `ugovor o kreditu` with `banka` and `korisnik kredita`. [HNB-Kr]                                        |
| Housing loan, Home loan                | stambeni kredit                                             | [ZSSK], [ZPK26] čl. 11(3)                                                                                                      |
| Lender (bank)                          | banka, vjerovnik                                            | `vjerovnik` is the legal word [ZPK] čl. 2. Use `banka` on screen.                                                              |
| Borrower                               | korisnik kredita                                            | [ZOO] čl. 1021, [ZSSK] čl. 11                                                                                                  |
| Amount borrowed                        | iznos kredita                                               | The [OTP-plan] header says `ugovoreni iznos`.                                                                                  |
| Principal                              | glavnica                                                    | [ZPK] čl. 14, [HUB], [OTP-plan]                                                                                                |
| Interest                               | kamata                                                      | [HUB]                                                                                                                          |
| Yearly rate, %                         | godišnja kamatna stopa                                      | Nominal rate. [HNB-K] calls it `nominalna kamatna stopa`, usually yearly.                                                      |
| Fixed (rate)                           | fiksna kamatna stopa                                        | [ZPK] čl. 2(1)(11), [HUB]                                                                                                      |
| Variable (rate)                        | promjenjiva kamatna stopa                                   | [ZPK] čl. 11a, [HUB]                                                                                                           |
| Fixed then variable                    | kombinirana kamatna stopa                                   | Erste's product label [Erste]                                                                                                  |
| Index (EURIBOR)                        | parametar, referentna vrijednost                            | `parametar` in [ZPK] čl. 11a. `referentna vrijednost` from 20.11.2026 [ZPK26] čl. 16. Keep `EURIBOR` as is [HUB].              |
| Margin                                 | marža                                                       | [ZPK] čl. 11a says `fiksne marže banke`.                                                                                       |
| Rate period                            | razdoblje kamatne stope                                     | Coined. Banks write `razdoblje fiksne kamatne stope` informally (unconfirmed).                                                 |
| EKS (if ever shown)                    | efektivna kamatna stopa (EKS)                               | [ZPK] čl. 2(1)(9), [HUB]. Kuna computes the nominal rate, so never label it EKS.                                               |
| Instalment                             | anuitet                                                     | [HPB]: `Anuitet je iznos kojeg korisnik plaća mjesečno`. [ZPK], [ZPK26] čl. 12.                                                |
| Monthly instalments (count)            | broj anuiteta                                               | The [OTP-plan] header says `broj rata`.                                                                                        |
| First instalment                       | prvi anuitet                                                | The [OTP-plan] header says `datum prve rate`.                                                                                  |
| New instalment, Lower instalment       | novi anuitet, niži anuitet                                  |                                                                                                                                |
| Due, Instalment due                    | dospijeće, dospijeva                                        | [HUB], [OTP-plan] column `datum dospijeća`                                                                                     |
| Plan                                   | otplatni plan                                               | [ZPK] čl. 10, [ZPK26] čl. 18, [OTP-plan]                                                                                       |
| Interest (plan column)                 | kamata                                                      | The [OTP-plan] column says `kamata u rati`.                                                                                    |
| Principal (plan column)                | otplata glavnice                                            | [OTP-plan]                                                                                                                     |
| Owed after (plan column)               | ostatak duga                                                | The [OTP-plan] column says `ostatak glavnice`. Kuna's balance is principal only, so `ostatak glavnice` is exact.               |
| Owed today                             | preostali dug                                               | Practice                                                                                                                       |
| Owed at the start                      | dug na početku                                              | Coined                                                                                                                         |
| Paid out on                            | datum isplate                                               | [OTP-plan], [HUB] (`od dana isplate kredita`)                                                                                  |
| Interest before the first instalment   | interkalarna kamata                                         | [HNB-K], [HUB]. Distinct from `poček` (grace period) [HUB].                                                                    |
| Late instalments, Mark late            | anuiteti u kašnjenju, označi kao zakašnjeli                 | Coined. Do not say `zatezna kamata` (default interest) [HNB-K], [HUB]. Kuna does not compute it.                               |
| Paid on                                | plaćeno                                                     | Practice                                                                                                                       |
| Extra payment                          | prijevremena otplata                                        | [ZPK26] čl. 11(1)(32): full or partial (`potpuno ili djelomično`). The dialog title can say `djelomična prijevremena otplata`. |
| Extra amount                           | iznos prijevremene otplate                                  |                                                                                                                                |
| Shorter term                           | kraći rok otplate                                           | `rok otplate` per [HPB]                                                                                                        |
| Interest saved                         | ušteda na kamatama                                          | Coined                                                                                                                         |
| Sooner by                              | ranije za                                                   | Takes accusative: `ranije za 2 godine`.                                                                                        |
| Paid off                               | otplaćen                                                    | Masculine, agrees with `kredit`.                                                                                               |
| Subsidy                                | subvencija                                                  | [APN] headings `Produženje subvencije`, `Obustava subvencije`                                                                  |
| A subsidy pays part of each instalment | subvencija plaća dio anuiteta                               | [ZSSK] čl. 11 says `dio mjesečnih obroka ili anuiteta`.                                                                        |
| Instalments covered                    | broj subvencioniranih obroka                                | [ZSSK] čl. 14 says `prvog obroka ili anuiteta`.                                                                                |
| Subsidy each month                     | mjesečni iznos subvencije                                   | Coined                                                                                                                         |
| APN                                    | APN (Agencija za pravni promet i posredovanje nekretninama) | [ZSSK] čl. 1(2). Never translate.                                                                                              |
| What if I pay extra                    | Što ako uplatim više                                        | Coined                                                                                                                         |

### Loans: informal loans

| Kuna English                     | Croatian                            | Note                                                                  |
| -------------------------------- | ----------------------------------- | --------------------------------------------------------------------- |
| Informal loan                    | pozajmica                           | Practice. Legal form is `ugovor o zajmu` [ZOO] čl. 499.               |
| Lender, borrower (formal)        | zajmodavac, zajmoprimac             | [ZOO] čl. 499                                                         |
| Movements                        | promjene                            | Coined                                                                |
| Borrowed, Repaid                 | posuđeno, vraćeno                   |                                                                       |
| Borrowed in kind, Repaid in kind | posuđeno u naravi, vraćeno u naravi | `u naravi` is the tax-law idiom for non-cash value (practice).        |
| Forgiven                         | oprošteno                           | Legal concept is `otpust duga` (unconfirmed, ZOO not checked for it). |
| You owe, They owe you            | dugujete, duguje vam / duguju vam   | Verb number follows the other party. See the grammar notes.           |

### Company bookkeeping

| Kuna English                     | Croatian                                                                           | Note                                                                                                                                                         |
| -------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Company (app name)               | Tvrtka                                                                             | `društvo` is the legal word (d.o.o.).                                                                                                                        |
| Transactions                     | transakcije                                                                        |                                                                                                                                                              |
| Account (bank)                   | račun u banci                                                                      | `račun` also means invoice. Say `račun u banci` wherever both can appear.                                                                                    |
| Statement                        | izvod                                                                              | Practice. Keep `camt.053`.                                                                                                                                   |
| Ledger                           | evidencija prometa                                                                 | Coined. Do not use `glavna knjiga`. In [ZoR] čl. 11 that is the double-entry general ledger, which Kuna's cash ledger is not.                                |
| Books                            | poslovne knjige (only for the accountant's)                                        | [ZoR] čl. 11. Kuna's own file is better called `datoteka` to avoid the legal sense.                                                                          |
| Category, Bucket, Family         | kategorija, skupina, grupa                                                         | Coined. Two near-synonyms for two levels, so keep them fixed.                                                                                                |
| Income                           | prihodi                                                                            | GFI line `Prihodi od prodaje` already in `yearEnd.ts`                                                                                                        |
| Operating cost                   | poslovni rashodi                                                                   | Practice                                                                                                                                                     |
| Revenue                          | prihod                                                                             |                                                                                                                                                              |
| Taxes                            | porezi                                                                             |                                                                                                                                                              |
| Owner, Owner pay                 | vlasnik, isplate vlasniku                                                          | `član društva` is the formal word (practice).                                                                                                                |
| Loans to the owner               | pozajmice članu društva                                                            | Practice                                                                                                                                                     |
| Review (screen)                  | Za provjeru                                                                        | Must not collide with Overview `Pregled`.                                                                                                                    |
| Rules                            | pravila                                                                            |                                                                                                                                                              |
| Invoice, Invoicing               | račun, računi                                                                      | [ZPDV] čl. 78-79                                                                                                                                             |
| Issued                           | izdan                                                                              |                                                                                                                                                              |
| Client                           | kupac, klijent                                                                     |                                                                                                                                                              |
| VAT                              | PDV                                                                                | [ZPDV]                                                                                                                                                       |
| Input VAT                        | pretporez                                                                          | [ZPDV] čl. 66, 85                                                                                                                                            |
| Reverse charge                   | prijenos porezne obveze                                                            | [ZPDV] čl. 79(7). Kept in the invoice note.                                                                                                                  |
| Small taxpayer                   | mali porezni obveznik                                                              | [ZPDV] čl. 90                                                                                                                                                |
| Tax year                         | razdoblje oporezivanja                                                             | [ZPDV] čl. 84                                                                                                                                                |
| Incoming, outgoing invoices      | ulazni računi, izlazni računi                                                      | Practice                                                                                                                                                     |
| URA, IRA                         | knjiga primljenih (ulaznih) računa (U-RA), knjiga izdanih (izlaznih) računa (I-RA) | Unconfirmed: wording from a RRiF search snippet only. A 2026 TEB article says the forms were abolished for VAT. It is paywalled, so that is unconfirmed too. |
| Corporate income tax, PD return  | porez na dobit, prijava poreza na dobit (PD)                                       | [PU-PD]                                                                                                                                                      |
| Cash-basis return                | PD-NN                                                                              | Keep the code.                                                                                                                                               |
| Income tax                       | porez na dohodak                                                                   | Act title in `acts.ts`                                                                                                                                       |
| Contributions                    | doprinosi                                                                          | Act title `Zakon o doprinosima`                                                                                                                              |
| Salaries, Payday                 | plaće, dan isplate                                                                 |                                                                                                                                                              |
| Gross, Net                       | bruto plaća, neto plaća                                                            | Practice                                                                                                                                                     |
| To the employee, To the state    | zaposleniku, državi                                                                |                                                                                                                                                              |
| Employee                         | zaposlenik                                                                         | `radnik` is the labour-law word (unconfirmed).                                                                                                               |
| Personal deduction               | osobni odbitak                                                                     | [PU-JOPPD] link text                                                                                                                                         |
| JOPPD                            | JOPPD                                                                              | Full name [PU-JOPPD]: `Izvješće o primicima, porezu na dohodak te doprinosima za obvezna osiguranja`.                                                        |
| Year (year-end screen)           | godina, zaključak godine                                                           | Coined                                                                                                                                                       |
| Annual financial statements      | godišnji financijski izvještaji (GFI)                                              | [ZoR] čl. 18                                                                                                                                                 |
| Balance sheet                    | bilanca                                                                            | [ZoR] čl. 18(2)                                                                                                                                              |
| Profit and loss                  | račun dobiti i gubitka                                                             | [ZoR] čl. 18(2)                                                                                                                                              |
| Profit before tax                | dobit prije oporezivanja                                                           | GFI line in `yearEnd.ts`                                                                                                                                     |
| Long-term assets, Asset register | dugotrajna imovina, popis dugotrajne imovine                                       | GFI lines in `yearEnd.ts`                                                                                                                                    |
| Depreciation                     | amortizacija                                                                       | GFI line in `yearEnd.ts`                                                                                                                                     |
| Book value                       | knjigovodstvena vrijednost                                                         | Practice                                                                                                                                                     |
| Grant                            | potpora                                                                            | Practice. `bespovratna sredstva` is the funding-call word.                                                                                                   |
| Micro entrepreneur               | mikro poduzetnik                                                                   | [ZoR] čl. 5(3)                                                                                                                                               |
| Konto lines                      | konto                                                                              | Already Croatian in the English UI. Keep.                                                                                                                    |
| Accountant                       | knjigovođa                                                                         | `računovođa` also used. Pick one.                                                                                                                            |
| Dividend                         | dividenda                                                                          |                                                                                                                                                              |

### App words

| Kuna English                | Croatian                                    | Note                                                           |
| --------------------------- | ------------------------------------------- | -------------------------------------------------------------- |
| Overview                    | Pregled                                     |                                                                |
| Settings                    | Postavke                                    |                                                                |
| This device                 | Ovaj uređaj                                 |                                                                |
| Appearance                  | Izgled                                      |                                                                |
| Import, Export              | Uvoz, Izvoz                                 | Nouns for headings                                             |
| Export to Excel             | Izvezi u Excel                              |                                                                |
| Undo, Undone                | Poništi, Poništeno                          |                                                                |
| Sync, Sync as the app opens | Sinkronizacija, Sinkroniziraj pri otvaranju |                                                                |
| Estimate, est.              | procjena                                    | Drop the abbreviation. Write the word or use `≈`.              |
| Save, Cancel                | Spremi, Odustani                            |                                                                |
| Delete, Change, Add         | Obriši, Uredi, Dodaj                        | Use `Uredi` for edit. `Promijeni` only for switching a choice. |
| Apply, Continue, Back       | Primijeni, Nastavi, Natrag                  |                                                                |
| Dismiss, Restore, Retry     | Odbaci, Vrati, Pokušaj ponovno              |                                                                |
| Dry run                     | probni uvoz                                 |                                                                |
| Filters, Search             | Filtri, Pretraži                            |                                                                |
| Name                        | naziv (things), ime (people)                | Two Croatian words for one English one                         |
| Amount, Date, Note          | iznos, datum, napomena                      |                                                                |
| Period, Quarter, Month      | razdoblje, tromjesečje, mjesec              |                                                                |
| Sign out of Google          | Odjava s Googlea                            |                                                                |

That is about 120 English labels in about 95 rows.

### Obrok, rata or anuitet

- **Law.** The consumer credit act uses `obrok` roughly 25 times and `anuitet` several times, and `rata` not once. That count covers the first two thirds of the text, which is what loaded. The 2026 act says `iznos obroka odnosno anuiteta`. It uses `rata` only in `plaćanje na rate`, a card instalment purchase. The APN subsidy act says `obroka ili anuiteta`. [ZPK], [ZPK26], [ZSSK]
- **Supervisor and banks.** HNB's consumer page writes `anuitet/rata` side by side [HNB-K]. HUB's glossary defines `anuitet` and mentions `rata kredita` in passing [HUB]. HPB and Erste product pages say `anuitet` [HPB], [Erste]. An OTP repayment table uses `rata` throughout, but it is linear repayment with falling payments, so `anuitet` would be wrong there [OTP-plan].
- **Pick for Kuna.** `anuitet` names an equal payment of principal plus interest, which is exactly what `loanPlan.ts` computes. It is also the word on Croatian housing-loan offers. `rata` reads as colloquial or as card instalments. `obrok` is the legal umbrella and fits the subsidy count. Use one word per concept and do not alternate.

### Kredit or zajam

`zajam` is the general contract in which a lender hands over money to be returned (ZOO čl. 499). `kredit` is the bank's contract to make funds available (ZOO čl. 1021). The consumer credit act calls every consumer loan a `kredit`, which may take the form of a `zajam` (ZPK čl. 2). The HNB and every bank say `kredit`. So bank loans are `krediti`, and a loan between people is a `zajam`, or `pozajmica` in everyday speech. Kuna's informal loans are everyday loans between people, so the screen word is `pozajmica`.

## 2. Register and style

### Ti or vi

| Source (loaded)           | Form                                        | Example                                               |
| ------------------------- | ------------------------------------------- | ----------------------------------------------------- |
| Revolut hr-HR             | `vi`, lowercase                             | `Registrirajte se besplatno`, `vaša očekivanja`       |
| Erste građani             | `vi`, with `ti` in George and youth slogans | `Saznajte više`, then `Tvoj spoj s ulaganjem`         |
| Zaba                      | `vi`, lowercase mid-sentence                | `za vaš novi dom`. One `ti` banner for students.      |
| PBZ                       | `vi`, lowercase                             | `Odaberite kredit koji vam treba`                     |
| OTP                       | `vi`, lowercase, one stray `Saznaj više`    | `bliža vašim potrebama`                               |
| gov.hr (e-Građani portal) | `vi`, lowercase mid-sentence                | `Postavite prečice na usluge koje najčešće koristite` |

The text of the George app and of the Revolut app itself is unconfirmed, because only the public sites were loaded. A secondary source says the capital `Vi` belongs to letters addressed to one person (unconfirmed, the pravopis.hr page was not loaded). Product UIs write `vi` lowercase.

**Decision: button register.** Today an English button says "Save" and a sentence says "Nothing is saved until you apply it".

- **Plural `vi` everywhere.** Buttons read `Spremite`, `Odustanite`. This matches the banks' web copy, but Croatian buttons rarely look like that.
- **`vi` in sentences, bare imperative on buttons.** Buttons read `Spremi`, `Poništi`, and sentences read `Ništa se ne sprema dok ne primijenite`. This is how Croatian software menus usually read (unconfirmed, no Croatian software UI was loaded). It mixes two forms by role, not at random.
- **`ti` everywhere.** Close to George's voice and to a personal app, but no loaded bank uses it in running text.

Recommendation: the second. Write the rule into the translation file's header so it stays one rule.

### Case, dates, money

- **Sentence case** for headings, menu items and buttons, as gov.hr does. Croatian capitalises months and weekdays only at the start of a sentence ([Wikipedia date notation](https://en.wikipedia.org/wiki/Date_and_time_notation_in_Croatia), secondary).
- **Dates.** Write `28. 10. 2026.` with a space after each dot and a dot after the year. pravopis.hr shows `6. XI. 1989.` [Pravopis]. Zaba writes `15. 10. do 21. 12. 2026.` Bank repayment tables drop the spaces (`7.2.2024`), which is acceptable in a dense table. Long form: `28. listopada 2026.` (month in genitive). Month heading: `listopad 2026.` (nominative). Croatian month names are `siječanj` to `prosinac`, never `oktobar`.
- **Node 24 / ICU 78 output checked locally:** `hr-HR` gives `28. 10. 2026.`, `28. listopada 2026.`, `listopad 2026.`, `1.480,25 €`, `−1.480,25 €`, `3,50 %`, `1.234`. The short month comes out as `28. lis` with no abbreviation dot, and `lis 26.` for month plus two-digit year. Check those on chart axes and prefer the full or numeric forms.
- **Money.** Use `1.480,25 €`: a dot for thousands, a comma for decimals, a non-breaking space, and the sign after the amount. Banks vary: Zaba `50.000 EUR`, Erste `25 €`, OTP `201.396,63EUR`, and the accounting act `450.000,00 eura`. Intl's output is the cleanest. Negative amounts use U+2212 from Intl, so tests that look for `-` will break.
- **Percent.** Intl writes `3,50 %` with a space, as Revolut and OTP do. Erste writes `5,90%`.

### Grammar that breaks translated UIs

1. **Three plural forms, chosen by the last digits** ([CLDR]): `one` for 1, 21, 31, 101 (not 11). `few` for 2-4, 22-24 (not 12-14). `other` for 0, 5-20, 25-30, 111. `Intl.PluralRules('hr')` returns exactly this. So `1 anuitet, 2 anuiteta, 5 anuiteta, 21 anuitet`, `1 godina, 2 godine, 5 godina, 12 godina, 21 godina`, `1 mjesec, 2 mjeseca, 5 mjeseci`, `1 rata, 2 rate, 5 rata`.
2. **Adjectives and verbs follow the same three forms.** `1 mjesečni anuitet kasni`, `2 mjesečna anuiteta kasne`, `5 mjesečnih anuiteta kasni`. The verb is singular again for `other`.
3. **The outer phrase sets the case.** `za 3 godine`, `nakon 3 godine`, `u 3 godine`. Translators need whole sentences with placeholders, not counted nouns to splice in.
4. **Past participles agree with the noun.** `Kredit je spremljen`, `Pozajmica je spremljena`, `Postavke su spremljene`, `Zaposlenici su spremljeni`, and the bare toast `Spremljeno`. A shared "{thing} saved" key cannot work. Each noun needs its own sentence.
5. **User data cannot be inflected.** `Change ${line.title}` needs the accusative, which the app cannot form from a typed name. Quote it instead: `Uredi „Stambeni kredit”`. Croatian quotes are `„…”`.
6. **Negative concord.** `Ništa ne čeka provjeru` and `Još nema kredita`, where `nema` takes the genitive. Literal English negation reads wrong.
7. **Enclitics sit second.** `je`, `su`, `se`, `vam` move to the second slot, so a fragment glued after a variable often lands them wrong. Example: `Buduća uplata ... samo je procjena`.

### Ten before/after examples

| Kuna English                                                                           | Naive Croatian                                              | Croatian                                                        | What it shows                                                                                  |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 300 instalments over 25 years (`PlanCard.vue:34` builds `year`/`years` with a ternary) | 300 anuiteti preko 25 godine                                | 300 mjesečnih anuiteta kroz 25 godina                           | Both counts need CLDR forms. The ternary only knows English.                                   |
| You pay 1,480.25                                                                       | Vi plaćate 1,480.25                                         | Plaćate 1.480,25 €                                              | Pronoun dropped, number from Intl, sign after                                                  |
| Owed after (plan column)                                                               | Dugovano nakon                                              | Ostatak duga                                                    | A column header is a noun phrase, as on the bank's plan.                                       |
| A payment still to come at a variable rate is an estimate.                             | Plaćanje koje tek dolazi po varijabilnoj stopi je procjena. | Buduća uplata uz promjenjivu kamatnu stopu samo je procjena.    | The legal term `promjenjiva` and enclitic order                                                |
| Undo / Undone                                                                          | Vrati / Vraćeno                                             | Poništi / Poništeno                                             | `Vrati` reads as "give back" (money).                                                          |
| Loan saved / Informal loan saved                                                       | Kredit spremljeno                                           | Kredit je spremljen / Pozajmica je spremljena                   | Gender agreement                                                                               |
| 3 late                                                                                 | 3 kasno                                                     | 3 anuiteta kasne (1 anuitet kasni, 5 anuiteta kasni)            | The verb changes with the plural form.                                                         |
| Sooner by 2 years 3 months                                                             | Ranije by 2 godina 3 mjeseci                                | Ranije za 2 godine i 3 mjeseca                                  | Accusative after `za`, `i` between units                                                       |
| The Loans file holds no informal loan by this link. It may have been deleted.          | ... Možda je obrisan.                                       | U datoteci nema pozajmice s ovom poveznicom. Možda je obrisana. | Genitive after `nema`. The participle follows `pozajmica`.                                     |
| Overview / Review                                                                      | Pregled / Pregled                                           | Pregled / Za provjeru                                           | Two English words collapse into one Croatian word.                                             |
| Interest in 2026 / Plan for 2026                                                       | Kamata u 2026                                               | Kamate u 2026. / Otplatni plan za 2026.                         | The year takes its dot. A template with the year as a slot is fine here.                       |
| They owe you (`whoOwes`)                                                               | Oni vam duguju                                              | Duguje vam (one person) / Duguju vam                            | The number of the other party is unknown, so rephrase as `Vama se duguje` or `Dug prema vama`. |

## 3. The language setting

### What the app keeps today

- **Per device in `localStorage`:** the theme (`kuna.theme`, `src/shared/theme/theme.ts`, System/Light/Dark with a `?theme=` pin), auto-sync, the mail-draft switch, folded cards, the chosen file and the Google session. Settings shows them on the "This device" tab (`src/shell/settings/SettingsScreen.vue`).
- **In the Company file's `settings` tab:** `currency`, `number_locale` (default `en-GB`, with the note "Dates and text stay in English"), bucket labels and the rest (`src/apps/company/settings/domain/settings.ts`).
- **Loans** has no settings and shows money as `en-GB` (`src/apps/loans/app.ts`).
- **Invoices** have their own language per client. The `mail_language` column on the clients tab sets the month name in the mail. The PDF headings are fixed English (`invoicePdf.ts:179-232`).

### Where the choice lives

| Option                                       | What the user sees                                                                                                                                                                             | Cost                                                                                        |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **Per device, like the theme** (recommended) | Phone and laptop each follow their browser language until the user picks one in Settings, This device. The start screens before any file exists are already in the user's language.            | One pick per device at most. Copies `theme.ts` with a `?lang=` pin.                         |
| In each app's file                           | The choice follows the user across devices, but Company and Loans could disagree. The page shows English until the file is read, which needs a Google token. The first run has no file at all. | A shell setting stored in app data, a flash of the wrong language, and two sources of truth |
| Both, device overriding file                 | Never needed for one user                                                                                                                                                                      | Two ways to do one thing                                                                    |

Default: the first `hr*` entry in `navigator.languages` gives Croatian, anything else English. Settings offers "Browser language / English / Hrvatski", with each language named in itself. The choice also sets `<html lang>`, which drives screen readers, hyphenation and Firefox's spellchecker on typed notes.

**Decision: does the language replace `number_locale`?** Today a Croatian screen could show `1,480.25` because the file says `en-GB`, or English text with `1.480,25` because the file says `hr-HR`.

- **Language decides number and date format.** Croatian gives `1.480,25 €` and `28. 10. 2026.`, English gives `1,480.25` and `28 Oct 2026`. The `number_locale` row is ignored when read and dropped from new files. Currency stays in the file, because it is a fact about the money. Cost: anyone wanting English text with Croatian numbers cannot have it.
- **Keep `number_locale` as an override.** Any mix is possible, but there are two settings for one thing and the note has to explain which wins.

Recommendation: let the language decide, which matches Lane 2's plan of an `en-GB` or `hr-HR` Intl tag per language.

### What stays in the file's own language

- **Typed by the user: shown as typed, in either UI language.** Category labels, account labels, loan and lender names, notes, client names, invoice items, the company name, mail templates, import profile names and the bank's column headers in a profile.
- **Seeded by the app.** New books get English category slugs (`office-rent`) with blank labels, and the screen shows `office rent`. They also get English bucket labels written into the `settings` tab (`emptyWorkbook.ts`, `settings.ts:234-244`).

**Decision: seeded names on a Croatian screen.** Today a Croatian user would see `office rent` and `Operating cost` in an otherwise Croatian UI.

- **Translate defaults, keep typed text.** A blank label on a seeded slug shows the app's Croatian name (`najam ureda`). A bucket label equal to the English default counts as not customised and is translated. New files write blank bucket labels. Cost: a dictionary of about 40 seeded names. The owner's live Sheet keeps reading, because typed labels win.
- **Write the language into the file at creation.** New Croatian books get Croatian labels as data. Old books and English books stay English, and switching the UI later does nothing to them.

Recommendation: the first. It keeps "typed is data, blank is the app's word" as the one rule.

- **App-written help inside the file.** The column notes from `workbookTemplate.ts` and the setting notes are English text the app writes into the Sheet. Keep them English. The file is a data format shared by every device, whatever its UI language. Translating them would make a file's text depend on which device created it.
- **Exports.** The Excel export's tab names (`ledger`, `categories` and so on) and header names are the format the importer reads back, so they stay English in both languages. Backup and document names (`kuna-company.json`, `kuna-loans-2026-10-28.json`) keep ISO dates. A translated tab name would make an export from a Croatian device unreadable on an English one.
- **Invoices** follow the client's `mail_language`, not the UI language. The owner bills in English while reading Kuna in Croatian. If the PDF gets Croatian headings later, it should read the same per-client field.

## 4. What not to translate

- **User data.** Everything typed, listed above, including text in Croatian inside an English UI.
- **Identifiers stored in files.** Record kinds and their values: `borrowed`, `repaid`, `borrowed-in-kind`, `repaid-in-kind`, `forgiven`, `fixed`, `variable`, `instalment`, `interim-interest`, `extra-payment`, `lower-instalment`. Also bucket ids, category slugs, roles, setting keys (`number_locale`, `owner_pay_module`, `label_income`), tab and column names, the `flagged_by` value `human`, schema ids, app ids `company` and `loans`, and `localStorage` keys. Translate only their labels on screen.
- **Route paths.** Keep `/company/review` and `/loans`, so links and bookmarks work on devices set to different languages. Browser titles come from the screen title and do get translated.
- **Bank and mail parsing.** camt.053 element names and codes (`BkToCstmrStmt`, `Ntry`, `BOOK`, `OPBD`, `CLBD`), import profile columns such as `Datum` with `date_format=dd.mm.yyyy`, the statement mail sender and subject phrase, and the accountant's subject phrases (`Plaća za`, `PDV za`). All of these are settings matched against Croatian text from outside. They must never change with the UI language.
- **Legal names and codes.** JOPPD, PD, PD-NN, GFI, FINA, APN, HNB, EKS, EURIBOR, IBAN, OIB, R1, konto, NN issue numbers, act titles (`Zakon o porezu na dobit`), JOPPD codes and the GFI line names already in `yearEnd.ts`. In the English UI `VAT` stays English. In Croatian it becomes `PDV`.
- **The brand.** `Kuna` stays a name. In Croatian text it can also read as the old currency, so never write `kuna` lowercase near amounts.
- **The ruleset.** The rule titles and notes in `packs/hr-doo/ruleset` are long legal English prose. Translating them is a separate chunk of work. A first pass can leave them English while their act titles are already Croatian.

## Sources

Loaded this session:

- [ZPK] Zakon o potrošačkom kreditiranju, consolidated, in force to 20.11.2026: https://www.zakon.hr/z/517/zakon-o-potrosackom-kreditiranju
- [ZPK26] Zakon o potrošačkim kreditima, NN 86/26, in force 20.11.2026, čl. 118 repeals ZPK and ZSPK: https://www.zakon.hr/c/zakon/1058075/zakon-o-potrosackim-kreditima
- [ZOO] Zakon o obveznim odnosima, NN 35/05, čl. 499 and čl. 1021: https://narodne-novine.nn.hr/clanci/sluzbeni/2005_03_35_707.html
- [ZSSK] Zakon o subvencioniranju stambenih kredita, consolidated to NN 146/20: https://www.zakon.hr/z/925/Zakon-o-subvencioniranju-stambenih-kredita
- [APN] https://apn.hr/subvencionirani-krediti/
- [HNB-K] HNB, Kamate: https://www.hnb.hr/o-nama/zastita-potrosaca/bitne-informacije/kamate
- [HNB-Kr] HNB, Krediti: https://www.hnb.hr/o-nama/zastita-potrosaca/bitne-informacije/krediti
- [HUB] Hrvatska udruga banaka, Mali bankovni pojmovnik (2014 file): https://www.hub.hr/sites/default/files/inline-files/mali_bankovni_pojmovnik_0.pdf
- [OTP-plan] OTP banka repayment plan annexed to a Zagreb City Assembly item (public, linear repayment): https://web.zagreb.hr/Sjednice/2021/sjednice_skupstine_2021.nsf/0/27473554F014F6A6C12587F300380BEB/$FILE/07+Prilog+-+Otplatni+plan.pdf
- [HPB] https://hpb.hr/ (the PDF link redirected to the home page, whose loan calculator defines `anuitet`)
- [Erste] https://www.erstebank.hr/hr/gradjanstvo/krediti/stambeni-krediti and https://www.erstebank.hr/hr/gradjanstvo
- Zaba https://www.zaba.hr/home/, PBZ https://www.pbz.hr/, OTP https://www.otpbanka.hr/, Revolut https://www.revolut.com/hr-HR/, gov.hr https://gov.hr/
- [ZPDV] Zakon o porezu na dodanu vrijednost, original text NN 73/13 (later amended): https://narodne-novine.nn.hr/clanci/sluzbeni/2013_06_73_1451.html
- [ZoR] Zakon o računovodstvu: https://www.zakon.hr/z/118/zakon-o-racunovodstvu
- [PU-JOPPD] https://porezna-uprava.gov.hr/hr/joppd/3956
- [PU-PD] https://porezna-uprava.gov.hr/HR_obrasci/Stranice/Obrasci.aspx
- [Pravopis] Hrvatski pravopis, Točka: https://pravopis.hr/pravilo/tocka/55/
- [CLDR] Plural rules: https://www.unicode.org/cldr/charts/latest/supplemental/language_plural_rules.html
- Intl output: local Node 24.21 with ICU 78.3, not a web source

Unconfirmed (not loaded or blocked):

- The U-RA/I-RA wording in the Pravilnik o PDV-u and their 2026 abolition (RRiF snippet, paywalled TEB article).
- The text of the George and Revolut apps themselves.
- The pravopis rule on capital `Vi` (a dnevnik.hr column, blocked).
- The housing consumer credit act text (zakon.hr redirected).
- The UI convention of Croatian software buttons.
- `otpust duga` in ZOO.
- `pozajmica`, `član društva`, `radnik` and the other entries marked practice.
