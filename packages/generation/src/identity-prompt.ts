/**
 * Prompts de imagem centrados em **editar a foto real do cliente**.
 * O template do sistema é editável no admin (app_settings.image_system_prompt).
 *
 * Placeholders no template:
 * - {{title}} — nome da direção de estilo
 * - {{stylePrompt}} — instrução específica da simulação (imagePrompt da análise)
 */

/** Template padrão (system) aplicado em toda geração com foto de referência. */
export const DEFAULT_IMAGE_SYSTEM_PROMPT = `IMAGE EDITING TASK (not text-to-image from scratch).
You are given the CLIENT photograph as the base image.
KEEP the exact same person: face shape, eyes, nose, mouth, skin tone, age, expression, head pose, camera angle, and background as much as possible.
ONLY change hairstyle, hair length/volume/texture, and beard/facial hair when applicable as described. Do NOT add or change makeup.
Do NOT invent a different person, celebrity lookalike, or stock model.
Do NOT change ethnicity, gender presentation, or facial identity.
Result must look like a realistic before/after simulation on the same photo.
Style direction: {{title}}.
Requested look: {{stylePrompt}}
Photorealistic, natural skin texture, no text, no watermark, no logo.`;

export const IMAGE_SYSTEM_PROMPT_PLACEHOLDERS = [
  { key: '{{title}}', description: 'Título da direção de estilo (ex.: Clássico limpo)' },
  {
    key: '{{stylePrompt}}',
    description: 'Instrução específica da simulação (imagePrompt da análise)',
  },
] as const;

export function applyImageSystemTemplate(
  template: string,
  vars: { title?: string; stylePrompt: string },
): string {
  return template
    .replaceAll('{{title}}', vars.title?.trim() || 'Style update')
    .replaceAll('{{stylePrompt}}', vars.stylePrompt.trim())
    .replaceAll('{{style_prompt}}', vars.stylePrompt.trim())
    .trim();
}

export function buildIdentityEditPrompt(input: {
  stylePrompt: string;
  title?: string;
  hasReference: boolean;
  /** Template do admin; se vazio, usa DEFAULT_IMAGE_SYSTEM_PROMPT */
  systemTemplate?: string | null;
}): string {
  if (!input.hasReference) {
    return [
      input.stylePrompt,
      'Photorealistic portrait. No text overlays or watermarks.',
    ].join(' ');
  }

  const template =
    input.systemTemplate?.trim() || DEFAULT_IMAGE_SYSTEM_PROMPT;

  return applyImageSystemTemplate(template, {
    title: input.title,
    stylePrompt: input.stylePrompt,
  });
}

/** Reforço em português para análise LLM → imagePrompt em inglês */
export const IMAGE_PROMPT_IDENTITY_RULES_EN = `
Each imagePrompt must instruct an IMAGE EDIT of the client's real photo:
- Keep the same face identity, bone structure, skin, age, and pose
- Only change haircut, hair styling, and beard/facial hair (and light grooming if needed)
- Never invent a new person from scratch
Write imagePrompt in English, concise, for an image-edit model.
`.trim();

export function styleImagePromptFromDirection(input: {
  title: string;
  brief: string;
  intensity?: string;
}): string {
  return [
    `Edit the client's photo for a "${input.title}" look.`,
    input.brief,
    'Change only haircut and facial hair styling while preserving identity.',
    'Photorealistic before/after simulation on the same person.',
  ].join(' ');
}
