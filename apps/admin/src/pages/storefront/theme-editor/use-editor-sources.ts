import { localizeThemeError } from '../theme-feedback'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useCurrentTranslate } from '../../../shared/contexts/i18n-context'
import { buildCatalogPreviewCandidate } from '../../../services/catalog/api'
import {
  fetchStorefrontCatalogReleases,
  fetchStorefrontEditorRelease,
  type StorefrontCatalogRelease,
} from '../../../services/storefront/api'

export const useEditorSources = ({
  draftId,
  savedReleaseId,
  canPreview,
  canPrepare,
}: {
  draftId: string
  savedReleaseId?: string | null
  canPreview: boolean
  canPrepare: boolean
}) => {
  const translate = useCurrentTranslate()
  const [releases, setReleases] = useState<StorefrontCatalogRelease[]>([])
  const [releaseId, setReleaseId] = useState('')
  const [preparing, setPreparing] = useState(false)
  const [sourceError, setSourceError] = useState<unknown>(null)
  const generation = useRef(0)
  const selected = useRef<{
    id: string
    kind: 'initial' | 'restored' | 'explicit'
    revision: number
  }>({ id: '', kind: 'initial', revision: 0 })
  const prepareLock = useRef(false)
  const selectRelease = useCallback((id: string) => {
    selected.current = { id, kind: 'explicit', revision: selected.current.revision + 1 }
    setReleaseId(id)
    setSourceError(null)
  }, [])
  useEffect(() => {
    const request = ++generation.current
    selected.current = { id: '', kind: 'initial', revision: 0 }
    prepareLock.current = false
    const timer = window.setTimeout(() => {
      setReleaseId(selected.current.id)
      setReleases([])
      setSourceError(null)
      setPreparing(false)
      if (!canPreview) return
      void fetchStorefrontCatalogReleases()
        .then((items) => {
          if (request !== generation.current) return
          setReleases((previous) => [
            ...items,
            ...previous.filter((item) => !items.some(({ id }) => id === item.id)),
          ])
          if (selected.current.kind === 'initial') {
            selected.current.id = items[0]?.id ?? ''
            setReleaseId(selected.current.id)
          }
        })
        .catch((cause) => {
          if (request === generation.current) setSourceError(cause)
        })
    }, 0)
    return () => {
      clearTimeout(timer)
      generation.current++
    }
  }, [draftId, canPreview, translate])
  useEffect(() => {
    if (!canPreview || !savedReleaseId) return
    let active = true
    const request = generation.current
    const timer = window.setTimeout(() => {
      if (selected.current.kind === 'explicit') return
      selected.current = {
        id: savedReleaseId,
        kind: 'restored',
        revision: selected.current.revision + 1,
      }
      const revision = selected.current.revision
      setReleaseId(savedReleaseId)
      void fetchStorefrontEditorRelease(savedReleaseId)
        .then((release) => {
          if (!active || request !== generation.current || selected.current.revision !== revision)
            return
          setReleases((items) => [release, ...items.filter((item) => item.id !== release.id)])
          setSourceError(null)
        })
        .catch((cause) => {
          if (active && request === generation.current && selected.current.revision === revision)
            setSourceError(cause)
        })
    }, 0)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [draftId, savedReleaseId, canPreview, translate])
  const prepare = useCallback(async () => {
    if (!canPrepare || prepareLock.current) return
    prepareLock.current = true
    setPreparing(true)
    setSourceError(null)
    const request = generation.current,
      revision = ++selected.current.revision
    try {
      const candidate = await buildCatalogPreviewCandidate('')
      if (candidate.status !== 'succeeded' || candidate.purpose !== 'private-preview')
        throw new Error(translate('Published store sources are not ready for preview.'))
      const release = await fetchStorefrontEditorRelease(candidate.id)
      if (request !== generation.current || revision !== selected.current.revision) return
      selected.current = { id: release.id, kind: 'explicit', revision }
      setReleases((items) => [release, ...items.filter((item) => item.id !== release.id)])
      setReleaseId(release.id)
      return release
    } catch (cause) {
      if (request === generation.current && revision === selected.current.revision)
        setSourceError(cause)
    } finally {
      if (request === generation.current) {
        prepareLock.current = false
        setPreparing(false)
      }
    }
  }, [canPrepare, translate])
  return {
    releases,
    releaseId,
    selectRelease,
    preparing,
    sourceError: sourceError ? localizeThemeError(sourceError, translate) : null,
    prepare,
  }
}
