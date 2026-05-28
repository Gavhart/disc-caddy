export type RoadmapStatus = 'shipped' | 'in_progress' | 'planned'

export interface RoadmapItem {
  id: string
  title: string
  description: string
  status: RoadmapStatus
}

export const ROADMAP_ITEMS: RoadmapItem[] = [
  {
    id: 'caddy-engine',
    title: 'Arm-speed-aware Caddy recommendations',
    description: 'Top pick, ranked bag, aim guidance, wind, and hole memory on course holes.',
    status: 'shipped',
  },
  {
    id: 'live-scorecards',
    title: 'Live group scorecards',
    description: 'Real-time multi-player cards; each player edits their own scores.',
    status: 'shipped',
  },
  {
    id: 'doubles-live',
    title: 'Doubles pair shuffle & live team scorecards',
    description: 'Random pairing draw, best-ball team rounds, both partners update scores.',
    status: 'shipped',
  },
  {
    id: 'league-platform',
    title: 'Full league platform',
    description: 'Standings, chat, announcements, ace pot, rivalries, handicaps, discovery, clubs.',
    status: 'shipped',
  },
  {
    id: 'badges',
    title: 'Lifetime badges & player progression',
    description: 'Badges, stats summary, unlock banner after rounds, home progress strip.',
    status: 'shipped',
  },
  {
    id: 'highlights',
    title: 'Round highlights & playing-today check-ins',
    description: 'Photo highlights on finished rounds and “playing today” on Community.',
    status: 'shipped',
  },
  {
    id: 'community',
    title: 'Community, events & messaging',
    description: 'Home areas, pickup rounds, league nights, DMs, friend activity feed.',
    status: 'shipped',
  },
  {
    id: 'invite-demo',
    title: 'Public invite page with live demo',
    description: 'Sample-hole Caddy preview and feature showcase for new players.',
    status: 'shipped',
  },
  {
    id: 'league-hero',
    title: 'League standings podium & live pair badges',
    description: 'Top-3 hero on standings; “Live now” when a doubles team is on the course.',
    status: 'shipped',
  },
  {
    id: 'formats',
    title: 'Round formats & playbook',
    description: 'Stroke, Stableford, skins, best ball; per-hole strategy notes and stats.',
    status: 'shipped',
  },
  {
    id: 'native-push',
    title: 'Native push notifications',
    description: 'Scorecard invites, league news, and friend activity on iOS & Android.',
    status: 'in_progress',
  },
  {
    id: 'progression-charts',
    title: 'Season progression charts',
    description: 'Trend lines for league standings, handicap movement, and personal bests.',
    status: 'in_progress',
  },
  {
    id: 'demo-video',
    title: 'Gameplay demo videos',
    description: 'Short screen captures for store listings and the invite page.',
    status: 'in_progress',
  },
  {
    id: 'discovery-map',
    title: 'League discovery map',
    description: 'Browse open public leagues on a map filtered by skill and home area.',
    status: 'planned',
  },
  {
    id: 'ai-bag',
    title: 'AI bag tuning from your stats',
    description: 'Swap suggestions based on course playbook, miss patterns, and wind.',
    status: 'planned',
  },
  {
    id: 'brackets',
    title: 'Tournament bracket mode',
    description: 'Single-elimination brackets for larger league nights and club events.',
    status: 'planned',
  },
  {
    id: 'course-overlays',
    title: 'Course map overlays',
    description: 'Hole notes and aim lines tied to the course discovery map.',
    status: 'planned',
  },
  {
    id: 'sponsors',
    title: 'League sponsorship & merch',
    description: 'Branding slots, sponsor logos, and shop links on league pages.',
    status: 'planned',
  },
]

export const SOCIAL_PROOF = {
  headline: 'Built for league nights and casual rounds',
  stats: [
    { label: 'Smart picks', value: 'Every hole' },
    { label: 'Live scorecards', value: 'Group + doubles' },
    { label: 'Leagues', value: 'Season standings' },
  ],
  quotes: [
    {
      text: 'Finally one app for what disc to throw and keeping league scores straight.',
      author: 'Beta league admin',
    },
    {
      text: 'The pairing shuffle alone saved us twenty minutes of arguing at league night.',
      author: 'Doubles league host',
    },
  ],
}
