'use client';

import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin/admin-shell';
import {
  adminListPackages,
  adminUpdatePackage,
  formatBrl,
} from '@/lib/admin-api';

export default function AdminPackagesPage() {
  const [rows, setRows] = useState<
    Awaited<ReturnType<typeof adminListPackages>>
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function load() {
    try {
      setRows(await adminListPackages());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function toggleActive(id: string, isActive: boolean) {
    setNote(null);
    try {
      await adminUpdatePackage(id, { isActive: !isActive });
      setNote('Pacote atualizado.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  }

  async function savePrice(id: string, priceCents: number) {
    setNote(null);
    try {
      await adminUpdatePackage(id, { priceCents });
      setNote('Preço atualizado.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  }

  return (
    <AdminShell>
      <h1 className="font-display text-3xl font-semibold text-ink-950">
        Pacotes
      </h1>
      <p className="mt-2 text-sm text-ink-600">
        Alterações de preço e status são gravadas no banco e aparecem na landing
        e no checkout em poucos segundos. Sem banco, o modo local usa memória
        do processo da API (reinício perde as edições).
      </p>

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

      <div className="mt-8 grid gap-4">
        {rows.map((pkg) => (
          <article key={pkg.id} className="card">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-xl text-ink-950">{pkg.name}</h2>
                  {pkg.isFeatured ? (
                    <span className="rounded-full bg-gold-400/20 px-2 py-0.5 text-xs text-gold-600">
                      destaque
                    </span>
                  ) : null}
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      pkg.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-ink-200 text-ink-600'
                    }`}
                  >
                    {pkg.isActive ? 'ativo' : 'inativo'}
                  </span>
                </div>
                <p className="mt-1 text-sm text-ink-500">
                  {pkg.slug} · {pkg.imageCount} imagens · ordem {pkg.sortOrder}
                </p>
              </div>
              <div className="text-right">
                <p className="font-display text-2xl text-ink-950">
                  {formatBrl(pkg.priceCents)}
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-end gap-3">
              <label className="text-sm">
                <span className="mb-1 block text-xs font-semibold text-ink-500">
                  Preço (centavos)
                </span>
                <input
                  className="input w-36"
                  type="number"
                  defaultValue={pkg.priceCents}
                  id={`price-${pkg.id}`}
                />
              </label>
              <button
                type="button"
                className="btn-secondary px-4 py-2 text-sm"
                onClick={() => {
                  const el = document.getElementById(
                    `price-${pkg.id}`,
                  ) as HTMLInputElement | null;
                  const cents = Number(el?.value ?? pkg.priceCents);
                  void savePrice(pkg.id, cents);
                }}
              >
                Salvar preço
              </button>
              <button
                type="button"
                className="btn-primary px-4 py-2 text-sm"
                onClick={() => void toggleActive(pkg.id, pkg.isActive)}
              >
                {pkg.isActive ? 'Desativar' : 'Ativar'}
              </button>
            </div>
          </article>
        ))}
      </div>
    </AdminShell>
  );
}
