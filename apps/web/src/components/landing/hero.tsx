'use client';

import { trackEvent } from '@/lib/analytics';

/**
 * RCD (revenue-centric-design):
 * - 5-second test: lead with the problem, not the product category
 * - Specificity over “complete platform” fluff
 * - CTA microcopy answers: what happens / effort / commitment
 * - Click trigger under CTA reduces risk
 * - Trust filters for ICP self-selection (not generic badges)
 */
const TRUST = [
  'Pagamento único · sem assinatura',
  'Simulações no seu rosto (não um filtro genérico)',
  'Orientações para aplicar no salão',
  'Acesso por e-mail + código em qualquer dispositivo',
  'Fotos privadas · sem treinar modelos com as suas',
];

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-gold-400/15 via-transparent to-transparent"
        aria-hidden
      />
      <div className="container-narrow section-pad grid items-center gap-12 py-16 lg:grid-cols-12 lg:gap-16 lg:py-24">
        <div className="lg:col-span-7">
          <p className="mb-5 inline-flex rounded-full border border-gold-500/25 bg-gold-400/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-gold-600">
            Para quem vai mudar o visual e não quer errar o próximo corte
          </p>
          <h1 className="font-display text-4xl font-semibold leading-[1.12] tracking-tight text-ink-950 sm:text-5xl lg:text-[3.15rem]">
            Cansado de sair do salão e sentir que o visual não é você?
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-600">
            Antes de cortar, colorir ou mudar a barba, veja no{' '}
            <strong className="font-semibold text-ink-800">seu rosto</strong>{' '}
            direções de cabelo e, se fizer sentido, barba — alinhadas ao que
            você quer transmitir, com orientações práticas para o cabeleireiro
            ou barbeiro.
          </p>
          <div className="btn-row mt-9">
            <div className="flex w-full max-w-md flex-col items-stretch sm:w-auto">
              <a
                href="#pacotes"
                className="btn-primary"
                onClick={() =>
                  trackEvent('click_cta', { location: 'hero', cta: 'primary' })
                }
              >
                Ver pacotes e começar a análise
              </a>
              <p className="mt-2 text-center text-xs leading-snug text-ink-500 sm:text-left">
                Questionário + fotos · ~10–15 min · pagamento único no final
              </p>
            </div>
            <a
              href="#resultados"
              className="btn-secondary self-start"
              onClick={() =>
                trackEvent('click_cta', {
                  location: 'hero',
                  cta: 'secondary_results',
                })
              }
            >
              Ver exemplos de entrega
            </a>
          </div>
          <ul className="mt-8 grid grid-cols-1 gap-2 text-sm text-ink-500 xs:grid-cols-2 sm:flex sm:flex-wrap sm:gap-x-5 sm:gap-y-2">
            {TRUST.map((item) => (
              <li key={item} className="flex min-w-0 items-center gap-2">
                <span
                  className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-gold-500"
                  aria-hidden
                />
                <span className="leading-snug">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative lg:col-span-5">
          <div className="card space-y-5 bg-gradient-to-br from-white to-ink-100/60 ring-1 ring-gold-400/20">
            <p className="text-xs font-semibold uppercase tracking-wider text-gold-600">
              O que você leva (não é só uma imagem)
            </p>
            <ul className="space-y-4">
              {[
                {
                  t: 'Direção de imagem clara',
                  d: 'O que reforça autoridade, confiança, elegância ou naturalidade no seu caso.',
                },
                {
                  t: 'Simulações do seu rosto',
                  d: 'Cortes e barba (quando aplicável) no seu rosto, antes de ir ao cabeleireiro ou barbeiro.',
                },
                {
                  t: 'Briefing para o profissional',
                  d: 'Texto e orientações prontos para o salão — menos retrabalho e menos surpresa.',
                },
              ].map((item) => (
                <li
                  key={item.t}
                  className="border-l-2 border-gold-500/50 pl-4"
                >
                  <p className="font-display text-lg leading-snug text-ink-900">
                    {item.t}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-ink-600">
                    {item.d}
                  </p>
                </li>
              ))}
            </ul>
            <p className="border-t border-ink-200/80 pt-4 text-xs leading-relaxed text-ink-500">
              Foco em cabelo e barba. Diferente de geradores genéricos: a
              análise parte das suas fotos, objetivos e rotina.
            </p>
          </div>
          <div
            className="absolute -bottom-4 -right-4 -z-10 h-40 w-40 rounded-full bg-gold-400/15 blur-3xl"
            aria-hidden
          />
        </div>
      </div>
    </section>
  );
}
