import { useEffect, useState } from 'react'
import { isNativeApp } from '../lib/platform'

function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false
  if (window.matchMedia('(display-mode: standalone)').matches) return true
  return Boolean(
    (navigator as Navigator & { standalone?: boolean }).standalone,
  )
}

function isMobileBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
}

function isIOSBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPhone|iPad|iPod/i.test(navigator.userAgent)
}

/** Shown on mobile web when the app is not already installed to the home screen. */
export function AddToHomeScreenNote() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(
      !isNativeApp() && !isStandaloneDisplay() && isMobileBrowser(),
    )
  }, [])

  if (!visible) return null

  const ios = isIOSBrowser()

  return (
    <aside className="home-screen-tip" aria-label="Add to home screen">
      <p className="home-screen-tip-label">Important</p>
      <p className="home-screen-tip-title">Add Disc Caddy to your home screen</p>
      <p className="home-screen-tip-body">
        It opens full screen like a native app — perfect on the course, with no
        browser bar in the way.
      </p>
      <ol className="home-screen-tip-steps">
        {ios ? (
          <>
            <li>
              Tap <strong>Share</strong> <span aria-hidden="true">(□↑)</span> in
              Safari
            </li>
            <li>
              Scroll down and tap <strong>Add to Home Screen</strong>
            </li>
            <li>
              Tap <strong>Add</strong>, then open Disc Caddy from your home
              screen
            </li>
          </>
        ) : (
          <>
            <li>
              Tap the menu <strong>⋮</strong> in Chrome (top right)
            </li>
            <li>
              Tap <strong>Add to Home screen</strong> or{' '}
              <strong>Install app</strong>
            </li>
            <li>Open Disc Caddy from your home screen next time</li>
          </>
        )}
      </ol>
    </aside>
  )
}
