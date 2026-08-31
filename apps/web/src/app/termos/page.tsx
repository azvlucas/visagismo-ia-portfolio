import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import {
  analysisModeDescription,
  siteConfig,
} from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'Termos de Uso',
  description: `Termos de uso do serviço ${siteConfig.brandName}.`,
};

export default function TermsPage() {
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
            / Termos
          </p>
          <h1 className="mt-4 font-display text-4xl font-semibold text-ink-950">
            Termos de Uso
          </h1>
          <p className="mt-4 text-ink-600">
            Documento operacional do {siteConfig.brandName}. Sujeito a revisão
            jurídica. Ao concluir o pedido, você declara ter lido e aceito estes
            termos e a Política de Privacidade.
          </p>

          <div className="mt-8 space-y-6 leading-relaxed text-ink-700">
            <section>
              <h2 className="font-display text-xl text-ink-950">1. Serviço</h2>
              <p className="mt-2">
                Oferecemos análise de imagem pessoal e simulações estéticas com
                base nas informações e fotos fornecidas por você.{' '}
                {analysisModeDescription()}
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl text-ink-950">
                2. Natureza das recomendações
              </h2>
              <p className="mt-2">
                As recomendações e simulações são sugestões estéticas. Não
                constituem garantia de percepção social, resultado profissional
                idêntico no salão, nem aconselhamento médico, dermatológico ou
                capilar.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl text-ink-950">
                3. Acesso e conta
              </h2>
              <p className="mt-2">
                O acesso ao resultado é feito por e-mail e link/sessão seguros,
                sem obrigatoriedade de criar conta com senha. Você é responsável
                por manter a confidencialidade do link recebido.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl text-ink-950">
                4. Pagamento e entrega
              </h2>
              <p className="mt-2">
                O pagamento é único por pedido, processado por meio do Mercado
                Pago. O processamento da análise inicia após a confirmação do
                pagamento. O prazo estimado consta no pacote escolhido.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl text-ink-950">
                5. Reprocessamento e reembolso
              </h2>
              <p className="mt-2">
                Em falhas técnicas, poderemos reprocessar o pedido sem cobrança
                adicional, conforme limites operacionais. Condições de reembolso
                estão na{' '}
                <Link href="/reembolso" className="underline hover:text-ink-950">
                  Política de Reembolso
                </Link>
                . Preferência de gosto pessoal, isoladamente, não caracteriza
                falha de entrega quando o serviço foi processado conforme o
                pacote.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl text-ink-950">
                6. Fotos e condutas
              </h2>
              <p className="mt-2">
                Você declara ter direitos sobre as imagens enviadas e ser maior
                de 18 anos. É proibido enviar conteúdo ilegal, de terceiros sem
                autorização ou de menores.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl text-ink-950">7. Contato</h2>
              <p className="mt-2">
                {support
                  ? `Suporte: ${support}.`
                  : 'O canal de suporte será informado no site quando configurado.'}
              </p>
            </section>
          </div>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
