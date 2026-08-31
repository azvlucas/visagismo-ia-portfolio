'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';

function ConfirmInner() {
  const search = useSearchParams();
  const id = search.get('id') ?? '';
  const token = search.get('token') ?? '';
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!id || !token) {
      setStatus('error');
      setMessage('Link inválido.');
      return;
    }
    void (async () => {
      try {
        const res = await fetch('/api/v1/public/data-deletion-requests/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, token }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error?.message ?? 'Falha na confirmação');
        }
        setStatus('ok');
        setMessage(
          data.message ?? 'Exclusão confirmada e processada.',
        );
      } catch (err) {
        setStatus('error');
        setMessage(err instanceof Error ? err.message : 'Erro');
      }
    })();
  }, [id, token]);

  return (
    <div className="card mt-8">
      {status === 'loading' ? (
        <p className="text-ink-600">Confirmando…</p>
      ) : (
        <p
          className={
            status === 'ok' ? 'text-ink-800' : 'text-red-800'
          }
        >
          {message}
        </p>
      )}
    </div>
  );
}

export default function LgpdConfirmPage() {
  return (
    <>
      <SiteHeader />
      <main className="section-pad py-16">
        <div className="container-narrow max-w-lg">
          <h1 className="font-display text-3xl font-semibold text-ink-950">
            Confirmação LGPD
          </h1>
          <Suspense fallback={<p className="mt-6">Carregando…</p>}>
            <ConfirmInner />
          </Suspense>
          <Link href="/" className="btn-primary mt-8 inline-flex">
            Voltar ao início
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
