'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  adminLogoutLocal,
  adminMe,
  getAdminAccessToken,
  getStoredAdminUser,
  type AdminUser,
} from '@/lib/admin-api';

const NAV = [
  { href: '/admin', label: 'Dashboard', exact: true },
  { href: '/admin/pedidos', label: 'Pedidos' },
  { href: '/admin/pacotes', label: 'Pacotes' },
  { href: '/admin/ia', label: 'Inteligência artificial' },
  { href: '/admin/configuracoes', label: 'Configurações' },
];

type AuthStatus = 'checking' | 'authed' | 'guest';

/**
 * Gate de auth do painel: nunca renderiza menu/conteúdo admin sem sessão válida.
 * Evita flash de UI em /admin antes do redirect para login.
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === '/admin/login';
  const [status, setStatus] = useState<AuthStatus>('checking');
  const [user, setUser] = useState<AdminUser | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function verify() {
      const token = getAdminAccessToken();
      const stored = getStoredAdminUser();

      if (isLogin) {
        // Já autenticado → não fica na tela de login
        if (token && stored) {
          try {
            const me = await adminMe();
            if (cancelled) return;
            setUser(me.user);
            setStatus('authed');
            router.replace('/admin');
            return;
          } catch {
            adminLogoutLocal();
          }
        }
        if (!cancelled) setStatus('guest');
        return;
      }

      if (!token || !stored) {
        adminLogoutLocal();
        if (!cancelled) {
          setUser(null);
          setStatus('guest');
          router.replace('/admin/login');
        }
        return;
      }

      try {
        const me = await adminMe();
        if (cancelled) return;
        setUser(me.user);
        setStatus('authed');
      } catch {
        adminLogoutLocal();
        if (!cancelled) {
          setUser(null);
          setStatus('guest');
          router.replace('/admin/login');
        }
      }
    }

    void verify();
    return () => {
      cancelled = true;
    };
  }, [pathname, router, isLogin]);

  // Login: só o formulário, sem shell
  if (isLogin) {
    if (status === 'checking') {
      return <AuthSplash />;
    }
    if (status === 'authed') {
      return <AuthSplash label="Redirecionando…" />;
    }
    return <>{children}</>;
  }

  // Rotas protegidas: zero menu até sessão confirmada na API
  if (status === 'checking') {
    return <AuthSplash />;
  }

  if (status !== 'authed' || !user) {
    return <AuthSplash label="Redirecionando para o login…" />;
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="border-b border-ink-200 bg-ink-950 text-ink-100 lg:min-h-screen lg:border-b-0 lg:border-r lg:border-ink-800">
        <div className="px-5 py-6">
          <Link href="/admin" className="font-display text-xl text-ink-50">
            Visagismo<span className="text-gold-400">.</span> Admin
          </Link>
          <p className="mt-2 truncate text-xs text-ink-400">
            {user.email} · {user.role}
          </p>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-4 lg:flex-col">
          {NAV.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-xl px-3 py-2 text-sm whitespace-nowrap ${
                  active
                    ? 'bg-ink-800 text-gold-400'
                    : 'text-ink-300 hover:bg-ink-900 hover:text-ink-50'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="hidden px-5 pb-6 lg:block">
          <button
            type="button"
            className="text-xs text-ink-400 hover:text-ink-100"
            onClick={() => {
              adminLogoutLocal();
              setUser(null);
              setStatus('guest');
              router.replace('/admin/login');
            }}
          >
            Sair
          </button>
          <Link
            href="/"
            className="mt-3 block text-xs text-ink-500 hover:text-ink-300"
          >
            ← Site público
          </Link>
        </div>
      </aside>
      <div className="section-pad py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </div>
    </div>
  );
}

function AuthSplash({ label = 'Verificando sessão…' }: { label?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-100/60 px-4">
      <p className="text-sm text-ink-500" role="status" aria-live="polite">
        {label}
      </p>
    </div>
  );
}
