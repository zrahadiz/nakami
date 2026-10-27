# Sample models (mocked 3D generation)

Placeholder furniture used by the fal.ai mock driver (`lib/fal/mock.ts`) when
`FAL_MOCK` is enabled (see `.env.example`). These are stand-ins for real
generated GLBs and are never used for real generations.

- Source: Kenney "Furniture Kit" — https://kenney.nl/assets/furniture-kit
- License: CC0 1.0 Universal (public domain); see `License.txt`
- Files kept as-is from the kit's `Models/GLTF format/` folder, picked to cover
  the scene roles (seating, tables, lighting, rug, storage, decor).

Download the Kenney kit and drop the GLBs here, then bun `run seed:samples`

## Seeding

The mock resolves to Storage URLs, not local files, so seed these once:

```bash
bun run seed:samples
```

- Uploads every `.glb` in this folder to `glb-cache/samples/<name>.glb`
  (idempotent upsert) and verifies the public URL.
- Needs `SUPABASE_SERVICE_ROLE_KEY` (and `NEXT_PUBLIC_SUPABASE_URL`) in
  `.env.local`.
- Mocked generations then reference
  `.../storage/v1/object/public/glb-cache/samples/<name>.glb`, and the job
  worker downloads/caches them exactly like a real fal result.
