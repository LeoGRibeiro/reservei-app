/**
 * @module hooks/useEscolinhasSite
 *
 * Estado das escolinhas do site no painel do dono: carrega da arena ativa e expõe salvar,
 * mostrar/esconder e excluir, mantendo a lista local em dia sem recarregar a página.
 *
 * @example
 * ```tsx
 * const { escolinhas, carregando, salvar } = useEscolinhasSite();
 * await salvar(null, dadosDoFormulario); // cria
 * await salvar(escolinha.id, dadosDoFormulario); // edita
 * ```
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import type { EscolinhaSite, EscolinhaSiteInput } from "@/lib/institucional/escolinhasSite";
import {
  alterarVisibilidadeEscolinhaSite,
  atualizarEscolinhaSite,
  criarEscolinhaSite,
  excluirEscolinhaSite,
  listarEscolinhasSite,
} from "@/lib/supabase/escolinhasSiteRepository";

const ordenar = (lista: EscolinhaSite[]) => [...lista].sort((a, b) => a.ordem - b.ordem);

export function useEscolinhasSite() {
  const [escolinhas, setEscolinhas] = useState<EscolinhaSite[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const recarregar = useCallback(
    () =>
      listarEscolinhasSite()
        .then((lista) => {
          setEscolinhas(lista);
          setErro(null);
        })
        .catch((e: unknown) => setErro(e instanceof Error ? e.message : "Não foi possível carregar as escolinhas."))
        .finally(() => setCarregando(false)),
    []
  );

  useEffect(() => {
    let ativo = true;
    listarEscolinhasSite()
      .then((lista) => ativo && setEscolinhas(lista))
      .catch((e: unknown) => ativo && setErro(e instanceof Error ? e.message : "Não foi possível carregar as escolinhas."))
      .finally(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
    };
  }, []);

  /** Cria (id nulo) ou atualiza a escolinha. Lança o erro do banco para a tela avisar. */
  const salvar = useCallback(async (id: string | null, input: EscolinhaSiteInput) => {
    const salva = id ? await atualizarEscolinhaSite(id, input) : await criarEscolinhaSite(input);
    setEscolinhas((prev) => ordenar(id ? prev.map((e) => (e.id === id ? salva : e)) : [...prev, salva]));
    return salva;
  }, []);

  const alternarVisibilidade = useCallback(async (escolinha: EscolinhaSite) => {
    await alterarVisibilidadeEscolinhaSite(escolinha.id, !escolinha.ativa);
    setEscolinhas((prev) => prev.map((e) => (e.id === escolinha.id ? { ...e, ativa: !e.ativa } : e)));
  }, []);

  const excluir = useCallback(async (id: string) => {
    await excluirEscolinhaSite(id);
    setEscolinhas((prev) => prev.filter((e) => e.id !== id));
  }, []);

  return { escolinhas, carregando, erro, recarregar, salvar, alternarVisibilidade, excluir };
}
