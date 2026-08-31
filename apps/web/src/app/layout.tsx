import type { Metadata, Viewport } from 'next';
import { DM_Sans, Fraunces } from 'next/font/google';
import { siteConfig } from '@/lib/site-config';
import './globals.css';

const sans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const display = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

const siteUrl = siteConfig.siteUrl;

function safeMetadataBase(url: string): URL {
  try {
    return new URL(url);
  } catch {
    return new URL('http://localhost:3000');
  }
}

export const metadata: Metadata = {
  metadataBase: safeMetadataBase(siteUrl),
  title: {
    default: siteConfig.seo.title,
    template: `%s | ${siteConfig.brandName}`,
  },
  description: siteConfig.seo.description,
  applicationName: siteConfig.brandName,
  authors: [{ name: siteConfig.companyName || siteConfig.brandName }],
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: siteUrl,
    siteName: siteConfig.brandName,
    title: siteConfig.seo.title,
    description: siteConfig.seo.description,
  },
  twitter: {
    card: 'summary_large_image',
    title: siteConfig.seo.title,
    description: siteConfig.seo.description,
  },
  alternates: {
    canonical: siteUrl,
  },
};

export const viewport: Viewport = {
  themeColor: '#211c18',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${sans.variable} ${display.variable} font-sans`}>
        {children}
      </body>
    </html>
  );
}
