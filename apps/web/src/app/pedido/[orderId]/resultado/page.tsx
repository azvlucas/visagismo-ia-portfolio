'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { trackEvent } from '@/lib/analytics';
import {
  downloadImage,
  extensionFromUrlOrMime,
} from '@/lib/download-image';
import {
  getOrderResult,
  type OrderResultResponse,
} from '@/lib/orders-api';
import { siteConfig, supportMailto } from '@/lib/site-config';

type ResultImage = NonNullable<
  NonNullable<OrderResultResponse['result']>['images']
>[number];

export default function ResultPage() {
  const params = useParams<{ orderId: string }>();
  const orderId = params.orderId;
  const [data, setData] = useState<OrderResultResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadAllBusy, setDownloadAllBusy] = useState(false);
  const [downloadNote, setDownloadNote] = useState<string | null>(null);
  const tracked = useRef(false);
  const mail = supportMailto();

  const load = useCallback(async () => {
    try {
      const res = await getOrderResult(orderId);
      setData(res);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar resultado');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 5000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (data?.result && !tracked.current) {
      trackEvent('view_results');
      tracked.current = true;
    }
  }, [data?.result]);

  const order = data?.order;
  const result = data?.result;
  const originalPhotos = data?.originalPhotos ?? [];
  const isAdminViewer = data?.viewer === 'admin';
  const processing =
    order?.status === 'queued' ||
    order?.status === 'processing' ||
    order?.status === 'payment_approved';

  const failed = order?.status === 'failed';

  function imageTitle(img: ResultImage): string {
    return (
      result?.styleDirections.find((d) => d.key === img.styleVariationKey)
        ?.title ?? img.styleVariationKey ?? 'simulacao'
    );
  }

  function buildFilename(img: ResultImage, index: number): string {
    const orderPart = order?.orderNumber?.replace(/[^\w-]+/g, '') || orderId.slice(0, 8);
    const titleSlug = imageTitle(img)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40);
    const ext = extensionFromUrlOrMime(img.url || '');
    return `visagismo-${orderPart}-${index + 1}-${titleSlug || 'estilo'}.${ext}`;
  }

  async function handleDownloadOne(img: ResultImage, index: number) {
    if (!img.url) {
      setDownloadNote('Esta simulação ainda não tem arquivo para baixar.');
      return;
    }
    setDownloadingId(img.id);
    setDownloadNote(null);
    try {
      await downloadImage({
        url: img.url,
        filename: buildFilename(img, index),
      });
      trackEvent('download_result_image', {
        order_id: orderId,
        style: img.styleVariationKey,
      });
    } catch (err) {
      setDownloadNote(
        err instanceof Error
          ? err.message
          : 'Não foi possível baixar a imagem. Tente abrir em nova aba.',
      );
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleDownloadAll() {
    const images = (result?.images ?? []).filter((i) => i.url);
    if (!images.length) {
      setDownloadNote('Nenhuma simulação pronta para baixar.');
      return;
    }
    setDownloadAllBusy(true);
    setDownloadNote(null);
    try {
      for (let i = 0; i < images.length; i++) {
        const img = images[i]!;
        await downloadImage({
          url: img.url!,
          filename: buildFilename(img, i),
        });
        // pequeno intervalo para o browser não bloquear downloads em sequência
        if (i < images.length - 1) {
          await new Promise((r) => setTimeout(r, 350));
        }
      }
      trackEvent('download_result_all', {
        order_id: orderId,
        count: images.length,
      });
      setDownloadNote(
        `${images.length} simulação${images.length === 1 ? '' : 'ões'} enviada${images.length === 1 ? '' : 's'} para download.`,
      );
    } catch (err) {
      setDownloadNote(
        err instanceof Error
          ? err.message
          : 'Falha ao baixar algumas imagens. Tente uma a uma.',
      );
    } finally {
      setDownloadAllBusy(false);
    }
  }

  return (
    <>
      <SiteHeader />
      <main className="section-pad py-12">
        <div className="container-narrow max-w-4xl">
          <p className="text-sm text-ink-500">
            <Link href="/" className="hover:text-ink-800">
              Início
            </Link>{' '}
            / Resultado
          </p>

          <h1 className="mt-4 font-display text-3xl font-semibold text-ink-950 sm:text-4xl">
            Seu resultado de visagismo
          </h1>

          {loading && !data ? (
            <p className="mt-6 text-ink-600" role="status">
              Carregando seu resultado…
            </p>
          ) : null}

          {error ? (
            <div
              className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800"
              role="alert"
            >
              <p className="font-semibold">Não foi possível abrir o resultado</p>
              <p className="mt-1">{error}</p>
              {/autentic|unauthorized|sessão|token/i.test(error) ? (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-red-900/90">
                  <li>
                    Clientes: use o link enviado por e-mail (ele cria a sessão do
                    pedido).
                  </li>
                  <li>
                    Admin: faça login em{' '}
                    <Link href="/admin/login" className="underline">
                      /admin
                    </Link>{' '}
                    nesta mesma aba e abra o resultado de novo (ou veja o
                    pedido em Admin → Pedidos).
                  </li>
                </ul>
              ) : null}
            </div>
          ) : null}

          {order ? (
            <div className="card mt-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold text-ink-900">
                  {order.orderNumber}
                  {order.package?.name ? ` · ${order.package.name}` : ''}
                </p>
                <p className="text-sm font-medium text-ink-700">
                  {order.statusLabel}
                </p>
              </div>
              {order.customerEmail ? (
                <p className="mt-2 text-sm text-ink-600">
                  Enviado também para {order.customerEmail}
                </p>
              ) : null}
              {order.failureMessagePublic ? (
                <p className="mt-3 text-sm text-amber-800">
                  {order.failureMessagePublic}
                </p>
              ) : null}
            </div>
          ) : null}

          {processing ? (
            <div className="card mt-6 border-gold-500/30">
              <p className="font-display text-xl text-ink-950">
                Gerando suas recomendações e simulações…
              </p>
              <p className="mt-2 text-sm text-ink-600">
                Esta página atualiza automaticamente. Você também receberá um
                e-mail quando o resultado estiver pronto. Pode fechar a aba com
                tranquilidade.
              </p>
            </div>
          ) : null}

          {failed && !result ? (
            <div className="card mt-6 border-red-200 bg-red-50/50">
              <p className="font-display text-xl text-ink-950">
                Não concluímos a geração nesta tentativa
              </p>
              <p className="mt-2 text-sm text-ink-600">
                Registramos o pedido para reprocessamento. Consulte a{' '}
                <Link href="/reembolso" className="underline">
                  política de reembolso
                </Link>
                {mail && siteConfig.supportEmail ? (
                  <>
                    {' '}
                    ou escreva para{' '}
                    <a href={mail} className="underline">
                      {siteConfig.supportEmail}
                    </a>
                  </>
                ) : null}
                .
              </p>
            </div>
          ) : null}

          {isAdminViewer ? (
            <p className="mt-4 rounded-xl bg-gold-400/15 px-4 py-2 text-xs text-ink-700">
              Visualizando com sessão de administrador.
            </p>
          ) : null}

          {originalPhotos.length > 0 ? (
            <section className="mt-8">
              <h2 className="font-display text-2xl text-ink-950">
                Fotos enviadas
              </h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {originalPhotos.map((ph) => (
                  <figure key={ph.id} className="card overflow-hidden p-0">
                    {ph.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={ph.url}
                        alt={`Foto ${ph.type}`}
                        className="aspect-[4/5] w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex aspect-[4/5] items-center justify-center bg-ink-200 text-sm text-ink-500">
                        Preview indisponível
                        <span className="mt-1 block text-xs">
                          (arquivo não encontrado no storage)
                        </span>
                      </div>
                    )}
                    <figcaption className="p-3 text-sm text-ink-700">
                      <span className="font-semibold capitalize">{ph.type}</span>
                      {ph.width && ph.height
                        ? ` · ${ph.width}×${ph.height}`
                        : ''}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </section>
          ) : null}

          {result ? (
            <div className="mt-8 space-y-8">
              <section className="card">
                <h2 className="font-display text-2xl text-ink-950">
                  Direção de imagem
                </h2>
                <p className="mt-3 leading-relaxed text-ink-700">
                  {result.summary}
                </p>
                <p className="mt-4 text-sm leading-relaxed text-ink-600">
                  {result.perceptionAnalysis}
                </p>
              </section>

              <section>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="font-display text-2xl text-ink-950">
                      Simulações personalizadas
                    </h2>
                    <p className="mt-1 text-sm text-ink-600">
                      Salve as imagens no seu dispositivo para mostrar ao
                      cabeleireiro ou barbeiro.
                    </p>
                  </div>
                  {result.images.some((i) => i.url) ? (
                    <button
                      type="button"
                      className="btn-secondary text-sm"
                      disabled={downloadAllBusy || downloadingId !== null}
                      onClick={() => void handleDownloadAll()}
                    >
                      {downloadAllBusy
                        ? 'Baixando…'
                        : `Baixar todas (${result.images.filter((i) => i.url).length})`}
                    </button>
                  ) : null}
                </div>
                {downloadNote ? (
                  <p
                    className="mt-3 rounded-xl bg-gold-400/15 px-3 py-2 text-sm text-ink-800"
                    role="status"
                  >
                    {downloadNote}
                  </p>
                ) : null}
                {result.images.length === 0 ? (
                  <p className="mt-4 text-sm text-ink-500">
                    Nenhuma simulação disponível neste pedido.
                  </p>
                ) : (
                  <div className="mt-4 grid gap-5 sm:grid-cols-2">
                    {result.images.map((img, index) => (
                      <figure key={img.id} className="card overflow-hidden p-0">
                        {img.url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={img.url}
                            alt={
                              img.caption ||
                              'Simulação de estilo personalizada'
                            }
                            className="aspect-square w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex aspect-square items-center justify-center bg-ink-200 p-4 text-center text-sm text-ink-500">
                            Preview indisponível
                            <span className="mt-1 block text-xs">
                              Verifique R2/storage e se a geração concluiu.
                            </span>
                          </div>
                        )}
                        <figcaption className="p-4">
                          <p className="font-semibold text-ink-900">
                            {imageTitle(img)}
                          </p>
                          <p className="mt-1 text-sm text-ink-600">
                            {img.caption}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="btn-primary px-3 py-1.5 text-xs"
                              disabled={!img.url || downloadingId === img.id}
                              onClick={() => void handleDownloadOne(img, index)}
                            >
                              {downloadingId === img.id
                                ? 'Salvando…'
                                : 'Salvar foto'}
                            </button>
                            {img.url ? (
                              <a
                                href={img.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn-secondary px-3 py-1.5 text-xs"
                              >
                                Abrir em nova aba
                              </a>
                            ) : null}
                          </div>
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                )}
              </section>

              <section className="grid gap-4 md:grid-cols-2">
                <Rec title="Cabelo" text={result.hairRecommendations} />
                <Rec title="Barba" text={result.beardRecommendations} />
                <Rec
                  title="Acessórios"
                  text={result.accessoriesRecommendations}
                />
                <Rec title="Manutenção" text={result.maintenancePlan} />
                <Rec
                  title="Material para o cabeleireiro ou barbeiro"
                  text={result.salonBrief}
                />
              </section>

              <p className="text-xs leading-relaxed text-ink-500">
                As recomendações e imagens são sugestões estéticas. Não garantem
                percepção social e não substituem avaliação profissional de saúde
                capilar ou dermatológica. Em caso de erro técnico, veja a{' '}
                <Link href="/reembolso" className="underline">
                  política de reembolso
                </Link>
                .
              </p>
            </div>
          ) : null}

          <div className="mt-10 flex flex-wrap gap-3">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => void load()}
            >
              Atualizar
            </button>
            <Link href="/" className="btn-primary">
              Voltar ao início
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function Rec({ title, text }: { title: string; text: string }) {
  if (!text?.trim()) return null;
  return (
    <article className="card">
      <h3 className="font-display text-lg text-ink-950">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-700">{text}</p>
    </article>
  );
}
