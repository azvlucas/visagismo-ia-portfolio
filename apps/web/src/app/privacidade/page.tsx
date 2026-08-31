import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { siteConfig } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'Política de Privacidade',
  description:
    'Como tratamos seus dados pessoais e fotografias no serviço de visagismo online.',
};

export default function PrivacyPage() {
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
            / Privacidade
          </p>
          <h1 className="mt-4 font-display text-4xl font-semibold text-ink-950">
            Política de Privacidade
          </h1>
          <p className="mt-4 text-ink-600">
            Esta política explica, em linguagem acessível, como o{' '}
            {siteConfig.brandName} trata dados pessoais e imagens. Conteúdo
            operacional sujeito a revisão jurídica contínua.
          </p>

          <h2 className="mt-10 font-display text-2xl text-ink-950">
            Dados que coletamos
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-ink-700">
            <li>Nome e e-mail informados no pedido</li>
            <li>Respostas do questionário de visagismo</li>
            <li>Fotografias enviadas para análise e simulação</li>
            <li>
              Dados de pagamento processados pelo Mercado Pago (não armazenamos
              números de cartão)
            </li>
            <li>Logs técnicos e métricas de funil necessárias à operação</li>
          </ul>

          <h2 className="mt-10 font-display text-2xl text-ink-950">
            Finalidade
          </h2>
          <p className="mt-3 leading-relaxed text-ink-700">
            Prestação do serviço de análise de imagem e geração de simulações;
            comunicação do resultado; prevenção a fraude; cumprimento de
            obrigações legais; e melhoria operacional do serviço sem uso indevido
            das suas fotos.
          </p>

          <h2 className="mt-10 font-display text-2xl text-ink-950">
            Uso das fotos
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-ink-700">
            <li>
              Suas fotos são utilizadas exclusivamente para gerar a sua análise
              e as suas simulações.
            </li>
            <li>
              Não utilizamos suas imagens para treinar modelos sem a sua
              autorização expressa.
            </li>
            <li>
              As imagens ficam em armazenamento privado e são exibidas mediante
              sessão do pedido (obtida com e-mail + código de acesso).
            </li>
          </ul>

          <h2 className="mt-10 font-display text-2xl text-ink-950">
            Retenção
          </h2>
          <p className="mt-3 leading-relaxed text-ink-700">
            Em regra operacional: fotos originais por cerca de{' '}
            {siteConfig.retentionOriginalsDays} dias e simulações geradas por
            cerca de {siteConfig.retentionGeneratedDays} dias, salvo solicitação
            de exclusão anterior ou necessidade legal de conservação de registros
            mínimos.
          </p>

          <h2 className="mt-10 font-display text-2xl text-ink-950">
            Quem pode acessar
          </h2>
          <p className="mt-3 leading-relaxed text-ink-700">
            Você (via acesso ao pedido), sistemas automatizados de processamento
            e, quando necessário para suporte ou segurança, a equipe responsável
            pela plataforma.
          </p>

          <h2 className="mt-10 font-display text-2xl text-ink-950">
            Fornecedores que podem processar dados
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-ink-700">
            <li>Infraestrutura de hospedagem</li>
            <li>Armazenamento de objetos (ex.: Cloudflare R2)</li>
            <li>Mercado Pago (pagamentos)</li>
            <li>Provedor de e-mail transacional (ex.: Resend)</li>
            <li>Provedores de IA de imagem e texto, conforme o pacote</li>
            <li>Ferramenta de erros (ex.: Sentry), se habilitada</li>
          </ul>

          <h2 className="mt-10 font-display text-2xl text-ink-950">
            Exclusão e direitos (LGPD)
          </h2>
          <p className="mt-3 leading-relaxed text-ink-700">
            Você pode solicitar a exclusão dos seus dados e imagens pelo{' '}
            <Link href="/lgpd" className="underline hover:text-ink-950">
              canal de exclusão de dados
            </Link>
            {support ? (
              <>
                {' '}
                ou pelo e-mail{' '}
                <a
                  href={`mailto:${support}`}
                  className="underline hover:text-ink-950"
                >
                  {support}
                </a>
              </>
            ) : null}
            . Após a confirmação do pedido de exclusão, o processamento segue os
            prazos operacionais e legais aplicáveis.
          </p>

          <h2 className="mt-10 font-display text-2xl text-ink-950">
            Contato
          </h2>
          <p className="mt-3 leading-relaxed text-ink-700">
            {support
              ? `Dúvidas sobre privacidade: ${support}.`
              : 'O canal de suporte será exibido quando configurado pela operação.'}
          </p>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
