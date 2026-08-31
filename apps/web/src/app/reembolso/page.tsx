import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { siteConfig } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'Política de Reembolso',
  description:
    'Condições de reprocessamento, revisão e reembolso do serviço de visagismo online.',
};

export default function RefundPage() {
  const days = siteConfig.reviewWindowDays;
  const limit = siteConfig.freeReprocessLimit;
  const support = siteConfig.supportEmail;

  return (
    <>
      <SiteHeader />
      <main className="section-pad py-16">
        <article className="container-narrow max-w-3xl">
          <p className="text-sm text-ink-500">
            <Link href="/" className="hover:text-ink-800">
              Início
            </Link>{' '}
            / Reembolso
          </p>
          <h1 className="mt-4 font-display text-4xl font-semibold text-ink-950">
            Política de Reembolso e reprocessamento
          </h1>
          <p className="mt-4 text-ink-600">
            Regras objetivas para problemas técnicos, reenvio de fotos e
            reembolso. Documento operacional sujeito a revisão jurídica.
          </p>

          <div className="mt-8 space-y-6 leading-relaxed text-ink-700">
            <section className="card">
              <h2 className="font-display text-xl text-ink-950">
                Fotos recusadas ou de baixa qualidade
              </h2>
              <p className="mt-2">
                Caso suas fotos não atendam aos requisitos, você poderá
                reenviá-las sem custo antes do processamento final, quando o
                sistema ou o suporte indicar essa necessidade.
              </p>
            </section>

            <section className="card">
              <h2 className="font-display text-xl text-ink-950">
                Falha técnica de processamento
              </h2>
              <p className="mt-2">
                Se ocorrer uma falha técnica, realizaremos um novo processamento
                sem cobrança. Limite operacional padrão: {limit} reprocessamento
                {limit === 1 ? '' : 's'} gratuito{limit === 1 ? '' : 's'} por
                pedido, salvo decisão operacional em sentido diverso.
              </p>
            </section>

            <section className="card">
              <h2 className="font-display text-xl text-ink-950">
                Imagens inconsistentes com as fotos enviadas
              </h2>
              <p className="mt-2">
                Se as simulações apresentarem erro técnico evidente de identidade
                (não se trata de preferência de estilo), você pode solicitar
                revisão em até {days} dias após a entrega.
              </p>
            </section>

            <section className="card">
              <h2 className="font-display text-xl text-ink-950">
                Situações elegíveis para reembolso
              </h2>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>
                  Falha técnica definitiva que impeça a entrega do resultado após
                  tentativas de reprocessamento
                </li>
                <li>
                  Cobrança duplicada comprovada para o mesmo pedido
                </li>
                <li>
                  Outras hipóteses exigidas por lei ou determinadas após análise
                  do suporte
                </li>
              </ul>
            </section>

            <section className="card">
              <h2 className="font-display text-xl text-ink-950">
                Situações em que o serviço é considerado entregue
              </h2>
              <p className="mt-2">
                Quando a análise e as simulações previstas no pacote forem
                disponibilizadas (ou quando for comunicada conclusão parcial
                legítima com entrega utilizável), o serviço é considerado
                prestado para fins de retenção e de avaliação de reembolso.
                Discordância de gosto pessoal, isoladamente, não gera reembolso
                automático.
              </p>
            </section>

            <section className="card">
              <h2 className="font-display text-xl text-ink-950">Como solicitar</h2>
              <p className="mt-2">
                Informe o número do pedido e descreva o problema
                {support ? (
                  <>
                    {' '}
                    para{' '}
                    <a
                      href={`mailto:${support}`}
                      className="underline hover:text-ink-950"
                    >
                      {support}
                    </a>
                  </>
                ) : (
                  ' pelo canal de suporte indicado no site'
                )}
                . Solicitações de revisão por erro técnico: até {days} dias após
                a entrega.
              </p>
            </section>
          </div>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
