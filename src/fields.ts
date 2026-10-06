import type { Field } from 'payload'

export type InsertPosition = 'first' | 'last' | 'sidebar' | { after: string } | { before: string }

type Container = { fields: Field[]; name?: string; set: (fields: Field[]) => Field }

type Put = (siblings: Field[], index: number) => Field[]

const nameOf = (item: object): string | undefined =>
  'name' in item && typeof item.name === 'string' && item.name ? item.name : undefined

const containers = (field: Field): Container[] => {
  if ('tabs' in field && Array.isArray(field.tabs)) {
    return field.tabs.map((tab, index) => ({
      fields: tab.fields,
      name: nameOf(tab),
      set: (fields) => ({ ...field, tabs: field.tabs.with(index, { ...tab, fields }) }) as Field,
    }))
  }
  if ('fields' in field && Array.isArray(field.fields)) {
    return [{ fields: field.fields, name: nameOf(field), set: (fields) => ({ ...field, fields }) as Field }]
  }
  return []
}

const atPath = (fields: Field[], path: string[], put: Put): Field[] | undefined => {
  const [head, ...rest] = path
  if (!rest.length) {
    const index = fields.findIndex((item) => nameOf(item) === head)
    if (index !== -1) return put(fields, index)
  }
  for (const [index, field] of fields.entries()) {
    for (const container of containers(field)) {
      const inner =
        container.name === undefined
          ? atPath(container.fields, path, put)
          : container.name === head && rest.length
            ? atPath(container.fields, rest, put)
            : undefined
      if (inner) return fields.with(index, container.set(inner))
    }
  }
  return undefined
}

export const insertField = (fields: Field[], position: InsertPosition, field: Field): Field[] => {
  if (position === 'first') return [field, ...fields]
  if (position === 'last') return [...fields, field]
  if (position === 'sidebar') {
    return [...fields, { ...field, admin: { ...(field as { admin?: object }).admin, position: 'sidebar' } } as Field]
  }
  const [path, offset] = 'after' in position ? [position.after, 1] : [position.before, 0]
  const paths = findFieldPaths(fields, () => true)
  const matches = paths.includes(path) ? [path] : paths.filter((candidate) => candidate.endsWith(`.${path}`))
  if (matches.length > 1) {
    throw new Error(`Field path "${path}" is ambiguous, use the full path: ${matches.join(', ')}`)
  }
  const placed =
    matches[0] &&
    atPath(fields, matches[0].split('.'), (siblings, index) => [
      ...siblings.slice(0, index + offset),
      field,
      ...siblings.slice(index + offset),
    ])
  if (!placed) throw new Error(`Field path "${path}" not found`)
  return placed
}

export const findFieldPaths = (fields: Field[], predicate: (field: Field) => boolean): string[] => {
  const walk = (list: Field[], prefix: string): string[] =>
    list.flatMap((field) => {
      const name = nameOf(field)
      return [
        ...(name && predicate(field) ? [prefix + name] : []),
        ...containers(field).flatMap((container) =>
          walk(container.fields, container.name ? `${prefix}${container.name}.` : prefix),
        ),
      ]
    })
  return walk(fields, '')
}
