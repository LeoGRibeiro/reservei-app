/**
 * @module components/landing/SecaoEstrutura
 *
 * Seção "O Local e Estrutura" da Landing Page.
 *
 * Apresenta a infraestrutura física do complexo com grid de fotos
 * de alta qualidade, abas de categoria ("Todas", "Quadras", "Bar & Lounge",
 * "Vestiários", "Lazer") e modal lightbox para visualização em alta resolução.
 *
 * @see SPEC/2026-10-06-lp-conteudo-institucional.md
 */

"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Images,
  Maximize2,
  X,
  ChevronLeft,
  ChevronRight,
  MapPin,
} from "lucide-react";
import { SECAO_IDS } from "@/lib/landingPage/secoes";
import type { GaleriaItem, FiltroCategoriaGaleria } from "@/lib/institucional/types";
import { useInstitucionalService } from "@/hooks/useInstitucionalService";

/** Abas disponíveis para filtragem por ambiente. */
const ABAS_CATEGORIA: Array<{
  id: FiltroCategoriaGaleria;
  rotulo: string;
}> = [
  { id: "todas", rotulo: "Todas as Áreas" },
  { id: "quadras", rotulo: "Quadras" },
  { id: "bar", rotulo: "Sports Bar & Lounge" },
  { id: "vestiarios", rotulo: "Vestiários" },
  { id: "lazer", rotulo: "Área de Lazer & Kids" },
];

