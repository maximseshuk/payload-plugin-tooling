import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { Payload } from 'payload'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  buildReport,
  deriveProjectId,
  hashProjectId,
  isTelemetryDisabled,
  postReport,
  readPackageVersion,
  readPayloadVersion,
  readState,
  reportTelemetry,
  type ReportTelemetryOptions,
  resolveRawSource,
  type TelemetryReport,
  utcDay,
  writeState,
} from '@/telemetry.ts'

const clean: Record<string, string | undefined> = {}
const disableEnv = 'ACME_TELEMETRY_DISABLED'

describe('isTelemetryDisabled', () => {
  it('keeps telemetry on by default', () => {
    expect(isTelemetryDisabled({ disableEnv, env: clean, option: undefined, payloadTelemetry: true })).toBe(false)
    expect(isTelemetryDisabled({ disableEnv, env: clean, option: { endpoint: 'x' } })).toBe(false)
  })

  it('respects the Payload telemetry opt-out', () => {
    expect(isTelemetryDisabled({ disableEnv, env: clean, option: true, payloadTelemetry: false })).toBe(true)
  })

  it('respects the plugin option telemetry: false', () => {
    expect(isTelemetryDisabled({ disableEnv, env: clean, option: false })).toBe(true)
  })

  it.each([
    [disableEnv, '1'],
    ['DO_NOT_TRACK', '1'],
    ['CI', 'true'],
  ])('turns telemetry off when %s is truthy', (key, value) => {
    expect(isTelemetryDisabled({ disableEnv, env: { [key]: value }, option: undefined })).toBe(true)
  })

  it('turns telemetry off when NODE_ENV is test', () => {
    expect(isTelemetryDisabled({ disableEnv, env: { NODE_ENV: 'test' }, option: undefined })).toBe(true)
  })

  it('treats empty, "0" and "false" env values as no opt-out', () => {
    expect(isTelemetryDisabled({ disableEnv, env: { CI: '' }, option: undefined })).toBe(false)
    expect(isTelemetryDisabled({ disableEnv, env: { DO_NOT_TRACK: '0' }, option: undefined })).toBe(false)
    expect(isTelemetryDisabled({ disableEnv, env: { [disableEnv]: 'false' }, option: undefined })).toBe(false)
  })
})

describe('hashProjectId', () => {
  it('returns the hex SHA-256 of the secret and rawSource', () => {
    expect(hashProjectId('secret', 'source')).toBe(createHash('sha256').update('secretsource').digest('hex'))
  })
})

describe('resolveRawSource', () => {
  it('prefers git over other sources', () => {
    expect(resolveRawSource({ cwd: '/app', git: 'git@x', packageJSON: 'app', serverURL: 'https://x' })).toEqual({
      source: 'git',
      value: 'git@x',
    })
  })

  it('falls back to packageJSON, then serverURL, then cwd', () => {
    expect(resolveRawSource({ cwd: '/app', packageJSON: 'app', serverURL: 'https://x' })).toEqual({
      source: 'packageJSON',
      value: 'app',
    })
    expect(resolveRawSource({ cwd: '/app', serverURL: 'https://x' })).toEqual({
      source: 'serverURL',
      value: 'https://x',
    })
    expect(resolveRawSource({ cwd: '/app' })).toEqual({ source: 'cwd', value: '/app' })
  })
})

describe('deriveProjectId', () => {
  it('reports the winning source and hashes its value with the secret', () => {
    const result = deriveProjectId({ git: 'git@example.com:me/app.git', packageJSON: 'app', secret: 'sekret' })

    expect(result.projectIdSource).toBe('git')
    expect(result.projectId).toBe(hashProjectId('sekret', 'git@example.com:me/app.git'))
  })
})

describe('utcDay', () => {
  it('formats a date as its UTC YYYY-MM-DD', () => {
    expect(utcDay(new Date('2026-07-30T23:59:59Z'))).toBe('2026-07-30')
  })
})

describe('telemetry state', () => {
  it('round-trips a state file keyed by product and projectId', () => {
    const projectId = `test-${Math.random().toString(36).slice(2)}`
    writeState('acme', projectId, { lastSentDay: '2026-07-30', noticeShown: true })
    expect(readState('acme', projectId)).toEqual({ lastSentDay: '2026-07-30', noticeShown: true })
    expect(JSON.parse(readFileSync(join(tmpdir(), `acme-telemetry-${projectId}.json`), 'utf8'))).toEqual({
      lastSentDay: '2026-07-30',
      noticeShown: true,
    })
  })

  it('returns an empty state when nothing is persisted', () => {
    expect(readState('acme', `missing-${Math.random().toString(36).slice(2)}`)).toEqual({})
  })
})

describe('buildReport', () => {
  it('matches the report format with the Node major version and a short lowercase OS', () => {
    const report = buildReport({
      features: { storage: true },
      payloadVersion: '4.0.0',
      product: 'acme',
      productVersion: '1.2.3',
      projectId: 'abc123',
      projectIdSource: 'git',
    })

    expect(report).toEqual({
      features: { storage: true },
      os: process.platform.toLowerCase(),
      payloadVersion: '4.0.0',
      product: 'acme',
      productVersion: '1.2.3',
      projectId: 'abc123',
      projectIdSource: 'git',
      runtime: 'node',
      runtimeVersion: process.versions.node.split('.')[0],
      schema: 1,
    })
    expect(report.os.length).toBeLessThanOrEqual(16)
  })
})

