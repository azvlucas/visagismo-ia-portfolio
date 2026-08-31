import Link from 'next/link';
import { siteConfig, supportMailto } from '@/lib/site-config';

export function SiteFooter() {
  const year = new Date().getFullYear();
  const mail = supportMailto();
  const hasCompany =
    Boolean(siteConfig.companyName) || Boolean(siteConfig.companyDocument);

  return (
    <footer className="border-t border-ink-200 bg-ink-950 text-ink-200">
      <div className="container-narrow section-pad grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-1">
          <p className="font-display text-2xl text-ink-50">
            {siteConfig.brandName.replace(/\.$/, '')}
            <span className="text-gold-400">.</span>
          </p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink-300">
            {siteConfig.brandTagline}
          </p>
          {hasCompany ? (
            <div className="mt-4 space-y-1 text-xs text-ink-400">
              {siteConfig.companyName ? (
                <p>{siteConfig.companyName}</p>
              ) : null}
              {siteConfig.companyDocument ? (
                <p>CNPJ {siteConfig.companyDocument}</p>
              ) : null}
              {siteConfig.companyAddress ? (
                <p>{siteConfig.companyAddress}</p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="text-sm">
          <p className="font-semibold text-ink-50">Navegação</p>
          <ul className="mt-3 space-y-2">
            <li>
              <a href="/#pacotes" className="hover:text-gold-400">
                Pacotes
              </a>
            </li>
            <li>
              <a href="/#como-funciona" className="hover:text-gold-400">
                Como funciona
              </a>
            </li>
            <li>
              <a href="/#resultados" className="hover:text-gold-400">
                O que você recebe
              </a>
            </li>
            <li>
              <a href="/#faq" className="hover:text-gold-400">
                FAQ
              </a>
            </li>
            <li>
              <Link href="/acessar" className="hover:text-gold-400">
                Acessar resultado
              </Link>
            </li>
          </ul>
        </div>

        <div className="text-sm">
          <p className="font-semibold text-ink-50">Legal</p>
          <ul className="mt-3 space-y-2">
            <li>
              <Link href="/privacidade" className="hover:text-gold-400">
                Política de Privacidade
              </Link>
            </li>
            <li>
              <Link href="/termos" className="hover:text-gold-400">
                Termos de Uso
              </Link>
            </li>
            <li>
              <Link href="/reembolso" className="hover:text-gold-400">
                Política de Reembolso
              </Link>
            </li>
            <li>
              <Link href="/lgpd" className="hover:text-gold-400">
                Exclusão de dados (LGPD)
              </Link>
            </li>
          </ul>
        </div>

        <div className="text-sm">
          <p className="font-semibold text-ink-50">Atendimento</p>
          {mail && siteConfig.supportEmail ? (
            <a
              href={mail}
              className="mt-3 inline-block text-ink-300 hover:text-gold-400"
            >
              {siteConfig.supportEmail}
            </a>
          ) : (
            <p className="mt-3 text-ink-400">
              Canal de suporte em configuração. Use a página de exclusão de
              dados para solicitações LGPD.
            </p>
          )}
          <p className="mt-6 text-xs leading-relaxed text-ink-400">
            © {year}{' '}
            {siteConfig.companyName || siteConfig.brandName}. Todos os direitos
            reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
