import { answered, answersSince, findRecordsArgs, lookup, proposedStep, registerFakeChat } from '../../../../../shared/ai/infrastructure/fake/fakeChatReply'
import type { FakeChatTurn } from '../../../../../shared/ai/infrastructure/fake/fakeChatReply'
import type { ModelReply } from '../../../../../shared/ai/application/modelPort'
import { today } from '../../../../../shared/calendar/civilDate'
import { language } from '../../../../../shared/text/language'
import { ASSETS_OPERATIONS } from '../../operations/assetsOperations'

const ANSWERS = {
  en: {
    title: 'A new valuation',
    proposed: 'The card below adds the valuation to your newest asset. Nothing changes until you accept it.',
    noAsset: 'There is no asset in Assets to value.',
  },
  hr: {
    title: 'Nova procjena',
    proposed: 'Kartica ispod dodaje procjenu vašoj najnovijoj stavci imovine. Ništa se ne mijenja dok je ne prihvatite.',
    noAsset: 'U Imovini nema nijedne stavke imovine koju biste mogli procijeniti.',
  },
}

/** Reads the assets and proposes a valuation of the newest bought, on today's day. */
function valuationReply({ request, tokens }: FakeChatTurn): ModelReply {
  const says = ANSWERS[language === 'hr' ? 'hr' : 'en']
  const answers = answersSince(request)
  if (answers.length === 0) return lookup(0, 'find_records', findRecordsArgs('assets', 'asset', { limit: 5 }), tokens)
  if (answers.length === 1) {
    const { records } = JSON.parse(answers[0]!.text) as { readonly records: readonly { readonly ref: string }[] }
    const [asset] = records
    if (asset === undefined) return answered(request, says.noAsset, tokens)
    const step = proposedStep(ASSETS_OPERATIONS, 'add-valuation', { asset: asset.ref, date: today(), value: 210000, note: '' })
    return lookup(1, 'propose_changes', { app: 'assets', title: says.title, steps: [step], next: false }, tokens)
  }
  return answered(request, says.proposed, tokens)
}

/** Assets' part of the fake chat: one that starts with valuation adds a valuation of the newest asset. */
function assetsChat(turn: FakeChatTurn): ModelReply | null {
  return /^valuation|^procjen/i.test(turn.typed) ? valuationReply(turn) : null
}

export function registerFakeAssetsChat(): void {
  registerFakeChat(assetsChat)
}
