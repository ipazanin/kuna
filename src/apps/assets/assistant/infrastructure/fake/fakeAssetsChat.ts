import { answered, answersSince, lookup, registerFakeChat } from '../../../../../shared/ai/infrastructure/fake/fakeChatReply'
import type { FakeChatTurn } from '../../../../../shared/ai/infrastructure/fake/fakeChatReply'
import type { ModelReply } from '../../../../../shared/ai/application/modelPort'
import { today } from '../../../../../shared/calendar/civilDate'
import { language } from '../../../../../shared/text/language'

const ANSWERS = {
  en: {
    notRead: "You didn't allow reading Assets, so I can only tell you how it works.",
    title: 'A new valuation',
    proposed: 'The card below adds the valuation to your newest asset. Nothing changes until you accept it.',
    noAsset: 'There is no asset in Assets to value.',
  },
  hr: {
    notRead: 'Niste dopustili čitanje Imovine, pa vam mogu reći samo kako radi.',
    title: 'Nova procjena',
    proposed: 'Kartica ispod dodaje procjenu vašoj najnovijoj stavci imovine. Ništa se ne mijenja dok je ne prihvatite.',
    noAsset: 'U Imovini nema nijedne stavke imovine koju biste mogli procijeniti.',
  },
}

/** Reads the assets and proposes a valuation of the newest bought, on today's day. */
function valuationReply({ request, tokens }: FakeChatTurn): ModelReply {
  const says = ANSWERS[language === 'hr' ? 'hr' : 'en']
  const answers = answersSince(request)
  if (answers.length === 0) return lookup(0, 'find_records', { app: 'assets', kind: 'asset', query: null, from: null, to: null, about: null, only: null, limit: 5, cursor: null }, tokens)
  if (answers[0]!.isError) return answered(request, says.notRead, tokens)
  if (answers.length === 1) {
    const { records } = JSON.parse(answers[0]!.text) as { readonly records: readonly { readonly ref: string }[] }
    const [asset] = records
    if (asset === undefined) return answered(request, says.noAsset, tokens)
    const step = { op: 'add-valuation', input: JSON.stringify({ asset: asset.ref, date: today(), value: 210000, note: '' }), as: null }
    return lookup(1, 'propose_changes', { app: 'assets', title: says.title, steps: [step], next: false }, tokens)
  }
  return answered(request, answers[1]!.isError ? says.notRead : says.proposed, tokens)
}

/** Assets' part of the fake chat: one that starts with valuation adds a valuation of the newest asset. */
function assetsChat(turn: FakeChatTurn): ModelReply | null {
  return /^valuation|^procjen/i.test(turn.typed) ? valuationReply(turn) : null
}

export function registerFakeAssetsChat(): void {
  registerFakeChat(assetsChat)
}
