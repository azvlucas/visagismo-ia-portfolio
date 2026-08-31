import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import {
  AboutSection,
  ComparisonSection,
  FaqSection,
  FinalCta,
  MethodologySection,
  MobileStickyCta,
  PackagesSection,
  PrivacyHighlightSection,
  ReprocessSection,
  ResultsSection,
  StepsSection,
} from '@/components/landing/sections';
import { Hero } from '@/components/landing/hero';
import { fetchPackages, fetchPublicConfig } from '@/lib/api';
import { getFaqJsonLd } from '@/lib/faq-content';
import { siteConfig } from '@/lib/site-config';

export default async function HomePage() {
  const [packages, publicConfig] = await Promise.all([
    fetchPackages(),
    fetchPublicConfig(),
  ]);
  const freeGenerationEnabled = publicConfig.freeGenerationEnabled;

  const orgJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: siteConfig.companyName || siteConfig.brandName,
    url: siteConfig.siteUrl,
    ...(siteConfig.supportEmail
      ? { email: siteConfig.supportEmail }
      : {}),
    description: siteConfig.brandTagline,
  };

  const serviceJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: siteConfig.brandName,
    description: siteConfig.seo.description,
    provider: {
      '@type': 'Organization',
      name: siteConfig.companyName || siteConfig.brandName,
    },
    areaServed: 'BR',
    serviceType: 'Visagismo online com simulações de imagem',
  };

  const offersJsonLd =
    packages.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: siteConfig.brandName,
          description: siteConfig.seo.description,
          brand: {
            '@type': 'Brand',
            name: siteConfig.brandName,
          },
          offers: packages.map((pkg) => ({
            '@type': 'Offer',
            name: pkg.name,
            price: freeGenerationEnabled
              ? '0.00'
              : (pkg.priceCents / 100).toFixed(2),
            priceCurrency: pkg.currency || 'BRL',
            availability: 'https://schema.org/InStock',
            url: `${siteConfig.siteUrl}/pedido/novo?package=${pkg.slug}`,
          })),
        }
      : null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }}
      />
      {offersJsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(offersJsonLd) }}
        />
      ) : null}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(getFaqJsonLd()),
        }}
      />
      <SiteHeader />
      <main className="pb-mobile-sticky min-w-0">
        {/*
          Cascata RCD (conversão): dor/ICP no hero → contraste vs alternativas
          → prova → caminho curto → decisão de preço → risco → profundidade → FAQ → CTA.
        */}
        <Hero />
        <ComparisonSection />
        <ResultsSection />
        <StepsSection />
        <PackagesSection
          packages={packages}
          freeGenerationEnabled={freeGenerationEnabled}
        />
        <ReprocessSection />
        <PrivacyHighlightSection />
        <MethodologySection />
        <AboutSection />
        <FaqSection />
        <FinalCta />
      </main>
      <MobileStickyCta />
      <SiteFooter />
    </>
  );
}
