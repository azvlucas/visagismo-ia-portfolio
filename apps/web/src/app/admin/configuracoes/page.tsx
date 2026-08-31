'use client';

import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin/admin-shell';
import {
  adminGetFeatureFlags,
  adminPatchFeatureFlags,
  type FeatureFlags,
} from '@/lib/admin-api';

const FLAG_META: Array<{
  key: keyof FeatureFlags;
  title: string;
  description: string;
  danger?: boolean;
}> = [
  {
    key: 'free_generation_enabled',
    title: 'Geração gratuita de fotos',
    description:
      'Quando ativo, o cliente conclui o wizard sem pagar. O pedido é aprovado com valor R$ 0 e a geração de imagens inicia na hora. Ideal para beta, demos ou campanhas.',
    danger: true,
  },
  {
    key: 'payments_enabled',
    title: 'Pagamentos habilitados',
    description:
      'Flag de catálogo (app_settings). O checkout pago ainda respeita a variável de ambiente PAYMENTS_ENABLED da API.',
  },
  {
    key: 'generation_enabled',
    title: 'Geração de imagens',
    description:
      'Indica se o pipeline de geração está liberado. Desative em manutenção programada do provedor de IA.',
  },
  {
    key: 'maintenance_mode',
    title: 'Modo manutenção',
    description:
      'Sinaliza manutenção no site. Use junto com avisos na landing quando o serviço estiver indisponível.',
  },
];

export default function AdminConfigPage() {
  const [flags, setFlags] = useState<FeatureFlags | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<keyof FeatureFlags | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    void adminGetFeatureFlags()
      .then((data) => {
        setFlags(data.flags);
        setUpdatedAt(data.updatedAt);
      })
      .catch((err) =>
        setError(
          err instanceof Error ? err.message : 'Erro ao carregar configurações',
        ),
      );
  }, []);

  async function toggle(key: keyof FeatureFlags) {
    if (!flags) return;
    const next = !flags[key];
    if (
      key === 'free_generation_enabled' &&
      next &&
      !confirm(
        'Ativar geração gratuita? Todos os novos checkouts pularão o pagamento e consumirão cota de IA sem receita.',
      )
    ) {
      return;
    }

    setBusyKey(key);
    setError(null);
    setNote(null);
    try {
      const saved = await adminPatchFeatureFlags({ [key]: next });
      setFlags(saved.flags);
      setUpdatedAt(saved.updatedAt);
      setNote(
        key === 'free_generation_enabled'
          ? next
            ? 'Gratuidade ativada. Novos pedidos geram fotos sem cobrança.'
            : 'Gratuidade desativada. Checkout volta a exigir pagamento.'
          : 'Configuração salva.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar');
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <AdminShell>
      <h1 className="font-display text-3xl font-semibold text-ink-950">
        Configurações
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-600">
        Flags operacionais do produto. A mais importante para campanhas é a
        geração gratuita de fotos.
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

      {flags ? (
        <div className="mt-8 space-y-4">
          {FLAG_META.map((item) => {
            const on = flags[item.key];
            const busy = busyKey === item.key;
            return (
              <article
                key={item.key}
                className={`card flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between ${
                  item.key === 'free_generation_enabled' && on
                    ? 'border-gold-500/40 ring-1 ring-gold-400/30'
                    : ''
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-xl text-ink-950">
                      {item.title}
                    </h2>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        on
                          ? item.danger
                            ? 'bg-gold-400/25 text-gold-800'
                            : 'bg-green-100 text-green-800'
                          : 'bg-ink-100 text-ink-600'
                      }`}
                    >
                      {on ? 'ligado' : 'desligado'}
                    </span>
                  </div>
                  <p className="mt-1 max-w-xl text-sm text-ink-600">
                    {item.description}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  disabled={busy || busyKey !== null}
                  onClick={() => void toggle(item.key)}
                  className={`relative h-9 w-16 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
                    on ? 'bg-gold-500' : 'bg-ink-200'
                  }`}
                >
                  <span
                    className={`absolute top-1 h-7 w-7 rounded-full bg-white shadow transition-transform ${
                      on ? 'left-8' : 'left-1'
                    }`}
                  />
                  <span className="sr-only">
                    {on ? 'Desativar' : 'Ativar'} {item.title}
                  </span>
                </button>
              </article>
            );
          })}

          {updatedAt ? (
            <p className="text-xs text-ink-400">
              Última alteração em{' '}
              {new Date(updatedAt).toLocaleString('pt-BR')}
            </p>
          ) : null}
        </div>
      ) : !error ? (
        <p className="mt-8 text-ink-600">Carregando…</p>
      ) : null}
    </AdminShell>
  );
}
