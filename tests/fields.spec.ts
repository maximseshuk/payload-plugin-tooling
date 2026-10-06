import type { Field } from 'payload'
import { describe, expect, it } from 'vitest'

import { findFieldPaths, insertField } from '@/fields.ts'

const marked = { custom: { plugin: true } }

const fields: Field[] = [
  { name: 'title', type: 'text' },
  { type: 'row', fields: [{ name: 'slug', type: 'text', ...marked }] },
  { type: 'collapsible', label: 'More', fields: [{ name: 'summary', type: 'textarea' }] },
  { name: 'meta', type: 'group', fields: [{ name: 'description', type: 'text', ...marked }] },
  {
    type: 'tabs',
    tabs: [
      { label: 'Content', fields: [{ name: 'body', type: 'textarea' }] },
      {
        name: 'seo',
        label: 'SEO',
        fields: [
          { name: 'keywords', type: 'text' },
          { type: 'row', fields: [{ name: 'image', type: 'text', ...marked }] },
        ],
      },
    ],
  },
]

const added: Field = { name: 'added', type: 'text', admin: { readOnly: true } }

const names = (list: Field[]): (string | undefined)[] => list.map((field) => ('name' in field ? field.name : undefined))

const tabFields = (list: Field[], tab: number): Field[] => {
  const tabs = list[4]
  if (tabs?.type !== 'tabs') throw new Error('tabs missing')
  return tabs.tabs[tab]?.fields ?? []
}

const inner = (list: Field[], index: number): Field[] => {
  const field = list[index]
  return field && 'fields' in field ? field.fields : []
}

describe('insertField', () => {
  it('puts the field first or last', () => {
    expect(names(insertField(fields, 'first', added))[0]).toBe('added')
    expect(names(insertField(fields, 'last', added)).at(-1)).toBe('added')
  })

  it('appends the field to the sidebar and keeps its admin options', () => {
    const last = insertField(fields, 'sidebar', added).at(-1)
    expect(last).toEqual({ name: 'added', type: 'text', admin: { readOnly: true, position: 'sidebar' } })
  })

  it('places the field next to a top-level field', () => {
    expect(names(insertField(fields, { after: 'title' }, added)).slice(0, 2)).toEqual(['title', 'added'])
    expect(names(insertField(fields, { before: 'title' }, added)).slice(0, 2)).toEqual(['added', 'title'])
  })

  it('looks through rows and collapsibles without a path segment', () => {
    expect(names(inner(insertField(fields, { before: 'slug' }, added), 1))).toEqual(['added', 'slug'])
    expect(names(inner(insertField(fields, { after: 'summary' }, added), 2))).toEqual(['summary', 'added'])
  })

  it('follows a group name in the path', () => {
    expect(names(inner(insertField(fields, { after: 'meta.description' }, added), 3))).toEqual(['description', 'added'])
  })

  it('looks through unnamed tabs and follows named tabs in the path', () => {
    expect(names(tabFields(insertField(fields, { before: 'body' }, added), 0))).toEqual(['added', 'body'])
    expect(names(tabFields(insertField(fields, { after: 'seo.keywords' }, added), 1))).toEqual([
      'keywords',
      'added',
      undefined,
    ])
    expect(names(inner(tabFields(insertField(fields, { after: 'seo.image' }, added), 1), 1))).toEqual([
      'image',
      'added',
    ])
  })

  it('finds a bare name inside a group or named tab', () => {
    expect(names(inner(insertField(fields, { before: 'description' }, added), 3))).toEqual(['added', 'description'])
    expect(names(tabFields(insertField(fields, { before: 'keywords' }, added), 1))).toEqual([
      'added',
      'keywords',
      undefined,
    ])
  })

  it('leaves the input untouched', () => {
    const before = structuredClone(fields)
    insertField(fields, { after: 'seo.image' }, added)
    insertField(fields, 'sidebar', added)
    expect(fields).toEqual(before)
  })

  it('throws when a bare name matches in more than one group or tab', () => {
    const twice: Field[] = [
      { name: 'a', type: 'group', fields: [{ name: 'x', type: 'text' }] },
      { type: 'tabs', tabs: [{ name: 'b', fields: [{ name: 'x', type: 'text' }] }] },
    ]
    expect(() => insertField(twice, { after: 'x' }, added)).toThrow(
      'Field path "x" is ambiguous, use the full path: a.x, b.x',
    )
    expect(names(inner(insertField(twice, { after: 'a.x' }, added), 0))).toEqual(['x', 'added'])
  })

  it('prefers the full path over a nested match', () => {
    const nested: Field[] = [
      { name: 'x', type: 'text' },
      { name: 'a', type: 'group', fields: [{ name: 'x', type: 'text' }] },
    ]
    expect(names(insertField(nested, { after: 'x' }, added))).toEqual(['x', 'added', 'a'])
  })

  it('throws on an unknown path', () => {
    expect(() => insertField(fields, { after: 'meta.missing' }, added)).toThrow('Field path "meta.missing" not found')
    expect(() => insertField(fields, { before: 'missing' }, added)).toThrow('Field path "missing" not found')
  })
})

describe('findFieldPaths', () => {
  it('returns data paths through groups and named tabs', () => {
    const paths = findFieldPaths(fields, (field) => Boolean(field.custom?.plugin))
    expect(paths).toEqual(['slug', 'meta.description', 'seo.image'])
  })

  it('returns nothing when no field matches', () => {
    expect(findFieldPaths(fields, () => false)).toEqual([])
  })
})
