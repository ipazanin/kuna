/**
 * The visual check's Assets flows, each with the screen it starts on, the widths and the modes it runs in.
 */

import { assetsEditorFlow, assetsEditorFlowIn, assetsValuationFlow, assetsValuationFlowIn, sharesDialogsFlowIn } from './assetsFlows.mjs'
import { setUpChatFolderFlowIn, setUpChatHomeFlowIn } from './setUpChatFlows.mjs'
import { appChatCardFlowIn, appChatLawFlowIn } from './appsChatFlows.mjs'
import { screenMenusFlow } from './menuFlows.mjs'
import { SAMPLE_CAR } from './assetsScreens.mjs'
import { DESIGN_REVIEW_VIEWPORTS, EVERY_VIEWPORT, MENU_VIEWPORTS } from './visualCommon.mjs'

export function assetsVisualFlows() {
  return [
    {
      name: 'assets-chat-valuation',
      hash: '#/assets',
      title: 'Overview',
      run: appChatCardFlowIn('en', 'valuation'),
      modes: ['drive'],
      viewports: DESIGN_REVIEW_VIEWPORTS,
      queries: { drive: '&assets=sample&loans=sample' },
    },
    {
      name: 'assets-chat-valuation-croatian',
      hash: '#/assets',
      title: 'Pregled',
      run: appChatCardFlowIn('hr', 'valuation'),
      modes: ['drive'],
      viewports: DESIGN_REVIEW_VIEWPORTS,
      queries: { drive: '&assets=sample&loans=sample&lang=hr' },
    },
    {
      name: 'assets-chat-law',
      hash: '#/assets',
      title: 'Overview',
      run: appChatLawFlowIn('en'),
      modes: ['drive'],
      viewports: DESIGN_REVIEW_VIEWPORTS,
      queries: { drive: '&assets=sample&loans=sample' },
    },
    {
      name: 'assets-chat-law-croatian',
      hash: '#/assets',
      title: 'Pregled',
      run: appChatLawFlowIn('hr'),
      modes: ['drive'],
      viewports: DESIGN_REVIEW_VIEWPORTS,
      queries: { drive: '&assets=sample&loans=sample&lang=hr' },
    },
    {
      name: 'set-up-chat-home-assets',
      hash: '#/assets',
      title: 'Assets',
      run: setUpChatHomeFlowIn('assets', 'en'),
      modes: ['browser'],
      viewports: DESIGN_REVIEW_VIEWPORTS,
      queries: { browser: '&fake=empty' },
    },
    {
      name: 'set-up-chat-folder-assets',
      hash: '#/assets/start?step=folder',
      title: 'Assets',
      run: setUpChatFolderFlowIn('assets', 'en'),
      modes: ['drive'],
      viewports: DESIGN_REVIEW_VIEWPORTS,
      queries: { drive: '' },
    },
    {
      name: 'set-up-chat-home-assets-croatian',
      hash: '#/assets',
      title: 'Imovina',
      run: setUpChatHomeFlowIn('assets', 'hr'),
      modes: ['browser'],
      viewports: DESIGN_REVIEW_VIEWPORTS,
      queries: { browser: '&fake=empty&lang=hr' },
    },
    {
      name: 'set-up-chat-folder-assets-croatian',
      hash: '#/assets/start?step=folder',
      title: 'Imovina',
      run: setUpChatFolderFlowIn('assets', 'hr'),
      modes: ['drive'],
      viewports: DESIGN_REVIEW_VIEWPORTS,
      queries: { drive: '&lang=hr' },
    },
    { name: 'assets-editor', hash: '#/assets', title: 'Overview', run: assetsEditorFlow, modes: ['drive'], queries: { drive: '&assets=drive&loans=sample' } },
    { name: 'assets-editor-croatian', hash: '#/assets', title: 'Pregled', run: assetsEditorFlowIn('hr'), modes: ['drive'], queries: { drive: '&assets=drive&loans=sample&lang=hr' } },
    { name: 'assets-valuation', hash: `#/assets/asset?asset=${SAMPLE_CAR}`, title: 'Family car', run: assetsValuationFlow, modes: ['drive'], queries: { drive: '&assets=sample&loans=sample' } },
    {
      name: 'assets-valuation-croatian',
      hash: `#/assets/asset?asset=${SAMPLE_CAR}`,
      title: 'Family car',
      run: assetsValuationFlowIn('hr'),
      modes: ['drive'],
      queries: { drive: '&assets=sample&loans=sample&lang=hr' },
    },
    {
      name: 'dialogs-shares',
      hash: '#/assets',
      title: 'Overview',
      run: sharesDialogsFlowIn('en'),
      viewports: EVERY_VIEWPORT,
      modes: ['drive'],
      queries: { drive: '&assets=co-owned&loans=co-owned' },
    },
    {
      name: 'dialogs-shares-croatian',
      hash: '#/assets',
      title: 'Pregled',
      run: sharesDialogsFlowIn('hr'),
      viewports: EVERY_VIEWPORT,
      modes: ['drive'],
      queries: { drive: '&assets=co-owned&loans=co-owned&lang=hr' },
    },
    {
      name: 'menus-assets',
      hash: '#/assets',
      title: 'Overview',
      run: screenMenusFlow([{ hash: '#/assets', title: 'Overview', dialogs: ['[data-testid="add-asset"]'] }]),
      viewports: MENU_VIEWPORTS,
      modes: ['drive'],
      queries: { drive: '&assets=sample&loans=sample' },
    },
  ]
}
