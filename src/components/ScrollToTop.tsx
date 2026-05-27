import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/** Scroll to top on every client-side route change. */
export function ScrollToTop() {
  const { pathname, search, hash } = useLocation()

  useEffect(() => {
    if (hash) return

    window.scrollTo(0, 0)
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
  }, [pathname, search, hash])

  return null
}
