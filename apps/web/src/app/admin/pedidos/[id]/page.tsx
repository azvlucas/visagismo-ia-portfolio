'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin/admin-shell';
import {
  adminApprovePayment,
  adminCancelOrder,
  adminGetOrder,
  adminReprocessOrder,
  formatBrl,
} from '@/lib/admin-api';

export default function AdminOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await adminGetOrder(id);
      setData(res);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const order = data?.order as
    | {
        id: string;
        orderNumber: string;
        status: string;
        statusLabel: string;
        customerName: string;
        customerEmail: string;
        paidAt: string | null;
        createdAt: string;
      }
    | undefined;

  const pkg = data?.package as
    | { name: string; slug: string; priceCents: number }
    | undefined;

  const photos =
    (data?.photos as Array<{
      id: string;
      type?: string;
      mime?: string;
      bytes?: number;
      width?: number | null;
      height?: number | null;
      confirmed?: boolean;
      url?: string | null;
    }>) ?? [];
  const payments = (data?.payments as Array<Record<string, unknown>>) ?? [];
  const result = data?.result as
    | {
        summary?: string;
        perceptionAnalysis?: string;
        hairRecommendations?: string;
        beardRecommendations?: string;
        makeupRecommendations?: string;
        accessoriesRecommendations?: string;
        maintenancePlan?: string;
        salonBrief?: string;
        analysisSource?: string;
        imageCount?: number;
        images?: Array<{
          id: string;
          caption?: string;
          url?: string | null;
          styleVariationKey?: string;
        }>;
      }
    | null;

  async function reprocess() {
    setBusy(true);
    setNote(null);
    try {
      await adminReprocessOrder(id);
      setNote('Reprocessamento disparado.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!confirm('Cancelar este pedido?')) return;
    setBusy(true);
    setNote(null);
    try {
      await adminCancelOrder(id);
      setNote('Pedido cancelado.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    } finally {
      setBusy(false);
    }
  }

  async function approvePayment() {
    const canApprove =
      order?.status === 'awaiting_payment' ||
      order?.status === 'payment_pending';
    if (!canApprove) {
      setError(
        'Só é possível aprovar pagamento em pedidos aguardando ou com pagamento pendente.',
      );
      return;
    }
    const note =
      window.prompt(
        'Confirmar pagamento manualmente?\n\nOpcional: ID do pagamento no gateway ou nota (ex.: extrato MP).',
        '',
      ) ?? null;
    if (note === null) return; // cancelou o prompt
    setBusy(true);
    setNote(null);
    setError(null);
    try {
      const trimmed = note.trim();
      const looksLikeId = /^[a-zA-Z0-9_-]{6,}$/.test(trimmed);
      await adminApprovePayment(id, {
        note: trimmed || undefined,
        externalPaymentId: looksLikeId ? trimmed : undefined,
      });
      setNote(
        'Pagamento aprovado manualmente. Geração enfileirada (status enfileirado).',
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    } finally {
      setBusy(false);
    }
  }

  const canApprovePayment =
    order?.status === 'awaiting_payment' ||
    order?.status === 'payment_pending';

  return (
    <AdminShell>
      <p className="text-sm text-ink-500">
        <Link href="/admin/pedidos" className="hover:text-ink-800">
          Pedidos
        </Link>{' '}
        / detalhe
      </p>
      <h1 className="mt-2 font-display text-3xl font-semibold text-ink-950">
        {order?.orderNumber ?? 'Pedido'}
      </h1>

      {error ? (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      {note ? (
        <p className="mt-4 rounded-xl bg-gold-400/15 px-4 py-3 text-sm text-ink-800">
          {note}
        </p>
      ) : null}

      {order ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="card space-y-2 text-sm">
            <h2 className="font-display text-xl text-ink-950">Cliente</h2>
            <p>
              <span className="text-ink-500">Nome:</span> {order.customerName}
            </p>
            <p>
              <span className="text-ink-500">E-mail:</span> {order.customerEmail}
            </p>
            <p>
              <span className="text-ink-500">Status:</span> {order.statusLabel}{' '}
              <span className="font-mono text-xs">({order.status})</span>
            </p>
            <p>
              <span className="text-ink-500">Pago em:</span>{' '}
              {order.paidAt
                ? new Date(order.paidAt).toLocaleString('pt-BR')
                : '—'}
            </p>
            <p>
              <span className="text-ink-500">Criado:</span>{' '}
              {new Date(order.createdAt).toLocaleString('pt-BR')}
            </p>
          </div>

          <div className="card space-y-2 text-sm">
            <h2 className="font-display text-xl text-ink-950">Pacote</h2>
            <p>
              {pkg?.name} ({pkg?.slug})
            </p>
            <p>{formatBrl(pkg?.priceCents ?? 0)}</p>
            <p>
              <span className="text-ink-500">Fotos confirmadas:</span>{' '}
              {photos.filter((p) => p.confirmed).length}
            </p>
            <p>
              <span className="text-ink-500">Resultado:</span>{' '}
              {result
                ? `${result.imageCount ?? result.images?.length ?? 0} imgs · ${String(result.analysisSource ?? '—')}`
                : '—'}
            </p>
            <div className="flex flex-wrap gap-2 pt-3">
              <Link
                href={`/pedido/${order.id}/resultado`}
                className="btn-secondary px-4 py-2 text-sm"
              >
                Abrir resultado (com sessão admin)
              </Link>
              {canApprovePayment ? (
                <button
                  type="button"
                  className="btn-primary px-4 py-2 text-sm"
                  disabled={busy}
                  onClick={() => void approvePayment()}
                  title="Use quando o pagamento foi confirmado fora do webhook (falha de gateway)"
                >
                  Aprovar pagamento
                </button>
              ) : null}
              <button
                type="button"
                className="btn-primary px-4 py-2 text-sm"
                disabled={busy}
                onClick={() => void reprocess()}
              >
                Reprocessar
              </button>
              <button
                type="button"
                className="btn-secondary px-4 py-2 text-sm"
                disabled={busy}
                onClick={() => void cancel()}
              >
                Cancelar
              </button>
            </div>
            {canApprovePayment ? (
              <p className="pt-1 text-xs leading-relaxed text-ink-500">
                <strong className="font-semibold text-ink-700">
                  Aprovar pagamento
                </strong>{' '}
                confirma o pedido manualmente (ex.: falha de webhook do Mercado
                Pago) e inicia a geração. Confira o extrato antes.
              </p>
            ) : null}
          </div>

          {photos.length > 0 ? (
            <div className="card space-y-3 lg:col-span-2">
              <h2 className="font-display text-xl text-ink-950">
                Fotos do cliente
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                {photos.map((ph) => (
                  <figure
                    key={ph.id}
                    className="overflow-hidden rounded-2xl border border-ink-200"
                  >
                    {ph.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={ph.url}
                        alt={ph.type || 'foto'}
                        className="aspect-[4/5] w-full object-cover"
                      />
                    ) : (
                      <div className="flex aspect-[4/5] items-center justify-center bg-ink-100 p-3 text-center text-xs text-ink-500">
                        {ph.confirmed
                          ? 'Sem preview (storage)'
                          : 'Não confirmada'}
                      </div>
                    )}
                    <figcaption className="p-2 text-xs text-ink-600">
                      <span className="font-semibold capitalize">
                        {ph.type}
                      </span>
                      {ph.confirmed ? ' · ok' : ''}
                      {ph.width && ph.height
                        ? ` · ${ph.width}×${ph.height}`
                        : ''}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
          ) : null}

          <div className="card lg:col-span-2">
            <h2 className="font-display text-xl text-ink-950">Pagamentos</h2>
            {payments.length === 0 ? (
              <p className="mt-2 text-sm text-ink-500">Nenhum.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {payments.map((p) => (
                  <li
                    key={String(p.id)}
                    className="flex flex-wrap justify-between gap-2 rounded-xl bg-ink-50 px-3 py-2"
                  >
                    <span>
                      {String(p.status)} · {formatBrl(Number(p.amountCents) || 0)}
                    </span>
                    <span className="font-mono text-xs text-ink-500">
                      {String(p.externalPaymentId ?? p.externalPreferenceId ?? '')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {result?.summary ? (
            <div className="card space-y-4 lg:col-span-2">
              <h2 className="font-display text-xl text-ink-950">
                Resultado da análise
              </h2>
              <p className="text-sm leading-relaxed text-ink-700">
                {result.summary}
              </p>
              {result.perceptionAnalysis ? (
                <p className="text-sm leading-relaxed text-ink-600">
                  {result.perceptionAnalysis}
                </p>
              ) : null}
              {result.images && result.images.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {result.images.map((img) => (
                    <figure
                      key={img.id}
                      className="overflow-hidden rounded-2xl border border-ink-200"
                    >
                      {img.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={img.url}
                          alt={img.caption || 'Simulação'}
                          className="aspect-square w-full object-cover"
                        />
                      ) : (
                        <div className="flex aspect-square items-center justify-center bg-ink-100 text-sm text-ink-500">
                          Sem preview
                        </div>
                      )}
                      <figcaption className="p-3 text-xs text-ink-600">
                        {img.caption || img.styleVariationKey}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              ) : null}
              <div className="grid gap-3 text-sm text-ink-700 md:grid-cols-2">
                {result.hairRecommendations ? (
                  <p>
                    <strong>Cabelo:</strong> {result.hairRecommendations}
                  </p>
                ) : null}
                {result.beardRecommendations ? (
                  <p>
                    <strong>Barba:</strong> {result.beardRecommendations}
                  </p>
                ) : null}

                {result.maintenancePlan ? (
                  <p>
                    <strong>Manutenção:</strong> {result.maintenancePlan}
                  </p>
                ) : null}
                {result.salonBrief ? (
                  <p className="md:col-span-2">
                    <strong>Brief profissional:</strong> {result.salonBrief}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="mt-6 text-ink-600">Carregando…</p>
      )}
    </AdminShell>
  );
}
