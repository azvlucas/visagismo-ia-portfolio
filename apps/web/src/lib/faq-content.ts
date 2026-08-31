import {
  analysisModeDescription,
  siteConfig,
} from '@/lib/site-config';

export function buildFaqItems() {
  const support = siteConfig.supportEmail
    ? `Entre em contato pelo e-mail ${siteConfig.supportEmail}.`
    : 'Utilize o canal de exclusão de dados ou o formulário de suporte quando disponível no site.';

  return [
    {
      q: 'O que é visagismo?',
      a: 'É a prática de alinhar aparência e estilo à mensagem que você quer transmitir — não apenas “ficar bonito”, mas comunicar com coerência.',
    },
    {
      q: 'O resultado é feito por inteligência artificial?',
      a: `Sim. ${analysisModeDescription()} As recomendações e simulações são geradas a partir do seu questionário e das suas fotos.`,
    },
    {
      q: 'Existe revisão humana?',
      a:
        siteConfig.analysisMode === 'automated'
          ? 'No fluxo padrão, a geração é automatizada. A equipe de suporte pode intervir em falhas técnicas ou solicitações de reprocessamento.'
          : analysisModeDescription(),
    },
    {
      q: 'O serviço substitui um profissional presencial?',
      a: 'Não. Ele oferece direção de imagem e simulações de cabelo (e barba, quando aplicável) para apoiar a sua decisão e o trabalho do cabeleireiro ou barbeiro.',
    },
    {
      q: 'Quais tipos de recomendações posso receber?',
      a: 'Direções de corte e finalização de cabelo, barba/pelo facial quando fizer sentido no seu caso, orientações de manutenção e material para levar ao cabeleireiro ou barbeiro, de acordo com o pacote.',
    },
    {
      q: 'Como devo tirar as fotos?',
      a: 'Boa iluminação, sem filtros, rosto visível, foto frontal e, se possível, lateral. Evite óculos escuros, acessórios grandes e sombras fortes. Instruções detalhadas aparecem na etapa de fotos.',
    },
    {
      q: 'Minhas fotos estão protegidas?',
      a: 'As fotos ficam em armazenamento privado e só são usadas no contexto do seu pedido. O acesso ao resultado é por link/sessão do pedido.',
    },
    {
      q: 'Minhas imagens são utilizadas para treinamento?',
      a: 'Não utilizamos suas imagens para treinar modelos sem a sua autorização expressa.',
    },
    {
      q: 'Quanto tempo demora?',
      a: 'O prazo estimado aparece em cada pacote (em horas). Após a confirmação do pagamento, o processamento é enfileirado automaticamente.',
    },
    {
      q: 'Como receberei o resultado?',
      a: 'Por e-mail com o código de 6 dígitos e o link para /acessar. Na confirmação do pedido o código também aparece. Em qualquer dispositivo, abra “Acessar resultado”, informe o e-mail do pedido e o código, enquanto o resultado estiver no prazo de retenção.',
    },
    {
      q: 'Perdi o e-mail. Como acesso de novo?',
      a: 'Use a página “Acessar resultado” com o mesmo e-mail do pedido e o código de 6 dígitos (enviado por e-mail e exibido na confirmação).',
    },
    {
      q: 'Posso solicitar correção?',
      a: `Solicitações relacionadas a erros técnicos podem ser feitas em até ${siteConfig.reviewWindowDays} dias após a entrega, pelo suporte.`,
    },
    {
      q: 'Posso reenviar minhas fotos?',
      a: 'Sim, quando o sistema indicar necessidade de reenvio (por qualidade ou falha) ou conforme a política de reprocessamento do pedido.',
    },
    {
      q: 'Em quais situações existe reembolso?',
      a: 'Consulte a Política de Reembolso e os Termos. Em geral, falhas técnicas definitivas podem gerar reprocessamento ou avaliação de reembolso; preferência de gosto após entrega conforme o pacote não é, por si só, motivo automático de reembolso.',
    },
    {
      q: 'Preciso criar uma conta?',
      a: 'Não é obrigatório criar conta com senha. Você informa nome e e-mail; o acesso ao resultado é por e-mail do pedido + código de 6 dígitos em /acessar.',
    },
    {
      q: 'Posso acessar o resultado novamente?',
      a: 'Sim, em /acessar com o e-mail do pedido e o mesmo código de 6 dígitos, enquanto o conteúdo estiver no prazo de retenção.',
    },
    {
      q: 'Por quanto tempo meus arquivos ficam disponíveis?',
      a: `Originais cerca de ${siteConfig.retentionOriginalsDays} dias; simulações geradas cerca de ${siteConfig.retentionGeneratedDays} dias, salvo exclusão antecipada ou obrigação legal.`,
    },
    {
      q: 'Como entrar em contato com o suporte?',
      a: support,
    },
  ];
}

export function getFaqJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: buildFaqItems().map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.a,
      },
    })),
  };
}
