import { describe, expect, it } from '@rstest/core'
import type { NavigationMenu } from '@shoppp/contracts'
import { dropNavigationItem } from './navigation-tree'

const items: NavigationMenu['items'] = [
  { id: 'home', label: 'Home', parentId: null, position: 0, target: { kind: 'route', path: '/' } },
  {
    id: 'shop',
    label: 'Shop',
    parentId: null,
    position: 1,
    target: { kind: 'external', url: 'https://example.com/shop' },
  },
  {
    id: 'new',
    label: 'New',
    parentId: 'shop',
    position: 0,
    target: { kind: 'route', path: '/new' },
  },
  {
    id: 'sale',
    label: 'Sale',
    parentId: 'shop',
    position: 1,
    target: { kind: 'internal', reference: { kind: 'collection', id: 'sale' } },
  },
  {
    id: 'about',
    label: 'About',
    parentId: null,
    position: 2,
    target: { kind: 'route', path: '/about' },
  },
]
const structure = (next: NavigationMenu['items']) =>
  next.map(({ id, parentId, position }) => [id, parentId, position])

describe('Navigation tree drops', () => {
  it('moves a parent before another root while preserving its entire subtree and targets', () => {
    const next = dropNavigationItem(items, 'shop', 'home', 'before')
    expect(structure(next)).toEqual([
      ['shop', null, 0],
      ['new', 'shop', 0],
      ['sale', 'shop', 1],
      ['home', null, 1],
      ['about', null, 2],
    ])
    for (const item of items)
      expect(next.find(({ id }) => id === item.id)?.target).toEqual(item.target)
    expect(items[0]!.id).toBe('home')
  })

  it('reorders children and can move a leaf between parents then promote it to a root', () => {
    const reordered = dropNavigationItem(items, 'sale', 'new', 'before')
    expect(structure(reordered).slice(2, 4)).toEqual([
      ['sale', 'shop', 0],
      ['new', 'shop', 1],
    ])
    const reparented = dropNavigationItem(reordered, 'sale', 'about', 'inside')
    expect(structure(reparented)).toEqual([
      ['home', null, 0],
      ['shop', null, 1],
      ['new', 'shop', 0],
      ['about', null, 2],
      ['sale', 'about', 0],
    ])
    expect(structure(dropNavigationItem(reparented, 'sale', 'shop', 'after'))).toEqual([
      ['home', null, 0],
      ['shop', null, 1],
      ['new', 'shop', 0],
      ['sale', null, 2],
      ['about', null, 3],
    ])
  })

  it.each([
    ['shop', 'new', 'inside'],
    ['shop', 'new', 'after'],
    ['shop', 'about', 'inside'],
    ['about', 'new', 'inside'],
    ['shop', 'shop', 'before'],
    ['missing', 'home', 'after'],
  ] as const)(
    'rejects an invalid drop of %s at %s (%s) without changing the draft',
    (id, target, position) => {
      expect(dropNavigationItem(items, id, target, position)).toBe(items)
    }
  )
})
