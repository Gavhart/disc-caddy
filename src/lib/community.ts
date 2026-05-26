import { geocodeCityPlace, normalizeHomeCityFields } from './geocode'
import { supabase } from './supabase'
import { sendNotificationEmail } from './notifications'
import { CommunityMember, CommunityMessage, CommunityThread, HomeCity } from '../types'

interface HomeCityRow {
  city: string
  region_code: string | null
  country_code: string | null
  course_id: string | null
  sort_order: number
  latitude: number | null
  longitude: number | null
}

function rowToHomeCity(r: HomeCityRow): HomeCity {
  return {
    city: r.city,
    regionCode: r.region_code,
    countryCode: r.country_code,
    courseId: r.course_id,
    sortOrder: r.sort_order,
    latitude: r.latitude,
    longitude: r.longitude,
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

/** Fill missing coordinates so radius search works for typed cities too. */
export async function ensureHomeCityCoordinates(cities: HomeCity[]): Promise<HomeCity[]> {
  const results: HomeCity[] = []
  for (const city of cities) {
    if (city.latitude != null && city.longitude != null) {
      results.push(city)
      continue
    }
    const geo = await geocodeCityPlace(city.city, city.regionCode, city.countryCode)
    if (geo) {
      results.push({
        ...city,
        city: geo.city,
        regionCode: geo.regionCode,
        countryCode: geo.countryCode,
        latitude: geo.latitude,
        longitude: geo.longitude,
      })
    } else {
      results.push(city)
    }
  }
  return results
}

export async function fetchMyHomeCities(): Promise<HomeCity[]> {
  const { data, error } = await supabase
    .from('profile_home_cities')
    .select('city, region_code, country_code, course_id, sort_order, latitude, longitude')
    .order('sort_order', { ascending: true })
  if (error) throw error
  return ((data as HomeCityRow[]) ?? []).map(rowToHomeCity)
}

export interface CommunitySetupStatus {
  communityVisible: boolean
  lookingForPlayers: boolean
  searchRadiusMiles: number
  homeCityCount: number
  gpsCityCount: number
  savedCityLabels: string[]
  otherVisiblePlayers: number
  otherVisibleWithCities: number
  matchCount: number
}

export async function fetchCommunitySetupStatus(): Promise<CommunitySetupStatus> {
  const { data, error } = await supabase.rpc('community_setup_status')
  if (error) throw error
  const row = (data ?? {}) as Record<string, unknown>
  return {
    communityVisible: Boolean(row.community_visible),
    lookingForPlayers: Boolean(row.looking_for_players),
    searchRadiusMiles: Number(row.search_radius_miles ?? 25),
    homeCityCount: Number(row.home_city_count ?? 0),
    gpsCityCount: Number(row.gps_city_count ?? 0),
    savedCityLabels: Array.isArray(row.saved_city_labels)
      ? row.saved_city_labels.filter((v): v is string => typeof v === 'string')
      : [],
    otherVisiblePlayers: Number(row.other_visible_players ?? 0),
    otherVisibleWithCities: Number(row.other_visible_with_cities ?? 0),
    matchCount: Number(row.match_count ?? 0),
  }
}

export async function saveHomeCities(
  cities: HomeCity[],
  communityVisible: boolean,
  lookingForPlayers: boolean,
  searchRadiusMiles: number,
): Promise<HomeCity[]> {
  if (cities.length > 3) {
    throw new Error('At most 3 home cities allowed')
  }
  if (searchRadiusMiles < 5 || searchRadiusMiles > 200) {
    throw new Error('Search radius must be 5–200 miles')
  }

  const withCoords = await ensureHomeCityCoordinates(cities)

  if (communityVisible && withCoords.length === 0) {
    throw new Error('Add at least one home area before opting in to Community.')
  }

  if (
    communityVisible &&
    withCoords.length > 0 &&
    withCoords.every(c => c.latitude == null || c.longitude == null)
  ) {
    // Still allow save — city-name matching may work — but radius search needs coords.
  }

  const payload = withCoords.map((c, i) => {
    const normalized = normalizeHomeCityFields(c)
    return {
      city: normalized.city,
      region_code: normalized.regionCode,
      country_code: normalized.countryCode,
      course_id: c.courseId ?? null,
      latitude: c.latitude ?? null,
      longitude: c.longitude ?? null,
      sort_order: i,
    }
  })

  const { error } = await supabase.rpc('set_profile_home_cities', {
    p_cities: payload,
    p_community_visible: communityVisible,
    p_looking_for_players: communityVisible ? lookingForPlayers : false,
    p_search_radius_miles: searchRadiusMiles,
  })
  if (error) throw error

  return withCoords
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
      distance_miles: number | null
    }[]) ?? []
  ).map(r => ({
    userId: r.user_id,
    displayName: r.display_name || 'Player',
    sharedCityLabels: normalizeTextArray(r.shared_city_labels),
    lookingForPlayers: Boolean(r.looking_for_players),
    distanceMiles: r.distance_miles != null ? Number(r.distance_miles) : null,
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

  sendNotificationEmail({
    userId: recipientId,
    title: 'New Community message on Disc Caddy',
    body: body.trim().slice(0, 120),
    linkPath: '/community/messages',
  })
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

export function formatCommunityMessageWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatCommunityMessageDay(iso: string): string {
  const date = new Date(iso)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)

  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export function threadPartnerId(message: CommunityMessage, myUserId: string): string {
  return message.senderId === myUserId ? message.recipientId : message.senderId
}

export function threadPartnerName(message: CommunityMessage, myUserId: string): string {
  return message.senderId === myUserId ? message.recipientName : message.senderName
}

/** Group flat messages into per-player threads, newest thread first. */
export function buildCommunityThreads(
  messages: CommunityMessage[],
  myUserId: string,
): CommunityThread[] {
  const byPartner = new Map<string, CommunityMessage[]>()
  const names = new Map<string, string>()

  for (const message of messages) {
    const partnerId = threadPartnerId(message, myUserId)
    const partnerName = threadPartnerName(message, myUserId)
    names.set(partnerId, partnerName)
    const list = byPartner.get(partnerId) ?? []
    list.push(message)
    byPartner.set(partnerId, list)
  }

  const threads: CommunityThread[] = []
  for (const [partnerId, partnerMessages] of byPartner) {
    const sorted = [...partnerMessages].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    )
    const lastMessage = sorted[sorted.length - 1]
    threads.push({
      partnerId,
      partnerName: names.get(partnerId) ?? 'Player',
      lastMessage,
      unreadCount: partnerMessages.filter(m => m.isInbound && !m.readAt).length,
      messages: sorted,
    })
  }

  return threads.sort(
    (a, b) =>
      new Date(b.lastMessage.createdAt).getTime() -
      new Date(a.lastMessage.createdAt).getTime(),
  )
}

export function countUnreadCommunityMessages(messages: CommunityMessage[]): number {
  return messages.filter(m => m.isInbound && !m.readAt).length
}

/** Derive a home city from course metadata (falls back to region/country). */
export function homeCityFromCourse(course: {
  id: string
  locality: string | null
  regionCode: string | null
  countryCode: string | null
  lat: number | null
  lon: number | null
  name: string
}): HomeCity | null {
  const city =
    course.locality?.trim() ||
    course.regionCode?.trim() ||
    null
  if (!city) return null
  const normalized = normalizeHomeCityFields({
    city,
    regionCode: course.locality?.trim() ? course.regionCode?.trim() ?? null : null,
    countryCode: course.countryCode?.trim() ?? null,
  })
  return {
    city: normalized.city,
    regionCode: normalized.regionCode,
    countryCode: normalized.countryCode,
    courseId: course.id,
    sortOrder: 0,
    latitude: course.lat,
    longitude: course.lon,
  }
}
