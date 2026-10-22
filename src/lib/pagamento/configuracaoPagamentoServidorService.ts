/**
 * @file configuracaoPagamentoServidorService.ts
 * @description Configuração de recebimento da arena (somente servidor): resumo para a tela Pagamentos,
 * cadastro da chave Pix manual e troca do modo de pagamento com validação de pré-requisitos.
 */

import { supabaseAdmin } from "@/lib/supabase/adminClient";
import { mapearLinhaParaArena } from "@/lib/arena/arenaRepository";
import type { ModoPagamentoArena, PixManualArena } from "@/lib/arena/types";
import { ErroHttp } from "@/lib/servidor/autenticacaoServidor";
import { registrarAuditoria } from "@/lib/servidor/auditoria";
import type { MembroArena } from "@/lib/servidor/autorizacaoArena";
import { normalizarChavePix, validarChavePix, type TipoChavePix } from "./brCode";
import { resumirCredencialAsaas, type ResumoCredencialAsaas } from "./credenciaisArenaRepository";
import { criptografiaConfigurada } from "./criptografiaCredenciais";
import { pagamentoSimuladoHabilitado } from "./simulacao";

/** Situação de recebimento exibida na tela Pagamentos. */
export interface ResumoPagamentosArena {
  modo: ModoPagamentoArena;
  pixManual: PixManualArena | null;
  asaas: ResumoCredencialAsaas | null;
  /** O ambiente permite o modo simulado (demonstrações) */
  simuladoDisponivel: boolean;
  /** O servidor consegue guardar chaves de API (PAGAMENTO_CREDENCIAIS_SECRET configurada) */
  asaasDisponivel: boolean;
}

const TIPOS_CHAVE: TipoChavePix[] = ["cpf", "cnpj", "email", "telefone", "aleatoria"];

/**
 * Monta o resumo de recebimento da arena.
 *
 * @param arenaId Arena
 * @returns Resumo sem segredos
 */
export async function obterResumoPagamentos(arenaId: string): Promise<ResumoPagamentosArena> {
  const { data, error } = await supabaseAdmin.from("arenas").select("*").eq("id", arenaId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new ErroHttp("Arena não encontrada.", 404);

  const arena = mapearLinhaParaArena(data as Record<string, unknown>);
  if (arena.modoPagamento === "legado") {
    throw new ErroHttp(
      "O banco de dados ainda não tem a atualização de pagamentos (Fase 8). Execute a migração no Supabase.",
      409
    );
  }

  return {
    modo: arena.modoPagamento ?? "manual",
    pixManual: arena.pixManual ?? null,
    asaas: await resumirCredencialAsaas(arenaId),
    simuladoDisponivel: pagamentoSimuladoHabilitado(),
    asaasDisponivel: criptografiaConfigurada(),
  };
}

/**
 * Valida os dados do Pix manual.
 *
 * @param input Corpo bruto
 * @returns Dados normalizados
 * @throws ErroHttp 400
 */
export function validarPixManual(input: unknown): PixManualArena {
  const bruto = (input ?? {}) as Record<string, unknown>;
  const tipoChave = bruto.tipoChave as TipoChavePix;
  if (!TIPOS_CHAVE.includes(tipoChave)) throw new ErroHttp("Escolha o tipo da chave Pix.", 400);

  const chave = typeof bruto.chave === "string" ? bruto.chave : "";
  const erroChave = validarChavePix(chave, tipoChave);
  if (erroChave) throw new ErroHttp(erroChave, 400);

  const nomeRecebedor = typeof bruto.nomeRecebedor === "string" ? bruto.nomeRecebedor.trim() : "";
  const cidadeRecebedor = typeof bruto.cidadeRecebedor === "string" ? bruto.cidadeRecebedor.trim() : "";
  if (nomeRecebedor.length < 3) throw new ErroHttp("Informe o nome do titular da conta, como aparece no banco.", 400);
  if (cidadeRecebedor.length < 2) throw new ErroHttp("Informe a cidade do titular da conta.", 400);

  return { chave: normalizarChavePix(chave, tipoChave), tipoChave, nomeRecebedor, cidadeRecebedor };
}

/**
 * Salva a chave Pix da arena. Se a arena ainda não tinha meio de recebimento, ativa o modo manual.
 *
 * @param membro Proprietário autorizado
 * @param pix Dados validados
 */
export async function salvarPixManual(membro: MembroArena, pix: PixManualArena): Promise<void> {
  const resumo = await obterResumoPagamentos(membro.arenaId);
  const patch: Record<string, unknown> = {
    pix_chave: pix.chave,
    pix_tipo_chave: pix.tipoChave,
    pix_nome_recebedor: pix.nomeRecebedor,
    pix_cidade_recebedor: pix.cidadeRecebedor,
  };
  if (resumo.modo === "manual" || (resumo.modo === "asaas" && !resumo.asaas)) patch.modo_pagamento = "manual";

  const { error } = await supabaseAdmin.from("arenas").update(patch).eq("id", membro.arenaId);
  if (error) throw new Error(error.message);

  await registrarAuditoria({
    arenaId: membro.arenaId,
    autorId: membro.userId,
    acao: "pagamento.configuracao_pix",
    detalhes: { tipoChave: pix.tipoChave },
  });
}

/**
 * Troca o modo de recebimento, exigindo o pré-requisito de cada modo.
 *
 * @param membro Proprietário autorizado
 * @param modo Novo modo
 * @throws ErroHttp 400 (modo inválido) ou 409 (pré-requisito ausente)
 */
export async function definirModoPagamento(membro: MembroArena, modo: unknown): Promise<void> {
  if (modo !== "asaas" && modo !== "manual" && modo !== "simulado") {
    throw new ErroHttp("Modo de pagamento inválido.", 400);
  }
  const resumo = await obterResumoPagamentos(membro.arenaId);
  if (modo === "manual" && !resumo.pixManual) throw new ErroHttp("Cadastre a chave Pix da arena antes.", 409);
  if (modo === "asaas" && !resumo.asaas) throw new ErroHttp("Conecte a conta Asaas antes.", 409);
  if (modo === "simulado" && !resumo.simuladoDisponivel) {
    throw new ErroHttp("O modo simulado só está disponível em ambientes de demonstração.", 409);
  }

  const { error } = await supabaseAdmin.from("arenas").update({ modo_pagamento: modo }).eq("id", membro.arenaId);
  if (error) throw new Error(error.message);

  await registrarAuditoria({
    arenaId: membro.arenaId,
    autorId: membro.userId,
    acao: "pagamento.configuracao_pix",
    detalhes: { modo },
  });
}
