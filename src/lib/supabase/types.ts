import type { Reserva, StatusReserva, StatusWhatsApp } from "@/store/useReservasStore";
import type { Esporte } from "@/lib/quadras";
import type { TipoReserva } from "@/lib/recorrencia/types";

export interface ReservaDbRow {
  id: string;
  arena_id?: string | null;
  arenaId?: string | null;
  user_id?: string | null;
  userId?: string | null;
  quadra_id?: string;
  quadraId?: string;
  nome_cliente?: string;
  nomeCliente?: string;
  whatsapp_cliente?: string;
  whatsappCliente?: string;
  telefone_cliente?: string;
  cpf_cliente?: string;
  cpfCliente?: string;
  data: string;
  horarios: string[] | string;
  hora_inicio?: string;
  horaInicio?: string;
  hora_fim?: string;
  horaFim?: string;
  valor_total?: number | string;
  valorTotal?: number | string;
  valor_sinal?: number | string;
  valorSinal?: number | string;
  valor_pendente?: number | string;
  valorPendente?: number | string;
  valor_original?: number | string;
  valorOriginal?: number | string;
  desconto_fidelidade?: number | string;
  descontoFidelidade?: number | string;
  vouchers_utilizados?: string[] | string;
  vouchersUtilizados?: string[];
  reserva_gratuita_fidelidade?: boolean;
  reservaGratuitaFidelidade?: boolean;
  metodo_pagamento?: string;
  metodoPagamento?: string;
  status: string;
  status_whatsapp?: string;
  statusWhatsApp?: string;
  criada_em?: string;
  criadaEm?: string;
  esporte?: string | null;
  observacoes?: string | null;
  contrato_id?: string | null;
  tipo_reserva?: string | null;
  aviso_cancelamento_em?: string | null;
  permite_vagas?: boolean | null;
  permiteVagas?: boolean | null;
  vagas_abertas?: number | string | null;
  vagasAbertas?: number | string | null;
  pix_txid?: string | null;
  pixTxid?: string | null;
  pix_copia_cola?: string | null;
  pixCopiaCola?: string | null;
  pix_qr_code_url?: string | null;
  pixQrCodeUrl?: string | null;
  expira_em?: string | null;
  expiraEm?: string | null;
  pago_em?: string | null;
  pagoEm?: string | null;
  gateway_provedor?: string | null;
  gatewayProvedor?: string | null;
  gateway_transacao_id?: string | null;
  gatewayTransacaoId?: string | null;
}

/**
 * Converte um registro do banco de dados (snake_case ou camelCase) para a entidade Reserva.
 */
