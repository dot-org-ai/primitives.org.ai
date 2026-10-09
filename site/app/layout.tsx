import { RootProvider } from 'fumadocs-ui/provider/next'
import './global.css'
import type { Metadata } from 'next'

import localFont from 'next/font/local'

// Public Sans, the Org.AI Foundation's typeface, served from this site
const publicSans = localFont({ src: './fonts/publicsans-latin.woff2', weight: '100 900', display: 'swap' })

const baseUrl = process.env['NEXT_PUBLIC_BASE_URL']
  ? new URL(process.env['NEXT_PUBLIC_BASE_URL'])
  : new URL('https://primitives.org.ai')

export const metadata: Metadata = {
  metadataBase: baseUrl,
  title: {
    default: 'Primitives.org.ai',
    template: '%s | Primitives.org.ai',
  },
  description:
    'The fundamental abstractions for building AI-native software — from Functions and Agents through Services and Businesses, authored in MDXLD.',
  keywords: [
    'AI',
    'primitives',
    'functions',
    'agents',
    'workflows',
    'AI-native',
    'business-as-code',
    'services-as-software',
  ],
  authors: [{ name: 'Primitives.org.ai' }],
  creator: 'Primitives.org.ai',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: baseUrl,
    siteName: 'Primitives.org.ai',
    title: 'Primitives.org.ai',
    description: 'The fundamental abstractions for building AI-native software.',
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        type: 'image/png',
        alt: 'Primitives.org.ai — Build Business-as-Code & AI-Delivered Services-as-Software. The fundamental abstractions for building AI-native software.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Primitives.org.ai',
    description: 'The fundamental abstractions for building AI-native software.',
    images: ['/og.png'],
  },
  alternates: {
    canonical: './',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={publicSans.className} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        {/* dark, as every Org.AI Foundation site is */}
        <RootProvider theme={{ forcedTheme: 'dark', defaultTheme: 'dark', enableSystem: false }}>{children}</RootProvider>
        <footer className="border-t border-fd-border px-6 py-6 text-sm text-fd-muted-foreground">
          <p>
            The primitives are documented by{' '}
            <a href="https://foundation.org.ai" className="underline">
              The Org.AI Foundation
            </a>
            . They are authored in{' '}
            <a href="https://mdx.org.ai" className="underline">
              MDXLD
            </a>
            , our extension of{' '}
            <a href="https://mdxjs.com" className="underline">
              MDX
            </a>
            &nbsp;— an open standard authored by the MDX community.
          </p>
          <p className="mt-1 opacity-70">
            Vocabulary at{' '}
            <a href="https://schema.org.ai" className="underline">
              schema.org.ai
            </a>
          </p>
        </footer>
      </body>
    </html>
  )
}
