import { dayLabel } from '../../../../shared/calendar/dayLabel'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { Money } from '../../../../shared/money/money'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import { language } from '../../../../shared/text/language'
import { plural } from '../../../../shared/text/translation'
import type { Translation } from '../../../../shared/text/translation'
import type { DryRunFact, DryRunNote, DryRunRefusal } from '../domain/importDryRun'
import type { CompanySource } from '../../workbook/domain/workbook'
import type { RowOrigin } from '../../../../shared/app/accountSource'
import type { TranscribedRefusal } from '../domain/importedStatement'

// Croatian addresses the reader as vi, written lowercase inside a sentence.
// A bank statement is izvod, its entries and the ledger's rows stavke, and the ledger evidencija. The statement's own label stays as the file writes it.

/** How a sentence names where a day's rows come from. */
const SOURCE_EN: Readonly<Record<CompanySource, string>> = { mail: "from the bank's statement mail", 'provider-file': "from the bank's camt file you bring", 'by-hand': 'by hand' }

const SOURCE_HR: Readonly<Record<CompanySource, string>> = { mail: 'iz pošte banke s izvodima', 'provider-file': 'iz camt datoteke banke koju donesete', 'by-hand': 'ručno' }

export const en = {
  intake: {
    otherSource: (account: string, day: CivilDate, source: CompanySource, origin: RowOrigin) =>
      origin === 'automation'
        ? `${account} takes its rows of ${dayLabel(day)} ${SOURCE_EN[source]}, so the sync leaves this statement to you. Import its file on Import, or give those days to the bank's statement mail in Settings, Accounts.`
        : `${account} takes its rows of ${dayLabel(day)} ${SOURCE_EN[source]}, so ${origin === 'provider-file' ? 'a camt file you bring' : 'a sheet or a copied statement'} does not go on it. Nothing of it is written. Settings, Accounts says which source takes which days.`,
    beforeStart: (account: string, startsOn: CivilDate, first: CivilDate) =>
      `It starts on ${dayLabel(first)}, before ${dayLabel(startsOn)}, the first day ${account} takes rows on, so nothing of it is written.`,
  },
  dryRun: {
    noEntries: 'The statement has no booked entries, so importing it writes nothing.',
    allHeld: 'Every entry is on the ledger already, so importing it writes nothing.',
    importedBefore: (label: string, noneMatch: boolean) =>
      `Rows of ${label} are on the ledger already, so this file was imported before, and ${noneMatch ? 'none' : 'only some'} of its entries match them now, such as after a change to its profile. Nothing of it is written.`,
    gap: 'Rows the ledger lacks sit between rows it already holds, so the statement does not continue where the ledger leaves the account. Nothing of it is written.',
    partlyHeld: (held: number, fresh: number) => {
      const onLedger = plural({ one: `${held} entry is on the ledger already.`, other: `${held} entries are on the ledger already.` }, held)
      const following = plural({ one: `${fresh} new entry follows`, other: `${fresh} new entries follow` }, fresh)
      return `${onLedger} ${following} ${held === 1 ? 'it' : 'them'}.`
    },
    noReference: (count: number) =>
      `${count === 1 ? 'An entry carries' : `${count} entries carry`} no bank reference, so a second import could not tell ${count === 1 ? 'it' : 'them'} from others. The whole statement is refused.`,
    beforeNewest: (first: CivilDate, newest: CivilDate, account: string) =>
      `Its first new entry is dated ${dayLabel(first)}, before ${dayLabel(newest)}, the newest row of ${account}. Rows are only added after the newest one.`,
    missingBetween: (account: string, balance: Money, day: CivilDate, before: Money) =>
      `The ledger ends ${account} at ${formatMoney(balance)} on ${dayLabel(day)}, but this statement's first new entry starts from ${formatMoney(before)}, so a statement between the two is missing. Import that one first.`,
    worksOutBalances: (opening: Money, account: string, day: CivilDate) =>
      `The file gives no balances, so they are worked out from ${formatMoney(opening)}, where the ledger leaves ${account} on ${dayLabel(day)}.`,
    sequenceGap: (sequence: number, newest: number, account: string, missing: number) =>
      `It is statement ${sequence}, and the newest on the ledger for ${account} is ${newest}, so ${missing === 1 ? 'one statement is' : `${missing} statements are`} not on the ledger. The balances still join, so ${missing === 1 ? 'it' : 'they'} may have held no entries.`,
    sequenceNotAfter: (sequence: number, newest: number, account: string) => `It is statement ${sequence}, which is not after ${newest}, the newest on the ledger for ${account}.`,
    labelHeld: (label: string) => `Rows of ${label} are on the ledger already.`,
    replacedCopied: (count: number) =>
      count === 1 ? "1 row the AI copied gives way to the file's entry, which keeps its category." : `${count} rows the AI copied give way to the file's entries, which keep their categories.`,
    replaceBlocked: (row: string, day: CivilDate) =>
      `The ledger runs on from its newest row, so a copied row can give way only with every row after it, and ${row} of ${dayLabel(day)} after it is not on this statement. Nothing of it is written.`,
  },
  transcribed: {
    doesNotTie: (opening: Money, rows: Money, reached: Money, closing: Money, gap: Money) =>
      `The statement does not add up: the opening balance ${formatMoney(opening)} and its entries ${formatMoney(rows)} reach ${formatMoney(reached)}, but the printed closing balance is ${formatMoney(closing)}, ${formatMoney(gap)} apart.`,
    partDoesNotTie: (account: string, left: Money, rows: Money, reached: Money, closing: Money, gap: Money) =>
      `The statement does not add up: its earlier parts leave ${account} at ${formatMoney(left)}, and this part's new entries ${formatMoney(rows)} reach ${formatMoney(reached)}, but the printed closing balance is ${formatMoney(closing)}, ${formatMoney(gap)} apart.`,
    oneBalance:
      'Give both the opening and the closing balance the statement prints, or neither when it prints none. A statement in parts gives the opening alone on part 1 and both on its last part. Never work one out.',
    partsBeforeMissing: (label: string) => `No row of ${label} is on the ledger yet. Import its parts in order from part 1, each once the one before is accepted.`,
    dayReached: (label: string, part: number) => `The parts of ${label} on the ledger reach the first day of part ${part}. A part starts on the day after the one before it ends.`,
  },
}

