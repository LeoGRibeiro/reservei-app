/**
 * @module hooks/useInstitucionalService
 *
 * Hook React para gerenciar os dados da galeria de fotos da estrutura
 * e das escolinhas esportivas, integrando leitura, criação, edição,
 * exclusão, upload de imagens, filtros de categoria e sincronização
 * bidirecional com os contratos de escolinhas da agenda.
 */

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type {
  GaleriaItem,
  EscolinhaItem,
  FiltroCategoriaGaleria,
  CriarGaleriaInput,
  AtualizarGaleriaInput,
  CriarEscolinhaInput,
  AtualizarEscolinhaInput,
} from "@/lib/institucional/types";
import {
  filtrarGaleria,
  filtrarEscolinhas,
  converterContratoParaEscolinhaItem,
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
import { useContratosService } from "@/hooks/useContratosService";

export function useInstitucionalService() {
  // Com Supabase, começa vazio: fotos de demonstração nunca devem piscar na landing de uma arena real
  const [galeria, setGaleria] = useState<GaleriaItem[]>(() =>
    isSupabaseConfigured() ? [] : [...GALERIA_INICIAL]
  );
  const [carregando, setCarregando] = useState(true);
  const [filtroCategoria, setFiltroCategoria] = useState<FiltroCategoriaGaleria>("todas");

  // Acesso direto aos contratos de escolinhas cadastrados na aba Escolinhas (mesmo banco)
  const { getContratosPorTipo, atualizarContrato } = useContratosService();
  const contratosEscolinhas = useMemo(
    () => getContratosPorTipo("escolinha"),
    [getContratosPorTipo]
  );

  // Escolinhas unificadas diretamente a partir dos contratos
  const escolinhas: EscolinhaItem[] = useMemo(() => {
    return contratosEscolinhas.map(converterContratoParaEscolinhaItem);
  }, [contratosEscolinhas]);

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
    void recarregar();
  }, [recarregar]);

  // Lista pública de fotos filtradas por categoria (apenas ativas)
  const galeriaFiltrada = useMemo(() => {
    return filtrarGaleria(galeria, filtroCategoria, true);
  }, [galeria, filtroCategoria]);

  // Lista pública de escolinhas (apenas ativas)
  const escolinhasAtivas = useMemo(() => {
    return filtrarEscolinhas(escolinhas, true);
  }, [escolinhas]);

  // Sincronização direta garantida
  const sincronizarComContratos = useCallback(async () => {
    return { totalSincronizadas: contratosEscolinhas.length };
  }, [contratosEscolinhas.length]);

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

  // Ações de gerenciamento das escolinhas diretamente no mesmo banco (contratos_recorrentes).
  // A escolinha nasce na aba Escolinhas (com quadra, dias e horários reais); aqui só se publica
  // a vitrine dela na landing. Criar um contrato daqui ocuparia a quadra com um horário fictício.
  const criarNovaEscolinha = useCallback(
    async (input: CriarEscolinhaInput) => {
      if (!input.contratoId) {
        throw new Error(
          "Cadastre a escolinha primeiro na aba Escolinhas (quadra, dias e horários) e depois importe-a aqui."
        );
      }

      const contrato = contratosEscolinhas.find((c) => c.id === input.contratoId);
      if (!contrato) {
        throw new Error("Contrato de escolinha não encontrado. Atualize a página e tente novamente.");
      }

      const dados = {
        nome: input.sportName,
        responsavelNome: input.teacherName,
        contatoWhatsapp: input.whatsappNumber,
        fotoUrl: input.teacherImageUrl,
        faixaEtaria: input.faixaEtaria,
        descricao: input.descricao,
        ativo: input.isActive ?? true,
      };
      const res = await atualizarContrato(contrato.id, dados);
      if (!res.ok) {
        throw new Error(res.motivo || "Erro ao publicar a escolinha.");
      }
      return converterContratoParaEscolinhaItem({ ...contrato, ...dados });
    },
    [atualizarContrato, contratosEscolinhas]
  );

  const atualizarEscolinhaExistente = useCallback(
    async (id: string, input: AtualizarEscolinhaInput) => {
      const res = await atualizarContrato(id, {
        ...(input.sportName !== undefined ? { nome: input.sportName } : {}),
        ...(input.teacherName !== undefined ? { responsavelNome: input.teacherName } : {}),
        ...(input.whatsappNumber !== undefined ? { contatoWhatsapp: input.whatsappNumber } : {}),
        ...(input.teacherImageUrl !== undefined ? { fotoUrl: input.teacherImageUrl } : {}),
        ...(input.faixaEtaria !== undefined ? { faixaEtaria: input.faixaEtaria } : {}),
        ...(input.descricao !== undefined ? { descricao: input.descricao } : {}),
        ...(input.isActive !== undefined ? { ativo: input.isActive } : {}),
      });
      return res.ok;
    },
    [atualizarContrato]
  );

  const removerEscolinhaExistente = useCallback(
    async (id: string) => {
      const res = await atualizarContrato(id, { ativo: false });
      return res.ok;
    },
    [atualizarContrato]
  );

  return {
    galeria,
    escolinhas,
    galeriaFiltrada,
    escolinhasAtivas,
    contratosEscolinhas,
    carregando,
    filtroCategoria,
    setFiltroCategoria,
    recarregar,
    sincronizarComContratos,
    criarFoto,
    atualizarFoto,
    removerFoto,
    criarNovaEscolinha,
    atualizarEscolinhaExistente,
    removerEscolinhaExistente,
    fazerUploadImagem: uploadImagemInstitucional,
  };
}
