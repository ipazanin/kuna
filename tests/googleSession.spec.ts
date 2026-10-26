// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'

import {
  forgetGoogleDevice,
  forgetSilentRefusal,
  loadAccountEmail,
  loadGrantedScopes,
  loadNeededScopes,
  loadSilentRefusal,
  saveAccountEmail,
  saveGrantedScopes,
  saveNeededScopes,
  saveSilentRefusal,
} from '../src/shared/google/googleSession'

afterEach(() => {
  localStorage.clear()
})

describe('what this device keeps about Google', () => {
  it('has no account email, grants, needs or refusal until one is noted', () => {
    expect([loadAccountEmail(), loadGrantedScopes(), loadNeededScopes(), loadSilentRefusal()]).toEqual([null, null, null, null])
  })

  it('keeps the scopes each once, in request order, and reads a damaged entry as none', () => {
    saveGrantedScopes(['gmail.compose', 'drive.file', 'drive.file'])
    saveNeededScopes(['drive.readonly'])

    expect(loadGrantedScopes()).toEqual(['drive.file', 'gmail.compose'])
    expect(loadNeededScopes()).toEqual(['drive.readonly'])

    localStorage.setItem('ledgerboard.google-granted', '{"drive.file":true}')
    localStorage.setItem('ledgerboard.google-needed', 'not json')
    expect(loadGrantedScopes()).toBeNull()
    expect(loadNeededScopes()).toBeNull()
  })

  it('notes why Google refused the silent trip until it is forgotten', () => {
    expect(saveSilentRefusal('interaction_required')).toBe(true)
    expect(loadSilentRefusal()).toBe('interaction_required')

    forgetSilentRefusal()

    expect(loadSilentRefusal()).toBeNull()
  })

  it('keeps no token, and forgets the account and its grants on sign-out, but not what the books need', () => {
    saveAccountEmail('owner@example.com')
    saveGrantedScopes(['drive.file'])
    saveNeededScopes(['drive.file'])
    saveSilentRefusal('login_required')

    expect(Object.keys(localStorage).sort()).toEqual(['ledgerboard.google-account', 'ledgerboard.google-granted', 'ledgerboard.google-needed', 'ledgerboard.google-silent-refused'])

    forgetGoogleDevice()

    expect(Object.keys(localStorage)).toEqual(['ledgerboard.google-needed'])
  })
})
