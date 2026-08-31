/**
 * E-mail de suporte centralizado.
 * Nunca usar endereço fictício (ex.: suporte@dominio.com) em produção.
 */
export function getSupportEmail(): string | null {
  const email = (
    process.env.SUPPORT_EMAIL ||
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL ||
    ''
  ).trim();
  if (!email) return null;
  if (email.includes('dominio.com') || email.includes('example.com')) {
    return null;
  }
  return email;
}

export function supportLine(): string {
  const email = getSupportEmail();
  return email
    ? `Suporte: ${email}`
    : 'Suporte: use o canal indicado no site ou responda este e-mail se for de confirmação.';
}