export function rowToReserva(row: ReservaDbRow): Reserva {
  let horariosArray: string[] = [];
  if (Array.isArray(row.horarios)) {
    horariosArray = row.horarios;
  } else if (typeof row.horarios === "string") {
    try {
      const parsed = JSON.parse(row.horarios);
      if (Array.isArray(parsed)) {
        horariosArray = parsed;
      }
    } catch {
      horariosArray = row.horarios.replace(/[{}]/g, "").split(",").map((s) => s.trim()).filter(Boolean);
    }
  }

  const horaInicio =
    row.hora_inicio ??
    row.horaInicio ??
    (horariosArray.length > 0 ? horariosArray[0] : "08:00");

  const horaFim =
    row.hora_fim ??
    row.horaFim ??
    (horariosArray.length > 0
      ? `${String(parseInt(horariosArray[horariosArray.length - 1], 10) + 1).padStart(2, "0")}:00`
      : "09:00");

  let userId = row.user_id ?? row.userId ?? undefined;
  const rawCpf = String(row.cpf_cliente ?? row.cpfCliente ?? "");
  if (!userId && rawCpf.startsWith("uid:")) {
    userId = rawCpf.replace("uid:", "");
  }

  return {
    id: row.id,
    arenaId: row.arena_id ?? row.arenaId ?? undefined,
    userId,
    quadraId: row.quadra_id ?? row.quadraId ?? "",
    nomeCliente: row.nome_cliente ?? row.nomeCliente ?? "",
    whatsappCliente:
      row.whatsapp_cliente ??
      row.whatsappCliente ??
      row.telefone_cliente ??
      "",
    cpfCliente: rawCpf.startsWith("uid:") ? "" : rawCpf,
    data: typeof row.data === "string" ? row.data.split("T")[0] : String(row.data),
    horarios: horariosArray,
    horaInicio,
    horaFim,
    valorTotal: Number(row.valor_total ?? row.valorTotal ?? 0) || 0,
    valorSinal: Number(row.valor_sinal ?? row.valorSinal ?? 0) || 0,
    valorPendente: Number(row.valor_pendente ?? row.valorPendente ?? 0) || 0,
    valorOriginal: (() => {
      const v = row.valor_original !== undefined ? row.valor_original : row.valorOriginal;
      if (v !== null && v !== undefined && v !== "") {
        const num = Number(v);
        return !isNaN(num) ? num : undefined;
      }
      return undefined;
    })(),
    descontoFidelidade: (() => {
      const v = row.desconto_fidelidade !== undefined ? row.desconto_fidelidade : row.descontoFidelidade;
      if (v !== null && v !== undefined && v !== "") {
        const num = Number(v);
        return !isNaN(num) ? num : undefined;
      }
      return undefined;
    })(),
    vouchersUtilizados: (() => {
      const v = row.vouchers_utilizados ?? row.vouchersUtilizados;
      if (Array.isArray(v)) return v;
      if (typeof v === "string") {
        try {
          const parsed = JSON.parse(v);
          if (Array.isArray(parsed)) return parsed;
        } catch {
          return v.replace(/[{}]/g, "").split(",").map((s) => s.trim()).filter(Boolean);
        }
      }
      return undefined;
    })(),
    reservaGratuitaFidelidade: (() => {
      const v =
        row.reserva_gratuita_fidelidade !== undefined
          ? row.reserva_gratuita_fidelidade
          : row.reservaGratuitaFidelidade;
      return v !== null && v !== undefined ? Boolean(v) : undefined;
    })(),
    metodoPagamento: (row.metodo_pagamento ?? row.metodoPagamento) as
      | "pix"
      | "fidelidade"
      | "misto"
      | "balcao"
      | undefined,
    status: (row.status as StatusReserva) || "em_processamento",
    statusWhatsApp: (row.status_whatsapp ?? row.statusWhatsApp ?? "nao_enviado") as StatusWhatsApp,
    criadaEm: row.criada_em ?? row.criadaEm ?? new Date().toISOString(),
    esporte: (row.esporte as Esporte) || undefined,
    observacoes: row.observacoes || undefined,
    contratoId: row.contrato_id || undefined,
    tipoReserva: (row.tipo_reserva as TipoReserva) || undefined,
    avisoCancelamentoEm: row.aviso_cancelamento_em
      ? String(row.aviso_cancelamento_em).split("T")[0]
      : undefined,
    permiteVagas: (() => {
      const v = row.permite_vagas !== undefined ? row.permite_vagas : row.permiteVagas;
      return v !== null && v !== undefined ? Boolean(v) : undefined;
    })(),
    vagasAbertas: (() => {
      const v = row.vagas_abertas !== undefined ? row.vagas_abertas : row.vagasAbertas;
      if (v !== null && v !== undefined && v !== "") {
        const num = Number(v);
        return !isNaN(num) ? num : undefined;
      }
      return undefined;
    })(),
    pixTxid: row.pix_txid ?? row.pixTxid ?? undefined,
    pixCopiaCola: row.pix_copia_cola ?? row.pixCopiaCola ?? undefined,
    pixQrCodeUrl: row.pix_qr_code_url ?? row.pixQrCodeUrl ?? undefined,
    expiraEm: row.expira_em ?? row.expiraEm ?? undefined,
    pagoEm: row.pago_em ?? row.pagoEm ?? undefined,
    gatewayProvedor: row.gateway_provedor ?? row.gatewayProvedor ?? undefined,
    gatewayTransacaoId: row.gateway_transacao_id ?? row.gatewayTransacaoId ?? undefined,
  };
}

/**
 * Converte um objeto parcial ou completo de Reserva para o payload em snake_case esperado pelo PostgreSQL.
 */