export const hr: Translation<typeof en> = {
  intake: {
    otherSource: (account, day, source, origin) =>
      origin === 'automation'
        ? `Račun „${account}” stavke za ${dayLabel(day)} dobiva ${SOURCE_HR[source]}, pa sinkronizacija ovaj izvod ostavlja vama. Uvezite njegovu datoteku u Uvozu ili u Postavkama, Računi, dajte te dane pošti banke s izvodima.`
        : `Račun „${account}” stavke za ${dayLabel(day)} dobiva ${SOURCE_HR[source]}, pa ${origin === 'provider-file' ? 'camt datoteka koju donesete ne ide' : 'tablica ili prepisani izvod ne idu'} na njega. Ništa se ne upisuje. Postavke, Računi kažu koji izvor puni koje dane.`,
    beforeStart: (account, startsOn, first) => `Počinje ${dayLabel(first)}, prije ${dayLabel(startsOn)}, prvog dana od kojega račun „${account}” prima stavke, pa se ništa ne upisuje.`,
  },
  dryRun: {
    noEntries: 'Izvod nema proknjiženih stavki, pa njegov uvoz ništa ne upisuje.',
    allHeld: 'Sve su stavke već u evidenciji, pa uvoz ništa ne upisuje.',
    importedBefore: (label, noneMatch) =>
      `Stavke izvoda ${label} već su u evidenciji, pa je ova datoteka već uvezena, a ${noneMatch ? 'nijedna njezina stavka sada im ne odgovara' : 'samo im neke njezine stavke sada odgovaraju'}, na primjer nakon promjene profila. Ništa se iz nje ne upisuje.`,
    gap: 'Stavke kojih nema u evidenciji nalaze se između stavki koje već postoje, pa se izvod ne nastavlja na zadnju stavku računa u evidenciji. Ništa se iz njega ne upisuje.',
    partlyHeld: (held, fresh) => `Stavke izvoda već u evidenciji: ${held}. Nove stavke koje dolaze nakon njih: ${fresh}.`,
    noReference: (count) =>
      plural(
        {
          one: `${count === 1 ? 'Jedna stavka' : `${count} stavka`} nema bankovnu referencu, pa je drugi uvoz ne bi mogao razlikovati od ostalih. Cijeli izvod je odbijen.`,
          few: `${count} stavke nemaju bankovnu referencu, pa ih drugi uvoz ne bi mogao razlikovati od ostalih. Cijeli izvod je odbijen.`,
          other: `${count} stavki nema bankovnu referencu, pa ih drugi uvoz ne bi mogao razlikovati od ostalih. Cijeli izvod je odbijen.`,
        },
        count,
      ),
    beforeNewest: (first, newest, account) =>
      `Prva nova stavka ima datum ${dayLabel(first)}, prije ${dayLabel(newest)}, datuma najnovije stavke računa „${account}”. Stavke se dodaju samo nakon najnovije.`,
    missingBetween: (account, balance, day, before) =>
      `Račun „${account}” u evidenciji završava saldom ${formatMoney(balance)} na dan ${dayLabel(day)}, a prva nova stavka ovog izvoda polazi od ${formatMoney(before)}, pa između njih nedostaje izvod. Najprije uvezite njega.`,
    worksOutBalances: (opening, account, day) => `Datoteka ne navodi salda, pa se izračunavaju od ${formatMoney(opening)}, salda koje račun „${account}” ima ${dayLabel(day)} u evidenciji.`,
    sequenceGap: (sequence, newest, account, missing) => {
      const gap = plural(
        {
          one: `${missing === 1 ? 'nedostaje jedan izvod' : `nedostaje ${missing} izvod`}. Salda se ipak nastavljaju, pa možda nije imao stavki.`,
          few: `nedostaju ${missing} izvoda. Salda se ipak nastavljaju, pa možda nisu imali stavki.`,
          other: `nedostaje ${missing} izvoda. Salda se ipak nastavljaju, pa možda nisu imali stavki.`,
        },
        missing,
      )
      return `To je izvod ${sequence}, a najnoviji u evidenciji za račun „${account}” je ${newest}, pa u evidenciji ${gap}`
    },
    sequenceNotAfter: (sequence, newest, account) => `To je izvod ${sequence}, koji ne dolazi nakon izvoda ${newest}, najnovijeg u evidenciji za račun „${account}”.`,
    labelHeld: (label) => `Stavke izvoda ${label} već su u evidenciji.`,
    replacedCopied: (count) =>
      plural(
        {
          one:
            count === 1
              ? 'Stavka iz datoteke zamjenjuje jedan redak koji je AI prepisao i zadržava njegovu kategoriju.'
              : `Stavke iz datoteke zamjenjuju ${count} redak koji je AI prepisao i zadržavaju njihove kategorije.`,
          few: `Stavke iz datoteke zamjenjuju ${count} retka koje je AI prepisao i zadržavaju njihove kategorije.`,
          other: `Stavke iz datoteke zamjenjuju ${count} redaka koje je AI prepisao i zadržavaju njihove kategorije.`,
        },
        count,
      ),
    replaceBlocked: (row, day) =>
      `Evidencija se nastavlja na svoju najnoviju stavku, pa se prepisani redak može zamijeniti samo sa svim stavkama nakon njega, a stavka ${row} od ${dayLabel(day)} nakon njega nije na ovom izvodu. Ništa se iz njega ne upisuje.`,
  },
  transcribed: {
    doesNotTie: (opening, rows, reached, closing, gap) =>
      `Izvod se ne slaže: početno stanje ${formatMoney(opening)} i njegove stavke ${formatMoney(rows)} daju ${formatMoney(reached)}, a ispisano završno stanje je ${formatMoney(closing)}, razlika ${formatMoney(gap)}.`,
    partDoesNotTie: (account, left, rows, reached, closing, gap) =>
      `Izvod se ne slaže: prethodni dijelovi ostavljaju račun ${account} na ${formatMoney(left)}, a nove stavke ovog dijela ${formatMoney(rows)} daju ${formatMoney(reached)}, dok je ispisano završno stanje ${formatMoney(closing)}, razlika ${formatMoney(gap)}.`,
    oneBalance:
      'Navedite i početno i završno stanje koje izvod ispisuje, ili nijedno kad ih ne ispisuje. Izvod u dijelovima navodi samo početno stanje u 1. dijelu, a oba u posljednjem. Stanje nikad ne izračunavajte sami.',
    partsBeforeMissing: (label) => `Nijedna stavka izvoda ${label} još nije u evidenciji. Uvezite njegove dijelove redom od 1. dijela, svaki tek kad je prethodni prihvaćen.`,
    dayReached: (label, part) => `Dijelovi izvoda ${label} u evidenciji sežu do prvog dana ${part}. dijela. Dio počinje dan nakon što prethodni završi.`,
  },
}

