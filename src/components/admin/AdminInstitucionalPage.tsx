/**
 * @module components/admin/AdminInstitucionalPage
 *
 * Painel Administrativo para Gerenciamento do Conteúdo Institucional:
 * 1. Galeria de Fotos da Estrutura Física (Quadras, Bar, Vestiários, Lazer)
 *    com upload via Supabase Storage e edição de títulos e descrições.
 * As escolinhas do site ficam no menu Escolinhas (`AdminEscolinhasPage`).
 *
 * @see SPEC/2026-10-06-lp-conteudo-institucional.md
 */

"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
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
import {
  validarItemGaleria,
} from "@/lib/institucional/institucionalHelpers";
import { CabecalhoPagina } from "@/components/admin/ui";

export function AdminInstitucionalPage() {
  const {
    galeria,
    carregando,
    criarFoto,
    atualizarFoto,
    removerFoto,
    fazerUploadImagem,
  } = useInstitucionalService();

  const abaAtiva = "galeria" as const;

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
      <div className="flex items-center justify-center py-20 text-painel-suave">
        <Loader2 className="w-8 h-8 animate-spin text-painel-destaque" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <CabecalhoPagina titulo="Site" descricao="Fotos da estrutura que aparecem no site da arena. As escolinhas ficam no menu Escolinhas." />

      {/* ── ABA 1: GALERIA DE FOTOS ────────────────────────────────────────── */}
      {abaAtiva === "galeria" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-painel-suave">
              Fotos que aparecem na seção <strong>&ldquo;O Local e Estrutura&rdquo;</strong>
            </span>
            <button
              type="button"
              id="btn-admin-nova-foto"
              onClick={handleAbrirNovaFoto}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-painel-destaque hover:bg-painel-destaque-forte text-white text-xs sm:text-sm font-bold transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Adicionar Foto
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {galeria.map((foto) => (
              <div
                key={foto.id}
                className="bg-painel-superficie border border-painel-linha rounded-lg overflow-hidden flex flex-col justify-between"
              >
                <div className="relative aspect-[16/10] bg-painel-superficie">
                  <img
                    src={foto.imageUrl}
                    alt={foto.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 left-2 flex gap-1.5">
                    <span className="px-2 py-0.5 rounded-full bg-painel-superficie border border-painel-linha text-painel-destaque font-semibold text-xs">
                      {foto.categoria}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-painel-superficie border border-painel-linha text-painel-tinta font-semibold text-xs">
                      Ordem: {foto.displayOrder}
                    </span>
                  </div>
                  {!foto.isActive && (
                    <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-700 font-bold text-xs">
                      Inativo
                    </div>
                  )}
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-painel-tinta text-sm">{foto.title}</h3>
                    <p className="text-xs text-painel-suave mt-1 line-clamp-2">
                      {foto.description}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-painel-linha flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() =>
                        atualizarFoto(foto.id, { isActive: !foto.isActive })
                      }
                      className="flex items-center gap-1.5 text-xs text-painel-suave hover:text-painel-tinta"
                    >
                      {foto.isActive ? (
                        <>
                          <Eye className="w-3.5 h-3.5 text-painel-destaque" />
                          <span>Ativo</span>
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-3.5 h-3.5 text-painel-suave" />
                          <span>Oculto</span>
                        </>
                      )}
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        id={`btn-editar-foto-${foto.id}`}
                        onClick={() => handleAbrirEditarFoto(foto)}
                        className="p-1.5 rounded-lg bg-painel-elevada hover:bg-painel-fundo text-painel-tinta hover:text-painel-tinta transition-colors"
                        title="Editar foto"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        id={`btn-excluir-foto-${foto.id}`}
                        onClick={() => handleRemoverFoto(foto.id, foto.title)}
                        className="p-1.5 rounded-lg bg-red-50 hover:bg-red-50 text-red-700 transition-colors"
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

      {/* ── MODAL FORMULÁRIO GALERIA ───────────────────────────────────────── */}
      {modalGaleriaAberto && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-stone-900/40 flex items-center justify-center p-4"
        >
          <div className="bg-painel-superficie border border-painel-linha rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <h2 className="text-xl font-bold text-painel-tinta">
              {fotoEmEdicao ? "Editar Foto da Estrutura" : "Nova Foto da Estrutura"}
            </h2>

            <form onSubmit={handleSalvarFoto} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-painel-tinta block mb-1">
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
                  className="w-full h-10 px-3 rounded-md bg-painel-superficie border border-painel-linha text-painel-tinta text-sm focus:border-painel-destaque outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-painel-tinta block mb-1">
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
                  className="w-full h-10 px-3 rounded-md bg-painel-superficie border border-painel-linha text-painel-tinta text-sm focus:border-painel-destaque outline-none"
                >
                  <option value="quadras">Quadras</option>
                  <option value="bar">Sports Bar & Lounge</option>
                  <option value="vestiarios">Vestiários</option>
                  <option value="lazer">Área de Lazer & Kids</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-painel-tinta block mb-1">
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
                  className="w-full p-3 rounded-md bg-painel-superficie border border-painel-linha text-painel-tinta text-sm focus:border-painel-destaque outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-painel-tinta block mb-1">
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
                    className="flex-1 h-10 px-3 rounded-md bg-painel-superficie border border-painel-linha text-painel-tinta text-sm focus:border-painel-destaque outline-none"
                  />
                  <label className="flex items-center gap-1.5 px-3 h-10 rounded-md bg-painel-elevada hover:bg-painel-fundo text-painel-tinta text-xs font-semibold cursor-pointer border border-painel-linha transition-colors">
                    {enviandoImagem ? (
                      <Loader2 className="w-4 h-4 animate-spin text-painel-destaque" />
                    ) : (
                      <Upload className="w-4 h-4 text-painel-destaque" />
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
                  <label className="text-xs font-semibold text-painel-tinta block mb-1">
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
                    className="w-full h-10 px-3 rounded-md bg-painel-superficie border border-painel-linha text-painel-tinta text-sm outline-none"
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
                    className="w-4 h-4 rounded accent-[var(--painel-destaque)]"
                  />
                  <label htmlFor="chk-galeria-ativo" className="text-xs text-painel-tinta">
                    Visível no site
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-painel-linha">
                <button
                  type="button"
                  onClick={() => setModalGaleriaAberto(false)}
                  className="px-4 py-2 rounded-md text-xs font-semibold text-painel-suave hover:text-painel-tinta"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  id="btn-salvar-foto-modal"
                  className="px-5 py-2 rounded-md bg-painel-destaque hover:bg-painel-destaque-forte text-white text-xs font-bold transition-colors"
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
