import { z } from 'zod';

/** Frozen package pricing/config at first successful checkout. */
export const packageSnapshotSchema = z.object({
  packageId: z.string().uuid(),
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  priceCents: z.number().int().nonnegative(),
  currency: z.literal('BRL'),
  imageCount: z.number().int().positive().max(50),
  styleVariationCount: z.number().int().positive().max(20),
  estimatedSlaHours: z.number().int().positive(),
  features: z.array(z.string()),
  compareModels: z.boolean(),
  promoText: z.string().nullable(),
  discountPercent: z.number().min(0).max(100).nullable(),
  models: z.array(
    z.object({
      aiModelId: z.string().uuid(),
      externalModelId: z.string(),
      providerKey: z.string(),
      kind: z.enum(['image', 'text']),
      role: z.enum(['primary', 'fallback', 'compare']),
      priority: z.number().int(),
      estimatedCostUsdMicros: z.number().int().nonnegative(),
    }),
  ),
  frozenAt: z.string().datetime(),
});

export type PackageSnapshot = z.infer<typeof packageSnapshotSchema>;
