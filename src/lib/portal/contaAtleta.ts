/**
 * @file contaAtleta.ts
 * @description Entidades e regras da conta do atleta no portal: reservas (próximas e histórico),
 * carimbos do Clube, horas grátis e pedidos de vaga. Funções puras, sem acesso ao banco.
 */

import { horaDe, somarDias, codigoReserva, primeiroNome, mascaraWhats } from "./formatos";

/** Atleta logado. */
export interface AtletaPortal {
  id: string;
  nome: string;
  primeiro: string;
  /** "(91) 99876-5432" */
  whatsapp: string;
  /** "91998765432" */
  whatsappDigitos: string;
  /** 'AAAA-MM-DD' */
  nascimento: string;
}

export type SituacaoReserva = "ativa" | "concluida" | "cancelada";

/** Reserva do atleta. */
export interface ReservaAtleta {
  id: string;
  codigo: string;
  quadraId: string;
  data: string;
  horas: number[];
  esporte: string;
  total: number;
  pago: number;
  situacao: SituacaoReserva;
  permiteVagas: boolean;
  vagasAbertas: number;
  vagasCompleta: boolean;
  reembolsoStatus?: "pendente" | "reembolsado";
  reembolsoValor?: number;
}

/** Carimbo do Clube (um por reserva, com as horas dela). */
export interface CarimboAtleta {
  id: string;
  reservaId: string;
  data: string;
  horas: number;
  expiraEm: string;
  resgatado: boolean;
}

/** Hora grátis disponível. */
export interface HoraGratis {
  id: string;
  codigo: string;
  expiraEm: string;
  teto: number;
}

/** Pedido de vaga (feito pelo atleta ou recebido na partida dele). */
export interface PedidoVaga {
  id: string;
  reservaId: string;
  usuarioId: string;
  nome: string;
  whatsappDigitos: string;
  /** pendente = novo; contatado = já chamou; combinado = entrou na partida */
  status: "pendente" | "contatado" | "combinado" | "rejeitado";
  criadoEm: string;
}

type Linha = Record<string, unknown>;

/** Linha de `usuarios` → atleta. */
export function mapearAtleta(row: Linha, userId: string): AtletaPortal {
  const nome = String(row.nome ?? "").trim();
  const digitos = String(row.telefone ?? "").replace(/\D/g, "");
  return {
    id: userId,
    nome,
    primeiro: primeiroNome(nome),
    whatsapp: mascaraWhats(digitos),
    whatsappDigitos: digitos,
    nascimento: row.data_nascimento ? String(row.data_nascimento).slice(0, 10) : "",
  };
}

/**
 * Linha de `reservas` → reserva do atleta. Locks de checkout ainda não pagos não entram.
 *
 * @param agoraMinHoje Minutos de agora no fuso da arena, para saber se o jogo de hoje já passou
 */
export function mapearReservaAtleta(row: Linha, hoje: string, agoraMinHoje: number): ReservaAtleta | null {
  const status = String(row.status ?? "");
  if (status === "em_processamento") return null;
  const horarios = Array.isArray(row.horarios) ? row.horarios.map(String) : [String(row.hora_inicio ?? "00:00")];
  const horas = horarios.map(horaDe).sort((a, b) => a - b);
  const data = String(row.data ?? "").slice(0, 10);
  const fimMin = (horas[horas.length - 1] + 1) * 60;
  const passou = data < hoje || (data === hoje && fimMin <= agoraMinHoje);
  const total = Number(row.valor_total ?? 0);
  const pendente = Number(row.valor_pendente ?? 0);
  const reembolso = row.reembolso_status === "pendente" || row.reembolso_status === "reembolsado" ? row.reembolso_status : undefined;
  return {
    id: String(row.id),
    codigo: codigoReserva(String(row.id)),
    quadraId: String(row.quadra_id ?? ""),
    data,
    horas,
    esporte: String(row.esporte ?? ""),
    total,
    pago: Math.max(0, Math.round((total - pendente) * 100) / 100),
    situacao: status === "cancelada" ? "cancelada" : passou ? "concluida" : "ativa",
    permiteVagas: row.permite_vagas === true,
    vagasAbertas: Number(row.vagas_abertas ?? 0),
    vagasCompleta: row.vagas_completa === true,
    reembolsoStatus: reembolso,
    reembolsoValor: row.reembolso_valor !== null && row.reembolso_valor !== undefined ? Number(row.reembolso_valor) : undefined,
  };
}

