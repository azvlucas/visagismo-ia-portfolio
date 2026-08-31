'use client';

import Link from 'next/link';
import { trackEvent } from '@/lib/analytics';
import { siteConfig } from '@/lib/site-config';

const brandShort = siteConfig.brandName.replace(/\s*Online\s*$/i, '').trim();

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-ink-200/60 bg-ink-50/85 backdrop-blur-md">
      <div className="container-narrow section-pad flex h-14 min-w-0 items-center justify-between gap-2 sm:h-16 sm:gap-3">
        <Link
          href="/"
          className="min-w-0 shrink font-display text-lg font-semibold tracking-tight text-ink-950 sm:text-xl"
        >
          <span className="truncate">{brandShort || 'Visagismo'}</span>
          <span className="text-gold-600">.</span>
        </Link>
        <nav
          className="hidden items-center gap-7 text-sm text-ink-700 lg:flex"
          aria-label="Principal"
        >
          <a href="/#diferenca" className="hover:text-ink-950">
            Por quê
          </a>
          <a href="/#resultados" className="hover:text-ink-950">
            O que você recebe
          </a>
          <a href="/#como-funciona" className="hover:text-ink-950">
            Como funciona
          </a>
          <a href="/#pacotes" className="hover:text-ink-950">
            Pacotes
          </a>
          <a href="/#garantias" className="hover:text-ink-950">
            Garantias
          </a>
          <a href="/#faq" className="hover:text-ink-950">
            FAQ
          </a>
        </nav>
        <div className="flex min-w-0 shrink-0 items-center">
          <a
            href="/#pacotes"
            className="btn-primary px-3 py-2 text-xs sm:px-4 sm:text-sm"
            onClick={() =>
              trackEvent('click_cta', { location: 'header', cta: 'primary' })
            }
          >
            <span className="sm:hidden">Ver pacotes</span>
            <span className="hidden sm:inline">Ver pacotes</span>
          </a>
        </div>
      </div>
    </header>
  );
}
