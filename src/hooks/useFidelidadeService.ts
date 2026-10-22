/**
 * Hook customizado de abstração para o Sistema de Fidelidade.
 * Conecta os componentes de interface às regras de negócio e à camada de persistência.
 *
 * A emissão de selos e vouchers é feita no servidor (`/api/fidelidade/sincronizar`); este hook apenas
 * dispara a sincronização para o atleta autenticado e lê o resultado. O consumo de vouchers acontece
 * no checkout do servidor, nunca no navegador.
 */

"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useUserAuth } from "@/hooks/useUserAuth";
import { useReservasService } from "@/hooks/useReservasService";
import type {
  CampanhaFidelidade,
  SeloFidelidade,
  VoucherFidelidade,
  ProgressoFidelidadeUsuario,
} from "@/lib/fidelidade/types";
import { CAMPANHA_PADRAO, calcularProgressoUsuario } from "@/lib/fidelidade/fidelidadeService";
import {
  fetchCampanhaSupabase,
  salvarCampanhaSupabase,
  fetchSelosUsuarioSupabase,
  fetchVouchersUsuarioSupabase,
  sincronizarFidelidade,
} from "@/lib/supabase/fidelidadeService";

/**
 * Estado e ações do programa de fidelidade para o atleta autenticado (ou para o admin, na campanha).
 *
 * @returns Campanha, selos, vouchers, progresso calculado e ações
 *
 * @example
 * ```tsx
 * const { progresso, resgatarVoucher } = useFidelidadeService();
 * ```
 */
export function useFidelidadeService() {
  const { user } = useUserAuth();
  const { reservas } = useReservasService();

  const [campanha, setCampanha] = useState<CampanhaFidelidade>(CAMPANHA_PADRAO);
  const [selos, setSelos] = useState<SeloFidelidade[]>([]);
  const [vouchers, setVouchers] = useState<VoucherFidelidade[]>([]);
  const [carregando, setCarregando] = useState<boolean>(true);
  const [ultimoVoucherEmitido, setUltimoVoucherEmitido] = useState<VoucherFidelidade | null>(null);

  const usuarioId = user?.id || "";
  const telefoneDigitos = user?.telefone ? user.telefone.replace(/\D/g, "") : "";

  // Mantém as reservas mais recentes acessíveis sem refazer a sincronização a cada evento Realtime
  const reservasRef = useRef(reservas);
  useEffect(() => {
    reservasRef.current = reservas;
  }, [reservas]);

  // ── Carregamento e Sincronização ──────────────────────────────────────────

  const recarregarDados = useCallback(async () => {
    try {
      setCarregando(true);
      const camp = await fetchCampanhaSupabase();
      setCampanha(camp);

      if (usuarioId) {
        const reservasDoUsuario = reservasRef.current.filter(
          (r) =>
            r.userId === usuarioId ||
            (telefoneDigitos && r.whatsappCliente && r.whatsappCliente.includes(telefoneDigitos))
        );

        const { voucherGerado } = await sincronizarFidelidade(usuarioId, reservasDoUsuario, camp);
        if (voucherGerado) {
          setUltimoVoucherEmitido(voucherGerado);
        }

        const [selosDb, vouchersDb] = await Promise.all([
          fetchSelosUsuarioSupabase(usuarioId),
          fetchVouchersUsuarioSupabase(usuarioId),
        ]);
        setSelos(selosDb);
        setVouchers(vouchersDb);
      } else {
        setSelos([]);
        setVouchers([]);
      }
    } catch (err) {
      console.error("[useFidelidadeService] Falha ao sincronizar fidelidade:", err);
    } finally {
      setCarregando(false);
    }
  }, [usuarioId, telefoneDigitos]);

  useEffect(() => {
    void recarregarDados();
  }, [recarregarDados]);

  // ── Progresso Computado Reativamente ───────────────────────────────────────

  const progresso: ProgressoFidelidadeUsuario = useMemo(() => {
    if (!usuarioId) {
      return calcularProgressoUsuario("", [], [], campanha);
    }
    return calcularProgressoUsuario(usuarioId, selos, vouchers, campanha);
  }, [usuarioId, selos, vouchers, campanha]);

  // ── Ações do Cliente ──────────────────────────────────────────────────────

  /**
   * Solicita ao servidor a emissão do voucher quando o atleta já completou as horas da campanha.
   */
  const resgatarVoucher = useCallback(async (): Promise<{
    sucesso: boolean;
    voucher?: VoucherFidelidade;
    erro?: string;
  }> => {
    if (!usuarioId) {
      return { sucesso: false, erro: "Usuário precisa estar autenticado." };
    }

    if (!progresso.podeResgatar) {
      return {
        sucesso: false,
        erro: `Você precisa acumular ${campanha.horasNecessarias} horas para gerar um voucher.`,
      };
    }

    const { voucherGerado } = await sincronizarFidelidade(usuarioId, reservasRef.current, campanha);
    await recarregarDados();

    if (!voucherGerado) {
      return { sucesso: false, erro: "Não foi possível emitir o voucher agora. Tente novamente." };
    }
    setUltimoVoucherEmitido(voucherGerado);
    return { sucesso: true, voucher: voucherGerado };
  }, [usuarioId, progresso.podeResgatar, campanha, recarregarDados]);

  // ── Ações do Administrador ────────────────────────────────────────────────

  /**
   * Atualiza a configuração da campanha de fidelidade da arena.
   *
   * @returns true se o banco confirmou a gravação
   */
  const atualizarCampanha = useCallback(
    async (dadosNovos: Partial<CampanhaFidelidade>): Promise<boolean> => {
      try {
        const salva = await salvarCampanhaSupabase({
          ...campanha,
          ...dadosNovos,
          atualizadoEm: new Date().toISOString(),
        });
        setCampanha(salva);
        return true;
      } catch (err) {
        console.error("[useFidelidadeService] Erro ao atualizar campanha:", err);
        return false;
      }
    },
    [campanha]
  );

  return {
    campanha,
    selos,
    vouchers,
    progresso,
    carregando,
    ultimoVoucherEmitido,
    setUltimoVoucherEmitido,
    recarregarDados,
    resgatarVoucher,
    atualizarCampanha,
  };
}
