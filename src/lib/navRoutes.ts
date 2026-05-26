/** Route groups for primary app navigation tabs. */

export function isPlayRoute(pathname: string): boolean {
  return pathname === '/'
}

export function isSocialRoute(pathname: string): boolean {
  return (
    pathname === '/social' ||
    pathname === '/community' ||
    pathname.startsWith('/community/') ||
    pathname === '/leagues'
  )
}

export function isLibraryRoute(pathname: string): boolean {
  return (
    pathname === '/library' ||
    pathname === '/bags' ||
    pathname === '/courses' ||
    pathname.startsWith('/rounds') ||
    pathname === '/stats' ||
    pathname === '/playbook'
  )
}

export function isYouRoute(pathname: string): boolean {
  return (
    pathname === '/profile' ||
    pathname.startsWith('/settings') ||
    pathname === '/upgrade' ||
    pathname === '/invite' ||
    pathname === '/updates'
  )
}
