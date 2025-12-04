import { RootProvider } from 'fumadocs-ui/provider/next';
import './global.css';
import { Inter } from 'next/font/google';
import type { Metadata } from 'next';

const inter = Inter({
  subsets: ['latin'],
});

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL
  ? new URL(process.env.NEXT_PUBLIC_BASE_URL)
  : new URL('https://primitives.org.ai');

export const metadata: Metadata = {
  metadataBase: baseUrl,
  title: {
    default: 'Primitives.org.ai',
    template: '%s | Primitives.org.ai',
  },
  description: 'The fundamental abstractions for building AI-native software. Functions, Databases, Workflows, Agents, Products, Services, and Businesses.',
  keywords: ['AI', 'primitives', 'functions', 'agents', 'workflows', 'AI-native', 'business-as-code', 'services-as-software'],
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
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Primitives.org.ai',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Primitives.org.ai',
    description: 'The fundamental abstractions for building AI-native software.',
    images: ['/og-image.png'],
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
};

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
