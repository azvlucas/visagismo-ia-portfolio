'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin/admin-shell';
import {
  adminListOrders,
  formatBrl,
} from '@/lib/admin-api';

export default function AdminOrdersPage() {
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<
    Awaited<ReturnType<typeof adminListOrders>>
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await adminListOrders({
        status: status || undefined,
        q: q || undefined,
      });
      setRows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AdminShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink-950">
            Pedidos
          </h1>
          <p className="mt-2 text-sm text-ink-600">
            Pedidos, pagamentos e fotos vêm do Postgres (não da memória do processo).
          </p>
        </div>
        <button type="button" className="btn-secondary" onClick={() => void load()}>
          Atualizar
        </button>
      </div>

      <div className="card mt-6 flex flex-wrap gap-3">
        <input
          className="input max-w-xs"
          placeholder="Buscar nome, e-mail, nº"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="input max-w-[200px]"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Todos os status</option>
          {[
            'draft',
            'awaiting_payment',
            'queued',
            'processing',
            'completed',
            'partially_completed',
            'failed',
            'cancelled',
          ].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button type="button" className="btn-primary" onClick={() => void load()}>
          Filtrar
        </button>
      </div>

      {error ? (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <div className="mt-6 overflow-x-auto rounded-3xl border border-ink-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-ink-200 bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
            <tr>
              <th className="px-4 py-3">Pedido</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Pacote</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Criado</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-ink-500">
                  Carregando…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-ink-500">
                  Nenhum pedido encontrado.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-ink-100 hover:bg-ink-50/80"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/pedidos/${row.id}`}
                      className="font-semibold text-ink-950 hover:text-gold-600"
                    >
                      {row.orderNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <div>{row.customerName}</div>
                    <div className="text-xs text-ink-500">{row.customerEmail}</div>
                  </td>
                  <td className="px-4 py-3">
                    {row.package?.name ?? row.packageName}
                    <div className="text-xs text-ink-500">
                      {formatBrl(row.package?.priceCents ?? 0)}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-ink-100 px-2 py-1 text-xs font-medium">
                      {row.statusLabel}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-500">
                    {new Date(row.createdAt).toLocaleString('pt-BR')}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
