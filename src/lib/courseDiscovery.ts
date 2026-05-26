import { supabase } from './supabase'
import { NearbyCourse } from '../types'

export async function listCoursesNearMe(radiusMiles = 50): Promise<NearbyCourse[]> {
  const { data, error } = await supabase.rpc('list_courses_near_me', {
    p_radius_miles: radiusMiles,
  })
  if (error) throw error
  return (
    (data as {
      id: string
      name: string
      locality: string | null
      region_code: string | null
      lat: number | null
      lon: number | null
      distance_miles: number | null
      rounds_logged: number
    }[]) ?? []
  ).map(c => ({
    id: c.id,
    name: c.name,
    locality: c.locality,
    regionCode: c.region_code,
    lat: c.lat,
    lon: c.lon,
    distanceMiles: c.distance_miles,
    roundsLogged: c.rounds_logged,
  }))
}

export function mapsUrl(lat: number, lon: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`
}
