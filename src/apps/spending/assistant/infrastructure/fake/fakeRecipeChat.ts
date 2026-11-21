import { answered, answersSince, findRecordsArgs, lookup, proposedStep } from '../../../../../shared/ai/infrastructure/fake/fakeChatReply'
import type { FakeChatTurn } from '../../../../../shared/ai/infrastructure/fake/fakeChatReply'
import type { ModelReply } from '../../../../../shared/ai/application/modelPort'
import { language } from '../../../../../shared/text/language'
import { SPENDING_OPERATIONS } from '../../operations/spendingOperations'
import { personTexts, recordsIn } from './fakeSpendingRecords'

const ANSWERS = {
  en: {
    noFile: 'Attach the statement file with the paperclip, and I will write a recipe from its sample.',
    writeTitle: 'Save a recipe for this file',
    fixTitle: 'Change the recipe to read this file',
    proposed: 'I read only the header and ten rows. The card shows the recipe and the rows Kuna read with it from the whole file.',
    refused: 'Kuna could not read the file with the recipe I wrote. Tell me what the file holds, and I will try again.',
  },
  hr: {
    noFile: 'Priložite datoteku izvoda spajalicom i napisat ću recept iz njezina uzorka.',
    writeTitle: 'Spremi recept za ovu datoteku',
    fixTitle: 'Promijeni recept da čita ovu datoteku',
    proposed: 'Pročitao sam samo zaglavlje i deset redaka. Kartica pokazuje recept i retke koje je Kuna njime pročitala iz cijele datoteke.',
    refused: 'Kuna nije mogla pročitati datoteku receptom koji sam napisao. Recite mi što datoteka sadrži i pokušat ću ponovno.',
  },
}

const says = ANSWERS[language]

/** The last csv or sheet attached to the chat, by the id its context line gives, or null for none. */
function attachedTable(request: FakeChatTurn['request']): string | null {
  return (
    personTexts(request)
      .flatMap((text) => [...text.matchAll(/\b(a\d+) \((?:csv|sheet)\b/g)].map((match) => match[1]!))
      .at(-1) ?? null
  )
}

/** The columns a model would take from a sample's header: the day, the amount, the payee and the bank, as their names say. */
function guessed(sample: string): Readonly<Record<string, unknown>> {
  const [header = [], ...rows] = (JSON.parse(sample) as { readonly rows: readonly (readonly string[])[] }).rows
  const column = (pattern: RegExp): string | null => header.find((name) => pattern.test(name)) ?? null
  const amount = column(/iznos|amount/i)
  const at = amount === null ? -1 : header.indexOf(amount)
  return {
    dateColumn: column(/datum|date/i) ?? header[0] ?? '',
    dateFormat: 'dd.MM.yyyy',
    amountColumn: amount,
    decimalMark: rows.some((row) => /,\d{1,2}$/.test(row[at] ?? '')) ? 'comma' : 'point',
    columns: { description: column(/opis|description|payee/i), fee: null, currency: null },
    kinds: [{ kind: 'payment', column: null, equals: null }],
  }
}

/**
 * Writes a recipe from a sample, or fixes the one Import names: reads the attached file's sample, and for a fix finds the
 * recipe, then proposes save-recipe or change-recipe with the columns the header names.
 */
export function recipeReply({ request, typed, tokens }: FakeChatTurn): ModelReply {
  const file = attachedTable(request)
  if (file === null) return answered(request, says.noFile, tokens)
  const fixing = /^fix|^popravi/i.test(typed)
  const answers = answersSince(request)
  if (answers.length === 0) return lookup(0, 'read_attachment', { attachment: file, pages: null, sheet: null, rows: 'sample' }, tokens)
  if (fixing && answers.length === 1) return lookup(1, 'find_records', findRecordsArgs('spending', 'recipe', { limit: 5 }), tokens)
  const proposing = fixing ? 2 : 1
  if (answers.length === proposing) {
    const columns = guessed(answers[0]!.text)
    const recipe = fixing ? recordsIn(answers[1]!.text)[0] : undefined
    const step =
      recipe === undefined
        ? proposedStep(SPENDING_OPERATIONS, 'save-recipe', { ...columns, file, bank: 'Primjer banka', currency: 'EUR', name: 'Promet Primjer banke' })
        : proposedStep(SPENDING_OPERATIONS, 'change-recipe', { ...columns, recipe: recipe.ref, file, bank: 'Primjer banka', currency: 'EUR', name: 'Promet Primjer banke' })
    return lookup(proposing, 'propose_changes', { app: 'spending', title: recipe === undefined ? says.writeTitle : says.fixTitle, steps: [step], next: false }, tokens)
  }
  return answered(request, answers.at(-1)!.isError ? says.refused : says.proposed, tokens)
}