/** Próximos jogos, do mais perto ao mais longe. */
export function proximasReservas(reservas: ReservaAtleta[]): ReservaAtleta[] {
  return reservas
    .filter((r) => r.situacao === "ativa")
    .sort((a, b) => (a.data + String(a.horas[0]).padStart(2, "0")).localeCompare(b.data + String(b.horas[0]).padStart(2, "0")));
}

/** Histórico: o que já passou ou foi cancelado, do mais recente ao mais antigo. */
export function historicoReservas(reservas: ReservaAtleta[]): ReservaAtleta[] {
  return reservas.filter((r) => r.situacao !== "ativa").sort((a, b) => b.data.localeCompare(a.data));
}

/** Horas para o início do jogo (negativo se já começou). */
export function horasAteOJogo(r: Pick<ReservaAtleta, "data" | "horas">, hoje: string, agoraMin: number): number {
  const dias = Math.round((new Date(`${r.data}T12:00:00`).getTime() - new Date(`${hoje}T12:00:00`).getTime()) / 86_400_000);
  return (dias * 1440 + r.horas[0] * 60 - agoraMin) / 60;
}

/** Linha de `fidelidade_selos` → carimbo. */
export function mapearCarimbo(row: Linha): CarimboAtleta {
  return {
    id: String(row.id),
    reservaId: String(row.reserva_id ?? ""),
    data: String(row.data_jogo ?? "").slice(0, 10),
    horas: Number(row.horas_contabilizadas ?? 1),
    expiraEm: String(row.expira_em ?? "").slice(0, 10),
    resgatado: row.resgatado === true,
  };
}

/** Linha de `fidelidade_vouchers` disponível → hora grátis. */
export function mapearHoraGratis(row: Linha): HoraGratis {
  return {
    id: String(row.id),
    codigo: String(row.codigo ?? ""),
    expiraEm: String(row.expira_em ?? "").slice(0, 10),
    teto: Number(row.valor_teto ?? 0),
  };
}

/** Carimbos que ainda contam na cartela (não viraram hora grátis e não venceram). */
export function carimbosValidos(carimbos: CarimboAtleta[], hoje: string): CarimboAtleta[] {
  return carimbos.filter((c) => !c.resgatado && c.expiraEm >= hoje).sort((a, b) => b.data.localeCompare(a.data));
}

/** Quantos carimbos há na cartela agora (limitado à meta). */
export function totalCarimbos(carimbos: CarimboAtleta[], hoje: string, meta: number): number {
  return Math.min(meta, carimbosValidos(carimbos, hoje).reduce((s, c) => s + c.horas, 0));
}

/** Horas grátis ainda válidas, da que vence antes para a que vence depois. */
export function horasGratisValidas(horas: HoraGratis[], hoje: string): HoraGratis[] {
  return horas.filter((h) => h.expiraEm >= hoje).sort((a, b) => a.expiraEm.localeCompare(b.expiraEm));
}

/**
 * Aviso de vencimento: "Os carimbos de 3 de outubro vencem em 3 de janeiro. Cada carimbo vale 3 meses."
 * Considera o carimbo válido mais antigo.
 */
export function carimboMaisAntigo(carimbos: CarimboAtleta[], hoje: string): CarimboAtleta | null {
  const validos = carimbosValidos(carimbos, hoje);
  return validos.length ? validos[validos.length - 1] : null;
}

/** Data de hoje + n dias (atalho para validades). */
export const emDias = (hoje: string, n: number): string => somarDias(hoje, n);

/** Linha de `interesses_vagas` → pedido. */
export function mapearPedido(row: Linha): PedidoVaga {
  const status = String(row.status ?? "pendente");
  return {
    id: String(row.id),
    reservaId: String(row.reserva_id ?? ""),
    usuarioId: String(row.usuario_id ?? ""),
    nome: String(row.nome_usuario ?? ""),
    whatsappDigitos: String(row.telefone_usuario ?? "").replace(/\D/g, ""),
    status: status === "contatado" || status === "combinado" || status === "rejeitado" ? status : "pendente",
    criadoEm: String(row.created_at ?? ""),
  };
}
