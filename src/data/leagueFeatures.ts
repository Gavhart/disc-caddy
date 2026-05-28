import type { League } from '../types'

export type LeagueFeatureStatus = 'live' | 'partial' | 'planned'

export interface LeagueFeature {
  id: string
  title: string
  summary: string
  status: LeagueFeatureStatus
  /** In-app route when the feature is available today */
  href?: string
}

/** Core league platform capabilities — maps product goals to the app today. */
export const LEAGUE_CORE_FEATURES: LeagueFeature[] = [
  {
    id: 'live-scorekeeping',
    title: 'Live scorekeeping',
    summary: 'Group scorecards with live hole-by-hole entry on the Play tab.',
    status: 'live',
    href: '/rounds',
  },
  {
    id: 'live-leaderboards',
    title: 'Live leaderboards',
    summary: 'See who is leading while a group round is in progress.',
    status: 'live',
    href: '/rounds',
  },
  {
    id: 'season-standings',
    title: 'Season standings & points',
    summary: 'Stroke or Stableford leagues with season rankings and auto-submit.',
    status: 'live',
  },
  {
    id: 'singles-doubles',
    title: 'Singles & doubles leagues',
    summary: 'Pair teams, combined round scoring, and pair standings for doubles leagues.',
    status: 'live',
  },
  {
    id: 'handicap',
    title: 'Handicap league options',
    summary: 'Net scoring and handicap indexes from recent rounds; admins can refresh indexes.',
    status: 'live',
  },
  {
    id: 'stats-history',
    title: 'Player stats & round history',
    summary: 'Trends, birdies, and past scorecards for every league member.',
    status: 'live',
    href: '/stats',
  },
  {
    id: 'courses-maps',
    title: 'Course layouts & maps',
    summary: 'Browse courses, edit holes, and explore the discovery map.',
    status: 'live',
    href: '/courses',
  },
  {
    id: 'events',
    title: 'Event scheduling',
    summary: 'Post league nights, pickup rounds, and tee times for your area.',
    status: 'live',
    href: '/community/events',
  },
  {
    id: 'management',
    title: 'League & player management',
    summary: 'Invite codes, admin controls, member counts, and season settings.',
    status: 'live',
  },
  {
    id: 'mobile-scorecards',
    title: 'Mobile scorecards',
    summary: 'Native iOS/Android apps with the same live scoring experience.',
    status: 'live',
    href: '/rounds',
  },
  {
    id: 'round-sharing',
    title: 'Round sharing & follow',
    summary: 'Share finished rounds and follow friend activity from Social.',
    status: 'live',
    href: '/social',
  },
]

export const LEAGUE_ROADMAP_FEATURES: LeagueFeature[] = [
  {
    id: 'league-chat',
    title: 'In-app league chat',
    summary: 'Dedicated league channels on each league page.',
    status: 'live',
  },
  {
    id: 'profiles',
    title: 'Richer player profiles',
    summary: 'More customization, home courses, and league bios.',
    status: 'partial',
    href: '/profile',
  },
  {
    id: 'highlights',
    title: 'Highlights & media',
    summary: 'Round photo highlights on finished rounds and friend activity thumbnails.',
    status: 'partial',
    href: '/rounds',
  },
  {
    id: 'discovery',
    title: 'League discovery nearby',
    summary: 'Browse and join public leagues from the Discover section.',
    status: 'live',
  },
  {
    id: 'beginner-filters',
    title: 'Beginner-friendly filters',
    summary: 'Skill tags on public leagues (beginner, intermediate, advanced).',
    status: 'live',
  },
  {
    id: 'auto-handicap',
    title: 'Smarter automated handicaps',
    summary: 'Course-adjusted indexes that update as rounds are submitted.',
    status: 'partial',
  },
  {
    id: 'clubs',
    title: 'Club & team management',
    summary: 'Organizations with invite codes; link clubs to leagues.',
    status: 'live',
  },
  {
    id: 'pots',
    title: 'Ace pots & payouts',
    summary: 'Track ace pools and log contributions per league.',
    status: 'live',
  },
  {
    id: 'sponsors',
    title: 'Sponsorship & merch',
    summary: 'League branding, sponsor slots, and shop links.',
    status: 'planned',
  },
  {
    id: 'rivalries',
    title: 'Rankings, streaks & rivalries',
    summary: 'Head-to-head records and active-player streaks per league.',
    status: 'live',
  },
  {
    id: 'analytics',
    title: 'Season progression visuals',
    summary: 'Charts for standings movement and projected finish.',
    status: 'planned',
  },
  {
    id: 'announcements',
    title: 'League announcements',
    summary: 'Admin posts with push notifications to league members.',
    status: 'live',
    href: '/notifications',
  },
]

export function leagueFeatureStatusLabel(status: LeagueFeatureStatus): string {
  if (status === 'live') return 'Live now'
  if (status === 'partial') return 'Partial'
  return 'Planned'
}

export function playModeLabel(mode: League['playMode']): string {
  return mode === 'doubles' ? 'Doubles' : 'Singles'
}

export function skillLevelLabel(level: League['skillLevel']): string {
  if (level === 'beginner') return 'Beginner'
  if (level === 'intermediate') return 'Intermediate'
  if (level === 'advanced') return 'Advanced'
  return 'All skill levels'
}
