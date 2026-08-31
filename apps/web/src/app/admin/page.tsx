'use client';

import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin/admin-shell';
import { adminMetrics, formatBrl } from '@/lib/admin-api';

export default function AdminDashboardPage() {
  const [data, setData] = useState<{
    totals: Record<string, number>;
    byStatus: Record<string, number>;
    generatedAt: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void adminMetrics()
      .then(setData)
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Erro ao carregar métricas'),
      );
  }, []);

  const t = data?.totals;

  return (
    <AdminShell>
      <h1 className="font-display text-3xl font-semibold text-ink-950">
        Dashboard
      </h1>
      <p className="mt-2 text-sm text-ink-600">
        Métricas do funil a partir do Postgres (pedidos, pagamentos e resultados).
      </p>

      {error ? (
        <p className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      {t ? (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Pedidos" value={String(t.orders ?? 0)} />
            <Stat label="Pagos" value={String(t.paid ?? 0)} />
            <Stat
              label="Receita"
              value={formatBrl(t.revenueCents ?? 0)}
            />
            <Stat
              label="Conversão pago"
              value={`${((t.conversionPaid ?? 0) * 100).toFixed(1)}%`}
            />
            <Stat label="Concluídos" value={String(t.completed ?? 0)} />
            <Stat label="Parciais" value={String(t.partial ?? 0)} />
            <Stat label="Falhas pós-pago" value={String(t.failedAfterPaid ?? 0)} />
            <Stat label="E-mails" value={String(t.emailsSent ?? 0)} />
          </div>

          <section className="card mt-8">
            <h2 className="font-display text-xl text-ink-950">Por status</h2>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {Object.entries(data?.byStatus ?? {}).map(([status, count]) => (
                <li
                  key={status}
                  className="flex justify-between rounded-xl bg-ink-50 px-3 py-2 text-sm"
                >
                  <span className="font-mono text-ink-600">{status}</span>
                  <span className="font-semibold">{count}</span>
                </li>
              ))}
              {Object.keys(data?.byStatus ?? {}).length === 0 ? (
                <li className="text-sm text-ink-500">Nenhum pedido ainda.</li>
              ) : null}
            </ul>
            <p className="mt-4 text-xs text-ink-400">
              Atualizado em {data?.generatedAt}
            </p>
          </section>
        </>
      ) : !error ? (
        <p className="mt-8 text-ink-600">Carregando…</p>
      ) : null}
    </AdminShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
        {label}
      </p>
      <p className="mt-2 font-display text-2xl text-ink-950">{value}</p>
    </div>
  );
}
