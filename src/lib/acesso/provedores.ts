/**
 * @file provedores.ts
 * @description Quem entrega o código de acesso ao atleta (`EnvioCodigoAcesso`).
 *
 * - `demonstracao`: não manda mensagem; aceita um código fixo (`CODIGO_ACESSO_DEMONSTRACAO`). Só vale
 *   em arena com `modo_pagamento = simulado` ou fora de produção. **Nunca** fica ativo em arena real.
 * - `meta`: API oficial do WhatsApp (modelo de autenticação aprovado). Ainda não implementado: depende
 *   de número da plataforma, empresa verificada e cobrança por conversa (BACKLOG item 14).
 */

import { randomInt } from "node:crypto";
import type { ModoPagamentoArena } from "@/lib/arena/types";

export type NomeProvedor = "demonstracao" | "meta";

/** Contrato de quem entrega o código. */
export interface EnvioCodigoAcesso {
  nome: NomeProvedor;
  /** Gera o código que será enviado (6 números) */
  gerarCodigo(): string;
  /** Entrega o código ao WhatsApp do atleta */
  enviar(telefone: string, codigo: string): Promise<void>;
}

/** Código fixo do modo demonstração (em desenvolvimento, 123456 se não houver variável). */
export function codigoDeDemonstracao(): string | null {
  const configurado = process.env.CODIGO_ACESSO_DEMONSTRACAO?.trim();
  if (configurado && /^\d{6}$/.test(configurado)) return configurado;
  return process.env.NODE_ENV === "production" ? null : "123456";
}

/** Provedor de demonstração: não envia nada; o apresentador sabe o código. */
export const provedorDemonstracao: EnvioCodigoAcesso = {
  nome: "demonstracao",
  gerarCodigo() {
    const codigo = codigoDeDemonstracao();
    if (!codigo) throw new Error("CODIGO_ACESSO_DEMONSTRACAO não configurado.");
    return codigo;
  },
  async enviar() {
    // Demonstração: nenhuma mensagem é enviada.
  },
};

/** Provedor da Meta: interface reservada para quando a API do WhatsApp for contratada. */
export const provedorMeta: EnvioCodigoAcesso = {
  nome: "meta",
  gerarCodigo() {
    return String(randomInt(0, 1_000_000)).padStart(6, "0");
  },
  async enviar() {
    throw new Error("Envio pelo WhatsApp (Meta) ainda não está disponível.");
  },
};

/**
 * Provedor para uma arena. Demonstração só em arena simulada ou fora de produção; senão, Meta
 * (que hoje responde "indisponível").
 *
 * @param modoPagamento Modo de pagamento da arena
 * @returns Provedor, ou null se não há como entregar código nesta arena
 */
export function provedorDaArena(modoPagamento: ModoPagamentoArena | undefined): EnvioCodigoAcesso | null {
  const demonstracao = modoPagamento === "simulado" || process.env.NODE_ENV !== "production";
  if (demonstracao && codigoDeDemonstracao()) return provedorDemonstracao;
  return null;
}

/**
 * Números liberados para o modo demonstração além das contas novas e das contas de demonstração
 * (`CODIGO_ACESSO_DEMO_NUMEROS`, separados por vírgula).
 */
export function numerosDeTeste(): Set<string> {
  return new Set(
    (process.env.CODIGO_ACESSO_DEMO_NUMEROS ?? "")
      .split(",")
      .map((n) => n.replace(/\D/g, ""))
      .filter(Boolean)
  );
}
