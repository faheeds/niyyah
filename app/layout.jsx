import '../src/styles.css'

export const metadata = {
  title: 'Niyyah — Good intentions. Real impact.',
  description: 'Niyyah helps young people find welcoming local opportunities, community events, and ways to contribute.',
  icons: {
    icon: '/favicon.svg',
  },
  openGraph: {
    title: 'Niyyah — Good intentions. Real impact.',
    description: 'Find your people. Pick your next thing.',
    images: ['/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Niyyah — Good intentions. Real impact.',
    description: 'Find your people. Pick your next thing.',
    images: ['/og.png'],
  },
}

export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>
}
