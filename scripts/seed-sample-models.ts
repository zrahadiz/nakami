import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

// Seeds the mock sample models (public/models/*.glb, Kenney CC0) into
// Supabase Storage under glb-cache/samples/ so mocked generations resolve to
// real Storage URLs. Idempotent (upsert), safe to re-run.
//
// Usage: bun run seed:samples
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the
// environment or .env.local (Bun loads .env.local automatically).

const BUCKET = 'glb-cache'
const PREFIX = 'samples'
const CONTENT_TYPE = 'model/gltf-binary'

async function main(): Promise<number> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY.')
    console.error('Add them to .env.local, then re-run: bun run seed:samples')
    return 1
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const dir = path.join(process.cwd(), 'public', 'models')
  const files = (await readdir(dir)).filter((file) => file.endsWith('.glb')).sort()
  if (files.length === 0) {
    console.error(`No .glb samples found in ${dir}`)
    return 1
  }

  let failures = 0
  for (const file of files) {
    const bytes = await readFile(path.join(dir, file))
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(`${PREFIX}/${file}`, bytes, { upsert: true, contentType: CONTENT_TYPE })
    if (error) {
      failures += 1
      console.error(`✗ ${file}: ${error.message}`)
    } else {
      console.log(`✓ ${PREFIX}/${file}`)
    }
  }

  // Public buckets serve without auth; verify one URL end to end so a broken
  // policy or bucket setting is caught here instead of in a failed job.
  const probeUrl = `${url}/storage/v1/object/public/${BUCKET}/${PREFIX}/${files[0]}`
  const probe = await fetch(probeUrl)
  if (!probe.ok) {
    console.error(`\n✗ Public read check failed (HTTP ${probe.status}) for ${probeUrl}`)
    return 1
  }

  console.log(`\n${files.length - failures}/${files.length} samples seeded. Public URL check OK:`)
  console.log(probeUrl)
  return failures === 0 ? 0 : 1
}

process.exitCode = await main()
