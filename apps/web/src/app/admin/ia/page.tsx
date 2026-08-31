'use client';

import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin/admin-shell';
import {
  adminAiCosts,
  adminAiProviders,
  adminGetImageSystemPrompt,
  adminResetImageSystemPrompt,
  adminSaveImageSystemPrompt,
  type ImageSystemPromptSettings,
} from '@/lib/admin-api';

export default function AdminAiPage() {
  const [providers, setProviders] = useState<
    Awaited<ReturnType<typeof adminAiProviders>> | null
  >(null);
  const [costs, setCosts] = useState<
    Awaited<ReturnType<typeof adminAiCosts>> | null
  >(null);
  const [promptSettings, setPromptSettings] =
    useState<ImageSystemPromptSettings | null>(null);
  const [promptDraft, setPromptDraft] = useState('');
  const [promptBusy, setPromptBusy] = useState(false);
  const [promptNote, setPromptNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([
      adminAiProviders(),
      adminAiCosts(),
      adminGetImageSystemPrompt(),
    ])
      .then(([p, c, prompt]) => {
        setProviders(p);
        setCosts(c);
        setPromptSettings(prompt);
        setPromptDraft(prompt.prompt);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Erro ao carregar IA'),
      );
  }, []);

  async function savePrompt() {
    setPromptBusy(true);
    setPromptNote(null);
    setError(null);
    try {
      const saved = await adminSaveImageSystemPrompt(promptDraft);
      setPromptSettings((prev) =>
        prev
          ? {
              ...prev,
              prompt: saved.prompt,
              isDefault: saved.isDefault,
              updatedAt: saved.updatedAt,
            }
          : prev,
      );
      setPromptDraft(saved.prompt);
      setPromptNote(
        'Prompt salvo. Novas gerações e reprocessamentos usam este texto.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar prompt');
    } finally {
      setPromptBusy(false);
    }
  }

  async function resetPrompt() {
    if (!confirm('Restaurar o prompt padrão de identidade?')) return;
    setPromptBusy(true);
    setPromptNote(null);
    setError(null);
    try {
      const saved = await adminResetImageSystemPrompt();
      setPromptSettings((prev) =>
        prev
          ? {
              ...prev,
              prompt: saved.prompt,
              isDefault: saved.isDefault,
              updatedAt: saved.updatedAt,
            }
          : prev,
      );
      setPromptDraft(saved.prompt);
      setPromptNote('Prompt restaurado para o padrão.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao restaurar');
    } finally {
      setPromptBusy(false);
    }
  }

  return (
    <AdminShell>
      <h1 className="font-display text-3xl font-semibold text-ink-950">
        Inteligência artificial
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-600">
        Provedores, custos e o system prompt de imagem (edição da foto do
        cliente). Alterações no prompt valem para a próxima geração ou
        reprocessamento.
      </p>

      {error ? (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      {promptNote ? (
        <p className="mt-4 rounded-xl bg-gold-400/15 px-4 py-3 text-sm text-ink-800">
          {promptNote}
        </p>
      ) : null}

      {promptSettings ? (
        <section className="card mt-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-xl text-ink-950">
                System prompt de imagem
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-ink-600">
                Instruções fixas enviadas aos modelos (OpenAI edits, Gemini,
                etc.) junto com a foto do cliente e o estilo da simulação.
              </p>
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                promptSettings.isDefault
                  ? 'bg-ink-100 text-ink-600'
                  : 'bg-gold-400/20 text-gold-700'
              }`}
            >
              {promptSettings.isDefault ? 'padrão' : 'personalizado'}
            </span>
          </div>

          <div className="mt-4 rounded-xl bg-ink-50 px-3 py-3 text-xs text-ink-600">
            <p className="font-semibold text-ink-800">Placeholders</p>
            <ul className="mt-2 space-y-1">
              {promptSettings.placeholders.map((p) => (
                <li key={p.key}>
                  <code className="rounded bg-white px-1">{p.key}</code> —{' '}
                  {p.description}
                </li>
              ))}
            </ul>
          </div>

          <label className="mt-4 block text-sm">
            <span className="mb-1.5 block font-semibold text-ink-800">
              Template
            </span>
            <textarea
              className="input min-h-[280px] font-mono text-xs leading-relaxed"
              value={promptDraft}
              onChange={(e) => setPromptDraft(e.target.value)}
              disabled={promptBusy}
              spellCheck={false}
            />
          </label>

          {promptSettings.updatedAt ? (
            <p className="mt-2 text-xs text-ink-500">
              Atualizado em{' '}
              {new Date(promptSettings.updatedAt).toLocaleString('pt-BR')}
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              className="btn-primary px-4 py-2 text-sm"
              disabled={promptBusy}
              onClick={() => void savePrompt()}
            >
              {promptBusy ? 'Salvando…' : 'Salvar prompt'}
            </button>
            <button
              type="button"
              className="btn-secondary px-4 py-2 text-sm"
              disabled={promptBusy}
              onClick={() => void resetPrompt()}
            >
              Restaurar padrão
            </button>
            <button
              type="button"
              className="btn-secondary px-4 py-2 text-sm"
              disabled={promptBusy}
              onClick={() => setPromptDraft(promptSettings.defaultPrompt)}
            >
              Carregar padrão no editor
            </button>
          </div>
        </section>
      ) : null}

      {providers ? (
        <>
          <div className="card mt-6 text-sm">
            <p>
              <span className="text-ink-500">Cadeia:</span>{' '}
              <code className="text-xs">{providers.chain}</code>
            </p>
            <p className="mt-1">
              <span className="text-ink-500">Mock permitido:</span>{' '}
              {providers.allowMock ? 'sim' : 'não'}
            </p>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {providers.providers.map((p) => (
              <article key={`${p.kind}-${p.key}`} className="card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-ink-500">
                      {p.kind === 'image' ? 'Imagem' : 'Texto / análise'}
                    </p>
                    <h2 className="font-display text-xl text-ink-950">
                      {p.displayName}
                    </h2>
                    <p className="mt-1 font-mono text-xs text-ink-500">{p.key}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        p.configured
                          ? 'bg-green-100 text-green-800'
                          : 'bg-ink-200 text-ink-600'
                      }`}
                    >
                      {p.configured ? 'configurado' : 'sem chave'}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        p.enabled
                          ? 'bg-gold-400/20 text-gold-700'
                          : 'bg-ink-100 text-ink-500'
                      }`}
                    >
                      {p.enabled ? 'na cadeia' : 'fora da cadeia'}
                    </span>
                  </div>
                </div>
                <dl className="mt-4 space-y-1 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-ink-500">Model ID</dt>
                    <dd className="font-mono text-xs">{p.defaultModelId}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-ink-500">Custo est. / call</dt>
                    <dd>
                      ${(p.estimatedCostUsdMicros / 1_000_000).toFixed(4)}
                    </dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>

          <section className="card mt-8">
            <h2 className="font-display text-xl text-ink-950">
              Variáveis de ambiente
            </h2>
            <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              {Object.entries(providers.envHints).map(([k, v]) => (
                <li
                  key={k}
                  className="flex justify-between gap-2 rounded-xl bg-ink-50 px-3 py-2"
                >
                  <code className="text-xs">{k}</code>
                  <span className="text-xs text-ink-600">
                    {typeof v === 'boolean' ? (v ? 'definida' : '—') : String(v)}
                  </span>
                </li>
              ))}
            </ul>
            <pre className="mt-4 overflow-x-auto rounded-xl bg-ink-950 p-4 text-xs text-ink-200">
{`# Exemplo .env
OPENAI_API_KEY=sk-...
OPENAI_IMAGE_MODEL=gpt-image-2
OPENAI_ANALYSIS_MODEL=gpt-4o-mini
GEMINI_API_KEY=...
IMAGE_PROVIDER_CHAIN=openai,gemini,mock
IMAGE_ALLOW_MOCK=true`}
            </pre>
          </section>
        </>
      ) : !error ? (
        <p className="mt-8 text-ink-600">Carregando…</p>
      ) : null}

      {costs ? (
        <section className="card mt-8">
          <h2 className="font-display text-xl text-ink-950">Custos (sessão)</h2>
          <p className="mt-2 text-sm text-ink-600">
            Total estimado: $
            {(costs.totalCostUsdMicros / 1_000_000).toFixed(4)} ·{' '}
            {costs.totalCalls} chamadas
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            {Object.entries(costs.byProvider).map(([prov, row]) => (
              <li
                key={prov}
                className="flex flex-wrap justify-between gap-2 rounded-xl bg-ink-50 px-3 py-2"
              >
                <span className="font-mono text-xs">{prov}</span>
                <span>
                  {row.count}× · ${(row.costUsdMicros / 1_000_000).toFixed(4)} ·
                  avg {row.avgLatencyMs}ms
                </span>
              </li>
            ))}
            {Object.keys(costs.byProvider).length === 0 ? (
              <li className="text-ink-500">Nenhuma geração registrada ainda.</li>
            ) : null}
          </ul>
        </section>
      ) : null}
    </AdminShell>
  );
}