export const words = language === 'hr' ? hr : en

/** Why nothing of a statement is written, in the person's words. */
export function refusalText(refusal: DryRunRefusal): string {
  switch (refusal.kind) {
    case 'unreadable':
      return refusal.reason
    case 'replace-blocked':
      return words.dryRun.replaceBlocked(refusal.row, refusal.day)
    case 'imported-before':
      return words.dryRun.importedBefore(refusal.label, refusal.noneMatch)
    case 'gap':
      return words.dryRun.gap
    case 'no-reference':
      return words.dryRun.noReference(refusal.count)
    case 'before-newest':
      return words.dryRun.beforeNewest(refusal.first, refusal.newest, refusal.account)
    case 'missing-between':
      return words.dryRun.missingBetween(refusal.account, refusal.balance, refusal.day, refusal.before)
    case 'part-does-not-tie':
      return words.transcribed.partDoesNotTie(refusal.account, refusal.left, refusal.rows, refusal.reached, refusal.closing, refusal.gap)
    case 'other-source':
      return words.intake.otherSource(refusal.account, refusal.day, refusal.source, refusal.origin)
    case 'before-start':
      return words.intake.beforeStart(refusal.account, refusal.startsOn, refusal.first)
  }
}

/** What may be wrong with a statement, for the person to check, in their words. */
export function noteText(note: DryRunNote): string {
  switch (note.kind) {
    case 'reader':
      return note.text
    case 'no-entries':
      return words.dryRun.noEntries
    case 'all-held':
      return words.dryRun.allHeld
    case 'sequence-gap':
      return words.dryRun.sequenceGap(note.sequence, note.newest, note.account, note.missing)
    case 'sequence-not-after':
      return words.dryRun.sequenceNotAfter(note.sequence, note.newest, note.account)
    case 'label-held':
      return words.dryRun.labelHeld(note.label)
  }
}

/** What the import does that needs no check, in the person's words. */
export function factText(fact: DryRunFact): string {
  switch (fact.kind) {
    case 'partly-held':
      return words.dryRun.partlyHeld(fact.held, fact.fresh)
    case 'replaced-copied':
      return words.dryRun.replacedCopied(fact.count)
    case 'works-out-balances':
      return words.dryRun.worksOutBalances(fact.opening, fact.account, fact.day)
  }
}

/** Why a statement the AI copied is refused before its dry run, in the person's words. */
export function transcribedRefusalText(refusal: TranscribedRefusal): string {
  switch (refusal.kind) {
    case 'one-balance':
      return words.transcribed.oneBalance
    case 'parts-before-missing':
      return words.transcribed.partsBeforeMissing(refusal.label)
    case 'day-reached':
      return words.transcribed.dayReached(refusal.label, refusal.part)
    case 'does-not-tie':
      return words.transcribed.doesNotTie(refusal.opening, refusal.rows, refusal.reached, refusal.closing, refusal.gap)
  }
}
