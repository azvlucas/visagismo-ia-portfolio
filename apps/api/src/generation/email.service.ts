import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { supportLine } from '../common/support-email.js';
import { memoryEmails } from './results.memory.js';

@Injectable()
export class EmailService {
  async sendGeneric(input: { to: string; subject: string; bodyText: string }) {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (apiKey) {
      try {
        const from =
          process.env.EMAIL_FROM ?? 'Visagismo <onboarding@resend.dev>';
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from,
            to: [input.to],
            subject: input.subject,
            text: input.bodyText,
          }),
        });
        if (!res.ok) {
          console.warn('Resend failed', res.status, await res.text());
        }
      } catch (err) {
        console.warn('Resend error', err);
      }
    } else {
      console.log(
        JSON.stringify({
          email: 'generic',
          to: input.to,
          subject: input.subject,
        }),
      );
    }
    return { ok: true };
  }

  async sendResultReady(input: {
    orderId: string;
    orderNumber: string;
    to: string;
    customerName: string;
    packageName: string;
    kind: 'success' | 'partial' | 'failure';
    /** @deprecated Prefer e-mail + código em /acessar (qualquer dispositivo). */
    resultPath?: string;
    accessCode?: string | null;
  }) {
    const appUrl = (process.env.APP_URL ?? 'http://localhost:3000').replace(
      /\/$/,
      '',
    );
    // Acesso só via /acessar (e-mail + código). Link direto ao resultado não
    // autentica em outro dispositivo e gera expectativa falsa.
    const accessUrl = `${appUrl}/acessar`;
    const codeLine = input.accessCode
      ? `Seu código de acesso (6 dígitos): ${input.accessCode}`
      : null;
    const howToAccess = [
      `Para ver o resultado em qualquer dispositivo:`,
      `1. Abra: ${accessUrl}`,
      `2. Informe o e-mail do pedido: ${input.to}`,
      codeLine ? `3. Digite o código: ${input.accessCode}` : null,
      ``,
      `Guarde o código. Ele permanece o mesmo se o pedido for reprocessado.`,
    ].filter((line): line is string => line != null);

    const subjects = {
      success: `Seu resultado de visagismo está pronto (${input.orderNumber})`,
      partial: `Seu resultado parcial de visagismo (${input.orderNumber})`,
      failure: `Atualização do seu pedido de visagismo (${input.orderNumber})`,
    };

    const support = supportLine();
    const bodies = {
      success: [
        `Olá, ${input.customerName}!`,
        ``,
        `Sua análise do pacote ${input.packageName} está pronta.`,
        `Pedido: ${input.orderNumber}`,
        ``,
        ...howToAccess,
        ``,
        `O conteúdo permanece disponível por tempo limitado conforme nossa política de retenção.`,
        support,
      ].join('\n'),
      partial: [
        `Olá, ${input.customerName}!`,
        ``,
        `Geramos parte do seu resultado (recomendações e algumas simulações).`,
        `Pedido: ${input.orderNumber}`,
        ``,
        ...howToAccess,
        ``,
        `Se faltar algo por falha técnica, você pode solicitar reprocessamento pelo suporte.`,
        support,
      ].join('\n'),
      failure: [
        `Olá, ${input.customerName}!`,
        ``,
        `Não conseguimos concluir a geração das simulações nesta tentativa.`,
        `Pedido: ${input.orderNumber}`,
        codeLine,
        codeLine
          ? `Quando o reprocessamento concluir, use o mesmo e-mail e código em ${accessUrl}.`
          : `Quando o reprocessamento concluir, acesse em ${accessUrl} com o e-mail do pedido e o código de 6 dígitos.`,
        `Já registramos o pedido para reprocessamento.`,
        support,
      ]
        .filter(Boolean)
        .join('\n'),
    };

    const subject = subjects[input.kind];
    const bodyText = bodies[input.kind];

    // Resend when configured; otherwise log structured event (no PII beyond destination in ops logs).
    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (apiKey) {
      try {
        const from =
          process.env.EMAIL_FROM ?? 'Visagismo <onboarding@resend.dev>';
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from,
            to: [input.to],
            subject,
            text: bodyText,
          }),
        });
        if (!res.ok) {
          console.warn('Resend failed', res.status, await res.text());
        }
      } catch (err) {
        console.warn('Resend error', err);
      }
    } else {
      console.log(
        JSON.stringify({
          email: 'result_ready',
          to: input.to,
          subject,
          accessUrl,
          kind: input.kind,
        }),
      );
    }

    memoryEmails.save({
      id: randomUUID(),
      orderId: input.orderId,
      to: input.to,
      subject,
      kind: input.kind,
      bodyText,
      resultUrl: accessUrl,
      createdAt: new Date(),
    });

    return { resultUrl: accessUrl, subject };
  }
}
