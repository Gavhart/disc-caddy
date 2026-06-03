/**
 * Disc Caddy is currently free for everyone — every feature is unlocked at
 * the AuthContext level (isPro = true). ProGate is kept as a no-op stub so
 * existing call sites keep compiling; bring it back to life when a paid tier
 * actually exists again.
 */
export function ProGate(_props: { feature: string; children?: React.ReactNode }): null {
  return null
}
