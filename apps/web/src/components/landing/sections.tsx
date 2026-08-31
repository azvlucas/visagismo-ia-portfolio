'use client';

import Link from 'next/link';
import type { PublicPackage } from '@/lib/api';
import { formatBrl } from '@/lib/api';
import { trackEvent } from '@/lib/analytics';
import { buildFaqItems } from '@/lib/faq-content';
import {
  analysisModeDescription,
  analysisModeLabel,
  siteConfig,
} from '@/lib/site-config';

/* ─────────────────────────────────────────────
   Mais do que gerar uma imagem
   ───────────────────────────────────────────── */

const METHOD_FACTORS = [
  'Formato e proporções do rosto',
  'Linhas predominantes',
  'Contraste pessoal',
  'Volume e textura do cabelo',
  'Barba e pelo facial, quando aplicáveis',
  'Rotina e disponibilidade para manutenção',
  'Ambiente profissional ou social',
  'Características que você deseja transmitir',
  'Preferências pessoais',
  'Restrições informadas no questionário',
];

export function MethodologySection() {
  return (
    <section id="metodologia" className="section-pad border-y border-ink-200/70 bg-white/50 py-20">
      <div className="container-narrow">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-gold-600">
            Metodologia
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold text-ink-950 sm:text-4xl">
            Mais do que gerar uma imagem
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-ink-600">
            A proposta não é apenas modificar uma fotografia com inteligência
            artificial. O serviço estrutura uma direção de imagem a partir das
            suas características, objetivos e rotina — e então apresenta
            simulações coerentes com essa direção.
          </p>
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <p className="text-sm font-semibold text-ink-800">
              O que a análise considera
            </p>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {METHOD_FACTORS.map((item) => (
                <li
                  key={item}
                  className="flex gap-2.5 rounded-xl border border-ink-200/80 bg-white/80 px-3.5 py-3 text-sm text-ink-700"
                >
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-500" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="card flex flex-col justify-between bg-ink-950 text-ink-100 lg:col-span-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gold-400">
                Como a análise é feita
              </p>
              <p className="mt-3 font-display text-xl leading-snug text-ink-50">
                {analysisModeLabel()}
              </p>
              <p className="mt-4 text-sm leading-relaxed text-ink-300">
                {analysisModeDescription()}
              </p>
            </div>
            <p className="mt-8 text-xs leading-relaxed text-ink-400">
              As simulações são sugestões estéticas. Elas não substituem a
              avaliação de um cabeleireiro, barbeiro ou profissional de saúde
              capilar.
            </p>
          </div>
        </div>

        <div className="btn-row mt-10">
          <div className="flex flex-col items-start">
            <a
              href="#pacotes"
              className="btn-primary"
              onClick={() =>
                trackEvent('click_cta', { location: 'methodology' })
              }
            >
              Ver pacotes e começar
            </a>
            <p className="mt-2 text-xs text-ink-500">
              ~10–15 min · pagamento único no final
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   Comparativo (solution-aware: trade-offs)
   RCD: “Same competes on price, different on category”
   ───────────────────────────────────────────── */

export function ComparisonSection() {
  return (
    <section id="diferenca" className="section-pad border-y border-ink-200/70 bg-white/50 py-20">
      <div className="container-narrow">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-gold-600">
            Por que não é só mais um app de filtro
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold text-ink-950 sm:text-4xl">
            Três caminhos para mudar o visual — só um reduz o risco do erro
          </h2>
          <p className="mt-4 text-ink-600">
            Uma imagem bonita não basta se não for aplicável à sua rotina e à
            percepção que você deseja transmitir. Compare o que costuma
            acontecer em cada opção.
          </p>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          <article className="card border-ink-200/90 bg-ink-100/40">
            <h3 className="font-display text-xl text-ink-800">
              Ir direto ao salão
            </h3>
            <ul className="mt-5 space-y-3 text-sm leading-relaxed text-ink-600">
              {[
                'Decisão sob pressão, no momento',
                'Difícil reverter se o resultado não for o desejado',
                'Depende da leitura do profissional sobre o que você quer',
                'Custo real = tempo + dinheiro + retrabalho',
              ].map((t) => (
                <li key={t} className="flex gap-2.5">
                  <span className="text-ink-400" aria-hidden>
                    —
                  </span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </article>

          <article className="card border-ink-200/90 bg-ink-100/40">
            <h3 className="font-display text-xl text-ink-800">
              Gerador genérico de imagens
            </h3>
            <ul className="mt-5 space-y-3 text-sm leading-relaxed text-ink-600">
              {[
                'Prompt solto → rosto inventado ou pouco fiel',
                'Imagem isolada, sem direção de estilo',
                'Não explica o “porquê” da escolha',
                'Pouco material para o profissional aplicar',
              ].map((t) => (
                <li key={t} className="flex gap-2.5">
                  <span className="text-ink-400" aria-hidden>
                    —
                  </span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </article>

          <article className="card border-gold-500/40 ring-2 ring-gold-400/25">
            <p className="mb-2 w-fit rounded-full bg-gold-400/20 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gold-700">
              Esta plataforma
            </p>
            <h3 className="font-display text-xl text-ink-950">
              Visagismo com simulações no seu rosto
            </h3>
            <ul className="mt-5 space-y-3 text-sm leading-relaxed text-ink-700">
              {[
                'Objetivos e rotina no questionário',
                'Análise a partir das suas fotos',
                'Alternativas coerentes com a imagem desejada',
                'Orientações + briefing para o profissional',
                'Você decide antes de cortar',
              ].map((t) => (
                <li key={t} className="flex gap-2.5">
                  <span className="font-semibold text-gold-600" aria-hidden>
                    ✓
                  </span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </article>
        </div>

        <div className="btn-row mt-10">
          <a
            href="#pacotes"
            className="btn-primary"
            onClick={() =>
              trackEvent('click_cta', { location: 'comparison' })
            }
          >
            Quero reduzir o risco do próximo corte
          </a>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   Entrega (sem casos fictícios / sem fotos inventadas)
   ───────────────────────────────────────────── */

const DELIVERY_ITEMS = [
  {
    id: 'simulations',
    title: 'Simulações no seu rosto',
    text: 'Variações de corte e, quando fizer sentido, barba — geradas a partir das fotos que você envia, não de um modelo genérico.',
  },
  {
    id: 'hair',
    title: 'Direção de cabelo',
    text: 'Recomendações de comprimento, volume, contorno e finalização alinhadas ao que você quer transmitir e à sua rotina de manutenção.',
  },
  {
    id: 'beard',
    title: 'Barba (quando aplicável)',
    text: 'Geometria e comprimento de barba/pelo facial coerentes com o corte — ou orientação para contornos limpos se você não usa barba.',
  },
  {
    id: 'brief',
    title: 'Briefing para o profissional',
    text: 'Texto e orientações para levar ao cabeleireiro ou barbeiro, além do plano de manutenção e o resumo da análise.',
  },
];

export function ResultsSection() {
  return (
    <section id="resultados" className="section-pad py-20">
      <div className="container-narrow">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-gold-600">
            Foco: cabelo e barba
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold text-ink-950 sm:text-4xl">
            O que você recebe
          </h2>
          <p className="mt-4 text-ink-600">
            Entrega objetiva para decidir o próximo corte com mais segurança.
            Não usamos fotos de terceiros nem “antes e depois” inventados —
            o resultado é o seu, gerado a partir do seu pedido.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {DELIVERY_ITEMS.map((item, i) => (
            <article
              key={item.id}
              className="card"
              onClick={() =>
                trackEvent('click_case_study', { case_id: item.id })
              }
            >
              <span className="font-display text-2xl text-gold-500" aria-hidden>
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className="mt-3 font-display text-xl text-ink-950">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-600">
                {item.text}
              </p>
            </article>
          ))}
        </div>

        <div className="btn-row mt-10">
          <div className="flex flex-col items-start">
            <a
              href="#pacotes"
              className="btn-primary"
              onClick={() =>
                trackEvent('click_cta', { location: 'results' })
              }
            >
              Escolher meu pacote
            </a>
            <p className="mt-2 text-xs text-ink-500">
              Preços visíveis · pagamento único · sem assinatura
            </p>
          </div>
          <a href="#como-funciona" className="btn-secondary self-start">
            Ver o passo a passo
          </a>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   Pacotes — GBB / decoy + serial-position nas features
   ───────────────────────────────────────────── */

/** Textos de indicação por slug — benefícios, não tech. */
const PACKAGE_GUIDANCE: Record<
  string,
  {
    forWhom: string;
    mainBenefit: string;
    ctaLabel: string;
    defaultFeatures?: string[];
  }
> = {
  essencial: {
    forWhom: 'Para quem quer uma primeira direção clara antes de decidir.',
    mainBenefit: 'Clareza inicial — ideal se você ainda está explorando o próximo passo.',
    ctaLabel: 'Começar com o Essencial',
    // serial-position: killer first, differentiator last
    defaultFeatures: [
      'Simulações no seu rosto (não um filtro genérico)',
      'Análise de objetivo e imagem',
      'Direção principal recomendada',
      'Orientações resumidas',
      'Acesso por e-mail + código · pagamento único',
    ],
  },
  completo: {
    forWhom:
      'Para quem vai investir no visual e quer comparar opções com segurança.',
    mainBenefit:
      'O equilíbrio ideal: mais simulações e comparação entre direções — a escolha da maioria.',
    ctaLabel: 'Começar com o Completo',
    defaultFeatures: [
      'Mais simulações no seu rosto para comparar',
      'Análise mais completa de imagem e rotina',
      'Comparação entre diferentes direções',
      'Recomendações práticas de corte e barba (quando aplicável)',
      'Relatório detalhado + briefing para o profissional',
      'Acesso por e-mail + código · pagamento único',
    ],
  },
  premium: {
    forWhom:
      'Para quem quer explorar o máximo de possibilidades e material completo.',
    mainBenefit:
      'Âncora de valor: amplitude máxima e material pronto para o salão.',
    ctaLabel: 'Começar com o Premium',
    defaultFeatures: [
      'Maior número de simulações e direções',
      'Relatório completo e recomendações de manutenção',
      'Material para apresentar ao cabeleireiro, barbeiro ou profissional',
      'Acesso por e-mail + código · pagamento único',
    ],
  },
};

function packageGuidance(pkg: PublicPackage) {
  return (
    PACKAGE_GUIDANCE[pkg.slug] ?? {
      forWhom: pkg.description,
      mainBenefit: 'Direção de imagem com simulações e orientações práticas.',
      ctaLabel: `Começar com ${pkg.name}`,
    }
  );
}

/** Prefer features do catálogo; se forem muito técnicas/genéricas, enriquece com guidance. */
function displayFeatures(pkg: PublicPackage): string[] {
  const guide = packageGuidance(pkg);
  const fromCatalog = (pkg.features ?? []).filter(Boolean);
  if (fromCatalog.length >= 3) return fromCatalog;
  return guide.defaultFeatures ?? fromCatalog;
}

export function PackagesSection({
  packages,
  freeGenerationEnabled = false,
}: {
  packages: PublicPackage[];
  freeGenerationEnabled?: boolean;
}) {
  return (
    <section
      id="pacotes"
      className="section-pad border-y border-ink-200/70 bg-ink-100/30 py-20"
      onMouseEnter={() => trackEvent('view_packages')}
    >
      <div className="container-narrow">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-gold-600">
            {freeGenerationEnabled
              ? 'Acesso liberado · geração gratuita'
              : 'Preço como filtro · pagamento único'}
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold text-ink-950 sm:text-4xl">
            Escolha a profundidade da análise
          </h2>
          <p className="mt-4 text-ink-600">
            {freeGenerationEnabled
              ? 'Período com geração gratuita de simulações. Escolha o nível de profundidade e complete o questionário — sem cobrança no checkout.'
              : 'Três níveis (bom → melhor → completo). O do meio costuma ser o equilíbrio entre simulações e detalhe. Sem assinatura — você paga uma vez e recebe o resultado.'}
          </p>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-3 lg:items-stretch">
          {packages.map((pkg) => {
            const guide = packageGuidance(pkg);
            const features = displayFeatures(pkg);
            const promo = freeGenerationEnabled
              ? 'Gratuito agora'
              : pkg.promoText ||
                (pkg.isFeatured ? 'Mais escolhido · melhor equilíbrio' : null);

            return (
              <article
                key={pkg.id}
                className={`card relative flex flex-col ${
                  pkg.isFeatured
                    ? 'border-gold-500/50 shadow-lg ring-2 ring-gold-400/35 lg:-mt-3 lg:mb-3 lg:scale-[1.02]'
                    : ''
                }`}
              >
                {promo ? (
                  <span className="mb-3 w-fit rounded-full bg-gold-400/25 px-3 py-1 text-xs font-semibold text-gold-700">
                    {promo}
                  </span>
                ) : (
                  <span className="mb-3 h-6" aria-hidden />
                )}

                <h3 className="font-display text-2xl text-ink-950">
                  {pkg.name}
                </h3>
                <p className="mt-2 text-sm font-medium leading-relaxed text-ink-800">
                  {guide.forWhom}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-ink-600">
                  {guide.mainBenefit}
                </p>

                <p className="mt-6 font-display text-3xl text-ink-950">
                  {freeGenerationEnabled ? 'Grátis' : formatBrl(pkg.priceCents)}
                </p>
                <p className="mt-1 text-xs font-medium text-ink-600">
                  {freeGenerationEnabled
                    ? 'sem cobrança neste período'
                    : 'pagamento único · sem renovação'}
                </p>
                <p className="mt-0.5 text-xs text-ink-500">
                  {pkg.imageCount} simulações · prazo estimado até{' '}
                  {pkg.estimatedSlaHours}h após{' '}
                  {freeGenerationEnabled ? 'confirmação' : 'pagamento'}
                </p>

                <ul className="mt-5 flex-1 space-y-2.5 text-sm text-ink-700">
                  {features.map((f, i) => {
                    const edge = i === 0 || i === features.length - 1;
                    return (
                      <li
                        key={f}
                        className={`flex gap-2 ${edge ? 'font-medium text-ink-900' : ''}`}
                      >
                        <span className="text-gold-600" aria-hidden>
                          ✓
                        </span>
                        <span>{f}</span>
                      </li>
                    );
                  })}
                </ul>

                <Link
                  href={`/pedido/novo?package=${pkg.slug}`}
                  className={`mt-8 w-full text-center ${
                    pkg.isFeatured ? 'btn-primary' : 'btn-secondary'
                  }`}
                  onClick={() =>
                    trackEvent('click_package', {
                      package_slug: pkg.slug,
                      featured: pkg.isFeatured,
                    })
                  }
                >
                  {freeGenerationEnabled ? 'Começar grátis' : guide.ctaLabel}
                </Link>
                <p className="mt-2 text-center text-[11px] leading-snug text-ink-500">
                  Em seguida: questionário + fotos · ~10–15 min
                </p>
              </article>
            );
          })}
        </div>

        <p className="mt-8 text-center text-xs text-ink-500">
          {freeGenerationEnabled
            ? 'Geração gratuita habilitada pelo administrador. Fotos e consentimentos continuam obrigatórios.'
            : 'O valor exibido é o cobrado no checkout. Em falha técnica, há reprocessamento conforme a política de garantias abaixo.'}
        </p>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   Passo a passo
   ───────────────────────────────────────────── */

/** Caminho curto à ação (RCD: path to action shorter than path to doubt). */
const STEPS = [
  {
    title: 'Escolha o pacote',
    text: 'Defina a profundidade (essencial, completo ou premium). Preço e entregas ficam claros antes de qualquer dado.',
  },
  {
    title: 'Questionário + fotos',
    text: 'Objetivos, rotina e preferências · foto frontal (lateral recomendada). Cerca de 10–15 minutos no total.',
  },
  {
    title: 'Pague uma vez e receba',
    text: 'Pagamento único após revisão. Processamento após confirmação. Resultado por e-mail + código de 6 dígitos em /acessar.',
  },
];

export function StepsSection() {
  return (
    <section id="como-funciona" className="section-pad border-y border-ink-200/70 bg-white/50 py-20">
      <div className="container-narrow">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-gold-600">
            Caminho curto
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold text-ink-950 sm:text-4xl">
            Três passos até a direção do seu visual
          </h2>
          <p className="mt-4 text-ink-600">
            Sem cadastro com senha. Você só avança o que precisa; a geração
            começa após o pagamento confirmado.
          </p>
        </div>
        <ol className="mt-10 grid gap-4 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="card">
              <span className="font-display text-3xl text-gold-500" aria-hidden>
                {i + 1}
              </span>
              <h3 className="mt-3 font-display text-lg text-ink-950">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-600">
                {step.text}
              </p>
            </li>
          ))}
        </ol>
        <div className="btn-row mt-10">
          <a
            href="#pacotes"
            className="btn-primary"
            onClick={() => trackEvent('click_cta', { location: 'steps' })}
          >
            Ver pacotes agora
          </a>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   Privacidade (acessível)
   ───────────────────────────────────────────── */

export function PrivacyHighlightSection() {
  const daysOrig = siteConfig.retentionOriginalsDays;
  const daysGen = siteConfig.retentionGeneratedDays;

  const items = [
    {
      q: 'Para que as fotos são usadas?',
      a: 'Exclusivamente para gerar a sua análise e as suas simulações.',
    },
    {
      q: 'Onde ficam armazenadas?',
      a: 'Em armazenamento privado, acessível apenas no contexto do seu pedido e por sistemas necessários ao processamento.',
    },
    {
      q: 'Por quanto tempo?',
      a: `Fotos originais por cerca de ${daysOrig} dias; simulações geradas por cerca de ${daysGen} dias, salvo solicitação de exclusão anterior ou obrigação legal.`,
    },
    {
      q: 'Quem pode acessar?',
      a: 'Você (via e-mail + código de 6 dígitos em /acessar, ou sessão do pedido no navegador), sistemas automatizados de processamento e, se necessário, a equipe de suporte para resolver problemas.',
    },
    {
      q: 'São usadas para treinar modelos?',
      a: 'Não utilizamos suas imagens para treinar modelos sem a sua autorização expressa.',
    },
    {
      q: 'Como solicitar exclusão?',
      a: 'Pelo canal de exclusão de dados (LGPD) no site ou pelo suporte, quando configurado.',
    },
  ];

  return (
    <section id="privacidade" className="section-pad py-20">
      <div className="container-narrow">
        <div className="max-w-2xl">
          <h2 className="font-display text-3xl font-semibold text-ink-950 sm:text-4xl">
            Suas fotos com responsabilidade
          </h2>
          <p className="mt-4 text-ink-600">
            Enviar fotos pessoais exige clareza. Veja, em linguagem direta, como
            tratamos as suas imagens.
          </p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <article key={item.q} className="card">
              <h3 className="font-semibold text-ink-900">{item.q}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-600">
                {item.a}
              </p>
            </article>
          ))}
        </div>
        <p className="mt-6 text-sm text-ink-500">
          Detalhes completos na{' '}
          <Link href="/privacidade" className="underline hover:text-ink-800">
            Política de Privacidade
          </Link>
          .
        </p>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   Reprocessamento / problemas
   ───────────────────────────────────────────── */

export function ReprocessSection() {
  const days = siteConfig.reviewWindowDays;
  const limit = siteConfig.freeReprocessLimit;

  return (
    <section id="garantias" className="section-pad py-20">
      <div className="container-narrow max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wider text-gold-600">
          Redução de risco
        </p>
        <h2 className="mt-3 font-display text-3xl font-semibold text-ink-950 sm:text-4xl">
          Se algo der errado, as regras são claras
        </h2>
        <p className="mt-4 text-ink-600">
          Políticas objetivas para fotos, falhas técnicas e reprocessamento —
          sem linguagem vaga.
        </p>
        <ul className="mt-8 space-y-4 text-sm leading-relaxed text-ink-700">
          <li className="card">
            <strong className="text-ink-900">Fotos com baixa qualidade.</strong>{' '}
            Se as fotos não atenderem aos requisitos mínimos, você poderá
            reenviá-las sem custo antes do processamento final, quando o sistema
            indicar essa necessidade.
          </li>
          <li className="card">
            <strong className="text-ink-900">Falha técnica.</strong> Se ocorrer
            uma falha no processamento, realizamos um novo processamento sem
            cobrança adicional, dentro do limite de {limit} reprocessamento
            {limit === 1 ? '' : 's'} gratuito{limit === 1 ? '' : 's'} por pedido
            (salvo ajuste operacional).
          </li>
          <li className="card">
            <strong className="text-ink-900">Imagens que não representam você.</strong>{' '}
            Quando houver erro técnico evidente de identidade visual (por
            exemplo, simulação claramente inconsistente com as fotos enviadas),
            você pode solicitar revisão em até {days} dias após a entrega.
          </li>
          <li className="card">
            <strong className="text-ink-900">Reembolso.</strong> Situações
            elegíveis e prazos estão descritos na{' '}
            <Link href="/reembolso" className="underline hover:text-ink-950">
              Política de Reembolso
            </Link>{' '}
            e nos{' '}
            <Link href="/termos" className="underline hover:text-ink-950">
              Termos de Uso
            </Link>
            . Preferência de gosto pessoal, por si só, não caracteriza falha de
            entrega quando o serviço foi processado conforme o pacote.
          </li>
          <li className="card">
            <strong className="text-ink-900">Serviço considerado entregue.</strong>{' '}
            Quando o resultado do pacote for disponibilizado (análise e
            simulações previstas, ou comunicação formal de conclusão/parcial
            conforme o caso), o pedido entra no prazo de retenção e de eventual
            revisão.
          </li>
        </ul>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   Institucional
   ───────────────────────────────────────────── */

export function AboutSection() {
  return (
    <section id="sobre" className="section-pad py-20">
      <div className="container-narrow grid gap-10 lg:grid-cols-2 lg:items-start">
        <div>
          <h2 className="font-display text-3xl font-semibold text-ink-950 sm:text-4xl">
            Um serviço estruturado de imagem pessoal
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-ink-600">
            {siteConfig.brandName} existe para ajudar pessoas a tomarem decisões
            de visual com mais clareza — alinhando aparência, personalidade e a
            percepção que desejam transmitir.
          </p>
          <p className="mt-4 leading-relaxed text-ink-600">
            A metodologia combina questionário guiado, critérios de visagismo e
            geração assistida por inteligência artificial. A tecnologia é um
            meio: o foco é aplicabilidade prática e direção de imagem, não
            apenas um filtro estético.
          </p>
        </div>
        <div className="space-y-4">
          <article className="card">
            <h3 className="font-semibold text-ink-900">Limitações da IA</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-600">
              Simulações são aproximações estéticas. Podem variar com iluminação,
              ângulo das fotos e limites dos modelos. Não garantem percepção
              social nem resultado idêntico no salão.
            </p>
          </article>
          <article className="card">
            <h3 className="font-semibold text-ink-900">
              Quando consultar um profissional presencial
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-600">
              Saúde capilar, dermatológica ou procedimentos que envolvam risco
              devem ser avaliados por profissionais habilitados. Use o material
              entregue como referência de estilo, não como laudo clínico.
            </p>
          </article>
          <article className="card">
            <h3 className="font-semibold text-ink-900">Transparência</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-600">
              {analysisModeDescription()} Não prometemos transformação absoluta
              nem resultados milagrosos — prometemos um processo claro e uma
              entrega alinhada ao pacote escolhido.
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   FAQ
   ───────────────────────────────────────────── */

export function FaqSection() {
  const faq = buildFaqItems();

  return (
    <section id="faq" className="border-y border-ink-200/70 bg-white/50 py-20">
      <div className="container-narrow section-pad max-w-3xl">
        <h2 className="font-display text-3xl font-semibold text-ink-950 sm:text-4xl">
          Perguntas frequentes
        </h2>
        <div className="mt-8 space-y-3">
          {faq.map((item) => (
            <details
              key={item.q}
              className="card group open:shadow-md"
              onToggle={(e) => {
                if ((e.target as HTMLDetailsElement).open) {
                  trackEvent('open_faq', { question: item.q.slice(0, 80) });
                }
              }}
            >
              <summary className="cursor-pointer list-none font-semibold text-ink-900 marker:content-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500">
                <span className="flex items-start justify-between gap-3">
                  {item.q}
                  <span className="text-ink-400 group-open:rotate-45" aria-hidden>
                    +
                  </span>
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-ink-600">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   CTA final
   ───────────────────────────────────────────── */

export function FinalCta() {
  return (
    <section className="section-pad py-20">
      <div className="container-narrow overflow-hidden rounded-[2rem] bg-ink-950 px-8 py-14 text-center text-ink-50 sm:px-16">
        <h2 className="font-display text-3xl font-semibold sm:text-4xl">
          Decida o visual no seu tempo — não no salão sob pressão
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-ink-300">
          Escolha o pacote, complete questionário e fotos em ~10–15 min, pague
          uma vez e receba simulações + orientações no seu rosto.
        </p>
        <a
          href="#pacotes"
          className="btn-primary mt-8 w-full max-w-md bg-gold-500 text-ink-950 hover:bg-gold-400 sm:w-auto"
          onClick={() => trackEvent('click_cta', { location: 'final' })}
        >
          Ver pacotes e começar
        </a>
        <p className="mx-auto mt-3 max-w-md text-xs text-ink-400">
          Pagamento único · sem assinatura · acesso por e-mail + código
        </p>
        <p className="mx-auto mt-10 max-w-2xl text-xs leading-relaxed text-ink-400">
          Usamos suas fotos exclusivamente para gerar a sua análise e
          simulações. Armazenamento privado e opção de solicitar exclusão.{' '}
          <Link href="/privacidade" className="underline hover:text-gold-400">
            Privacidade
          </Link>
          {' · '}
          <Link href="/termos" className="underline hover:text-gold-400">
            Termos
          </Link>
          {' · '}
          <Link href="/reembolso" className="underline hover:text-gold-400">
            Reembolso
          </Link>
          .
        </p>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   CTA fixo mobile — ação dominante (contraste)
   ───────────────────────────────────────────── */

export function MobileStickyCta() {
  return (
    <div className="mobile-sticky-cta fixed inset-x-0 bottom-0 z-30 border-t border-ink-200/80 bg-ink-50/95 px-3 pt-2.5 backdrop-blur-md md:hidden">
      <a
        href="#pacotes"
        className="btn-primary w-full"
        onClick={() =>
          trackEvent('click_cta', { location: 'mobile_sticky' })
        }
      >
        Ver pacotes e começar
      </a>
      <p className="pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1 text-center text-[10px] text-ink-500">
        ~10–15 min · pagamento único
      </p>
    </div>
  );
}


