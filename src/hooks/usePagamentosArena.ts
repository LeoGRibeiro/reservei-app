/**
 * @file usePagamentosArena.ts
 * @description Hook da tela Pagamentos: resumo de recebimento da arena e ações de configuração
 * (chave Pix manual, conexão Asaas, troca de modo). Tudo passa por `/api/admin/pagamentos`.
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { chamarApi } from "@/lib/api/clienteApi";
import type { ModoPagamentoArena, PixManualArena } from "@/lib/arena/types";
import type { ResumoPagamentosArena } from "@/lib/pagamento/configuracaoPagamentoServidorService";

export interface UsePagamentosArenaRetorno {
  resumo: ResumoPagamentosArena | null;
  carregando: boolean;
  erro: string | null;
  salvarPix: (pix: PixManualArena) => Promise<string | null>;
  definirModo: (modo: Exclude<ModoPagamentoArena, "legado">) => Promise<string | null>;
  conectarAsaas: (apiKey: string) => Promise<string | null>;
  desconectarAsaas: () => Promise<string | null>;
}

/**
 * Configuração de recebimento da arena.
 *
 * @param arenaSlug Slug da arena ativa
 * @returns Resumo e ações (cada ação devolve `null` em caso de sucesso ou a mensagem de erro)
 *
 * @example
 * ```tsx
 * const { resumo, salvarPix } = usePagamentosArena(arenaSlug);
 * const erro = await salvarPix({ chave, tipoChave: "cnpj", nomeRecebedor, cidadeRecebedor });
 * ```
 */
export function usePagamentosArena(arenaSlug: string): UsePagamentosArenaRetorno {
  const [resumo, setResumo] = useState<ResumoPagamentosArena | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    chamarApi<{ resumo: ResumoPagamentosArena }>(`/api/admin/pagamentos?arena=${encodeURIComponent(arenaSlug)}`).then(
      (res) => {
        if (!ativo) return;
        if (res.ok && res.dados) setResumo(res.dados.resumo);
        else setErro(res.erro ?? "Não foi possível carregar a configuração de pagamentos.");
        setCarregando(false);
      }
    );
    return () => {
      ativo = false;
    };
  }, [arenaSlug]);

  const executar = useCallback(
    async (corpo: Record<string, unknown>): Promise<string | null> => {
      const res = await chamarApi<{ resumo: ResumoPagamentosArena }>("/api/admin/pagamentos", {
        method: "POST",
        corpo: { arenaSlug, ...corpo },
      });
      if (!res.ok || !res.dados) return res.erro ?? "Não foi possível salvar.";
      setResumo(res.dados.resumo);
      return null;
    },
    [arenaSlug]
  );

  return {
    resumo,
    carregando,
    erro,
    salvarPix: (pix) => executar({ acao: "salvar_pix", ...pix }),
    definirModo: (modo) => executar({ acao: "definir_modo", modo }),
    conectarAsaas: (apiKey) => executar({ acao: "conectar_asaas", apiKey }),
    desconectarAsaas: () => executar({ acao: "desconectar_asaas" }),
  };
}
