import { useCallback, useMemo, useState } from 'react'

type TableSize = 'small' | 'middle' | 'large'

const TABLE_DENSITY_STORAGE_KEY = 'list:table-density:v1'
const TABLE_COLUMNS_STORAGE_PREFIX = 'list:table-columns:v1:'
const TABLE_VIEW_PREFERENCES_STORAGE_PREFIX = 'list:table-view-preferences:v1:'

type TableViewPreferences = {
  density: TableSize
  visibleColumnKeys: string[]
  columnOrder: string[]
}

const isTableSize = (value: unknown): value is TableSize => {
  return value === 'small' || value === 'middle' || value === 'large'
}

const isStringArray = (value: unknown): value is string[] => {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

const readJson = <T>(key: string): T | null => {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

const writeJson = (key: string, value: unknown) => {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // ignore storage write failure and keep runtime state usable
  }
}

const buildTableColumnsStorageKey = (tableId: string) => `${TABLE_COLUMNS_STORAGE_PREFIX}${tableId}`
const buildTableViewPreferencesStorageKey = (tableId: string) =>
  `${TABLE_VIEW_PREFERENCES_STORAGE_PREFIX}${tableId}`

export const applyPersistedOrderToKeys = (sourceKeys: string[], persistedOrder: string[]) => {
  if (persistedOrder.length === 0) {
    return sourceKeys
  }

  const sourceKeySet = new Set(sourceKeys)
  const orderedVisibleKeys = persistedOrder.filter((key) => sourceKeySet.has(key))
  const orderedVisibleKeySet = new Set(orderedVisibleKeys)
  const unseenKeys = sourceKeys.filter((key) => !orderedVisibleKeySet.has(key))

  return [...orderedVisibleKeys, ...unseenKeys]
}

const sanitizeVisibleColumnKeys = (keys: string[], defaultColumnKeys: string[]) => {
  const defaultColumnKeySet = new Set(defaultColumnKeys)
  const visibleColumnKeys = keys.filter((key) => defaultColumnKeySet.has(key))

  return visibleColumnKeys.length > 0 ? visibleColumnKeys : defaultColumnKeys
}

const sanitizeColumnOrder = (order: string[], defaultColumnKeys: string[]) => {
  return applyPersistedOrderToKeys(defaultColumnKeys, order)
}

const readLegacyDensity = (defaultDensity: TableSize) => {
  const storedDensity = readJson<unknown>(TABLE_DENSITY_STORAGE_KEY)
  return isTableSize(storedDensity) ? storedDensity : defaultDensity
}

const readStoredTableViewPreferences = (
  tableId: string,
  defaultColumnKeys: string[],
  defaultDensity: TableSize
): TableViewPreferences => {
  const storedPreferences = readJson<Partial<TableViewPreferences>>(
    buildTableViewPreferencesStorageKey(tableId)
  )
  const legacyVisibleColumns = readJson<unknown>(buildTableColumnsStorageKey(tableId))

  return {
    density: isTableSize(storedPreferences?.density)
      ? storedPreferences.density
      : readLegacyDensity(defaultDensity),
    visibleColumnKeys: sanitizeVisibleColumnKeys(
      isStringArray(storedPreferences?.visibleColumnKeys)
        ? storedPreferences.visibleColumnKeys
        : isStringArray(legacyVisibleColumns)
          ? legacyVisibleColumns
          : defaultColumnKeys,
      defaultColumnKeys
    ),
    columnOrder: sanitizeColumnOrder(
      isStringArray(storedPreferences?.columnOrder)
        ? storedPreferences.columnOrder
        : defaultColumnKeys,
      defaultColumnKeys
    ),
  }
}

type UseListViewPreferencesOptions = {
  tableId: string
  defaultColumnKeys: string[]
  defaultDensity?: TableSize
}

export const useListViewPreferences = ({
  tableId,
  defaultColumnKeys,
  defaultDensity = 'middle',
}: UseListViewPreferencesOptions) => {
  const [preferences, setPreferencesState] = useState<TableViewPreferences>(() =>
    readStoredTableViewPreferences(tableId, defaultColumnKeys, defaultDensity)
  )

  const writePreferences = useCallback(
    (nextPreferences: TableViewPreferences) => {
      writeJson(buildTableViewPreferencesStorageKey(tableId), nextPreferences)
      writeJson(TABLE_DENSITY_STORAGE_KEY, nextPreferences.density)
    },
    [tableId]
  )

  const setPreferences = useCallback(
    (updater: TableViewPreferences | ((current: TableViewPreferences) => TableViewPreferences)) => {
      setPreferencesState((current) => {
        const nextPreferences = typeof updater === 'function' ? updater(current) : updater
        writePreferences(nextPreferences)
        return nextPreferences
      })
    },
    [writePreferences]
  )

  const selectedColumnKeys = useMemo(
    () => sanitizeVisibleColumnKeys(preferences.visibleColumnKeys, defaultColumnKeys),
    [defaultColumnKeys, preferences.visibleColumnKeys]
  )

  const columnOrder = useMemo(
    () => sanitizeColumnOrder(preferences.columnOrder, defaultColumnKeys),
    [defaultColumnKeys, preferences.columnOrder]
  )

  const setTableSize = useCallback(
    (size: TableSize) => {
      setPreferences((current) => ({
        ...current,
        density: size,
      }))
    },
    [setPreferences]
  )

  const setSelectedColumnKeys = useCallback(
    (keys: string[]) => {
      setPreferences((current) => ({
        ...current,
        visibleColumnKeys: sanitizeVisibleColumnKeys(keys, defaultColumnKeys),
      }))
    },
    [defaultColumnKeys, setPreferences]
  )

  const setColumnOrder = useCallback(
    (keys: string[]) => {
      setPreferences((current) => ({
        ...current,
        columnOrder: sanitizeColumnOrder(keys, defaultColumnKeys),
      }))
    },
    [defaultColumnKeys, setPreferences]
  )

  const clearColumnOrder = useCallback(() => {
    setPreferences((current) => ({
      ...current,
      columnOrder: defaultColumnKeys,
    }))
  }, [defaultColumnKeys, setPreferences])

  const hasCustomColumnOrder = useMemo(
    () => columnOrder.join('|') !== defaultColumnKeys.join('|'),
    [columnOrder, defaultColumnKeys]
  )

  return {
    tableSize: preferences.density,
    selectedColumnKeys,
    columnOrder,
    hasCustomColumnOrder,
    setTableSize,
    setSelectedColumnKeys,
    setColumnOrder,
    clearColumnOrder,
  }
}
