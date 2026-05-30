import type { RoadmapItem } from './roadmap'

/**
 * Priority order for UDisc-like on-course polish while keeping Disc Caddy’s
 * “what to throw” identity. Shown in order on the Updates page.
 */
export const UDISC_PARITY_ROADMAP: RoadmapItem[] = [
  {
    id: 'hole-map-pins',
    title: 'Hole map + throw pins',
    description:
      'Schematic tee → basket map with color-coded pins per throw, phase tags, and remaining distance — Map My Score lite tied to the Caddy.',
    status: 'shipped',
  },
  {
    id: 'caddy-adherence',
    title: 'On-course disc stats dashboard',
    description:
      'See what you actually throw vs the top recommendation — adherence %, off-script discs, and phase breakdown on Stats and during live rounds.',
    status: 'shipped',
  },
  {
    id: 'minimal-scoring',
    title: 'Minimal / one-handed scoring',
    description:
      'Big-tap score entry and a slim score bar for league nights — keep one hand free and the phone in your pocket between holes.',
    status: 'shipped',
  },
  {
    id: 'league-cards',
    title: 'League card assignment + check-in',
    description:
      'Assign groups for league night, check players in, and push card pairings — organizer tools league admins expect from UDisc.',
    status: 'shipped',
  },
  {
    id: 'course-conditions',
    title: 'Course conditions + hole photos',
    description:
      'Community-submitted conditions and hole photos on your course catalog — local trust without building 17k maps.',
    status: 'planned',
  },
  {
    id: 'watch-widget',
    title: 'Watch or home-screen widget',
    description:
      'Glanceable hole number, score, and remaining distance on Apple Watch / Wear OS once native apps are stable.',
    status: 'planned',
  },
]
