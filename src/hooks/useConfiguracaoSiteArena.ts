/**
 * @file useConfiguracaoSiteArena.ts
 * @description Configuração institucional (marca, local e contato) da arena ativa, para o portal
 * white-label. Enquanto a arena não carrega, usa a configuração padrão da plataforma.
 */

"use client";

import { useMemo } from "react";
import { SITE_CONFIG } from "@/lib/landingPage/siteConfig";
import type { ConfiguracaoSite } from "@/lib/landingPage/types";
import type { Arena } from "@/lib/arena/types";
import { useCatalogoArenaStore } from "@/store/useCatalogoArenaStore";

/**
 * Converte um telefone brasileiro em número internacional do wa.me (ex.: '(91) 98123-4567' -> '5591981234567').
 *
 * @param telefone Telefone com ou sem máscara
 * @returns Somente dígitos com DDI 55, ou string vazia
 */
export function whatsappInternacional(telefone?: string | null): string {
  const digitos = (telefone ?? "").replace(/\D/g, "");
  if (!digitos) return "";
  return digitos.startsWith("55") && digitos.length >= 12 ? digitos : `55${digitos}`;
}

/**
 * Monta a configuração do site a partir da arena (sem redes sociais genéricas de exemplo).
 *
 * @param arena Arena ativa, ou null
 * @returns Configuração institucional
 */
export function configuracaoDaArena(arena: Arena | null): ConfiguracaoSite {
  if (!arena || !arena.nome) return SITE_CONFIG;

  const whatsapp = whatsappInternacional(arena.whatsapp || arena.telefone);
  const local = [arena.cidade, arena.estado].filter(Boolean).join("/");
  return {
    ...SITE_CONFIG,
    nomePlataforma: arena.nome,
    descricaoEstabelecimento: local || SITE_CONFIG.descricaoEstabelecimento,
    whatsappNumero: whatsapp || SITE_CONFIG.whatsappNumero,
    redesSociais: whatsapp ? [{ rede: "whatsapp", rotulo: "WhatsApp", url: `https://wa.me/${whatsapp}` }] : [],
  };
}

/**
 * Endereço exibível da arena (ex.: 'Av. Brasil, 100 – Belém/PA').
 *
 * @param arena Arena ativa, ou null
 * @param padrao Texto quando a arena não informou endereço
 * @returns Endereço formatado
 */
export function enderecoDaArena(arena: Arena | null, padrao: string): string {
  if (!arena || !arena.nome) return padrao;
  const local = [arena.cidade, arena.estado].filter(Boolean).join("/");
  return [arena.endereco, local].filter(Boolean).join(" – ") || padrao;
}

/**
 * Hook: percentual do sinal da arena ativa como fração (ex.: 0.5 para 50%).
 *
 * @param padrao Fração usada enquanto a arena não carrega
 */
export function usePercentualSinalArena(padrao: number): number {
  const arena = useCatalogoArenaStore((s) => s.arena);
  return arena ? Math.max(0, Math.min(100, arena.percentualSinalMinimo)) / 100 : padrao;
}

/** Hook: endereço da arena ativa, com texto padrão enquanto ela não carrega. */
export function useEnderecoArena(padrao: string): string {
  const arena = useCatalogoArenaStore((s) => s.arena);
  return enderecoDaArena(arena, padrao);
}

/**
 * Hook: configuração institucional da arena ativa.
 *
 * @example
 * ```tsx
 * const config = useConfiguracaoSiteArena();
 * <span>{config.nomePlataforma}</span>
 * ```
 */
export function useConfiguracaoSiteArena(): ConfiguracaoSite {
  const arena = useCatalogoArenaStore((s) => s.arena);
  return useMemo(() => configuracaoDaArena(arena), [arena]);
}
