'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  CONTEXT_LABELS_PT,
  CONTEXTS,
  OBJECTIVE_LABELS_PT,
  OBJECTIVES,
} from '@visagismo/shared';
import { trackEvent } from '@/lib/analytics';
import {
  checkoutOrder,
  createOrder,
  patchOrder,
  uploadPhoto,
  type PublicOrder,
  type PublicPhoto,
} from '@/lib/orders-api';

const STEPS_PAID = [
  { id: 'identity', label: 'Identificação' },
  { id: 'objective', label: 'Seu objetivo' },
  { id: 'context', label: 'A imagem desejada' },
  { id: 'preferences', label: 'Rotina e preferências' },
  { id: 'photos', label: 'Fotos' },
  { id: 'review', label: 'Revisão e pagamento' },
] as const;

const STEPS_FREE = [
  { id: 'identity', label: 'Identificação' },
  { id: 'objective', label: 'Seu objetivo' },
  { id: 'context', label: 'A imagem desejada' },
  { id: 'preferences', label: 'Rotina e preferências' },
  { id: 'photos', label: 'Fotos' },
  { id: 'review', label: 'Revisão e geração' },
] as const;

const DRAFT_KEY = 'visagismo_wizard_draft_v1';

const INTENSITY_LABELS = {
  subtle: 'Discreta',
  moderate: 'Moderada',
  bold: 'Marcante',
} as const;

const MAINTENANCE_LABELS = {
  low: 'Pouco tempo',
  medium: 'Tempo médio',
  high: 'Mais tempo',
} as const;

type Props = {
  packageSlug: string;
  packageId: string;
  packageName: string;
  freeGenerationEnabled?: boolean;
};

type Draft = {
  packageSlug: string;
  name: string;
  email: string;
  emailConfirm: string;
  objectives: string[];
  primaryObjective: string | null;
  contexts: string[];
  intensity: 'subtle' | 'moderate' | 'bold';
  maintenance: 'low' | 'medium' | 'high';
  likedStyles: string;
  dislikedStyles: string;
  restrictions: string;
  step: number;
};

