/**
 * @file AdminQuadrasPage.tsx
 * @description Painel administrativo corporativo para gerenciamento completo de quadras esportivas,
 * tipos de piso, comodidades físicas e tabelas de precificação dinâmica por faixa horária e dia da semana.
 */

"use client";

import { useState, useCallback } from "react";
import {
  Plus,
  Edit2,
  Trash2,
  Sun,
  ShieldCheck,
  Clock,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useArena } from "@/hooks/useArena";
import { ArenaRepository } from "@/lib/arena/arenaRepository";
import type { Quadra, TipoPisoQuadra } from "@/lib/arena/types";
import { ESPORTES, type Esporte } from "@/lib/quadras";
import { Botao, CabecalhoPagina, Janela } from "@/components/admin/ui";

const TIPOS_PISO: { valor: TipoPisoQuadra; label: string }[] = [
  { valor: "areia", label: "Areia (Beach Tennis / Futevôlei)" },
  { valor: "society", label: "Grama Sintética (Society)" },
  { valor: "saibro", label: "Saibro (Tênis)" },
  { valor: "pu_cimentado", label: "Piso PU / Poliesportivo" },
  { valor: "madeira", label: "Madeira / Parquet" },
  { valor: "outro", label: "Outro" },
];

const DIAS_SEMANA_NOMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function AdminQuadrasPage() {
  const { arena, quadras, precos, recarregar, carregando } = useArena();

  // Estados dos modais
  const [modalQuadraAberto, setModalQuadraAberto] = useState(false);
  const [quadraEmEdicao, setQuadraEmEdicao] = useState<Quadra | null>(null);

  const [modalPrecoAberto, setModalPrecoAberto] = useState(false);
  const [quadraAlvoPreco, setQuadraAlvoPreco] = useState<Quadra | null>(null);

  // Formulário de Quadra
  const [numero, setNumero] = useState(1);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipoPiso, setTipoPiso] = useState<TipoPisoQuadra>("areia");
  const [valorHoraPadrao, setValorHoraPadrao] = useState(90);
  const [coberta, setCoberta] = useState(false);
  const [iluminacao, setIluminacao] = useState(true);
  const [esportesSelecionados, setEsportesSelecionados] = useState<Esporte[]>([
    "Futsal",
    "Vôlei",
  ]);

  // Formulário de Tarifa Dinâmica
  const [precoDescricao, setPrecoDescricao] = useState("");
  const [horaInicio, setHoraInicio] = useState("18:00");
  const [horaFim, setHoraFim] = useState("23:00");
  const [valorHoraEspecial, setValorHoraEspecial] = useState(120);
  const [diasSelecionados, setDiasSelecionados] = useState<number[]>([1, 2, 3, 4, 5]);

  // Abre modal para criação de quadra
  const abrirCriacaoQuadra = useCallback(() => {
    setQuadraEmEdicao(null);
    setNumero((quadras?.length || 0) + 1);
    setNome(`Quadra ${(quadras?.length || 0) + 1}`);
    setDescricao("");
    setTipoPiso("areia");
    setValorHoraPadrao(90);
    setCoberta(false);
    setIluminacao(true);
    setEsportesSelecionados(["Futsal", "Vôlei"]);
    setModalQuadraAberto(true);
  }, [quadras]);

  // Abre modal para edição de quadra
  const abrirEdicaoQuadra = useCallback((quadra: Quadra) => {
    setQuadraEmEdicao(quadra);
    setNumero(quadra.numero);
    setNome(quadra.nome);
    setDescricao(quadra.descricao || "");
    setTipoPiso(quadra.tipoPiso);
    setValorHoraPadrao(quadra.valorHoraPadrao);
    setCoberta(quadra.coberta);
    setIluminacao(quadra.iluminacao);
    setEsportesSelecionados(quadra.esportes || []);
    setModalQuadraAberto(true);
  }, []);

  // Alterna esporte no formulário
  const toggleEsporte = useCallback((esp: Esporte) => {
    setEsportesSelecionados((prev) =>
      prev.includes(esp) ? prev.filter((e) => e !== esp) : [...prev, esp]
    );
  }, []);

  // Alterna dia da semana na tarifa
  const toggleDiaSemana = useCallback((diaIdx: number) => {
    setDiasSelecionados((prev) =>
      prev.includes(diaIdx) ? prev.filter((d) => d !== diaIdx) : [...prev, diaIdx]
    );
  }, []);

  // Salva ou atualiza a quadra
  const handleSalvarQuadra = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      toast.error("O nome da quadra é obrigatório.");
      return;
    }

    try {
      if (quadraEmEdicao) {
        await ArenaRepository.atualizarQuadra(quadraEmEdicao.id, {
          numero,
          nome,
          descricao,
          tipoPiso,
          valorHoraPadrao,
          coberta,
          iluminacao,
          esportes: esportesSelecionados,
        });
        toast.success(`Quadra '${nome}' atualizada com sucesso!`);
      } else {
        await ArenaRepository.criarQuadra({
          arenaId: arena.id,
          numero,
          nome,
          descricao,
          tipoPiso,
          valorHoraPadrao,
          coberta,
          iluminacao,
          esportes: esportesSelecionados,
          ordem: numero,
          ativa: true,
        });
        toast.success(`Nova quadra '${nome}' cadastrada!`);
      }

      setModalQuadraAberto(false);
      await recarregar();
    } catch {
      toast.error("Erro ao salvar dados da quadra.");
    }
  };

  // Remove uma quadra
  const handleRemoverQuadra = async (quadra: Quadra) => {
    if (!confirm(`Deseja realmente excluir permanentemente a ${quadra.nome}?`)) {
      return;
    }

    try {
      const ok = await ArenaRepository.removerQuadra(quadra.id);
      if (ok) {
        toast.success("Quadra removida.");
        await recarregar();
      } else {
        toast.error("Não foi possível excluir a quadra.");
      }
    } catch {
      toast.error("Erro ao remover quadra.");
    }
  };

  // Abre modal para cadastrar nova tarifa dinâmica para uma quadra
  const abrirCriacaoPreco = useCallback((quadra: Quadra) => {
    setQuadraAlvoPreco(quadra);
    setPrecoDescricao("Tarifa Noturna com Luz");
    setHoraInicio("18:00");
    setHoraFim("23:00");
    setValorHoraEspecial(quadra.valorHoraPadrao + 30);
    setDiasSelecionados([1, 2, 3, 4, 5]);
    setModalPrecoAberto(true);
  }, []);

  // Salva tarifa dinâmica
  const handleSalvarPreco = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quadraAlvoPreco) return;

    if (diasSelecionados.length === 0) {
      toast.error("Selecione pelo menos um dia da semana para a tarifa.");
      return;
    }

    try {
      await ArenaRepository.criarPreco({
        arenaId: arena.id,
        quadraId: quadraAlvoPreco.id,
        diasSemana: diasSelecionados,
        horaInicio,
        horaFim,
        valorHora: valorHoraEspecial,
        descricao: precoDescricao || "Tarifa Especial",
        ativo: true,
      });

      toast.success("Regra de preço dinâmica cadastrada!");
      setModalPrecoAberto(false);
      await recarregar();
    } catch {
      toast.error("Erro ao cadastrar tarifa dinâmica.");
    }
  };

  // Remove regra de preço dinâmica
  const handleRemoverPreco = async (precoId: string) => {
    try {
      const ok = await ArenaRepository.removerPreco(precoId);
      if (ok) {
        toast.success("Regra de preço removida.");
        await recarregar();
      }
    } catch {
      toast.error("Erro ao remover regra de preço.");
    }
  };

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Quadras e preços"
        descricao="Quadras, piso, esportes e a tabela de preços por horário e dia da semana."
        acoes={
          <Botao icone={Plus} onClick={abrirCriacaoQuadra}>
            Nova quadra
          </Botao>
        }
      />

      {/* ── Grid de Quadras ──────────────────────────────────────────────────── */}
      {carregando ? (
        <div className="py-20 text-center">
          <span className="inline-block w-8 h-8 border-2 border-painel-linha border-t-emerald-400 rounded-full animate-spin" />
          <p className="text-painel-suave text-xs mt-3">Carregando quadras e tarifas...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {quadras.map((quadra) => {
            const precosDestaQuadra = precos.filter((p) => p.quadraId === quadra.id);

            return (
              <div
                key={quadra.id}
                className="bg-painel-superficie border border-painel-linha rounded-lg p-6 flex flex-col justify-between hover:border-painel-linha transition-all duration-200"
              >
                <div>
                  {/* Cabeçalho do Card */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-md bg-painel-destaque-suave text-painel-destaque border border-painel-destaque font-bold text-xs">
                          Quadra #{quadra.numero}
                        </span>
                        <h3 className="text-lg font-semibold text-painel-tinta">
                          {quadra.nome}
                        </h3>
                      </div>
                      <p className="text-xs text-painel-suave mt-1">
                        {quadra.descricao || "Sem observações adicionais."}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => abrirEdicaoQuadra(quadra)}
                        className="p-2 rounded-lg bg-painel-elevada hover:bg-painel-fundo text-painel-tinta transition-colors"
                        title="Editar Quadra"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleRemoverQuadra(quadra)}
                        className="p-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 transition-colors"
                        title="Remover Quadra"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Badges de características */}
                  <div className="flex flex-wrap gap-2 mb-5">
                    <span className="text-xs bg-painel-elevada text-painel-tinta border border-painel-linha px-2.5 py-1 rounded-md font-medium">
                      Piso: {quadra.tipoPiso}
                    </span>
                    <span
                      className={`text-xs px-2.5 py-1 rounded-md font-medium border flex items-center gap-1 ${
                        quadra.coberta
                          ? "bg-sky-50 text-sky-700 border-sky-200"
                          : "bg-painel-elevada text-painel-suave border-painel-linha"
                      }`}
                    >
                      <ShieldCheck className="w-3 h-3" />
                      {quadra.coberta ? "Coberta" : "Descoberta"}
                    </span>
                    <span
                      className={`text-xs px-2.5 py-1 rounded-md font-medium border flex items-center gap-1 ${
                        quadra.iluminacao
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-painel-elevada text-painel-suave border-painel-linha"
                      }`}
                    >
                      <Sun className="w-3 h-3" />
                      {quadra.iluminacao ? "Com Iluminação" : "Sem Iluminação"}
                    </span>
                    <span className="text-xs bg-emerald-50 text-painel-destaque border border-emerald-200 px-2.5 py-1 rounded-md font-bold">
                      Base: R$ {quadra.valorHoraPadrao.toFixed(2)}/h
                    </span>
                  </div>

                  {/* Modalidades Esportivas */}
                  <div className="mb-5">
                    <span className="text-xs font-bold text-painel-suave">
                      Modalidades Permitidas
                    </span>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {quadra.esportes && quadra.esportes.length > 0 ? (
                        quadra.esportes.map((esp) => (
                          <span
                            key={esp}
                            className="text-xs bg-painel-elevada text-painel-tinta border border-painel-linha px-2 py-0.5 rounded font-medium"
                          >
                            {esp}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-painel-suave italic">
                          Todas as modalidades liberadas
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Tarifas Dinâmicas */}
                  <div className="border-t border-painel-linha pt-4">
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="text-xs font-bold text-painel-tinta flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-painel-destaque" />
                        Tarifas Especiais por Horário/Dia
                      </span>
                      <button
                        onClick={() => abrirCriacaoPreco(quadra)}
                        className="text-xs text-painel-destaque hover:text-painel-destaque font-bold flex items-center gap-1 transition-colors"
                      >
                        <Plus className="w-3 h-3" /> Adicionar Tarifa
                      </button>
                    </div>

                    {precosDestaQuadra.length === 0 ? (
                      <p className="text-xs text-painel-suave italic">
                        Nenhuma tarifa dinâmica cadastrada. A quadra opera sempre com o valor base.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {precosDestaQuadra.map((prc) => (
                          <div
                            key={prc.id}
                            className="bg-painel-superficie border border-painel-linha rounded-md p-2.5 flex items-center justify-between text-xs"
                          >
                            <div>
                              <div className="font-bold text-painel-tinta">
                                {prc.descricao || "Tarifa Especial"}
                              </div>
                              <div className="text-xs text-painel-suave mt-0.5">
                                {prc.horaInicio} às {prc.horaFim} ·{" "}
                                {prc.diasSemana.map((d) => DIAS_SEMANA_NOMES[d]).join(", ")}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-painel-destaque">
                                R$ {Number(prc.valorHora).toFixed(2)}/h
                              </span>
                              <button
                                onClick={() => handleRemoverPreco(prc.id)}
                                className="p-1 rounded text-painel-suave hover:text-red-700 transition-colors"
                                title="Remover tarifa"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal de Criação / Edição de Quadra ──────────────────────────────── */}
      {modalQuadraAberto && (
        <Janela
          aberta
          titulo={quadraEmEdicao ? `Editar ${quadraEmEdicao.nome}` : "Cadastrar nova quadra"}
          aoFechar={() => setModalQuadraAberto(false)}
        >
            <form onSubmit={handleSalvarQuadra} className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-painel-suave mb-1">
                    Número
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={numero}
                    onChange={(e) => setNumero(Number(e.target.value))}
                    className="w-full bg-painel-superficie border border-painel-linha rounded-md px-3 py-2 text-painel-tinta text-sm focus:outline-none focus:border-painel-destaque"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-painel-suave mb-1">
                    Nome da Quadra
                  </label>
                  <input
                    type="text"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Ex: Quadra 1 (Areia Central)"
                    className="w-full bg-painel-superficie border border-painel-linha rounded-md px-3 py-2 text-painel-tinta text-sm focus:outline-none focus:border-painel-destaque"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-painel-suave mb-1">
                  Tipo de Piso
                </label>
                <select
                  value={tipoPiso}
                  onChange={(e) => setTipoPiso(e.target.value as TipoPisoQuadra)}
                  className="w-full bg-painel-superficie border border-painel-linha rounded-md px-3 py-2 text-painel-tinta text-sm focus:outline-none focus:border-painel-destaque"
                >
                  {TIPOS_PISO.map((p) => (
                    <option key={p.valor} value={p.valor}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-painel-suave mb-1">
                    Tarifa Base (R$ / hora)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={valorHoraPadrao}
                    onChange={(e) => setValorHoraPadrao(Number(e.target.value))}
                    className="w-full bg-painel-superficie border border-painel-linha rounded-md px-3 py-2 text-painel-tinta text-sm focus:outline-none focus:border-painel-destaque"
                    required
                  />
                </div>

                <div className="flex flex-col justify-center gap-2 pt-2">
                  <label className="flex items-center gap-2 text-xs text-painel-tinta cursor-pointer">
                    <input
                      type="checkbox"
                      checked={coberta}
                      onChange={(e) => setCoberta(e.target.checked)}
                      className="rounded border-painel-linha bg-painel-superficie text-painel-destaque focus:ring-0"
                    />
                    Quadra Coberta
                  </label>
                  <label className="flex items-center gap-2 text-xs text-painel-tinta cursor-pointer">
                    <input
                      type="checkbox"
                      checked={iluminacao}
                      onChange={(e) => setIluminacao(e.target.checked)}
                      className="rounded border-painel-linha bg-painel-superficie text-painel-destaque focus:ring-0"
                    />
                    Iluminação Noturna
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-painel-suave mb-1.5">
                  Modalidades Permitidas
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {ESPORTES.map((esp) => {
                    const ativo = esportesSelecionados.includes(esp);
                    return (
                      <button
                        type="button"
                        key={esp}
                        onClick={() => toggleEsporte(esp)}
                        className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors ${
                          ativo
                            ? "bg-painel-destaque-suave text-painel-destaque border-painel-destaque"
                            : "bg-painel-superficie text-painel-suave border-painel-linha hover:border-painel-linha"
                        }`}
                      >
                        {ativo ? "✓ " : "+ "}
                        {esp}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-painel-suave mb-1">
                  Descrição / Comodidades
                </label>
                <textarea
                  rows={2}
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Ex: Areia fina tratada, chuveirões anexos, arquibancada coberta."
                  className="w-full bg-painel-superficie border border-painel-linha rounded-md px-3 py-2 text-painel-tinta text-sm focus:outline-none focus:border-painel-destaque resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-painel-linha">
                <button
                  type="button"
                  onClick={() => setModalQuadraAberto(false)}
                  className="px-4 py-2 rounded-md text-painel-suave hover:text-painel-tinta text-xs font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-md bg-painel-destaque hover:bg-painel-destaque-forte text-white font-bold text-xs transition-colors"
                >
                  Salvar Quadra
                </button>
              </div>
            </form>
        </Janela>
      )}

      {/* ── Modal de Tarifa Dinâmica ────────────────────────────────────────── */}
      {modalPrecoAberto && quadraAlvoPreco && (
        <Janela aberta largura="sm" titulo="Adicionar tarifa especial" descricao={quadraAlvoPreco.nome} aoFechar={() => setModalPrecoAberto(false)}>
            <form onSubmit={handleSalvarPreco} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-painel-suave mb-1">
                  Rótulo / Motivo da Tarifa
                </label>
                <input
                  type="text"
                  value={precoDescricao}
                  onChange={(e) => setPrecoDescricao(e.target.value)}
                  placeholder="Ex: Tarifa Noturna com Luz"
                  className="w-full bg-painel-superficie border border-painel-linha rounded-md px-3 py-2 text-painel-tinta text-sm focus:outline-none focus:border-painel-destaque"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-painel-suave mb-1.5">
                  Dias da Semana Válidos
                </label>
                <div className="grid grid-cols-7 gap-1">
                  {DIAS_SEMANA_NOMES.map((nomeDia, idx) => {
                    const ativo = diasSelecionados.includes(idx);
                    return (
                      <button
                        type="button"
                        key={nomeDia}
                        onClick={() => toggleDiaSemana(idx)}
                        className={`py-1.5 rounded-lg border text-xs font-bold transition-colors ${
                          ativo
                            ? "bg-painel-destaque text-white border-emerald-400"
                            : "bg-painel-superficie text-painel-suave border-painel-linha hover:border-painel-linha"
                        }`}
                      >
                        {nomeDia}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-painel-suave mb-1">
                    Horário Início
                  </label>
                  <input
                    type="time"
                    value={horaInicio}
                    onChange={(e) => setHoraInicio(e.target.value)}
                    className="w-full bg-painel-superficie border border-painel-linha rounded-md px-3 py-2 text-painel-tinta text-sm focus:outline-none focus:border-painel-destaque"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-painel-suave mb-1">
                    Horário Fim
                  </label>
                  <input
                    type="time"
                    value={horaFim}
                    onChange={(e) => setHoraFim(e.target.value)}
                    className="w-full bg-painel-superficie border border-painel-linha rounded-md px-3 py-2 text-painel-tinta text-sm focus:outline-none focus:border-painel-destaque"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-painel-suave mb-1">
                  Valor da Hora Cheia (R$)
                </label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={valorHoraEspecial}
                  onChange={(e) => setValorHoraEspecial(Number(e.target.value))}
                  className="w-full bg-painel-superficie border border-painel-linha rounded-md px-3 py-2 text-painel-tinta text-sm focus:outline-none focus:border-painel-destaque"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-painel-linha">
                <button
                  type="button"
                  onClick={() => setModalPrecoAberto(false)}
                  className="px-4 py-2 rounded-md text-painel-suave hover:text-painel-tinta text-xs font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-md bg-painel-destaque hover:bg-painel-destaque-forte text-white font-bold text-xs transition-colors"
                >
                  Salvar Tarifa
                </button>
              </div>
            </form>
        </Janela>
      )}
    </div>
  );
}
