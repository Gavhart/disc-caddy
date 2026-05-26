import { supabase } from './supabase'
import { CommunityMember, CommunityMessage, HomeCity } from '../types'

interface HomeCityRow {
  city: string
  region_code: string | null
  country_code: string | null
  course_id: string | null
  sort_order: number
}

function rowToHomeCity(r: HomeCityRow): HomeCity {
  return {
    city: r.city,
    regionCode: r.region_code,
    countryCode: r.country_code,
    courseId: r.course_id,
    sortOrder: r.sort_order,
  }
}

/** Postgres text[] sometimes arrives as a string from RPC — normalize it. */
function normalizeTextArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === 'string')
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      const inner = trimmed.slice(1, -1).trim()
      if (!inner) return []
      return inner.split(',').map(part => part.trim().replace(/^"|"$/g, ''))
    }
    return trimmed ? [trimmed] : []
  }
  return []
}

export function formatCityLabel(city: HomeCity | { city: string; regionCode?: string | null; countryCode?: string | null }): string {
  const region = city.regionCode?.trim()
  const country = city.countryCode?.trim()
  let label = city.city.trim()
  if (region) label += `, ${region}`
  if (country) label += `, ${country}`
  return label
}

export async function fetchMyHomeCities(): Promise<HomeCity[]> {
  const { data, error } = await supabase
    .from('profile_home_cities')
    .select('city, region_code, country_code, course_id, sort_order')
    .order('sort_order', { ascending: true })
  if (error) throw error
  return ((data as HomeCityRow[]) ?? []).map(rowToHomeCity)
}

export async function saveHomeCities(
  cities: HomeCity[],
  communityVisible: boolean,
  lookingForPlayers: boolean,
): Promise<void> {
  if (cities.length > 3) {
    throw new Error('At most 3 home cities allowed')
  }

  const payload = cities.map((c, i) => ({
    city: c.city.trim(),
    region_code: c.regionCode?.trim() || null,
    country_code: c.countryCode?.trim() || null,
    course_id: c.courseId ?? null,
    sort_order: i,
  }))

  const { error } = await supabase.rpc('set_profile_home_cities', {
    p_cities: payload,
    p_community_visible: communityVisible,
    p_looking_for_players: communityVisible ? lookingForPlayers : false,
  })
  if (error) throw error
}

export async function fetchCommunityMembers(): Promise<CommunityMember[]> {
  const { data, error } = await supabase.rpc('community_members_at_my_cities')
  if (error) throw error
  return (
    (data as {
      user_id: string
      display_name: string
      shared_city_labels: string[]
      looking_for_players: boolean
    }[]) ?? []
  ).map(r => ({
    userId: r.user_id,
    displayName: r.display_name || 'Player',
    sharedCityLabels: normalizeTextArray(r.shared_city_labels),
    lookingForPlayers: Boolean(r.looking_for_players),
  }))
}

export async function sendCommunityMessage(
  recipientId: string,
  body: string,
): Promise<void> {
  const { error } = await supabase.rpc('send_community_message', {
    p_recipient_id: recipientId,
    p_body: body.trim(),
  })
  if (error) throw error
}

export async function fetchCommunityMessages(): Promise<CommunityMessage[]> {
  const { data, error } = await supabase.rpc('list_community_messages')
  if (error) throw error
  return (
    (data as {
      id: string
      sender_id: string
      sender_name: string
      recipient_id: string
      recipient_name: string
      body: string
      created_at: string
      read_at: string | null
      is_inbound: boolean
    }[]) ?? []
  ).map(r => ({
    id: r.id,
    senderId: r.sender_id,
    senderName: r.sender_name,
    recipientId: r.recipient_id,
    recipientName: r.recipient_name,
    body: r.body,
    createdAt: r.created_at,
    readAt: r.read_at,
    isInbound: r.is_inbound,
  }))
}

export async function markCommunityMessageRead(messageId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_community_message_read', {
    p_message_id: messageId,
  })
  if (error) throw error
}

/** Derive a home city from course metadata (falls back to region/country). */
export function homeCityFromCourse(course: {
  id: string
  locality: string | null
  regionCode: string | null
  countryCode: string | null
  name: string
}): HomeCity | null {
  const city =
    course.locality?.trim() ||
    course.regionCode?.trim() ||
    null
  if (!city) return null
  return {
    city,
    regionCode: course.locality?.trim() ? course.regionCode?.trim() ?? null : null,
    countryCode: course.countryCode?.trim() ?? null,
    courseId: course.id,
    sortOrder: 0,
  }
}
