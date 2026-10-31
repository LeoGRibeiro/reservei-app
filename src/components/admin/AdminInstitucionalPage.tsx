/**
 * @module components/admin/AdminInstitucionalPage
 *
 * Painel Administrativo para Gerenciamento do Conteúdo Institucional:
 * 1. Galeria de Fotos da Estrutura Física (Quadras, Bar, Vestiários, Lazer)
 *    com upload via Supabase Storage e edição de títulos e descrições.
 * 2. Escolinhas do site (aba própria: {@link AbaEscolinhasSite}).
 *
 * @see SPEC/2026-10-06-lp-conteudo-institucional.md
 */

"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Images,
  GraduationCap,
  Plus,
  Pencil,
  Trash2,
  Upload,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";
import type {
  GaleriaItem,
  CriarGaleriaInput,
  CategoriaEstrutura,
} from "@/lib/institucional/types";
import { useInstitucionalService } from "@/hooks/useInstitucionalService";
import { AbaEscolinhasSite } from "./institucional/AbaEscolinhasSite";
import {
  validarItemGaleria,
} from "@/lib/institucional/institucionalHelpers";

export function AdminInstitucionalPage() {
  const {
    galeria,
    carregando,
    criarFoto,
    atualizarFoto,
    removerFoto,
    fazerUploadImagem,
  } = useInstitucionalService();

  const [abaAtiva, setAbaAtiva] = useState<"galeria" | "escolinhas">("galeria");

  // Estado Modal Galeria
  const [modalGaleriaAberto, setModalGaleriaAberto] = useState(false);
  const [fotoEmEdicao, setFotoEmEdicao] = useState<GaleriaItem | null>(null);
  const [formGaleria, setFormGaleria] = useState<CriarGaleriaInput>({
    title: "",
    description: "",
    imageUrl: "",
    categoria: "quadras",
    displayOrder: 1,
    isActive: true,
  });
  const [enviandoImagem, setEnviandoImagem] = useState(false);
  // ── Handlers da Galeria ───────────────────────────────────────────────────

  const handleAbrirNovaFoto = () => {
    setFotoEmEdicao(null);
    setFormGaleria({
      title: "",
      description: "",
      imageUrl: "",
      categoria: "quadras",
      displayOrder: galeria.length + 1,
      isActive: true,
    });
    setModalGaleriaAberto(true);
  };

  const handleAbrirEditarFoto = (item: GaleriaItem) => {
    setFotoEmEdicao(item);
    setFormGaleria({
      title: item.title,
      description: item.description,
      imageUrl: item.imageUrl,
      categoria: item.categoria,
      displayOrder: item.displayOrder,
      isActive: item.isActive,
    });
    setModalGaleriaAberto(true);
  };

  const handleUploadFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setEnviandoImagem(true);
    const res = await fazerUploadImagem(file, "galeria");
    setEnviandoImagem(false);

    if (res.success && res.url) {
      setFormGaleria((prev) => ({ ...prev, imageUrl: res.url! }));
      toast.success("Imagem enviada com sucesso!");
    } else {
      toast.error(res.error || "Não foi possível enviar a imagem.");
    }
  };

  const handleSalvarFoto = async (e: React.FormEvent) => {
    e.preventDefault();
    const validacao = validarItemGaleria(formGaleria);
    if (!validacao.valido) {
      toast.error(validacao.erros[0]);
      return;
    }

    try {
      if (fotoEmEdicao) {
        await atualizarFoto(fotoEmEdicao.id, formGaleria);
        toast.success("Foto da galeria atualizada com sucesso!");
      } else {
        await criarFoto(formGaleria);
        toast.success("Nova foto adicionada à galeria!");
      }
      setModalGaleriaAberto(false);
    } catch {
      toast.error("Erro ao salvar foto da galeria.");
    }
  };

  const handleRemoverFoto = async (id: string, titulo: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir "${titulo}" da galeria?`)) return;
    try {
      await removerFoto(id);
      toast.success("Foto removida da galeria.");
    } catch {
      toast.error("Erro ao remover foto.");
    }
  };

  if (carregando) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Topo da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Images className="w-6 h-6 text-emerald-400" />
            Conteúdo Institucional
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Gerenciamento das fotos da estrutura física e das escolinhas divulgadas na Landing Page.
          </p>
        </div>

        {/* Abas Superiores */}
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-1 rounded-xl">
          <button
            type="button"
            id="admin-aba-galeria"
            onClick={() => setAbaAtiva("galeria")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
              abaAtiva === "galeria"
                ? "bg-emerald-500 text-slate-950 shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Images className="w-4 h-4" />
            Galeria do Complexo ({galeria.length})
          </button>
          <button
            type="button"
            id="admin-aba-escolinhas"
            onClick={() => setAbaAtiva("escolinhas")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
              abaAtiva === "escolinhas"
                ? "bg-emerald-500 text-slate-950 shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            Escolinhas do site
          </button>
        </div>
      </div>

      {/* ── ABA 1: GALERIA DE FOTOS ────────────────────────────────────────── */}
      {abaAtiva === "galeria" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">
              Fotos que aparecem na seção <strong>&ldquo;O Local e Estrutura&rdquo;</strong>
            </span>
            <button
              type="button"
              id="btn-admin-nova-foto"
              onClick={handleAbrirNovaFoto}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs sm:text-sm font-bold transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Adicionar Foto
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {galeria.map((foto) => (
              <div
                key={foto.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col justify-between"
              >
                <div className="relative aspect-[16/10] bg-slate-950">
                  <img
                    src={foto.imageUrl}
                    alt={foto.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 left-2 flex gap-1.5">
                    <span className="px-2 py-0.5 rounded-full bg-slate-950/80 border border-slate-700/80 text-emerald-400 font-semibold text-[10px] uppercase">
                      {foto.categoria}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-slate-950/80 border border-slate-700/80 text-slate-300 font-semibold text-[10px]">
                      Ordem: {foto.displayOrder}
                    </span>
                  </div>
                  {!foto.isActive && (
                    <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-red-950/80 border border-red-500/50 text-red-300 font-bold text-[10px]">
                      Inativo
                    </div>
                  )}
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-white text-sm">{foto.title}</h3>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                      {foto.description}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() =>
                        atualizarFoto(foto.id, { isActive: !foto.isActive })
                      }
                      className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200"
                    >
                      {foto.isActive ? (
                        <>
                          <Eye className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Ativo</span>
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-3.5 h-3.5 text-slate-500" />
                          <span>Oculto</span>
                        </>
                      )}
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        id={`btn-editar-foto-${foto.id}`}
                        onClick={() => handleAbrirEditarFoto(foto)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                        title="Editar foto"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        id={`btn-excluir-foto-${foto.id}`}
                        onClick={() => handleRemoverFoto(foto.id, foto.title)}
                        className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                        title="Excluir foto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── ABA 2: ESCOLINHAS DO SITE ─────────────────────────────────────── */}
      {abaAtiva === "escolinhas" && <AbaEscolinhasSite />}

      {/* ── MODAL FORMULÁRIO GALERIA ───────────────────────────────────────── */}
      {modalGaleriaAberto && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <h2 className="text-xl font-bold text-white">
              {fotoEmEdicao ? "Editar Foto da Estrutura" : "Nova Foto da Estrutura"}
            </h2>

            <form onSubmit={handleSalvarFoto} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Título do Ambiente
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Nossas Quadras de Saibro"
                  value={formGaleria.title}
                  onChange={(e) =>
                    setFormGaleria((prev) => ({ ...prev, title: e.target.value }))
                  }
                  className="w-full h-10 px-3 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:border-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Categoria
                </label>
                <select
                  value={formGaleria.categoria}
                  onChange={(e) =>
                    setFormGaleria((prev) => ({
                      ...prev,
                      categoria: e.target.value as CategoriaEstrutura,
                    }))
                  }
                  className="w-full h-10 px-3 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:border-emerald-500 outline-none"
                >
                  <option value="quadras">Quadras</option>
                  <option value="bar">Sports Bar & Lounge</option>
                  <option value="vestiarios">Vestiários</option>
                  <option value="lazer">Área de Lazer & Kids</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Descrição dos Diferenciais
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Ex: Iluminação em LED de 500 lux, saibro tratado e drenagem rápida."
                  value={formGaleria.description}
                  onChange={(e) =>
                    setFormGaleria((prev) => ({ ...prev, description: e.target.value }))
                  }
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:border-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  URL da Imagem ou Upload via Supabase Storage
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    required
                    placeholder="https://..."
                    value={formGaleria.imageUrl}
                    onChange={(e) =>
                      setFormGaleria((prev) => ({ ...prev, imageUrl: e.target.value }))
                    }
                    className="flex-1 h-10 px-3 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:border-emerald-500 outline-none"
                  />
                  <label className="flex items-center gap-1.5 px-3 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer border border-slate-700 transition-colors">
                    {enviandoImagem ? (
                      <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                    ) : (
                      <Upload className="w-4 h-4 text-emerald-400" />
                    )}
                    <span>Upload</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleUploadFoto}
                      className="hidden"
                      disabled={enviandoImagem}
                    />
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Ordem de Exibição
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={formGaleria.displayOrder}
                    onChange={(e) =>
                      setFormGaleria((prev) => ({
                        ...prev,
                        displayOrder: Number(e.target.value),
                      }))
                    }
                    className="w-full h-10 px-3 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm outline-none"
                  />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="chk-galeria-ativo"
                    checked={formGaleria.isActive}
                    onChange={(e) =>
                      setFormGaleria((prev) => ({ ...prev, isActive: e.target.checked }))
                    }
                    className="w-4 h-4 rounded accent-emerald-500"
                  />
                  <label htmlFor="chk-galeria-ativo" className="text-xs text-slate-300">
                    Visível no site
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalGaleriaAberto(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  id="btn-salvar-foto-modal"
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-colors"
                >
                  Salvar Foto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
