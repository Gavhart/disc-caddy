/** Bump when you ship a release users should see on next sign-in. */
export const APP_VERSION = '0.6.3'

export interface ReleaseNote {
  version: string
  date: string
  title: string
  /** Shipped in this release. */
  items: string[]
}

/** Planned features — edit anytime; shown on the updates page. */
export const ROADMAP: string[] = [
  'Native iOS & Android apps with push notifications',
  'League commissioner tools — schedule weeks, assign pairings',
  'Course map overlays tied to hole notes',
  'AI bag tuning from your stats and course playbook',
  'Tournament bracket mode for larger groups',
]

export const RELEASES: ReleaseNote[] = [
  {
    version: '0.6.3',
    date: '2026-05-21',
    title: 'Clearer app structure',
    items: [
      'Four main sections: Play, Social, Library, and You — with a bottom tab bar on mobile',
      'Social hub — one place for players, events, messages, and leagues',
      'Library hub — bags, courses, round history, stats, and playbook',
      'Consistent page headers and back navigation across sub-pages',
      'Profile simplified — account settings without duplicate feature links',
    ],
  },
  {
    version: '0.6.2',
    date: '2026-05-21',
    title: 'Community events & pickup rounds',
    items: [
      'Events page — post tournaments, league nights, or group outings',
      'Pickup rounds — say when and where you want people to play with you',
      '75-mile radius — only nearby players see posts based on home areas',
      'RSVP with attendance counts; hosts view who is going or maybe',
      'Host notifications when someone joins your event',
      'League admins can edit season dates, name, format, or delete a league',
      'Leagues page shows season status, stats, leader, and invite codes at a glance',
      'Community checkboxes now show a clear checked state',
    ],
  },
  {
    version: '0.6.1',
    date: '2026-05-21',
    title: 'Embedded map, auto leagues & live push',
    items: [
      'Interactive course map on Courses — tap pins to highlight nearby tracks',
      'Auto league import — ending a round (9+ holes) submits to all active leagues in season',
      'Push notifications delivered via dispatch-notification edge function (Web Push + email)',
      'Server-side notification dispatch from scorecard invites, messages, and friend activity',
      'Run node scripts/generate-vapid.mjs to generate VAPID keys for push setup',
    ],
  },
  {
    version: '0.6.0',
    date: '2026-05-21',
    title: 'Stats, formats, leagues & the full power-user stack',
    items: [
      'Player stats dashboard (Pro) — averages, birdies, trends, and disc performance',
      'Round formats — stroke, Stableford, skins, and best ball with live standings',
      'Course playbook — per-hole strategy, notes, and your last 3 scores',
      'Weekly challenges on Profile — birdies, rounds played, squad goals',
      'Scheduled rounds on Community — post tee times and RSVP',
      'Leagues — season standings; submit completed rounds with invite codes',
      'Friend head-to-head — compare stats and shared courses',
      'Courses near you — discovery map from your home areas',
      'Bag insights — top thrown discs and swap candidates',
      'Rich recap share images — download a PNG for social',
      'Browser push notification setup in Settings (requires VAPID keys)',
      'Community message emails when notify email is on',
    ],
  },
  {
    version: '0.5.0',
    date: '2026-05-21',
    title: 'Pro checkout, invites, notifications & on-course polish',
    items: [
      'Pro checkout live — Stripe billing on Upgrade and Settings (requires env + webhooks)',
      'Scorecard invites — friends get “Join my round at X?” before appearing on your card',
      'In-app alerts + optional email for scorecard invites and Community messages',
      'Community nav badge for unread messages and notifications',
      'Host-only scoring mode — one phone enters everyone’s scores',
      'Tap a score to type a number; putt counter on the scorecard',
      'Hole memory++ — last 3 rounds on a hole in the Recommend banner',
      'Per-hole map notes (UDisc-style) saved to your account',
      'Round recap share links — public page with score and group totals',
      'Invite Community players to your live scorecard',
      'Friend activity feed on Profile when friends finish rounds',
      'Offline course stepping — cached holes and queued scores sync when signal returns',
    ],
  },
  {
    version: '0.3.4',
    date: '2026-05-21',
    title: 'Friends & live group scorecards',
    items: [
      'Friends on Profile — send requests, accept invites, and build a friends list',
      'One-tap add friends to your scorecard from the + Player panel',
      'Live group scorecards — everyone on the card sees score updates in real time',
      'Each player enters their own scores; friends can join without Pro',
      'Completed group rounds show up in Round history for every player at that course',
    ],
  },
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
