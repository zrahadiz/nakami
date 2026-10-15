import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

// `server-only` exists to fail Next.js client bundles; under `bun test` there is
// no React Server Component bundler, so stub it before importing the module.
mock.module('server-only', () => ({}))
const {
  buildMockGlbUrl,
  isFalMockEnabled,
  pollMockJob,
  resolveMockSampleFile,
  submitMockJob,
} = await import('./mock')

const ENV_KEYS = [
  'NODE_ENV',
  'FAL_MOCK',
  'FAL_KEY',
  'FAL_MOCK_DELAY_MS',
  'NEXT_PUBLIC_SUPABASE_URL',
] as const
const original = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]))

// NODE_ENV is typed readonly by Next's declarations; go through a mutable view.
const setEnv = (key: string, value: string | undefined) => {
  const env = process.env as Record<string, string | undefined>
  if (value === undefined) delete env[key]
  else env[key] = value
}

beforeEach(() => {
  for (const key of ENV_KEYS) setEnv(key, undefined)
  setEnv('NODE_ENV', 'development')
  setEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co')
})

afterEach(() => {
  for (const key of ENV_KEYS) setEnv(key, original[key])
})

describe('isFalMockEnabled', () => {
  test('never mocks in production', () => {
    setEnv('NODE_ENV', 'production')
    setEnv('FAL_MOCK', '1')
    expect(isFalMockEnabled()).toBe(false)
  })

  test('FAL_MOCK=0 disables even without a key', () => {
    setEnv('FAL_MOCK', '0')
    expect(isFalMockEnabled()).toBe(false)
  })

  test('FAL_MOCK=1 forces it on even with a key', () => {
    setEnv('FAL_MOCK', '1')
    setEnv('FAL_KEY', 'test-key')
    expect(isFalMockEnabled()).toBe(true)
  })

  test('defaults to mocking when unset and no key is present', () => {
    expect(isFalMockEnabled()).toBe(true)
  })

  test('stays off when unset and a key is present', () => {
    setEnv('FAL_KEY', 'test-key')
    expect(isFalMockEnabled()).toBe(false)
  })
})

describe('resolveMockSampleFile', () => {
  test('matches the longest keyword, so categories beat their sub-strings', () => {
    expect(resolveMockSampleFile('Oak Coffee Table')).toBe('tableCoffee.glb')
    expect(resolveMockSampleFile('floor lamp')).toBe('lampRoundFloor.glb')
    expect(resolveMockSampleFile('pendant light')).toBe('lampSquareCeiling.glb')
    expect(resolveMockSampleFile('Tan Leather Armchair')).toBe('chairModernCushion.glb')
    expect(resolveMockSampleFile('solid walnut sideboard')).toBe('cabinetTelevision.glb')
    expect(resolveMockSampleFile('fiddle leaf plant')).toBe('pottedPlant.glb')
  })

  test('normalizes URL-encoded image sources (+ / %20 stand in for spaces)', () => {
    // A "table lamp" must not resolve to the table sample just because the
    // placeholder URL spells its name with '+' separators.
    expect(
      resolveMockSampleFile('https://placehold.co/600x400?text=Ceramic+Table+Lamp')
    ).toBe('lampRoundTable.glb')
    expect(
      resolveMockSampleFile('https://placehold.co/600x400?text=Brass%20Arc%20Floor%20Lamp')
    ).toBe('lampRoundFloor.glb')
    expect(
      resolveMockSampleFile('https://placehold.co/600x400?text=Solid+Oak+Dining+Table')
    ).toBe('table.glb')
  })

  test('is deterministic for unrecognized sources', () => {
    const first = resolveMockSampleFile('mystery object 42')
    expect(resolveMockSampleFile('mystery object 42')).toBe(first)
  })
})

describe('buildMockGlbUrl', () => {
  test('returns the public Storage URL of the seeded sample', () => {
    expect(buildMockGlbUrl('lampRoundFloor.glb')).toBe(
      'https://test.supabase.co/storage/v1/object/public/glb-cache/samples/lampRoundFloor.glb'
    )
  })

  test('throws a descriptive error when the Supabase URL is missing', () => {
    setEnv('NEXT_PUBLIC_SUPABASE_URL', undefined)
    expect(() => buildMockGlbUrl('lampRoundFloor.glb')).toThrow('NEXT_PUBLIC_SUPABASE_URL')
  })
})

describe('mock job lifecycle', () => {
  test('queued -> running -> ready with a downloadable artifact', async () => {
    process.env.FAL_MOCK_DELAY_MS = '1000'

    const handle = submitMockJob('image-to-3d', 'fal-ai/trellis', 'Tan Leather Armchair')
    expect(handle.requestId).toMatch(/^mock-[0-9a-f]{16}-\d{2}$/)

    expect(pollMockJob(handle).status).toBe('queued')

    await Bun.sleep(500) // past the 40% queued portion
    expect(pollMockJob(handle).status).toBe('running')

    await Bun.sleep(650) // past the 1000 ms total
    const ready = pollMockJob(handle)
    expect(ready.status).toBe('ready')
    expect(ready.result?.glbUrl).toBe(
      'https://test.supabase.co/storage/v1/object/public/glb-cache/samples/chairModernCushion.glb'
    )
    expect(typeof ready.result?.seed).toBe('number')
  })

  test('FAL_MOCK_DELAY_MS=0 resolves immediately', () => {
    process.env.FAL_MOCK_DELAY_MS = '0'
    const handle = submitMockJob('text-to-3d', 'fal-ai/hyper3d/rodin', 'a walnut sideboard')
    const snapshot = pollMockJob(handle)
    expect(snapshot.status).toBe('ready')
    expect(snapshot.result?.glbUrl).toContain('/glb-cache/samples/cabinetTelevision.glb')
  })

  test('an unknown request id (stale sweep in a new process) resolves immediately', () => {
    const snapshot = pollMockJob({
      kind: 'image-to-3d',
      modelId: 'fal-ai/trellis',
      requestId: 'mock-0123456789abcdef-03',
    })
    expect(snapshot.status).toBe('ready')
    expect(snapshot.result?.glbUrl).toContain('/glb-cache/samples/lampRoundTable.glb')
  })
})
