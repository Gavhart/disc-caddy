import { supabase } from './supabase'
import type { DgApiCourse } from './discgolfapi'
import {
  ActiveMandoRoute,
  ActiveTreeLayout,
  Course,
  CourseHole,
  CourseSummary,
  Elevation,
  HoleDirection,
  TeeBearing,
  Terrain,
  TreeCoverage,
  TreeLayout,
  MandoRoute,
} from '../types'
import { normalizeHoleLayoutFields } from './holeLayoutOptions'

interface CourseRow {
  id: string
  name: string
  locality: string | null
  region_code: string | null
  country_code: string | null
  lat: number | null
  lon: number | null
  total_holes: number | null
  source: 'user' | 'discgolfapi'
  source_id: string | null
  created_by: string | null
  created_at: string
}

interface CourseHoleRow {
  id: string
  course_id: string
  number: number
  distance: number
  par: number | null
  direction: HoleDirection
  elevation: Elevation
  terrain: Terrain | null
  tree_coverage: TreeCoverage | null
  tree_layout: TreeLayout | null
  tree_layouts: ActiveTreeLayout[] | null
  mando: MandoRoute | null
  mandos: ActiveMandoRoute[] | null
  tee_bearing: TeeBearing | null
  tee_lat: number | null
  tee_lng: number | null
  basket_lat: number | null
  basket_lng: number | null
  notes: string | null
  created_by: string | null
}

function rowToCourse(r: CourseRow): Course {
  return {
    id: r.id,
    name: r.name,
    locality: r.locality,
    regionCode: r.region_code,
    countryCode: r.country_code,
    lat: r.lat !== null ? Number(r.lat) : null,
    lon: r.lon !== null ? Number(r.lon) : null,
    totalHoles: r.total_holes,
    source: r.source,
    sourceId: r.source_id,
    createdBy: r.created_by,
    createdAt: r.created_at,
  }
}

function rowToHole(r: CourseHoleRow): CourseHole {
  const { treeLayouts, mandos } = normalizeHoleLayoutFields({
    treeCoverage: r.tree_coverage ?? 'open',
    treeLayouts: r.tree_layouts ?? undefined,
    treeLayout: r.tree_layout ?? undefined,
    mandos: r.mandos ?? undefined,
    mando: r.mando ?? undefined,
  })
  return {
    id: r.id,
    courseId: r.course_id,
    number: r.number,
    distance: r.distance,
    par: r.par,
    direction: r.direction,
    elevation: r.elevation,
    terrain: r.terrain ?? 'flat',
    treeCoverage: r.tree_coverage ?? 'open',
    treeLayouts,
    mandos,
    teeBearing: r.tee_bearing ?? 'north',
    teeLat: r.tee_lat !== null && r.tee_lat !== undefined ? Number(r.tee_lat) : null,
    teeLng: r.tee_lng !== null && r.tee_lng !== undefined ? Number(r.tee_lng) : null,
    basketLat:
      r.basket_lat !== null && r.basket_lat !== undefined ? Number(r.basket_lat) : null,
    basketLng:
      r.basket_lng !== null && r.basket_lng !== undefined ? Number(r.basket_lng) : null,
    notes: r.notes,
    createdBy: r.created_by,
  }
}

/** True when PostgREST/Postgres rejects an unknown column in the payload. */
function isMissingColumnError(error: { code?: string; message?: string }): boolean {
  if (error.code === 'PGRST204') return true
  const msg = error.message?.toLowerCase() ?? ''
  return msg.includes('column') && msg.includes('does not exist')
}

async function insertCourseHoleRow(
  payloads: Record<string, unknown>[],
): Promise<CourseHoleRow> {
  let lastError: { code?: string; message?: string } | null = null
  for (const payload of payloads) {
    const { data, error } = await supabase
      .from('course_holes')
      .insert(payload)
      .select('*')
      .single()
    if (!error) return data as CourseHoleRow
    lastError = error
    if (!isMissingColumnError(error)) break
  }
  throw new Error(
    lastError?.code === '23505'
      ? 'That hole number already exists on this course.'
      : lastError?.message ?? 'Could not add hole',
  )
}

