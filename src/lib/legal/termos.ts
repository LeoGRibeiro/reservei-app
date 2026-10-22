/**
 * @file termos.ts
 * @description Versão e conteúdo dos Termos de Uso e da Política de Privacidade (LGPD).
 *
 * Papéis (SPEC/2026-10-22-mvp-go-live.md §6): a ARENA é a controladora dos dados dos atletas; a plataforma
 * é a operadora (trata os dados em nome da arena). Os textos são um modelo e devem ser revisados por um
 * advogado antes do primeiro contrato. Ao mudar o conteúdo, atualize {@link VERSAO_TERMOS}: o aceite gravado
 * em cada reserva/cadastro aponta para a versão vigente naquele momento.
 */

import { NOME_PRODUTO } from "@/lib/marca";

/** Versão vigente dos termos (data da última alteração). */
export const VERSAO_TERMOS = "2026-10-22";

/** Política de cancelamento exibida quando a arena ainda não escreveu a sua. */
export const POLITICA_CANCELAMENTO_PADRAO =
  "Cancelamentos e remarcações devem ser combinados diretamente com a arena pelo WhatsApp. " +
  "O sinal pago garante o horário e pode não ser devolvido em cancelamentos de última hora.";

/** Dados da arena usados para preencher os textos. */
export interface DadosArenaTermos {
  nome: string;
  cidade?: string;
  estado?: string;
  email?: string;
  whatsapp?: string;
  cnpjCpf?: string;
  politicaCancelamento?: string;
}

/** Seção de um documento legal. */
export interface SecaoLegal {
  titulo: string;
  paragrafos: string[];
}

/**
 * Termos de Uso do portal de reservas da arena.
 *
 * @param arena Dados da arena
 * @returns Seções do documento
 */
export function montarTermosDeUso(arena: DadosArenaTermos): SecaoLegal[] {
  const contato = [arena.whatsapp && `WhatsApp ${arena.whatsapp}`, arena.email].filter(Boolean).join(" ou ");
  return [
    {
      titulo: "1. Quem somos",
      paragrafos: [
        `Este site de reservas pertence à ${arena.nome}${arena.cidade ? ` (${arena.cidade}${arena.estado ? `/${arena.estado}` : ""})` : ""}, responsável pelas quadras, pelos horários e pelo atendimento. A tecnologia é fornecida pela plataforma ${NOME_PRODUTO}.`,
      ],
    },
    {
      titulo: "2. Reservas e pagamento",
      paragrafos: [
        "A reserva só é garantida depois da confirmação do pagamento do sinal (ou do valor integral). Enquanto o pagamento não é concluído, o horário fica segurado por tempo limitado e depois é liberado.",
        "O pagamento é feito por Pix diretamente para a conta da arena. O restante, quando houver, é pago no local.",
        "Os preços exibidos no momento da reserva são os que valem para ela.",
      ],
    },
    {
      titulo: "3. Cancelamento e remarcação",
      paragrafos: [arena.politicaCancelamento?.trim() || POLITICA_CANCELAMENTO_PADRAO],
    },
    {
      titulo: "4. Conduta e uso das quadras",
      paragrafos: [
        "O atleta se compromete a respeitar os horários, as regras internas e a estrutura da arena. A arena pode recusar novas reservas de quem descumprir as regras ou faltar repetidamente sem aviso.",
        "No mural de vagas, a combinação de rateio e a organização da partida são de responsabilidade de quem abriu as vagas.",
      ],
    },
    {
      titulo: "5. Conta de acesso",
      paragrafos: [
        "A conta é pessoal e acessada com o WhatsApp e uma senha. Não compartilhe sua senha. Se esquecê-la, peça uma senha temporária à arena.",
      ],
    },
    {
      titulo: "6. Contato",
      paragrafos: [contato ? `Dúvidas sobre reservas: fale com a arena pelo ${contato}.` : "Dúvidas sobre reservas: fale com a arena."],
    },
  ];
}

/**
 * Política de Privacidade (LGPD) do portal de reservas da arena.
 *
 * @param arena Dados da arena
 * @returns Seções do documento
 */
export function montarPoliticaPrivacidade(arena: DadosArenaTermos): SecaoLegal[] {
  const contato = [arena.email, arena.whatsapp && `WhatsApp ${arena.whatsapp}`].filter(Boolean).join(" ou ");
  return [
    {
      titulo: "1. Quem cuida dos seus dados",
      paragrafos: [
        `A ${arena.nome}${arena.cnpjCpf ? ` (${arena.cnpjCpf})` : ""} é a controladora dos seus dados pessoais. A plataforma ${NOME_PRODUTO} é a operadora: armazena e processa os dados apenas para prestar o serviço de reservas à arena.`,
      ],
    },
    {
      titulo: "2. Quais dados coletamos",
      paragrafos: [
        "Nome, número de WhatsApp, data de nascimento (opcional), histórico de reservas e pagamentos, e participações no programa de fidelidade e no mural de vagas, quando a arena oferece esses recursos.",
        "Não guardamos dados de cartão nem senhas em texto: as senhas são protegidas pelo serviço de autenticação.",
      ],
    },
    {
      titulo: "3. Para que usamos",
      paragrafos: [
        "Para registrar e confirmar reservas, identificar o pagamento, entrar em contato sobre o seu horário, aplicar benefícios de fidelidade e prevenir fraudes e faltas recorrentes.",
        "Base legal: execução do contrato de reserva e legítimo interesse da arena na operação; para comunicações opcionais, o seu consentimento.",
      ],
    },
    {
      titulo: "4. Com quem compartilhamos",
      paragrafos: [
        "Com a equipe da arena, com o provedor de pagamento escolhido pela arena (para emitir o Pix) e com provedores de infraestrutura (hospedagem e banco de dados). No mural de vagas, o organizador da partida vê o nome e o WhatsApp de quem demonstrou interesse.",
        "Não vendemos dados pessoais.",
      ],
    },
    {
      titulo: "5. Por quanto tempo",
      paragrafos: [
        "Enquanto a sua conta estiver ativa e pelo prazo exigido por obrigações legais e fiscais da arena. Depois disso, os dados são excluídos ou anonimizados.",
      ],
    },
    {
      titulo: "6. Seus direitos",
      paragrafos: [
        `Você pode pedir acesso, correção, portabilidade ou exclusão dos seus dados, e revogar consentimentos${contato ? `, pelo ${contato}` : " falando com a arena"}. Respondemos em até 15 dias.`,
      ],
    },
  ];
}
