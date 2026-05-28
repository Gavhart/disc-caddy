import { WindDirection } from '../types'

export interface LiveWind {
  windDirection: WindDirection
  windSpeed: number
  /** Human-readable, e.g. "8 mph from the west" */
  label: string
}

export class LocationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LocationError'
  }
}

export interface PreciseLocation {
  lat: number
  lon: number
  /** Horizontal accuracy radius in meters, when provided by the device. */
  accuracyMeters: number | null
}

function readGeolocationError(err: GeolocationPositionError): LocationError {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return new LocationError(
        'Location permission denied. Enable location for this site in your browser or device settings.',
      )
    case err.POSITION_UNAVAILABLE:
      return new LocationError('Could not determine your location.')
    case err.TIMEOUT:
      return new LocationError('Location request timed out. Try again.')
    default:
      return new LocationError('Could not get your location.')
  }
}

/** High-accuracy fix — use when marking tee/basket pins on the course. */
export async function getPreciseLocation(): Promise<PreciseLocation> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    throw new LocationError('Location is not available on this device.')
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      pos =>
        resolve({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracyMeters: Number.isFinite(pos.coords.accuracy)
            ? pos.coords.accuracy
            : null,
        }),
      err => reject(readGeolocationError(err)),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    )
  })
}

/** Current device location (browser or Capacitor WebView). */
export async function getUserLocation(): Promise<{ lat: number; lon: number }> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    throw new LocationError('Location is not available on this device.')
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      pos =>
        resolve({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
        }),
      err => reject(readGeolocationError(err)),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 120_000 },
    )
  })
}

/**
 * Fetch current surface wind from Open-Meteo (free, no API key).
 * Maps meteorological "wind from" degrees to our hole-relative compass,
 * assuming the tee shot faces north (0°). Good enough until per-hole
 * bearings exist on course holes.
 */
export async function fetchLiveWind(
  lat: number,
  lon: number,
  throwBearingDeg = 0,
): Promise<LiveWind> {
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', String(lat))
  url.searchParams.set('longitude', String(lon))
  url.searchParams.set('current', 'wind_speed_10m,wind_direction_10m')
  url.searchParams.set('wind_speed_unit', 'mph')

  const res = await fetch(url.toString())
  if (!res.ok) throw new Error('Weather service unavailable')
  const json = await res.json()
  const speed = Math.round(json?.current?.wind_speed_10m ?? 0)
  const fromDeg = json?.current?.wind_direction_10m ?? 0

  if (speed < 2) {
    return { windDirection: 'none', windSpeed: 0, label: 'Calm (< 2 mph)' }
  }

  const windDirection = mapMeteoToWindDirection(fromDeg, throwBearingDeg)
  const label = `${speed} mph · ${describeWind(windDirection)}`
  return { windDirection, windSpeed: speed, label }
}

/** GPS location → Open-Meteo wind, mapped for the recommender. */
export async function fetchLiveWindForUser(
  throwBearingDeg = 0,
): Promise<LiveWind & { lat: number; lon: number }> {
  const { lat, lon } = await getUserLocation()
  const live = await fetchLiveWind(lat, lon, throwBearingDeg)
  return { ...live, lat, lon }
}

/** Wind direction meteorological degrees → Disc Caddy enum (8-way). */
function mapMeteoToWindDirection(
  fromDeg: number,
  throwBearingDeg: number,
): WindDirection {
  // Angle wind comes FROM, relative to throw bearing (0=headwind).
  const rel = ((fromDeg - throwBearingDeg) + 360) % 360

  if (rel >= 337.5 || rel < 22.5) return 'headwind'
  if (rel >= 22.5 && rel < 67.5) return 'head_from_right'
  if (rel >= 67.5 && rel < 112.5) return 'from_right'
  if (rel >= 112.5 && rel < 157.5) return 'tail_from_right'
  if (rel >= 157.5 && rel < 202.5) return 'tailwind'
  if (rel >= 202.5 && rel < 247.5) return 'tail_from_left'
  if (rel >= 247.5 && rel < 292.5) return 'from_left'
  return 'head_from_left'
}

function describeWind(dir: WindDirection): string {
  switch (dir) {
    case 'none': return 'calm'
    case 'headwind': return 'headwind'
    case 'tailwind': return 'tailwind'
    case 'from_left': return 'from the left'
    case 'from_right': return 'from the right'
    case 'head_from_left': return 'head from left'
    case 'head_from_right': return 'head from right'
    case 'tail_from_left': return 'tail from left'
    case 'tail_from_right': return 'tail from right'
  }
}
