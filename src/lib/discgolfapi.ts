/**
 * Thin client for https://io.discgolfapi.com/v1
 *
 * Public, no auth required. Per the API's license, *visible attribution is
 * required when displaying their data* — see `DGAPI_ATTRIBUTION` and the
 * `via DiscGolfAPI` chip rendered in the course search UI.
 */

const BASE_URL = 'https://io.discgolfapi.com/v1'

export const DGAPI_ATTRIBUTION = 'Course data via DiscGolfAPI'
export const DGAPI_LICENSE_URL = 'https://discgolfapi.com/licence/'

export interface DgApiCourse {
  id: string
  slug: string
  name: string
  lat: number | null
  lon: number | null
  country_code: string | null
  region_code: string | null
  locality: string | null
  website: string | null
  holes: number | null
  primary_layout: {
    holes: number | null
    par_total: number | null
    length_meters: number | null
  } | null
}

interface DgApiListResponse {
  courses: DgApiCourse[]
  count: number
  total?: number
}

interface ListParams {
  country?: string
  region?: string
  limit?: number
  offset?: number
}

export async function listCourses(params: ListParams = {}): Promise<DgApiCourse[]> {
  const qs = new URLSearchParams()
  if (params.country) qs.set('country', params.country)
  if (params.region) qs.set('region', params.region)
  if (params.limit !== undefined) qs.set('limit', String(params.limit))
  if (params.offset !== undefined) qs.set('offset', String(params.offset))

  const url = `${BASE_URL}/courses${qs.toString() ? `?${qs}` : ''}`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`DiscGolfAPI returned ${res.status} for ${url}`)
  }
  const json = (await res.json()) as DgApiListResponse
  return json.courses ?? []
}

/**
 * Load every course in a country in a single request. The API has no cap on
 * `limit` for the public list endpoint (we've verified it serves 4k+ rows
 * happily), so the simplest UX is to pull the entire country slice once and
 * filter in memory as the user types. Callers should cache the result.
 */
export async function loadAllForCountry(country: string): Promise<DgApiCourse[]> {
  // Generous limit covers the largest country in the catalog; the API just
  // returns whatever exists rather than rejecting an oversized request.
  return listCourses({ country, limit: 100_000 })
}

/**
 * Kept for callers that want a one-shot search. Internally just loads the
 * country and filters. Prefer `loadAllForCountry` + in-memory filtering when
 * the user is interactively typing.
 */
export async function searchByName(
  q: string,
  opts: { country?: string; limit?: number } = {},
): Promise<DgApiCourse[]> {
  const needle = q.trim().toLowerCase()
  if (!needle) return []
  const country = opts.country ?? 'US'
  const cap = opts.limit ?? 50

  const fetched = await loadAllForCountry(country)
  return fetched
    .filter(c => c.name && c.name.toLowerCase().includes(needle))
    .slice(0, cap)
}
