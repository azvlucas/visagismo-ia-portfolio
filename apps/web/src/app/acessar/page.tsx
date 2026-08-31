'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { accessOrderByEmailAndCode } from '@/lib/orders-api';

export default function AccessResultPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await accessOrderByEmailAndCode({
        email: email.trim(),
        accessCode: accessCode.trim(),
      });
      const path =
        result.resultPath || `/pedido/${result.order.id}/resultado`;
      router.push(path);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível acessar. Verifique e-mail e código.',
      );
      setBusy(false);
    }
  }

  return (
    <>
      <SiteHeader />
      <main className="section-pad py-12">
        <div className="container-narrow max-w-lg">
          <p className="text-sm text-ink-500">
            <Link href="/" className="hover:text-ink-800">
              Início
            </Link>{' '}
            / Acessar resultado
          </p>
          <h1 className="mt-4 font-display text-3xl font-semibold text-ink-950">
            Acessar meu resultado
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-600">
            Use o e-mail do pedido e o código de 6 dígitos enviado por e-mail
            (também aparece na confirmação do pagamento). Funciona em qualquer
            dispositivo, sem depender do navegador em que você fez o pedido.
          </p>

          <form onSubmit={(e) => void submit(e)} className="card mt-8 space-y-4">
            <label className="block text-sm">
              <span className="mb-1.5 block font-semibold text-ink-800">
                E-mail do pedido
              </span>
              <input
                type="email"
                className="input"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={busy}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1.5 block font-semibold text-ink-800">
                Código de acesso (6 dígitos)
              </span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                className="input tracking-[0.3em] font-mono text-lg"
                maxLength={8}
                required
                placeholder="000000"
                value={accessCode}
                onChange={(e) =>
                  setAccessCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                }
                disabled={busy}
              />
            </label>

            {error ? (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              className="btn-primary w-full"
              disabled={busy || accessCode.length !== 6}
            >
              {busy ? 'Verificando…' : 'Abrir resultado'}
            </button>
          </form>

          <p className="mt-6 text-xs leading-relaxed text-ink-500">
            Após várias tentativas inválidas o acesso pode ser temporariamente
            limitado. Em caso de dúvidas, use o canal de suporte ou o link do
            e-mail de entrega.
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
