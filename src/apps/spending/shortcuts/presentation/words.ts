import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'
import type { ShortcutPartProblem } from '../domain/shortcuts'
import { en as entryEnglish, hr as entryCroatian } from '../../entries/presentation/words'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// A quick add is brzi unos, masculine, and Quick add the card and the tab, Brzi unos.

export const en = {
  title: 'Quick add',
  change: 'Change',
  more: (count: number) => `${count} more`,
  /** What a button says to a screen reader: what it adds and how much. */
  addThis: (name: string, amount: string) => `Add ${name}, ${amount}, for today`,
  added: (name: string) => `${name} added`,
  make: 'Make a Quick add',
  made: 'Quick add made',
  card: {
    subtitle: 'Each one is a button at the top of Entries that adds the same entry for today in one tap.',
    empty: 'No quick adds yet',
    emptyDescription: 'Make one for something you pay again and again, such as the morning coffee in cash. Kuna also offers one when you add the same entry for the third time in a month.',
    add: 'Add a quick add',
    edit: (name: string) => `Change ${name}`,
    up: (name: string) => `Move ${name} up`,
    down: (name: string) => `Move ${name} down`,
    moved: 'Quick add moved',
    hidden: 'Its account is closed or the bank fills it, so it shows no button.',
  },
  dialog: {
    addTitle: 'Add a quick add',
    changeTitle: 'Change the quick add',
    description: 'One tap on Entries adds this entry for today, on its account and to its payee. Parts split the entry, such as a coffee and its tip.',
    name: 'Button',
    nameHelp: 'Leave it blank to show the payee.',
    total: 'One tap writes',
    refusals: {
      zero: entryEnglish.split.refusals['zero-part'],
      'mixed-ways': 'Every part goes the same way, in or out.',
      'unknown-category': entryEnglish.split.refusals['unknown-category'],
      'between-accounts': entryEnglish.split.refusals['between-accounts'],
      'unknown-label': 'A label on this part is no longer in the file. Take it off.',
    } satisfies Record<ShortcutPartProblem, string>,
    saved: 'Quick add saved',
    deleted: 'Quick add deleted',
  },
}

export const hr: Translation<typeof en> = {
  title: 'Brzi unos',
  change: 'Promijeni',
  more: (count) => `Još ${count}`,
  addThis: (name, amount) => `Dodaj ${name}, ${amount}, za danas`,
  added: (name) => `Dodano: ${name}`,
  make: 'Napravi brzi unos',
  made: 'Brzi unos je napravljen',
  card: {
    subtitle: 'Svaki je gumb na vrhu Unosa koji jednim dodirom dodaje isti unos za danas.',
    empty: 'Još nema brzih unosa',
    emptyDescription: 'Napravite ga za ono što plaćate iznova, poput jutarnje kave u gotovini. Kuna ga nudi i kad isti unos dodate treći put u mjesecu.',
    add: 'Dodaj brzi unos',
    edit: (name) => `Promijeni ${name}`,
    up: (name) => `Pomakni ${name} gore`,
    down: (name) => `Pomakni ${name} dolje`,
    moved: 'Brzi unos je pomaknut',
    hidden: 'Račun mu je zatvoren ili ga puni banka, pa nema gumb.',
  },
  dialog: {
    addTitle: 'Dodaj brzi unos',
    changeTitle: 'Promijeni brzi unos',
    description: 'Jedan dodir na Unosima dodaje ovaj unos za danas, na njegov račun i njegovom primatelju. Dijelovi dijele unos, poput kave i napojnice.',
    name: 'Gumb',
    nameHelp: 'Ostavite prazno da se vidi primatelj.',
    total: 'Jedan dodir upisuje',
    refusals: {
      zero: entryCroatian.split.refusals['zero-part'],
      'mixed-ways': 'Svi dijelovi idu na istu stranu, kao isplata ili kao uplata.',
      'unknown-category': entryCroatian.split.refusals['unknown-category'],
      'between-accounts': entryCroatian.split.refusals['between-accounts'],
      'unknown-label': 'Jedne oznake ovog dijela više nema u datoteci. Maknite je.',
    },
    saved: 'Brzi unos je spremljen',
    deleted: 'Brzi unos je obrisan',
  },
}

export const words = language === 'hr' ? hr : en
