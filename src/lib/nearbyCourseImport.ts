import { HomeCity } from '../types'
import {
  bulkImportDiscGolfApiCourses,
  listDiscGolfApiSourceIds,
} from './courses'
import { DgApiCourse, loadAllForCountry } from './discgolfapi'
import { haversineMiles } from './geo'

/** Max courses imported per home-city save (keeps saves snappy). */
const MAX_IMPORT_PER_SAVE = 100

/** Session cache — country catalogs are large but stable for the tab lifetime. */
const countryCatalogCache = new Map<string, DgApiCourse[]>()

export interface NearbyCourseImportResult {
  imported: number
  skipped: number
  radiusMiles: number
}

async function loadCountryCatalog(countryCode: string): Promise<DgApiCourse[]> {
  const code = countryCode.trim().toUpperCase()
  if (!code) return []
  const cached = countryCatalogCache.get(code)
  if (cached) return cached
  const rows = await loadAllForCountry(code)
  countryCatalogCache.set(code, rows)
  return rows
}

function minDistanceToHomeCities(
  lat: number,
  lon: number,
  homeCities: HomeCity[],
): number | null {
  let best: number | null = null
  for (const city of homeCities) {
    if (city.latitude == null || city.longitude == null) continue
    const miles = haversineMiles(city.latitude, city.longitude, lat, lon)
    if (best === null || miles < best) best = miles
  }
  return best
}

/**
 * Pull DiscGolfAPI courses within the user's search radius and import any
 * that aren't already in the shared catalog. Runs after home areas are saved.
 */
export async function importNearbyCoursesFromDiscGolfApi(
  homeCities: HomeCity[],
  radiusMiles: number,
): Promise<NearbyCourseImportResult> {
  const withCoords = homeCities.filter(
    c => c.latitude != null && c.longitude != null,
  )
  if (withCoords.length === 0) {
    return { imported: 0, skipped: 0, radiusMiles }
  }

  const radius = Math.max(5, Math.min(radiusMiles, 200))
  const countries = [
    ...new Set(
      withCoords.map(c => c.countryCode?.trim().toUpperCase() || 'US'),
    ),
  ]

  const [existingIds, ...catalogs] = await Promise.all([
    listDiscGolfApiSourceIds(),
    ...countries.map(code => loadCountryCatalog(code)),
  ])

  const candidates: DgApiCourse[] = []
  for (const catalog of catalogs) {
    for (const course of catalog) {
      if (course.lat == null || course.lon == null) continue
      if (existingIds.has(course.id)) continue
      const miles = minDistanceToHomeCities(course.lat, course.lon, withCoords)
      if (miles == null || miles > radius) continue
      candidates.push(course)
    }
  }

  candidates.sort((a, b) => {
    const da =
      minDistanceToHomeCities(a.lat!, a.lon!, withCoords) ?? Infinity
    const db =
      minDistanceToHomeCities(b.lat!, b.lon!, withCoords) ?? Infinity
    return da - db || a.name.localeCompare(b.name)
  })

  const toImport = candidates.slice(0, MAX_IMPORT_PER_SAVE)
  const skipped = candidates.length - toImport.length
  const imported = await bulkImportDiscGolfApiCourses(toImport)

  for (const course of toImport) {
    existingIds.add(course.id)
  }

  return { imported, skipped, radiusMiles: radius }
}