export function WizardShell({
  packageSlug,
  packageId,
  packageName,
  freeGenerationEnabled = false,
}: Props) {
  const STEPS = freeGenerationEnabled ? STEPS_FREE : STEPS_PAID;
  const [step, setStep] = useState(0);
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [emailConfirm, setEmailConfirm] = useState('');
  const [objectives, setObjectives] = useState<string[]>([]);
  const [primaryObjective, setPrimaryObjective] = useState<string | null>(null);
  const [contexts, setContexts] = useState<string[]>([]);
  const [intensity, setIntensity] = useState<'subtle' | 'moderate' | 'bold'>(
    'moderate',
  );
  const [maintenance, setMaintenance] = useState<'low' | 'medium' | 'high'>(
    'medium',
  );
  const [likedStyles, setLikedStyles] = useState('');
  const [dislikedStyles, setDislikedStyles] = useState('');
  const [restrictions, setRestrictions] = useState('');
  const [consentPrivacy, setConsentPrivacy] = useState(false);
  const [consentImages, setConsentImages] = useState(false);
  const [ageAttested, setAgeAttested] = useState(false);
  const [frontal, setFrontal] = useState<PublicPhoto | null>(null);
  const [lateral, setLateral] = useState<PublicPhoto | null>(null);
  const [photoWarnings, setPhotoWarnings] = useState<string[]>([]);
  const [uploading, setUploading] = useState<'frontal' | 'lateral' | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);

  const progress = useMemo(
    () => Math.round(((step + 1) / STEPS.length) * 100),
    [step],
  );

  // Restore local draft (never restores photos for security)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) {
        setDraftRestored(true);
        return;
      }
      const draft = JSON.parse(raw) as Draft;
      if (draft.packageSlug && draft.packageSlug !== packageSlug) {
        setDraftRestored(true);
        return;
      }
      setName(draft.name ?? '');
      setEmail(draft.email ?? '');
      setEmailConfirm(draft.emailConfirm ?? '');
      setObjectives(draft.objectives ?? []);
      setPrimaryObjective(draft.primaryObjective ?? null);
      setContexts(draft.contexts ?? []);
      setIntensity(draft.intensity ?? 'moderate');
      setMaintenance(draft.maintenance ?? 'medium');
      setLikedStyles(draft.likedStyles ?? '');
      setDislikedStyles(draft.dislikedStyles ?? '');
      setRestrictions(draft.restrictions ?? '');
      if (typeof draft.step === 'number' && draft.step > 0 && draft.step < 5) {
        // Only restore questionnaire answers before photos; order must be recreated
        setStep(0);
      }
      setNote('Restauramos suas respostas locais. Revise e continue.');
    } catch {
      // ignore
    } finally {
      setDraftRestored(true);
    }
    trackEvent('start_questionnaire', { package_slug: packageSlug });
  }, [packageSlug]);

  // Persist draft
  useEffect(() => {
    if (!draftRestored) return;
    const draft: Draft = {
      packageSlug,
      name,
      email,
      emailConfirm,
      objectives,
      primaryObjective,
      contexts,
      intensity,
      maintenance,
      likedStyles,
      dislikedStyles,
      restrictions,
      step,
    };
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // ignore quota
    }
  }, [
    draftRestored,
    packageSlug,
    name,
    email,
    emailConfirm,
    objectives,
    primaryObjective,
    contexts,
    intensity,
    maintenance,
    likedStyles,
    dislikedStyles,
    restrictions,
    step,
  ]);

  function toggle(list: string[], value: string, max: number) {
    if (list.includes(value)) {
      const next = list.filter((v) => v !== value);
      if (primaryObjective === value) {
        setPrimaryObjective(next[0] ?? null);
      }
      return next;
    }
    if (list.length >= max) return list;
    const next = [...list, value];
    if (!primaryObjective) setPrimaryObjective(value);
    return next;
  }

  function goToStep(target: number) {
    if (target < step) {
      trackEvent('abandon_step', {
        from_step: STEPS[step]?.id,
        to_step: STEPS[target]?.id,
      });
    }
    setStep(target);
    setError(null);
    setNote(null);
  }

  async function next() {
    setNote(null);
    setError(null);

    try {
      if (step === 0) {
        if (name.trim().length < 2) {
          setError('Informe seu nome completo ou como prefere ser chamado.');
          return;
        }
        if (
          !email.includes('@') ||
          email.toLowerCase() !== emailConfirm.toLowerCase()
        ) {
          setError('Confira se os e-mails coincidem e estão corretos.');
          return;
        }
        if (!packageId) {
          setError('Pacote inválido. Volte e escolha um pacote.');
          return;
        }

        setBusy(true);
        const created = await createOrder({
          name: name.trim(),
          email: email.trim(),
          emailConfirm: emailConfirm.trim(),
          // Envia slug + id: a API resolve slug se o UUID de fallback estiver desatualizado
          packageId: packageId || undefined,
          packageSlug: packageSlug || undefined,
        });
        setOrder(created);
        setBusy(false);
        setStep(1);
        trackEvent('complete_step', { step: 'identity' });
        setNote(
          `Pedido ${created.orderNumber} iniciado. Continue a consultoria guiada.`,
        );
        return;
      }

      if (!order) {
        setError('Sessão do pedido não encontrada. Volte à identificação.');
        setStep(0);
        return;
      }

      if (step === 1) {
        if (objectives.length === 0) {
          setError('Selecione pelo menos uma percepção ou objetivo.');
          return;
        }
        if (!primaryObjective || !objectives.includes(primaryObjective)) {
          setPrimaryObjective(objectives[0] ?? null);
        }
        setBusy(true);
        const ordered = primaryObjective
          ? [
              primaryObjective,
              ...objectives.filter((o) => o !== primaryObjective),
            ]
          : objectives;
        const updated = await patchOrder(order.id, {
          step: 'objective',
          questionnaire: { objectives: ordered },
        });
        setOrder(updated);
        setBusy(false);
        setStep(2);
        trackEvent('complete_step', { step: 'objective' });
        return;
      }

      if (step === 2) {
        if (contexts.length === 0) {
          setError('Selecione pelo menos um contexto de uso da sua imagem.');
          return;
        }
        setBusy(true);
        const updated = await patchOrder(order.id, {
          step: 'context',
          questionnaire: { contexts },
        });
        setOrder(updated);
        setBusy(false);
        setStep(3);
        trackEvent('complete_step', { step: 'context' });
        return;
      }

      if (step === 3) {
        setBusy(true);
        const updated = await patchOrder(order.id, {
          step: 'preferences',
          questionnaire: {
            maintenanceTime: maintenance,
            changeIntensity: intensity,
            likedStyles: likedStyles
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
              .slice(0, 12),
            dislikedStyles: dislikedStyles
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
              .slice(0, 12),
            restrictions: restrictions.slice(0, 1000),
          },
        });
        setOrder(updated);
        setBusy(false);
        setStep(4);
        trackEvent('complete_step', { step: 'preferences' });
        return;
      }

      if (step === 4) {
        if (!frontal?.confirmed) {
          setError('Envie a foto frontal para continuar.');
          return;
        }
        setStep(5);
        trackEvent('complete_step', { step: 'photos' });
        setNote(
          lateral?.confirmed
            ? freeGenerationEnabled
              ? 'Fotos confirmadas. Revise o resumo e os consentimentos para gerar as simulações.'
              : 'Fotos confirmadas. Revise o resumo e os consentimentos antes do pagamento.'
            : 'Foto frontal ok. A lateral é recomendada para melhor análise de volume e contornos — você ainda pode voltar e enviá-la.',
        );
        return;
      }

      if (step === 5) {
        if (!consentPrivacy || !consentImages || !ageAttested) {
          setError(
            'Aceite a privacidade, o processamento de imagens e a confirmação de idade para continuar.',
          );
          return;
        }
        setBusy(true);
        trackEvent('checkout_start', {
          package_slug: packageSlug,
          free: freeGenerationEnabled,
        });
        const updated = await patchOrder(order.id, {
          step: 'review',
          consentPrivacy: true,
          consentImageProcessing: true,
          ageAttested: true,
        });
        setOrder(updated);

        const checkout = await checkoutOrder(updated.id);
        setOrder(checkout.order);
        setBusy(false);

        try {
          localStorage.removeItem(DRAFT_KEY);
        } catch {
          // ignore
        }

        if (checkout.payment.free) {
          setNote('Geração gratuita liberada. Abrindo acompanhamento…');
          window.location.href = `/pedido/${updated.id}/aguardando`;
          return;
        }

        const payUrl =
          checkout.payment.initPoint ||
          checkout.payment.sandboxInitPoint ||
          `/pedido/${updated.id}/aguardando`;

        setNote(
          checkout.payment.mock
            ? 'Ambiente de desenvolvimento: abrindo pagamento simulado…'
            : 'Redirecionando ao checkout seguro…',
        );
        window.location.href = payUrl;
      }
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : 'Falha ao salvar o pedido.');
    }
  }

  function back() {
    goToStep(Math.max(step - 1, 0));
  }

  return (
    <div className="card mt-8">
      <div className="mb-6">
        <div className="flex items-center justify-between gap-3 text-xs text-ink-500">
          <span>
            Etapa {step + 1} de {STEPS.length}: {STEPS[step]?.label}
            {order ? ` · ${order.orderNumber}` : ''}
          </span>
          <span aria-live="polite">{progress}%</span>
        </div>
        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-200"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progresso da consultoria"
        >
          <div
            className="h-full rounded-full bg-gold-500 transition-all duration-300 motion-reduce:transition-none"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-3 text-sm text-ink-600">
          Consultoria guiada — respostas curtas, uma etapa de cada vez.
        </p>
      </div>

      {step === 0 && (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-ink-600">
            Usamos nome e e-mail para identificar o pedido e enviar o resultado.
            Não é necessário criar senha.
          </p>
          <Field label="Como podemos te chamar?" htmlFor="wiz-name">
            <input
              id="wiz-name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              disabled={busy}
              required
            />
          </Field>
          <Field label="E-mail para receber o resultado" htmlFor="wiz-email">
            <input
              id="wiz-email"
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              disabled={busy}
              required
            />
          </Field>
          <Field label="Confirme o e-mail" htmlFor="wiz-email2">
            <input
              id="wiz-email2"
              className="input"
              type="email"
              value={emailConfirm}
              onChange={(e) => setEmailConfirm(e.target.value)}
              autoComplete="email"
              disabled={busy}
              required
            />
          </Field>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-5">
          <ChipGroup
            title="O que você deseja transformar ou compreender?"
            hint="Selecione até 5. Depois indique a prioridade principal."
            options={OBJECTIVES.map((o) => ({
              value: o,
              label: OBJECTIVE_LABELS_PT[o],
            }))}
            selected={objectives}
            onToggle={(v) => setObjectives(toggle(objectives, v, 5))}
          />
          {objectives.length > 1 ? (
            <div>
              <p className="mb-2 text-sm font-semibold text-ink-800">
                Qual é a prioridade principal?
              </p>
              <div className="flex flex-wrap gap-2">
                {objectives.map((o) => (
                  <button
                    key={o}
                    type="button"
                    onClick={() => setPrimaryObjective(o)}
                    className={`rounded-full border px-3 py-2 text-sm ${
                      primaryObjective === o
                        ? 'border-gold-500 bg-gold-400/20 text-ink-950'
                        : 'border-ink-300 bg-white text-ink-700'
                    }`}
                  >
                    {OBJECTIVE_LABELS_PT[o as keyof typeof OBJECTIVE_LABELS_PT] ??
                      o}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {step === 2 && (
        <ChipGroup
          title="Onde sua imagem será mais usada?"
          hint="Isso ajuda a calibrar formalidade, manutenção e ousadia."
          options={CONTEXTS.map((c) => ({
            value: c,
            label: CONTEXT_LABELS_PT[c],
          }))}
          selected={contexts}
          onToggle={(v) => setContexts(toggle(contexts, v, 4))}
        />
      )}

      {step === 3 && (
        <div className="space-y-6">
          <div>
            <p className="mb-2 text-sm font-semibold text-ink-800">
              Prefere mudança discreta ou marcante?
            </p>
            <div className="flex flex-wrap gap-2">
              {(
                Object.entries(INTENSITY_LABELS) as [
                  keyof typeof INTENSITY_LABELS,
                  string,
                ][]
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setIntensity(value)}
                  className={`rounded-full border px-4 py-2 text-sm ${
                    intensity === value
                      ? 'border-ink-950 bg-ink-950 text-white'
                      : 'border-ink-300 bg-white text-ink-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold text-ink-800">
              Quanto tempo deseja dedicar à manutenção no dia a dia?
            </p>
            <div className="flex flex-wrap gap-2">
              {(
                Object.entries(MAINTENANCE_LABELS) as [
                  keyof typeof MAINTENANCE_LABELS,
                  string,
                ][]
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMaintenance(value)}
                  className={`rounded-full border px-4 py-2 text-sm ${
                    maintenance === value
                      ? 'border-ink-950 bg-ink-950 text-white'
                      : 'border-ink-300 bg-white text-ink-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <Field
            label="O que deseja manter ou estilos de que gosta"
            htmlFor="wiz-liked"
          >
            <input
              id="wiz-liked"
              className="input"
              value={likedStyles}
              onChange={(e) => setLikedStyles(e.target.value)}
              placeholder="ex.: clássico, moderno, minimalista"
            />
          </Field>
          <Field
            label="O que não deseja ou experiências que prefere evitar"
            htmlFor="wiz-disliked"
          >
            <input
              id="wiz-disliked"
              className="input"
              value={dislikedStyles}
              onChange={(e) => setDislikedStyles(e.target.value)}
              placeholder="ex.: volume excessivo, contraste muito alto"
            />
          </Field>
          <Field
            label="Restrições profissionais, pessoais ou de rotina"
            htmlFor="wiz-restrictions"
          >
            <textarea
              id="wiz-restrictions"
              className="input min-h-[88px]"
              value={restrictions}
              onChange={(e) => setRestrictions(e.target.value)}
              maxLength={1000}
              placeholder="ex.: uniforme, normas da empresa, pouco tempo entre cortes…"
            />
          </Field>
        </div>
      )}

      {step === 4 && order && (
        <div className="space-y-4 text-sm text-ink-700">
          <div>
            <p className="font-semibold text-ink-900">
              Como tirar boas fotos para a análise
            </p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {[
                'Boa iluminação natural ou uniforme',
                'Sem filtros ou beleza artificial',
                'Rosto e contornos visíveis',
                'Foto frontal (obrigatória)',
                'Foto lateral ou em ângulo (recomendada)',
                'Cabelo solto o suficiente para ver o volume',
                'Evite óculos escuros e acessórios grandes',
                'Evite sombras fortes no rosto',
              ].map((tip) => (
                <li
                  key={tip}
                  className="rounded-xl border border-ink-200 bg-ink-50 px-3 py-2 text-xs leading-relaxed"
                >
                  {tip}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-ink-500">
              Formatos: JPEG, PNG ou WebP · até 10 MB. Avisos de qualidade não
              bloqueiam o envio, mas melhores fotos geram melhores simulações.
            </p>
          </div>

          <PhotoUploadField
            label="Foto frontal *"
            status={frontal}
            busy={uploading === 'frontal'}
            onFile={async (file) => {
              setError(null);
              setUploading('frontal');
              trackEvent('upload_start', { type: 'frontal' });
              try {
                const result = await uploadPhoto({
                  orderId: order.id,
                  type: 'frontal',
                  file,
                });
                setFrontal(result.photo);
                setPhotoWarnings(result.warnings);
                trackEvent('upload_complete', { type: 'frontal' });
              } catch (err) {
                trackEvent('upload_error', { type: 'frontal' });
                setError(
                  err instanceof Error ? err.message : 'Falha no upload frontal.',
                );
              } finally {
                setUploading(null);
              }
            }}
          />

          <PhotoUploadField
            label="Foto lateral (recomendada)"
            status={lateral}
            busy={uploading === 'lateral'}
            onFile={async (file) => {
              setError(null);
              setUploading('lateral');
              trackEvent('upload_start', { type: 'lateral' });
              try {
                const result = await uploadPhoto({
                  orderId: order.id,
                  type: 'lateral',
                  file,
                });
                setLateral(result.photo);
                setPhotoWarnings((w) => [
                  ...new Set([...w, ...result.warnings]),
                ]);
                trackEvent('upload_complete', { type: 'lateral' });
              } catch (err) {
                trackEvent('upload_error', { type: 'lateral' });
                setError(
                  err instanceof Error ? err.message : 'Falha no upload lateral.',
                );
              } finally {
                setUploading(null);
              }
            }}
          />

          {photoWarnings.length > 0 ? (
            <div
              className="rounded-xl bg-amber-50 px-4 py-3 text-amber-900"
              role="status"
            >
              <p className="font-semibold">Avisos de qualidade</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {photoWarnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs">
                Você pode continuar ou trocar as fotos para melhorar o resultado.
              </p>
            </div>
          ) : null}
        </div>
      )}

      {step === 5 && (
        <div className="space-y-4 text-sm text-ink-700">
          <p className="font-semibold text-ink-900">
            {freeGenerationEnabled
              ? 'Revise antes de gerar'
              : 'Revise antes do pagamento'}
          </p>
          <p className="text-ink-600">
            {freeGenerationEnabled
              ? 'Geração gratuita está ativa: ao confirmar, as simulações entram na fila sem cobrança. Fotos e consentimentos continuam obrigatórios.'
              : 'O processamento começa somente após a confirmação do pagamento. Pagamento único — sem assinatura.'}
          </p>
          <dl className="grid gap-2 rounded-2xl bg-ink-50 p-4">
            <Row k="Pedido" v={order?.orderNumber ?? '—'} />
            <Row k="Pacote" v={packageName} />
            <Row k="Nome" v={name || order?.customerName || '—'} />
            <Row k="E-mail" v={email || order?.customerEmail || '—'} />
            <Row
              k="Objetivos"
              v={
                objectives
                  .map(
                    (o) =>
                      OBJECTIVE_LABELS_PT[o as keyof typeof OBJECTIVE_LABELS_PT],
                  )
                  .join(', ') || '—'
              }
            />
            <Row
              k="Prioridade"
              v={
                primaryObjective
                  ? OBJECTIVE_LABELS_PT[
                      primaryObjective as keyof typeof OBJECTIVE_LABELS_PT
                    ]
                  : '—'
              }
            />
            <Row
              k="Contextos"
              v={
                contexts
                  .map(
                    (c) => CONTEXT_LABELS_PT[c as keyof typeof CONTEXT_LABELS_PT],
                  )
                  .join(', ') || '—'
              }
            />
            <Row k="Mudança" v={INTENSITY_LABELS[intensity]} />
            <Row k="Manutenção" v={MAINTENANCE_LABELS[maintenance]} />
            <Row
              k="Fotos"
              v={
                [
                  frontal?.confirmed ? 'frontal ✓' : null,
                  lateral?.confirmed ? 'lateral ✓' : null,
                ]
                  .filter(Boolean)
                  .join(', ') || '—'
              }
            />
          </dl>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="text-xs font-semibold text-gold-600 underline"
              onClick={() => goToStep(1)}
            >
              Editar objetivos
            </button>
            <button
              type="button"
              className="text-xs font-semibold text-gold-600 underline"
              onClick={() => goToStep(3)}
            >
              Editar preferências
            </button>
            <button
              type="button"
              className="text-xs font-semibold text-gold-600 underline"
              onClick={() => goToStep(4)}
            >
              Editar fotos
            </button>
          </div>
          <label className="flex gap-2">
            <input
              type="checkbox"
              className="mt-1"
              checked={consentPrivacy}
              onChange={(e) => setConsentPrivacy(e.target.checked)}
            />
            <span>
              Li e aceito a{' '}
              <Link
                href="/privacidade"
                target="_blank"
                className="underline hover:text-ink-950"
              >
                Política de Privacidade
              </Link>{' '}
              e os{' '}
              <Link
                href="/termos"
                target="_blank"
                className="underline hover:text-ink-950"
              >
                Termos de Uso
              </Link>
              .
            </span>
          </label>
          <label className="flex gap-2">
            <input
              type="checkbox"
              className="mt-1"
              checked={consentImages}
              onChange={(e) => setConsentImages(e.target.checked)}
            />
            <span>
              Autorizo o uso das minhas fotos exclusivamente para gerar a minha
              análise e simulações. Não utilizamos imagens para treinar modelos
              sem autorização expressa.
            </span>
          </label>
          <label className="flex gap-2">
            <input
              type="checkbox"
              className="mt-1"
              checked={ageAttested}
              onChange={(e) => setAgeAttested(e.target.checked)}
            />
            <span>Declaro ter 18 anos ou mais.</span>
          </label>
        </div>
      )}

      {error ? (
        <p
          className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {note ? (
        <p
          className="mt-6 rounded-xl bg-gold-400/15 px-4 py-3 text-sm text-ink-800"
          role="status"
        >
          {note}
        </p>
      ) : null}

      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <button
          type="button"
          onClick={back}
          disabled={step === 0 || busy}
          className="btn-secondary w-full disabled:opacity-40 sm:w-auto"
        >
          Voltar
        </button>
        <button
          type="button"
          onClick={() => void next()}
          disabled={busy}
          className="btn-primary w-full disabled:opacity-60 sm:w-auto sm:min-w-[10rem]"
        >
          {busy
            ? step === STEPS.length - 1
              ? freeGenerationEnabled
                ? 'Iniciando geração…'
                : 'Preparando pagamento…'
              : 'Salvando…'
            : step === STEPS.length - 1
              ? freeGenerationEnabled
                ? 'Confirmar e gerar grátis'
                : 'Confirmar e pagar'
              : 'Continuar'}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="block text-sm">
      <label htmlFor={htmlFor} className="mb-1.5 block font-semibold text-ink-800">
        {label}
      </label>
      {children}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
      <dt className="w-28 shrink-0 font-medium text-ink-500">{k}</dt>
      <dd className="text-ink-900">{v}</dd>
    </div>
  );
}

function ChipGroup({
  title,
  hint,
  options,
  selected,
  onToggle,
}: {
  title: string;
  hint?: string;
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div>
      <p className="mb-1 text-sm font-semibold text-ink-800">{title}</p>
      {hint ? <p className="mb-3 text-xs text-ink-500">{hint}</p> : null}
      <div className="flex flex-wrap gap-2" role="group" aria-label={title}>
        {options.map((opt) => {
          const active = selected.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              aria-pressed={active}
              onClick={() => onToggle(opt.value)}
              className={`rounded-full border px-3 py-2 text-left text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 ${
                active
                  ? 'border-ink-950 bg-ink-950 text-white'
                  : 'border-ink-300 bg-white text-ink-700 hover:border-ink-500'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PhotoUploadField({
  label,
  status,
  busy,
  onFile,
}: {
  label: string;
  status: PublicPhoto | null;
  busy: boolean;
  onFile: (file: File) => Promise<void>;
}) {
  const inputId = `photo-${label.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <div className="rounded-2xl border border-dashed border-ink-300 bg-ink-50 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-ink-900">{label}</p>
          {status?.confirmed ? (
            <p className="mt-1 text-xs text-green-700">
              Confirmada
              {status.width && status.height
                ? ` · ${status.width}×${status.height}`
                : ''}
              {status.bytes ? ` · ${Math.round(status.bytes / 1024)} KB` : ''}
            </p>
          ) : (
            <p className="mt-1 text-xs text-ink-500">Nenhum arquivo confirmado</p>
          )}
        </div>
        <label
          htmlFor={inputId}
          className="btn-secondary cursor-pointer px-4 py-2 text-sm"
        >
          {busy ? 'Enviando…' : status?.confirmed ? 'Trocar foto' : 'Escolher arquivo'}
          <input
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/jpg,.jpg,.jpeg,.png,.webp"
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onFile(file);
              e.target.value = '';
            }}
          />
        </label>
      </div>
    </div>
  );
}
