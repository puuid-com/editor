import { describe, expect, it } from 'vitest'
import { sessionStore, setActive } from '#/lib/store/session'
import { hidePane, openBeside, visiblePanes } from './panes'

describe('mixed file panes', () => {
  it('opens a different type beside the active file and focuses either without reordering', () => {
    sessionStore.setState((s) => ({ ...s, activeId: 'xml', paneIds: [] }))
    openBeside('zpl')
    expect(sessionStore.state.paneIds).toEqual(['xml', 'zpl'])
    setActive('xml')
    expect(
      visiblePanes(sessionStore.state.paneIds!, ['xml', 'zpl'], 'xml'),
    ).toEqual(['xml', 'zpl'])
  })
  it('replaces the last pane on a tab switch and removes closed or duplicate panes', () => {
    expect(
      visiblePanes(
        ['xml', 'xml', 'closed', 'zpl'],
        ['xml', 'zpl', 'json'],
        'json',
      ),
    ).toEqual(['xml', 'json'])
    expect(visiblePanes([], ['sql'], 'sql')).toEqual(['sql'])
  })
  it('caps panes at four and hiding a pane keeps the file available', () => {
    sessionStore.setState((s) => ({
      ...s,
      activeId: 'd',
      paneIds: ['a', 'b', 'c', 'd'],
    }))
    openBeside('e')
    expect(sessionStore.state.paneIds).toEqual(['a', 'b', 'c', 'd'])
    hidePane('d')
    expect(sessionStore.state.activeId).toBe('a')
    expect(
      visiblePanes(sessionStore.state.paneIds!, ['a', 'b', 'c', 'd'], 'd'),
    ).toEqual(['a', 'b', 'd'])
  })
})
