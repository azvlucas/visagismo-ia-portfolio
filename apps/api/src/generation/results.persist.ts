import { eq } from 'drizzle-orm';
import {
  orderResultImages,
  orderResults,
  type Db,
} from '@visagismo/db';
import type { OrderResultRecord, ResultImageRecord } from './results.memory.js';

/**
 * Persiste resultado de geração no Postgres para sobreviver a redeploy.
 * Imagens com dataUrl (mock) ficam em r2_key como data:…; arquivos R2 usam a key.
 */
export async function persistOrderResultToDb(
  db: Db,
  result: OrderResultRecord,
): Promise<void> {
  const analysisSource =
    result.analysisSource === 'llm' ? 'llm' : 'template_fallback';

  const existing = await db
    .select({ id: orderResults.id })
    .from(orderResults)
    .where(eq(orderResults.orderId, result.orderId))
    .limit(1);

  let resultId = existing[0]?.id ?? result.id;

  if (existing[0]) {
    await db
      .update(orderResults)
      .set({
        schemaVersion: result.schemaVersion,
        summary: result.summary,
        perceptionAnalysis: result.perceptionAnalysis,
        hairRecommendations: result.hairRecommendations,
        beardRecommendations: result.beardRecommendations,
        makeupRecommendations: result.makeupRecommendations,
        accessoriesRecommendations: result.accessoriesRecommendations,
        maintenancePlan: result.maintenancePlan,
        salonBrief: result.salonBrief,
        styleDirections: result.styleDirections,
        disclaimerVersion: result.disclaimerVersion,
        analysisSource,
        rawAnalysisJson: result.rawAnalysisJson as object,
        updatedAt: result.updatedAt,
      })
      .where(eq(orderResults.id, existing[0].id));
    resultId = existing[0].id;
    await db
      .delete(orderResultImages)
      .where(eq(orderResultImages.orderResultId, resultId));
  } else {
    await db.insert(orderResults).values({
      id: result.id,
      orderId: result.orderId,
      schemaVersion: result.schemaVersion,
      summary: result.summary,
      perceptionAnalysis: result.perceptionAnalysis,
      hairRecommendations: result.hairRecommendations,
      beardRecommendations: result.beardRecommendations,
      makeupRecommendations: result.makeupRecommendations,
      accessoriesRecommendations: result.accessoriesRecommendations,
      maintenancePlan: result.maintenancePlan,
      salonBrief: result.salonBrief,
      styleDirections: result.styleDirections,
      disclaimerVersion: result.disclaimerVersion,
      analysisSource,
      rawAnalysisJson: result.rawAnalysisJson as object,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    });
  }

  if (result.images.length > 0) {
    await db.insert(orderResultImages).values(
      result.images.map((img) => {
        const status: 'ready' | 'failed' =
          img.status === 'failed' ? 'failed' : 'ready';
        return {
          id: img.id,
          orderResultId: resultId,
          orderId: result.orderId,
          r2Key: img.dataUrl || img.r2Key || null,
          thumbR2Key: img.thumbR2Key,
          styleVariationKey: img.styleVariationKey,
          caption: img.caption,
          provider: img.provider,
          modelId: img.modelId,
          sortOrder: img.sortOrder,
          status,
          createdAt: result.createdAt,
          updatedAt: result.updatedAt,
        };
      }),
    );
  }
}

export async function loadOrderResultFromDb(
  db: Db,
  orderId: string,
): Promise<OrderResultRecord | null> {
  const [row] = await db
    .select()
    .from(orderResults)
    .where(eq(orderResults.orderId, orderId))
    .limit(1);
  if (!row) return null;

  const imgs = await db
    .select()
    .from(orderResultImages)
    .where(eq(orderResultImages.orderId, orderId));

  const images: ResultImageRecord[] = imgs.map((img) => {
    const key = img.r2Key ?? '';
    const isData = key.startsWith('data:');
    return {
      id: img.id,
      orderId,
      r2Key: isData ? '' : key,
      thumbR2Key: img.thumbR2Key,
      styleVariationKey: img.styleVariationKey ?? '',
      caption: img.caption ?? '',
      provider: img.provider ?? 'unknown',
      modelId: img.modelId ?? '',
      sortOrder: img.sortOrder,
      status: img.status === 'failed' ? 'failed' : 'ready',
      dataUrl: isData ? key : undefined,
    };
  });

  return {
    id: row.id,
    orderId: row.orderId,
    schemaVersion: row.schemaVersion,
    summary: row.summary ?? '',
    perceptionAnalysis: row.perceptionAnalysis ?? '',
    hairRecommendations: row.hairRecommendations ?? '',
    beardRecommendations: row.beardRecommendations ?? '',
    makeupRecommendations: row.makeupRecommendations ?? '',
    accessoriesRecommendations: row.accessoriesRecommendations ?? '',
    maintenancePlan: row.maintenancePlan ?? '',
    salonBrief: row.salonBrief ?? '',
    styleDirections:
      (row.styleDirections as OrderResultRecord['styleDirections']) ?? [],
    disclaimerVersion: row.disclaimerVersion ?? '1',
    analysisSource:
      row.analysisSource === 'llm' ? 'llm' : 'template_fallback',
    rawAnalysisJson: row.rawAnalysisJson,
    images,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
