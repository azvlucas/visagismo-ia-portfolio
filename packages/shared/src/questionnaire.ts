import { z } from 'zod';

export const OBJECTIVES = [
  'more_serious',
  'confidence',
  'modern',
  'authority',
  'younger',
  'creative',
  'professional',
  'attractive',
  'discover_styles',
] as const;

export const OBJECTIVE_LABELS_PT: Record<(typeof OBJECTIVES)[number], string> = {
  more_serious: 'Seriedade',
  confidence: 'Confiança',
  modern: 'Modernidade',
  authority: 'Autoridade',
  younger: 'Aparência mais jovem',
  creative: 'Criatividade',
  professional: 'Imagem profissional',
  attractive: 'Atratividade / presença',
  discover_styles: 'Descobrir o que combina comigo',
};

export const CONTEXTS = [
  'professional',
  'social_media',
  'personal',
  'events',
  'repositioning',
  'everyday',
] as const;

export const CONTEXT_LABELS_PT: Record<(typeof CONTEXTS)[number], string> = {
  professional: 'Ambiente profissional',
  social_media: 'Redes sociais',
  personal: 'Encontros e vida pessoal',
  events: 'Eventos',
  repositioning: 'Reposicionamento de imagem',
  everyday: 'Uso cotidiano',
};

export const CHANGE_INTENSITY = ['subtle', 'moderate', 'bold'] as const;

export const MAINTENANCE_TIME = ['low', 'medium', 'high'] as const;

export const questionnairePayloadSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  objectives: z.array(z.enum(OBJECTIVES)).min(1).max(5),
  contexts: z.array(z.enum(CONTEXTS)).min(1).max(4),
  likedStyles: z.array(z.string().max(80)).max(12).default([]),
  dislikedStyles: z.array(z.string().max(80)).max(12).default([]),
  maintenanceTime: z.enum(MAINTENANCE_TIME),
  changeIntensity: z.enum(CHANGE_INTENSITY),
  restrictions: z.string().max(1000).optional().default(''),
  useBeard: z.boolean().optional(),
  useGlasses: z.boolean().optional(),
  useAccessories: z.boolean().optional(),
  useMakeup: z.boolean().optional(),
  desiredHairLength: z
    .enum(['very_short', 'short', 'medium', 'long', 'any'])
    .optional()
    .default('any'),
  openToColorChange: z.boolean().optional().default(false),
});

export type QuestionnairePayload = z.infer<typeof questionnairePayloadSchema>;
