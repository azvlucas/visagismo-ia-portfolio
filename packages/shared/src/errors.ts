/** API error codes (English SCREAMING_SNAKE). Messages are pt-BR at the edge. */
export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
  'PACKAGE_INACTIVE',
  'QUESTIONNAIRE_INCOMPLETE',
  'PHOTOS_REQUIRED',
  'CONSENT_REQUIRED',
  'AGE_ATTESTATION_REQUIRED',
  'ORDER_NOT_CHECKOUTABLE',
  'ALREADY_PAID',
  'PAYMENTS_DISABLED',
  'ACCESS_REVOKED',
  'INVALID_TOKEN',
  'INVALID_TRANSITION',
  'PHOTO_VALIDATION_FAILED',
  'GENERATION_DISABLED',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export const ERROR_MESSAGES_PT: Record<ErrorCode, string> = {
  VALIDATION_ERROR: 'Dados inválidos. Verifique os campos e tente de novo.',
  UNAUTHORIZED: 'Você precisa estar autenticado.',
  FORBIDDEN: 'Você não tem permissão para esta ação.',
  NOT_FOUND: 'Recurso não encontrado.',
  CONFLICT: 'Conflito de estado. Atualize a página e tente novamente.',
  RATE_LIMITED: 'Muitas tentativas. Aguarde um momento.',
  INTERNAL_ERROR: 'Erro interno. Nossa equipe foi notificada.',
  PACKAGE_INACTIVE: 'Este pacote não está mais disponível.',
  QUESTIONNAIRE_INCOMPLETE: 'Complete o questionário antes de continuar.',
  PHOTOS_REQUIRED: 'Envie a foto frontal para continuar.',
  CONSENT_REQUIRED: 'É necessário aceitar os termos e o processamento das imagens.',
  AGE_ATTESTATION_REQUIRED: 'Confirme que você tem 18 anos ou mais.',
  ORDER_NOT_CHECKOUTABLE: 'Este pedido não pode ser pago neste status.',
  ALREADY_PAID: 'Este pedido já foi pago ou está em processamento.',
  PAYMENTS_DISABLED: 'Pagamentos temporariamente indisponíveis.',
  ACCESS_REVOKED: 'O acesso a este resultado foi encerrado.',
  INVALID_TOKEN: 'Link ou sessão inválidos ou expirados.',
  INVALID_TRANSITION: 'Transição de status inválida.',
  PHOTO_VALIDATION_FAILED: 'A foto não atende aos requisitos de qualidade.',
  GENERATION_DISABLED: 'A geração de imagens está temporariamente desativada.',
};

export interface ApiErrorBody {
  error: {
    code: ErrorCode | string;
    message: string;
    details?: unknown;
  };
}
