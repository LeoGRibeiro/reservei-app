/**
 * @module components/admin/AdminInstitucionalPage
 *
 * Painel Administrativo para Gerenciamento do Conteúdo Institucional:
 * 1. Galeria de Fotos da Estrutura Física (Quadras, Bar, Vestiários, Lazer)
 *    com upload via Supabase Storage e edição de títulos e descrições.
 * 2. Escolinhas e Aulas Esportivas da Landing Page (professores, horários,
 *    WhatsApp e turmas abertas).
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
  CheckCircle,
  Eye,
  EyeOff,
  ExternalLink,
  Loader2,
  RefreshCw,
  Link2,
  CheckCircle2,
} from "lucide-react";
import type {
  GaleriaItem,
  EscolinhaItem,
  CriarGaleriaInput,
  CriarEscolinhaInput,
  CategoriaEstrutura,
} from "@/lib/institucional/types";
import { useInstitucionalService } from "@/hooks/useInstitucionalService";
import {
  validarItemGaleria,
  validarItemEscolinha,
  formatarHorariosContrato,
  mapearNomeEsporte,
} from "@/lib/institucional/institucionalHelpers";

export function AdminInstitucionalPage() {
  const {
    galeria,
    escolinhas,
    contratosEscolinhas,
    carregando,
    criarFoto,
    atualizarFoto,
    removerFoto,
    criarNovaEscolinha,
    atualizarEscolinhaExistente,
    removerEscolinhaExistente,
    fazerUploadImagem,
    sincronizarComContratos,
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
  const [enviandoFotoProfessor, setEnviandoFotoProfessor] = useState(false);
  const [sincronizandoEscolinhas, setSincronizandoEscolinhas] = useState(false);

  // Estado Modal Escolinhas
  const [modalEscolinhaAberto, setModalEscolinhaAberto] = useState(false);
  const [escolinhaEmEdicao, setEscolinhaEmEdicao] = useState<EscolinhaItem | null>(null);
  const [formEscolinha, setFormEscolinha] = useState<CriarEscolinhaInput>({
    sportName: "",
    teacherName: "",
    teacherImageUrl: "",
    scheduleInfo: "",
    whatsappNumber: "",
    descricao: "",
    faixaEtaria: "",
    isActive: true,
  });

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

  // ── Handlers das Escolinhas ───────────────────────────────────────────────

  const handleUploadFotoProfessor = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setEnviandoFotoProfessor(true);
    const res = await fazerUploadImagem(file, "professores");
    setEnviandoFotoProfessor(false);

    if (res.success && res.url) {
      setFormEscolinha((prev) => ({ ...prev, teacherImageUrl: res.url! }));
      toast.success("Foto do professor enviada com sucesso!");
    } else {
      toast.error(res.error || "Não foi possível enviar a foto do professor.");
    }
  };

  const handleSincronizarAgenda = async () => {
    setSincronizandoEscolinhas(true);
    try {
      const res = await sincronizarComContratos();
      if (res.totalSincronizadas > 0) {
        toast.success(`${res.totalSincronizadas} escolinha(s) sincronizada(s) com os contratos da agenda!`);
      } else {
        toast.info("Nenhuma escolinha encontrada nos contratos da agenda para sincronizar.");
      }
    } catch {
      toast.error("Erro ao sincronizar escolinhas com a agenda.");
    } finally {
      setSincronizandoEscolinhas(false);
    }
  };

  const handleSelecionarContratoParaPreencher = (contratoId: string) => {
    if (!contratoId) {
      setFormEscolinha((prev) => ({ ...prev, contratoId: undefined }));
      return;
    }
    const contrato = contratosEscolinhas.find((c) => c.id === contratoId);
    if (!contrato) return;

    setFormEscolinha((prev) => ({
      ...prev,
      contratoId: contrato.id,
      sportName: mapearNomeEsporte(contrato.esporte, contrato.nome),
      teacherName: contrato.responsavelNome || prev.teacherName,
      whatsappNumber: contrato.contatoWhatsapp || prev.whatsappNumber,
      scheduleInfo: formatarHorariosContrato(contrato),
      descricao: prev.descricao || contrato.descricao || "",
    }));
  };

  const handleAbrirNovaEscolinha = () => {
    setEscolinhaEmEdicao(null);
    setFormEscolinha({
      contratoId: undefined,
      sportName: "",
      teacherName: "",
      teacherImageUrl: "",
      scheduleInfo: "",
      whatsappNumber: "",
      descricao: "",
      faixaEtaria: "",
      isActive: true,
    });
    setModalEscolinhaAberto(true);
  };

  const handleAbrirEditarEscolinha = (item: EscolinhaItem) => {
    setEscolinhaEmEdicao(item);
    setFormEscolinha({
      contratoId: item.contratoId,
      sportName: item.sportName,
      teacherName: item.teacherName,
      teacherImageUrl: item.teacherImageUrl,
      scheduleInfo: item.scheduleInfo,
      whatsappNumber: item.whatsappNumber,
      descricao: item.descricao || "",
      faixaEtaria: item.faixaEtaria || "",
      isActive: item.isActive,
    });
    setModalEscolinhaAberto(true);
  };

  const handleSalvarEscolinha = async (e: React.FormEvent) => {
    e.preventDefault();
    const validacao = validarItemEscolinha(formEscolinha);
    if (!validacao.valido) {
      toast.error(validacao.erros[0]);
      return;
    }

    try {
      if (escolinhaEmEdicao) {
        await atualizarEscolinhaExistente(escolinhaEmEdicao.id, formEscolinha);
        toast.success("Escolinha atualizada com sucesso!");
      } else {
        await criarNovaEscolinha(formEscolinha);
        toast.success("Escolinha publicada na landing page!");
      }
      setModalEscolinhaAberto(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar dados da escolinha.");
    }
  };

  const handleRemoverEscolinha = async (id: string, esporte: string) => {
    if (!window.confirm(`Deseja remover a escolinha de "${esporte}" da Landing Page?`)) return;
    try {
      await removerEscolinhaExistente(id);
      toast.success("Escolinha removida com sucesso.");
    } catch {
      toast.error("Erro ao remover escolinha.");
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
            Escolinhas da LP ({escolinhas.length})
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

      {/* ── ABA 2: ESCOLINHAS ESPORTIVAS ──────────────────────────────────── */}
      {abaAtiva === "escolinhas" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <span className="text-xs text-slate-400">
              Modalidades e turmas exibidas na seção <strong>&ldquo;Escolinhas e Aulas&rdquo;</strong> da LP.
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                id="btn-admin-sincronizar-agenda"
                onClick={handleSincronizarAgenda}
                disabled={sincronizandoEscolinhas}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-semibold transition-colors cursor-pointer border border-slate-700 disabled:opacity-50"
                title="Puxar ou atualizar escolinhas automaticamente com base nos contratos cadastrados na aba Escolinhas da agenda"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 text-emerald-400 ${
                    sincronizandoEscolinhas ? "animate-spin" : ""
                  }`}
                />
                <span>Sincronizar com Agenda ({contratosEscolinhas.length})</span>
              </button>
              <button
                type="button"
                id="btn-admin-nova-escolinha"
                onClick={handleAbrirNovaEscolinha}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs sm:text-sm font-bold transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Nova Escolinha
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {escolinhas.map((item) => (
              <div
                key={item.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="text-lg font-bold text-white">{item.sportName}</h3>
                    {!item.isActive && (
                      <span className="px-2 py-0.5 rounded-full bg-red-950/80 border border-red-500/50 text-red-300 font-bold text-[10px]">
                        Inativo
                      </span>
                    )}
                  </div>

                  {item.contratoId && (
                    <div className="mb-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-800/60 text-emerald-400 text-[10px] font-semibold">
                        <Link2 className="w-3 h-3" />
                        Sincronizada com Contrato
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 mb-4">
                    <img
                      src={item.teacherImageUrl}
                      alt={item.teacherName}
                      className="w-10 h-10 rounded-lg object-cover border border-slate-700"
                    />
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-semibold">
                        Professor
                      </span>
                      <p className="text-xs font-bold text-white">{item.teacherName}</p>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-400 mb-4">
                    <p>
                      <strong>Horários:</strong> {item.scheduleInfo}
                    </p>
                    {item.faixaEtaria && (
                      <p>
                        <strong>Faixa etária:</strong> {item.faixaEtaria}
                      </p>
                    )}
                    <p>
                      <strong>WhatsApp:</strong> {item.whatsappNumber}
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() =>
                      atualizarEscolinhaExistente(item.id, { isActive: !item.isActive })
                    }
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200"
                  >
                    {item.isActive ? (
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
                      id={`btn-editar-escolinha-${item.id}`}
                      onClick={() => handleAbrirEditarEscolinha(item)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                      title="Editar escolinha"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      id={`btn-excluir-escolinha-${item.id}`}
                      onClick={() => handleRemoverEscolinha(item.id, item.sportName)}
                      className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                      title="Excluir escolinha"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
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

      {/* ── MODAL FORMULÁRIO ESCOLINHA ─────────────────────────────────────── */}
      {modalEscolinhaAberto && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <h2 className="text-xl font-bold text-white">
              {escolinhaEmEdicao ? "Editar Escolinha" : "Nova Escolinha"}
            </h2>

            <form onSubmit={handleSalvarEscolinha} className="space-y-4">
              {contratosEscolinhas.length > 0 && !escolinhaEmEdicao && (
                <div className="p-3 rounded-2xl bg-emerald-950/40 border border-emerald-800/60 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                    <Link2 className="w-3.5 h-3.5" />
                    <span>Importar da Agenda de Escolinhas:</span>
                  </div>
                  <select
                    id="select-contrato-escolinha"
                    value={formEscolinha.contratoId || ""}
                    onChange={(e) => handleSelecionarContratoParaPreencher(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl bg-slate-950 border border-emerald-700/60 text-white text-xs outline-none focus:border-emerald-500"
                  >
                    <option value="">-- Selecione um contrato para preencher --</option>
                    {contratosEscolinhas.map((contrato) => (
                      <option key={contrato.id} value={contrato.id}>
                        {contrato.nome} ({contrato.responsavelNome})
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-400">
                    Ao selecionar, esporte, professor, horários e WhatsApp serão preenchidos automaticamente. Você só precisará definir a foto e a faixa etária.
                  </p>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Modalidade / Esporte
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Tênis de Campo"
                  value={formEscolinha.sportName}
                  onChange={(e) =>
                    setFormEscolinha((prev) => ({ ...prev, sportName: e.target.value }))
                  }
                  className="w-full h-10 px-3 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Nome do Professor
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Prof. Rodrigo Alencar"
                    value={formEscolinha.teacherName}
                    onChange={(e) =>
                      setFormEscolinha((prev) => ({ ...prev, teacherName: e.target.value }))
                    }
                    className="w-full h-10 px-3 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    WhatsApp do Professor
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="11999998888"
                    value={formEscolinha.whatsappNumber}
                    onChange={(e) =>
                      setFormEscolinha((prev) => ({
                        ...prev,
                        whatsappNumber: e.target.value,
                      }))
                    }
                    className="w-full h-10 px-3 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Foto / Avatar do Professor
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    required
                    placeholder="https://... ou faça upload"
                    value={formEscolinha.teacherImageUrl}
                    onChange={(e) =>
                      setFormEscolinha((prev) => ({
                        ...prev,
                        teacherImageUrl: e.target.value,
                      }))
                    }
                    className="flex-1 h-10 px-3 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm outline-none"
                  />
                  <label className="flex items-center gap-1.5 px-3 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold cursor-pointer transition-colors shrink-0">
                    {enviandoFotoProfessor ? (
                      <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                    ) : (
                      <Upload className="w-4 h-4 text-emerald-400" />
                    )}
                    <span>{enviandoFotoProfessor ? "Enviando..." : "Upload"}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleUploadFotoProfessor}
                      className="hidden"
                      disabled={enviandoFotoProfessor}
                    />
                  </label>
                </div>
                {formEscolinha.teacherImageUrl && (
                  <div className="mt-2 flex items-center gap-2">
                    <img
                      src={formEscolinha.teacherImageUrl}
                      alt="Preview do professor"
                      className="w-10 h-10 rounded-lg object-cover border border-slate-700"
                    />
                    <span className="text-[11px] text-slate-400">Prévia da imagem</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Dias e Horários
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Terças e Quintas: 08h às 10h"
                    value={formEscolinha.scheduleInfo}
                    onChange={(e) =>
                      setFormEscolinha((prev) => ({
                        ...prev,
                        scheduleInfo: e.target.value,
                      }))
                    }
                    className="w-full h-10 px-3 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Faixa Etária
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Infantil (6 a 14 anos)"
                    value={formEscolinha.faixaEtaria || ""}
                    onChange={(e) =>
                      setFormEscolinha((prev) => ({
                        ...prev,
                        faixaEtaria: e.target.value,
                      }))
                    }
                    className="w-full h-10 px-3 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Descrição da Metodologia
                </label>
                <textarea
                  rows={2}
                  placeholder="Ex: Turmas reduzidas para maior atenção individual..."
                  value={formEscolinha.descricao || ""}
                  onChange={(e) =>
                    setFormEscolinha((prev) => ({
                      ...prev,
                      descricao: e.target.value,
                    }))
                  }
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalEscolinhaAberto(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  id="btn-salvar-escolinha-modal"
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-colors"
                >
                  Salvar Escolinha
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
