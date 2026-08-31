'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AdminShell } from '@/components/admin/admin-shell';
import { adminLogin } from '@/lib/admin-api';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await adminLogin(email, password);
      router.replace('/admin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no login');
      setBusy(false);
    }
  }

  return (
    <AdminShell>
      <div className="flex min-h-screen items-center justify-center section-pad">
        <form
          onSubmit={onSubmit}
          className="card w-full max-w-md"
          autoComplete="off"
          method="post"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-gold-600">
            Painel administrativo
          </p>
          <h1 className="mt-2 font-display text-3xl text-ink-950">Entrar</h1>
          <p className="mt-2 text-sm text-ink-600">
            Acesso restrito. Informe suas credenciais de administrador.
          </p>
          <label className="mt-6 block text-sm">
            <span className="mb-1.5 block font-semibold text-ink-800">E-mail</span>
            <input
              className="input"
              type="email"
              name="admin_email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
            />
          </label>
          <label className="mt-4 block text-sm">
            <span className="mb-1.5 block font-semibold text-ink-800">Senha</span>
            <input
              className="input"
              type="password"
              name="admin_password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </label>
          {error ? (
            <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            className="btn-primary mt-6 w-full"
            disabled={busy}
          >
            {busy ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </AdminShell>
  );
}
