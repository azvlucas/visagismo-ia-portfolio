'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { trackEvent } from '@/lib/analytics';
import { getOrder, syncPayment, type PublicOrder } from '@/lib/orders-api';
import { siteConfig, supportMailto } from '@/lib/site-config';

function statusPresentation(status: string | undefined): {
  title: string;
  description: string;
  tone: 'wait' | 'ok' | 'work' | 'done' | 'error' | 'neutral';
} {
  switch (status) {
    case 'awaiting_payment':
    case 'payment_pending':
      return {
        title: 'Aguardando pagamento',
        description:
          'Assim que o pagamento for confirmado, iniciamos a validação das fotos e o processamento da sua análise.',
        tone: 'wait',
      };
    case 'payment_approved':
      return {
        title: 'Pagamento aprovado',
        description:
          'Recebemos a confirmação. Em seguida validamos as fotos e enfileiramos a geração das simulações.',
        tone: 'ok',
      };
    case 'queued':
      return {
        title: 'Na fila de processamento',
        description:
          'Seu pedido está na fila. Você pode fechar esta página — avisamos por e-mail quando o resultado estiver pronto.',
        tone: 'work',
      };
    case 'processing':
      return {
        title: 'Em processamento',
        description:
          'Estamos gerando sua análise e simulações. Esta página atualiza automaticamente.',
        tone: 'work',
      };
    case 'completed':
      return {
        title: 'Resultado disponível',
        description:
          'Sua análise e simulações estão prontas. Acesse a página de resultado ou o e-mail que enviamos.',
        tone: 'done',
      };
    case 'partially_completed':
      return {
        title: 'Resultado parcial disponível',
        description:
          'Parte do material já está pronta. Você pode visualizar o que foi gerado e, se necessário, solicitar reprocessamento pelo suporte.',
        tone: 'done',
      };
    case 'failed':
      return {
        title: 'Falha técnica no processamento',
        description:
          'Não concluímos a geração nesta tentativa. Registramos o pedido para reprocessamento. Entre em contato com o suporte se precisar de ajuda.',
        tone: 'error',
      };
    case 'cancelled':
      return {
        title: 'Pagamento não concluído',
        description:
          'O pagamento não foi finalizado. Você pode iniciar um novo pedido quando quiser.',
        tone: 'neutral',
      };
    case 'needs_photos':
    case 'photos_rejected':
      return {
        title: 'Necessário reenviar fotos',
        description:
          'Precisamos de novas fotos para continuar. Siga as orientações de qualidade e reenvie pelo fluxo indicado no suporte ou no pedido.',
        tone: 'wait',
      };
    case 'refund_requested':
      return {
        title: 'Reembolso solicitado',
        description: 'Recebemos a solicitação de reembolso e ela está em análise.',
        tone: 'wait',
      };
    case 'refunded':
      return {
        title: 'Reembolso concluído',
        description: 'O reembolso foi processado conforme a política aplicável.',
        tone: 'neutral',
      };
    default:
      return {
        title: 'Acompanhando seu pedido',
        description:
          'Atualizamos o status automaticamente. O resultado também será enviado por e-mail quando estiver pronto.',
        tone: 'work',
      };
  }
}