describe('readPackageVersion', () => {
  it('finds the version of the named package above this module', () => {
    const { version } = JSON.parse(readFileSync(join(import.meta.dirname, '../package.json'), 'utf8')) as {
      version: string
    }
    expect(readPackageVersion('@seshuk/payload-plugin-tooling')).toBe(version)
  })

  it('returns 0.0.0 when no package has the name', () => {
    expect(readPackageVersion('@seshuk/missing')).toBe('0.0.0')
  })
})

describe('readPayloadVersion', () => {
  it('returns the installed Payload version', () => {
    expect(readPayloadVersion()).toMatch(/^4\./)
  })
})

describe('postReport', () => {
  const report = { product: 'acme', schema: 1 } as unknown as TelemetryReport

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends a POST with the report JSON to the endpoint with an abort signal', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response())
    vi.stubGlobal('fetch', fetch)

    await postReport(report, 'https://telemetry.example/v1/collect')

    expect(fetch).toHaveBeenCalledTimes(1)
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('https://telemetry.example/v1/collect')
    expect(init).toMatchObject({
      body: JSON.stringify(report),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    })
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('never throws on a network error or timeout', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))

    await expect(postReport(report, 'https://telemetry.example/v1/collect')).resolves.toBeUndefined()
  })
})

describe('reportTelemetry', () => {
  const info = vi.fn()

  const makePayload = (telemetry?: boolean): Payload =>
    ({
      config: { serverURL: 'https://app.example', telemetry },
      logger: { info },
      secret: 'sekret',
    }) as unknown as Payload

  const options = (overrides: Partial<ReportTelemetryOptions> = {}): ReportTelemetryOptions => ({
    disableEnv,
    docsUrl: 'https://acme.example/telemetry',
    features: { storage: true },
    option: undefined,
    packageName: '@seshuk/payload-plugin-tooling',
    payload: makePayload(),
    product: 'acme',
    ...overrides,
  })

  const run = (overrides: Partial<ReportTelemetryOptions>, deps: Parameters<typeof reportTelemetry>[1]) =>
    reportTelemetry(options(overrides), { env: {}, readState: () => ({}), ...deps })

  beforeEach(() => {
    info.mockReset()
  })

  it('sends once, prints the notice and saves the throttle on a fresh run', async () => {
    const send = vi.fn().mockResolvedValue(undefined)
    const saveState = vi.fn()

    await run({}, { send, writeState: saveState })

    expect(send).toHaveBeenCalledTimes(1)
    const [report, endpoint] = send.mock.calls[0]
    expect(report).toMatchObject({ features: { storage: true }, product: 'acme', schema: 1 })
    expect(report.productVersion).toBe(readPackageVersion('@seshuk/payload-plugin-tooling'))
    expect(endpoint).toBe('https://telemetry.seshuk.im/v1/collect')
    expect(info).toHaveBeenCalledTimes(1)
    expect(info.mock.calls[0][0]).toBe(
      `[acme] Anonymous usage telemetry is on: plugin, Payload and Node versions and the features you use. It never sends secrets, IPs, keys or names. Opt out with telemetry: false, DO_NOT_TRACK=1 or ${disableEnv}=1. What is sent: https://acme.example/telemetry`,
    )
    expect(saveState).toHaveBeenCalledWith(expect.any(String), { lastSentDay: expect.any(String), noticeShown: true })
  })

  it('uses a custom endpoint from option.endpoint', async () => {
    const send = vi.fn().mockResolvedValue(undefined)

    await run({ option: { endpoint: 'https://my.collector/v1/collect' } }, { send, writeState: vi.fn() })

    expect(send.mock.calls[0][1]).toBe('https://my.collector/v1/collect')
  })

  it.each<[string, Partial<ReportTelemetryOptions>, Record<string, string>]>([
    ['host Payload opt-out', { payload: makePayload(false) }, {}],
    ['plugin telemetry: false', { option: false }, {}],
    [disableEnv, {}, { [disableEnv]: '1' }],
    ['DO_NOT_TRACK', {}, { DO_NOT_TRACK: '1' }],
    ['CI', {}, { CI: 'true' }],
    ['NODE_ENV=test', {}, { NODE_ENV: 'test' }],
  ])('does not send when disabled by %s', async (_label, overrides, env) => {
    const send = vi.fn().mockResolvedValue(undefined)

    await run(overrides, { env, send, writeState: vi.fn() })

    expect(send).not.toHaveBeenCalled()
    expect(info).not.toHaveBeenCalled()
  })

  it('does not send again on the same UTC day', async () => {
    const send = vi.fn().mockResolvedValue(undefined)

    await run(
      {},
      {
        now: new Date('2026-07-30T10:00:00Z'),
        readState: () => ({ lastSentDay: '2026-07-30', noticeShown: true }),
        send,
        writeState: vi.fn(),
      },
    )

    expect(send).not.toHaveBeenCalled()
  })

  it('prints the notice only once across runs', async () => {
    const send = vi.fn().mockResolvedValue(undefined)

    await run({}, { readState: () => ({ noticeShown: true }), send, writeState: vi.fn() })

    expect(info).not.toHaveBeenCalled()
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('never throws when sending rejects', async () => {
    const send = vi.fn().mockRejectedValue(new Error('boom'))

    await expect(run({}, { send, writeState: vi.fn() })).resolves.toBeUndefined()
  })

  it('never throws when reading throttle state fails', async () => {
    const send = vi.fn().mockResolvedValue(undefined)

    await expect(
      run(
        {},
        {
          readState: () => {
            throw new Error('fs down')
          },
          send,
          writeState: vi.fn(),
        },
      ),
    ).resolves.toBeUndefined()
  })
})
