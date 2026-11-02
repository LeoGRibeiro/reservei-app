/**
 * @module hooks/useInstitucionalService
 *
 * Hook React para gerenciar a galeria de fotos da estrutura: leitura, criação, edição,
 * exclusão, upload de imagens e filtros de categoria. As escolinhas do site ficam em
 * `useEscolinhasSite`.
 */

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type {
  GaleriaItem,
  FiltroCategoriaGaleria,
  CriarGaleriaInput,
  AtualizarGaleriaInput,
} from "@/lib/institucional/types";
import {
  filtrarGaleria,
} from "@/lib/institucional/institucionalHelpers";
import {
  listarGaleria,
  criarGaleriaItem,
  atualizarGaleriaItem,
  excluirGaleriaItem,
  uploadImagemInstitucional,
} from "@/lib/supabase/institucionalRepository";
import { GALERIA_INICIAL } from "@/lib/institucional/dadosIniciais";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export function useInstitucionalService() {
  // Com Supabase, começa vazio: fotos de demonstração nunca devem piscar na landing de uma arena real
  const [galeria, setGaleria] = useState<GaleriaItem[]>(() =>
    isSupabaseConfigured() ? [] : [...GALERIA_INICIAL]
  );
  const [carregando, setCarregando] = useState(true);
  const [filtroCategoria, setFiltroCategoria] = useState<FiltroCategoriaGaleria>("todas");

  const recarregar = useCallback(async () => {
    try {
      const itensGaleria = await listarGaleria();
      setGaleria(itensGaleria);
    } catch {
      // Mantém a galeria atual se a consulta falhar
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(recarregar);
  }, [recarregar]);

  // Lista pública de fotos filtradas por categoria (apenas ativas)
  const galeriaFiltrada = useMemo(() => {
    return filtrarGaleria(galeria, filtroCategoria, true);
  }, [galeria, filtroCategoria]);

  // Ações de gerenciamento da galeria
  const criarFoto = useCallback(async (input: CriarGaleriaInput) => {
    const criada = await criarGaleriaItem(input);
    setGaleria((prev) => [...prev, criada]);
    return criada;
  }, []);

  const atualizarFoto = useCallback(
    async (id: string, input: AtualizarGaleriaInput) => {
      const atualizada = await atualizarGaleriaItem(id, input);
      if (atualizada) {
        setGaleria((prev) => prev.map((item) => (item.id === id ? atualizada : item)));
      }
      return atualizada;
    },
    []
  );

  const removerFoto = useCallback(async (id: string) => {
    const ok = await excluirGaleriaItem(id);
    if (ok) {
      setGaleria((prev) => prev.filter((item) => item.id !== id));
    }
    return ok;
  }, []);

  return {
    galeria,
    galeriaFiltrada,
    carregando,
    filtroCategoria,
    setFiltroCategoria,
    recarregar,
    criarFoto,
    atualizarFoto,
    removerFoto,
    fazerUploadImagem: uploadImagemInstitucional,
  };
}