export default function WaitingPage() {
  const params = useParams<{ orderId: string }>();
  const search = useSearchParams();
  const orderId = params.orderId;
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const trackedPay = useRef(false);
  const mail = supportMailto();

  const refresh = useCallback(async () => {
    try {
      const paymentId =
        search.get('payment_id') ?? search.get('collection_id') ?? undefined;
      if (paymentId) {
        await syncPayment(orderId, paymentId);
      }
      const o = await getOrder(orderId);
      setOrder(o);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Não foi possível carregar o pedido.',
      );
    }
  }, [orderId, search]);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 4000);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    if (!order || trackedPay.current) return;
    if (
      order.status === 'payment_approved' ||
      order.status === 'queued' ||
      order.status === 'processing' ||
      order.status === 'completed'
    ) {
      trackEvent('payment_approved', { status: order.status });
      trackedPay.current = true;
    }
    if (order.status === 'cancelled') {
      trackEvent('payment_declined', { status: order.status });
      trackedPay.current = true;
    }
  }, [order]);

  const status = order?.status;
  const presentation = statusPresentation(status);

  const paidLike =
    status === 'queued' ||
    status === 'processing' ||
    status === 'completed' ||
    status === 'partially_completed' ||
    status === 'payment_approved';

  const ready =
    status === 'completed' ||
    status === 'partially_completed' ||
    status === 'failed';

  return (
    <>
      <SiteHeader />
      <main className="section-pad py-16">
        <div className="container-narrow max-w-xl">
          <div className="card text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-gold-600">
              Confirmação do pedido
            </p>
            <h1 className="mt-3 font-display text-3xl text-ink-950">
              {presentation.title}
            </h1>
            <p className="mt-4 text-ink-600">{presentation.description}</p>

            <dl className="mt-8 space-y-3 rounded-2xl bg-ink-50 px-4 py-5 text-left text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-ink-500">Código do pedido</dt>
                <dd className="font-semibold text-ink-900">
                  {order?.orderNumber ?? '…'}
                </dd>
              </div>
              {order?.customerEmail ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-500">E-mail de entrega</dt>
                  <dd className="break-all text-ink-900">{order.customerEmail}</dd>
                </div>
              ) : null}
              {order?.accessCode ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-500">Código de acesso</dt>
                  <dd className="font-mono text-lg font-semibold tracking-widest text-ink-950">
                    {order.accessCode}
                  </dd>
                </div>
              ) : null}
              {order?.package?.name ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-500">Pacote</dt>
                  <dd className="text-ink-900">{order.package.name}</dd>
                </div>
              ) : null}
              {order?.package?.estimatedSlaHours ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-500">Prazo estimado</dt>
                  <dd className="text-ink-900">
                    até {order.package.estimatedSlaHours}h após confirmação
                  </dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-4">
                <dt className="text-ink-500">Status</dt>
                <dd className="font-semibold text-ink-900">
                  {order?.statusLabel ?? 'Carregando…'}
                </dd>
              </div>
            </dl>

            {error ? (
              <p className="mt-4 text-sm text-red-700" role="alert">
                {error}
              </p>
            ) : null}

            {order?.accessCode ? (
              <p className="mt-4 text-xs leading-relaxed text-ink-500">
                Guarde o código de 6 dígitos. Com o e-mail do pedido você pode
                reabrir o resultado em{' '}
                <Link href="/acessar" className="underline hover:text-ink-800">
                  /acessar
                </Link>
                .
              </p>
            ) : null}

            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => void refresh()}
              >
                Atualizar status
              </button>
              {ready || paidLike ? (
                <Link
                  href={`/pedido/${orderId}/resultado`}
                  className="btn-primary"
                  onClick={() => trackEvent('view_results')}
                >
                  {ready ? 'Ver resultado' : 'Acompanhar pedido'}
                </Link>
              ) : (
                <Link href="/" className="btn-primary">
                  Voltar ao início
                </Link>
              )}
            </div>

            {mail && siteConfig.supportEmail ? (
              <p className="mt-8 text-xs text-ink-500">
                Suporte:{' '}
                <a
                  href={mail}
                  className="underline hover:text-ink-800"
                  onClick={() => trackEvent('click_support')}
                >
                  {siteConfig.supportEmail}
                </a>
              </p>
            ) : (
              <p className="mt-8 text-xs text-ink-500">
                Precisa de ajuda? Consulte a{' '}
                <Link href="/reembolso" className="underline">
                  política de reembolso
                </Link>{' '}
                e a{' '}
                <Link href="/lgpd" className="underline">
                  exclusão de dados
                </Link>
                .
              </p>
            )}
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
