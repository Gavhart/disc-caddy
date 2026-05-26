/** Bump when you ship a release users should see on next sign-in. */
export const APP_VERSION = '0.3.3'

export interface ReleaseNote {
  version: string
  date: string
  title: string
  /** Shipped in this release. */
  items: string[]
}

/** Planned features — edit anytime; shown on the updates page. */
export const ROADMAP: string[] = [
  'Pro checkout — Stripe billing live on the Upgrade page',
  'Hole memory refinements — more history per hole and smarter tie-ins to your bag',
  'Community notifications when someone messages you',
  'iOS & Android apps in the App Store and Google Play',
  'Share a bag or round recap with friends',
  'Offline mode for course stepping on spotty signal',
  'Push invites when someone adds you to a group card',
]

export const RELEASES: ReleaseNote[] = [
  {
    version: '0.3.3',
    date: '2026-05-21',
    title: 'Hole memory, Community inbox & Pro messaging',
    items: [
      'Hole memory (Pro) — on a course hole, see your last logged disc and result (e.g. “you threw a Buzzz and parred”) and get it recommended again',
      'Dedicated Messages page with threaded conversations and replies',
      'Community messaging is Pro-only; free accounts can still browse Community and read inbound messages',
      'Community matching fixes — players you see can actually receive messages; replies work in existing threads',
      'GPS home areas, search radius, and a mobile-friendly Community layout',
      'Profile hub — photo, display name, and settings links; hamburger nav on phone',
      'Upgrade page lists current Pro perks; checkout is being wired up and will go live shortly',
    ],
  },
  {
    version: '0.3.2',
    date: '2026-05-25',
    title: 'Community messaging & looking for players',
    items: [
      '“Looking for players” badge — show when you want new card-mates',
      'Message other community members in your home cities (in-app inbox)',
      'Unread message highlight on the Community page',
    ],
  },
  {
    version: '0.3.1',
    date: '2026-05-25',
    title: 'Community — find players in your area',
    items: [
      'Set up to 3 home-area cities on your profile (manual or from a course search)',
      'Opt-in Community page — see other members who share your cities',
      'City-based matching while the course catalog is still growing',
    ],
  },
  {
    version: '0.3.0',
    date: '2026-05-21',
    title: 'Scorecard, group rounds & leaderboards',
    items: [
      'Live scorecard with strokes per hole and running +/- par',
      'Add registered players (search by name/email) or guest names to your card',
      'Hole standings when multiple players score the same hole',
      'Round history page with full scorecard replay',
      'Course and per-hole leaderboards — ranked by fewest strokes',
    ],
  },
  {
    version: '0.2.0',
    date: '2026-05-21',
    title: 'Pro round tracking & smarter picks',
    items: [
      'Live round mode — log your disc pick hole-by-hole (Pro)',
      'Live wind from your GPS location — override on the wind rose anytime',
      'Expanded recommendation breakdowns with aim guidance',
      'Course stepper with hole-by-hole layout details',
      'Player profile at signup — name, distance, hand, and throw style',
      'Pro vs Free membership visible in your Supabase dashboard',
    ],
  },
  {
    version: '0.1.0',
    date: '2026-05-01',
    title: 'Disc Caddy launch',
    items: [
      'Arm-speed-aware disc recommendations from your bag',
      'Multiple bags, disc photos, and player distance tuning',
      'Shared course catalog with per-hole distances and doglegs',
      'Stripe Pro subscription — unlimited bags and live-round features',
      'Fairway Sunset branding',
    ],
  },
]
