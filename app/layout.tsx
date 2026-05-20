import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { ThemeProvider } from '@/components/dashboard/theme-provider'
import './globals.css'

const _geist = Geist({ subsets: ['latin'] })
const _geistMono = Geist_Mono({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Retell AI Dashboard',
  description: 'Monitor and analyze your Retell AI calls with real-time analytics',
  generator: 'v0.app',
  icons: {
    icon: [
      { url: '/icon-light-32x32.png', media: '(prefers-color-scheme: light)' },
      { url: '/icon-dark-32x32.png', media: '(prefers-color-scheme: dark)' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-icon.png',
  },
}

// Tiny sync script: read the persisted theme from localStorage and apply
// the class BEFORE React hydrates so there's no flash of the wrong theme.
const themeInitScript = `
(function() {
  try {
    var raw = localStorage.getItem('dashboard-theme');
    var t = 'dark';
    if (raw) {
      var parsed = JSON.parse(raw);
      if (parsed && parsed.state && parsed.state.theme) t = parsed.state.theme;
    }
    var root = document.documentElement;
    root.classList.remove('dark', 'theme-occ');
    if (t === 'dark') root.classList.add('dark');
    else if (t === 'occ') root.classList.add('theme-occ');
  } catch (e) {
    document.documentElement.classList.add('dark');
  }
})();
`.trim()

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="bg-background">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="font-sans antialiased">
        <ThemeProvider>{children}</ThemeProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
