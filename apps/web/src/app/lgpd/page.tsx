'use client';

import Link from 'next/link';
import { useState } from 'react';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';

export default function LgpdRequestPage() {
  const [email, setEmail] = useState('');
  const [orderId, setOrderId] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch('/api/v1/public/data-deletion-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          ...(orderId ? { orderId } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message ?? 'Falha ao enviar pedido');
      }
      setMsg(
        data.message ??
          'Se o e-mail existir em nossa base, enviaremos instruções de confirmação.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SiteHeader />
      <main className="section-pad py-16">
        <div className="container-narrow max-w-lg">
          <p className="text-sm text-ink-500">
            <Link href="/">Início</Link> / LGPD
          </p>
          <h1 className="mt-4 font-display text-3xl font-semibold text-ink-950">
            Exclusão de dados
          </h1>
          <p className="mt-3 text-ink-600">
            Solicite a exclusão das fotos e dados pessoais associados ao e-mail do
            pedido, conforme a LGPD. Dados financeiros mínimos podem ser retidos por
            obrigação legal.
          </p>
          <form onSubmit={submit} className="card mt-8 space-y-4">
            <label className="block text-sm">
              <span className="mb-1.5 block font-semibold">E-mail do pedido</span>
              <input
                className="input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1.5 block font-semibold">
                ID do pedido (opcional)
              </span>
              <input
                className="input"
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                placeholder="UUID do pedido"
              />
            </label>
            {error ? (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
                {error}
              </p>
            ) : null}
            {msg ? (
              <p className="rounded-xl bg-gold-400/15 px-3 py-2 text-sm text-ink-800">
                {msg}
              </p>
            ) : null}
            <button type="submit" className="btn-primary w-full" disabled={busy}>
              {busy ? 'Enviando…' : 'Solicitar exclusão'}
            </button>
          </form>
          <p className="mt-6 text-xs text-ink-500">
            Veja também a{' '}
            <Link href="/privacidade" className="underline">
              Política de Privacidade
            </Link>
            .
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
