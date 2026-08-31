import { z } from 'zod';
import { questionnairePayloadSchema } from './questionnaire.js';

export const createOrderSchema = z
  .object({
    name: z.string().min(2).max(120),
    email: z.string().email().max(255),
    emailConfirm: z.string().email().max(255),
    /** UUID do pacote no catálogo (preferencial). */
    packageId: z.string().uuid().optional(),
    /** Slug estável (ex.: essencial) — usado se o ID do fallback offline estiver desatualizado. */
    packageSlug: z.string().min(1).max(80).optional(),
  })
  .refine((d) => d.email.toLowerCase() === d.emailConfirm.toLowerCase(), {
    message: 'Os e-mails não coincidem.',
    path: ['emailConfirm'],
  })
  .refine((d) => Boolean(d.packageId || d.packageSlug), {
    message: 'Informe o pacote.',
    path: ['packageId'],
  });

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

/** Acesso ao resultado: e-mail + código de 6 dígitos do pedido. */
export const orderAccessSchema = z.object({
  email: z.string().email().max(255),
  accessCode: z
    .string()
    .min(4)
    .max(12)
    .transform((v) => v.replace(/\D/g, '').slice(0, 6))
    .refine((v) => v.length === 6, 'Informe o código de 6 dígitos.'),
});

export type OrderAccessInput = z.infer<typeof orderAccessSchema>;

export const patchOrderSchema = z.object({
  step: z.enum([
    'identity',
    'objective',
    'context',
    'preferences',
    'photos',
    'review',
  ]).optional(),
  name: z.string().min(2).max(120).optional(),
  questionnaire: questionnairePayloadSchema.partial().optional(),
  consentPrivacy: z.boolean().optional(),
  consentImageProcessing: z.boolean().optional(),
  marketingOptIn: z.boolean().optional(),
  ageAttested: z.boolean().optional(),
});

export type PatchOrderInput = z.infer<typeof patchOrderSchema>;

export const sessionExchangeSchema = z.object({
  orderId: z.string().uuid(),
  token: z.string().min(20),
});

export type SessionExchangeInput = z.infer<typeof sessionExchangeSchema>;

export const ratingSchema = z.object({
  score: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});