// ---------- Courses ----------

export async function listCourses(): Promise<Course[]> {
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []).map(rowToCourse)
}

export async function searchCoursesByName(q: string): Promise<Course[]> {
  const trimmed = q.trim()
  if (!trimmed) return []
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .ilike('name', `%${trimmed}%`)
    .order('name', { ascending: true })
    .limit(50)
  if (error) throw error
  return (data ?? []).map(rowToCourse)
}

export interface NewCourseInput {
  name: string
  locality?: string | null
  regionCode?: string | null
  countryCode?: string | null
  lat?: number | null
  lon?: number | null
  /** Expected hole count (from DiscGolfAPI metadata, or user-provided). */
  totalHoles?: number | null
  source?: 'user' | 'discgolfapi'
  sourceId?: string | null
}

export async function deleteCourse(id: string): Promise<void> {
  // RLS only lets the creator delete; the FK on course_holes is ON DELETE
  // CASCADE so holes go with the course in a single statement.
  const { error } = await supabase.from('courses').delete().eq('id', id)
  if (error) throw error
}

export async function createCourse(input: NewCourseInput): Promise<Course> {
  const { data: userData } = await supabase.auth.getUser()
  const user = userData.user
  if (!user) throw new Error('Not signed in')

  const { data, error } = await supabase
    .from('courses')
    .insert({
      name: input.name.trim(),
      locality: input.locality ?? null,
      region_code: input.regionCode ?? null,
      country_code: input.countryCode ?? null,
      lat: input.lat ?? null,
      lon: input.lon ?? null,
      total_holes: input.totalHoles ?? null,
      source: input.source ?? 'user',
      source_id: input.sourceId ?? null,
      created_by: user.id,
    })
    .select('*')
    .single()
  if (error) throw error
  return rowToCourse(data)
}

/** All DiscGolfAPI source ids already in the shared catalog. */
export async function listDiscGolfApiSourceIds(): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('courses')
    .select('source_id')
    .eq('source', 'discgolfapi')
    .not('source_id', 'is', null)
  if (error) throw error
  return new Set(
    ((data as { source_id: string | null }[]) ?? [])
      .map(r => r.source_id)
      .filter((id): id is string => Boolean(id)),
  )
}

/** Import multiple DiscGolfAPI courses in one round-trip. */
export async function bulkImportDiscGolfApiCourses(
  dgCourses: DgApiCourse[],
): Promise<number> {
  if (dgCourses.length === 0) return 0

  const { data: userData } = await supabase.auth.getUser()
  const user = userData.user
  if (!user) throw new Error('Not signed in')

  const rows = dgCourses.map(c => ({
    name: c.name.trim(),
    locality: c.locality,
    region_code: c.region_code,
    country_code: c.country_code,
    lat: c.lat,
    lon: c.lon,
    total_holes: c.holes ?? c.primary_layout?.holes ?? null,
    source: 'discgolfapi' as const,
    source_id: c.id,
    created_by: user.id,
  }))

  const { error } = await supabase.from('courses').insert(rows)
  if (error) throw error
  return rows.length
}

// ---------- Course summaries ----------

interface CourseSummaryRow {
  course_id: string
  total_holes: number | null
  holes_filled: number
  distance_total_ft: number
  distance_avg_ft: number | null
}

/**
 * Load aggregate stats for every course in one round-trip. Returned as a Map
 * keyed by course id so callers can look up `summaries.get(course.id)`
 * without scanning the array repeatedly.
 */
export async function listCourseSummaries(): Promise<Map<string, CourseSummary>> {
  const { data, error } = await supabase.from('course_summaries').select('*')
  if (error) throw error
  const out = new Map<string, CourseSummary>()
  for (const r of (data as CourseSummaryRow[]) ?? []) {
    out.set(r.course_id, {
      courseId: r.course_id,
      totalHoles: r.total_holes,
      holesFilled: r.holes_filled,
      distanceTotalFt: r.distance_total_ft,
      distanceAvgFt: r.distance_avg_ft,
    })
  }
  return out
}

// ---------- Course holes ----------

