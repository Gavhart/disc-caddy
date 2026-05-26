import { getUserLocation, LocationError } from './weather'

export interface GeocodedPlace {
  city: string
  regionCode: string | null
  countryCode: string | null
  latitude?: number | null
  longitude?: number | null
}

/** Normalize city fields before save so keys match across users. */
export function normalizeHomeCityFields(city: {
  city: string
  regionCode?: string | null
  countryCode?: string | null
}): { city: string; regionCode: string | null; countryCode: string | null } {
  const trimmedCity = city.city.trim()
  const region = city.regionCode?.trim().toUpperCase() || null
  const countryRaw = city.countryCode?.trim().toUpperCase() || null
  const country =
    countryRaw && countryRaw.length >= 2 ? countryRaw.slice(0, 2) : countryRaw
  return {
    city: trimmedCity,
    regionCode: region,
    countryCode: country,
  }
}

function regionFromNominatimAddress(address: Record<string, string>): string | null {
  const iso = address['ISO3166-2-lvl4']
  if (iso?.includes('-')) {
    return iso.split('-').pop()?.toUpperCase() ?? null
  }
  const state = address.state?.trim()
  if (!state) return null
  if (state.length <= 3) return state.toUpperCase()
  return state.slice(0, 10)
}

function cityFromNominatimAddress(address: Record<string, string>): string | null {
  return (
    address.city?.trim() ||
    address.town?.trim() ||
    address.village?.trim() ||
    address.municipality?.trim() ||
    address.county?.trim() ||
    null
  )
}

/** Reverse-geocode GPS coordinates to city / region / country. */
export async function reverseGeocode(lat: number, lon: number): Promise<GeocodedPlace> {
  const url = new URL('https://nominatim.openstreetmap.org/reverse')
  url.searchParams.set('lat', String(lat))
  url.searchParams.set('lon', String(lon))
  url.searchParams.set('format', 'json')
  url.searchParams.set('addressdetails', '1')

  const res = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'en',
      'User-Agent': 'DiscCaddy/1.0 (community home cities)',
    },
  })

  if (!res.ok) {
    throw new Error('Could not look up your location. Try again or enter your city manually.')
  }

  const json = (await res.json()) as { address?: Record<string, string> }
  const address = json.address ?? {}
  const city = cityFromNominatimAddress(address)
  if (!city) {
    throw new Error('Could not determine your city from GPS. Enter it manually below.')
  }

  return normalizeHomeCityFields({
    city,
    regionCode: regionFromNominatimAddress(address),
    countryCode: address.country_code?.trim().toUpperCase() ?? null,
  })
}

/** Device GPS → normalized city / region / country with coordinates. */
export async function resolveCurrentLocationPlace(): Promise<
  GeocodedPlace & { latitude: number; longitude: number }
> {
  const { lat, lon } = await getUserLocation()
  const place = await reverseGeocode(lat, lon)
  return { ...place, latitude: lat, longitude: lon }
}

/** Forward-geocode a typed city for radius matching (best effort). */
export async function geocodeCityPlace(
  city: string,
  regionCode?: string | null,
  countryCode?: string | null,
): Promise<(GeocodedPlace & { latitude: number; longitude: number }) | null> {
  const parts = [city.trim()]
  if (regionCode?.trim()) parts.push(regionCode.trim())
  if (countryCode?.trim()) parts.push(countryCode.trim())
  const q = parts.join(', ')
  if (!q) return null

  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('q', q)
  url.searchParams.set('format', 'json')
  url.searchParams.set('addressdetails', '1')
  url.searchParams.set('limit', '1')

  const res = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'en',
      'User-Agent': 'DiscCaddy/1.0 (community home cities)',
    },
  })
  if (!res.ok) return null

  const json = (await res.json()) as Array<{
    lat?: string
    lon?: string
    address?: Record<string, string>
  }>
  const hit = json[0]
  if (!hit?.lat || !hit?.lon) return null

  const address = hit.address ?? {}
  const resolvedCity = cityFromNominatimAddress(address) ?? city.trim()
  const normalized = normalizeHomeCityFields({
    city: resolvedCity,
    regionCode: regionCode ?? regionFromNominatimAddress(address),
    countryCode: countryCode ?? address.country_code?.trim().toUpperCase() ?? null,
  })

  return {
    ...normalized,
    latitude: Number(hit.lat),
    longitude: Number(hit.lon),
  }
}

export { LocationError }
