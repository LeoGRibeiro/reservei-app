/**
 * @file useContaPortal.ts
 * @description Estado do atleta no portal: sessão do Supabase Auth, perfil e dados da conta na arena,
 * e a grade pública (atualizada a cada 30 s enquanto a aba está visível).
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import { CONTA_VAZIA, lerAtleta, lerConta, lerGrade, type DadosConta } from "@/lib/portal/contaRepository";
import { DIAS_A_FRENTE } from "@/lib/portal/agenda";
import type { AtletaPortal } from "@/lib/portal/contaAtleta";
import type { LinhaGrade } from "@/lib/portal/types";

/** Atualização da grade pública (o Realtime só entrega eventos de quem pode ler a reserva). */
const INTERVALO_GRADE_MS = 30_000;

/**
 * Grade pública com atualização periódica.
 *
 * @param arenaId Arena
 * @param inicial Grade carregada no servidor
 * @param hoje Data de hoje no fuso da arena
 */
export function useGradePortal(arenaId: string, inicial: LinhaGrade[], hoje: string) {
  const [grade, setGrade] = useState(inicial);
  const recarregar = useCallback(async () => {
    const nova = await lerGrade(arenaId, hoje, DIAS_A_FRENTE);
    if (nova) setGrade(nova);
  }, [arenaId, hoje]);

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void recarregar();
    }, INTERVALO_GRADE_MS);
    return () => clearInterval(id);
  }, [recarregar]);

  return { grade, recarregarGrade: recarregar };
}

/** Estado da sessão do atleta. */
export interface SessaoPortal {
  /** true até a primeira leitura da sessão terminar */
  carregando: boolean;
  atleta: AtletaPortal | null;
  conta: DadosConta;
  /** Relê a conta (depois de reservar, cancelar, pedir vaga...) */
  recarregarConta: () => Promise<void>;
  /** Encerra a sessão */
  sair: () => Promise<void>;
}

/**
 * Sessão e conta do atleta na arena. Reage a entrar e sair (inclusive em outra aba).
 *
 * @param arenaId Arena
 * @param hoje Data de hoje no fuso da arena
 * @param agoraMin Minutos de agora no fuso da arena
 */
export function useSessaoPortal(arenaId: string, hoje: string, agoraMin: number): SessaoPortal {
  const [carregando, setCarregando] = useState(isSupabaseConfigured);
  const [atleta, setAtleta] = useState<AtletaPortal | null>(null);
  const [conta, setConta] = useState<DadosConta>(CONTA_VAZIA);
  const userIdRef = useRef<string | null>(null);
  const contexto = useRef({ arenaId, hoje, agoraMin });
  useEffect(() => {
    contexto.current = { arenaId, hoje, agoraMin };
  }, [arenaId, hoje, agoraMin]);

  const carregarConta = useCallback(async (userId: string | null) => {
    if (!userId) {
      setAtleta(null);
      setConta(CONTA_VAZIA);
      return;
    }
    const { arenaId: arena, hoje: dia, agoraMin: minutos } = contexto.current;
    const [perfil, dados] = await Promise.all([lerAtleta(userId), lerConta(arena, userId, dia, minutos)]);
    if (userIdRef.current !== userId) return;
    setAtleta(perfil);
    setConta(dados);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let vivo = true;
    void supabase.auth.getSession().then(async ({ data }) => {
      const id = data.session?.user.id ?? null;
      userIdRef.current = id;
      await carregarConta(id);
      if (vivo) setCarregando(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_evento, sessao) => {
      const id = sessao?.user.id ?? null;
      if (id === userIdRef.current) return;
      userIdRef.current = id;
      void carregarConta(id);
    });
    return () => {
      vivo = false;
      data.subscription.unsubscribe();
    };
  }, [carregarConta]);

  const recarregarConta = useCallback(() => carregarConta(userIdRef.current), [carregarConta]);

  const sair = useCallback(async () => {
    userIdRef.current = null;
    setAtleta(null);
    setConta(CONTA_VAZIA);
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn("[useSessaoPortal] Erro ao sair:", err);
    }
  }, []);

  return { carregando, atleta, conta, recarregarConta, sair };
}
