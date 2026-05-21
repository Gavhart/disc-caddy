import { Disc, DiscType } from '../types'
import { supabase } from './supabase'
import discsSnapshot from '../data/discs.json'

export interface NewDiscInput {
  brand: string
  model: string
  type: DiscType
  speed: number
  glide: number
  turn: number
  fade: number
  weight: string
}

export class DuplicateDiscError extends Error {
  constructor(public existing: Disc) {
    super(
      `A ${existing.brand} disc named "${existing.name}" already exists in the catalog.`,
    )
    this.name = 'DuplicateDiscError'
  }
}

/**
 * Disc catalog.
 *
 * Storage model is "both" (see scripts/import-discs.mjs):
 *   - `src/data/discs.json` ships with the bundle for instant first-paint and
 *     offline use.
 *   - The Supabase `discs` table is the long-term source of truth and can be
 *     refreshed without redeploying via the importer + migration.
 *
 * `DISC_DATABASE` and `DISC_BY_NAME` are mutable views over an in-memory
 * cache so that an async refresh from Supabase quietly replaces the snapshot
 * without consumers needing to re-render or re-import anything.
 */

let cache: Disc[] = (discsSnapshot as Disc[]).slice()
let byName: Record<string, Disc> = buildIndex(cache)

function buildIndex(list: Disc[]): Record<string, Disc> {
  const idx: Record<string, Disc> = {}
  for (const d of list) idx[d.name] = d
  return idx
}

/** Live array. Mutates in place when `refreshDiscsFromSupabase()` succeeds. */
export const DISC_DATABASE: Disc[] = cache

/** Live name → disc map. Mutates in place on refresh. */
export const DISC_BY_NAME: Record<string, Disc> = byName

/**
 * Pull the catalog from Supabase and replace the in-memory cache. Safe to
 * call repeatedly; falls back silently to the snapshot on error so the UI
 * never goes blank.
 */
export async function refreshDiscsFromSupabase(): Promise<void> {
  const { data, error } = await supabase
    .from('discs')
    .select('name, brand, type, speed, glide, turn, fade')
    .order('brand', { ascending: true })
    .order('name', { ascending: true })

  if (error) {
    console.warn('[discs] supabase refresh failed, keeping snapshot', error)
    return
  }
  if (!data || data.length === 0) {
    console.warn('[discs] supabase returned 0 discs, keeping snapshot')
    return
  }

  const fresh: Disc[] = data.map(d => ({
    name: d.name,
    brand: d.brand,
    type: d.type as DiscType,
    speed: Number(d.speed),
    glide: Number(d.glide),
    turn: Number(d.turn),
    fade: Number(d.fade),
  }))

  // Mutate the exported arrays/objects in place so existing references in
  // long-lived components keep pointing at live data.
  cache.length = 0
  cache.push(...fresh)

  for (const k of Object.keys(byName)) delete byName[k]
  for (const d of fresh) byName[d.name] = d
}

/**
 * Compute the unique storage `name` for a new (brand, model) pair, matching
 * the rule used by the importer: if no other manufacturer uses this model
 * name, store the bare model; otherwise brand-qualify as "Model (Brand)" so
 * we never collide with the unique `name` constraint.
 *
 * Returns `{ collisionExisting }` when the exact same brand+model already
 * exists, so callers can short-circuit with a friendly error.
 */
function resolveStorageName(brand: string, model: string): {
  storageName: string
  collisionExisting: Disc | null
} {
  const sameBrandSameModel = cache.find(
    d =>
      d.brand.toLowerCase() === brand.toLowerCase() &&
      stripBrandSuffix(d.name).toLowerCase() === model.toLowerCase(),
  )
  if (sameBrandSameModel) {
    return { storageName: '', collisionExisting: sameBrandSameModel }
  }

  const otherBrandsWithModel = cache.filter(
    d =>
      d.brand.toLowerCase() !== brand.toLowerCase() &&
      stripBrandSuffix(d.name).toLowerCase() === model.toLowerCase(),
  )

  if (otherBrandsWithModel.length === 0) {
    return { storageName: model, collisionExisting: null }
  }
  return { storageName: `${model} (${brand})`, collisionExisting: null }
}

function stripBrandSuffix(storageName: string): string {
  // "Drift (Streamline)" -> "Drift"; "Aviar" -> "Aviar".
  return storageName.replace(/\s*\([^)]+\)\s*$/, '')
}

/**
 * Insert a user-supplied disc into the shared catalog and update the local
 * cache. Throws DuplicateDiscError if (brand, model) already exists.
 */
export async function createDisc(input: NewDiscInput): Promise<Disc> {
  const brand = input.brand.trim()
  const model = input.model.trim()
  const weight = input.weight.trim()

  const { storageName, collisionExisting } = resolveStorageName(brand, model)
  if (collisionExisting) throw new DuplicateDiscError(collisionExisting)

  const { data: userData } = await supabase.auth.getUser()
  const user = userData.user
  if (!user) throw new Error('You must be signed in to add a disc.')

  const { data, error } = await supabase
    .from('discs')
    .insert({
      name: storageName,
      brand,
      type: input.type,
      speed: input.speed,
      glide: input.glide,
      turn: input.turn,
      fade: input.fade,
      weight: weight || null,
      created_by: user.id,
    })
    .select('name, brand, type, speed, glide, turn, fade, weight')
    .single()
  if (error) throw error

  const fresh: Disc = {
    name: data.name,
    brand: data.brand,
    type: data.type as DiscType,
    speed: Number(data.speed),
    glide: Number(data.glide),
    turn: Number(data.turn),
    fade: Number(data.fade),
    weight: data.weight ?? undefined,
  }

  // Splice into the cache in sorted order so the picker shows it next to
  // its brand-mates without a full reload.
  const insertAt = cache.findIndex(d => {
    if (d.brand !== fresh.brand) return d.brand.localeCompare(fresh.brand) > 0
    return d.name.localeCompare(fresh.name) > 0
  })
  if (insertAt === -1) cache.push(fresh)
  else cache.splice(insertAt, 0, fresh)
  byName[fresh.name] = fresh

  return fresh
}
