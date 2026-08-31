'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { mockApprovePayment } from '@/lib/orders-api';

/**
 * Página apenas para ambientes sem Mercado Pago configurado.
 * Em produção com MP_ACCESS_TOKEN, o cliente é redirecionado ao checkout real.
 */
export default function MockPayPage() {
  const params = useParams<{ orderId: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const orderId = params.orderId;
  const preferenceId = search.get('preferenceId');

  async function approve() {
    setBusy(true);
    setError(null);
    try {
      const result = await mockApprovePayment(orderId);
      router.push(
        `/pedido/${orderId}/aguardando?status=success&applied=${encodeURIComponent(result.applied)}`,
      );
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : 'Não foi possível confirmar o pagamento.');
    }
  }

  return (
    <>
      <SiteHeader />
      <main className="section-pad py-16">
        <div className="container-narrow max-w-lg card">
          <p className="text-xs font-semibold uppercase tracking-wide text-gold-600">
            Checkout de teste
          </p>
          <h1 className="mt-2 font-display text-3xl text-ink-950">
            Confirmar pagamento
          </h1>
          <p className="mt-3 text-sm text-ink-600">
            Este ambiente usa um checkout simulado para validar o fluxo. Em
            produção, o pagamento é processado de forma segura pelo Mercado Pago
            (PIX ou cartão).
          </p>
          <dl className="mt-6 space-y-2 rounded-2xl bg-ink-50 p-4 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-500">Pedido</dt>
              <dd className="font-mono text-xs text-ink-900">{orderId}</dd>
            </div>
            {preferenceId ? (
              <div className="flex justify-between gap-4">
                <dt className="text-ink-500">Referência</dt>
                <dd className="max-w-[60%] break-all font-mono text-xs text-ink-900">
                  {preferenceId}
                </dd>
              </div>
            ) : null}
          </dl>
          {error ? (
            <p className="mt-4 text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            className="btn-primary mt-8 w-full"
            disabled={busy}
            onClick={() => void approve()}
          >
            {busy ? 'Confirmando…' : 'Simular pagamento aprovado'}
          </button>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
