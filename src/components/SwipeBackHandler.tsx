import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { isNativeApp } from '../lib/platform'

/** React Router (BrowserRouter) tracks stack depth on history.state.idx */
function canNavigateBack(): boolean {
  const idx = window.history.state?.idx
  return typeof idx === 'number' ? idx > 0 : window.history.length > 1
}

const EDGE_PX = 28
const MIN_SWIPE_PX = 72
const MAX_VERTICAL_PX = 64

/**
 * Native-style back navigation for Capacitor:
 * - iOS: WKWebView edge swipe (enabled in AppDelegate) + history sync
 * - Android: edge swipe + system back button
 */
export function SwipeBackHandler() {
  const navigate = useNavigate()
  const tracking = useRef<{ startX: number; startY: number } | null>(null)

  useEffect(() => {
    if (!isNativeApp()) return

    if (Capacitor.getPlatform() === 'android') {
      let remove: (() => void) | undefined
      App.addListener('backButton', () => {
        if (canNavigateBack()) {
          navigate(-1)
        } else {
          App.exitApp()
        }
      }).then(handle => {
        remove = () => handle.remove()
      })
      return () => remove?.()
    }
  }, [navigate])

  useEffect(() => {
    if (!isNativeApp()) return
    // iOS uses native allowsBackForwardNavigationGestures on the WKWebView.
    if (Capacitor.getPlatform() === 'ios') return

    function onTouchStart(e: TouchEvent) {
      if (e.touches.length !== 1) return
      const touch = e.touches[0]
      if (touch.clientX > EDGE_PX) return
      if (!canNavigateBack()) return
      tracking.current = { startX: touch.clientX, startY: touch.clientY }
    }

    function onTouchMove(e: TouchEvent) {
      const start = tracking.current
      if (!start || e.touches.length !== 1) return
      const touch = e.touches[0]
      const dx = touch.clientX - start.startX
      const dy = Math.abs(touch.clientY - start.startY)
      if (dy > MAX_VERTICAL_PX && dx < MIN_SWIPE_PX) {
        tracking.current = null
      }
    }

    function onTouchEnd(e: TouchEvent) {
      const start = tracking.current
      tracking.current = null
      if (!start) return
      const touch = e.changedTouches[0]
      const dx = touch.clientX - start.startX
      const dy = Math.abs(touch.clientY - start.startY)
      if (dx >= MIN_SWIPE_PX && dy <= MAX_VERTICAL_PX && canNavigateBack()) {
        navigate(-1)
      }
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove', onTouchMove, { passive: true })
    document.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onTouchEnd)
    }
  }, [navigate])

  return null
}