export function SecaoEstrutura() {
  const { galeriaFiltrada, filtroCategoria, setFiltroCategoria } =
    useInstitucionalService();
  const [itemSelecionado, setItemSelecionado] = useState<GaleriaItem | null>(null);

  // Navegação no modal Lightbox
  const indexSelecionado = itemSelecionado
    ? galeriaFiltrada.findIndex((i) => i.id === itemSelecionado.id)
    : -1;

  const handleAnterior = () => {
    if (indexSelecionado > 0) {
      setItemSelecionado(galeriaFiltrada[indexSelecionado - 1]);
    } else {
      setItemSelecionado(galeriaFiltrada[galeriaFiltrada.length - 1]);
    }
  };

  const handleProximo = () => {
    if (indexSelecionado < galeriaFiltrada.length - 1) {
      setItemSelecionado(galeriaFiltrada[indexSelecionado + 1]);
    } else {
      setItemSelecionado(galeriaFiltrada[0]);
    }
  };

  return (
    <section
      id={SECAO_IDS.ESTRUTURA}
      aria-labelledby="estrutura-titulo"
      className="scroll-mt-20 py-16 sm:py-20 bg-slate-900/30 border-y border-slate-800/60 relative overflow-hidden"
    >
      {/* Detalhes de luz de fundo */}
      <div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
        {/* Cabeçalho da Seção */}
        <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-4">
            <Images className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Infraestrutura Completa</span>
          </div>

          <h2
            id="estrutura-titulo"
            className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight"
          >
            O Local e Estrutura
          </h2>

          <p className="mt-3 text-slate-400 text-sm sm:text-base leading-relaxed">
            Conheça as quadras e os ambientes da arena antes de vir jogar.
          </p>

          {/* Abas de filtro por categoria */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            {ABAS_CATEGORIA.map((aba) => {
              const ativa = filtroCategoria === aba.id;
              return (
                <button
                  key={aba.id}
                  id={`filtro-estrutura-${aba.id}`}
                  type="button"
                  onClick={() => setFiltroCategoria(aba.id)}
                  className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                    ativa
                      ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20"
                      : "bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white border border-slate-700/60"
                  }`}
                >
                  {aba.rotulo}
                </button>
              );
            })}
          </div>
        </div>

        {/* Grid de Fotos / Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {galeriaFiltrada.map((item) => (
            <article
              key={item.id}
              data-testid={`card-estrutura-${item.id}`}
              onClick={() => setItemSelecionado(item)}
              className="group relative bg-slate-900 border border-slate-800/90 rounded-2xl overflow-hidden shadow-lg hover:border-emerald-500/50 hover:shadow-emerald-500/5 transition-all duration-300 cursor-pointer flex flex-col"
            >
              {/* Container da Imagem */}
              <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-950">
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.src =
                      "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=1200&q=80";
                  }}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />

                {/* Tag de Categoria */}
                <div className="absolute top-3 left-3 z-10">
                  <span className="px-2.5 py-1 rounded-full bg-slate-950/80 backdrop-blur-md border border-slate-700/50 text-emerald-400 font-semibold text-[11px] uppercase tracking-wider">
                    {item.categoria}
                  </span>
                </div>

                {/* Botão de Zoom / Abrir */}
                <div className="absolute top-3 right-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-8 h-8 rounded-full bg-slate-950/80 backdrop-blur-md border border-slate-700/60 text-white flex items-center justify-center shadow">
                    <Maximize2 className="w-3.5 h-3.5" aria-hidden="true" />
                  </div>
                </div>

                {/* Sombra gradiente inferior */}
                <div
                  className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent opacity-80"
                  aria-hidden="true"
                />
              </div>

              {/* Informações textuais */}
              <div className="p-5 flex-1 flex flex-col justify-between bg-slate-900/60">
                <div>
                  <h3 className="font-bold text-white text-base sm:text-lg group-hover:text-emerald-300 transition-colors">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-xs sm:text-sm text-slate-400 line-clamp-3 leading-relaxed">
                    {item.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-end text-xs text-slate-500">
                  <span className="group-hover:text-emerald-400 transition-colors font-medium">
                    Ver detalhes →
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>

        {galeriaFiltrada.length === 0 && (
          <div className="text-center py-12 bg-slate-900/40 rounded-2xl border border-slate-800">
            <p className="text-slate-400 text-sm">
              Nenhuma foto cadastrada nesta categoria no momento.
            </p>
          </div>
        )}
      </div>

      {/* ── Modal Lightbox de Foto Expandida ─────────────────────────────── */}
      {itemSelecionado && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={itemSelecionado.title}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-6"
          onClick={() => setItemSelecionado(null)}
        >
          <div
            className="relative max-w-4xl w-full bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Botão Fechar */}
            <button
              type="button"
              id="fechar-lightbox"
              onClick={() => setItemSelecionado(null)}
              aria-label="Fechar visualização"
              className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-slate-950/80 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>

            {/* Imagem em Destaque */}
            <div className="relative aspect-[16/10] sm:aspect-[16/9] w-full bg-slate-950 flex items-center justify-center overflow-hidden">
              <img
                src={itemSelecionado.imageUrl}
                alt={itemSelecionado.title}
                onError={(e) => {
                  e.currentTarget.src =
                    "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=1200&q=80";
                }}
                className="w-full h-full object-cover"
              />

              {/* Botões de Navegação Anterior / Próximo */}
              <button
                type="button"
                id="lightbox-anterior"
                onClick={handleAnterior}
                aria-label="Foto anterior"
                className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-slate-950/70 hover:bg-slate-900 border border-slate-700/80 text-white flex items-center justify-center transition-all cursor-pointer"
              >
                <ChevronLeft className="w-5 h-5" aria-hidden="true" />
              </button>

              <button
                type="button"
                id="lightbox-proximo"
                onClick={handleProximo}
                aria-label="Próxima foto"
                className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-slate-950/70 hover:bg-slate-900 border border-slate-700/80 text-white flex items-center justify-center transition-all cursor-pointer"
              >
                <ChevronRight className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {/* Descrição Detalhada */}
            <div className="p-6 sm:p-8 bg-slate-900">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold text-xs uppercase tracking-wider">
                  {itemSelecionado.categoria}
                </span>
                <span className="text-slate-500 text-xs">
                  Foto {indexSelecionado + 1} de {galeriaFiltrada.length}
                </span>
              </div>

              <h3 className="text-xl sm:text-2xl font-bold text-white">
                {itemSelecionado.title}
              </h3>
              <p className="mt-3 text-sm sm:text-base text-slate-300 leading-relaxed">
                {itemSelecionado.description}
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
