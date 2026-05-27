import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.disccaddy.app',
  appName: 'Disc Caddy',
  webDir: 'dist',
  server: {
    // DEV ONLY — uncomment to live-reload against Vite. Must be off for store builds.
    // url: 'http://localhost:5173',
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#0f1f14',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0f1f14',
    },
  },
}

export default config
