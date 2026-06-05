/** Bump when you ship a release users should see on next sign-in. */
export const APP_VERSION = '1.5.0'

export interface ReleaseNote {
  version: string
  date: string
  title: string
  /** Shipped in this release. */
  items: string[]
}

/** @deprecated Use ROADMAP_ITEMS in data/roadmap.ts */
export const ROADMAP: string[] = []

export interface ProductHighlight {
  id: string
  icon: string
  title: string
  summary: string
  href?: string
}

/** Top-of-page pillars on the Updates screen. */
export const PRODUCT_HIGHLIGHTS: ProductHighlight[] = [
  {
    id: 'caddy',
    icon: '🎯',
    title: 'Smart Caddy',
    summary:
      'Arm-speed-aware picks every throw — hole progress updates what’s left, lie layout (trees & mandos), GPS distance, and hole memory on course holes.',
    href: '/',
  },
  {
    id: 'live',
    icon: '📋',
    title: 'Live scorecards',
    summary:
      'Group rounds with real-time sync. Each player edits their line, or host-only mode on one phone.',
    href: '/',
  },
  {
    id: 'leagues',
    icon: '🏆',
    title: 'League platform',
    summary:
      'Season standings, doubles pairs, shuffle draw, league night cards, chat, ace pots, rivalries, handicaps, and auto-submit.',
    href: '/social/leagues',
  },
  {
    id: 'progress',
    icon: '⭐',
    title: 'Badges & progress',
    summary:
      'Lifetime badges, weekly challenges, playing-today check-ins, round highlights, and a progress strip on Play.',
    href: '/profile',
  },
  {
    id: 'social',
    icon: '👥',
    title: 'Community & events',
    summary:
      'Find players near you, post pickup rounds and league nights, DM friends, and share finished round recaps.',
    href: '/social',
  },
  {
    id: 'library',
    icon: '🗺️',
    title: 'Courses & bags',
    summary:
      'Multiple bags, course stepper, discovery map, playbook notes, stats dashboard, field practice with bag gap map, and nearby auto-import.',
    href: '/library',
  },
  {
    id: 'practice',
    icon: '🏟️',
    title: 'Field practice',
    summary:
      'Throw in an open field, measure distance per disc with GPS or manual entry, and see where your bag has coverage gaps.',
    href: '/practice',
  },
]