export async function listHolesForCourse(courseId: string): Promise<CourseHole[]> {
  const { data, error } = await supabase
    .from('course_holes')
    .select('*')
    .eq('course_id', courseId)
    .order('number', { ascending: true })
  if (error) throw error
  return (data ?? []).map(rowToHole)
}

export interface NewCourseHoleInput {
  courseId: string
  number: number
  distance: number
  par?: number | null
  direction?: HoleDirection
  elevation?: Elevation
  terrain?: Terrain
  treeCoverage?: TreeCoverage
  treeLayouts?: ActiveTreeLayout[]
  mandos?: ActiveMandoRoute[]
  teeBearing?: TeeBearing
  notes?: string | null
}

export async function createCourseHole(input: NewCourseHoleInput): Promise<CourseHole> {
  const { data: userData } = await supabase.auth.getUser()
  const user = userData.user
  if (!user) throw new Error('Not signed in')

  const treeLayouts = input.treeLayouts ?? []
  const mandos = input.mandos ?? []

  const base = {
    course_id: input.courseId,
    number: input.number,
    distance: input.distance,
    par: input.par ?? null,
    direction: input.direction ?? 'straight',
    elevation: input.elevation ?? 'flat',
    notes: input.notes ?? null,
    created_by: user.id,
  }

  const withLayout = {
    ...base,
    terrain: input.terrain ?? 'flat',
    tree_coverage: input.treeCoverage ?? 'open',
    tree_layout: treeLayouts[0] ?? 'none',
    tree_layouts: treeLayouts,
    mando: mandos[0] ?? 'none',
    mandos,
  }

  const full = {
    ...withLayout,
    tee_bearing: input.teeBearing ?? 'north',
  }

  const data = await insertCourseHoleRow([full, withLayout, base])
  return rowToHole(data)
}

export async function updateCourseHole(
  holeId: string,
  patch: Partial<{
    distance: number
    par: number | null
    direction: HoleDirection
    elevation: Elevation
    terrain: Terrain
    treeCoverage: TreeCoverage
    treeLayouts: ActiveTreeLayout[]
    mandos: ActiveMandoRoute[]
    teeBearing: TeeBearing
    teeLat: number | null
    teeLng: number | null
    basketLat: number | null
    basketLng: number | null
    notes: string | null
  }>,
): Promise<void> {
  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (patch.distance !== undefined) update.distance = patch.distance
  if (patch.par !== undefined) update.par = patch.par
  if (patch.direction !== undefined) update.direction = patch.direction
  if (patch.elevation !== undefined) update.elevation = patch.elevation
  if (patch.terrain !== undefined) update.terrain = patch.terrain
  if (patch.treeCoverage !== undefined) update.tree_coverage = patch.treeCoverage
  if (patch.treeLayouts !== undefined) {
    update.tree_layouts = patch.treeLayouts
    update.tree_layout = patch.treeLayouts[0] ?? 'none'
  }
  if (patch.mandos !== undefined) {
    update.mandos = patch.mandos
    update.mando = patch.mandos[0] ?? 'none'
  }
  if (patch.teeBearing !== undefined) update.tee_bearing = patch.teeBearing
  if (patch.teeLat !== undefined) update.tee_lat = patch.teeLat
  if (patch.teeLng !== undefined) update.tee_lng = patch.teeLng
  if (patch.basketLat !== undefined) update.basket_lat = patch.basketLat
  if (patch.basketLng !== undefined) update.basket_lng = patch.basketLng
  if (patch.notes !== undefined) update.notes = patch.notes

  let { error } = await supabase.from('course_holes').update(update).eq('id', holeId)
  if (error && isMissingColumnError(error)) {
    delete update.tee_bearing
    delete update.terrain
    delete update.tree_coverage
    delete update.tree_layout
    delete update.tree_layouts
    delete update.mando
    delete update.mandos
    delete update.tee_lat
    delete update.tee_lng
    delete update.basket_lat
    delete update.basket_lng
    ;({ error } = await supabase.from('course_holes').update(update).eq('id', holeId))
  }
  if (error) throw error
}

export async function deleteCourseHole(holeId: string): Promise<void> {
  const { error } = await supabase.from('course_holes').delete().eq('id', holeId)
  if (error) throw error
}
