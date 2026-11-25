import type {
  EditorDocument,
  ExperienceResourceBinding,
  PageTemplate,
  ThemeOverride,
} from '@shoppp/contracts'
import { editorDocumentSchema, canonicalStorefrontJson } from '@shoppp/contracts'
import {
  createTemplateOverride,
  resolveTemplateOverride,
  validateRequiredCapabilities,
} from '@shoppp/domain'

type Draft = {
  id: string
  version: number
  presetId: string
  configurationSchemaVersion: number
  bindings: ExperienceResourceBinding[]
  overrides: ThemeOverride[]
}
export type EditorSave = {
  revision: number
  document: EditorDocument
  payload: {
    expectedVersion: number
    bindings: ExperienceResourceBinding[]
    overrides: ThemeOverride[]
  }
}
const same = (a: unknown, b: unknown) => canonicalStorefrontJson(a) === canonicalStorefrontJson(b)
const freshId = () => `instance-${crypto.randomUUID()}`

export class EditorSession {
  readonly preset: PageTemplate[]
  readonly draftId: string
  readonly presetId: string
  readonly schemaVersion: number
  version: number
  revision = 1
  document: EditorDocument
  baseline: EditorDocument
  private past: EditorDocument[] = []
  private future: EditorDocument[] = []
  private group: { key: string; at: number } | null = null

  constructor(draft: Draft, preset: readonly PageTemplate[]) {
    this.preset = structuredClone([...preset])
    this.draftId = draft.id
    this.presetId = draft.presetId
    this.schemaVersion = draft.configurationSchemaVersion
    this.version = draft.version
    this.document = editorDocumentSchema.parse({
      bindings: draft.bindings,
      templates: this.preset.map((template) => {
        const override = draft.overrides.find(({ templateId }) => templateId === template.id)
        return override ? resolveTemplateOverride(template, override) : template
      }),
    })
    this.baseline = structuredClone(this.document)
  }
  get dirty() {
    return !same(this.document, this.baseline)
  }
  discardDirtyMarker(document = this.document) {
    this.baseline = structuredClone(document)
  }
  acknowledgeMetadata(version: number) {
    this.version = version
  }
  get canUndo() {
    return this.past.length > 0
  }
  get canRedo() {
    return this.future.length > 0
  }

  change(update: (document: EditorDocument) => void, key?: string) {
    const next = structuredClone(this.document)
    update(next)
    if (next.templates.some((template) => validateRequiredCapabilities(template).length > 0))
      throw new Error('Keep required content visible.')
    if (same(next, this.document)) return
    const now = Date.now()
    if (!key || this.group?.key !== key || now - this.group.at > 750) {
      this.past.push(this.document)
      if (this.past.length > 100) this.past.shift()
    }
    this.group = key ? { key, at: now } : null
    this.document = next
    this.future = []
    this.revision++
  }
  undo() {
    const previous = this.past.pop()
    if (!previous) return
    this.future.push(this.document)
    this.document = previous
    this.group = null
    this.revision++
  }
  redo() {
    const next = this.future.pop()
    if (!next) return
    this.past.push(this.document)
    this.document = next
    this.group = null
    this.revision++
  }
  setSetting(
    templateId: string,
    instanceId: string,
    settingId: string,
    value: PageTemplate['sections'][number]['settings'][string],
    group = false
  ) {
    this.change(
      (doc) => {
        const section = doc.templates
          .find(({ id }) => id === templateId)
          ?.sections.find(
            (section) =>
              section.id === instanceId || section.blocks.some(({ id }) => id === instanceId)
          )
        const instance =
          section?.id === instanceId ? section : section?.blocks.find(({ id }) => id === instanceId)
        if (!instance) throw new Error('The selected region is unavailable.')
        instance.settings[settingId] = value
      },
      group ? `${templateId}:${instanceId}:${settingId}` : undefined
    )
  }
  duplicateSection(templateId: string, instanceId: string) {
    const id = freshId()
    this.change((doc) => {
      const template = doc.templates.find(({ id }) => id === templateId)
      const source = template?.sections.find((section) => section.id === instanceId)
      if (!template || !source) throw new Error('The selected section is unavailable.')
      const copy = structuredClone(source)
      copy.id = id
      copy.required = false
      const remap = new Map([[source.id, id]])
      for (const block of copy.blocks) {
        const next = freshId()
        remap.set(block.id, next)
        block.id = next
      }
      template.sections.splice(template.sections.indexOf(source) + 1, 0, copy)
      for (const binding of [...doc.bindings]) {
        const target = remap.get(binding.instanceId)
        if (target)
          doc.bindings.push({
            ...structuredClone(binding),
            id: `binding-${crypto.randomUUID()}`,
            instanceId: target,
          })
      }
    })
    return id
  }
  removeSection(templateId: string, instanceId: string) {
    this.change((doc) => {
      const template = doc.templates.find(({ id }) => id === templateId)
      const section = template?.sections.find(({ id }) => id === instanceId)
      if (!template || !section || section.required) throw new Error('This region is required.')
      const ids = new Set([section.id, ...section.blocks.map(({ id }) => id)])
      template.sections = template.sections.filter(({ id }) => id !== instanceId)
      doc.bindings = doc.bindings.filter(({ instanceId }) => !ids.has(instanceId))
    })
  }
  captureSave(): EditorSave {
    this.group = null
    const document = editorDocumentSchema.parse(this.document)
    const overrides = document.templates
      .map((template) =>
        createTemplateOverride(
          this.preset.find(({ id }) => id === template.id)!,
          template,
          { presetId: this.presetId, schemaVersion: this.schemaVersion }
        )
      )
      .filter(({ operations }) => operations.length > 0)
    return {
      revision: this.revision,
      document,
      payload: { expectedVersion: this.version, bindings: document.bindings, overrides },
    }
  }
  acknowledgeSave(captured: EditorSave, version: number) {
    if (captured.payload.expectedVersion !== this.version || version !== this.version + 1)
      throw new Error('Reload the latest saved version before continuing.')
    this.version = version
    this.baseline = structuredClone(captured.document)
    this.group = null
    if (captured.revision === this.revision) {
      this.past = []
      this.future = []
    } else {
      const index = this.past.findIndex((document) => same(document, captured.document))
      this.past = index === -1 ? [structuredClone(captured.document)] : this.past.slice(index)
      this.future = []
    }
  }
}
