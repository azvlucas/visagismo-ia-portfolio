import Link from 'next/link';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import {
  fetchPackageBySlug,
  fetchPackages,
  fetchPublicConfig,
  formatBrl,
} from '@/lib/api';
import { WizardShell } from './wizard-shell';

type Props = {
  searchParams: Promise<{ package?: string }>;
};

export default async function NewOrderPage({ searchParams }: Props) {
  const params = await searchParams;
  const [packages, publicConfig] = await Promise.all([
    fetchPackages(),
    fetchPublicConfig(),
  ]);
  const freeGenerationEnabled = publicConfig.freeGenerationEnabled;
  const slug = params.package;
  // Prefere catálogo ao vivo por slug (IDs reais do banco) em vez de fallback estático
  const live = slug ? await fetchPackageBySlug(slug) : null;
  const selected =
    live ??
    packages.find((p) => p.slug === slug) ??
    packages[0] ??
    null;

  return (
    <>
      <SiteHeader />
      <main className="section-pad py-12">
        <div className="container-narrow max-w-3xl">
          <p className="text-sm text-ink-500">
            <Link href="/" className="hover:text-ink-800">
              Início
            </Link>{' '}
            / Nova análise
          </p>
          <h1 className="mt-4 font-display text-3xl font-semibold text-ink-950 sm:text-4xl">
            Começar minha análise
          </h1>
          <p className="mt-3 text-ink-600">
            Experiência guiada em etapas curtas. Sem senha — usamos apenas o
            e-mail do pedido para entregar o resultado.
          </p>

          {selected ? (
            <div className="card mt-8 border-gold-500/30">
              <p className="text-xs font-semibold uppercase tracking-wide text-gold-600">
                Experiência selecionada
                {freeGenerationEnabled ? ' · gratuita' : ''}
              </p>
              <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-display text-2xl text-ink-950">
                  {selected.name}
                </h2>
                <p className="font-semibold text-ink-900">
                  {freeGenerationEnabled
                    ? 'Grátis'
                    : formatBrl(selected.priceCents)}
                </p>
              </div>
              <p className="mt-2 text-sm text-ink-600">{selected.description}</p>
              <p className="mt-2 text-xs text-ink-500">
                {selected.imageCount} simulações · prazo estimado{' '}
                {selected.estimatedSlaHours}h ·{' '}
                {freeGenerationEnabled
                  ? 'sem cobrança neste período'
                  : 'pagamento único'}
              </p>
              <Link
                href="/#pacotes"
                className="mt-3 inline-block text-xs font-semibold text-gold-600 underline"
              >
                Trocar pacote
              </Link>
            </div>
          ) : null}

          <WizardShell
            packageSlug={selected?.slug ?? 'essencial'}
            packageId={selected?.id ?? ''}
            packageName={selected?.name ?? 'Essencial'}
            freeGenerationEnabled={freeGenerationEnabled}
          />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
