/**
 * ModalGerenciarVagas — Gerenciamento de vagas abertas pelo Organizador da Reserva.
 * Permite abrir/fechar vagas, atualizar a quantidade, aceitar os termos legais
 * e visualizar/contatar a lista de jogadores interessados.
 */

"use client";

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Users,
  AlertTriangle,
  MessageCircle,
  CheckCircle2,
  XCircle,
  Plus,
  Minus,
  ShieldAlert,
  Clock,
  Calendar,
} from "lucide-react";
import type { Reserva } from "@/store/useReservasStore";
import { useVagasService } from "@/hooks/useVagasService";
import { TERMO_RESPONSABILIDADE_ORGANIZADOR } from "@/lib/vagas/types";
import { formatarDataExibicao, mascaraWhatsApp } from "@/lib/constants";
import { useQuadrasCatalogo } from "@/store/useCatalogoArenaStore";

interface ModalGerenciarVagasProps {
  open: boolean;
  onClose: () => void;
  reserva: Reserva;
}

export function ModalGerenciarVagas({
  open,
  onClose,
  reserva,
}: ModalGerenciarVagasProps) {
  const quadrasCatalogo = useQuadrasCatalogo();
  const {
    abrirVagas,
    fecharVagas,
    atualizarQuantidadeVagas,
    getInteressadosReserva,
    atualizarStatusInteresse,
  } = useVagasService();

  const [quantidadeVagas, setQuantidadeVagas] = useState<number>(
    reserva.vagasAbertas && reserva.vagasAbertas > 0 ? reserva.vagasAbertas : 2
  );
  const [aceitouTermos, setAceitouTermos] = useState<boolean>(false);
  const [salvando, setSalvando] = useState<boolean>(false);

  // Sincroniza estado inicial ao abrir modal
  useEffect(() => {
    if (open) {
      setQuantidadeVagas(
        reserva.vagasAbertas && reserva.vagasAbertas > 0 ? reserva.vagasAbertas : 2
      );
      setAceitouTermos(reserva.permiteVagas || false);
    }
  }, [open, reserva]);

  const interessados = getInteressadosReserva(reserva.id);
  const quadra = quadrasCatalogo.find((q) => q.id === reserva.quadraId);
  const estaAberto = Boolean(reserva.permiteVagas && (reserva.vagasAbertas ?? 0) > 0);

  const handleSalvarVagas = async () => {
    if (!aceitouTermos) {
      toast.error("Termos obrigatórios", {
        description: "Você deve aceitar os termos de responsabilidade para abrir vagas.",
      });
      return;
    }

    setSalvando(true);
    const res = await abrirVagas(reserva.id, quantidadeVagas, aceitouTermos);
    setSalvando(false);

    if (res.sucesso) {
      toast.success("Vagas configuradas com sucesso!", {
        description: `Sua partida agora está visível no Mural com ${quantidadeVagas} vaga(s).`,
      });
      onClose();
    } else {
      toast.error(res.erro || "Não foi possível abrir as vagas.");
    }
  };

  const handleFecharVagas = async () => {
    setSalvando(true);
    const res = await fecharVagas(reserva.id);
    setSalvando(false);

    if (res.sucesso) {
      toast.info("Vagas encerradas", {
        description: "Sua partida foi removida do Mural de Vagas abertas.",
      });
      onClose();
    } else {
      toast.error(res.erro || "Erro ao encerrar vagas.");
    }
  };

  const handleDecrementarVagaPreenchida = async () => {
    const novaQtd = (reserva.vagasAbertas ?? 1) - 1;
    setSalvando(true);
    const res = await atualizarQuantidadeVagas(reserva.id, novaQtd);
    setSalvando(false);

    if (res.sucesso) {
      setQuantidadeVagas(Math.max(1, novaQtd));
      if (novaQtd <= 0) {
        toast.success("Todas as vagas foram preenchidas!", {
          description: "O anúncio da partida no Mural foi finalizado automaticamente.",
        });
        onClose();
      } else {
        toast.success("Vaga preenchida!", {
          description: `Restam agora ${novaQtd} vaga(s) aberta(s).`,
        });
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-800 text-white w-full sm:max-w-2xl max-h-[92vh] flex flex-col p-5 sm:p-7 rounded-3xl shadow-2xl overflow-hidden">
        <DialogHeader className="shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-black text-white tracking-tight">
                Gerenciar Vagas da Partida
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400 mt-0.5">
                Convide jogadores da plataforma para completar seu time
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Corpo rolável com proteção contra estouro horizontal */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-4 pr-1 min-w-0 mt-2">
          {/* Resumo da Partida */}
          <div className="bg-slate-850/80 border border-slate-800/90 rounded-2xl p-4 grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-slate-500 text-[10px] uppercase font-bold block">
                Quadra
              </span>
              <span className="font-semibold text-white">
                Quadra {quadra?.numero || "1"} ({reserva.esporte || "Esporte"})
              </span>
            </div>
            <div>
              <span className="text-slate-500 text-[10px] uppercase font-bold block">
                Data e Horário
              </span>
              <div className="flex items-center gap-1.5 text-slate-300 font-semibold mt-0.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>{formatarDataExibicao(reserva.data)}</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-400 text-[11px] mt-0.5">
                <Clock className="w-3 h-3 text-slate-500 shrink-0" />
                <span>
                  {reserva.horaInicio} às {reserva.horaFim}
                </span>
              </div>
            </div>
          </div>

          {/* Status Atual e Controle de Vagas */}
          <div className="space-y-4 pt-3 border-t border-slate-800">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Label className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Quantidade de Vagas Abertas
              </Label>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  estaAberto
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : "bg-slate-800 text-slate-400 border border-slate-700"
                }`}
              >
                {estaAberto ? `${reserva.vagasAbertas} vaga(s) ativa(s)` : "Vagas Fechadas"}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={quantidadeVagas <= 1 || salvando}
                onClick={() => setQuantidadeVagas((prev) => Math.max(1, prev - 1))}
                className="border-slate-700 bg-slate-800 text-white hover:bg-slate-700 h-10 w-10 rounded-xl shrink-0"
              >
                <Minus className="w-4 h-4" />
              </Button>

              <div className="flex-1 bg-slate-950 border border-slate-800 rounded-xl h-10 flex items-center justify-center font-black text-lg text-emerald-400 min-w-0">
                {quantidadeVagas} {quantidadeVagas === 1 ? "vaga" : "vagas"}
              </div>

              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={quantidadeVagas >= 20 || salvando}
                onClick={() => setQuantidadeVagas((prev) => Math.min(20, prev + 1))}
                className="border-slate-700 bg-slate-800 text-white hover:bg-slate-700 h-10 w-10 rounded-xl shrink-0"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            {estaAberto && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-850 border border-slate-800 text-xs">
                <div className="flex items-center gap-2 text-slate-300">
                  <MessageCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Acertou com alguém no WhatsApp?</span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={salvando}
                  onClick={handleDecrementarVagaPreenchida}
                  className="bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 text-xs font-bold h-8 px-3 shrink-0 self-start sm:self-auto"
                >
                  Preencher 1 Vaga (-1)
                </Button>
              </div>
            )}
          </div>

          {/* Termos Legais e Isenção Obrigatória */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-xs space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap text-amber-400 font-bold">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>Aviso Legal e Responsabilidade da Coleta</span>
              </div>
              {estaAberto && (
                <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Termo aceito
                </span>
              )}
            </div>
            <p className="text-slate-300 leading-relaxed text-[11px] break-words">
              {TERMO_RESPONSABILIDADE_ORGANIZADOR}
            </p>
            <label className="flex items-start gap-2.5 pt-2 border-t border-amber-500/20 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={aceitouTermos}
                onChange={(e) => setAceitouTermos(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500 shrink-0"
              />
              <span className="text-xs font-semibold text-white">
                Declaro que li, compreendi e assumo a responsabilidade integral pelo convite e organização.
              </span>
            </label>
          </div>

          {/* Lista de Interessados */}
          <div className="space-y-3 pt-3 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Users className="w-3.5 h-3.5 text-emerald-400" />
                Interessados nesta partida ({interessados.length})
              </h4>
            </div>

            {interessados.length === 0 ? (
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-5 text-center text-xs text-slate-400">
                Ainda não há jogadores interessados nesta partida. Assim que alguém clicar em
                &ldquo;Mostrar Interesse&rdquo; no Mural, o contato aparecerá aqui para você chamar!
              </div>
            ) : (
              <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                {interessados.map((item) => {
                  const digits = item.telefoneUsuario.replace(/\D/g, "");
                  const msgWhatsapp = encodeURIComponent(
                    `Olá ${item.nomeUsuario}, vi que você tem interesse na vaga da partida de ${reserva.esporte || "futebol"} no Reservei (${formatarDataExibicao(reserva.data)} às ${reserva.horaInicio}). Tudo bem?`
                  );
                  return (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-white text-sm truncate">
                            {item.nomeUsuario}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              item.status === "contatado"
                                ? "bg-emerald-500/20 text-emerald-300"
                                : item.status === "rejeitado"
                                ? "bg-red-500/20 text-red-300"
                                : "bg-amber-500/20 text-amber-300"
                            }`}
                          >
                            {item.status === "contatado"
                              ? "Contatado"
                              : item.status === "rejeitado"
                              ? "Dispensado"
                              : "Aguardando"}
                          </span>
                        </div>
                        <p className="text-slate-400 text-xs mt-0.5">
                          WhatsApp: {mascaraWhatsApp(item.telefoneUsuario)}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <a
                          href={`https://wa.me/55${digits}?text=${msgWhatsapp}`}
                          target="_blank"
                          rel="noreferrer"
                          onClick={() => atualizarStatusInteresse(item.id, "contatado")}
                        >
                          <Button
                            size="sm"
                            className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold h-8 text-xs gap-1.5 shrink-0"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            Chamar no WhatsApp
                          </Button>
                        </a>

                        {item.status === "pendente" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => atualizarStatusInteresse(item.id, "contatado")}
                            title="Marcar como contatado"
                            className="text-slate-400 hover:text-emerald-400 h-8 px-2"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Botões de Ação fixos no rodapé */}
        <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div>
            {estaAberto && (
              <Button
                type="button"
                variant="outline"
                disabled={salvando}
                onClick={handleFecharVagas}
                className="w-full sm:w-auto border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 font-bold text-xs h-10 rounded-xl"
              >
                Fechar Vagas (Não Aceitar Mais)
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2 justify-end w-full sm:w-auto">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="text-slate-400 hover:text-white text-xs h-10 rounded-xl"
            >
              Voltar
            </Button>

            <Button
              type="button"
              disabled={salvando}
              onClick={handleSalvarVagas}
              className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs h-10 px-5 rounded-xl shrink-0"
            >
              {salvando
                ? "Salvando..."
                : estaAberto
                ? "Atualizar Vagas"
                : "Habilitar e Publicar Vagas"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