export function reservaToRow(reserva: Partial<Reserva>): Record<string, unknown> {
  const row: Record<string, unknown> = {};

  if (reserva.id !== undefined) row.id = reserva.id;
  if (reserva.arenaId !== undefined) row.arena_id = reserva.arenaId ?? null;
  if (reserva.userId !== undefined) {
    row.user_id = reserva.userId ?? null;
    // Fallback: se user_id ainda não existir no schema do banco, salva o id no campo cpf_cliente
    if (reserva.userId) {
      row.cpf_cliente = `uid:${reserva.userId}`;
    }
  }
  if (reserva.quadraId !== undefined) row.quadra_id = reserva.quadraId;
  if (reserva.nomeCliente !== undefined) row.nome_cliente = reserva.nomeCliente;
  if (reserva.whatsappCliente !== undefined) {
    row.whatsapp_cliente = reserva.whatsappCliente;
    row.telefone_cliente = reserva.whatsappCliente;
  }
  if (reserva.cpfCliente !== undefined && !row.cpf_cliente) {
    row.cpf_cliente = reserva.cpfCliente;
  }
  if (reserva.data !== undefined) row.data = reserva.data;
  if (reserva.horarios !== undefined) row.horarios = reserva.horarios;
  if (reserva.horaInicio !== undefined) row.hora_inicio = reserva.horaInicio;
  if (reserva.horaFim !== undefined) row.hora_fim = reserva.horaFim;
  if (reserva.valorTotal !== undefined) row.valor_total = reserva.valorTotal;
  if (reserva.valorSinal !== undefined) row.valor_sinal = reserva.valorSinal;
  if (reserva.valorPendente !== undefined) row.valor_pendente = reserva.valorPendente;
  if (reserva.valorOriginal !== undefined) row.valor_original = reserva.valorOriginal;
  if (reserva.descontoFidelidade !== undefined) row.desconto_fidelidade = reserva.descontoFidelidade;
  if (reserva.vouchersUtilizados !== undefined) row.vouchers_utilizados = reserva.vouchersUtilizados;
  if (reserva.reservaGratuitaFidelidade !== undefined) {
    row.reserva_gratuita_fidelidade = reserva.reservaGratuitaFidelidade;
  }
  if (reserva.metodoPagamento !== undefined) row.metodo_pagamento = reserva.metodoPagamento;
  if (reserva.status !== undefined) row.status = reserva.status;
  if (reserva.statusWhatsApp !== undefined) row.status_whatsapp = reserva.statusWhatsApp;
  if (reserva.criadaEm !== undefined) row.criada_em = reserva.criadaEm;
  if (reserva.esporte !== undefined) row.esporte = reserva.esporte ?? null;
  if (reserva.observacoes !== undefined) row.observacoes = reserva.observacoes ?? null;
  if (reserva.contratoId !== undefined) row.contrato_id = reserva.contratoId ?? null;
  if (reserva.tipoReserva !== undefined) row.tipo_reserva = reserva.tipoReserva ?? null;
  if (reserva.avisoCancelamentoEm !== undefined) {
    row.aviso_cancelamento_em = reserva.avisoCancelamentoEm ?? null;
  }
  if (reserva.permiteVagas !== undefined) {
    row.permite_vagas = reserva.permiteVagas;
  }
  if (reserva.vagasAbertas !== undefined) {
    row.vagas_abertas = reserva.vagasAbertas;
  }
  if (reserva.pixTxid !== undefined) row.pix_txid = reserva.pixTxid;
  if (reserva.pixCopiaCola !== undefined) row.pix_copia_cola = reserva.pixCopiaCola;
  if (reserva.pixQrCodeUrl !== undefined) row.pix_qr_code_url = reserva.pixQrCodeUrl;
  if (reserva.expiraEm !== undefined) row.expira_em = reserva.expiraEm;
  if (reserva.pagoEm !== undefined) row.pago_em = reserva.pagoEm;
  if (reserva.gatewayProvedor !== undefined) row.gateway_provedor = reserva.gatewayProvedor;
  if (reserva.gatewayTransacaoId !== undefined) {
    row.gateway_transacao_id = reserva.gatewayTransacaoId;
  }

  return row;
}

export interface UserProfile {
  id: string;
  nome: string;
  telefone: string;
  dataNascimento?: string | null;
  criadoEm?: string;
  bloqueado?: boolean;
  motivo_bloqueio?: string | null;
}
