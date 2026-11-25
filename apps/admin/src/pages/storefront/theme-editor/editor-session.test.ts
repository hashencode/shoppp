import { describe, expect, it } from '@rstest/core'
import { EditorSession } from './editor-session'
import type { PageTemplate } from '@shoppp/contracts'

const draft = {
  id: 'draft',
  version: 1,
  presetId: 'default',
  configurationSchemaVersion: 4,
  overrides: [],
  bindings: [],
}
const preset: PageTemplate[] = [
  {
    id: 'home',
    pageType: 'home' as const,
    requiredCapabilities: [],
    sections: [
      {
        id: 'hero',
        type: 'hero',
        visible: true,
        capabilities: [],
        settings: { title: 'Original' },
        blocks: [],
      },
    ],
  },
]

describe('theme editing session', () => {
  it('rejects removing the final required capability without changing the session', () => {
    const required = structuredClone(preset)
    required[0]!.requiredCapabilities = ['home.content']
    required[0]!.sections[0]!.capabilities = ['home.content']
    const session = new EditorSession(draft, required)
    expect(() => session.removeSection('home', 'hero')).toThrow('Keep required content visible.')
    expect(session.document.templates[0]!.sections).toHaveLength(1)
    expect(session.dirty).toBe(false)
  })
  it('undoes scalar and structural edits together and saves one document', () => {
    const session = new EditorSession(draft, preset)
    session.setSetting('home', 'hero', 'title', 'Autumn')
    const copy = session.duplicateSection('home', 'hero')
    session.setSetting('home', copy, 'title', 'Independent')
    expect(session.document.templates[0]!.sections.map(({ settings }) => settings.title)).toEqual([
      'Autumn',
      'Independent',
    ])
    session.undo()
    expect(session.document.templates[0]!.sections[1]!.settings.title).toBe('Autumn')
    session.redo()
    const saved = session.captureSave()
    const reopened = new EditorSession({ ...draft, ...saved.payload, version: 2 }, preset)
    expect(reopened.document).toEqual(session.document)
  })
  it('keeps later input and supports undo after a delayed save acknowledgement', () => {
    const session = new EditorSession(draft, preset)
    session.setSetting('home', 'hero', 'title', 'A')
    const capture = session.captureSave()
    session.setSetting('home', 'hero', 'title', 'B')
    session.acknowledgeSave(capture, 2)
    expect(session.dirty).toBe(true)
    expect(session.document.templates[0]!.sections[0]!.settings.title).toBe('B')
    expect(session.captureSave().payload.expectedVersion).toBe(2)
    session.undo()
    expect(session.document.templates[0]!.sections[0]!.settings.title).toBe('A')
    expect(session.dirty).toBe(false)
  })
  it('preserves edits on failure and isolates copied bindings and instance IDs', () => {
    const session = new EditorSession(
      {
        ...draft,
        bindings: [
          {
            id: 'binding-original',
            kind: 'catalog' as const,
            instanceId: 'hero',
            settingId: 'collection',
            reference: { kind: 'collection' as const, id: 'col_01J00000000000000000000001' },
          },
        ],
      },
      preset
    )
    const id = session.duplicateSection('home', 'hero')
    expect(id).not.toBe('hero')
    expect(session.document.bindings.map(({ instanceId }) => instanceId)).toEqual(['hero', id])
    const capture = session.captureSave()
    expect(session.dirty).toBe(true)
    expect(
      capture.payload.overrides[0]!.operations.some(({ kind }) => kind === 'add-section')
    ).toBe(true)
    session.removeSection('home', id)
    expect(session.document.bindings.map(({ instanceId }) => instanceId)).toEqual(['hero'])
    session.undo()
    expect(session.document.bindings).toHaveLength(2)
  })
})
