import { Capacitor } from '@capacitor/core'

/** True when running inside the iOS or Android Capacitor shell. */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform()
}

export function isIOS(): boolean {
  return Capacitor.getPlatform() === 'ios'
}

export function isAndroid(): boolean {
  return Capacitor.getPlatform() === 'android'
}

/**
 * Stripe Checkout / Billing Portal must not be offered inside native apps
 * (App Store / Play billing rules for digital subscriptions).
 */
export function isWebCheckoutAvailable(): boolean {
  return !isNativeApp()
}
