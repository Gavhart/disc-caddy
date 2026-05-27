import React from 'react'
import ReactDOM from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import App from './App'
import './index.css'

async function initNativeShell() {
  if (!Capacitor.isNativePlatform()) return
  document.documentElement.classList.add('native-app')
  document.documentElement.classList.add(`native-${Capacitor.getPlatform()}`)
  const [{ StatusBar, Style }, { SplashScreen }] = await Promise.all([
    import('@capacitor/status-bar'),
    import('@capacitor/splash-screen'),
  ])
  await StatusBar.setStyle({ style: Style.Dark })
  if (Capacitor.getPlatform() === 'android') {
    await StatusBar.setBackgroundColor({ color: '#0f1f14' })
  }
  await SplashScreen.hide()
}

initNativeShell().catch(err => console.warn('[app] native shell init failed', err))

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