export const RELEASES: ReleaseNote[] = [
  {
    version: '1.5.0',
    date: '2026-05-21',
    title: 'Quick score bar & league night cards',
    items: [
      'Quick score bar — fixed bottom +/- controls on Play for one-handed scoring during live rounds',
      'Host scoring mode — cycle players on the quick bar when host enters all scores on one phone',
      'League Tonight tab — admins open league night, check players in, shuffle cards, and notify pairings',
      'Card rounds — players on a card start a shared live scorecard (singles groups or doubles pairs)',
      'Updates page — minimal scoring and league cards marked shipped on the UDisc parity roadmap',
    ],
  },
  {
    version: '1.4.0',
    date: '2026-05-21',
    title: 'Hole map, throw phases & Caddy adherence',
    items: [
      'Hole progress map — tee → basket schematic with numbered, color-coded pins per throw',
      'Throw phases — auto-classify drives, approaches, and putts; feed upshot/drive/putt picks',
      'Caddy vs your bag — adherence % and off-script disc list on Stats and during live rounds',
      'Updates page — prioritized on-course polish roadmap (UDisc parity + Caddy identity)',
      'Throw phase stats on the Stats dashboard with average distance per phase',
    ],
  },
  {
    version: '1.3.0',
    date: '2026-05-21',
    title: 'Venmo integrations for leagues',
    items: [
      'League ace pot tab — admins set a treasurer Venmo and suggested buy-in; members get one-tap pay links',
      'Quick pay presets — ace pot, skins, club dues, mini buy-in, and league payout with league name in the note',
      'Custom Venmo amount — pay any buy-in, then log the contribution so the pot balance stays accurate',
      'Profile Venmo username in Settings — optional handle for league admins sending payouts',
      'Updates page — Venmo moved from coming soon to shipped on the product roadmap',
    ],
  },
  {
    version: '1.2.0',
    date: '2026-05-21',
    title: 'Multi-shot Caddy, field practice & mandos',
    items: [
      'Hole progress — log each throw (distance or remaining ft); recommendations update for what’s left with a NEXT SHOT pick',
      'Lie layout on upshots — set trees, line shape, and mandos after your tee shot; course holes get a round-only fine-tune panel too',
      'Mando support — left, right, double, and triple mandos on custom holes, course editor, and the recommender (aim + stability bias)',
      'GPS hole length — mark tee → walk to basket/target → measured distance and tee bearing on Play',
      'Custom hole distance fixes — clear and retype distance; long holes no longer snap to bad picks when the field is empty',
      'Field practice (Library) — pick a disc, measure throw distance, log a session, and see a bag distance map with gap callouts',
      'Throw-distance GPS in field practice — mark release → mark landing for open-field sessions',
      'One-tap “Use last pick” and “In the basket” shortcuts in hole progress; live rounds auto-log throws to the stack',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-05-21',
    title: 'Leagues, doubles live, progression & polish',
    items: [
      'Doubles pair shuffle — fun random draw with team names; odd player sits out',
      'Live doubles scorecards — start a team round from Pairs; both partners update scores (best ball)',
      'League standings podium — top 3 hero on Standings; “Live now” badge when a pair is on the course',
      'Lifetime badges & player stats — rounds, birdies, leagues, challenges; unlock toast after you finish a round',
      'Playing-today check-ins & round photo highlights on Community and finished rounds',
      'League platform — chat, announcements, ace pot, rivalries, streaks, handicaps, public discovery, clubs',
      'Recommend page — hand & throw from profile with per-hole overrides; clearer course vs custom hole',
      'Home progress strip — rounds, birdies, best, badge count at a glance',
      'Invite page — live Caddy demo on a sample hole, feature previews, and social proof',
      'Updates page — shipped / in progress / coming soon roadmap columns',
      'Doubles auto-submit — both partners credited to pair standings when a team round ends',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-05-21',
    title: 'Ready for the App Store',
    items: [
      'Native mobile app — same account everywhere, all your data syncs across devices',
      'Store-ready privacy policy, account deletion, and native permissions for photos & location',
      'Password reset emails work from the mobile app',
    ],
  },
  {
    version: '0.6.5',
    date: '2026-05-21',
    title: 'Nearby course auto-import',
    items: [
      'Saving your home area on Community automatically imports nearby courses from DiscGolfAPI',
      'Courses within your search radius appear on the Library map and in Events without manual search',
      'Tournament-ready leaderboards',
    ],
  },
  {
    version: '0.6.4',
    date: '2026-05-21',
    title: 'Notifications bell',
    items: [
      'Bell icon in the header when you have unread messages or activity',
      'Notifications page — recent updates plus quick links to Messages and Events',
      'Nearby players get notified when someone posts an event or pickup in your area',
    ],
  },
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
      'Message badge fix — DMs and event/friend alerts counted separately; Updates panel on Social',
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
      'Player stats dashboard — averages, birdies, trends, and disc performance',
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
    title: 'Invites, notifications & on-course polish',
    items: [
      'Member features unlocked for everyone',
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
      'Each player enters their own scores; friends can join any round',
      'Completed group rounds show up in Round history for every player at that course',
    ],
  },
  {
    version: '0.3.3',
    date: '2026-05-21',
    title: 'Hole memory, Community inbox & messaging',
    items: [
      'Hole memory — on a course hole, see your last logged disc and result (e.g. “you threw a Buzzz and parred”) and get it recommended again',
      'Dedicated Messages page with threaded conversations and replies',
      'Community messaging available to everyone',
      'Community matching fixes — players you see can actually receive messages; replies work in existing threads',
      'GPS home areas, search radius, and a mobile-friendly Community layout',
      'Profile hub — photo, display name, and settings links; hamburger nav on phone',
      'Updated Player profile + settings',
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
    title: 'Round tracking & smarter picks',
    items: [
      'Live round mode — log your disc pick hole-by-hole',
      'Live wind from your GPS location — override on the wind rose anytime',
      'Expanded recommendation breakdowns with aim guidance',
      'Course stepper with hole-by-hole layout details',
      'Player profile at signup — name, distance, hand, and throw style',
      'Player profile saved to your account',
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
      'Unlimited bags and live-round features for everyone',
      'Fairway Sunset branding',
    ],
  },
]
