import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * Disc Caddy is currently free for everyone — there is no paid tier or
 * Upgrade page. This component exists only as a redirect shim so any
 * lingering links / bookmarks to /upgrade quietly send the user home.
 */
export function UpgradePage() {
  const navigate = useNavigate()
  useEffect(() => {
    navigate('/', { replace: true })
  }, [navigate])
  return null
}
