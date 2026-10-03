import { randomUUID } from 'node:crypto'
import { createServer } from 'node:net'

import type { DatabaseAdapterObj } from 'payload'

let mongoServer: Promise<{ getUri: (dbName: string) => string }> | undefined

const freePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as { port: number }
      server.close(() => resolve(port))
    })
  })

const startPglite = async (): Promise<string> => {
  const { PGlite } = await import('@electric-sql/pglite')
  const { PGLiteSocketServer } = await import('@electric-sql/pglite-socket')
  const db = await PGlite.create()
  const port = await freePort()
  await new PGLiteSocketServer({ db, host: '127.0.0.1', maxConnections: 8, port }).start()
  return `postgresql://postgres@127.0.0.1:${port}/postgres`
}

export const testDatabase = async (): Promise<DatabaseAdapterObj> => {
  const name = process.env.TEST_DB ?? 'sqlite'
  switch (name) {
    case 'mongodb': {
      const { mongooseAdapter } = await import('@payloadcms/db-mongodb')
      mongoServer ??= import('mongodb-memory-server').then(({ MongoMemoryServer }) => MongoMemoryServer.create())
      return mongooseAdapter({ url: (await mongoServer).getUri(`test-${randomUUID()}`) })
    }
    case 'postgres': {
      const { postgresAdapter } = await import('@payloadcms/db-postgres')
      return postgresAdapter({ pool: { connectionString: await startPglite() } })
    }
    case 'sqlite': {
      const { sqliteAdapter } = await import('@payloadcms/db-sqlite')
      return sqliteAdapter({ client: { url: process.env.DATABASE_URL || 'file::memory:' } })
    }
    default:
      throw new Error(`Unknown TEST_DB "${name}"; use sqlite, postgres or mongodb`)
  }
}
