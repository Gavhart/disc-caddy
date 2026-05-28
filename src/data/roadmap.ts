export type RoadmapStatus = 'shipped' | 'in_progress' | 'planned'

export interface RoadmapItem {
  id: string
  title: string
  description: string
  status: RoadmapStatus
}

export const ROADMAP_ITEMS: RoadmapItem[] = [
  {
    id: 'doubles-live',
    title: 'Doubles pair shuffle & live team scorecards',
    description: 'Random pairing draw, best-ball team rounds, both partners update scores.',
    status: 'shipped',
  },
  {
    id: 'badges',
    title: 'Lifetime badges & player progression',
    description: 'Earn badges from rounds, birdies, leagues, and weekly challenges.',
    status: 'shipped',
  },
  {
    id: 'league-platform',
    title: 'League chat, ace pots, rivalries & handicaps',
    description: 'Full league toolkit — standings, announcements, pair scoring, streak boards.',
    status: 'shipped',
  },
  {
    id: 'highlights',
    title: 'Round highlights & playing-today check-ins',
    description: 'Photo highlights on finished rounds and “playing today” on Community.',
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
    id: 'discovery',
    title: 'League discovery map',
    description: 'Browse open public leagues filtered by skill level and home area.',
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
