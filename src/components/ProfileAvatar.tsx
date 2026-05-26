import { useEffect, useState } from 'react'
import { getDiscPhotoUrl } from '../lib/photos'

export function profileInitials(name: string | null | undefined): string {
  if (!name?.trim()) return '?'
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map(p => p[0]?.toUpperCase() ?? '').join('') || '?'
}

interface Props {
  displayName: string | null | undefined
  avatarPath?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function ProfileAvatar({
  displayName,
  avatarPath,
  size = 'md',
  className = '',
}: Props) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (avatarPath) {
      getDiscPhotoUrl(avatarPath).then(setUrl).catch(() => setUrl(null))
    } else {
      setUrl(null)
    }
  }, [avatarPath])

  const classes = ['profile-avatar', `profile-avatar-${size}`, className]
    .filter(Boolean)
    .join(' ')

  if (url) {
    return <img src={url} alt="" className={classes} />
  }

  return (
    <span className={classes} aria-hidden>
      {profileInitials(displayName)}
    </span>
  )
}
