import { RootProvider } from 'fumadocs-ui/provider/next';
import './global.css';
import localFont from 'next/font/local';
// Public Sans, the Org.AI Foundation's typeface, served from this site
const publicSans = localFont({ src: './fonts/publicsans-latin.woff2', weight: '100 900', display: 'swap' });
const baseUrl = process.env.NEXT_PUBLIC_BASE_URL
    ? new URL(process.env.NEXT_PUBLIC_BASE_URL)
    : new URL('https://primitives.org.ai');
export const metadata = {
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
export default function Layout({ children }) {
    return (<html lang="en" className={publicSans.className} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        {/* dark, as every Org.AI Foundation site is */}
        <RootProvider theme={{ forcedTheme: 'dark', defaultTheme: 'dark', enableSystem: false }}>{children}</RootProvider>
      </body>
    </html>);
}
