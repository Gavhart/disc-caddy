import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.disccaddy.app',
  appName: 'Disc Caddy',
  webDir: 'dist',
  server: {
    // Allow live-reload against the Vite dev server during native development.
    // Comment out or remove for production store builds.
    // url: 'http://localhost:5173',
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
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
